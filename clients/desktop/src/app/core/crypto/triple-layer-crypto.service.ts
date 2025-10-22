/**
 * Triple-Layer Crypto Service
 * Handles encryption/decryption with proper key management
 */

import { Injectable } from '@angular/core';
import { 
  CryptoKey as AppCryptoKey, 
  KeyClass, 
  KeyType, 
  CredentialMetadata,
  DecryptedCredentialData 
} from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class TripleLayerCryptoService {
  private masterKey: CryptoKey | null = null;

  private readonly PBKDF2_ITERATIONS = 100000;
  private readonly SALT_LENGTH = 32;
  private readonly IV_LENGTH = 12;
  private readonly KEY_LENGTH = 256;

  /**
   * Derive master key from password
   * This is the top-level key that protects all other keys
   */
  async deriveMasterKey(password: string, salt?: Uint8Array): Promise<{ masterKey: CryptoKey; salt: Uint8Array }> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    this.masterKey = masterKey;
    passwordBuffer.fill(0);

    return { masterKey, salt: actualSalt };
  }

  /**
   * Generate a new content key for encrypting credential data
   * This follows Apple's pattern: each credential gets its own key
   */
  async generateContentKey(): Promise<AppCryptoKey> {
    const contentKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );

    // Export the key to store it
    const keyData = await crypto.subtle.exportKey('raw', contentKey);

    return {
      uuid: '', // Will be set when stored
      keyClass: KeyClass.Symmetric,
      keyType: KeyType.AES256GCM,
      data: new Uint8Array(keyData),
      accessGroup: 'default',
      usageFlags: {
        encrypt: true,
        decrypt: true,
        wrap: false,
        unwrap: false,
        sign: false,
        verify: false,
        derive: false
      },
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      tombstone: false
    };
  }

  /**
   * Encrypt credential data with a content key
   * Returns wrappedKey (content key encrypted with master key) and encItem (data encrypted with content key)
   */
  async encryptCredentialData(
    data: DecryptedCredentialData,
    contentKey: CryptoKey
  ): Promise<{ wrappedKey: Uint8Array; encItem: Uint8Array; iv: Uint8Array }> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    // Encrypt the credential data with the content key
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    
    const dataIv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: dataIv },
      contentKey,
      dataBuffer
    );

    // Wrap the content key with the master key
    const wrapIv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      contentKey,
      this.masterKey,
      { name: 'AES-GCM', iv: wrapIv }
    );

    // Combine wrappedKey and wrapIv (Apple's pattern)
    const wrappedKeyWithIv = new Uint8Array(wrappedKey.byteLength + wrapIv.length);
    wrappedKeyWithIv.set(new Uint8Array(wrappedKey), 0);
    wrappedKeyWithIv.set(wrapIv, wrappedKey.byteLength);

    return {
      wrappedKey: wrappedKeyWithIv,
      encItem: new Uint8Array(encryptedData),
      iv: dataIv
    };
  }

  /**
   * Decrypt credential data
   * Unwraps the content key and then decrypts the data
   */
  async decryptCredentialData(
    wrappedKeyWithIv: Uint8Array,
    encItem: Uint8Array,
    iv: Uint8Array
  ): Promise<DecryptedCredentialData> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    // Split wrappedKey and wrapIv (last 12 bytes is IV)
    const wrappedKey = wrappedKeyWithIv.slice(0, -this.IV_LENGTH);
    const wrapIv = wrappedKeyWithIv.slice(-this.IV_LENGTH);

    // Unwrap the content key
    // Convert to proper BufferSource type
    const wrappedKeyBuffer = new Uint8Array(wrappedKey).buffer;
    const wrapIvBuffer = new Uint8Array(wrapIv);

    const contentKey = await crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBuffer,
      this.masterKey,
      { name: 'AES-GCM', iv: wrapIvBuffer },
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['decrypt']
    );

    // Decrypt the data
    const dataIvBuffer = new Uint8Array(iv);
    const encItemBuffer = new Uint8Array(encItem).buffer;

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: dataIvBuffer },
      contentKey,
      encItemBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);

    return JSON.parse(jsonString);
  }

  /**
   * Wrap an existing key (for storage)
   */
  async wrapKey(key: CryptoKey): Promise<{ wrappedKey: Uint8Array; iv: Uint8Array }> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      key,
      this.masterKey,
      { name: 'AES-GCM', iv: iv }
    );

    return {
      wrappedKey: new Uint8Array(wrappedKey),
      iv
    };
  }

  /**
   * Unwrap a stored key
   */
  async unwrapKey(wrappedKey: Uint8Array, iv: Uint8Array): Promise<CryptoKey> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    // Convert to proper BufferSource type
    const wrappedKeyBuffer = new Uint8Array(wrappedKey).buffer;
    const ivBuffer = new Uint8Array(iv);

    return await crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBuffer,
      this.masterKey,
      { name: 'AES-GCM', iv: ivBuffer },
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  clearMasterKey(): void {
    this.masterKey = null;
  }

  hasMasterKey(): boolean {
    return this.masterKey !== null;
  }

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.arrayBufferToBase64(hashBuffer);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

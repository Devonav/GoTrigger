import { Injectable } from '@angular/core';

export interface EncryptedData {
  wrappedKey: string;    // Base64 encoded wrapped content key
  encItem: string;       // Base64 encoded encrypted data
  iv: string;            // Base64 encoded IV
  salt: string;          // Base64 encoded salt (for PBKDF2)
}

export interface DerivedKeys {
  masterKey: CryptoKey;
  encryptionKey: CryptoKey;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private masterKey: CryptoKey | null = null;
  private encryptionKey: CryptoKey | null = null;

  private readonly PBKDF2_ITERATIONS = 100000;
  private readonly SALT_LENGTH = 32;
  private readonly IV_LENGTH = 12;
  private readonly KEY_LENGTH = 256;

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

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    passwordBuffer.fill(0);

    return { masterKey, salt: actualSalt };
  }

  async encryptCredential(data: any): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    const contentKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    
    const dataIv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: dataIv },
      contentKey,
      dataBuffer
    );

    const wrapIv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      contentKey,
      this.masterKey,
      { name: 'AES-GCM', iv: wrapIv }
    );

    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    return {
      wrappedKey: this.arrayBufferToBase64(wrappedKey) + ':' + this.arrayBufferToBase64(wrapIv.buffer),
      encItem: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(dataIv.buffer),
      salt: this.arrayBufferToBase64(salt.buffer)
    };
  }

  async decryptCredential(encryptedData: EncryptedData): Promise<any> {
    if (!this.masterKey) {
      throw new Error('Master key not derived. Call deriveMasterKey first.');
    }

    const [wrappedKeyB64, wrapIvB64] = encryptedData.wrappedKey.split(':');
    const wrappedKeyBuffer = this.base64ToArrayBuffer(wrappedKeyB64);
    const wrapIv = this.base64ToArrayBuffer(wrapIvB64);

    const contentKey = await crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBuffer,
      this.masterKey,
      { name: 'AES-GCM', iv: wrapIv },
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      true,
      ['decrypt']
    );

    const encItemBuffer = this.base64ToArrayBuffer(encryptedData.encItem);
    const dataIv = this.base64ToArrayBuffer(encryptedData.iv);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: dataIv },
      contentKey,
      encItemBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    
    return JSON.parse(jsonString);
  }

  clearMasterKey(): void {
    this.masterKey = null;
    this.encryptionKey = null;
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

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async generateDeviceId(): Promise<string> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
}

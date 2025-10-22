/**
 * Credential Manager Service
 * High-level API for managing credentials using triple-layer architecture
 */

import { Injectable } from '@angular/core';
import { TripleLayerStorageService } from '../storage/triple-layer-storage.service';
import { TripleLayerCryptoService } from '../crypto/triple-layer-crypto.service';
import {
  CryptoKey,
  CredentialMetadata,
  SyncRecord,
  VaultCredential,
  DecryptedCredentialData,
  KeyClass,
  KeyType
} from '@shared/models';

export interface CreateCredentialRequest {
  server: string;
  account: string;
  password: string;
  protocol?: number;
  port?: number;
  path?: string;
  label?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CredentialManagerService {
  constructor(
    private storage: TripleLayerStorageService,
    private crypto: TripleLayerCryptoService
  ) {}

  async createCredential(request: CreateCredentialRequest, zone: string = 'default'): Promise<string> {
    if (!this.crypto.hasMasterKey()) {
      throw new Error('Master key not derived. Vault must be unlocked first.');
    }

    const credentialUUID = this.generateUUID();
    const passwordKeyUUID = this.generateUUID();

    const contentKey = await this.crypto.generateContentKey();
    contentKey.uuid = passwordKeyUUID;
    contentKey.label = `Password for ${request.server}`;
    contentKey.applicationLabel = 'PasswordSync';

    const wrappedContentKey = await this.crypto.wrapKey(await crypto.subtle.importKey(
      'raw',
      new Uint8Array(contentKey.data).buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    ));

    const passwordKey: CryptoKey = {
      ...contentKey,
      data: wrappedContentKey.wrappedKey
    };

    await this.storage.createCryptoKey(passwordKey);

    const metadata: CredentialMetadata = {
      uuid: credentialUUID,
      server: request.server,
      account: request.account,
      protocol: request.protocol || 443,
      port: request.port || 443,
      path: request.path,
      label: request.label || `${request.account}@${request.server}`,
      passwordKeyUUID,
      metadataKeyUUID: undefined,
      accessGroup: 'default',
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      tombstone: false
    };

    await this.storage.createCredentialMetadata(metadata);

    const credentialData: DecryptedCredentialData = {
      password: request.password,
      notes: request.notes,
      customFields: {}
    };

    const importedContentKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(contentKey.data).buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const encryptedBlob = await this.crypto.encryptCredentialData(credentialData, importedContentKey);

    console.log('🔐 Creating credential - encryption details:');
    console.log('  - wrappedKey length:', encryptedBlob.wrappedKey.length, 'bytes');
    console.log('  - encItem length:', encryptedBlob.encItem.length, 'bytes');
    console.log('  - data IV length:', encryptedBlob.iv.length, 'bytes');

    // Combine encItem and data IV (data IV goes at the end)
    const encItemWithIv = new Uint8Array(encryptedBlob.encItem.length + encryptedBlob.iv.length);
    encItemWithIv.set(encryptedBlob.encItem, 0);
    encItemWithIv.set(encryptedBlob.iv, encryptedBlob.encItem.length);

    console.log('  - encItemWithIv length:', encItemWithIv.length, 'bytes');

    const syncRecord: SyncRecord = {
      zone,
      uuid: credentialUUID,
      parentKeyUUID: passwordKeyUUID,
      gencount: 0,
      wrappedKey: encryptedBlob.wrappedKey,
      encItem: encItemWithIv,  // Now includes the data IV at the end
      encVersion: 1,
      contextID: 'default',
      tombstone: false,
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000
    };

    await this.storage.createSyncRecord(syncRecord);

    return credentialUUID;
  }

  async getCredential(uuid: string): Promise<VaultCredential | null> {
    const metadata = await this.storage.getCredentialMetadata(uuid);
    if (!metadata) {
      return null;
    }

    const syncRecord = await this.getSyncRecordByUUID(uuid);
    if (!syncRecord) {
      return null;
    }

    const ivLength = 12;

    // Extract data IV from encItem (last 12 bytes)
    const encItem = syncRecord.encItem.slice(0, -ivLength);
    const dataIv = syncRecord.encItem.slice(-ivLength);

    console.log('🔓 Decrypting credential', uuid, ':');
    console.log('  - wrappedKey length:', syncRecord.wrappedKey.length, 'bytes');
    console.log('  - encItem length:', encItem.length, 'bytes');
    console.log('  - data IV length:', dataIv.length, 'bytes');

    const decryptedData = await this.crypto.decryptCredentialData(
      syncRecord.wrappedKey,  // This contains wrappedKey + wrap IV
      encItem,                // This is just the encrypted data
      dataIv                  // This is the data IV
    );

    return {
      metadata,
      data: decryptedData
    };
  }

  async getAllCredentials(): Promise<VaultCredential[]> {
    const allMetadata = await this.storage.getAllCredentialMetadata();
    console.log('🔍 CredentialManager.getAllCredentials: Found', allMetadata.length, 'metadata records');
    const credentials: VaultCredential[] = [];

    for (const metadata of allMetadata) {
      if (metadata.tombstone) {
        continue;
      }

      try {
        const credential = await this.getCredential(metadata.uuid);
        if (credential) {
          credentials.push(credential);
        }
      } catch (error) {
        console.error('❌ CredentialManager: Failed to decrypt credential', metadata.uuid, ':', error);
        console.error('   This credential was likely encrypted with a different master password');
      }
    }

    console.log('🔍 CredentialManager.getAllCredentials: Successfully decrypted', credentials.length, 'credentials');
    return credentials;
  }

  async updateCredential(uuid: string, updates: Partial<CreateCredentialRequest>): Promise<void> {
    const metadata = await this.storage.getCredentialMetadata(uuid);
    if (!metadata) {
      throw new Error('Credential not found');
    }

    if (updates.server) metadata.server = updates.server;
    if (updates.account) metadata.account = updates.account;
    if (updates.protocol !== undefined) metadata.protocol = updates.protocol;
    if (updates.port !== undefined) metadata.port = updates.port;
    if (updates.path !== undefined) metadata.path = updates.path;
    if (updates.label !== undefined) metadata.label = updates.label;
    
    metadata.updatedAt = Date.now() / 1000;

    await this.storage.createCredentialMetadata(metadata);

    if (updates.password || updates.notes) {
      const syncRecord = await this.getSyncRecordByUUID(uuid);
      if (syncRecord) {
        const ivLength = 12;

        // Extract data IV from encItem
        const encItem = syncRecord.encItem.slice(0, -ivLength);
        const dataIv = syncRecord.encItem.slice(-ivLength);

        const currentData = await this.crypto.decryptCredentialData(
          syncRecord.wrappedKey,  // wrappedKey + wrap IV
          encItem,                // encrypted data only
          dataIv                  // data IV
        );

        const newData: DecryptedCredentialData = {
          password: updates.password || currentData.password,
          notes: updates.notes !== undefined ? updates.notes : currentData.notes,
          customFields: currentData.customFields
        };

        const passwordKey = await this.storage.getCryptoKey(metadata.passwordKeyUUID);
        if (!passwordKey) {
          throw new Error('Password key not found');
        }

        const unwrappedIv = passwordKey.data.slice(-12);
        const unwrappedKeyData = passwordKey.data.slice(0, -12);

        const contentKey = await this.crypto.unwrapKey(unwrappedKeyData, unwrappedIv);

        const encryptedBlob = await this.crypto.encryptCredentialData(newData, contentKey);

        // Combine encItem and data IV
        const encItemWithIv = new Uint8Array(encryptedBlob.encItem.length + encryptedBlob.iv.length);
        encItemWithIv.set(encryptedBlob.encItem, 0);
        encItemWithIv.set(encryptedBlob.iv, encryptedBlob.encItem.length);

        syncRecord.wrappedKey = encryptedBlob.wrappedKey;
        syncRecord.encItem = encItemWithIv;  // Now includes data IV
        syncRecord.updatedAt = Date.now() / 1000;

        await this.storage.createSyncRecord(syncRecord);
      }
    }
  }

  async deleteCredential(uuid: string): Promise<void> {
    const metadata = await this.storage.getCredentialMetadata(uuid);
    if (!metadata) {
      throw new Error('Credential not found');
    }

    metadata.tombstone = true;
    metadata.updatedAt = Date.now() / 1000;
    await this.storage.createCredentialMetadata(metadata);

    const syncRecord = await this.getSyncRecordByUUID(uuid);
    if (syncRecord) {
      syncRecord.tombstone = true;
      syncRecord.updatedAt = Date.now() / 1000;
      await this.storage.createSyncRecord(syncRecord);
    }

    const passwordKey = await this.storage.getCryptoKey(metadata.passwordKeyUUID);
    if (passwordKey) {
      passwordKey.tombstone = true;
      passwordKey.updatedAt = Date.now() / 1000;
      await this.storage.createCryptoKey(passwordKey);
    }
  }

  async searchByServer(server: string): Promise<VaultCredential[]> {
    const metadata = await this.storage.getCredentialsByServer(server);
    const credentials: VaultCredential[] = [];

    for (const meta of metadata) {
      if (meta.tombstone) {
        continue;
      }

      const credential = await this.getCredential(meta.uuid);
      if (credential) {
        credentials.push(credential);
      }
    }

    return credentials;
  }

  private async getSyncRecordByUUID(uuid: string): Promise<SyncRecord | null> {
    const records = await this.storage.getSyncRecordsByZone('default');
    return records.find(r => r.uuid === uuid) || null;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

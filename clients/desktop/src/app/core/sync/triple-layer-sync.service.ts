/**
 * Triple-Layer Sync Service
 * Handles sync with server using Apple's three-layer architecture
 */

import { Injectable } from '@angular/core';
import { ApiService, TripleLayerPushRequest } from '../../services/api.service';
import { TripleLayerStorageService } from '../storage/triple-layer-storage.service';
import { CryptoKey, CredentialMetadata, SyncRecord } from '@shared/models';

export interface TripleLayerSyncResult {
  pulled: {
    keys: number;
    metadata: number;
    records: number;
  };
  pushed: {
    keys: number;
    metadata: number;
    records: number;
  };
  conflicts: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TripleLayerSyncService {
  private syncInProgress = false;

  constructor(
    private api: ApiService,
    private storage: TripleLayerStorageService
  ) {}

  async fullSync(zone: string = 'default'): Promise<TripleLayerSyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: TripleLayerSyncResult = {
      pulled: { keys: 0, metadata: 0, records: 0 },
      pushed: { keys: 0, metadata: 0, records: 0 },
      conflicts: 0,
      errors: []
    };

    try {
      const pullResult = await this.pullFromServer(zone);
      result.pulled = pullResult.pulled;
      result.conflicts = pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      const pushResult = await this.pushToServer(zone);
      result.pushed = pushResult.pushed;
      result.errors.push(...pushResult.errors);

      return result;
    } catch (error) {
      result.errors.push(String(error));
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async pullFromServer(zone: string = 'default'): Promise<{
    pulled: { keys: number; metadata: number; records: number };
    conflicts: number;
    errors: string[];
  }> {
    const result = {
      pulled: { keys: 0, metadata: 0, records: 0 },
      conflicts: 0,
      errors: [] as string[]
    };

    try {
      const localManifest = await this.storage.getSyncManifest(zone);
      
      const serverManifest = await this.api.getSyncManifest(zone).toPromise();
      
      if (!serverManifest) {
        result.errors.push('Failed to get server manifest');
        return result;
      }

      if (localManifest.gencount >= serverManifest.gencount) {
        return result;
      }

      const pullResponse = await this.api.pullTripleLayerSync(zone, localManifest.gencount).toPromise();

      if (!pullResponse) {
        return result;
      }

      for (const keyDTO of pullResponse.keys || []) {
        try {
          const key: CryptoKey = {
            uuid: keyDTO.item_uuid,
            keyClass: keyDTO.key_class,
            keyType: keyDTO.key_type,
            label: keyDTO.label,
            applicationLabel: keyDTO.application_label,
            data: this.base64ToUint8Array(keyDTO.data),
            usageFlags: JSON.parse(atob(keyDTO.usage_flags)),
            accessGroup: keyDTO.access_group || 'default',
            createdAt: Date.now() / 1000,
            updatedAt: Date.now() / 1000,
            tombstone: keyDTO.tombstone || false
          };

          await this.storage.createCryptoKey(key);
          result.pulled.keys++;
        } catch (error) {
          result.errors.push(`Failed to save crypto key ${keyDTO.item_uuid}: ${error}`);
        }
      }

      for (const metaDTO of pullResponse.credential_metadata || []) {
        try {
          const metadata: CredentialMetadata = {
            uuid: metaDTO.item_uuid,
            server: metaDTO.server,
            account: metaDTO.account,
            protocol: metaDTO.protocol,
            port: metaDTO.port,
            path: metaDTO.path,
            label: metaDTO.label,
            passwordKeyUUID: metaDTO.password_key_uuid,
            metadataKeyUUID: metaDTO.metadata_key_uuid,
            accessGroup: metaDTO.access_group || 'default',
            createdAt: Date.now() / 1000,
            updatedAt: Date.now() / 1000,
            tombstone: metaDTO.tombstone || false
          };

          await this.storage.createCredentialMetadata(metadata);
          result.pulled.metadata++;
        } catch (error) {
          result.errors.push(`Failed to save metadata ${metaDTO.item_uuid}: ${error}`);
        }
      }

      for (const recordDTO of pullResponse.sync_records || []) {
        try {
          const record: SyncRecord = {
            zone,
            uuid: recordDTO.item_uuid,
            parentKeyUUID: recordDTO.parent_key_uuid || '',
            gencount: recordDTO.gencount || 0,
            wrappedKey: this.base64ToUint8Array(recordDTO.wrapped_key),
            encItem: this.base64ToUint8Array(recordDTO.enc_item),
            encVersion: recordDTO.enc_version || 1,
            contextID: recordDTO.context_id || 'default',
            tombstone: recordDTO.tombstone || false,
            createdAt: Date.now() / 1000,
            updatedAt: Date.now() / 1000
          };

          await this.storage.createSyncRecord(record);
          result.pulled.records++;
        } catch (error) {
          result.errors.push(`Failed to save sync record ${recordDTO.item_uuid}: ${error}`);
        }
      }

      await this.storage.updateSyncManifest({
        zone,
        gencount: pullResponse.gencount,
        digest: serverManifest.digest ? this.base64ToUint8Array(serverManifest.digest) : null,
        leafIDs: [],
        updatedAt: Date.now() / 1000
      });

    } catch (error) {
      result.errors.push(`Pull sync failed: ${error}`);
    }

    return result;
  }

  async pushToServer(zone: string = 'default'): Promise<{
    pushed: { keys: number; metadata: number; records: number };
    errors: string[];
  }> {
    const result = {
      pushed: { keys: 0, metadata: 0, records: 0 },
      errors: [] as string[]
    };

    try {
      const syncRecords = await this.storage.getSyncRecordsByZone(zone);
      
      if (syncRecords.length === 0) {
        return result;
      }

      const keyUUIDs = new Set<string>();
      const metadataUUIDs = new Set<string>();
      
      for (const record of syncRecords) {
        if (record.parentKeyUUID) {
          keyUUIDs.add(record.parentKeyUUID);
        }
        metadataUUIDs.add(record.uuid);
      }

      const keys: any[] = [];
      for (const uuid of keyUUIDs) {
        const key = await this.storage.getCryptoKey(uuid);
        if (key) {
          keys.push({
            item_uuid: key.uuid,
            key_class: key.keyClass,
            key_type: key.keyType,
            label: key.label || '',
            application_label: key.applicationLabel || '',
            data: this.uint8ArrayToBase64(key.data),
            usage_flags: btoa(JSON.stringify(key.usageFlags)),
            access_group: key.accessGroup
          });
        }
      }

      const metadata: any[] = [];
      for (const uuid of metadataUUIDs) {
        const meta = await this.storage.getCredentialMetadata(uuid);
        if (meta) {
          metadata.push({
            item_uuid: meta.uuid,
            server: meta.server,
            account: meta.account,
            protocol: meta.protocol,
            port: meta.port,
            path: meta.path || '',
            label: meta.label || '',
            access_group: meta.accessGroup,
            password_key_uuid: meta.passwordKeyUUID,
            metadata_key_uuid: meta.metadataKeyUUID || ''
          });
        }
      }

      const records: any[] = syncRecords.map(record => ({
        item_uuid: record.uuid,
        parent_key_uuid: record.parentKeyUUID,
        wrapped_key: this.uint8ArrayToBase64(record.wrappedKey),
        enc_item: this.uint8ArrayToBase64(record.encItem),
        enc_version: record.encVersion,
        context_id: record.contextID
      }));

      const pushRequest: TripleLayerPushRequest = {
        zone,
        keys,
        credential_metadata: metadata,
        sync_records: records
      };

      const pushResponse = await this.api.pushTripleLayerSync(pushRequest).toPromise();

      if (pushResponse) {
        result.pushed.keys = keys.length;
        result.pushed.metadata = metadata.length;
        result.pushed.records = records.length;

        await this.storage.updateSyncManifest({
          zone,
          gencount: pushResponse.gencount,
          digest: null,
          leafIDs: [],
          updatedAt: Date.now() / 1000
        });
      }

    } catch (error) {
      result.errors.push(`Push sync failed: ${error}`);
    }

    return result;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private uint8ArrayToBase64(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

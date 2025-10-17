/**
 * Triple-Layer Storage Service
 * Implements Apple's keychain pattern: CryptoKey -> Credential -> SyncRecord
 */

import { Injectable } from '@angular/core';
import { 
  CryptoKey, 
  CredentialMetadata, 
  SyncRecord, 
  SyncManifest 
} from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class TripleLayerStorageService {
  private initialized = false;

  private get database() {
    if (!window.electron?.database) {
      throw new Error('Electron database API not available');
    }
    return window.electron.database;
  }

  async initialize(): Promise<string> {
    if (this.initialized) {
      return 'already initialized';
    }

    const result = await this.database.initialize();
    
    if (result.success) {
      this.initialized = true;
      return result.path || 'unknown';
    } else {
      throw new Error(result.error || 'Failed to initialize database');
    }
  }

  // ===== LAYER 1: CryptoKey Operations =====

  async createCryptoKey(key: CryptoKey): Promise<string> {
    const result = await this.database.createCryptoKey(key);
    
    if (result.success && result.uuid) {
      return result.uuid;
    } else {
      throw new Error(result.error || 'Failed to create crypto key');
    }
  }

  async getCryptoKey(uuid: string): Promise<CryptoKey | null> {
    const result = await this.database.getCryptoKey(uuid);
    
    if (result.success && result.key) {
      return result.key as CryptoKey;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return null;
  }

  // ===== LAYER 2: Credential Operations =====

  async createCredentialMetadata(metadata: CredentialMetadata): Promise<string> {
    const result = await this.database.createCredentialMetadata(metadata);
    
    if (result.success && result.uuid) {
      return result.uuid;
    } else {
      throw new Error(result.error || 'Failed to create credential metadata');
    }
  }

  async getCredentialMetadata(uuid: string): Promise<CredentialMetadata | null> {
    const result = await this.database.getCredentialMetadata(uuid);
    
    if (result.success && result.metadata) {
      return result.metadata as CredentialMetadata;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return null;
  }

  async getAllCredentialMetadata(): Promise<CredentialMetadata[]> {
    const result = await this.database.getAllCredentialMetadata();
    
    if (result.success && result.credentials) {
      return result.credentials as CredentialMetadata[];
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return [];
  }

  async getCredentialsByServer(server: string): Promise<CredentialMetadata[]> {
    const result = await this.database.getCredentialsByServer(server);
    
    if (result.success && result.credentials) {
      return result.credentials as CredentialMetadata[];
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return [];
  }

  // ===== LAYER 3: Sync Operations =====

  async createSyncRecord(record: SyncRecord): Promise<void> {
    const result = await this.database.createSyncRecord(record);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create sync record');
    }
  }

  async getSyncRecordsByZone(zone: string): Promise<SyncRecord[]> {
    const result = await this.database.getSyncRecordsByZone(zone);
    
    if (result.success && result.records) {
      return result.records as SyncRecord[];
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return [];
  }

  async updateSyncManifest(manifest: SyncManifest): Promise<void> {
    const result = await this.database.updateSyncManifest(manifest);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update sync manifest');
    }
  }

  async getSyncManifest(zone: string): Promise<SyncManifest> {
    const result = await this.database.getSyncManifest(zone);
    
    if (result.success && result.manifest) {
      return result.manifest as SyncManifest;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    // Return empty manifest for new zones
    return {
      zone,
      gencount: 0,
      digest: null,
      leafIDs: [],
      updatedAt: Date.now() / 1000
    };
  }

  // ===== Config Operations =====

  async setConfig(key: string, value: string): Promise<void> {
    const result = await this.database.setConfig(key, value);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to set config');
    }
  }

  async getConfig(key: string): Promise<string | null> {
    const result = await this.database.getConfig(key);
    
    if (result.success) {
      return result.value || null;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return null;
  }

  async close(): Promise<void> {
    const result = await this.database.close();
    
    if (result.success) {
      this.initialized = false;
    } else {
      throw new Error(result.error || 'Failed to close database');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

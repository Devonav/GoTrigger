import { Injectable } from '@angular/core';
import { StoredCredential } from '@shared/models/credential.model';

@Injectable({
  providedIn: 'root'
})
export class VaultStorageService {
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

  async saveCredential(credential: StoredCredential): Promise<string> {
    const result = await this.database.createCredential(credential);
    
    if (result.success && result.uuid) {
      return result.uuid;
    } else {
      throw new Error(result.error || 'Failed to save credential');
    }
  }

  async getCredential(uuid: string): Promise<StoredCredential | null> {
    const result = await this.database.getCredential(uuid);
    
    if (result.success && result.credential) {
      return result.credential as StoredCredential;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return null;
  }

  async getAllCredentials(): Promise<StoredCredential[]> {
    const result = await this.database.getAllCredentials();
    
    if (result.success && result.credentials) {
      return result.credentials as StoredCredential[];
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return [];
  }

  async searchCredentialsByServer(server: string): Promise<StoredCredential[]> {
    const result = await this.database.getCredentialsByServer(server);
    
    if (result.success && result.credentials) {
      return result.credentials as StoredCredential[];
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return [];
  }

  async updateCredential(uuid: string, updates: Partial<StoredCredential>): Promise<void> {
    const result = await this.database.updateCredential(uuid, updates);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update credential');
    }
  }

  async deleteCredential(uuid: string): Promise<void> {
    const result = await this.database.deleteCredential(uuid);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete credential');
    }
  }

  async setSyncState(zone: string, gencount: number, digest: string): Promise<void> {
    const result = await this.database.setSyncState(zone, gencount, digest);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to set sync state');
    }
  }

  async getSyncState(zone: string = 'default'): Promise<{ zone: string; gencount: number; digest: string | null }> {
    const result = await this.database.getSyncState(zone);
    
    if (result.success && result.state) {
      return result.state;
    } else if (result.error) {
      throw new Error(result.error);
    }
    
    return { zone, gencount: 0, digest: null };
  }

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

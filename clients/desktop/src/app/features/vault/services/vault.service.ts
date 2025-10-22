import { Injectable, signal } from '@angular/core';
import { TripleLayerCryptoService } from '../../../core/crypto/triple-layer-crypto.service';
import { CredentialManagerService } from '../../../core/vault/credential-manager.service';
import { TripleLayerSyncService } from '../../../core/sync/triple-layer-sync.service';
import { TripleLayerStorageService } from '../../../core/storage/triple-layer-storage.service';
import { VaultCredential } from '../../../shared/models';
import { ApiService } from '../../../services/api.service';

interface LegacyVaultCredential {
  uuid: string;
  server: string;
  account: string;
  data: {
    url?: string;
    username: string;
    password: string;
    notes?: string;
  };
  gencount?: number;
  created_at?: number;
  updated_at?: number;
}

@Injectable({
  providedIn: 'root'
})
export class VaultService {
  private credentials = signal<LegacyVaultCredential[]>([]);
  private isLocked = signal(true);
  private autoLockTimer: any = null;
  private readonly AUTO_LOCK_TIMEOUT = 300000; // 5 minutes

  constructor(
    private crypto: TripleLayerCryptoService,
    private manager: CredentialManagerService,
    private sync: TripleLayerSyncService,
    private api: ApiService,
    private storage: TripleLayerStorageService
  ) {}

  async unlock(password: string, salt?: Uint8Array): Promise<void> {
    await this.crypto.deriveMasterKey(password, salt);
    await this.loadCredentials();
    this.isLocked.set(false);
    this.startAutoLockTimer();
  }

  async ensureInitialized(): Promise<void> {
    try {
      await this.storage.initialize();
      console.log('✅ Storage initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  async lock(): Promise<void> {
    this.crypto.clearMasterKey();
    this.credentials.set([]);
    this.isLocked.set(true);
    this.stopAutoLockTimer();
  }

  async loadCredentials(): Promise<void> {
    console.log('🔍 VaultService.loadCredentials: Starting to load credentials...');
    console.log('🔍 VaultService.loadCredentials: Master key derived?', this.crypto.hasMasterKey());

    const allCreds = await this.manager.getAllCredentials();
    console.log('🔍 VaultService.loadCredentials: Got', allCreds.length, 'credentials from manager');

    const legacyCreds: LegacyVaultCredential[] = allCreds.map(cred => ({
      uuid: cred.metadata.uuid,
      server: cred.metadata.server,
      account: cred.metadata.account,
      data: {
        url: `https://${cred.metadata.server}${cred.metadata.path || ''}`,
        username: cred.metadata.account,
        password: cred.data.password,
        notes: cred.data.notes
      },
      gencount: 0,
      created_at: cred.metadata.createdAt,
      updated_at: cred.metadata.updatedAt
    }));

    console.log('🔍 VaultService.loadCredentials: Setting', legacyCreds.length, 'credentials in signal');
    this.credentials.set(legacyCreds);
  }

  async addCredential(url: string, username: string, password: string, notes?: string): Promise<LegacyVaultCredential> {
    console.log('➕ Adding credential:', username, '@', url, 'Master key available?', this.crypto.hasMasterKey());
    let server = url;
    let path = '';

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      server = urlObj.hostname;
      path = urlObj.pathname;
    } catch {
      server = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }

    const uuid = await this.manager.createCredential({
      server,
      account: username,
      password,
      protocol: 443,
      port: 443,
      path,
      label: `${username}@${server}`,
      notes
    });
    console.log('✅ Credential created with UUID:', uuid);

    const newCred: LegacyVaultCredential = {
      uuid,
      server,
      account: username,
      data: {
        url,
        username,
        password,
        notes
      },
      gencount: 1
    };

    this.credentials.update(creds => [...creds, newCred]);
    this.resetAutoLockTimer();

    try {
      await this.sync.pushToServer('default');
    } catch (error) {
      console.warn('⚠️ Failed to sync credential to server:', error);
    }

    return newCred;
  }

  async updateCredential(uuid: string, url: string, username: string, password: string, notes?: string): Promise<void> {
    let server = url;
    let path = '';

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      server = urlObj.hostname;
      path = urlObj.pathname;
    } catch {
      server = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }

    await this.manager.updateCredential(uuid, {
      server,
      account: username,
      password,
      path,
      notes
    });

    this.credentials.update(creds =>
      creds.map(c =>
        c.uuid === uuid
          ? {
              ...c,
              server,
              account: username,
              data: { url, username, password, notes }
            }
          : c
      )
    );

    this.resetAutoLockTimer();

    try {
      await this.sync.pushToServer('default');
      console.log('✅ Credential updated and synced to server');
    } catch (error) {
      console.warn('⚠️ Failed to sync credential update to server:', error);
    }
  }

  async deleteCredential(uuid: string): Promise<void> {
    await this.manager.deleteCredential(uuid);
    this.credentials.update(creds => creds.filter(c => c.uuid !== uuid));
    this.resetAutoLockTimer();

    try {
      await this.sync.pushToServer('default');
      console.log('✅ Credential deleted and synced to server');
    } catch (error) {
      console.warn('⚠️ Failed to sync credential deletion to server:', error);
    }
  }

  async searchCredentials(query: string): Promise<LegacyVaultCredential[]> {
    const allCreds = this.credentials();
    
    if (!query.trim()) {
      return allCreds;
    }

    const lowerQuery = query.toLowerCase();
    return allCreds.filter(cred =>
      cred.server.toLowerCase().includes(lowerQuery) ||
      cred.account.toLowerCase().includes(lowerQuery) ||
      cred.data.url?.toLowerCase().includes(lowerQuery)
    );
  }

  getCredentials() {
    return this.credentials.asReadonly();
  }

  isVaultLocked() {
    return this.isLocked.asReadonly();
  }

  private startAutoLockTimer(): void {
    this.autoLockTimer = setTimeout(() => {
      this.lock();
    }, this.AUTO_LOCK_TIMEOUT);
  }

  private stopAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  private resetAutoLockTimer(): void {
    this.stopAutoLockTimer();
    this.startAutoLockTimer();
  }

  async deleteAllCredentials(): Promise<void> {
    try {
      console.log('🗑️ Attempting to delete all credentials from server...');
      await this.api.deleteAllCredentials('default').toPromise();
      console.log('✅ Successfully deleted all credentials from server');

      // Clear local credentials
      this.credentials.set([]);
    } catch (error) {
      console.error('Failed to delete all credentials:', error);
      throw error;
    }
  }

  async clearLocalStorage(): Promise<void> {
    try {
      // Use Electron IPC to clear the local SQLite database
      if (window.electron?.database?.clearDatabase) {
        await window.electron.database.clearDatabase();
        console.log('✅ Local database cleared');
      } else {
        throw new Error('Database clear API not available');
      }
    } catch (error) {
      console.error('Failed to clear local storage:', error);
      throw error;
    }
  }

  async resetVaultConfig(): Promise<void> {
    try {
      // Clear the salt and password verification
      // This will force the vault to be set up again
      await window.electron.database.setConfig('master_salt', '');
      await window.electron.database.setConfig('password_verification', '');
      await window.electron.database.setConfig('vault_initialized', '');
      console.log('✅ Vault config reset');
    } catch (error) {
      console.error('Failed to reset vault config:', error);
      throw error;
    }
  }
}

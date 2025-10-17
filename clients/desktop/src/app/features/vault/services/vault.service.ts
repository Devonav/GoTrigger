import { Injectable, signal } from '@angular/core';
import { TripleLayerCryptoService } from '../../../core/crypto/triple-layer-crypto.service';
import { CredentialManagerService } from '../../../core/vault/credential-manager.service';
import { TripleLayerSyncService } from '../../../core/sync/triple-layer-sync.service';
import { VaultCredential } from '../../../shared/models';

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
    private sync: TripleLayerSyncService
  ) {}

  async unlock(password: string, salt?: Uint8Array): Promise<void> {
    await this.crypto.deriveMasterKey(password, salt);
    await this.loadCredentials();
    this.isLocked.set(false);
    this.startAutoLockTimer();
  }

  async lock(): Promise<void> {
    this.crypto.clearMasterKey();
    this.credentials.set([]);
    this.isLocked.set(true);
    this.stopAutoLockTimer();
  }

  async loadCredentials(): Promise<void> {
    const allCreds = await this.manager.getAllCredentials();
    
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

    this.credentials.set(legacyCreds);
  }

  async addCredential(url: string, username: string, password: string, notes?: string): Promise<LegacyVaultCredential> {
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
      console.log('✅ Credential synced to server');
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
}

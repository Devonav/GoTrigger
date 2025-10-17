import { Injectable } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CryptoService } from '../crypto/crypto.service';
import { VaultStorageService } from '../storage/vault-storage.service';
import { StoredCredential } from '../../shared/models/credential.model';

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private syncInProgress = false;
  private autoSyncInterval: any = null;
  private readonly AUTO_SYNC_INTERVAL = 60000; // 1 minute

  constructor(
    private api: ApiService,
    private crypto: CryptoService,
    private storage: VaultStorageService
  ) {}

  async fullSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.crypto.hasMasterKey()) {
      throw new Error('Vault is locked. Unlock vault before syncing.');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      errors: []
    };

    try {
      const pullResult = await this.pullFromServer();
      result.pulled = pullResult.pulled;
      result.conflicts = pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      const pushResult = await this.pushToServer();
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

  async pullFromServer(): Promise<{ pulled: number; conflicts: number; errors: string[] }> {
    const result = { pulled: 0, conflicts: 0, errors: [] as string[] };

    try {
      const localState = await this.storage.getSyncState('default');
      
      const serverManifest = await this.api.getSyncManifest('default').toPromise();
      
      if (!serverManifest) {
        result.errors.push('Failed to get server manifest');
        return result;
      }

      // Quick digest check - if digests match, no sync needed
      if (localState.digest && serverManifest.digest === localState.digest) {
        console.log('Sync not needed - digests match');
        return result; // O(1) check saved us from downloading data!
      }

      // Check gencount as fallback
      if (serverManifest.gencount <= localState.gencount && localState.gencount > 0) {
        console.log('Sync not needed - gencount check');
        return result;
      }

      const pullResponse = await this.api.pullSync({
        zone: 'default',
        last_gencount: localState.gencount
      }).toPromise();

      if (!pullResponse || !pullResponse.updates) {
        return result;
      }

      for (const update of pullResponse.updates) {
        try {
          const existingCred = await this.storage.getCredential(update.uuid);
          
          if (existingCred && existingCred.gencount >= update.gencount) {
            result.conflicts++;
            continue;
          }

          const [wrappedKeyB64, ivB64] = update.wrappedkey.split(':');
          
          const decrypted = await this.crypto.decryptCredential({
            wrappedKey: update.wrappedkey,
            encItem: update.encitem,
            iv: ivB64 || '',
            salt: ''
          });

          const storedCred: StoredCredential = {
            uuid: update.uuid,
            server: decrypted.url || decrypted.server || 'unknown',
            account: decrypted.username || decrypted.account || 'unknown',
            wrappedKey: update.wrappedkey,
            encItem: update.encitem,
            iv: ivB64 || '',
            salt: '',
            gencount: update.gencount
          };

          if (existingCred) {
            await this.storage.updateCredential(update.uuid, storedCred);
          } else {
            await this.storage.saveCredential(storedCred);
          }

          result.pulled++;
        } catch (error) {
          result.errors.push(`Failed to process update ${update.uuid}: ${error}`);
        }
      }

      await this.storage.setSyncState('default', pullResponse.gencount, serverManifest.digest);

    } catch (error) {
      result.errors.push(`Pull sync failed: ${error}`);
    }

    return result;
  }

  async pushToServer(): Promise<{ pushed: number; errors: string[] }> {
    const result = { pushed: 0, errors: [] as string[] };

    try {
      const localState = await this.storage.getSyncState('default');
      const allCredentials = await this.storage.getAllCredentials();

      const recordsToPush = allCredentials.filter(cred => 
        cred.gencount > localState.gencount || !localState.gencount
      );

      if (recordsToPush.length === 0) {
        return result;
      }

      const pushRecords = recordsToPush.map(cred => ({
        uuid: cred.uuid,
        parent_key_uuid: 'master',
        wrapped_key: cred.wrappedKey,
        enc_item: cred.encItem
      }));

      const pushResponse = await this.api.pushSync('default', pushRecords).toPromise();

      if (pushResponse) {
        result.pushed = recordsToPush.length;
        await this.storage.setSyncState('default', pushResponse.gencount, '');
      }

    } catch (error) {
      result.errors.push(`Push sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Quick sync check using Merkle digest comparison (Apple's pattern)
   * This is an O(1) operation - just compares 32-byte SHA-256 digests
   * Much faster than checking gencount or downloading all records
   */
  async quickSyncCheck(): Promise<boolean> {
    if (!this.crypto.hasMasterKey()) {
      return false;
    }

    try {
      const localState = await this.storage.getSyncState('default');
      const serverManifest = await this.api.getSyncManifest('default').toPromise();

      if (!serverManifest) {
        return false;
      }

      // If local has no digest yet, we need to sync
      if (!localState.digest) {
        return true;
      }

      // Quick digest comparison (O(1) - just 32 bytes)
      // If digests match, data is identical on both sides
      if (serverManifest.digest === localState.digest) {
        return false; // No sync needed - digests match!
      }

      // Digests differ, sync is needed
      return true;
    } catch (error) {
      console.error('Quick sync check failed:', error);
      return false;
    }
  }

  startAutoSync(): void {
    if (this.autoSyncInterval) {
      return;
    }

    this.autoSyncInterval = setInterval(async () => {
      if (!this.crypto.hasMasterKey() || this.syncInProgress) {
        return;
      }

      try {
        const needsSync = await this.quickSyncCheck();
        if (needsSync) {
          await this.fullSync();
        }
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, this.AUTO_SYNC_INTERVAL);
  }

  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({
  name: 'vault',
  encryptionKey: 'password-sync-vault-key'
});

// Use global to persist across module reloads
const INIT_KEY = '__database_handlers_initialized__';

export function setupDatabaseHandlers(): void {
  if ((global as any)[INIT_KEY]) {
    console.log('Database handlers already initialized, skipping...');
    return;
  }
  (global as any)[INIT_KEY] = true;

  ipcMain.handle('db:initialize', async () => {
    try {
      return { success: true, path: (store as any).path };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:createCredential', async (_event, credential: any) => {
    try {
      const credentials = store.get('credentials', {}) as any;
      credentials[credential.uuid] = {
        ...credential,
        created_at: credential.created_at || Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        deleted: 0
      };
      store.set('credentials', credentials);
      return { success: true, uuid: credential.uuid };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:getCredential', async (_event, uuid: string) => {
    try {
      const credentials = store.get('credentials', {}) as any;
      const credential = credentials[uuid];
      if (credential && credential.deleted === 0) {
        return { success: true, credential };
      }
      return { success: false, error: 'Credential not found' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:getAllCredentials', async () => {
    try {
      const credentials = store.get('credentials', {}) as any;
      const result = Object.values(credentials)
        .filter((c: any) => c.deleted === 0)
        .sort((a: any, b: any) => b.updated_at - a.updated_at);
      return { success: true, credentials: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  /*
  ipcMain.handle('db:getCredentialsByServer', async (_event, server: string) => {
    try {
      const credentials = store.get('credentials', {}) as any;
      const result = Object.values(credentials)
        .filter((c: any) => c.deleted === 0 && c.server.toLowerCase().includes(server.toLowerCase()));
      return { success: true, credentials: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  */

  ipcMain.handle('db:updateCredential', async (_event, uuid: string, updates: any) => {
    try {
      const credentials = store.get('credentials', {}) as any;
      if (!credentials[uuid] || credentials[uuid].deleted === 1) {
        return { success: false, error: 'Credential not found' };
      }
      credentials[uuid] = {
        ...credentials[uuid],
        ...updates,
        updated_at: Math.floor(Date.now() / 1000)
      };
      store.set('credentials', credentials);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:deleteCredential', async (_event, uuid: string) => {
    try {
      const credentials = store.get('credentials', {}) as any;
      if (credentials[uuid]) {
        credentials[uuid].deleted = 1;
        credentials[uuid].updated_at = Math.floor(Date.now() / 1000);
        store.set('credentials', credentials);
        return { success: true };
      }
      return { success: false, error: 'Credential not found' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:setSyncState', async (_event, zone: string, gencount: number, digest: string) => {
    try {
      const syncState = store.get('sync_state', {}) as any;
      syncState[zone] = {
        gencount,
        digest,
        last_sync: Math.floor(Date.now() / 1000)
      };
      store.set('sync_state', syncState);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:getSyncState', async (_event, zone: string) => {
    try {
      const syncState = store.get('sync_state', {}) as any;
      const state = syncState[zone] || { gencount: 0, digest: null, last_sync: 0 };
      return { success: true, state: { zone, ...state } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:setConfig', async (_event, key: string, value: string) => {
    try {
      const config = store.get('config', {}) as any;
      config[key] = value;
      store.set('config', config);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:getConfig', async (_event, key: string) => {
    try {
      const config = store.get('config', {}) as any;
      return { success: true, value: config[key] || null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('db:close', async () => {
    return { success: true };
  });
}

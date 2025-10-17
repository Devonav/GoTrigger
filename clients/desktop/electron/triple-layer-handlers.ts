/**
 * IPC Handlers for Triple-Layer Data Model
 * Implements CryptoKey -> Credential -> SyncRecord pattern
 */

import { ipcMain } from 'electron';
import { getDatabase, getCurrentTimestamp } from './sqlite-database';
import { randomUUID } from 'crypto';

// Use global to persist across module reloads
const INIT_KEY = '__triple_layer_handlers_initialized__';

export function setupTripleLayerHandlers(): void {
  if ((global as any)[INIT_KEY]) {
    console.log('Triple-layer handlers already initialized, skipping...');
    return;
  }
  (global as any)[INIT_KEY] = true;
  
  // ===== LAYER 1: CryptoKey Operations =====
  
  ipcMain.handle('db:createCryptoKey', async (_event, key: any) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO keys (
          UUID, kcls, type, labl, data, agrp,
          encr, decr, wrap, unwp, sign, vrfy, drve,
          cdat, mdat, tomb
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = getCurrentTimestamp();
      const uuid = key.uuid || randomUUID();
      
      stmt.run(
        uuid,
        key.keyClass,
        key.keyType,
        key.label || null,
        Buffer.from(key.data),
        key.accessGroup,
        key.usageFlags.encrypt ? 1 : 0,
        key.usageFlags.decrypt ? 1 : 0,
        key.usageFlags.wrap ? 1 : 0,
        key.usageFlags.unwrap ? 1 : 0,
        key.usageFlags.sign ? 1 : 0,
        key.usageFlags.verify ? 1 : 0,
        key.usageFlags.derive ? 1 : 0,
        now,
        now,
        0
      );
      
      return { success: true, uuid };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getCryptoKey', async (_event, uuid: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM keys WHERE UUID = ? AND tomb = 0');
      const row = stmt.get(uuid) as any;
      
      if (!row) {
        return { success: false, error: 'Key not found' };
      }
      
      const key = {
        uuid: row.UUID,
        keyClass: row.kcls,
        keyType: row.type,
        label: row.labl,
        data: new Uint8Array(row.data),
        accessGroup: row.agrp,
        usageFlags: {
          encrypt: row.encr === 1,
          decrypt: row.decr === 1,
          wrap: row.wrap === 1,
          unwrap: row.unwp === 1,
          sign: row.sign === 1,
          verify: row.vrfy === 1,
          derive: row.drve === 1
        },
        createdAt: row.cdat,
        updatedAt: row.mdat,
        tombstone: row.tomb === 1
      };
      
      return { success: true, key };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  // ===== LAYER 2: Credential Operations =====
  
  ipcMain.handle('db:createCredentialMetadata', async (_event, credential: any) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO inet (
          UUID, acct, srvr, ptcl, port, path, labl,
          password_key_uuid, metadata_key_uuid,
          agrp, cdat, mdat, tomb
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = getCurrentTimestamp();
      const uuid = credential.uuid || randomUUID();
      
      stmt.run(
        uuid,
        credential.account,
        credential.server,
        credential.protocol || 443,
        credential.port || 443,
        credential.path || null,
        credential.label || null,
        credential.passwordKeyUUID,
        credential.metadataKeyUUID || null,
        credential.accessGroup,
        now,
        now,
        0
      );
      
      return { success: true, uuid };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getCredentialMetadata', async (_event, uuid: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM inet WHERE UUID = ? AND tomb = 0');
      const row = stmt.get(uuid) as any;
      
      if (!row) {
        return { success: false, error: 'Credential not found' };
      }
      
      const metadata = {
        uuid: row.UUID,
        server: row.srvr,
        account: row.acct,
        protocol: row.ptcl,
        port: row.port,
        path: row.path,
        label: row.labl,
        passwordKeyUUID: row.password_key_uuid,
        metadataKeyUUID: row.metadata_key_uuid,
        accessGroup: row.agrp,
        createdAt: row.cdat,
        updatedAt: row.mdat,
        tombstone: row.tomb === 1
      };
      
      return { success: true, metadata };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getAllCredentialMetadata', async () => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM inet WHERE tomb = 0 ORDER BY mdat DESC');
      const rows = stmt.all() as any[];
      
      const credentials = rows.map(row => ({
        uuid: row.UUID,
        server: row.srvr,
        account: row.acct,
        protocol: row.ptcl,
        port: row.port,
        path: row.path,
        label: row.labl,
        passwordKeyUUID: row.password_key_uuid,
        metadataKeyUUID: row.metadata_key_uuid,
        accessGroup: row.agrp,
        createdAt: row.cdat,
        updatedAt: row.mdat,
        tombstone: false
      }));
      
      return { success: true, credentials };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getCredentialsByServer', async (_event, server: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM inet WHERE srvr LIKE ? AND tomb = 0');
      const rows = stmt.all(`%${server}%`) as any[];
      
      const credentials = rows.map(row => ({
        uuid: row.UUID,
        server: row.srvr,
        account: row.acct,
        protocol: row.ptcl,
        port: row.port,
        passwordKeyUUID: row.password_key_uuid,
        metadataKeyUUID: row.metadata_key_uuid,
        accessGroup: row.agrp,
        createdAt: row.cdat,
        updatedAt: row.mdat
      }));
      
      return { success: true, credentials };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  // ===== LAYER 3: Sync Operations =====
  
  ipcMain.handle('db:createSyncRecord', async (_event, record: any) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ckmirror (
          ckzone, UUID, parentKeyUUID, gencount,
          wrappedkey, encitem, encver, contextID,
          cdat, mdat, tomb
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = getCurrentTimestamp();
      
      stmt.run(
        record.zone,
        record.uuid,
        record.parentKeyUUID,
        record.gencount,
        Buffer.from(record.wrappedKey),
        Buffer.from(record.encItem),
        record.encVersion || 1,
        record.contextID || 'default',
        now,
        now,
        record.tombstone ? 1 : 0
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getSyncRecordsByZone', async (_event, zone: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM ckmirror WHERE ckzone = ? ORDER BY gencount DESC');
      const rows = stmt.all(zone) as any[];
      
      const records = rows.map(row => ({
        zone: row.ckzone,
        uuid: row.UUID,
        parentKeyUUID: row.parentKeyUUID,
        gencount: row.gencount,
        wrappedKey: new Uint8Array(row.wrappedkey),
        encItem: new Uint8Array(row.encitem),
        encVersion: row.encver,
        contextID: row.contextID,
        createdAt: row.cdat,
        updatedAt: row.mdat,
        tombstone: row.tomb === 1
      }));
      
      return { success: true, records };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:updateSyncManifest', async (_event, manifest: any) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ckmanifest (
          ckzone, gencount, digest, leafIDs,
          signatures, signerID, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = getCurrentTimestamp();
      
      stmt.run(
        manifest.zone,
        manifest.gencount,
        manifest.digest ? Buffer.from(manifest.digest) : null,
        JSON.stringify(manifest.leafIDs || []),
        manifest.signatures ? Buffer.from(manifest.signatures) : null,
        manifest.signerID || null,
        now
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  ipcMain.handle('db:getSyncManifest', async (_event, zone: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM ckmanifest WHERE ckzone = ?');
      const row = stmt.get(zone) as any;
      
      if (!row) {
        return { 
          success: true, 
          manifest: {
            zone,
            gencount: 0,
            digest: null,
            leafIDs: [],
            signatures: null,
            signerID: null,
            updatedAt: getCurrentTimestamp()
          }
        };
      }
      
      const manifest = {
        zone: row.ckzone,
        gencount: row.gencount,
        digest: row.digest ? new Uint8Array(row.digest) : null,
        leafIDs: row.leafIDs ? JSON.parse(row.leafIDs) : [],
        signatures: row.signatures ? new Uint8Array(row.signatures) : null,
        signerID: row.signerID,
        updatedAt: row.updated_at
      };
      
      return { success: true, manifest };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

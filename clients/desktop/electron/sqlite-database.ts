/**
 * SQLite Database Handler
 * Implements Apple's triple-layer keychain pattern
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

let db: Database.Database | null = null;

const SCHEMA = `
-- Layer 1: Cryptographic Keys (Apple's keys table)
CREATE TABLE IF NOT EXISTS keys(
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    UUID TEXT UNIQUE NOT NULL,
    kcls INTEGER NOT NULL,           -- Key class (0=symmetric, 1=public, 2=private)
    type INTEGER NOT NULL,            -- Key type (0=AES-256-GCM, 1=Ed25519, 2=X25519)
    labl TEXT,                        -- Label
    data BLOB,                        -- Encrypted key data
    agrp TEXT NOT NULL,               -- Access group
    
    -- Usage flags
    encr INTEGER DEFAULT 0,           -- Can encrypt
    decr INTEGER DEFAULT 0,           -- Can decrypt
    wrap INTEGER DEFAULT 0,           -- Can wrap keys
    unwp INTEGER DEFAULT 0,           -- Can unwrap keys
    sign INTEGER DEFAULT 0,           -- Can sign
    vrfy INTEGER DEFAULT 0,           -- Can verify
    drve INTEGER DEFAULT 0,           -- Can derive
    
    -- Timestamps
    cdat REAL NOT NULL,               -- Created date (Unix timestamp)
    mdat REAL NOT NULL,               -- Modified date
    
    -- Sync
    tomb INTEGER NOT NULL DEFAULT 0   -- Tombstone (0=active, 1=deleted)
);

CREATE INDEX IF NOT EXISTS keysUUID ON keys(UUID);
CREATE INDEX IF NOT EXISTS keys_agrp_tomb ON keys(agrp, tomb);

-- Layer 2: Credential Metadata (Apple's inet table)
CREATE TABLE IF NOT EXISTS inet(
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    UUID TEXT UNIQUE NOT NULL,
    acct TEXT NOT NULL,               -- Account (username/email)
    srvr TEXT NOT NULL,               -- Server (domain)
    ptcl INTEGER NOT NULL DEFAULT 0,  -- Protocol (HTTPS=443)
    port INTEGER NOT NULL DEFAULT 0,  -- Port
    path TEXT,                        -- URL path
    labl TEXT,                        -- Label
    
    -- References to keys
    password_key_uuid TEXT NOT NULL,  -- References keys.UUID for password
    metadata_key_uuid TEXT,           -- References keys.UUID for encrypted metadata (optional)
    
    -- Access control
    agrp TEXT NOT NULL,               -- Access group
    
    -- Timestamps
    cdat REAL NOT NULL,
    mdat REAL NOT NULL,
    
    -- Sync
    tomb INTEGER NOT NULL DEFAULT 0,
    
    FOREIGN KEY (password_key_uuid) REFERENCES keys(UUID),
    FOREIGN KEY (metadata_key_uuid) REFERENCES keys(UUID)
);

CREATE INDEX IF NOT EXISTS inetUUID ON inet(UUID);
CREATE INDEX IF NOT EXISTS inet_srvr ON inet(srvr);
CREATE INDEX IF NOT EXISTS inet_agrp_tomb ON inet(agrp, tomb);

-- Layer 3: Sync Records (Apple's ckmirror table)
CREATE TABLE IF NOT EXISTS ckmirror(
    ckzone TEXT NOT NULL,
    UUID TEXT NOT NULL,
    parentKeyUUID TEXT NOT NULL,
    gencount INTEGER NOT NULL DEFAULT 0,
    wrappedkey BLOB NOT NULL,
    encitem BLOB NOT NULL,
    encver INTEGER NOT NULL DEFAULT 1,
    contextID TEXT NOT NULL DEFAULT 'default',
    
    -- Timestamps
    cdat REAL NOT NULL,
    mdat REAL NOT NULL,
    
    -- Sync
    tomb INTEGER NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ckzone, UUID, contextID)
);

CREATE INDEX IF NOT EXISTS ckmirror_zone_uuid ON ckmirror(ckzone, UUID);
CREATE INDEX IF NOT EXISTS ckmirror_zone_parentkey ON ckmirror(ckzone, parentKeyUUID);
CREATE INDEX IF NOT EXISTS ckmirror_gencount ON ckmirror(gencount);

-- Sync Manifest (Apple's ckmanifest table)
CREATE TABLE IF NOT EXISTS ckmanifest(
    ckzone TEXT PRIMARY KEY,
    gencount INTEGER NOT NULL DEFAULT 0,
    digest BLOB,
    leafIDs TEXT,                     -- JSON array of UUIDs
    signatures BLOB,
    signerID TEXT,
    updated_at REAL NOT NULL
);

-- Config/Metadata storage
CREATE TABLE IF NOT EXISTS config(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at REAL NOT NULL
);
`;

export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'vault.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create schema
  db.exec(SCHEMA);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper to get current Unix timestamp
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

# Architecture Refactoring Plan - Apple Keychain Patterns

## Critical Bug Fixed ✅

**File:** `clients/desktop/src/app/features/vault/components/unlock-vault/unlock-vault.component.ts:180`

```typescript
// BEFORE (CRITICAL BUG):
if (!verificationData) {
  return true; // ❌ Accepts any password if no verification blob exists!
}

// AFTER (FIXED):
if (!verificationData) {
  return false; // ✅ Requires verification blob to exist
}
```

**Impact:** This one-line bug allowed ANY password to unlock the vault. Fixed!

---

## Core Architectural Issues

### Issue #1: Flat Data Model (Missing Triple-Layer Pattern)

#### Current Implementation ❌

```typescript
// clients/desktop/src/app/shared/models/credential.model.ts
export interface StoredCredential {
  uuid: string;
  server: string;
  account: string;
  wrappedKey: string;    // Mixed with metadata
  encItem: string;       // Mixed with metadata
  gencount: number;
  // Everything in one flat structure
}
```

**Problems:**
- Can't share keys between credentials
- Can't rotate keys without re-encrypting everything
- Metadata mixed with crypto data
- Doesn't match Apple's proven pattern

#### Apple's Triple-Layer Pattern ✅

```
Layer 1: CryptoKey (keys table)
   └─> Cryptographic keys with usage flags
   
Layer 2: Credential (inet table)
   └─> Metadata (server, account, protocol)
   └─> References CryptoKey for decryption
   
Layer 3: SyncRecord (ckmirror table)
   └─> Sync orchestration
   └─> Contains wrappedkey + encitem
   └─> Links to parent key UUID
```

#### Refactored Implementation ✅

```typescript
// Step 1: CryptoKey (Layer 1)
export interface CryptoKey {
  uuid: string;
  keyClass: KeyClass;        // symmetric, asymmetric, etc.
  keyType: KeyType;          // AES-256-GCM, Ed25519, etc.
  data: Uint8Array;          // Encrypted key data
  accessGroup: string;       // Scope (user, device, shared)
  usageFlags: KeyUsageFlags; // encrypt, decrypt, sign, verify
  createdAt: number;
  updatedAt: number;
}

// Step 2: Credential (Layer 2)
export interface Credential {
  uuid: string;
  server: string;            // github.com
  account: string;           // user@example.com
  protocol: number;          // HTTPS = 443
  port: number;
  passwordKeyUUID: string;   // References CryptoKey
  metadataKeyUUID?: string;  // Optional: for encrypted metadata
  label?: string;
  createdAt: number;
  updatedAt: number;
}

// Step 3: SyncRecord (Layer 3)
export interface SyncRecord {
  zone: string;              // 'default'
  uuid: string;              // Matches Credential.uuid
  parentKeyUUID: string;     // Key hierarchy
  gencount: number;          // Lamport timestamp
  wrappedKey: Uint8Array;    // Encrypted content key
  encItem: Uint8Array;       // Encrypted credential data
  encVersion: number;        // Encryption version
  tombstone: boolean;        // Deletion marker
  contextID: string;         // Multi-context support
}
```

**Benefits:**
- ✅ Share keys across credentials
- ✅ Rotate keys without re-encrypting all data
- ✅ Clean separation of concerns
- ✅ Matches Apple's production pattern

---

### Issue #2: Missing Merkle Digest for Quick Sync Check

#### Current Implementation ❌

```typescript
// sync.service.ts
async fullSync() {
  // Always pulls ALL records to check for changes
  const manifest = await this.api.getSyncManifest();
  const records = await this.api.pullSync({ 
    zone: 'default', 
    last_gencount: 0 
  });
  // Inefficient: Downloads everything every time
}
```

**Problem:** No quick divergence check. Always downloads data even if nothing changed.

#### Apple's Pattern with Merkle Digest ✅

```typescript
// Step 1: Quick check with digest
async quickSyncCheck(): Promise<boolean> {
  const localState = await this.storage.getSyncState('default');
  const remoteManifest = await this.api.getSyncManifest('default');
  
  // Fast comparison: just compare digests
  if (localState.digest === remoteManifest.digest) {
    return false; // ✅ No sync needed
  }
  
  return true; // Needs sync
}

// Step 2: Only sync if needed
async fullSync() {
  const needsSync = await this.quickSyncCheck();
  if (!needsSync) {
    return { pulled: 0, pushed: 0 }; // Skip sync
  }
  
  // Only download changes
  const localGencount = (await this.storage.getSyncState('default')).gencount;
  const updates = await this.api.pullSync({
    zone: 'default',
    last_gencount: localGencount
  });
  
  // Process updates...
}
```

**Digest Calculation:**

```typescript
// On client and server (must match!)
function calculateManifestDigest(leafIDs: string[]): string {
  const sortedIDs = leafIDs.sort();
  const concatenated = sortedIDs.join('|');
  return sha256(concatenated);
}
```

**Benefits:**
- ✅ O(1) divergence check (compare digests)
- ✅ Avoid downloading when no changes
- ✅ Save bandwidth and CPU
- ✅ Fast sync for thousands of credentials

---

### Issue #3: No Trusted Peer Circle

#### Current Implementation ❌

```
Client → JWT Auth → Server → Postgres
                      ↓
              All clients sync through server
              No peer-to-peer capability
```

**Problem:** Single point of failure. Can't sync without server.

#### Apple's Trusted Peer Circle ✅

```
Device 1 (Current Device)
   Ed25519 keypair: (pub1, priv1)
   ↓
   Establishes trust with:
   ├─> Device 2 (MacBook) - pub2
   ├─> Device 3 (iPhone) - pub3
   └─> Device 4 (iPad) - pub4
   
Trust verification:
1. Device 1 generates challenge (32 random bytes)
2. Device 2 signs challenge with priv2
3. Device 1 verifies signature with pub2
4. Trust established → sync enabled
```

**Implementation:**

```typescript
// Peer Manager (client-side)
export class PeerManager {
  private myKeypair: Ed25519Keypair;
  private trustedPeers: Map<string, TrustedPeer>;
  
  async establishTrust(peerPublicKey: Uint8Array): Promise<void> {
    // Generate challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    // Send challenge to peer (via server or local network)
    const signature = await this.sendChallenge(peerPublicKey, challenge);
    
    // Verify signature
    const isValid = await this.verifySignature(
      peerPublicKey,
      challenge,
      signature
    );
    
    if (isValid) {
      this.trustedPeers.set(peerID, {
        publicKey: peerPublicKey,
        lastSeen: Date.now(),
        trustLevel: 2 // Full trust
      });
    }
  }
  
  async syncWithPeer(peerID: string): Promise<void> {
    const peer = this.trustedPeers.get(peerID);
    if (!peer) {
      throw new Error('Peer not trusted');
    }
    
    // Direct peer-to-peer sync (no server needed)
    // ...
  }
}
```

**Benefits:**
- ✅ Sync works offline (local network)
- ✅ No single point of failure
- ✅ Cryptographic trust (Ed25519)
- ✅ Matches Apple's production pattern

---

### Issue #4: GenCount Not Persisted (Already Identified)

**Status:** ✅ Documented in `CRITICAL_BUG_GENCOUNT.md`

**Fix:** Remove global `SyncEngine`, use per-user Postgres gencount.

---

## Refactoring Roadmap

### Phase 1: Critical Fixes (Immediate) 🔴

1. ✅ **DONE:** Fix master password verification bug
2. ⚠️ **TODO:** Persist gencount to Postgres
3. ⚠️ **TODO:** Add Merkle digest to sync manifest

**Estimated Time:** 2-4 hours  
**Risk:** Low (isolated changes)

### Phase 2: Data Model Refactor (High Priority) 🟠

1. Create new interfaces for CryptoKey, Credential, SyncRecord
2. Update SQLite schema (migration script needed)
3. Update Electron database handlers
4. Update Angular services to use new models
5. Write migration script for existing data

**Estimated Time:** 1-2 days  
**Risk:** Medium (schema changes, data migration)

### Phase 3: Merkle Digest Optimization (Medium Priority) 🟡

1. Implement digest calculation on client
2. Implement digest calculation on server
3. Update sync algorithm to use digest check
4. Add digest field to sync_state table

**Estimated Time:** 4-6 hours  
**Risk:** Low (additive change)

### Phase 4: Trusted Peer Circle (Low Priority) 🟢

1. Generate Ed25519 keypair per device
2. Implement challenge-response protocol
3. Add peer-to-peer sync capability
4. Add local network discovery

**Estimated Time:** 2-3 days  
**Risk:** High (complex networking, security)

---

## Database Schema Refactor

### Current Schema (Flat) ❌

```sql
-- Everything in one table
CREATE TABLE credentials (
  uuid TEXT PRIMARY KEY,
  server TEXT,
  account TEXT,
  wrappedkey BLOB,
  encitem BLOB,
  gencount INTEGER
);
```

### Apple's Schema (Triple-Layer) ✅

```sql
-- Layer 1: Cryptographic keys
CREATE TABLE keys(
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    UUID TEXT UNIQUE,
    kcls INTEGER NOT NULL,      -- Key class (symmetric, asymmetric)
    type INTEGER NOT NULL,       -- Key type (AES-256, Ed25519)
    data BLOB,                   -- Encrypted key data
    agrp TEXT NOT NULL,          -- Access group
    -- Usage flags
    encr INTEGER,                -- Can encrypt
    decr INTEGER,                -- Can decrypt
    wrap INTEGER,                -- Can wrap keys
    unwp INTEGER,                -- Can unwrap keys
    sign INTEGER,                -- Can sign
    vrfy INTEGER,                -- Can verify
    cdat REAL,                   -- Created date
    mdat REAL                    -- Modified date
);

-- Layer 2: Credentials (metadata)
CREATE TABLE inet(
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    UUID TEXT UNIQUE,
    acct BLOB NOT NULL,          -- Account (username)
    srvr BLOB NOT NULL,          -- Server (domain)
    ptcl INTEGER NOT NULL,       -- Protocol (HTTPS)
    port INTEGER NOT NULL,       -- Port (443)
    data BLOB,                   -- Encrypted password (references key)
    agrp TEXT NOT NULL,          -- Access group
    cdat REAL,                   -- Created date
    mdat REAL                    -- Modified date
);

-- Layer 3: Sync records
CREATE TABLE ckmirror(
    ckzone TEXT NOT NULL,
    UUID TEXT,
    parentKeyUUID TEXT NOT NULL, -- References keys.UUID
    gencount INTEGER NOT NULL,
    wrappedkey BLOB NOT NULL,    -- Wrapped content key
    encitem BLOB NOT NULL,       -- Encrypted credential
    encver INTEGER NOT NULL,
    contextID TEXT NOT NULL,
    UNIQUE(ckzone, UUID, contextID)
);

-- Sync manifest
CREATE TABLE ckmanifest(
    ckzone TEXT PRIMARY KEY,
    gencount INTEGER NOT NULL,
    digest BLOB NOT NULL,        -- SHA-256 of all leaf IDs
    leafIDs BLOB NOT NULL,       -- JSON array of UUIDs
    signatures BLOB NOT NULL     -- Peer signatures
);
```

---

## Migration Script

```typescript
// migrate-to-triple-layer.ts
export async function migrateToTripleLayer(db: Database) {
  await db.transaction(async (tx) => {
    // Step 1: Create new tables
    await tx.exec(`
      CREATE TABLE keys_new(...);
      CREATE TABLE inet_new(...);
      CREATE TABLE ckmirror_new(...);
    `);
    
    // Step 2: Migrate existing credentials
    const oldCreds = await tx.query('SELECT * FROM credentials');
    
    for (const cred of oldCreds) {
      // Extract key from wrappedKey
      const keyUUID = generateUUID();
      await tx.insert('keys_new', {
        UUID: keyUUID,
        kcls: KeyClass.Symmetric,
        type: KeyType.AES256GCM,
        data: cred.wrappedkey
      });
      
      // Create credential metadata
      await tx.insert('inet_new', {
        UUID: cred.uuid,
        acct: cred.account,
        srvr: cred.server,
        // Link to key
      });
      
      // Create sync record
      await tx.insert('ckmirror_new', {
        ckzone: 'default',
        UUID: cred.uuid,
        parentKeyUUID: keyUUID,
        gencount: cred.gencount,
        wrappedkey: cred.wrappedkey,
        encitem: cred.encitem
      });
    }
    
    // Step 3: Drop old tables
    await tx.exec('DROP TABLE credentials');
    
    // Step 4: Rename new tables
    await tx.exec(`
      ALTER TABLE keys_new RENAME TO keys;
      ALTER TABLE inet_new RENAME TO inet;
      ALTER TABLE ckmirror_new RENAME TO ckmirror;
    `);
  });
}
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Master Password Verification', () => {
  it('should reject invalid password', async () => {
    await unlockVault('correctPassword');
    lockVault();
    
    const result = await unlockVault('wrongPassword');
    expect(result).toBe(false);
  });
  
  it('should accept correct password', async () => {
    await unlockVault('correctPassword');
    lockVault();
    
    const result = await unlockVault('correctPassword');
    expect(result).toBe(true);
  });
});

describe('Merkle Digest Sync', () => {
  it('should skip sync when digest matches', async () => {
    const needsSync = await quickSyncCheck();
    expect(needsSync).toBe(false);
  });
  
  it('should sync when digest differs', async () => {
    // Modify local data
    await addCredential(...);
    
    const needsSync = await quickSyncCheck();
    expect(needsSync).toBe(true);
  });
});
```

---

## Summary

### Critical Path (Must Fix Now)
1. ✅ Master password bug → **FIXED**
2. ⚠️ GenCount persistence → See `CRITICAL_BUG_GENCOUNT.md`
3. ⚠️ Add Merkle digest → Optimize sync

### Architecture Evolution (Next Sprint)
4. Triple-layer data model → Better key management
5. Trusted peer circle → P2P sync capability

**Your analysis was spot-on.** The master password bug was critical, and the flat data model needs refactoring to match Apple's proven patterns. We now have a clear roadmap!


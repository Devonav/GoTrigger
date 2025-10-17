# Client-Side Triple-Layer Architecture

**Status:** ✅ In Progress  
**Date:** October 3, 2025  
**Related:** `SERVER_TRIPLE_LAYER.md`, `ARCHITECTURE.md`

## Overview

The desktop client now has the triple-layer architecture implementation ready, with services for credential management, sync, and storage. This matches the server-side implementation.

## Architecture Components

### 1. Storage Layer (`TripleLayerStorageService`)

**Purpose:** Local SQLite database for storing all three layers

**Location:** `clients/desktop/src/app/core/storage/triple-layer-storage.service.ts`

**Key Methods:**
```typescript
// Layer 1: CryptoKeys
await storage.createCryptoKey(key: CryptoKey): Promise<string>
await storage.getCryptoKey(uuid: string): Promise<CryptoKey | null>

// Layer 2: Credential Metadata
await storage.createCredentialMetadata(metadata: CredentialMetadata): Promise<string>
await storage.getCredentialMetadata(uuid: string): Promise<CredentialMetadata | null>
await storage.getAllCredentialMetadata(): Promise<CredentialMetadata[]>
await storage.getCredentialsByServer(server: string): Promise<CredentialMetadata[]>

// Layer 3: Sync Records
await storage.createSyncRecord(record: SyncRecord): Promise<void>
await storage.getSyncRecordsByZone(zone: string): Promise<SyncRecord[]>

// Sync State
await storage.updateSyncManifest(manifest: SyncManifest): Promise<void>
await storage.getSyncManifest(zone: string): Promise<SyncManifest>
```

### 2. Crypto Layer (`TripleLayerCryptoService`)

**Purpose:** Encryption/decryption with key wrapping

**Location:** `clients/desktop/src/app/core/crypto/triple-layer-crypto.service.ts`

**Key Methods:**
```typescript
// Master key derivation
await crypto.deriveMasterKey(password: string, salt?: Uint8Array)

// Content key generation
await crypto.generateContentKey(): Promise<CryptoKey>

// Encryption (creates wrappedKey + encItem)
await crypto.encryptCredentialData(
  data: DecryptedCredentialData,
  contentKey: CryptoKey
): Promise<{ wrappedKey: Uint8Array; encItem: Uint8Array; iv: Uint8Array }>

// Decryption
await crypto.decryptCredentialData(
  wrappedKey: Uint8Array,
  encItem: Uint8Array,
  iv: Uint8Array
): Promise<DecryptedCredentialData>

// Key wrapping
await crypto.wrapKey(key: CryptoKey): Promise<{ wrappedKey: Uint8Array; iv: Uint8Array }>
await crypto.unwrapKey(wrappedKey: Uint8Array, iv: Uint8Array): Promise<CryptoKey>
```

### 3. Credential Manager (`CredentialManagerService`)

**Purpose:** High-level API for credential CRUD operations

**Location:** `clients/desktop/src/app/core/vault/credential-manager.service.ts`

**Features:**
- Creates all three layers automatically
- Handles encryption/decryption transparently
- Manages key relationships
- Implements tombstone-based deletion

**Key Methods:**
```typescript
// Create new credential (creates key + metadata + sync record)
await manager.createCredential(request: CreateCredentialRequest, zone?: string): Promise<string>

// Retrieve credential (decrypts automatically)
await manager.getCredential(uuid: string): Promise<VaultCredential | null>

// List all credentials
await manager.getAllCredentials(): Promise<VaultCredential[]>

// Update credential
await manager.updateCredential(uuid: string, updates: Partial<CreateCredentialRequest>): Promise<void>

// Delete credential (sets tombstone)
await manager.deleteCredential(uuid: string): Promise<void>

// Search by server
await manager.searchByServer(server: string): Promise<VaultCredential[]>
```

### 4. Sync Service (`TripleLayerSyncService`)

**Purpose:** Bidirectional sync with server

**Location:** `clients/desktop/src/app/core/sync/triple-layer-sync.service.ts`

**Key Methods:**
```typescript
// Full sync (pull + push)
await sync.fullSync(zone?: string): Promise<TripleLayerSyncResult>

// Pull from server
await sync.pullFromServer(zone?: string): Promise<...>

// Push to server
await sync.pushToServer(zone?: string): Promise<...>

// Check if syncing
sync.isSyncing(): boolean
```

**Sync Result:**
```typescript
interface TripleLayerSyncResult {
  pulled: { keys: number; metadata: number; records: number };
  pushed: { keys: number; metadata: number; records: number };
  conflicts: number;
  errors: string[];
}
```

### 5. API Service Updates (`ApiService`)

**Purpose:** HTTP client for server communication

**Location:** `clients/desktop/src/app/services/api.service.ts`

**New Methods:**
```typescript
// Triple-layer push
api.pushTripleLayerSync(request: TripleLayerPushRequest): Observable<...>

// Triple-layer pull
api.pullTripleLayerSync(zone: string, lastGencount: number): Observable<TripleLayerPullResponse>
```

## Data Flow

### Creating a Credential

```
User Input → CredentialManager
  ↓
1. Generate content key (Layer 1: CryptoKey)
  ├─ Create AES-256-GCM key
  ├─ Wrap with master key
  └─ Store in crypto_keys table
  ↓
2. Create metadata (Layer 2: CredentialMetadata)
  ├─ Extract server, account, protocol, port
  ├─ Reference passwordKeyUUID
  └─ Store in credential_metadata table
  ↓
3. Encrypt credential data (Layer 3: SyncRecord)
  ├─ Encrypt password+notes with content key → encItem
  ├─ Wrap content key with master key → wrappedKey
  └─ Store in sync_records table
  ↓
Result: Triple-layer data ready for local use and sync
```

### Syncing to Server

```
TripleLayerSyncService.pushToServer()
  ↓
1. Get all sync records from local DB
  ↓
2. Gather referenced keys and metadata
  ├─ Query crypto_keys by UUID
  ├─ Query credential_metadata by UUID
  └─ Build DTOs for each layer
  ↓
3. Convert Uint8Array → Base64 strings
  ↓
4. Send to server via API
  POST /api/v1/sync/push
  {
    keys: [...],
    credential_metadata: [...],
    sync_records: [...]
  }
  ↓
5. Update local sync manifest with new gencount
```

### Syncing from Server

```
TripleLayerSyncService.pullFromServer()
  ↓
1. Get local sync manifest (last gencount)
  ↓
2. Request updates from server
  POST /api/v1/sync/pull
  { zone: 'default', last_gencount: 5 }
  ↓
3. Receive triple-layer response
  {
    keys: [...],
    credential_metadata: [...],
    sync_records: [...],
    gencount: 10
  }
  ↓
4. Process each layer
  ├─ Convert Base64 → Uint8Array
  ├─ Save to local SQLite
  └─ Track errors
  ↓
5. Update local sync manifest
```

## Example Usage

### Complete Credential Flow

```typescript
// 1. Initialize services
const storage = inject(TripleLayerStorageService);
const crypto = inject(TripleLayerCryptoService);
const manager = inject(CredentialManagerService);
const sync = inject(TripleLayerSyncService);

// 2. Initialize storage
await storage.initialize();

// 3. Unlock vault (derive master key)
await crypto.deriveMasterKey('userPassword', savedSalt);

// 4. Create a credential
const credUUID = await manager.createCredential({
  server: 'github.com',
  account: 'myusername',
  password: 'secretpassword',
  protocol: 443,
  port: 443,
  label: 'GitHub Login',
  notes: 'Personal GitHub account'
});

// 5. Credential is now in local DB (all 3 layers)

// 6. Sync to server
const syncResult = await sync.fullSync('default');
console.log('Pushed:', syncResult.pushed);
// Output: { keys: 1, metadata: 1, records: 1 }

// 7. On another device, pull the credential
const pullResult = await sync.pullFromServer('default');
console.log('Pulled:', pullResult.pulled);
// Output: { keys: 1, metadata: 1, records: 1 }

// 8. Retrieve and display
const credentials = await manager.getAllCredentials();
for (const cred of credentials) {
  console.log(`${cred.metadata.server} - ${cred.data.password}`);
}
```

## Security Properties

### Zero-Knowledge

**Server never sees:**
- User's master password
- Decrypted passwords
- Decrypted notes
- Content keys (only wrapped versions)

**Server stores:**
- Encrypted sync records (wrappedKey + encItem)
- Searchable metadata (server, account, protocol - could be encrypted in future)
- Wrapped crypto keys

### Key Hierarchy

```
Master Key (derived from password)
  └─ wraps Content Key
      └─ encrypts Credential Data
```

**Benefits:**
1. Single unlock (master key) unlocks all credentials
2. Key rotation possible (re-wrap content keys with new master key)
3. Per-credential keys enable selective sharing (future feature)

### Encryption Details

- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2-SHA256 (100,000 iterations)
- **IV:** 12 bytes per operation
- **Salt:** 32 bytes (stored with user)

## Data Types

### CryptoKey
```typescript
interface CryptoKey {
  uuid: string;
  keyClass: KeyClass;        // Symmetric, Public, Private
  keyType: KeyType;          // AES256GCM, Ed25519, X25519
  label?: string;
  applicationLabel?: string;
  data: Uint8Array;          // Wrapped key data
  accessGroup: string;
  usageFlags: KeyUsageFlags;
  createdAt: number;
  updatedAt: number;
  tombstone: boolean;
}
```

### CredentialMetadata
```typescript
interface CredentialMetadata {
  uuid: string;
  server: string;            // e.g., "github.com"
  account: string;           // e.g., "username"
  protocol: number;          // 443 (HTTPS)
  port: number;              // 443
  path?: string;             // "/login"
  label?: string;            // Display name
  passwordKeyUUID: string;   // References CryptoKey
  metadataKeyUUID?: string;  // Optional metadata encryption
  accessGroup: string;
  createdAt: number;
  updatedAt: number;
  tombstone: boolean;
}
```

### SyncRecord
```typescript
interface SyncRecord {
  zone: string;              // "default"
  uuid: string;              // Matches CredentialMetadata.uuid
  parentKeyUUID: string;     // Matches CryptoKey.uuid
  gencount: number;          // For sync ordering
  wrappedKey: Uint8Array;    // Encrypted content key
  encItem: Uint8Array;       // Encrypted credential data
  encVersion: number;        // Encryption version
  contextID: string;         // "default"
  tombstone: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### DecryptedCredentialData
```typescript
interface DecryptedCredentialData {
  password: string;
  notes?: string;
  customFields?: { [key: string]: string };
}
```

## Testing Status

### Unit Tests
- ✅ TripleLayerCryptoService - Encryption/decryption
- ⏳ TripleLayerStorageService - Database operations
- ⏳ CredentialManagerService - CRUD operations
- ⏳ TripleLayerSyncService - Sync flow

### Integration Tests
- ⏳ End-to-end credential creation and sync
- ⏳ Multi-device sync scenario
- ⏳ Conflict resolution
- ⏳ Tombstone deletion

## Next Steps

### Phase 1: UI Integration ✅ READY
Now that services are built, integrate with UI:

1. **Vault List Component** (`vault-list.component.ts`)
   - Inject `CredentialManagerService`
   - Call `getAllCredentials()` to display list
   - Implement add/edit/delete buttons
   - Show sync status

2. **Add Credential Form**
   - Create form with server, account, password fields
   - Call `manager.createCredential()`
   - Trigger sync after creation

3. **Edit Credential Form**
   - Load credential with `manager.getCredential(uuid)`
   - Update with `manager.updateCredential(uuid, updates)`
   - Trigger sync after update

4. **Delete Confirmation**
   - Call `manager.deleteCredential(uuid)`
   - Trigger sync to propagate deletion

### Phase 2: End-to-End Testing
1. Start server: `make run-multi`
2. Start desktop: `npm run electron:dev`
3. Create user and setup vault
4. Add credential → verify sync
5. Open on "second device" → verify pull
6. Edit on device 2 → verify sync back
7. Delete on device 1 → verify tombstone sync

### Phase 3: Polish
- Add loading indicators during sync
- Show sync errors to user
- Implement auto-sync on change
- Add conflict resolution UI
- Show last sync time

## Files Created/Modified

**New Services:**
- `clients/desktop/src/app/core/sync/triple-layer-sync.service.ts`
- `clients/desktop/src/app/core/vault/credential-manager.service.ts`

**Updated Services:**
- `clients/desktop/src/app/services/api.service.ts` (added triple-layer endpoints)

**Existing Services (Already Built):**
- `clients/desktop/src/app/core/storage/triple-layer-storage.service.ts`
- `clients/desktop/src/app/core/crypto/triple-layer-crypto.service.ts`

**Models (Already Defined):**
- `clients/desktop/src/app/shared/models/crypto-key.model.ts`
- `clients/desktop/src/app/shared/models/credential-metadata.model.ts`
- `clients/desktop/src/app/shared/models/sync-record.model.ts`

## References

- `SERVER_TRIPLE_LAYER.md` - Server-side implementation
- `ARCHITECTURE.md` - Overall system design
- `ARCHITECTURE_STORAGE.md` - Storage layer details

---

**Version:** 1  
**Last Updated:** October 3, 2025  
**Status:** ✅ Services Ready, UI Integration Next

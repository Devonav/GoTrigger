# Server-Side Triple-Layer Architecture Implementation

**Status:** ✅ Complete  
**Date:** October 3, 2025  
**Related:** `ARCHITECTURE.md`, `sync.go:155-332`

## Overview

The server now fully implements the triple-layer architecture pattern inspired by Apple's CloudKit/Keychain sync system. This provides efficient, zero-knowledge sync with searchable metadata.

## Architecture Layers

### Layer 1: Crypto Keys (`crypto_keys` table)
Stores cryptographic key material used for encryption/decryption.

**Schema:**
```sql
CREATE TABLE crypto_keys (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(id),
    item_uuid         UUID NOT NULL,
    zone              VARCHAR(100) NOT NULL DEFAULT 'default',
    key_class         SMALLINT NOT NULL,     -- 0=Symmetric, 1=Public, 2=Private
    key_type          SMALLINT NOT NULL,     -- 0=AES256GCM, 1=Ed25519, 2=X25519
    label             VARCHAR(255),          -- User-friendly name
    application_label VARCHAR(255),          -- App identifier
    access_group      VARCHAR(100) NOT NULL DEFAULT 'default',
    data              BYTEA NOT NULL,        -- Encrypted key material
    usage_flags       JSONB NOT NULL,        -- {encrypt, decrypt, sign, verify, ...}
    gencount          BIGINT NOT NULL,
    tombstone         BOOLEAN DEFAULT false,
    UNIQUE(user_id, item_uuid, zone)
);
```

**Example:**
```json
{
  "item_uuid": "11111111-1111-1111-1111-111111111111",
  "key_class": 0,
  "key_type": 0,
  "label": "Password Key",
  "application_label": "PasswordSync",
  "data": "ZW5jcnlwdGVka2V5ZGF0YQ==",
  "usage_flags": "eyJlbmNyeXB0Ijp0cnVlLCJkZWNyeXB0Ijp0cnVlfQ=="
}
```

### Layer 2: Credential Metadata (`credential_metadata` table)
Stores searchable metadata about credentials. Server can search without decrypting.

**Schema:**
```sql
CREATE TABLE credential_metadata (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(id),
    item_uuid         UUID NOT NULL,
    zone              VARCHAR(100) NOT NULL DEFAULT 'default',
    server            VARCHAR(500) NOT NULL,
    account           VARCHAR(255) NOT NULL,
    protocol          SMALLINT NOT NULL DEFAULT 0,
    port              INTEGER NOT NULL DEFAULT 443,
    path              VARCHAR(1000),
    label             VARCHAR(255),
    access_group      VARCHAR(100) NOT NULL DEFAULT 'default',
    password_key_uuid UUID NOT NULL,        -- References crypto_keys.item_uuid
    metadata_key_uuid UUID,                 -- Optional encryption key for metadata
    gencount          BIGINT NOT NULL,
    tombstone         BOOLEAN DEFAULT false,
    UNIQUE(user_id, item_uuid, zone)
);
```

**Example:**
```json
{
  "item_uuid": "22222222-2222-2222-2222-222222222222",
  "server": "github.com",
  "account": "testuser",
  "protocol": 443,
  "port": 443,
  "path": "/login",
  "label": "GitHub Login",
  "password_key_uuid": "11111111-1111-1111-1111-111111111111"
}
```

### Layer 3: Sync Records (`sync_records` table)
Stores encrypted credential data for device-to-device sync.

**Schema:**
```sql
CREATE TABLE sync_records (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(id),
    item_uuid         UUID NOT NULL,
    zone              VARCHAR(100) NOT NULL DEFAULT 'default',
    parent_key_uuid   UUID,                  -- Key used for encryption
    wrapped_key       BYTEA NOT NULL,        -- Encrypted item key
    enc_item          BYTEA NOT NULL,        -- Encrypted item data
    enc_version       INTEGER DEFAULT 1,
    context_id        VARCHAR(100) DEFAULT 'default',
    gencount          BIGINT NOT NULL,
    tombstone         BOOLEAN DEFAULT false,
    UNIQUE(user_id, item_uuid, zone)
);
```

**Example:**
```json
{
  "item_uuid": "22222222-2222-2222-2222-222222222222",
  "parent_key_uuid": "11111111-1111-1111-1111-111111111111",
  "wrapped_key": "d3JhcHBlZGtleQ==",
  "enc_item": "ZW5jcnlwdGVkaXRlbQ==",
  "enc_version": 1,
  "context_id": "default"
}
```

## API Endpoints

### Push Sync

**Endpoint:** `POST /api/v1/sync/push`

**Request:**
```json
{
  "zone": "default",
  "keys": [
    {
      "item_uuid": "...",
      "key_class": 0,
      "key_type": 0,
      "label": "...",
      "application_label": "...",
      "data": "base64...",
      "usage_flags": "base64..."
    }
  ],
  "credential_metadata": [
    {
      "item_uuid": "...",
      "server": "...",
      "account": "...",
      "protocol": 443,
      "port": 443,
      "path": "...",
      "label": "...",
      "password_key_uuid": "..."
    }
  ],
  "sync_records": [
    {
      "item_uuid": "...",
      "parent_key_uuid": "...",
      "wrapped_key": "base64...",
      "enc_item": "base64..."
    }
  ]
}
```

**Response:**
```json
{
  "gencount": 3,
  "synced": 3
}
```

**Behavior:**
1. Each layer gets incrementing gencount (key=1, metadata=2, record=3)
2. UPSERT on conflict (user_id, item_uuid, zone)
3. Defaults applied: AccGroup="default", Protocol=443, EncVersion=1
4. Manifest digest calculated from all sync_records
5. Sync state updated with new gencount and digest

### Pull Sync

**Endpoint:** `POST /api/v1/sync/pull`

**Request:**
```json
{
  "zone": "default",
  "last_gencount": 0
}
```

**Response:**
```json
{
  "keys": [
    {
      "item_uuid": "...",
      "key_class": 0,
      "gencount": 1,
      ...
    }
  ],
  "credential_metadata": [
    {
      "item_uuid": "...",
      "server": "...",
      "gencount": 2,
      ...
    }
  ],
  "sync_records": [
    {
      "item_uuid": "...",
      "wrapped_key": "...",
      "gencount": 3,
      ...
    }
  ],
  "gencount": 3
}
```

**Behavior:**
1. Queries all three tables with `gencount > last_gencount`
2. Returns only changed items since last sync
3. Handles nullable fields (Label, Path, MetadataKeyUUID)
4. Converts model pointers (*string) to DTO strings

### Get Manifest

**Endpoint:** `GET /api/v1/sync/manifest?zone=default`

**Response:**
```json
{
  "zone": "default",
  "gencount": 3,
  "digest": "Gc7IsbGB/D3+S5dYWAiW8FkoMwo0YZbvkXLrg29kDYE=",
  "signer_id": ""
}
```

## GenCount Behavior

**Purpose:** Monotonically increasing counter for sync ordering.

**Incrementing:**
- Each push operation increments gencount for EACH layer
- Example: Pushing 1 credential = gencount +3 (key, metadata, record)
- Ensures layers sync in correct order

**Filtering:**
- Pull requests filter by `gencount > last_gencount`
- Client tracks its last seen gencount
- Only changed items are returned

**Example Flow:**
```
Initial: gencount = 0

Push credential A:
  - crypto_key: gencount = 1
  - credential_metadata: gencount = 2
  - sync_record: gencount = 3

Pull with last_gencount=0:
  - Returns all 3 items
  - Client updates to gencount=3

Push credential B:
  - crypto_key: gencount = 4
  - credential_metadata: gencount = 5
  - sync_record: gencount = 6

Pull with last_gencount=3:
  - Returns only credential B's 3 items
  - Client updates to gencount=6
```

## Manifest Digest

**Purpose:** O(1) sync divergence check (inspired by Merkle trees).

**Calculation:**
1. Get all non-tombstone `sync_records` for user/zone
2. Extract `item_uuid` for each record
3. Sort UUIDs alphabetically
4. Compute SHA-256 hash of sorted list
5. Store as base64 in `sync_state.digest`

**Usage:**
```
Client: GET /api/v1/sync/manifest
Server: {"digest": "Gc7Isb...", "gencount": 3}
Client: Compare with local digest
  - If match: No sync needed (O(1) check!)
  - If differ: Run full pull/push sync
```

## Type Conversion Helpers

### stringToPtr
Converts DTO string to model *string pointer.

```go
func stringToPtr(s string) *string {
    if s == "" {
        return nil
    }
    return &s
}
```

**Usage:** DTO → Model (when saving to database)

### ptrToString
Converts model *string pointer to DTO string.

```go
func ptrToString(s *string) string {
    if s == nil {
        return ""
    }
    return *s
}
```

**Usage:** Model → DTO (when returning from database)

## Implementation Details

### Default Values

Applied during PushSync:

```go
// CryptoKey
if key.AccGroup == "" {
    key.AccGroup = "default"
}

// CredentialMetadata
if cred.AccGroup == "" {
    cred.AccGroup = "default"
}
if cred.Protocol == 0 {
    cred.Protocol = 443
}
if cred.Port == 0 {
    cred.Port = 443
}

// SyncRecord
if record.ContextID == "" {
    record.ContextID = "default"
}
if record.EncVersion == 0 {
    record.EncVersion = 1
}
```

### Error Handling

Each layer fails independently:
```go
if err := h.pgStore.CreateCryptoKey(...); err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{
        "error": "failed to create crypto key: " + err.Error()
    })
    return
}
```

### Database Methods

**Storage Functions** (`server/storage/postgres.go`):
- `CreateCryptoKey(userID, itemUUID, key)` - UPSERT key
- `CreateCredentialMetadata(userID, itemUUID, cred)` - UPSERT metadata  
- `CreateSyncRecord(userID, itemUUID, record)` - UPSERT sync record
- `GetCryptoKeysByUser(userID, zone, sinceGenCount)` - Query keys
- `GetCredentialMetadataByUser(userID, zone, sinceGenCount)` - Query metadata
- `GetSyncRecordsByUser(userID, zone, sinceGenCount)` - Query records

## Testing

### End-to-End Test

```bash
# 1. Register user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Save access_token from response

# 2. Push triple-layer data
curl -X POST http://localhost:8080/api/v1/sync/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "zone": "default",
    "keys": [{...}],
    "credential_metadata": [{...}],
    "sync_records": [{...}]
  }'

# Expected: {"gencount": 3, "synced": 3}

# 3. Pull data back
curl -X POST http://localhost:8080/api/v1/sync/pull \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"zone": "default", "last_gencount": 0}'

# Expected: All three layers returned

# 4. Verify database
docker exec password-sync-postgres psql -U postgres -d password_sync \
  -c "SELECT COUNT(*) FROM crypto_keys;"
# Expected: 1

docker exec password-sync-postgres psql -U postgres -d password_sync \
  -c "SELECT COUNT(*) FROM credential_metadata;"
# Expected: 1

docker exec password-sync-postgres psql -U postgres -d password_sync \
  -c "SELECT COUNT(*) FROM sync_records;"
# Expected: 1
```

### Verification Queries

```sql
-- Check gencount ordering
SELECT 
  'keys' as layer, item_uuid, gencount FROM crypto_keys
UNION ALL
SELECT 
  'metadata' as layer, item_uuid, gencount FROM credential_metadata
UNION ALL
SELECT 
  'records' as layer, item_uuid, gencount FROM sync_records
ORDER BY gencount;

-- Verify foreign key relationships
SELECT 
  cm.item_uuid as cred_uuid,
  cm.server,
  ck.item_uuid as key_uuid,
  ck.label as key_label
FROM credential_metadata cm
LEFT JOIN crypto_keys ck ON cm.password_key_uuid = ck.item_uuid;
```

## Next Steps

### Client Implementation
The server is ready, but the client still uses the old single-layer format.

**Required Changes:**
1. Update `sync.service.ts` to send triple-layer format
2. Add key generation and metadata extraction
3. Update pull sync to process all three layers
4. Test end-to-end sync flow

**See:** `clients/desktop/src/app/core/sync/sync.service.ts:148-182`

### Backwards Compatibility
Currently NOT backwards compatible. All clients must upgrade together.

**Future Enhancement:**
- Add version detection in sync requests
- Support both old and new formats during transition
- Migration script to convert old sync_records to triple-layer

## Benefits

1. **Zero-Knowledge**: Server stores encrypted blobs, never sees plaintext
2. **Searchable**: Metadata layer allows server-side search without decryption
3. **Efficient Sync**: Gencount filtering + manifest digest = minimal data transfer
4. **Key Management**: Separate key storage enables key rotation and crypto agility
5. **Audit Trail**: Gencount provides change tracking and conflict resolution
6. **Apple-Inspired**: Battle-tested pattern used by CloudKit/Keychain

## References

- `ARCHITECTURE.md` - Overall system architecture
- `server/api/handlers/sync.go` - Implementation
- `server/storage/postgres.go` - Database layer
- `pkg/models/keychain.go` - Data models
- `CHANGELOG.md` - Version history

---

**Version:** 1  
**Last Updated:** October 3, 2025  
**Status:** ✅ Production Ready (Server-Side)

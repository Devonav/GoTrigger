# Storage Architecture

## Overview

This project uses a **hybrid storage model** optimized for both cloud sync and offline-first operation.

## Server Storage (Multi-Tenant)

### Postgres (Docker Container)
- **Location**: Docker container, always running
- **Purpose**: Multi-tenant cloud storage for sync
- **Data**: Encrypted credential blobs (zero-knowledge)
- **Schema**: `server/storage/postgres_schema.sql`
- **Users**: Multiple users, each with isolated data
- **Access**: Via REST API with JWT authentication

```
┌─────────────────────────────────────┐
│       Postgres (Docker)             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ User 1 Data (encrypted)     │   │
│  │ - Sync records              │   │
│  │ - Device info               │   │
│  │ - Refresh tokens            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ User 2 Data (encrypted)     │   │
│  │ - Sync records              │   │
│  │ - Device info               │   │
│  │ - Refresh tokens            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Key Points
- ✅ Always runs in Docker (dev & prod)
- ✅ Zero-knowledge encryption (server can't decrypt)
- ✅ Multi-tenant with user isolation
- ✅ Stores encrypted blobs only (wrappedkey + encitem)
- ✅ Handles user auth, devices, sync state

## Client Storage (Local)

### SQLite (Embedded Database)
- **Location**: User's local device storage
- **Purpose**: Offline-first local vault
- **Data**: Decrypted credentials (client-side only)
- **Schema**: `clients/desktop/electron/sqlite-database.ts`
- **Users**: Single user per device
- **Access**: Direct database access (no network)

```
┌─────────────────────────────────────┐
│    Desktop Client (Electron)        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  SQLite Local Vault         │   │
│  │                             │   │
│  │  Layer 1: CryptoKeys        │   │
│  │  Layer 2: Credentials       │   │
│  │  Layer 3: SyncRecords       │   │
│  │                             │   │
│  │  - Fully decrypted          │   │
│  │  - Triple-layer pattern     │   │
│  │  - Offline capable          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Key Points
- ✅ Embedded SQLite (better-sqlite3)
- ✅ Offline-first (works without network)
- ✅ Triple-layer Apple Keychain pattern
- ✅ Master password protects local vault
- ✅ Biometric unlock (Touch ID/Windows Hello)

## Sync Flow

```
┌──────────────────┐                    ┌──────────────────┐
│  Desktop Client  │                    │  Server (Docker)  │
│   (SQLite)       │                    │   (Postgres)      │
└──────────────────┘                    └──────────────────┘
         │                                       │
         │  1. User adds credential              │
         │     (saved to local SQLite)           │
         │                                       │
         │  2. Encrypt with content key          │
         │     (wrappedkey + encitem)            │
         │                                       │
         │  3. Push to server                    │
         ├──────────────────────────────────────>│
         │     POST /api/v1/sync/push            │
         │                                       │
         │                                       │  4. Store encrypted
         │                                       │     blob in Postgres
         │                                       │
         │  5. Other devices pull                │
         │<──────────────────────────────────────┤
         │     GET /api/v1/sync/pull             │
         │                                       │
         │  6. Decrypt locally                   │
         │     (save to local SQLite)            │
         │                                       │
```

## Data Flow Example

### Creating a Credential

**Client Side (SQLite):**
1. User enters password for "example.com"
2. Generate content key (32 bytes random)
3. Encrypt password with content key → `encitem`
4. Wrap content key with master key → `wrappedkey`
5. Store in local SQLite:
   - Layer 1: Content key
   - Layer 2: Credential metadata
   - Layer 3: Sync record (wrappedkey + encitem)

**Server Side (Postgres):**
1. Receive encrypted sync record
2. Store in Postgres (zero-knowledge):
   - `user_id`: "user-123"
   - `item_uuid`: "cred-abc"
   - `wrapped_key`: [encrypted blob]
   - `enc_item`: [encrypted blob]
   - `gencount`: 15
3. Server CANNOT decrypt (doesn't have master key)

### Syncing to Another Device

**Device 2 (SQLite):**
1. Pull from server: GET /sync/pull
2. Receive encrypted records
3. Unwrap content key with master key
4. Decrypt credential data with content key
5. Store decrypted in local SQLite
6. Now available offline

## Environment Setup

### Development
```bash
# Start Postgres (Docker)
make docker-up

# Seed test data
make db-seed

# Start server (multi-tenant mode)
make run-multi

# Start desktop client
make desktop-dev
```

### Production
```bash
# Server uses Postgres (Docker)
docker-compose up -d

# Desktop client uses SQLite
# (embedded, no setup needed)
```

## File Locations

### Server (Postgres Schema)
- `server/storage/postgres_schema.sql`
- `server/storage/postgres.go`
- `docker/docker-compose.yml` (volume mount)

### Desktop Client (SQLite Schema)
- `clients/desktop/electron/sqlite-database.ts`
- `clients/desktop/electron/triple-layer-handlers.ts`
- Data stored: `~/Library/Application Support/password-sync/vault.db`

## Security Model

### Server (Postgres)
- Stores only encrypted blobs
- Cannot decrypt user data
- Zero-knowledge architecture
- Manages auth, devices, sync state

### Client (SQLite)
- Master password required
- Decryption happens locally
- Biometric unlock available
- Offline-first design

## Benefits

1. **Offline First**: Desktop works without network
2. **Zero-Knowledge**: Server can't read passwords
3. **Fast Sync**: Merkle digest for quick divergence detection
4. **Multi-Device**: Encrypted sync across devices
5. **Privacy**: Data decrypted only on client

# Sync Service

Coordinates synchronization between local vault and Go backend server using generation counters (Lamport timestamps).

## Architecture

### Sync Flow

```
Local Vault (SQLite)  ←→  Sync Service  ←→  Go Server
     gencount: 5                              gencount: 8
         ↓                                         ↓
    1. Quick check manifest                       │
    2. Needs sync? (5 < 8)                        │
    3. Pull updates (gencount > 5) ←──────────────┘
    4. Decrypt & save locally
    5. Push local changes ──────────────────────→ Server
    6. Update local gencount: 8
```

### Smart Sync Triggers

**When Sync Happens:**
1. ✅ **On vault unlock** - Immediate full sync
2. ✅ **On credential change** - Push immediately
3. ✅ **Auto-sync timer** - Every 60s (only when unlocked)
4. ✅ **Manual sync** - User-triggered
5. ✅ **Quick check** - Lightweight manifest comparison

**When Sync Doesn't Happen:**
- ❌ Vault is locked
- ❌ Sync already in progress
- ❌ No master key available

## API Reference

### Full Sync

```typescript
const result = await syncService.fullSync();
// Returns: { pulled: 3, pushed: 2, conflicts: 0, errors: [] }
```

**Process:**
1. Pull from server (fetch new/updated credentials)
2. Push to server (send local changes)
3. Resolve conflicts (last-write-wins)

### Pull From Server

```typescript
const result = await syncService.pullFromServer();
// Returns: { pulled: 3, conflicts: 1, errors: [] }
```

**What it does:**
1. Get local sync state (last gencount)
2. Fetch server manifest
3. Pull updates where `server.gencount > local.gencount`
4. Decrypt and save to local vault
5. Update local sync state

### Push To Server

```typescript
const result = await syncService.pushToServer();
// Returns: { pushed: 2, errors: [] }
```

**What it does:**
1. Find local credentials not yet synced
2. Format for server API
3. Send to `/api/v1/sync/push`
4. Update local sync state

### Quick Sync Check

```typescript
const needsSync = await syncService.quickSyncCheck();
// Returns: true if server has newer data
```

**Fast check:**
- Compare local vs server gencount
- No data transfer
- Returns boolean

### Auto-Sync

```typescript
// Start auto-sync (runs every 60s)
syncService.startAutoSync();

// Stop auto-sync
syncService.stopAutoSync();

// Check if syncing
if (syncService.isSyncing()) {
  console.log('Sync in progress...');
}
```

## Conflict Resolution

### Strategy: Last-Write-Wins

```typescript
// Server has gencount: 10
// Local has gencount: 8

// Pull from server
if (server.gencount > local.gencount) {
  // Server wins - overwrite local
  saveToLocal(serverCredential);
}

// Push to server
if (local.gencount > server.gencount) {
  // Local wins - overwrite server
  pushToServer(localCredential);
}
```

**When both have same gencount:**
- Compare timestamps (`updated_at`)
- Latest timestamp wins
- Increment gencount for winner

## Usage Example

### Complete Sync Flow

```typescript
import { SyncService } from '@core/sync/sync.service';
import { CryptoService } from '@core/crypto/crypto.service';

export class VaultComponent {
  constructor(
    private sync: SyncService,
    private crypto: CryptoService
  ) {}

  async unlockVault(password: string) {
    // 1. Derive master key
    await this.crypto.deriveMasterKey(password);
    
    // 2. Immediate sync on unlock
    const result = await this.sync.fullSync();
    console.log(`Synced: ${result.pulled} pulled, ${result.pushed} pushed`);
    
    // 3. Start auto-sync (every 60s)
    this.sync.startAutoSync();
  }

  async addCredential(credential: any) {
    // 4. Save locally
    const encrypted = await this.crypto.encryptCredential(credential);
    await this.storage.saveCredential(encrypted);
    
    // 5. Push immediately
    await this.sync.pushToServer();
  }

  lockVault() {
    // 6. Final sync before lock
    await this.sync.fullSync();
    
    // 7. Stop auto-sync
    this.sync.stopAutoSync();
    
    // 8. Clear master key
    this.crypto.clearMasterKey();
  }
}
```

## Sync State Tracking

**Stored in SQLite:**
```sql
CREATE TABLE sync_state (
  zone TEXT PRIMARY KEY,        -- 'default'
  gencount INTEGER,            -- Last synced gencount
  digest TEXT,                 -- Manifest digest (Merkle)
  last_sync INTEGER            -- Unix timestamp
);
```

**Example:**
```typescript
await storage.setSyncState('default', 10, 'abc123...');
const state = await storage.getSyncState('default');
// { zone: 'default', gencount: 10, digest: 'abc123...', last_sync: 1696186800 }
```

## Error Handling

```typescript
try {
  const result = await syncService.fullSync();
  
  if (result.errors.length > 0) {
    console.error('Sync completed with errors:', result.errors);
  }
  
  if (result.conflicts > 0) {
    console.warn(`${result.conflicts} conflicts resolved`);
  }
} catch (error) {
  // Critical error - sync failed
  console.error('Sync failed:', error);
}
```

## Performance

- **Full sync:** ~500ms (depends on credential count)
- **Quick check:** <100ms (just manifest comparison)
- **Pull sync:** ~200ms + decryption time
- **Push sync:** ~200ms + encryption time
- **Auto-sync overhead:** Minimal (only when unlocked)

## Security Notes

1. **Encrypted in transit** - HTTPS to server
2. **Encrypted at rest** - Server stores encrypted blobs
3. **No plaintext** - Server never sees unencrypted data
4. **Master key required** - Can't sync if vault locked
5. **Conflict-free** - Generation counters prevent data loss

## Comparison with Go Backend

| Feature | Desktop (TypeScript) | Server (Go) |
|---------|---------------------|-------------|
| Sync method | Pull + Push | Pull + Push ✅ |
| Conflict resolution | Last-write-wins | Last-write-wins ✅ |
| Generation counter | Lamport timestamp | Lamport timestamp ✅ |
| Manifest digest | SHA-256 (future) | SHA-256 ✅ |

---

**Last Updated:** Oct 1, 2025  
**Integrates with:** `internal/sync/engine.go` (Go backend)

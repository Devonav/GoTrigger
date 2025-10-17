# 🚨 CRITICAL BUG: GenCount Not Persisted

## Severity: 🔴 CRITICAL (Data Loss Risk)

## Problem

The `SyncEngine` stores `gencount` only in **memory**:

```go
// internal/sync/engine.go:39-45
func (se *SyncEngine) IncrementGenCount() int64 {
	se.mu.Lock()
	defer se.mu.Unlock()

	se.currentGenCount++
	return se.currentGenCount
}
```

**What happens on server restart:**
1. Server restarts
2. `currentGenCount` resets to 0
3. Client has `gencount: 10` locally
4. Server accepts new sync with `gencount: 1`
5. **Conflict:** Lower gencount overwrites newer data
6. **Data loss or sync corruption**

## Example Scenario

```
Timeline:
1. Client A pushes credential → Server gencount: 1
2. Client B pushes credential → Server gencount: 2
3. Server restarts → Server gencount: 0 (RESET!)
4. Client C pushes credential → Server gencount: 1
5. Client A pulls updates → Sees gencount: 1 (same as local)
6. Client A thinks data is synced, but Client B's data is lost
```

## Why This Happens

In `cmd/server/main.go`, the `SyncEngine` is initialized with gencount=0:

```go
syncEngine := sync.NewSyncEngine("default")
```

But it's never loaded from the database!

## The Fix

### Option 1: Load GenCount on Startup (Recommended)

```go
// cmd/server/main.go
syncEngine := sync.NewSyncEngine("default")

// Load current gencount from database
if pgStore != nil {
    syncState, err := pgStore.GetSyncState("system", "default")
    if err == nil && syncState != nil {
        syncEngine.SetGenCount(syncState.GenCount)
    }
}
```

### Option 2: Store GenCount Per-User (Better for Multi-Tenant)

Currently, the server has a **global** gencount. For multi-tenant, each user should have their own gencount.

**Current (Wrong):**
```go
// Global gencount shared across all users
syncEngine.IncrementGenCount() // → 1
syncEngine.IncrementGenCount() // → 2
```

**Should be:**
```go
// Per-user gencount
pgStore.UpsertSyncState(userID, zone, newGenCount, digest)
```

**The good news:** The Postgres `sync_state` table already stores per-user gencount!

```sql
-- This exists and is correct:
SELECT gencount FROM sync_state WHERE user_id = '...' AND zone = 'default';
```

**The problem:** The `SyncEngine` is a global singleton that doesn't know about users.

## Recommended Solution

Remove the global `SyncEngine` and use Postgres directly:

### Before (Buggy):
```go
// internal/api/sync_handlers.go
currentGenCount++
record := &storage.EncryptedSyncRecord{
    GenCount: currentGenCount, // ❌ Global counter
}
```

### After (Correct):
```go
// internal/api/sync_handlers.go
syncState, _ := s.pgStore.GetSyncState(userID, zone)
currentGenCount := syncState.GenCount + 1

record := &storage.EncryptedSyncRecord{
    GenCount: currentGenCount, // ✅ Per-user counter
}

s.pgStore.UpsertSyncState(userID, zone, currentGenCount, nil)
```

This way:
- ✅ GenCount persisted in database
- ✅ Survives server restarts
- ✅ Each user has independent gencount
- ✅ No global state issues

## Status

- **Current Implementation:** ❌ Uses global in-memory counter
- **Database Schema:** ✅ Supports per-user gencount
- **Handlers:** ⚠️ Partially use Postgres, partially use SyncEngine
- **Fix Required:** Remove SyncEngine dependency, use Postgres exclusively

## Impact

- 🔴 **Data Loss:** Yes, on server restart
- 🔴 **Sync Corruption:** Yes, gencount conflicts
- 🟠 **Multi-Tenant:** Each user's sync interferes with others (global counter)

## Testing

To reproduce:
1. Register user A, push 2 credentials (gencount: 2)
2. Restart server
3. Register user B, push 1 credential (gencount: 1)
4. User A pulls → sees gencount: 1 (lower than local 2)
5. Sync conflict or data loss

## Recommendation

**Priority:** 🔴 FIX IMMEDIATELY before production

Remove `SyncEngine` from:
- `internal/api/sync_handlers.go` (use Postgres gencount)
- `cmd/server/main.go` (don't create it)

The Postgres implementation already works correctly!

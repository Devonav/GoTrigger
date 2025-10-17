# Docker Schema Fix - Oct 2, 2025

## Problem Discovered

The `/api/v1/sync/pull` endpoint was failing with:
```
{"error": "pq: column \"parent_key_uuid\" does not exist"}
```

## Root Cause

The Postgres database schema was outdated. The `sync_records` table was missing critical columns:
- `parent_key_uuid` (UUID)
- `enc_version` (SMALLINT)
- `context_id` (VARCHAR)

These columns were added to the schema file (`server/storage/postgres_schema.sql`) as part of the triple-layer architecture implementation, but the database wasn't updated.

## Why This Happened

Docker's Postgres image only runs initialization scripts in `/docker-entrypoint-initdb.d/` on **first startup** when the data volume is empty. Since the docker volume already had data from an older schema version, the updated schema was never applied.

This is standard Docker postgres behavior and a common gotcha.

## Solution

Added new Makefile commands to handle schema updates:

### New Commands

```bash
# Restart Postgres with fresh schema (DESTROYS ALL DATA)
make docker-restart-clean

# Reset schema on existing database (DESTROYS ALL DATA)
make db-reset

# Check current schema
make docker-psql
\d sync_records
```

### Updated Files

1. **Makefile** - Added:
   - `docker-restart-clean` - Stops postgres, removes volume, restarts fresh
   - `db-reset` - Drops and recreates all tables (with confirmation prompt)

2. **server/storage/drop_tables.sql** (NEW)
   - Helper script to drop all tables in correct order

3. **docker/docker-compose.yml** - Added comment about schema initialization behavior

4. **docker/README.md** - Updated with schema management instructions

## Testing

✅ Verified all columns now exist:
```bash
$ psql "postgres://..." -c "\d sync_records" | grep -E "parent|enc_version|context"
 parent_key_uuid | uuid
 enc_version     | smallint
 context_id      | character varying(100)
```

✅ Tested sync endpoints:
```bash
# Register user → Get JWT
# Call sync/pull → Returns {"gencount": 0, "updates": null}
# Call sync/manifest → Returns manifest with gencount
```

## Prevention

**Going forward:**

1. **After schema changes:**
   ```bash
   make docker-restart-clean  # Destroys data, fresh start
   make dev-setup            # Re-seed test data
   ```

2. **For production:** Create proper migrations (future work)

3. **Documentation:** Added notes to docker README about this behavior

## Verification

Run the test script to verify everything works:
```bash
make docker-restart-clean
make dev-setup
make run-multi &
/tmp/test_sync.sh
```

Expected output:
```
✅ User registered
✅ Sync/pull working!
✅ All tests passed! 🎉
```

## Files Changed

- `Makefile` - Added 3 new commands
- `server/storage/drop_tables.sql` - New file
- `docker/docker-compose.yml` - Added comment
- `docker/README.md` - Updated with schema notes
- `DOCKER_SCHEMA_FIX.md` - This file

## Status

✅ **FIXED** - Schema is now up-to-date and all sync endpoints working correctly.

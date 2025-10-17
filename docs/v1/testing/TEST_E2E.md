# End-to-End Test Script

**Date:** October 3, 2025  
**Status:** Ready to Execute

## Prerequisites

### Terminal 1: Start Server
```bash
cd /Users/beck/github/password-sync

# Make sure postgres is running
make docker-up

# Start server
make run-multi

# Expected output:
# 🚀 Starting Password Sync Server (Multi-Tenant)
#    Port: 8080
#    Postgres: Connected ✅
```

### Terminal 2: Start Client
```bash
cd /Users/beck/github/password-sync/clients/desktop

# Start electron app
npm run electron:dev

# App should open in a window
```

## Test Flow

### 1. Register New User
- [ ] Click "Register"
- [ ] Email: `e2e-test@example.com`
- [ ] Password: `TestPass123!`
- [ ] Click "Register"
- [ ] **Expected:** Redirect to setup-vault screen

### 2. Setup Vault
- [ ] Enter vault password: `VaultPass123!`
- [ ] Confirm: `VaultPass123!`
- [ ] Click "Create Vault"
- [ ] **Expected:** Redirect to vault-list screen, empty state shown

### 3. Add First Credential
- [ ] Click "Add" button (purple, top right)
- [ ] Fill form:
  - Website URL: `https://github.com`
  - Username: `testuser`
  - Click "Generate" for password (20 char random)
  - Notes: `E2E test credential`
- [ ] Click "Save Credential"
- [ ] **Expected:**
  - Modal closes
  - Credential appears in list
  - Console shows: `✅ Credential synced to server`

### 4. Verify Server Received Data
**In Terminal 3:**
```bash
# Check Postgres for the data
docker exec password-sync-postgres psql -U postgres -d password_sync << EOF
-- Check all 3 layers
SELECT COUNT(*) FROM crypto_keys;
SELECT COUNT(*) FROM credential_metadata;
SELECT COUNT(*) FROM sync_records;

-- Verify the data
SELECT server, account FROM credential_metadata;
EOF

# Expected output:
# crypto_keys: 1
# credential_metadata: 1
# sync_records: 1
# server: github.com | account: testuser
```

### 5. View Credential
- [ ] Click on credential in list
- [ ] **Expected:**
  - Right panel shows details
  - Server: github.com
  - Username: testuser
  - Password: •••••••••••• (hidden)
  - Notes: E2E test credential
- [ ] Click eye icon
- [ ] **Expected:** Password becomes visible
- [ ] Click copy icon
- [ ] **Expected:** Console shows "password copied"

### 6. Lock Vault
- [ ] Click "Lock" button (red button)
- [ ] **Expected:** Redirect to unlock screen

### 7. Unlock Vault
- [ ] Enter password: `VaultPass123!`
- [ ] Click "Unlock Vault"
- [ ] **Expected:**
  - Redirect to vault-list
  - Credential still appears
  - Can view password (decryption works)

### 8. Delete Credential
- [ ] Select credential
- [ ] Click delete button (trash icon)
- [ ] Confirm deletion
- [ ] **Expected:**
  - Credential removed from list
  - Console shows: `✅ Credential deleted and synced to server`
  - Empty state shown

### 9. Verify Tombstone on Server
**In Terminal 3:**
```bash
docker exec password-sync-postgres psql -U postgres -d password_sync << EOF
SELECT tombstone FROM crypto_keys;
SELECT tombstone FROM credential_metadata;
SELECT tombstone FROM sync_records;
EOF

# Expected output:
# All should show: t (true)
```

## Success Criteria

✅ User can register and setup vault  
✅ User can add credential  
✅ Credential syncs to server (all 3 layers)  
✅ User can view credential (decrypt works)  
✅ User can lock/unlock vault  
✅ User can delete credential  
✅ Deletion syncs to server (tombstone set)  

## Known Issues to Watch For

1. **First sync might show warning if no auth token yet** - Should work on second try
2. **Console might show deprecated warnings** - Ignore, not errors
3. **CSS bundle size warning** - Ignore, just styling

## Debugging

### If Credential Doesn't Sync
Check browser console:
- Look for ✅ or ⚠️ messages
- Check for 401 errors (should be gone now)
- Check Network tab for `/api/v1/sync/push` request

### If Server Errors
Check server logs:
- Should show POST /api/v1/sync/push requests
- Should show successful 200 responses

### If Database Empty
Check connection:
```bash
# Verify tables exist
docker exec password-sync-postgres psql -U postgres -d password_sync -c "\dt"

# Should show: crypto_keys, credential_metadata, sync_records
```

---

**Ready to test!** 🚀

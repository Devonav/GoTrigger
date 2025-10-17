# End-to-End Test Plan

**Status:** ✅ Ready to Execute  
**Date:** October 3, 2025  
**Related:** `CLIENT_TRIPLE_LAYER.md`, `SERVER_TRIPLE_LAYER.md`

## Prerequisites

### Server Setup
```bash
# 1. Start postgres
make docker-up

# 2. Verify schema is up to date
docker exec password-sync-postgres psql -U postgres -d password_sync -c "\dt"
# Should show: crypto_keys, credential_metadata, sync_records, users, devices, sync_state

# 3. Start server
make run-multi
# Should see: "🚀 Starting Password Sync Server (Multi-Tenant)"
```

### Client Setup
```bash
# 1. Build desktop app
cd clients/desktop
npm run build

# 2. Start electron app
npm run electron:dev
```

## Test Scenarios

### Scenario 1: New User Registration & Setup

**Steps:**
1. Click "Register" on login screen
2. Enter email: `test@example.com`
3. Enter password: `TestPassword123!`
4. Click "Register"

**Expected:**
- ✅ Success message shown
- ✅ Redirected to setup-vault screen
- ✅ Email displayed

**Steps (Vault Setup):**
5. Enter vault password: `VaultPassword123!`
6. Confirm password: `VaultPassword123!`
7. Click "Create Vault"

**Expected:**
- ✅ Master key derived (PBKDF2-SHA256, 100k iterations)
- ✅ Salt stored in session
- ✅ Redirected to vault-list screen
- ✅ Empty state shown: "No credentials yet"

### Scenario 2: Add First Credential

**Steps:**
1. Click "Add" button (purple button in header)
2. Modal appears: "Add New Credential"
3. Enter Website URL: `https://github.com`
4. Enter Username: `myusername`
5. Click "Generate" for password
6. Observe generated 20-char password appears
7. Enter Notes: `Personal GitHub account`
8. Click "Save Credential"

**Expected:**
- ✅ Modal shows spinner: "Saving..."
- ✅ CredentialManagerService.createCredential() called
- ✅ Three layers created:
  - Layer 1: CryptoKey (passwordKeyUUID)
  - Layer 2: CredentialMetadata (github.com, myusername)
  - Layer 3: SyncRecord (encrypted password+notes)
- ✅ Modal closes
- ✅ Credential appears in list with "GI" avatar
- ✅ Server shows: github.com
- ✅ Account shows: myusername

**Database Verification (Client):**
```bash
# Open SQLite database (location shown in console on startup)
sqlite3 ~/Library/Application\ Support/password-sync/vault.db

SELECT COUNT(*) FROM crypto_keys;      -- Should be 1
SELECT COUNT(*) FROM credential_metadata;  -- Should be 1
SELECT COUNT(*) FROM sync_records;     -- Should be 1

SELECT server, account FROM credential_metadata;
# Should show: github.com | myusername
```

### Scenario 3: View Credential Details

**Steps:**
1. Click on the credential in the list
2. Right panel shows credential details

**Expected:**
- ✅ Server: github.com
- ✅ Username: myusername
- ✅ Password: •••••••••••• (hidden)
- ✅ Notes: Personal GitHub account
- ✅ Last updated timestamp shown

**Steps (Password Visibility):**
3. Click eye icon next to password
4. Password becomes visible
5. Click eye icon again
6. Password becomes hidden

**Expected:**
- ✅ Password toggles between visible/hidden
- ✅ Icon changes (eye → eye-off)

**Steps (Copy):**
7. Click copy icon next to username
8. Click copy icon next to password

**Expected:**
- ✅ Username copied to clipboard
- ✅ Password copied to clipboard
- ✅ Console logs: "username copied", "password copied"

### Scenario 4: Manual Sync (Future - Not Yet Implemented)

**Current State:** Sync is handled automatically via TripleLayerSyncService but not wired to UI yet.

**When Implemented:**
1. Click "Sync" button
2. See sync status indicator
3. Server receives triple-layer push
4. Database updated with gencount

### Scenario 5: Lock Vault

**Steps:**
1. Click "Lock" button (red button in header)
2. Observe redirect to unlock screen

**Expected:**
- ✅ Master key cleared from memory
- ✅ Credentials cleared from memory
- ✅ Redirected to /vault/unlock
- ✅ Unlock screen shows email

**Steps (Unlock):**
3. Enter vault password: `VaultPassword123!`
4. Click "Unlock Vault"

**Expected:**
- ✅ Master key re-derived
- ✅ Credentials loaded from database
- ✅ Credential appears in list again
- ✅ Can view password (decryption works)

### Scenario 6: Delete Credential

**Steps:**
1. Select credential from list
2. Click delete button (trash icon)
3. Confirm deletion dialog: "Delete credential for github.com?"
4. Click OK

**Expected:**
- ✅ Credential removed from list
- ✅ Tombstone set in all 3 layers:
  - crypto_keys.tombstone = true
  - credential_metadata.tombstone = true
  - sync_records.tombstone = true
- ✅ Empty state shown: "No credentials yet"

**Database Verification:**
```bash
sqlite3 ~/Library/Application\ Support/password-sync/vault.db

SELECT tombstone FROM crypto_keys;          -- Should be 1 (true)
SELECT tombstone FROM credential_metadata;  -- Should be 1 (true)
SELECT tombstone FROM sync_records;         -- Should be 1 (true)
```

### Scenario 7: Logout

**Steps:**
1. Click "Logout" button (gray button in header)
2. Observe redirect to login screen

**Expected:**
- ✅ Vault locked (master key cleared)
- ✅ Session cleared
- ✅ Redirected to /auth/login
- ✅ Can login again with same credentials

## Manual Testing Checklist

### UI/UX
- [ ] Add button visible and styled correctly
- [ ] Modal opens/closes smoothly
- [ ] Form validation works (empty fields)
- [ ] Generate password button creates 20-char password
- [ ] Spinner shows during save
- [ ] Error messages display correctly
- [ ] Modal closes on successful save
- [ ] Credential list updates immediately

### Encryption/Decryption
- [ ] Password generates correctly
- [ ] Credential saves to database (all 3 layers)
- [ ] Password can be viewed after save
- [ ] Password decrypts correctly
- [ ] Notes decrypt correctly
- [ ] Master key required for all operations

### Auto-Lock (Future)
- [ ] 5-minute timer starts on unlock
- [ ] Timer resets on credential add/edit/delete
- [ ] Auto-lock triggers after timeout
- [ ] Redirects to unlock screen

### Error Handling
- [ ] Empty URL shows error
- [ ] Empty username shows error
- [ ] Empty password shows error
- [ ] Network errors handled gracefully
- [ ] Invalid database handled gracefully

## Known Issues

1. **401 Unauthorized on Auto-Sync** (from logs you provided)
   - Old SyncService still running auto-sync
   - Needs auth token in API requests
   - Not critical: manual add still works
   - Fix: Update auth interceptor or disable auto-sync

2. **No Server Sync Yet**
   - VaultService.addCredential doesn't call TripleLayerSyncService.pushToServer()
   - Credentials only stored locally
   - Fix: Add sync call after credential creation

## Next Steps

1. **Fix Auth Token Issue**
   - Check auth interceptor adds Bearer token to requests
   - Verify token storage in session

2. **Wire Up Sync**
   - Add sync call after credential add/edit/delete
   - Add manual sync button to UI
   - Show sync status indicator

3. **Add Edit Credential**
   - Create edit modal (similar to add)
   - Wire to VaultService.updateCredential()
   - Test update flow

4. **Multi-Device Testing**
   - Run two electron instances
   - Add credential on device 1
   - Pull sync on device 2
   - Verify credential appears

## Success Criteria

✅ User can register and setup vault  
✅ User can add credential with all fields  
✅ User can view credential (decrypt)  
✅ User can delete credential (tombstone)  
✅ User can lock/unlock vault  
✅ Credentials persist across unlock  
✅ Triple-layer architecture verified in database  

---

**Version:** 1  
**Last Updated:** October 3, 2025  
**Status:** Ready for Manual Testing

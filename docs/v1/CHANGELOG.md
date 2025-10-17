# Changelog - Version 1

## [2025-10-03] - Documentation Organization

### Changed
- **Documentation Structure**: Complete file cabinet reorganization
  - Created organized folders: `architecture/`, `bugs/`, `deployment/`, `desktop-client/`, `guides/`, `history/`, `testing/`
  - Moved 33 documents into proper categories
  - INDEX.md stays at root with clean navigation
  - CHANGELOG.md and README.md at root level
  - Root project folder: Only README.md (clean!)

### Structure
```
docs/current/
├── INDEX.md              # Master index (always at root)
├── CHANGELOG.md          # This file
├── README.md             # Docs overview
├── architecture/         # 6 docs (system design)
├── bugs/                 # 5 docs (fixes & reports)
├── deployment/           # 2 docs (production)
├── desktop-client/       # 10 docs (app-specific)
├── guides/               # 2 docs (getting started)
├── history/              # 3 docs (sprints & changes)
└── testing/              # 2 docs (E2E tests)
```

### Benefits
- ✅ Easy to find docs by category
- ✅ INDEX.md always accessible at root
- ✅ No more scattered markdown files
- ✅ Versioned and organized
- ✅ Professional file cabinet structure

## [2025-10-03] - Auth Fix, Vault Separation, & Server Sync

### CRITICAL FIX
- **Setup Vault Component**: Updated to use triple-layer services
  - Was still using OLD CryptoService and VaultStorageService
  - Now uses TripleLayerCryptoService and TripleLayerStorageService
  - Vault password NEVER sent to server (as designed)
  - Recovery phrase → master key derivation happens locally only

## [2025-10-03] - Auth Fix & Server Sync Integration

### Fixed
- **401 Unauthorized Errors**: 
  - Removed OLD SyncService from unlock-vault component
  - Updated to use TripleLayerCryptoService and TripleLayerStorageService
  - Removed auto-sync calls that were failing auth
  - Password verification now uses triple-layer crypto API
  - No more 401 errors on manifest/sync endpoints

### Added
- **Server Sync After CRUD**:
  - `VaultService.addCredential()` → `sync.pushToServer('default')`
  - `VaultService.updateCredential()` → `sync.pushToServer('default')`
  - `VaultService.deleteCredential()` → `sync.pushToServer('default')`
  - All sync calls wrapped in try/catch (non-blocking)
  - Console logs for sync status (✅ success, ⚠️ warnings)

### Changed
- **UnlockVaultComponent**:
  - Now uses TripleLayerCryptoService (not old CryptoService)
  - Now uses TripleLayerStorageService (not old VaultStorageService)
  - Password verification updated for new crypto API
  - Removed sync.fullSync() and sync.startAutoSync() calls

### Technical Details

**Sync Flow:**
```typescript
User adds credential
  → VaultService.addCredential()
    → CredentialManagerService.createCredential()
      → Creates all 3 layers in local SQLite
    → TripleLayerSyncService.pushToServer()
      → Gathers keys, metadata, records from SQLite
      → Converts to DTOs (Uint8Array → Base64)
      → POST /api/v1/sync/push with auth token
      → Server saves to Postgres
  → Console: "✅ Credential synced to server"
```

**Error Handling:**
- Sync failures don't block UI operations
- User still sees credential added immediately
- Warning logged to console
- Credential will sync on next attempt

### Files Modified
- `clients/desktop/src/app/features/vault/components/unlock-vault/unlock-vault.component.ts`
- `clients/desktop/src/app/features/vault/services/vault.service.ts`

### Testing Status
- ✅ Build successful
- ⏳ Ready for end-to-end test
- ⏳ Auth token flow verification
- ⏳ Server sync verification

### Next Steps
- Start server and client
- Register → Setup Vault → Add Credential
- Verify credential syncs to server
- Check Postgres for triple-layer data

## [2025-10-03] - UI Integration: Add Credential Form

### Added
- **Add Credential Modal** (`vault-list.component`)
  - Beautiful modal dialog with form inputs
  - Fields: Website URL, Username, Password, Notes
  - Password generator (20 chars, secure random)
  - Form validation (required fields)
  - Loading state with spinner
  - Error display
  - Responsive design
- **UI Methods**:
  - `openAddForm()` - Opens modal
  - `closeAddForm()` - Closes modal
  - `saveNewCredential()` - Saves to triple-layer storage
  - `generatePassword()` - Crypto random 20-char password
  - `updateFormUrl/Username/Password/Notes()` - Form handlers
- **Styling**: 
  - Modal overlay with backdrop
  - Form inputs with focus states
  - Primary/secondary buttons
  - Spinner animation
  - Disabled states
  - Clean, modern design matching vault UI

### Changed
- **VaultService** - Now uses triple-layer architecture:
  - Replaced `CryptoService` → `TripleLayerCryptoService`
  - Replaced `VaultStorageService` → `CredentialManagerService`  
  - Replaced `SyncService` → `TripleLayerSyncService`
  - Same public API (no breaking changes to components)
  - Internal implementation uses triple-layer pattern
- **VaultListComponent**:
  - Added "Add" button to header (purple, prominent)
  - Integrated with CredentialManagerService
  - Maintains backward-compatible credential interface

### Technical Details

**Add Credential Flow:**
```typescript
User clicks Add button
  → openAddForm() shows modal
  → User fills form (URL, username, password, notes)
  → User clicks "Save Credential"
  → saveNewCredential() validates input
  → VaultService.addCredential() called
    → CredentialManagerService.createCredential()
      → Generates content key (AES-256-GCM)
      → Creates CryptoKey (Layer 1)
      → Creates CredentialMetadata (Layer 2)
      → Creates SyncRecord (Layer 3)
      → All saved to local SQLite
  → Modal closes
  → Credential list refreshes
  → New credential appears immediately
```

**Password Generator:**
- 20 characters
- Character set: a-z, A-Z, 0-9, symbols
- Uses `crypto.getRandomValues()` (secure)
- Each char randomly selected from 80+ charset

### Files Modified
- `clients/desktop/src/app/features/vault/services/vault.service.ts` - Triple-layer integration
- `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.ts` - Add form logic
- `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.html` - Add modal UI
- `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.scss` - Modal styling

### Files Created
- `docs/current/E2E_TEST_PLAN.md` - Complete testing guide

### Testing Status
- ✅ Build successful (no errors)
- ✅ TypeScript compilation clean
- ⏳ Manual UI testing (ready to execute)
- ⏳ E2E credential flow testing

### Known Issues
1. **401 Unauthorized on Auto-Sync**: Old SyncService trying to sync without auth token
   - Not blocking: add credential still works
   - Fix: Wire auth interceptor or disable old auto-sync

2. **No Server Sync Yet**: Credentials only stored locally
   - VaultService doesn't call TripleLayerSyncService.pushToServer()
   - Fix: Add sync call after credential operations

### Next Steps
1. Manual test the add credential flow
2. Fix auth token issue (401 errors)
3. Wire up server sync after add/edit/delete
4. Add edit credential modal
5. Test multi-device sync

## [2025-10-03] - Client-Side Triple-Layer Services

### Added
- **CredentialManagerService**: High-level API for credential CRUD operations
  - `createCredential()` - Creates key + metadata + sync record automatically
  - `getCredential()` - Retrieves and decrypts credential
  - `getAllCredentials()` - Lists all non-tombstone credentials
  - `updateCredential()` - Updates credential with re-encryption
  - `deleteCredential()` - Tombstone-based deletion across all layers
  - `searchByServer()` - Server-based credential search
- **TripleLayerSyncService**: Bidirectional sync with server
  - `fullSync()` - Complete pull + push cycle
  - `pullFromServer()` - Download keys, metadata, and records
  - `pushToServer()` - Upload all three layers to server
  - Base64 encoding/decoding for wire format
  - Sync result tracking (pulled, pushed, conflicts, errors)
- **API Service Updates** (`api.service.ts`):
  - `pushTripleLayerSync()` - New endpoint for triple-layer push
  - `pullTripleLayerSync()` - New endpoint for triple-layer pull
  - DTOs for all three layers (CryptoKeyDTO, CredentialMetadataDTO, SyncRecordDTO)

### Changed
- **Build System**: All TypeScript compilation errors resolved
  - Fixed Uint8Array → ArrayBuffer type conversions
  - Proper type casting for WebCrypto API
- **Architecture**: Client now matches server triple-layer pattern
  - Credential creation automatically builds all 3 layers
  - Sync operations handle full triple-layer data structure

### Technical Details

**Credential Creation Flow:**
```typescript
1. Generate AES-256-GCM content key
2. Wrap content key with master key → CryptoKey (Layer 1)
3. Extract metadata (server, account) → CredentialMetadata (Layer 2)
4. Encrypt password+notes → SyncRecord (Layer 3)
5. Store all in local SQLite
```

**Sync Flow:**
```typescript
Push: Local SQLite → Gather layers → Base64 encode → Server
Pull: Server → Base64 decode → Store in SQLite → Update manifest
```

### Files Created
- `clients/desktop/src/app/core/vault/credential-manager.service.ts`
- `clients/desktop/src/app/core/sync/triple-layer-sync.service.ts`
- `docs/current/CLIENT_TRIPLE_LAYER.md`

### Files Modified
- `clients/desktop/src/app/services/api.service.ts` - Added triple-layer endpoints

### Testing Status
- ✅ TypeScript compilation successful
- ✅ Build passes without errors
- ⏳ Unit tests (pending)
- ⏳ Integration tests (pending)
- ⏳ End-to-end sync test (pending)

### Next Steps
1. Update UI components to use CredentialManagerService
2. Add sync buttons and status indicators
3. Implement end-to-end sync testing
4. Add auto-sync on credential changes

## [2025-10-03] - Server-Side Triple-Layer Architecture

### Added
- **Server-Side Triple-Layer Implementation**: Complete server support for Apple Keychain-style architecture
  - Layer 1: `crypto_keys` table - Stores cryptographic key material
  - Layer 2: `credential_metadata` table - Stores searchable credential metadata
  - Layer 3: `sync_records` table - Stores encrypted sync blobs (wrappedKey + encItem)
- **Enhanced Sync Handlers**:
  - `PushSync`: Now accepts and stores all three layers (`keys`, `credential_metadata`, `sync_records`)
  - `PullSync`: Returns all three layers with proper gencount filtering
  - Proper gencount incrementation across all layers
- **Helper Functions**:
  - `stringToPtr()`: Converts DTO strings to model pointers (empty string → nil)
  - `ptrToString()`: Converts model pointers back to DTO strings (nil → empty string)
- **Database Support**:
  - Verified schema has all three tables with correct columns
  - Foreign key relationships maintained
  - Gencount indexes for efficient querying

### Changed
- **PushSync Handler** (`server/api/handlers/sync.go:155-332`):
  - Processes keys, metadata, and sync records in order
  - Each layer gets incrementing gencount (ensures sync order)
  - Defaults: AccGroup="default", Protocol=443, Port=443, ContextID="default", EncVersion=1
- **PullSync Handler** (`server/api/handlers/sync.go:115-212`):
  - Queries all three tables: `GetCryptoKeysByUser`, `GetCredentialMetadataByUser`, `GetSyncRecordsByUser`
  - Returns structured response: `{"keys": [], "credential_metadata": [], "sync_records": [], "gencount": N}`
  - Proper handling of nullable fields (Label, AppLabel, Path, MetadataKeyUUID)

### Tested
- ✅ Push sync: 1 key + 1 metadata + 1 sync record → gencount 3
- ✅ Pull sync: All three layers returned correctly
- ✅ Database verification: Data present in all three tables
- ✅ Manifest digest: Calculated correctly for sync state
- ✅ Type safety: String pointers handled correctly

### Technical Details
```go
// Request format (PushSync)
{
  "zone": "default",
  "keys": [{"item_uuid": "...", "key_class": 0, ...}],
  "credential_metadata": [{"item_uuid": "...", "server": "...", ...}],
  "sync_records": [{"item_uuid": "...", "wrapped_key": "...", ...}]
}

// Response format (PullSync)
{
  "keys": [...],
  "credential_metadata": [...],
  "sync_records": [...],
  "gencount": 3
}
```

### Next Steps
- Update desktop client to use new triple-layer push/pull format
- Add client-side triple-layer sync logic
- Test end-to-end sync flow with real credentials

### Files Modified
- `server/api/handlers/sync.go` - Complete rewrite of PushSync and PullSync

## [2025-10-02] - Vault Lock Button Fix

### Fixed
- **Desktop Client**: Lock vault button now properly navigates to unlock screen
  - Added try/catch to `vault.service.ts` lock method
  - Added `lockVault()` method with navigation in `vault-list.component.ts`
  - Changed template to call `lockVault()` instead of direct service call
  - Users no longer get "Vault is locked" error when clicking lock
  - Clear distinction between Lock (go to unlock) and Logout (go to login)

### Added
- `BUGFIX_VAULT_LOCK.md` - Detailed fix documentation

## [2025-10-02] - Docker Schema Fix & Documentation Reorganization

### Added
- `DOCKER_SCHEMA_FIX.md` - Comprehensive guide to docker schema synchronization issue and fix
- `QUICK_START.md` - Modern quick start guide (5 minute setup)
- `INDEX.md` - Documentation index with task-based navigation
- `CHANGELOG.md` - This file
- New Makefile commands:
  - `make docker-restart-clean` - Restart postgres with fresh schema
  - `make db-reset` - Apply schema to existing database (with confirmation)
- `server/storage/drop_tables.sql` - Helper script for database reset

### Changed
- **Documentation Structure**: All docs moved to `docs/v1/` with versioning
- `FIXES.md` - Added Bug #3 (Docker Schema Out of Sync)
- `DEPLOYMENT_CHECKLIST.md` - Added docker database setup instructions
- `README.md` - Updated with links to versioned documentation
- `docker/docker-compose.yml` - Added comment about init script behavior
- `docker/README.md` - Updated with schema management instructions
- `Makefile` - Enhanced docker commands with better descriptions

### Fixed
- **Critical**: Postgres schema out of sync causing "column does not exist" errors
  - Missing columns: `parent_key_uuid`, `enc_version`, `context_id`
  - Root cause: Docker only runs init scripts on first startup
  - Solution: `make docker-restart-clean` or `make db-reset`

### Moved
- `DOCKER_SCHEMA_FIX.md`: root → `docs/v1/`
- `QUICK_START.md`: root → `docs/v1/`
- `REORGANIZATION_SUMMARY.md`: root → `docs/v1/`

## [2025-10-02] - Triple-Layer Architecture Implementation

### Added
- Triple-layer data model (CryptoKey, CredentialMetadata, SyncRecord)
- Manifest digest calculation (Merkle-style)
- Enhanced sync handlers with digest support
- Comprehensive sprint summary

### Changed
- Server models aligned with client architecture
- PushSync now calculates and stores manifest digest

### Fixed
- Master password vulnerability (returned true when no verification data)

## [2025-10-01] - Project Reorganization

### Changed
- Restructured from `internal/` to `server/` directory
- All imports updated across codebase
- Test suite updated and passing

## Documentation Standards

### Version Control
- Current version: `v1`
- Location: `docs/v1/`
- Symlink: `docs/current` → `v1`
- When creating v2: Copy `v1/` to `v2/`, update symlink, modify v2 files

### File Naming
- Use SCREAMING_SNAKE_CASE for doc files: `QUICK_START.md`
- Exception: `INDEX.md`, `CHANGELOG.md`, `README.md`
- Date format: `YYYY-MM-DD`

### Update Process
1. Make changes to `docs/v1/` files
2. Update `INDEX.md` if adding new files
3. Update `CHANGELOG.md` with your changes
4. Cross-reference related docs
5. Keep root clean (only README.md)

---

**Version:** 1  
**Last Updated:** October 2, 2025  
**Next Version:** When breaking API changes occur

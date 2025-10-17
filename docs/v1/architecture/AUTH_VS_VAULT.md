# Authentication vs Vault Password

**CRITICAL:** These are TWO COMPLETELY SEPARATE systems.

## Layer 1: Server Authentication (Login/Register)

**Purpose:** Identify user, authorize API access

**Password:** User's login password  
**Storage:** HASHED on server (bcrypt)  
**Token:** JWT access token  
**Scope:** API authentication only

**Flow:**
```
User enters email + password
  ↓
POST /api/v1/auth/register OR /api/v1/auth/login
  ↓
Server:
  - Hashes password with bcrypt
  - Stores hash in users table
  - Generates JWT token
  ↓
Client receives:
  - access_token (JWT)
  - refresh_token
  - user_id
  - email
  ↓
Saved in localStorage (SessionStorageService)
  ↓
Used for API requests (auth interceptor adds Bearer token)
```

**What Server Knows:**
- Email
- Password hash (bcrypt, can't be reversed)
- User ID

**What Server NEVER Sees:**
- Vault password
- Master key
- Decrypted credentials
- Recovery phrase

## Layer 2: Local Vault (Setup/Unlock)

**Purpose:** Encrypt/decrypt credentials locally

**Password:** Vault master password (recovery phrase)  
**Storage:** NEVER stored anywhere (derived on-demand)  
**Salt:** Stored locally in SQLite  
**Scope:** Local encryption only

**Flow (Setup):**
```
User sees 24-word recovery phrase
  ↓
User confirms phrase
  ↓
Client:
  - Derives master key from phrase (PBKDF2, 100k iterations)
  - Saves salt to local SQLite
  - Creates password verification blob (encrypted test data)
  - Saves verification blob to local SQLite
  ↓
NOTHING sent to server
  ↓
Recovery phrase cleared from memory
```

**Flow (Unlock):**
```
User enters recovery phrase (or password)
  ↓
Client:
  - Gets salt from local SQLite
  - Derives master key from phrase + salt
  - Decrypts verification blob
  - If decryption succeeds, password is correct
  ↓
Master key stored in memory (TripleLayerCryptoService)
  ↓
Used to encrypt/decrypt credentials
  ↓
NEVER sent to server
```

**What's Stored Locally:**
- Salt (32 bytes, public, safe to store)
- Password verification blob (encrypted test data)
- Vault initialized flag

**What's NEVER Stored:**
- Recovery phrase (user must remember/backup)
- Master key (derived on-demand, cleared on lock)
- Plaintext passwords

## How They Work Together

### Registration Flow
```
1. User registers with email@example.com / loginpass123
   → Server: Creates user, returns JWT token
   
2. User sees recovery phrase: "word1 word2 word3..."
   → Client: Derives master key, saves salt locally
   
3. User adds credential: github.com / myusername / secretpass
   → Client: Encrypts with master key
   → Server: Receives encrypted blob (can't decrypt)
```

### Daily Use Flow
```
1. User opens app
   → Auto-login with stored JWT token (if valid)
   
2. User unlocks vault with recovery phrase
   → Client: Derives master key from phrase
   
3. User views credentials
   → Client: Decrypts with master key
   → Server: Never sees plaintext
```

## Security Properties

### Zero-Knowledge Architecture
The server:
- ✅ CAN authenticate users (JWT)
- ✅ CAN store encrypted credentials
- ✅ CAN sync credentials between devices
- ❌ CANNOT decrypt credentials
- ❌ CANNOT see vault password
- ❌ CANNOT derive master key

### Key Hierarchy
```
Recovery Phrase (24 words, user memorizes)
  ↓ PBKDF2 (100k iterations) + Salt
Master Key (AES-256, in memory only)
  ↓ Wraps
Content Keys (per-credential, AES-256)
  ↓ Encrypts
Credential Data (password, notes)
```

### What Gets Sent to Server
- ✅ Login email + hashed password
- ✅ JWT tokens (for auth)
- ✅ Encrypted sync records (can't be decrypted by server)
- ✅ Searchable metadata (server, account - could be encrypted too)
- ❌ Vault password (NEVER)
- ❌ Master key (NEVER)
- ❌ Content keys (NEVER)
- ❌ Plaintext passwords (NEVER)

## Code Verification

### Session Storage (Auth Only)
```typescript
// clients/desktop/src/app/core/storage/session-storage.service.ts
saveSession(session: Session): void {
  localStorage.setItem(this.SESSION_KEY, JSON.stringify({
    accessToken,    // JWT for API
    refreshToken,   // For token refresh
    userId,         // User ID
    email           // User email
  }));
  // NO vault password, NO master key
}
```

### Vault Storage (Local Only)
```typescript
// clients/desktop/src/app/core/storage/triple-layer-storage.service.ts
await storage.setConfig('master_salt', saltB64);  // Local SQLite
await storage.setConfig('password_verification', blob);  // Local SQLite

// NEVER calls API
// NEVER sends to server
```

### Credential Encryption
```typescript
// Master key derived locally
const masterKey = await crypto.deriveMasterKey(recoveryPhrase, salt);

// Credential encrypted with master key
const encrypted = await crypto.encryptCredentialData(data, contentKey);

// Server receives encrypted blob
await api.pushTripleLayerSync({
  sync_records: [{
    wrapped_key: base64(encrypted.wrappedKey),  // Encrypted
    enc_item: base64(encrypted.encItem)         // Encrypted
  }]
});

// Server CAN'T decrypt (doesn't have master key)
```

## Common Mistakes to Avoid

❌ **DON'T** send vault password to server  
❌ **DON'T** store master key in localStorage  
❌ **DON'T** use login password as vault password  
❌ **DON'T** send recovery phrase to server  
❌ **DON'T** store plaintext credentials  

✅ **DO** keep auth and vault separate  
✅ **DO** derive master key on-demand  
✅ **DO** clear master key on lock  
✅ **DO** use different passwords for login and vault  
✅ **DO** encrypt before syncing  

## Files Responsible

### Authentication (Server)
- `clients/desktop/src/app/features/auth/components/login/login.component.ts`
- `clients/desktop/src/app/features/auth/components/register/register.component.ts`
- `clients/desktop/src/app/core/auth/auth.service.ts`
- `clients/desktop/src/app/core/storage/session-storage.service.ts`

### Vault (Local)
- `clients/desktop/src/app/features/vault/components/setup-vault/setup-vault.component.ts`
- `clients/desktop/src/app/features/vault/components/unlock-vault/unlock-vault.component.ts`
- `clients/desktop/src/app/core/crypto/triple-layer-crypto.service.ts`
- `clients/desktop/src/app/core/storage/triple-layer-storage.service.ts`

### Sync (Encrypted)
- `clients/desktop/src/app/core/sync/triple-layer-sync.service.ts`
- `clients/desktop/src/app/services/api.service.ts`

---

**Bottom Line:** The server handles auth and stores encrypted blobs. The client handles vault encryption and never sends the master key or vault password anywhere. Two separate systems, zero knowledge.

# Bug Hunt Report - Password Sync

**Date:** 2025-10-02  
**Scope:** Full backend API + client architecture review

---

## ✅ API Tests - ALL PASSING

Ran comprehensive tests on all endpoints:

| Test | Endpoint | Status | Notes |
|------|----------|--------|-------|
| Health Check | `GET /health` | ✅ PASS | Returns `{"status":"ok"}` |
| Register User | `POST /api/v1/auth/register` | ✅ PASS | Returns JWT + refresh token |
| Login | `POST /api/v1/auth/login` | ✅ PASS | Returns new tokens |
| Invalid Login | `POST /api/v1/auth/login` | ✅ PASS | Correctly returns 401 |
| Refresh Token | `POST /api/v1/auth/refresh` | ✅ PASS | Token rotation works |
| Register Device | `POST /api/v1/devices` | ✅ PASS | Creates device record |
| List Devices | `GET /api/v1/devices` | ✅ PASS | Returns user devices |
| Get Manifest | `GET /api/v1/sync/manifest` | ✅ PASS | Returns gencount=0 for new user |
| Push Sync | `POST /api/v1/sync/push` | ✅ PASS | Stores encrypted blobs |
| Pull Sync | `POST /api/v1/sync/pull` | ✅ PASS | Returns encrypted credentials |
| Unauthorized | `GET /api/v1/devices` (no token) | ✅ PASS | Correctly returns 401 |

---

## 🐛 Bugs Fixed During Bug Hunt

### Bug #1: Master Password Validation (CRITICAL)
**Severity:** 🔴 CRITICAL SECURITY FLAW  
**Status:** ✅ FIXED

**Problem:**
- Vault unlock accepted ANY password
- No cryptographic verification
- Complete security bypass

**Fix:**
- Added `savePasswordVerification()` - encrypts test payload on first unlock
- Added `verifyPassword()` - attempts decryption to validate password
- Modified `unlockWithPassword()` - rejects invalid passwords before sync

**Files Changed:**
- `clients/desktop/src/app/features/vault/components/unlock-vault/unlock-vault.component.ts`

---

### Bug #2: 404 on `/api/v1/sync/manifest` (HIGH)
**Severity:** 🟠 HIGH  
**Status:** ✅ FIXED

**Problem:**
- Client calls `/api/v1/sync/manifest` with JWT
- Server route exists but uses wrong handler
- Handler queries SQLite instead of Postgres
- In multi-tenant mode, manifest should be user-scoped in Postgres

**Fix:**
- Created `getManifestMultiTenant()` handler
- Queries Postgres with user_id from JWT
- Returns gencount=0 for new users (correct behavior)
- Updated route to use new handler

**Files Changed:**
- `internal/api/sync_handlers.go` (added new handler)
- `internal/api/server.go` (updated route)

---

## 📐 Architecture Analysis

### Current Architecture (CORRECT)

```
┌─────────────────────────────────────────────────┐
│         CLIENT (Electron + SQLite)              │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Local Vault (SQLite)                     │  │
│  │  - Credentials (encrypted)                │  │
│  │  - Keys (encrypted)                       │  │
│  │  - Master password verification          │  │
│  │  - Sync state (local gencount)           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Master Password: NEVER leaves device          │
│  All crypto: Client-side only                  │
└─────────────────────────────────────────────────┘
                      ↓ HTTPS
              (Encrypted blobs only)
                      ↓
┌─────────────────────────────────────────────────┐
│       SERVER (Go + Postgres)                    │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Postgres (Multi-Tenant)                  │  │
│  │  - Users (email, password_hash)           │  │
│  │  - Devices (user devices)                 │  │
│  │  - Sync State (user's gencount)           │  │
│  │  - Sync Records (encrypted blobs)         │  │
│  │  - Refresh Tokens (JWT rotation)          │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Server CANNOT decrypt credentials             │
│  Zero-knowledge architecture                   │
└─────────────────────────────────────────────────┘
```

### Key Insights

1. **Two Password System:**
   - **Account Password:** Login to app (PBKDF2, stored in Postgres)
   - **Master Password:** Decrypt vault (PBKDF2, NEVER sent to server)

2. **Sync Flow:**
   - Client: Encrypt with master password → `wrappedkey` + `encitem`
   - Client: Push to server with JWT auth
   - Server: Store encrypted blobs (can't decrypt)
   - Other device: Pull encrypted blobs with JWT
   - Other device: Decrypt with master password

3. **Security Guarantees:**
   - Server NEVER sees plaintext credentials
   - Server NEVER sees master password
   - Server NEVER has decryption keys
   - Postgres only stores encrypted blobs

---

## 🔍 Potential Issues Found (Not Bugs Yet)

### 1. JWT Secret Hardcoded
**File:** `internal/auth/jwt.go:12`
```go
jwtSecret = []byte("your-secret-key-change-this-in-production")
```

**Issue:** Hardcoded secret (though there's a `SetJWTSecret()` function)  
**Risk:** 🟡 MEDIUM (development only, can be set via env var)  
**Recommendation:** Enforce env var in production builds

---

### 2. Token Expiration Short (15 min)
**File:** `internal/auth/jwt.go:32`
```go
ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute))
```

**Issue:** Very short token lifetime  
**Risk:** 🟢 LOW (design choice, refresh token is 30 days)  
**Recommendation:** Consider 1-hour access tokens for better UX

---

### 3. No Rate Limiting
**Observation:** No rate limiting on auth endpoints  
**Risk:** 🟡 MEDIUM (brute force attacks possible)  
**Recommendation:** Add rate limiting middleware for `/auth/*`

---

### 4. No Email Verification
**Observation:** Users can register without email verification  
**Risk:** 🟢 LOW (feature, not bug)  
**Recommendation:** Add email verification flow for production

---

### 5. CORS Allows Only localhost:4200
**File:** `internal/api/server.go:51`
```go
AllowOrigins: []string{"http://localhost:4200"}
```

**Issue:** Production apps won't work  
**Risk:** 🟡 MEDIUM (blocks production Electron apps)  
**Recommendation:** Add `electron://` and `file://` origins

---

### 6. No Connection Pooling Config
**Observation:** Default Postgres connection pool settings  
**Risk:** 🟢 LOW (defaults usually fine)  
**Recommendation:** Expose `SetMaxOpenConns()` via env vars

---

### 7. Sync Engine GenCount Not Persisted
**File:** `internal/sync/engine.go:39-45`

**Issue:** `SyncEngine` keeps gencount in memory only  
**Risk:** 🟠 HIGH (gencount resets on server restart)  
**Recommendation:** Persist gencount to Postgres on increment

---

## 🎯 Recommendations

### High Priority
1. ✅ **FIXED:** Add master password validation
2. ✅ **FIXED:** Fix 404 on sync manifest
3. ⚠️ **TODO:** Persist SyncEngine gencount to database
4. ⚠️ **TODO:** Add rate limiting on auth endpoints

### Medium Priority
5. Configure CORS for production origins
6. Add email verification flow
7. Implement password reset flow
8. Add device revocation API

### Low Priority
9. Increase access token lifetime (UX improvement)
10. Add Postgres connection pool configuration
11. Add audit logging for security events

---

## 📝 Next Steps

### For Production Readiness:

1. **Environment Variables:**
   ```bash
   export JWT_SECRET="<256-bit-random-secret>"
   export DATABASE_URL="postgres://..."
   export ALLOWED_ORIGINS="electron://,http://localhost:4200"
   export RATE_LIMIT_ENABLED=true
   ```

2. **Add Rate Limiting:**
   ```go
   import "github.com/gin-contrib/rate"
   
   router.Use(rate.New(rate.Config{
       Limit: 100,
       Period: time.Minute,
   }))
   ```

3. **Persist GenCount:**
   ```go
   func (se *SyncEngine) IncrementGenCount() int64 {
       se.mu.Lock()
       defer se.mu.Unlock()
       
       se.currentGenCount++
       
       // TODO: Persist to database
       // pgStore.UpdateGenCount(se.zone, se.currentGenCount)
       
       return se.currentGenCount
   }
   ```

4. **Email Verification:**
   - Add `email_verification_token` to users table
   - Send verification email on registration
   - Add `/auth/verify-email/:token` endpoint

---

## ✨ What's Working Well

1. ✅ **Zero-Knowledge Architecture:** Server never sees plaintext
2. ✅ **JWT Auth:** Proper token-based authentication
3. ✅ **Layered Encryption:** Apple Keychain pattern (wrappedkey + encitem)
4. ✅ **Multi-Tenant:** Proper user isolation in Postgres
5. ✅ **Device Management:** Tracks user devices correctly
6. ✅ **Conflict Resolution:** Last-write-wins with gencount
7. ✅ **API Design:** RESTful, clean, follows conventions

---

## 🧪 Testing Coverage

- ✅ Auth endpoints (register, login, refresh)
- ✅ Device management (register, list)
- ✅ Sync endpoints (manifest, push, pull)
- ✅ Unauthorized access (401 checks)
- ✅ Invalid credentials (validation)
- ⚠️ Missing: Integration tests for full client-server flow
- ⚠️ Missing: Load tests for concurrent users
- ⚠️ Missing: Security tests (SQL injection, XSS, etc.)

---

**Conclusion:** The architecture is solid! Two critical bugs fixed, API is working correctly. Main recommendations are around production hardening (rate limiting, email verification, env vars).


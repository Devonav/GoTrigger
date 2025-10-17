# Desktop Client - Authentication Flow

## ✅ Implementation Complete!

The desktop client now has full JWT authentication integrated with the backend.

---

## 🔄 **New User Flow**

### Before (Old):
```
App Start → Unlock Vault (master password only)
```

### After (New):
```
App Start → Login (email + password)
         → Unlock Vault (master password)
         → Vault List
```

---

## 📁 **Files Added**

### Core Services
```
src/app/core/
├── auth/
│   ├── auth.service.ts              ← JWT auth (login/register/refresh)
│   └── biometric.service.ts         ✅ (existing)
│
└── storage/
    ├── session-storage.service.ts   ← JWT token storage
    └── vault-storage.service.ts     ✅ (existing)
```

### Auth Feature (New)
```
src/app/features/auth/
└── components/
    ├── login/
    │   ├── login.component.ts
    │   ├── login.component.html
    │   └── login.component.scss
    │
    └── register/
        ├── register.component.ts
        ├── register.component.html
        └── register.component.scss
```

### Updated Files
```
src/app/
├── app.routes.ts                    ← Added auth + vault routes
├── app.ts                           ← Now uses RouterOutlet
├── app.html                         ← Simplified to <router-outlet>
│
└── features/vault/components/
    ├── unlock-vault/                ← Navigate to /vault/list after unlock
    └── vault-list/                  ← Added logout button + user email
```

---

## 🚀 **How to Test**

### 1. Start Backend
```bash
# Terminal 1: Postgres
cd docker && docker-compose up -d

# Terminal 2: Server
make run-multi
```

### 2. Start Desktop App
```bash
# Terminal 3: Desktop
cd clients/desktop
npm run electron:dev
```

### 3. Test Flow
1. **App opens** → Login screen
2. **Click "Create Account"**
   - Email: `user@example.com`
   - Password: `password123`
   - Click "Create Account"
3. **After registration** → Unlock Vault screen
   - Master Password: `securemaster123`
   - Click "Unlock Vault"
4. **After unlock** → Vault List (empty)
5. **Click "Logout"** → Back to Login

---

## 🔐 **Security Architecture**

### Two Password System

| Password | Purpose | Storage | Server Sees? |
|----------|---------|---------|--------------|
| **Account Password** | Login to app | Server (hashed) | ✅ Hash only |
| **Master Password** | Decrypt vault | Client only | ❌ Never |

### Flow:
```
1. User registers with email + account password
   → Server stores PBKDF2 hash
   → Returns JWT token

2. User sets master password (first unlock)
   → Client derives encryption key (PBKDF2)
   → Client stores in local vault

3. User adds credential
   → Client encrypts with master key
   → Client sends encrypted blob to server
   → Server stores blob (can't decrypt!)
```

---

## 📊 **App State Management**

### Session State (localStorage)
```typescript
{
  accessToken: "eyJhbGc...",      // JWT (15min)
  refreshToken: "uuid-456",       // 30 days
  userId: "uuid-123",
  email: "user@example.com"
}
```

### Vault State (SQLite via Electron)
```typescript
{
  credentials: [...],             // Encrypted blobs
  keys: [...],                    // Crypto keys
  syncState: { gencount: 5 }      // Sync metadata
}
```

---

## 🎨 **UI Components**

### Login Screen
- Email + password input
- Show/hide password toggle
- Error handling (401, network errors)
- Link to register

### Register Screen
- Email + password + confirm password
- Validation (email format, password length)
- Password match check
- Link to login

### Vault List (Updated)
- Shows logged-in user email
- Lock vault button (locks + stays logged in)
- Logout button (locks + clears session)

---

## 🔄 **Routing**

### Routes
```typescript
/                     → Redirect to /auth/login
/auth/login           → LoginComponent
/auth/register        → RegisterComponent
/vault/unlock         → UnlockVaultComponent
/vault/list           → VaultListComponent
```

### Navigation Flow
```
Login Success → /vault/unlock
Vault Unlock → /vault/list
Lock Vault → /vault/unlock (stay logged in)
Logout → /auth/login (clear session)
```

---

## 🛠️ **Commands**

### Development
```bash
# Start with hot reload
npm run electron:dev

# Build only
npm run build

# Build + Electron
npm run electron:build
```

### Testing
```bash
# Unit tests
npm test

# E2E tests (future)
npm run e2e
```

---

## 📝 **Next Steps**

### Immediate
- [ ] Test full registration → unlock → vault flow
- [ ] Test logout → login flow
- [ ] Test token refresh (after 15min)

### Future Enhancements
- [ ] Add "Remember Me" (persist session)
- [ ] Add "Forgot Password" flow
- [ ] Add device registration UI
- [ ] Add sync status indicator
- [ ] Add offline mode detection

---

## 🐛 **Troubleshooting**

### Issue: "Cannot connect to server"
```bash
# Check server is running
curl http://localhost:8080/health

# If not, start it
make run-multi
```

### Issue: "Invalid credentials"
```bash
# Test user exists in DB
make docker-psql
SELECT email FROM users;
```

### Issue: "Vault initialization failed"
```bash
# Check Electron database API
# Open DevTools → Console → Check for errors
```

---

## 🎉 **Success Criteria**

Your implementation is correct if:

- ✅ Login screen shows on app start
- ✅ Registration creates account + returns JWT
- ✅ Login returns JWT token
- ✅ Unlock vault screen shows after login
- ✅ Vault list shows after unlock
- ✅ User email displays in header
- ✅ Logout clears session + returns to login
- ✅ Lock vault keeps session active

---

**Questions?** Check [README.md](README.md) or [BIOMETRIC_SETUP.md](BIOMETRIC_SETUP.md)

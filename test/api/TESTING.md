# API Testing Guide

Complete guide to testing the Password Sync API.

## 🚀 Quick Start (5 minutes)

### 1. Setup Environment
```bash
# One command to set up everything
make dev-setup
```

This will:
- ✅ Start Postgres in Docker
- ✅ Create schema
- ✅ Seed test user (`test@example.com` / `password123`)

### 2. Start Server
```bash
# Terminal 1
make run-multi
```

### 3. Test with REST Client

1. Install "REST Client" extension in VS Code
2. Open `test/api/auth.http`
3. Click "Send Request" above each request

---

## 📁 Directory Structure

```
password-sync/
├── docker/
│   ├── docker-compose.yml       # Postgres container
│   ├── .env.example            # Environment variables
│   └── README.md               # Docker docs
│
├── test/api/
│   ├── auth.http               # Auth endpoints (START HERE)
│   ├── devices.http            # Device management
│   ├── sync.http               # Encrypted sync
│   ├── health.http             # Health check
│   ├── TESTING.md              # This file
│   └── README.md               # Quick reference
│
└── Makefile                    # All commands
```

---

## 🧪 Test Flow

### Step 1: Authentication (`auth.http`)

```http
# 1. Register new user
POST http://localhost:8080/api/v1/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "user_id": "29ceb8e2-...",
  "email": "test@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "uuid-456"
}
```

**Copy the `access_token`!** You'll need it for all other tests.

---

### Step 2: Device Registration (`devices.http`)

```http
# Replace YOUR_ACCESS_TOKEN_HERE with token from Step 1
POST http://localhost:8080/api/v1/devices
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json

{
  "device_name": "MacBook Pro",
  "device_type": "desktop"
}
```

**Expected Response:**
```json
{
  "id": "07d7cb4c-...",
  "device_name": "MacBook Pro",
  "device_type": "desktop",
  "created_at": "2025-10-02T09:10:20Z"
}
```

---

### Step 3: Encrypted Sync (`sync.http`)

#### Push Encrypted Credentials
```http
POST http://localhost:8080/api/v1/sync/push
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json

{
  "zone": "default",
  "records": [
    {
      "item_uuid": "550e8400-e29b-41d4-a716-446655440001",
      "wrapped_key": "ZW5jcnlwdGVkLWtleS1kYXRh",
      "enc_item": "ZW5jcnlwdGVkLWNyZWRlbnRpYWw="
    }
  ]
}
```

**Expected Response:**
```json
{
  "gencount": 1,
  "synced": 1
}
```

#### Pull Encrypted Credentials
```http
POST http://localhost:8080/api/v1/sync/pull
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json

{
  "zone": "default",
  "last_gencount": 0
}
```

**Expected Response:**
```json
{
  "updates": [
    {
      "uuid": "550e8400-...",
      "gencount": 1,
      "wrappedkey": "ZW5jcnlwdGVkLWtleS1kYXRh",
      "encitem": "ZW5jcnlwdGVkLWNyZWRlbnRpYWw=",
      "tombstone": false
    }
  ],
  "gencount": 1
}
```

---

## 🔍 Verification

### Check Postgres Database
```bash
# Connect to Postgres
make docker-psql

# List users
SELECT id, email, created_at FROM users;

# List sync records
SELECT user_id, item_uuid, gencount FROM sync_records;

# Exit
\q
```

---

## 🛠️ Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev-setup` | Full setup (Docker + seed) |
| `make docker-up` | Start Postgres |
| `make docker-down` | Stop Postgres |
| `make docker-logs` | View Postgres logs |
| `make docker-psql` | Connect to Postgres CLI |
| `make db-seed` | Seed test user |
| `make run-multi` | Start server (multi-tenant) |
| `make run` | Start server (single-user) |

---

## 🐛 Troubleshooting

### Issue: "connection refused"
```bash
# Check if Postgres is running
docker ps | grep postgres

# If not, start it
make docker-up
```

### Issue: "relation users does not exist"
```bash
# Reset database
make docker-down-clean
make dev-setup
```

### Issue: "401 Unauthorized"
```bash
# JWT expired (15min lifetime)
# Re-run auth.http to get new token
```

### Issue: "email already exists"
```bash
# Test user already created
# Just login instead of register
```

---

## 📊 Test Coverage

### ✅ Implemented Endpoints

**Public (No Auth):**
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Get JWT token
- `POST /api/v1/auth/refresh` - Refresh JWT
- `GET /health` - Health check

**Protected (Requires JWT):**
- `POST /api/v1/devices` - Register device
- `GET /api/v1/devices` - List devices
- `POST /api/v1/sync/push` - Upload encrypted data
- `POST /api/v1/sync/pull` - Download encrypted data
- `GET /api/v1/sync/manifest` - Get sync state

---

## 🔐 Security Testing

### Test Invalid Login
```http
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "wrongpassword"
}
```

**Expected:** `401 Unauthorized`

### Test Missing JWT
```http
GET http://localhost:8080/api/v1/devices
# No Authorization header
```

**Expected:** `401 Unauthorized`

### Test Expired JWT
```http
# Wait 15 minutes
GET http://localhost:8080/api/v1/devices
Authorization: Bearer <old-token>
```

**Expected:** `401 Unauthorized - token has expired`

---

## 📝 Next Steps

After API testing is complete:

1. ✅ Backend working
2. ⏭️ Add login/register to desktop client
3. ⏭️ Integrate desktop client with JWT auth
4. ⏭️ Test full flow: Login → Unlock → Sync

---

## 🎯 Success Criteria

Your setup is correct if:

- ✅ Health check returns `{"status":"ok"}`
- ✅ Registration creates user
- ✅ Login returns JWT token
- ✅ Device registration works with JWT
- ✅ Sync push/pull works with encrypted data
- ✅ Unauthorized requests return 401

---

**Questions?** Check the main [README.md](../../README.md) or [DEPLOYMENT.md](../../DEPLOYMENT.md)

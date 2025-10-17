# Deployment Guide - Multi-Tenant Mode

## Architecture Overview

Password Sync now supports two modes:

### 1. **Single-User Mode** (Original)
- SQLite only
- One user, multiple devices
- Self-hosted

### 2. **Multi-Tenant SaaS Mode** (New!)
- **Postgres**: User accounts, auth, metadata (cloud)
- **SQLite**: Encrypted vault data (client-side)
- Zero-knowledge: Server NEVER sees plaintext credentials

---

## Quick Start (Development)

### Prerequisites
```bash
# Install Postgres
brew install postgresql@15  # macOS
brew services start postgresql@15

# Or use Docker
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

### 1. Initialize Database
```bash
make db-init
```

This creates the `password_sync` database and runs the schema.

### 2. Seed Test Data
```bash
make db-seed
```

Creates test user:
- Email: `test@example.com`
- Password: `password123`

### 3. Run Server (Multi-Tenant Mode)
```bash
make run-multi
```

Server starts on `http://localhost:8080`

---

## API Endpoints

### Authentication (Public)

#### Register
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

Response:
```json
{
  "user_id": "uuid-123",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "uuid-456"
}
```

#### Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Refresh Token
```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "uuid-456"
  }'
```

### Protected Endpoints (Require JWT)

All endpoints now require `Authorization: Bearer <access_token>` header.

#### Register Device
```bash
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "device_name": "My MacBook",
    "device_type": "desktop"
  }'
```

#### Push Encrypted Sync
```bash
curl -X POST http://localhost:8080/api/v1/sync/push \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "zone": "default",
    "records": [
      {
        "item_uuid": "cred-uuid-123",
        "wrapped_key": "base64-encrypted-key",
        "enc_item": "base64-encrypted-data"
      }
    ]
  }'
```

#### Pull Encrypted Sync
```bash
curl -X POST http://localhost:8080/api/v1/sync/pull \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "zone": "default",
    "last_gencount": 0
  }'
```

---

## Client Flow (Desktop/Mobile)

### 1. User Registration
```
User → Register with email + password
     → Server creates account (stores password_hash)
     → Returns JWT access token + refresh token
     → Client stores tokens securely
```

### 2. Vault Setup (First Time)
```
User → Sets master password (NEVER sent to server!)
     → Client derives master key (PBKDF2)
     → Client creates local SQLite vault
     → Client registers device with server
```

### 3. Adding Credentials
```
User → Adds credential (username, password, URL)
     → Client encrypts with master key → wrappedkey + encitem
     → Client saves to local SQLite
     → Client pushes encrypted blob to server
     → Server stores encrypted data (can't decrypt it!)
```

### 4. Syncing to New Device
```
User → Logs in on new device with email + password
     → Gets JWT token
     → Enters master password
     → Client pulls encrypted blobs from server
     → Client decrypts with master key
     → Client saves to local SQLite
```

---

## Database Schema

### Postgres (Cloud - User Accounts)
```sql
users          -- Email, password_hash (for login)
devices        -- User's trusted devices
sync_state     -- Sync metadata (gencount, digest)
sync_records   -- Encrypted blobs (wrappedkey, encitem)
refresh_tokens -- JWT refresh tokens
```

### SQLite (Client - Encrypted Vault)
```sql
keys      -- Crypto keys
inet      -- Internet credentials (passwords)
ckmirror  -- Sync records
ckmanifest-- Sync manifest
```

---

## Security Model

### Zero-Knowledge Architecture

1. **Account Password** (for login):
   - Hashed with PBKDF2 (100k iterations)
   - Stored in Postgres
   - Used for JWT authentication

2. **Master Password** (for vault encryption):
   - NEVER sent to server
   - Used to derive encryption key (client-side)
   - Used to decrypt credentials (client-side)

3. **Encrypted Sync**:
   - Server stores `wrappedkey + encitem` (encrypted blobs)
   - Server CANNOT decrypt credentials
   - Only client with master password can decrypt

---

## Production Deployment

### Environment Variables
```bash
export JWT_SECRET="your-super-secret-jwt-key-256-bits"
export DATABASE_URL="postgres://user:pass@host:5432/password_sync"
export PORT="8080"
```

### Run Server
```bash
./bin/password-sync \
  -postgres="$DATABASE_URL" \
  -jwt-secret="$JWT_SECRET" \
  -port="$PORT"
```

### Docker Compose (Coming Soon)
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: password_sync
      POSTGRES_PASSWORD: ${DB_PASSWORD}
  
  api:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD}@postgres/password_sync
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"
```

---

## Comparison: Single vs Multi-Tenant

| Feature | Single-User | Multi-Tenant |
|---------|-------------|--------------|
| **Users** | 1 | Unlimited |
| **Auth** | Master password only | Email + Password + JWT |
| **Storage** | SQLite only | Postgres + SQLite |
| **Deployment** | Self-hosted | SaaS (you host for users) |
| **Privacy** | 100% local | Zero-knowledge (encrypted cloud) |
| **Sync** | Direct P2P | Server-mediated |
| **Billing** | N/A | Stripe integration (future) |

---

## Next Steps

- [ ] Add WebSocket for real-time sync
- [ ] Add email verification
- [ ] Add password reset flow
- [ ] Add Stripe billing integration
- [ ] Add admin dashboard
- [ ] Add usage analytics

---

**Questions?** Check the [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.

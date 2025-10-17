# Quick Start Guide

## 1. Build & Run the Server

```bash
# Build
make build

# Run with default settings
./bin/password-sync -password=your-secure-password

# Or use make for development
make run
```

The server will start on `http://localhost:8080`

## 2. Test the API

### Create a Credential

```bash
curl -X POST http://localhost:8080/api/v1/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "server": "github.com",
    "account": "user@example.com",
    "password": "my-secret-password",
    "protocol": 443,
    "port": 443
  }'
```

Response:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "server": "github.com"
}
```

### Get Credentials by Server

```bash
curl http://localhost:8080/api/v1/credentials/server/github.com
```

Response:
```json
[
  {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "server": "github.com",
    "account": "user@example.com"
  }
]
```

### Get Sync Manifest

```bash
curl http://localhost:8080/api/v1/sync/manifest
```

Response:
```json
{
  "zone": "default",
  "gencount": 5,
  "digest": "a1b2c3d4...",
  "signer_id": ""
}
```

### Pull Sync Updates

```bash
curl -X POST http://localhost:8080/api/v1/sync/pull \
  -H "Content-Type: application/json" \
  -d '{
    "zone": "default",
    "last_gencount": 0
  }'
```

Response:
```json
{
  "gencount": 5,
  "updates": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "gencount": 1,
      "wrappedkey": "...",
      "encitem": "..."
    }
  ]
}
```

### List Trusted Peers

```bash
curl http://localhost:8080/api/v1/peers
```

Response:
```json
[
  {
    "peer_id": "device-1",
    "last_seen": "2025-10-01T15:50:00Z",
    "is_current_device": true,
    "trust_level": 2
  }
]
```

## 3. Multi-Device Sync Simulation

### Terminal 1 - Device A
```bash
./bin/password-sync -password=shared-password -port=8080 -device-id=device-A
```

### Terminal 2 - Device B
```bash
./bin/password-sync -password=shared-password -port=8081 -device-id=device-B
```

### Device A creates credential
```bash
curl -X POST http://localhost:8080/api/v1/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "server": "example.com",
    "account": "user@example.com",
    "password": "secret"
  }'
```

### Device B pulls updates
```bash
curl -X POST http://localhost:8081/api/v1/sync/pull \
  -H "Content-Type: application/json" \
  -d '{
    "zone": "default",
    "last_gencount": 0
  }'
```

## 4. Understanding the Architecture

### Data Flow

```
User Password
    ↓
PBKDF2 (100k iterations)
    ↓
Master Key
    ↓
┌──────────────────────────────┐
│  Per-Credential Flow:        │
│                              │
│  1. Generate Content Key     │
│  2. Wrap with Master Key     │
│     → wrappedkey             │
│  3. Encrypt Data             │
│     → encitem                │
└──────────────────────────────┘
    ↓
SQLite Database
├── keys (crypto keys)
├── inet (credentials)
├── ckmirror (sync records)
└── ckmanifest (sync state)
```

### Sync Flow

```
Device A                        Device B
    │                              │
    ├─ Create credential           │
    ├─ gencount: 1 → 2             │
    │                              │
    │◄──── Pull (gencount: 0) ─────┤
    │                              │
    ├──── Return updates ─────────►│
    │     (gencount: 2)            │
    │                              ├─ Apply updates
    │                              ├─ Local gencount: 2
```

## 5. Testing

### Run Unit Tests

```bash
make test
```

Expected output:
```
=== RUN   TestLayeredEncryption
=== RUN   TestSyncEngine
=== RUN   TestPeerManager
--- PASS: TestLayeredEncryption (0.01s)
--- PASS: TestSyncEngine (0.00s)
--- PASS: TestPeerManager (0.01s)
PASS
```

### Test Coverage

```bash
go test -v ./test/unit/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## 6. Database Inspection

```bash
sqlite3 keychain.db

# List tables
.tables

# View credentials (encrypted)
SELECT UUID, hex(substr(data, 1, 20)) as encrypted_data 
FROM inet 
LIMIT 5;

# View sync records
SELECT UUID, gencount, encver 
FROM ckmirror 
ORDER BY gencount DESC 
LIMIT 10;

# View sync manifest
SELECT zone, gencount, hex(digest) 
FROM ckmanifest;
```

## 7. Production Deployment Checklist

- [ ] Use strong master password (16+ characters)
- [ ] Enable TLS (HTTPS) for API
- [ ] Set up rate limiting
- [ ] Configure backup strategy
- [ ] Monitor gencount divergence
- [ ] Implement audit logging
- [ ] Set up peer verification workflow
- [ ] Configure firewall rules

## 8. Next Steps

### For Electron Client

```javascript
// Example API client
class PasswordSyncClient {
  constructor(baseURL, masterPassword) {
    this.baseURL = baseURL;
    this.masterPassword = masterPassword;
  }

  async createCredential(server, account, password) {
    const response = await fetch(`${this.baseURL}/api/v1/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, account, password })
    });
    return response.json();
  }

  async sync(lastGenCount) {
    const response = await fetch(`${this.baseURL}/api/v1/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone: 'default', last_gencount: lastGenCount })
    });
    return response.json();
  }
}
```

### For Angular Integration

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class PasswordSyncService {
  constructor(private http: HttpClient) {}

  createCredential(server: string, account: string, password: string) {
    return this.http.post('/api/v1/credentials', {
      server, account, password
    });
  }

  syncPull(lastGenCount: number) {
    return this.http.post('/api/v1/sync/pull', {
      zone: 'default',
      last_gencount: lastGenCount
    });
  }
}
```

## Troubleshooting

### Error: "Master password is required"
```bash
# Always provide -password flag
./bin/password-sync -password=your-password
```

### Error: "Failed to initialize storage"
```bash
# Check file permissions
chmod 644 keychain.db

# Or delete and restart
rm keychain.db
./bin/password-sync -password=your-password
```

### Sync conflicts
```bash
# Check gencount on both devices
curl http://localhost:8080/api/v1/sync/manifest
curl http://localhost:8081/api/v1/sync/manifest

# Higher gencount wins (last-write-wins strategy)
```

## Support

- Report issues: [GitHub Issues](https://github.com/deeplyprofound/password-sync/issues)
- Architecture docs: See `ARCHITECTURE.md`
- Full README: See `README.md`

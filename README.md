# Password Sync - Enterprise Password Manager

A Bitwarden/Keeper-style password manager built with Go, implementing Apple's Keychain sync architecture patterns.

## Architecture

### Core Patterns from Apple's Keychain

1. **Triple-Layer Data Model**
   - `keys` table: Cryptographic keys with usage flags
   - `inet` table: Credential metadata (server, account, protocol)
   - `ckmirror` table: Sync orchestration with parent-child key hierarchy

2. **Layered Encryption (wrappedkey + encitem)**
   - Content keys are generated per credential
   - Content keys are wrapped with master key (derived from password)
   - Credential data is encrypted with content key
   - Provides key rotation and cryptographic isolation

3. **Conflict-Free Sync with Generation Counters**
   - Each sync operation increments `gencount` (Lamport timestamp)
   - Merkle-style digest in `ckmanifest` for quick divergence detection
   - Last-write-wins conflict resolution by default

4. **Trusted Peer Circle**
   - Ed25519 cryptographic peer verification
   - Only trusted devices can sync
   - Peer trust establishment with challenge-response

## Project Structure (Monorepo)

```
password-sync/
├── cmd/
│   └── server/          # Go server entry point
├── internal/
│   ├── api/            # REST API (Gin)
│   ├── crypto/         # Layered encryption engine
│   ├── storage/        # SQLite storage with Apple schema
│   ├── sync/           # Conflict-free sync engine
│   └── peer/           # Trusted peer management
├── pkg/
│   ├── models/         # Data models
│   └── errors/         # Error types
├── clients/
│   ├── desktop/        # Electron + Angular desktop app
│   ├── web/            # (Future) Web application
│   └── mobile/         # (Future) Mobile apps
└── test/
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

## Quick Start

**See [docs/current/QUICK_START.md](docs/current/QUICK_START.md) for the fastest setup (5 minutes)!**

### TL;DR
```bash
make docker-restart-clean  # Fresh database
make dev-setup            # Seed test data
make run-multi           # Start server
```

### Server (Go Backend)

#### Prerequisites
- Go 1.24+ (automatically managed via go.mod toolchain)
- Docker & Docker Compose (for Postgres)

#### Multi-Tenant Mode (Recommended)
```bash
# Start Postgres
make docker-up

# Run server
make run-multi
```

#### Single-User Mode (Legacy)
```bash
make run
# Or: ./bin/password-sync -password=your-master-password -port=8080
```

#### Tests
```bash
make test
```

### Desktop Client (Electron + Angular)

#### Prerequisites
- Node.js 22+
- npm 11+

#### Run Desktop App
```bash
# Terminal 1: Start server
make run

# Terminal 2: Start desktop app
cd clients/desktop
npm install
npm run electron:dev
```

See [clients/desktop/README.md](clients/desktop/README.md) for more details.

## 📚 Documentation

**All documentation is in [docs/current/](docs/current/)** (symlinked to latest version)

- **[Quick Start](docs/current/QUICK_START.md)** - Get running in 5 minutes
- **[Architecture](docs/current/ARCHITECTURE.md)** - System design & patterns
- **[Deployment](docs/current/DEPLOYMENT_CHECKLIST.md)** - Production deployment
- **[Bug Fixes](docs/current/FIXES.md)** - Known issues & fixes
- **[Full Index](docs/current/INDEX.md)** - Complete documentation index

### Common Issues
- **Schema errors?** → [DOCKER_SCHEMA_FIX.md](docs/current/DOCKER_SCHEMA_FIX.md)
- **Setup help?** → [QUICK_START.md](docs/current/QUICK_START.md)
- **Understanding code?** → [ARCHITECTURE.md](docs/current/ARCHITECTURE.md)

## API Endpoints

### Credentials

- `POST /api/v1/credentials` - Create credential
- `GET /api/v1/credentials/:uuid` - Get credential
- `GET /api/v1/credentials/server/:server` - Get credentials by server
- `DELETE /api/v1/credentials/:uuid` - Delete credential (tombstone)

### Keys

- `POST /api/v1/keys` - Create cryptographic key
- `GET /api/v1/keys/:uuid` - Get key

### Sync

- `GET /api/v1/sync/manifest` - Get sync manifest
- `POST /api/v1/sync/pull` - Pull sync updates
- `POST /api/v1/sync/push` - Push sync updates

### Peers

- `GET /api/v1/peers` - List trusted peers
- `POST /api/v1/peers/trust` - Establish trust with peer
- `DELETE /api/v1/peers/:peerID` - Revoke trust

## Database Schema

Mirrors Apple's keychain-2.db:

- `keys` - Cryptographic keys (201 keys on reference system)
- `inet` - Internet credentials (1116 entries on reference system)
- `ckmirror` - Sync records with wrappedkey + encitem
- `ckmanifest` - Sync state with generation counters and Merkle digest
- `trusted_peers` - Peer trust circle (12 peers on reference system)

## Security Features

- **PBKDF2** key derivation (100k iterations)
- **AES-256-GCM** for encryption
- **Ed25519** for peer signatures
- **HKDF** for subkey derivation
- Zero-knowledge architecture (server never sees plaintext)

## Testing

Apple's proven patterns are validated with comprehensive tests:

- `crypto_test.go` - Layered encryption validation
- `sync_test.go` - Conflict-free sync logic
- `peer_test.go` - Trust circle management

## Roadmap

- [x] Core storage schema
- [x] Layered encryption (wrappedkey + encitem)
- [x] Sync engine with generation counters
- [x] Trusted peer management
- [x] REST API
- [x] Electron desktop client (Angular) - **In Progress**
- [ ] Desktop UI components (credentials list, sync status)
- [ ] WebSocket real-time sync
- [ ] Mobile clients (iOS/Android)
- [ ] Browser extensions
- [ ] End-to-end encrypted sharing

## License

MIT

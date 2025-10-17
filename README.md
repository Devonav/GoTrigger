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
make run-multi

# Terminal 2: Start desktop app
cd clients/desktop
npm install
npm run electron:dev
```

See [clients/desktop/README.md](clients/desktop/README.md) for more details.

### Mobile Client (Flutter)

#### Prerequisites
- Flutter 3.32.5+
- Xcode 16.4+ (for iOS)
- iOS 13.0+ deployment target

#### Run Mobile App
```bash
# Terminal 1: Start server (if not already running)
cd /Users/devonvillalona/password-sync
make docker-up
make run-multi

# Terminal 2: Run Flutter app
cd clients/mobile
flutter pub get
flutter run  # For physical device or simulator
```

#### Important Setup Notes

**For Physical iOS Devices:**
1. Update API endpoints to use your Mac's IP address (not localhost)
   - `lib/services/api_service.dart` - Change `localhost` to your Mac IP (e.g., `192.168.86.22`)
   - `lib/services/websocket_service.dart` - Change `ws://localhost` to `ws://YOUR_MAC_IP`
   - `lib/services/graphql_service.dart` - Change `localhost` to your Mac IP

2. Configure iOS deployment target:
   - Open `ios/Podfile` and ensure `platform :ios, '13.0'`
   - Run `cd ios && pod install && cd ..`

**Clearing Local Data:**
- **Desktop**: Delete SQLite database at `~/Library/Application Support/password-sync-desktop/vault.db*`
- **Server**: Clean database with `make docker-restart-clean`

#### Features
- ✅ Face ID / Touch ID biometric authentication
- ✅ End-to-end encrypted credential sync
- ✅ Real-time WebSocket sync notifications
- ✅ Pull-to-refresh credential list
- ✅ Secure credential storage
- ✅ Cross-platform sync with desktop

See [clients/mobile/README.md](clients/mobile/README.md) for more details.

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
- [x] REST API
- [x] Electron desktop client (Angular)
- [x] Desktop UI components (credentials list, import from 45+ password managers)
- [x] WebSocket real-time sync
- [x] Flutter mobile client (iOS)
- [x] Biometric authentication (Face ID/Touch ID)
- [x] Cross-platform credential sync
- [ ] Mobile Android support
- [ ] Browser extensions
- [ ] End-to-end encrypted sharing
- [ ] Trusted peer management

## License

MIT

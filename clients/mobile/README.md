# Password Sync - iOS Mobile Client

Cross-platform password manager iOS client built with Flutter. Features end-to-end encryption, biometric unlock, and sync with the Go server.

## Features

### Implemented
- ✅ Flutter project structure
- ✅ GraphQL client for server communication
- ✅ REST API service for authentication
- ✅ End-to-end encryption (ChaCha20-Poly1305)
- ✅ Credential model matching desktop client

### In Progress
- 🚧 Local SQLite storage
- 🚧 Authentication screens (login/register)
- 🚧 Vault unlock with biometric support
- 🚧 Credential list and management

## Tech Stack

- **Framework**: Flutter 3.32.5
- **State Management**: Provider
- **API Communication**:
  - GraphQL (graphql_flutter)
  - REST (http)
- **Encryption**:
  - ChaCha20-Poly1305 (cryptography)
  - PBKDF2 key derivation
- **Biometric**: local_auth, flutter_secure_storage
- **Local Storage**: SQLite (sqflite)
- **Mnemonic**: BIP-39 (bip39)

## Dependencies

```yaml
# GraphQL & HTTP
graphql_flutter: ^5.1.2
http: ^1.2.0

# State Management
provider: ^6.1.1

# Local Storage
sqflite: ^2.3.0
path_provider: ^2.1.1
shared_preferences: ^2.2.2
flutter_secure_storage: ^9.0.0

# Encryption (matching desktop)
cryptography: ^2.7.0
encrypt: ^5.0.3

# Biometric Authentication
local_auth: ^2.2.0

# BIP-39 Mnemonic
bip39: ^1.0.6

# UI
flutter_svg: ^2.0.9
google_fonts: ^6.1.0

# Utilities
intl: ^0.19.0
uuid: ^4.3.3
```

## Project Structure

```
lib/
├── core/
│   ├── auth/           # Authentication logic
│   ├── crypto/         # Encryption services (ChaCha20-Poly1305)
│   ├── storage/        # Local SQLite storage
│   └── sync/           # Server sync logic
├── features/
│   ├── auth/           # Login/Register screens
│   └── vault/          # Credential management screens
├── services/
│   ├── api_service.dart       # REST API calls
│   └── graphql_service.dart   # GraphQL client
└── shared/
    ├── models/         # Data models (Credential, etc.)
    └── widgets/        # Reusable UI components
```

## Architecture

### Triple-Layer Encryption (Matching Desktop)

**Layer 1**: Individual credential encryption with vault key
- Each credential encrypted with ChaCha20-Poly1305
- Vault key stored in encrypted form

**Layer 2**: Vault key encryption with master key
- Master key derived from password
- Never stored, derived on-demand

**Layer 3**: Master key derivation from password + salt
- PBKDF2 with 100,000 iterations
- Salt stored in secure storage

### Security Features

1. **Client-side encryption only** (zero-knowledge)
   - Server never sees plaintext credentials
   - All encryption/decryption happens on device

2. **Biometric unlock** (Face ID/Touch ID)
   - Master password stored in iOS Keychain
   - Protected by biometric authentication

3. **Secure storage**
   - Sensitive data in flutter_secure_storage
   - Uses iOS Keychain with hardware encryption

4. **Key derivation**
   - PBKDF2 with SHA-256
   - 100,000 iterations matching desktop

## Server Communication

### REST API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/sync` - Sync credentials
- `GET /api/credentials` - Get all credentials

### GraphQL Endpoint
- `/graphql` - Real-time queries and mutations

## Getting Started

### Prerequisites
- Flutter SDK 3.8.1 or higher
- Xcode 14+ (for iOS development)
- iOS 12.0+ device or simulator

### Installation

1. **Install dependencies:**
   ```bash
   flutter pub get
   ```

2. **Configure server endpoint:**
   Edit `lib/services/api_service.dart` and `lib/services/graphql_service.dart` to point to your server:
   ```dart
   static const String _baseUrl = 'http://your-server:8080/api';
   static const String _defaultEndpoint = 'http://your-server:8080/graphql';
   ```

3. **Run on iOS:**
   ```bash
   flutter run -d ios
   ```

### iOS Configuration

The app requires the following iOS capabilities:

1. **Face ID/Touch ID**: Add to `ios/Runner/Info.plist`:
   ```xml
   <key>NSFaceIDUsageDescription</key>
   <string>Unlock your password vault with Face ID</string>
   ```

2. **Keychain Sharing**: Enabled automatically by flutter_secure_storage

## Development

### Adding New Features

1. Create feature in `lib/features/`
2. Add models to `lib/shared/models/`
3. Add services to `lib/services/` or `lib/core/`
4. Update providers for state management

### Testing

```bash
# Run all tests
flutter test

# Run with coverage
flutter test --coverage
```

## Encryption Implementation

The mobile client uses the same encryption scheme as the desktop:

```dart
// Derive key from password
final key = await CryptoService.deriveKeyFromPassword(
  password: masterPassword,
  salt: salt,
  iterations: 100000,
);

// Encrypt credential
final encrypted = await CryptoService.encryptCredential(
  credential: credential.toJson(),
  vaultKey: vaultKey,
);

// Decrypt credential
final decrypted = await CryptoService.decryptCredential(
  encryptedData: encryptedData,
  vaultKey: vaultKey,
);
```

## Next Steps

1. ✅ Set up project structure
2. ✅ Implement GraphQL client
3. ✅ Implement encryption services
4. ⏳ Implement local SQLite storage
5. ⏳ Build authentication screens
6. ⏳ Build vault unlock screen
7. ⏳ Build credential list screen
8. ⏳ Add biometric authentication
9. ⏳ Implement sync functionality
10. ⏳ Add import functionality (future)

## License

Part of the Password Sync cross-platform password manager.

## Contributing

This is the iOS mobile client. See the main project README for overall architecture.

---

**Last Updated**: October 2025
**Status**: Initial Setup Complete
**Platform**: iOS only

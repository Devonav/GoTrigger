# DeeplyProfound - iOS Mobile Client

Cross-platform password manager iOS client built with Flutter. Features end-to-end encryption, biometric unlock, real-time sync, and a premium dark UI matching the desktop client.

## Quick Start

```bash
# 1. Install dependencies
flutter pub get

# 2. Configure server URL (IMPORTANT!)
# Edit lib/config/environment.dart and set your server IP

# For iOS Simulator (localhost works):
# apiBaseUrl = 'http://localhost:8080'

# For Physical Device (use your Mac's IP):
# Find IP: ipconfig getifaddr en0
# apiBaseUrl = 'http://192.168.86.22:8080'  # Replace with your IP

# 3. Run the app
flutter run

# OR for clean build:
flutter clean && flutter pub get && flutter run
```

**See [Installation](#installation) section below for detailed setup instructions.**

## Features

### Implemented
- ✅ Flutter project structure
- ✅ GraphQL client for server communication
- ✅ REST API service for authentication
- ✅ **Triple-layer encryption (AES-256-GCM)** matching desktop
- ✅ **PBKDF2 master key derivation** (100,000 iterations)
- ✅ Credential model matching desktop client
- ✅ **Face ID / Touch ID biometric unlock**
- ✅ **Direct vault access with biometric login** (skips master password screen)
- ✅ Secure credential storage (iOS Keychain)
- ✅ Authentication screens (login/register/home)
- ✅ **Dashboard screen** with 6 service tiles (matching desktop)
- ✅ **Premium dark theme** (mobile-friendly with proper contrast)
- ✅ **Vault list screen** with credential display
- ✅ **Pull-to-refresh** sync functionality
- ✅ **Search credentials** by name, username, or URL
- ✅ **Copy username/password** to clipboard
- ✅ Sync with tombstone filtering
- ✅ **Real-time sync via WebSocket** (auto-refresh when credentials change)
- ✅ **Cross-platform sync** with desktop client
- ✅ **Environment configuration** for easy server URL switching
- ✅ **Password import** from 45+ password managers (CSV/JSON)
- ✅ **Breach Report** - Check emails against Have I Been Pwned database
- ✅ **CVE Security Alerts** - Search and view latest CVE vulnerabilities

### In Progress
- 🚧 **Master key salt sync** (currently each device generates own salt)
- 🚧 Add/Edit credential functionality
- 🚧 Delete credential functionality
- 🚧 Local SQLite storage for offline access

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
├── config/
│   └── environment.dart        # 🆕 Server URL configuration
├── core/
│   ├── auth/           # Authentication logic
│   ├── crypto/         # Encryption services (ChaCha20-Poly1305)
│   ├── storage/        # Local SQLite storage
│   └── sync/           # Server sync logic
├── features/
│   ├── auth/           # Login/Register screens
│   ├── dashboard/      # 🆕 Dashboard screen (6 service tiles)
│   └── vault/          # Credential management screens
├── services/
│   ├── api_service.dart        # REST API calls
│   ├── websocket_service.dart  # WebSocket real-time sync
│   ├── graphql_service.dart    # GraphQL client
│   └── biometric_service.dart  # Face ID/Touch ID
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
- Flutter SDK 3.32.5 or higher
- Xcode 16.4+ (for iOS development)
- iOS 13.0+ device or simulator (iOS 26 beta supported)
- Go server running on localhost:8080 or network IP

### Installation

1. **Install dependencies:**
   ```bash
   flutter pub get
   ```

2. **Configure server endpoint:**

   All server URLs are now centralized in **`lib/config/environment.dart`** for easy configuration.

   **For iOS Simulator (using localhost):**
   ```dart
   // lib/config/environment.dart
   class Environment {
     static const String apiBaseUrl = 'http://localhost:8080';
     static const String wsBaseUrl = 'ws://localhost:8080';
     // ... rest stays the same
   }
   ```

   **For Physical iOS Device (using network IP):**

   First, find your Mac's IP address:
   ```bash
   # macOS
   ipconfig getifaddr en0
   # Example output: 192.168.86.22
   ```

   Then update the environment file:
   ```dart
   // lib/config/environment.dart
   class Environment {
     static const String apiBaseUrl = 'http://192.168.86.22:8080';  // Your Mac's IP
     static const String wsBaseUrl = 'ws://192.168.86.22:8080';     // Your Mac's IP
     static const String apiVersion = 'v1';

     // Computed URLs (no changes needed)
     static String get apiUrl => '$apiBaseUrl/api/$apiVersion';
     static String get wsUrl => '$wsBaseUrl/api/$apiVersion';
     static String get graphqlUrl => '$apiBaseUrl/graphql';
   }
   ```

   **That's it!** All services (`api_service.dart`, `websocket_service.dart`, `graphql_service.dart`) automatically use this configuration.

3. **Configure iOS deployment target:**
   ```bash
   cd ios
   # Edit Podfile: Uncomment and set platform :ios, '13.0'
   pod install
   cd ..
   ```

4. **Run on iOS:**
   ```bash
   # Clean and rebuild
   flutter clean
   flutter pub get

   # Run on device or simulator
   flutter run
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

## Biometric Authentication

### Implementation

The mobile client now supports Face ID and Touch ID for secure biometric unlock:

**BiometricService** (`lib/services/biometric_service.dart`):
```dart
// Check availability
bool available = await BiometricService.isBiometricAvailable();

// Get biometric type (Face ID, Touch ID, etc.)
String type = await BiometricService.getBiometricTypeName();

// Enable biometric login after successful password login
await BiometricService.enableBiometricLogin(
  username: 'user@example.com',
  password: 'password123',
);

// Get stored credentials with biometric authentication
Map<String, String>? creds = await BiometricService.getStoredCredentials();

// Disable biometric login
await BiometricService.disableBiometricLogin();
```

### User Flow

1. **First Login**: User enters username/password
2. **Setup Prompt**: Dialog asks to enable Face ID/Touch ID
3. **Credential Storage**: Encrypted in iOS Keychain
4. **Subsequent Logins**: Tap biometric button → Authenticate → Auto-login

### Testing on Simulator

Enable Face ID in iOS Simulator:
1. Open Simulator app
2. Menu: **Features** → **Face ID** → **Enrolled**
3. Simulate authentication: **Features** → **Face ID** → **Matching Face**

## Server Sync

### Tombstone Filtering

The mobile client now filters tombstoned (deleted) credentials during sync:

```dart
// Pull sync without tombstoned records (default)
await ApiService.pullSync(
  zone: 'default',
  lastGenCount: 0,
  includeTombstoned: false,  // Filters out deleted credentials
);
```

Server-side filtering prevents deleted credentials from appearing in mobile sync responses.

## Real-Time Sync

### WebSocket Implementation

The mobile client now supports real-time sync notifications via WebSocket:

**WebSocketService** (`lib/services/websocket_service.dart`):
```dart
// Connect to WebSocket
final wsService = WebSocketService();
await wsService.connect(zone: 'default');

// Listen for sync events
wsService.syncEvents.listen((event) {
  if (event.type == 'credentials_changed') {
    // Automatically refresh credentials
    loadCredentials();
  }
});
```

### Features

1. **Auto-connect on vault unlock** - WebSocket connects when vault screen loads
2. **Auto-refresh on changes** - Credentials automatically reload when other devices sync
3. **Automatic reconnection** - Reconnects every 5 seconds if connection drops
4. **User notifications** - Shows snackbar when credentials sync from another device
5. **Graceful fallback** - Manual sync still works if WebSocket fails

### How It Works

1. Server broadcasts sync events when credentials change (add/edit/delete)
2. All connected clients for that user receive the event
3. Clients automatically pull latest credentials from server
4. UI updates with new credential list

This provides a seamless multi-device experience where changes on one device instantly appear on all others.

## UI & Design

### Dashboard

The mobile app now features a dashboard screen matching the desktop client:

**Navigation Flow**: Login/Register → **Dashboard** → Vault/Services

**6 Service Tiles**:
1. **Password Vault** (Indigo `#667EEA`) - Functional
2. **Mail Sync** (Sky Blue `#4FACFE`) - Coming Soon
3. **Breach Report** (Amber `#FBBF24`) - Coming Soon
4. **CVE Alerts** (Red `#EF4444`) - Coming Soon
5. **Password Rotation** (Green `#22C55E`) - Coming Soon
6. **Settings** (Purple `#A855F7`) - Coming Soon

### Premium Dark Theme

The mobile app features a **mobile-friendly dark theme** with:

**Colors**:
- Background: `#0F0F0F` (dark gray, not pure black for better OLED compatibility)
- Cards/Surfaces: `#1A1A1A` (lighter dark gray for contrast)
- Text: White with opacity variations (`1.0`, `0.5`, `0.4`)
- Buttons: White filled buttons with black text

**Design Elements**:
- **Strong outlines**: `1.5px` white borders at `10-12%` opacity for better visibility
- **Subtle shadows**: Depth without overwhelming dark backgrounds
- **Colorful icons**: Matching desktop tile colors exactly
- **Touch-friendly**: Larger tap targets and spacing for mobile

**Accessibility**:
- High contrast ratios for text readability
- Clear visual hierarchy
- Mobile-friendly borders for better element separation
- Proper dark mode implementation for OLED screens

### Screenshots

See `DASHBOARD_IMPLEMENTATION.md` for detailed UI specifications and comparison with desktop.

## Troubleshooting

### Common Issues

**1. White Screen / Dart VM Initialization Error**
- Update Flutter to 3.32.5+ for iOS 26 beta support
- Run `flutter clean && flutter pub get`
- Check iOS deployment target is 13.0+

**2. Login Works but No Credentials Sync**
- Verify server is running: `http://YOUR_IP:8080/api/v1/health`
- Check IP address configuration in service files
- Ensure both desktop and mobile are using the same server

**3. WebSocket Connection Failed**
- Update auth middleware to support token in query params (already implemented)
- Check server logs for WebSocket connection attempts
- Verify firewall isn't blocking WebSocket connections

**4. Duplicate Credentials After Import**
- Desktop local storage persists after "Delete All" on mobile
- Clear desktop local database: `rm -rf ~/Library/Application\ Support/password-sync-desktop/`
- Or use "Delete All" button in desktop app (deletes both local and server data)

**5. Face ID Doesn't Skip Master Password Screen**
- This is now fixed - biometric login goes directly to `/vault-list`
- Update to latest version if issue persists

## Next Steps

1. ✅ Set up project structure
2. ✅ Implement GraphQL client
3. ✅ Implement encryption services
4. ✅ Build authentication screens
5. ✅ Add biometric authentication
6. ✅ Implement sync with tombstone filtering
7. ✅ Add real-time WebSocket sync
8. ✅ Build vault unlock screen
9. ✅ Build credential list screen
10. ✅ Implement cross-platform sync with desktop
11. ⏳ Add/Edit credential functionality
12. ⏳ Implement local SQLite storage for offline access
13. ⏳ Add import functionality (future)

## License

Part of the DeeplyProfound cross-platform password manager.

## Contributing

This is the iOS mobile client. See the main project README for overall architecture.

---

## Configuration Reference

For complete network configuration details (localhost vs IP, desktop sync, etc.), see:
- **[NETWORK_CONFIGURATION.md](../../NETWORK_CONFIGURATION.md)** - Full guide for configuring server URLs
- **[DASHBOARD_IMPLEMENTATION.md](DASHBOARD_IMPLEMENTATION.md)** - Dashboard UI specifications

---

**Last Updated**: October 2025
**Status**: ✅ Fully Functional - Dashboard, Sync, Biometrics, Real-time Updates, Premium Dark UI
**Platform**: iOS 13.0+ (tested on iOS 26 beta)
**New**: Centralized environment configuration, Dashboard screen, Mobile-friendly dark theme

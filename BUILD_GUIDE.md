# DeeplyProfound - Build Guide

Complete guide for building the DeeplyProfound desktop and mobile applications.

## Desktop Application (Electron)

### Prerequisites

- Node.js 18+ and npm
- For macOS builds: Xcode Command Line Tools
- For Windows builds: Windows SDK
- For Linux builds: Standard build tools (gcc, make, etc.)

### Development Mode

Run the app in development mode with hot reload:

```bash
cd clients/desktop
npm install
npm run electron:dev
```

This will:
1. Start the Angular dev server on http://localhost:4200
2. Compile the Electron main process
3. Launch the Electron app in development mode

### Production Build

Build the Angular app and run in production mode:

```bash
cd clients/desktop
npm run electron:prod
```

### Platform-Specific Packages

#### macOS (DMG + ZIP)

```bash
cd clients/desktop
npm run package:mac
```

**Output:** `clients/desktop/release/DeeplyProfound-{version}.dmg` and `.zip`

**Requirements:**
- Must be run on macOS
- For code signing: Developer ID certificate (optional but recommended)

#### Windows (NSIS Installer + Portable)

```bash
cd clients/desktop
npm run package:win
```

**Output:**
- `clients/desktop/release/DeeplyProfound Setup {version}.exe` (installer)
- `clients/desktop/release/DeeplyProfound {version}.exe` (portable)

**Requirements:**
- Can be built on Windows, macOS, or Linux
- For code signing: Windows certificate (optional)

#### Linux (AppImage + DEB)

```bash
cd clients/desktop
npm run package:linux
```

**Output:**
- `clients/desktop/release/DeeplyProfound-{version}.AppImage`
- `clients/desktop/release/deeplyprofound_{version}_amd64.deb`

**Requirements:**
- Best built on Linux
- Can be built on macOS with some limitations

### Build All Platforms (macOS only)

To build for all platforms from macOS:

```bash
cd clients/desktop

# Build for macOS
npm run package:mac

# Build for Windows (cross-platform)
npm run package:win

# Build for Linux (cross-platform)
npm run package:linux
```

### Troubleshooting Desktop Builds

#### Native Module Rebuild Issues

If you encounter errors with native modules (better-sqlite3, keytar, node-mac-auth):

```bash
cd clients/desktop
npm run rebuild
```

#### Clean Build

```bash
cd clients/desktop
rm -rf node_modules dist release
npm install
npm run package:mac  # or :win or :linux
```

#### Memory Issues

For large builds, increase Node.js memory:

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run package:mac
```

---

## Mobile Application (Flutter/iOS)

### Prerequisites

- Flutter SDK 3.8+
- Xcode 14+ (for iOS)
- CocoaPods
- Valid Apple Developer account (for physical device deployment)

### Development Mode

Run on iOS Simulator:

```bash
cd clients/mobile
flutter clean
flutter pub get
flutter run
```

Run on physical iOS device:

```bash
cd clients/mobile
# First, update lib/config/environment.dart with your Mac's IP address
flutter run
```

### Production Build (iOS)

#### 1. Configure Signing

Open in Xcode:
```bash
cd clients/mobile
open ios/Runner.xcworkspace
```

In Xcode:
1. Select "Runner" project
2. Select "Runner" target
3. Go to "Signing & Capabilities"
4. Select your Team
5. Choose your Bundle Identifier (e.g., `com.deeplyprofound.app`)

#### 2. Build IPA for Distribution

For App Store:
```bash
cd clients/mobile
flutter build ipa --release
```

For Ad-Hoc/Enterprise distribution:
```bash
cd clients/mobile
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

**Output:** `clients/mobile/build/ios/ipa/password_sync.ipa`

#### 3. Build for Device Testing

```bash
cd clients/mobile
flutter build ios --release
```

Then deploy via Xcode or:
```bash
flutter install
```

### Troubleshooting Mobile Builds

#### Pod Install Issues

```bash
cd clients/mobile/ios
pod deintegrate
pod install
cd ..
flutter clean
flutter pub get
```

#### Signing Issues

```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/

# Re-open in Xcode
cd clients/mobile
open ios/Runner.xcworkspace
```

#### Build Cache Issues

```bash
cd clients/mobile
flutter clean
rm -rf ios/Pods ios/Podfile.lock
flutter pub get
cd ios && pod install && cd ..
flutter run
```

---

## Server (Go Backend)

### Prerequisites

- Go 1.21+
- SQLite3

### Development Mode

```bash
cd server
go run main.go
```

Server will start on http://localhost:8080

### Production Build

#### Linux

```bash
cd server
CGO_ENABLED=1 go build -o deeplyprofound-server main.go
```

#### macOS

```bash
cd server
CGO_ENABLED=1 go build -o deeplyprofound-server main.go
```

#### Windows

```bash
cd server
set CGO_ENABLED=1
go build -o deeplyprofound-server.exe main.go
```

#### Cross-Compilation (Advanced)

For Linux from macOS:
```bash
cd server
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o deeplyprofound-server-linux main.go
```

**Note:** Cross-compilation with CGO (required for SQLite) needs appropriate cross-compilation tools.

### Docker Build

```bash
cd server
docker build -t deeplyprofound-server .
docker run -p 8080:8080 deeplyprofound-server
```

---

## Release Checklist

Before creating a release:

### 1. Version Updates

Update version numbers in:
- [ ] `clients/desktop/package.json` - `"version"`
- [ ] `clients/mobile/pubspec.yaml` - `version`
- [ ] Git tag: `git tag v1.0.0`

### 2. Desktop Pre-Release

```bash
cd clients/desktop
npm install
npm run test          # Run tests
npm run build         # Verify Angular build
npm run electron:prod # Test production mode
```

### 3. Mobile Pre-Release

```bash
cd clients/mobile
flutter analyze       # Static analysis
flutter test         # Run tests
flutter build ios --release  # Verify iOS build
```

### 4. Server Pre-Release

```bash
cd server
go test ./...        # Run tests
go build main.go     # Verify build
```

### 5. Build All Platforms

```bash
# Desktop
cd clients/desktop
npm run package:mac
npm run package:win
npm run package:linux

# Mobile
cd clients/mobile
flutter build ipa --release

# Server
cd server
./build-all.sh  # If you create a build script
```

### 6. Code Signing (Production)

#### macOS Desktop App
```bash
# Sign the .app
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" "release/mac/DeeplyProfound.app"

# Notarize with Apple
xcrun notarytool submit "release/DeeplyProfound-1.0.0.dmg" --apple-id "your@email.com" --team-id "TEAMID" --password "app-specific-password"
```

#### iOS App
- Use Xcode's automatic signing
- Or manually sign with provisioning profile

#### Windows Desktop App
- Use `electron-builder` with certificate:
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password
npm run package:win
```

---

## Distribution

### Desktop

- **macOS:** Upload `.dmg` to website or distribute via Mac App Store
- **Windows:** Upload `.exe` installer to website or Microsoft Store
- **Linux:** Publish `.AppImage` and `.deb` to website or package repositories

### Mobile

- **iOS App Store:** Use Xcode or Application Loader to submit `.ipa`
- **TestFlight:** Upload via App Store Connect for beta testing
- **Ad-Hoc:** Distribute `.ipa` via enterprise distribution or testing services

### Server

- Deploy Docker image to cloud provider (AWS, GCP, Azure, DigitalOcean)
- Or upload binary to VPS and run as systemd service

---

## Quick Reference

### Desktop Commands

```bash
# Development
npm run electron:dev

# Build current platform
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux

# Production test
npm run electron:prod
```

### Mobile Commands

```bash
# Development
flutter run

# Release build
flutter build ipa --release        # iOS
flutter build apk --release        # Android (future)

# Clean
flutter clean && flutter pub get
```

### Server Commands

```bash
# Development
go run main.go

# Build
go build -o deeplyprofound-server main.go

# Docker
docker build -t deeplyprofound-server .
```

---

## Environment Variables

### Desktop (Development)

Create `clients/desktop/.env`:
```env
API_URL=http://localhost:8080
NODE_ENV=development
```

### Mobile

Edit `clients/mobile/lib/config/environment.dart`:
```dart
const apiBaseUrl = 'http://192.168.1.100:8080';  // Your server IP
```

### Server

```env
PORT=8080
DATABASE_PATH=./data/passwords.db
JWT_SECRET=your-secret-key
```

---

## Support

For build issues, check:
1. This guide's troubleshooting sections
2. Project README files
3. GitHub Issues
4. Tool documentation (Electron Builder, Flutter, Go)

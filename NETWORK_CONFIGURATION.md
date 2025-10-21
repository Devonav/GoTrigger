# Network Configuration Guide

This guide explains how to configure the API and WebSocket URLs for the Password Sync application across desktop and mobile clients.

## Overview

The application consists of:
- **Go Server**: Runs on port `8080` with REST API, GraphQL, and WebSocket endpoints
- **Desktop Client** (Electron + Angular): Connects to server via HTTP/WS
- **Mobile Client** (Flutter): Connects to server via HTTP/WS

## Configuration Files

### Desktop (Angular/Electron)
**Location**: `clients/desktop/src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  API_BASE_URL: 'http://localhost:8080',      // Change for network testing
  WS_BASE_URL: 'ws://localhost:8080',         // Change for network testing
  API_VERSION: 'v1',
};
```

### Mobile (Flutter)
**Location**: `clients/mobile/lib/config/environment.dart`

```dart
class Environment {
  static const String apiBaseUrl = 'http://192.168.86.22:8080';  // Change to your IP
  static const String wsBaseUrl = 'ws://192.168.86.22:8080';     // Change to your IP
  static const String apiVersion = 'v1';
}
```

## Usage Scenarios

### Scenario 1: Local Desktop Development
**Use case**: Testing desktop app only on your Mac

**Configuration**:
```typescript
// clients/desktop/src/environments/environment.ts
API_BASE_URL: 'http://localhost:8080'
WS_BASE_URL: 'ws://localhost:8080'
```

**Steps**:
1. Start server: `cd server && go run cmd/main.go`
2. Start desktop: `cd clients/desktop && npm start`
3. Access at: http://localhost:8080

---

### Scenario 2: Testing with Physical iOS Device
**Use case**: Testing mobile app on physical iPhone/iPad + desktop on Mac

**Find your Mac's IP address**:
```bash
# On macOS
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example output: inet 192.168.86.22
```

**Configuration**:

**Desktop** (`clients/desktop/src/environments/environment.ts`):
```typescript
API_BASE_URL: 'http://192.168.86.22:8080'  // Your Mac's IP
WS_BASE_URL: 'ws://192.168.86.22:8080'
```

**Mobile** (`clients/mobile/lib/config/environment.dart`):
```dart
static const String apiBaseUrl = 'http://192.168.86.22:8080';  // Your Mac's IP
static const String wsBaseUrl = 'ws://192.168.86.22:8080';
```

**Steps**:
1. Connect Mac and iPhone to **same Wi-Fi network**
2. Find your Mac's IP address (see above)
3. Update both config files with your IP
4. Start server: `cd server && go run cmd/main.go`
5. Start desktop: `cd clients/desktop && npm start`
6. Run mobile: `cd clients/mobile && flutter run`

**Important**: Make sure firewall allows port 8080:
```bash
# macOS - Allow port 8080 in firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/server
```

---

### Scenario 3: iOS Simulator Testing
**Use case**: Testing mobile app in iOS simulator + desktop on Mac

**Configuration**:

**Desktop**:
```typescript
API_BASE_URL: 'http://localhost:8080'
WS_BASE_URL: 'ws://localhost:8080'
```

**Mobile**:
```dart
static const String apiBaseUrl = 'http://localhost:8080';  // Simulator can use localhost
static const String wsBaseUrl = 'ws://localhost:8080';
```

**Note**: iOS Simulator shares the same network as the host Mac, so `localhost` works fine.

---

### Scenario 4: Testing on Friend's Computer
**Use case**: Someone else wants to test the app on their machine

**Configuration**:

**Desktop**:
```typescript
API_BASE_URL: 'http://localhost:8080'
WS_BASE_URL: 'ws://localhost:8080'
```

**Mobile** (if using physical device):
```dart
// Replace with their computer's IP
static const String apiBaseUrl = 'http://192.168.1.XXX:8080';
static const String wsBaseUrl = 'ws://192.168.1.XXX:8080';
```

**Steps**:
1. Clone repository
2. Find their computer's IP (see above)
3. Update mobile config with their IP (only if using physical device)
4. Install dependencies:
   ```bash
   cd server && go mod download
   cd clients/desktop && npm install
   cd clients/mobile && flutter pub get
   ```
5. Run server, desktop, and/or mobile

---

## Server Configuration

The server listens on **all network interfaces** by default:

**Location**: `server/cmd/main.go`
```go
server.Run(":8080")  // Binds to 0.0.0.0:8080 (all interfaces)
```

This means the server is accessible via:
- `localhost:8080` (from the same machine)
- `192.168.x.x:8080` (from other devices on the network)
- `127.0.0.1:8080` (loopback)

## Endpoints

Once configured, the following endpoints are available:

### REST API
- **Auth**: `http://<HOST>:8080/api/v1/auth/login`
- **Sync**: `http://<HOST>:8080/api/v1/sync/pull`
- **Credentials**: `http://<HOST>:8080/api/v1/credentials`

### WebSocket
- **Live Sync**: `ws://<HOST>:8080/api/v1/sync/live?zone=default&token=<JWT>`

### GraphQL
- **Endpoint**: `http://<HOST>:8080/graphql`

Replace `<HOST>` with:
- `localhost` for local testing
- `192.168.x.x` for network testing

## Troubleshooting

### Desktop can't connect to server
1. Check server is running: `lsof -i :8080`
2. Verify URL in `clients/desktop/src/environments/environment.ts`
3. Clear localStorage: Open DevTools → Application → Local Storage → Clear

### Mobile can't connect to server
1. Verify Mac and device are on **same Wi-Fi network**
2. Check IP is correct in `clients/mobile/lib/config/environment.dart`
3. Find Mac's IP: `ifconfig | grep "inet "`
4. Test connectivity: `ping 192.168.x.x` from iPhone (use Network Utility app)
5. Check firewall settings on Mac

### WebSocket connection fails
1. Verify WS URL matches API URL (same host)
2. Check authentication token is valid
3. Look for CORS errors in browser/app console
4. Ensure server WebSocket handler is running

### Sync not working between desktop and mobile
1. **Both clients must use the SAME server URL**
   - Desktop: `192.168.86.22:8080`
   - Mobile: `192.168.86.22:8080`
   - ❌ Desktop: `localhost:8080`, Mobile: `192.168.86.22:8080` (won't sync)
2. Check both clients are logged in with same account
3. Verify WebSocket connection is active in both apps
4. Check server logs for sync events

### Changes not taking effect
1. **Desktop**: Restart Electron app (not just refresh)
2. **Mobile**: Run `flutter clean && flutter run`
3. **Server**: Restart Go server

## Quick Reference

| Scenario | Desktop URL | Mobile URL |
|----------|------------|------------|
| Desktop only | `localhost:8080` | N/A |
| iOS Simulator | `localhost:8080` | `localhost:8080` |
| Physical iPhone | `192.168.x.x:8080` | `192.168.x.x:8080` |
| Friend's computer (desktop) | `localhost:8080` | N/A |
| Friend's computer (mobile) | `192.168.x.x:8080` | `192.168.x.x:8080` |

**Golden Rule**: When testing desktop + mobile together, **both must use the same IP address**.

## Environment Files Summary

```
password-sync/
├── server/
│   └── cmd/main.go                                    # Server port config
├── clients/
│   ├── desktop/
│   │   └── src/
│   │       └── environments/
│   │           ├── environment.ts                     # Desktop development config
│   │           └── environment.prod.ts                # Desktop production config
│   └── mobile/
│       └── lib/
│           └── config/
│               └── environment.dart                   # Mobile config (dev & prod)
```

## Best Practices

1. **Never commit production URLs** to version control
2. **Use localhost by default** for easy developer onboarding
3. **Document your IP** when sharing with team members
4. **Use environment variables** for CI/CD pipelines
5. **Keep mobile and desktop configs in sync** when testing sync features

---

**Last Updated**: October 2025
**Tested On**: macOS Sonoma, iOS 17+, Flutter 3.32.5

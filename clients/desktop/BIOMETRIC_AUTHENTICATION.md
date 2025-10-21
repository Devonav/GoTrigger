# Biometric Authentication (Touch ID / Face ID)

## Overview

The Password Sync desktop application supports **biometric authentication** on macOS using Touch ID and Face ID. This allows users to unlock their password vault quickly and securely without typing their master password every time.

## How It Works

### Architecture

The biometric authentication system uses a **hybrid approach** with multiple layers:

1. **Electron safeStorage API** - Primary method, uses macOS Keychain with encryption
2. **keytar** - Backup storage method
3. **node-mac-auth** - Triggers the actual Touch ID/Face ID prompts

### Components

#### Frontend (Angular)
- **Location**: `src/app/features/vault/components/unlock-vault/`
- **Service**: `src/app/core/auth/biometric.service.ts`

#### Backend (Electron)
- **Handler**: `electron/biometric-handler.ts`
- **Preload**: `electron/preload.ts`

## User Flow

### First-Time User
1. User enters master password on unlock screen
2. Password is **automatically saved** to macOS Keychain (encrypted)
3. Vault unlocks

### Returning User
1. App launches → unlock screen appears
2. **Automatic Touch ID prompt** appears after 0.5 seconds
3. User authenticates with fingerprint/face
4. Vault unlocks immediately

### Manual Unlock
- User can click "Unlock with Touch ID / Face ID" button anytime
- Or enter master password if biometrics fail

## Technical Implementation

### Password Storage

**Primary: Electron safeStorage**
```typescript
const encrypted = safeStorage.encryptString(password);
fs.writeFileSync(passwordPath, encrypted);
```
- Stored at: `~/Library/Application Support/password-sync-desktop/secure/password-{userId}.enc`
- Uses macOS Keychain encryption

**Backup: keytar**
```typescript
await keytar.setPassword('PasswordSync', 'masterPassword-{userId}', password);
```
- Stored in macOS Keychain
- Provides fallback if safeStorage fails

### Biometric Prompt

**Touch ID/Face ID Trigger**
```typescript
await nodeMacAuth.promptTouchID({
  reason: 'Unlock your password vault'
});
```

**API Functions**
- `promptTouchID({ reason })` - Shows biometric prompt
- `canPromptTouchID()` - Checks if biometrics available

### Auto-Prompt on Launch

```typescript
// In unlock-vault.component.ts ngOnInit()
if (hasSavedPassword && available) {
  setTimeout(() => {
    this.unlockWithBiometric();
  }, 500);
}
```

## Supported Platforms

| Platform | Support | Method |
|----------|---------|--------|
| **macOS** (Touch ID) | ✅ Yes | MacBook with Touch Bar |
| **macOS** (Face ID) | ✅ Yes | iMac 24-inch with Face ID |
| **macOS** (Apple Watch) | ✅ Yes | Auto-unlock if configured |
| **Windows** | ⚠️ Partial | Windows Hello (keytar only) |
| **Linux** | ❌ No | Not supported |

## Dependencies

```json
{
  "keytar": "^7.9.0",
  "node-mac-auth": "^1.1.0"
}
```

### Installation

```bash
npm install keytar node-mac-auth
npm run rebuild  # Rebuilds native modules for Electron
```

**Rebuild Script**:
```json
{
  "rebuild": "electron-rebuild -f -w better-sqlite3 -w keytar -w node-mac-auth"
}
```

## API Reference

### BiometricService (Angular)

```typescript
class BiometricService {
  // Check if biometrics available
  async isAvailable(): Promise<{ available: boolean; type: string }>

  // Check if password exists (no prompt)
  async hasPassword(userId: string): Promise<boolean>

  // Save password to keychain
  async saveMasterPassword(password: string, userId: string): Promise<boolean>

  // Get password (triggers biometric prompt)
  async getMasterPassword(userId: string): Promise<string | null>

  // Delete saved password
  async deleteMasterPassword(userId: string): Promise<boolean>

  // Clear all saved passwords
  async clearAllStoredPasswords(): Promise<boolean>
}
```

### Electron IPC Handlers

```typescript
// Check biometric availability
ipcMain.handle('biometric:isAvailable')

// Check if password exists (no prompt)
ipcMain.handle('biometric:hasPassword', userId)

// Save password
ipcMain.handle('biometric:saveMasterPassword', password, userId)

// Get password (shows Touch ID prompt)
ipcMain.handle('biometric:getMasterPassword', userId)

// Delete password
ipcMain.handle('biometric:deleteMasterPassword', userId)

// Clear all
ipcMain.handle('biometric:clearAll')
```

## Security

### Encryption Layers

1. **User's master password** → Derives encryption keys
2. **Biometric authentication** → Required to access saved password
3. **macOS Keychain encryption** → OS-level protection
4. **Electron safeStorage** → Additional encryption layer

### Zero-Knowledge Architecture

- Master password is **never sent to server**
- Password encrypted **before** storage
- Biometric data **never leaves device**
- Apple's Secure Enclave handles biometrics

## Troubleshooting

### Touch ID Not Working

**Check if module loaded:**
```bash
# In Electron console
✅ [ELECTRON] node-mac-auth loaded successfully
👆 [ELECTRON] Touch ID available: true
```

**Rebuild native modules:**
```bash
npm run rebuild
```

**Check file permissions:**
```bash
ls -la ~/Library/Application\ Support/password-sync-desktop/secure/
```

### "No saved password found"

**Check if password file exists:**
```bash
ls ~/Library/Application\ Support/password-sync-desktop/secure/
# Should see: password-default-user.enc
```

**Check console logs:**
- `🔍 [ELECTRON] Password check for userId: default-user → true`
- `📂 [ELECTRON] File exists: true`

### Biometric Prompt Not Appearing

**Check platform:**
- Only works on macOS
- Requires Touch ID or Face ID hardware

**Check permissions:**
- System Preferences → Security & Privacy → Privacy
- Ensure app has access to Touch ID

## Future Enhancements

- [ ] Windows Hello integration (full support)
- [ ] Linux fingerprint reader support
- [ ] Biometric re-authentication timeout
- [ ] Multiple user profiles
- [ ] Biometric preferences in settings
- [ ] Fallback to system password on biometric failure

## References

- [node-mac-auth Documentation](https://www.npmjs.com/package/node-mac-auth)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [keytar](https://www.npmjs.com/package/keytar)
- [macOS LocalAuthentication](https://developer.apple.com/documentation/localauthentication)

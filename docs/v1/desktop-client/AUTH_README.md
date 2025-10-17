# Authentication & Biometric Services

This directory contains authentication and biometric unlock functionality for the desktop client.

## Files

### `biometric.service.ts`
Handles OS-level biometric authentication (Touch ID, Face ID, Windows Hello).

**Key Methods:**
- `isAvailable()` - Check if biometric auth is supported
- `saveMasterPassword(password, userId)` - Save to OS keychain
- `getMasterPassword(userId)` - Retrieve from OS keychain (triggers biometric prompt)
- `deleteMasterPassword(userId)` - Remove from keychain
- `clearAllStoredPasswords()` - Clear all saved passwords

**Platform Support:**
- ✅ **macOS**: Touch ID / Face ID (via Keychain)
- ✅ **Windows**: Windows Hello (via Credential Manager)
- ❌ **Linux**: Not supported (fallback to master password only)

## How It Works

### Electron Main Process
```
electron/biometric-handler.ts
└─> Uses 'keytar' npm package
    └─> Accesses OS keychain APIs
        ├─ macOS: Security.framework
        ├─ Windows: Credential Manager
        └─ Linux: libsecret (limited)
```

### Angular Renderer Process
```
src/app/core/auth/biometric.service.ts
└─> Calls window.electron.biometric (IPC bridge)
    └─> electron/preload.ts exposes biometric API
        └─> Invokes electron/biometric-handler.ts
```

## Usage Example

```typescript
import { BiometricService } from '@core/auth/biometric.service';

constructor(private biometric: BiometricService) {}

async unlockVault() {
  // Check if biometric is available
  const { available, type } = await this.biometric.isAvailable();
  
  if (available) {
    // Try to get saved password (triggers biometric prompt)
    const password = await this.biometric.getMasterPassword('user-123');
    
    if (password) {
      // User authenticated with biometric!
      await this.unlockWithPassword(password);
    }
  } else {
    // Fall back to manual password entry
    this.showPasswordPrompt();
  }
}

async savePasswordForBiometric(password: string) {
  const success = await this.biometric.saveMasterPassword(password, 'user-123');
  if (success) {
    console.log('Password saved to keychain');
  }
}
```

## Security Notes

1. **Master password is encrypted by OS** - The OS keychain encrypts the password using hardware-backed keys
2. **Biometric required for retrieval** - User must authenticate with Touch ID/Face ID/Windows Hello
3. **No password in memory** - Password is only retrieved when needed and cleared after use
4. **User controls storage** - User can opt-out of saving to keychain

## Testing

Run tests:
```bash
npm test -- --include='**/biometric.service.spec.ts'
```

See `biometric.service.spec.ts` for test cases.

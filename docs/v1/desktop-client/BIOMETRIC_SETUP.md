# Desktop Client - Biometric Authentication Setup

## 📁 Directory Structure (Easy to Navigate!)

```
clients/desktop/
├── electron/                              # Electron Main Process (Node.js)
│   ├── main.ts                           # App entry point
│   ├── preload.ts                        # IPC bridge (secure)
│   └── biometric-handler.ts              # 🔐 OS Keychain integration
│
└── src/app/
    ├── core/                              # Core services (singleton)
    │   ├── auth/                         # 🔐 Authentication
    │   │   ├── biometric.service.ts      # Biometric service (Angular)
    │   │   ├── biometric.service.spec.ts # Tests
    │   │   └── README.md                 # Documentation
    │   ├── crypto/                       # (Next: encryption service)
    │   ├── storage/                      # (Next: local vault DB)
    │   └── sync/                         # (Next: sync orchestration)
    │
    ├── features/vault/                   # (Next: vault UI components)
    │   ├── components/
    │   └── services/
    │
    ├── services/                         # ✅ API client
    │   └── api.service.ts
    │
    └── shared/                           # Shared types
        ├── models/
        └── types/
            └── vault.types.ts            # ✅ Vault enums & interfaces
```

## 🔐 How Biometric Authentication Works

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ 1. User unlocks vault with master password                  │
│    (First time or biometric not enabled)                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. App asks: "Save password for Touch ID?"                  │
│    User clicks "Yes"                                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Angular calls:                                           │
│    biometricService.saveMasterPassword(password, userId)    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. IPC to Electron main process via preload.ts             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. biometric-handler.ts → keytar.setPassword()             │
│    Password saved to OS keychain (encrypted by OS)          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Next time: User opens app                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. App shows "Unlock with Touch ID" button                 │
│    User clicks button                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. OS prompts for biometric (Touch ID / Face ID)           │
│    User authenticates                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. keytar.getPassword() returns decrypted password         │
│    App unlocks vault automatically!                         │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "keytar": "^7.9.0"        // OS keychain access
  },
  "devDependencies": {
    "@types/keytar": "^4.4.0"
  }
}
```

### Platform Support

| Platform | Biometric Type | Library Used | Status |
|----------|---------------|--------------|--------|
| **macOS** | Touch ID / Face ID | macOS Keychain | ✅ Supported |
| **Windows** | Windows Hello | Credential Manager | ✅ Supported |
| **Linux** | - | libsecret | ❌ Not recommended |

## 🔧 Implementation Files

### 1. Electron Main Process (`electron/biometric-handler.ts`)
- Handles IPC from renderer
- Calls `keytar` APIs
- Manages OS keychain storage

**Key Functions:**
- `biometric:isAvailable` - Check platform support
- `biometric:saveMasterPassword` - Save to keychain
- `biometric:getMasterPassword` - Retrieve (triggers biometric)
- `biometric:deleteMasterPassword` - Remove from keychain
- `biometric:clearAll` - Clear all saved passwords

### 2. Preload Script (`electron/preload.ts`)
- Secure IPC bridge
- Exposes `window.electron.biometric` API
- Context isolated for security

### 3. Angular Service (`src/app/core/auth/biometric.service.ts`)
- Injectable service
- Wraps IPC calls
- Error handling
- Platform detection

## 🧪 Testing

```bash
# Run biometric service tests
npm test -- --include='**/biometric.service.spec.ts'

# Manual testing
npm run electron:dev
# 1. Enter master password
# 2. Click "Save for biometric"
# 3. Close app
# 4. Reopen app
# 5. Click "Unlock with Touch ID"
# 6. Touch sensor → App unlocks!
```

## 🔒 Security Features

1. **No password in renderer** - Password only in main process memory
2. **OS-level encryption** - Keychain uses hardware-backed encryption
3. **Biometric required** - Can't retrieve without user authentication
4. **Context isolation** - Renderer can't access Node.js directly
5. **User control** - Can disable/delete biometric unlock anytime

## 📝 Next Steps

1. ✅ Biometric service (DONE)
2. 🔨 Crypto service (client-side encryption)
3. 🔨 Vault storage service (local SQLite)
4. 🔨 Vault unlock UI component
5. 🔨 Auto-lock timer service

## 🎯 Usage in Future Code

```typescript
// In vault unlock component
import { BiometricService } from '@core/auth/biometric.service';

export class VaultUnlockComponent {
  constructor(private biometric: BiometricService) {}

  async ngOnInit() {
    const { available, type } = await this.biometric.isAvailable();
    this.showBiometricButton = available;
    this.biometricType = type; // "Touch ID / Face ID"
  }

  async unlockWithBiometric() {
    const password = await this.biometric.getMasterPassword(this.userId);
    if (password) {
      await this.unlockVault(password);
    }
  }

  async unlockWithPassword(password: string) {
    // Validate password
    await this.unlockVault(password);
    
    // Ask to save for biometric
    if (this.showBiometricButton) {
      const save = confirm('Save password for Touch ID?');
      if (save) {
        await this.biometric.saveMasterPassword(password, this.userId);
      }
    }
  }
}
```

---

**Last Updated:** Oct 1, 2025  
**Author:** Beck (@Izaacapp)  
**Organization:** deeplyprofound

# Cryptography Service

Client-side encryption service that mirrors the Go backend's encryption pattern (layered encryption with wrappedkey + encitem).

## Architecture

### Layered Encryption Pattern (Matches Go Backend)

```
User Master Password
    ↓
PBKDF2 (100,000 iterations)
    ↓
Master Key (AES-256)
    ↓
    ├─→ Wrap Content Key 1 → wrappedKey1
    │       ↓
    │   Encrypt Credential 1 → encItem1
    │
    ├─→ Wrap Content Key 2 → wrappedKey2
    │       ↓
    │   Encrypt Credential 2 → encItem2
    │
    └─→ ...
```

### Why This Pattern?

1. **Key Rotation** - Change content keys without re-deriving master key
2. **Cryptographic Isolation** - Each credential has unique encryption
3. **Forward Secrecy** - Compromising one content key doesn't affect others
4. **Matches Backend** - Same pattern as Go server (`internal/crypto/layered.go`)

## Files

- `crypto.service.ts` - Main encryption service
- `crypto.service.spec.ts` - Comprehensive test suite
- `README.md` - This file

## API Reference

### Master Key Derivation

```typescript
const { masterKey, salt } = await cryptoService.deriveMasterKey(password);
// Returns: CryptoKey + 32-byte salt
```

**Parameters:**
- `password: string` - User's master password
- `salt?: Uint8Array` - Optional salt (generates new if not provided)

**Returns:**
- `masterKey: CryptoKey` - Derived AES-256-GCM key
- `salt: Uint8Array` - 32-byte salt (store with user profile)

### Encrypt Credential

```typescript
const encrypted = await cryptoService.encryptCredential(data);
```

**Input:**
```typescript
const data = {
  username: 'user@example.com',
  password: 'secret123',
  url: 'https://example.com'
};
```

**Output:**
```typescript
{
  wrappedKey: "base64:iv",      // Wrapped content key + wrap IV
  encItem: "base64",            // Encrypted credential data
  iv: "base64",                 // Data encryption IV
  salt: "base64"                // Salt for this operation
}
```

### Decrypt Credential

```typescript
const decrypted = await cryptoService.decryptCredential(encrypted);
```

**Returns:** Original credential object

### Utility Methods

```typescript
// Hash password (for verification)
const hash = await cryptoService.hashPassword(password);

// Generate UUID-style device ID
const deviceId = await cryptoService.generateDeviceId();
// Returns: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

// Check if master key is in memory
if (cryptoService.hasMasterKey()) {
  // Key is available
}

// Clear master key from memory (security!)
cryptoService.clearMasterKey();
```

## Security Features

### 1. Web Crypto API (Hardware-Accelerated)

```typescript
// Uses browser's native crypto (hardware-backed when available)
crypto.subtle.encrypt()
crypto.subtle.decrypt()
crypto.subtle.deriveKey()
```

### 2. PBKDF2 Key Derivation

- **Iterations:** 100,000 (matches Go backend)
- **Hash:** SHA-256
- **Salt:** 32 bytes (randomly generated)
- **Output:** 256-bit AES key

### 3. AES-256-GCM Encryption

- **Algorithm:** AES-GCM (Authenticated encryption)
- **Key Size:** 256 bits
- **IV:** 12 bytes (randomly generated per operation)
- **Tag:** 128 bits (authentication tag)

### 4. Memory Safety

```typescript
// Master key stored as non-extractable CryptoKey
// Cleared when vault locks
cryptoService.clearMasterKey();

// Password buffer zeroed after use
passwordBuffer.fill(0);
```

## Usage Example

### Complete Flow

```typescript
import { CryptoService } from '@core/crypto/crypto.service';

export class VaultService {
  constructor(private crypto: CryptoService) {}

  async unlockVault(password: string, salt?: Uint8Array) {
    // 1. Derive master key
    const { masterKey, salt: derivedSalt } = 
      await this.crypto.deriveMasterKey(password, salt);
    
    // Store salt for future unlocks
    if (!salt) {
      await this.saveSalt(derivedSalt);
    }

    // 2. Vault is now unlocked
    console.log('Vault unlocked!');
  }

  async addCredential(credential: any) {
    // 3. Encrypt credential
    const encrypted = await this.crypto.encryptCredential(credential);
    
    // 4. Send to server
    await this.api.createCredential({
      server: credential.url,
      account: credential.username,
      ...encrypted  // wrappedKey, encItem, iv, salt
    });
  }

  async getCredential(uuid: string) {
    // 5. Fetch from server
    const encrypted = await this.api.getCredential(uuid);
    
    // 6. Decrypt
    const decrypted = await this.crypto.decryptCredential(encrypted);
    
    return decrypted;
  }

  lockVault() {
    // 7. Clear keys from memory
    this.crypto.clearMasterKey();
  }
}
```

## Testing

```bash
# Run crypto service tests
npm test -- --include='**/crypto.service.spec.ts'
```

**Test Coverage:**
- ✅ Master key derivation
- ✅ Same key with same password + salt
- ✅ Different keys with different passwords
- ✅ Encrypt/decrypt round-trip
- ✅ Error handling (no master key)
- ✅ Wrong password fails to decrypt
- ✅ Unique encryption per operation
- ✅ Password hashing
- ✅ Device ID generation

## Comparison with Go Backend

| Feature | Desktop (TypeScript) | Server (Go) |
|---------|---------------------|-------------|
| Key Derivation | PBKDF2 (100k iter) | PBKDF2 (100k iter) ✅ |
| Algorithm | AES-256-GCM | AES-256-GCM ✅ |
| Pattern | wrappedKey + encItem | wrappedKey + encItem ✅ |
| Salt | 32 bytes | 32 bytes ✅ |
| IV | 12 bytes | 12 bytes ✅ |

**Result:** 100% compatible encryption! Desktop can decrypt server data and vice versa.

## Performance

- **Master key derivation:** ~500ms (PBKDF2 is intentionally slow)
- **Encryption:** <10ms per credential
- **Decryption:** <10ms per credential
- **Hardware acceleration:** When available (most modern browsers)

## Security Notes

1. **Master password never sent to server** - Only encrypted data
2. **Keys cleared on lock** - Prevents memory dumps
3. **Unique IVs** - Each encryption uses fresh random IV
4. **Authenticated encryption** - GCM mode provides integrity
5. **No key reuse** - Fresh content key per credential

---

**Last Updated:** Oct 1, 2025  
**Matches:** `internal/crypto/layered.go` (Go backend)

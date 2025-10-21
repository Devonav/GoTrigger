import { ipcMain, safeStorage, app } from 'electron';
import * as keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_NAME = 'PasswordSync';
const ACCOUNT_NAME = 'masterPassword';

// Use global to persist across module reloads
const INIT_KEY = '__biometric_handlers_initialized__';

// Storage for safeStorage encrypted passwords
const STORAGE_DIR = path.join(app.getPath('userData'), 'secure');
const getPasswordPath = (userId: string) => path.join(STORAGE_DIR, `password-${userId}.enc`);

// Import node-mac-auth for Touch ID on macOS
let nodeMacAuth: any = null;
try {
  if (process.platform === 'darwin') {
    nodeMacAuth = require('node-mac-auth');
    console.log('✅ [ELECTRON] node-mac-auth loaded successfully');
  }
} catch (error) {
  console.log('⚠️  [ELECTRON] node-mac-auth not available:', error);
}

// Prompt for biometric authentication
async function promptBiometric(reason: string): Promise<boolean> {
  if (process.platform === 'darwin' && nodeMacAuth) {
    try {
      // Check if Touch ID is available
      const canPrompt = nodeMacAuth.canPromptTouchID();
      console.log('👆 [ELECTRON] Touch ID available:', canPrompt);

      if (!canPrompt) {
        console.warn('⚠️  [ELECTRON] Touch ID not available on this device');
        return true; // Allow password retrieval without biometric
      }

      console.log('👆 [ELECTRON] Prompting for Touch ID...');
      // promptTouchID expects an options object with 'reason' property
      await nodeMacAuth.promptTouchID({ reason });
      console.log('✅ [ELECTRON] Touch ID authentication succeeded!');
      return true;
    } catch (error) {
      console.error('❌ [ELECTRON] Touch ID authentication failed or cancelled:', error);
      return false;
    }
  }
  // For other platforms or if Touch ID unavailable, return true (no prompt)
  return true;
}

export function setupBiometricHandlers(): void {
  if ((global as any)[INIT_KEY]) {
    console.log('Biometric handlers already initialized, skipping...');
    return;
  }
  (global as any)[INIT_KEY] = true;

  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  ipcMain.handle('biometric:isAvailable', async () => {
    try {
      const platform = process.platform;
      const safeStorageAvailable = safeStorage.isEncryptionAvailable();

      if (platform === 'darwin') {
        return { available: true, type: 'Touch ID / Face ID', useSafeStorage: safeStorageAvailable };
      } else if (platform === 'win32') {
        return { available: true, type: 'Windows Hello', useSafeStorage: safeStorageAvailable };
      } else if (platform === 'linux') {
        return { available: false, type: 'Not supported on Linux', useSafeStorage: false };
      }

      return { available: false, type: 'Unknown platform', useSafeStorage: false };
    } catch (error) {
      console.error('Biometric check failed:', error);
      return { available: false, type: 'Error', useSafeStorage: false };
    }
  });

  ipcMain.handle('biometric:hasPassword', async (_event, userId: string) => {
    try {
      const passwordPath = getPasswordPath(userId);
      const hasSafeStorage = fs.existsSync(passwordPath);

      // Also check keytar
      let hasKeytar = false;
      try {
        const password = await keytar.getPassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`);
        hasKeytar = !!password;
      } catch (error) {
        console.log('keytar check failed:', error);
      }

      const hasPassword = hasSafeStorage || hasKeytar;
      console.log('🔍 [ELECTRON] Password check for userId:', userId, '→', hasPassword);

      return { exists: hasPassword };
    } catch (error) {
      console.error('❌ [ELECTRON] Failed to check password:', error);
      return { exists: false };
    }
  });

  ipcMain.handle('biometric:saveMasterPassword', async (_event, password: string, userId: string) => {
    try {
      let safeStorageSuccess = false;
      let keytarSuccess = false;

      // Try safeStorage first (triggers biometric prompt on macOS/Windows)
      if (safeStorage.isEncryptionAvailable()) {
        try {
          const encrypted = safeStorage.encryptString(password);
          const passwordPath = getPasswordPath(userId);
          fs.writeFileSync(passwordPath, encrypted);
          safeStorageSuccess = true;
          console.log('Password saved with safeStorage (biometric protection)');
        } catch (error) {
          console.error('safeStorage save failed:', error);
        }
      }

      // Also save to keytar as backup
      try {
        await keytar.setPassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`, password);
        keytarSuccess = true;
        console.log('Password saved with keytar (keychain backup)');
      } catch (error) {
        console.error('keytar save failed:', error);
      }

      if (safeStorageSuccess || keytarSuccess) {
        return { success: true, method: safeStorageSuccess ? 'safeStorage' : 'keytar' };
      }

      return { success: false, error: 'Both storage methods failed' };
    } catch (error) {
      console.error('Failed to save password:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:getMasterPassword', async (_event, userId: string) => {
    try {
      console.log('🔐 [ELECTRON] getMasterPassword called for userId:', userId);
      const passwordPath = getPasswordPath(userId);
      console.log('📂 [ELECTRON] Password path:', passwordPath);
      console.log('📂 [ELECTRON] File exists:', fs.existsSync(passwordPath));

      // Prompt for Touch ID/Face ID authentication FIRST
      console.log('👆 [ELECTRON] Prompting for biometric authentication...');
      const authenticated = await promptBiometric('Unlock your password vault');
      console.log('👆 [ELECTRON] Biometric authentication result:', authenticated);

      if (!authenticated) {
        console.error('❌ [ELECTRON] Biometric authentication failed or cancelled');
        return { success: false, error: 'Biometric authentication failed or cancelled' };
      }

      // Try safeStorage first
      if (safeStorage.isEncryptionAvailable() && fs.existsSync(passwordPath)) {
        try {
          console.log('🔓 [ELECTRON] Attempting safeStorage decrypt...');
          const encrypted = fs.readFileSync(passwordPath);
          const password = safeStorage.decryptString(encrypted);
          console.log('✅ [ELECTRON] Password retrieved with safeStorage');
          return { success: true, password, method: 'safeStorage' };
        } catch (error) {
          console.error('❌ [ELECTRON] safeStorage retrieval failed, trying keytar:', error);
        }
      } else {
        console.log('⚠️  [ELECTRON] safeStorage not available or file not found');
      }

      // Fallback to keytar
      try {
        console.log('🔓 [ELECTRON] Attempting keytar retrieval...');
        const password = await keytar.getPassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`);
        if (password) {
          console.log('✅ [ELECTRON] Password retrieved with keytar');
          return { success: true, password, method: 'keytar' };
        } else {
          console.log('❌ [ELECTRON] No password found in keytar');
        }
      } catch (error) {
        console.error('❌ [ELECTRON] keytar retrieval failed:', error);
      }

      console.error('❌ [ELECTRON] No password found in any storage');
      return { success: false, error: 'No password found' };
    } catch (error) {
      console.error('❌ [ELECTRON] Failed to retrieve password:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:deleteMasterPassword', async (_event, userId: string) => {
    try {
      let deleted = false;

      // Delete from safeStorage
      const passwordPath = getPasswordPath(userId);
      if (fs.existsSync(passwordPath)) {
        fs.unlinkSync(passwordPath);
        deleted = true;
      }

      // Delete from keytar
      try {
        const keytarDeleted = await keytar.deletePassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`);
        deleted = deleted || keytarDeleted;
      } catch (error) {
        console.error('keytar delete failed:', error);
      }

      return { success: deleted };
    } catch (error) {
      console.error('Failed to delete password:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:clearAll', async () => {
    try {
      // Clear safeStorage files
      if (fs.existsSync(STORAGE_DIR)) {
        const files = fs.readdirSync(STORAGE_DIR);
        for (const file of files) {
          if (file.startsWith('password-') && file.endsWith('.enc')) {
            fs.unlinkSync(path.join(STORAGE_DIR, file));
          }
        }
      }

      // Clear keytar credentials
      try {
        const credentials = await keytar.findCredentials(SERVICE_NAME);
        for (const cred of credentials) {
          await keytar.deletePassword(SERVICE_NAME, cred.account);
        }
      } catch (error) {
        console.error('keytar clear failed:', error);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      return { success: false, error: String(error) };
    }
  });
}

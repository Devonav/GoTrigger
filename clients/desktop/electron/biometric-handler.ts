import { ipcMain } from 'electron';
import * as keytar from 'keytar';

const SERVICE_NAME = 'PasswordSync';
const ACCOUNT_NAME = 'masterPassword';

// Use global to persist across module reloads
const INIT_KEY = '__biometric_handlers_initialized__';

export function setupBiometricHandlers(): void {
  if ((global as any)[INIT_KEY]) {
    console.log('Biometric handlers already initialized, skipping...');
    return;
  }
  (global as any)[INIT_KEY] = true;

  ipcMain.handle('biometric:isAvailable', async () => {
    try {
      const platform = process.platform;
      
      if (platform === 'darwin') {
        return { available: true, type: 'Touch ID / Face ID' };
      } else if (platform === 'win32') {
        return { available: true, type: 'Windows Hello' };
      } else if (platform === 'linux') {
        return { available: false, type: 'Not supported on Linux' };
      }
      
      return { available: false, type: 'Unknown platform' };
    } catch (error) {
      console.error('Biometric check failed:', error);
      return { available: false, type: 'Error' };
    }
  });

  ipcMain.handle('biometric:saveMasterPassword', async (_event, password: string, userId: string) => {
    try {
      await keytar.setPassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`, password);
      return { success: true };
    } catch (error) {
      console.error('Failed to save to keychain:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:getMasterPassword', async (_event, userId: string) => {
    try {
      const password = await keytar.getPassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`);
      
      if (password) {
        return { success: true, password };
      } else {
        return { success: false, error: 'No password found' };
      }
    } catch (error) {
      console.error('Failed to retrieve from keychain:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:deleteMasterPassword', async (_event, userId: string) => {
    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, `${ACCOUNT_NAME}-${userId}`);
      return { success: deleted };
    } catch (error) {
      console.error('Failed to delete from keychain:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('biometric:clearAll', async () => {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      
      for (const cred of credentials) {
        await keytar.deletePassword(SERVICE_NAME, cred.account);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to clear keychain:', error);
      return { success: false, error: String(error) };
    }
  });
}

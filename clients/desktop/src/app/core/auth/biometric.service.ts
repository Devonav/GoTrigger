import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BiometricService {
  private get biometric() {
    if (!window.electron?.biometric) {
      throw new Error('Electron biometric API not available');
    }
    return window.electron.biometric;
  }

  async isAvailable(): Promise<{ available: boolean; type: string }> {
    try {
      return await this.biometric.isAvailable();
    } catch (error) {
      console.error('Biometric check failed:', error);
      return { available: false, type: 'Error' };
    }
  }

  async hasPassword(userId: string): Promise<boolean> {
    try {
      const result = await this.biometric.hasPassword(userId);
      return result.exists;
    } catch (error) {
      console.error('Check password error:', error);
      return false;
    }
  }

  async saveMasterPassword(password: string, userId: string): Promise<boolean> {
    try {
      const result = await this.biometric.saveMasterPassword(password, userId);
      if (!result.success) {
        console.error('Failed to save to keychain:', result.error);
      }
      return result.success;
    } catch (error) {
      console.error('Save master password error:', error);
      return false;
    }
  }

  async getMasterPassword(userId: string): Promise<string | null> {
    try {
      const result = await this.biometric.getMasterPassword(userId);
      if (result.success && result.password) {
        return result.password;
      }
      return null;
    } catch (error) {
      console.error('Get master password error:', error);
      return null;
    }
  }

  async deleteMasterPassword(userId: string): Promise<boolean> {
    try {
      const result = await this.biometric.deleteMasterPassword(userId);
      return result.success;
    } catch (error) {
      console.error('Delete master password error:', error);
      return false;
    }
  }

  async clearAllStoredPasswords(): Promise<boolean> {
    try {
      const result = await this.biometric.clearAll();
      return result.success;
    } catch (error) {
      console.error('Clear all passwords error:', error);
      return false;
    }
  }

  getBiometricName(): string {
    const platform = navigator.platform.toLowerCase();
    
    if (platform.includes('mac')) {
      return 'Touch ID / Face ID';
    } else if (platform.includes('win')) {
      return 'Windows Hello';
    } else {
      return 'Biometric Authentication';
    }
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { TripleLayerCryptoService } from '../../../../core/crypto/triple-layer-crypto.service';
import { TripleLayerStorageService } from '../../../../core/storage/triple-layer-storage.service';
import { VaultService } from '../../services/vault.service';
import { SessionStorageService } from '../../../../core/storage/session-storage.service';

@Component({
  selector: 'app-unlock-vault',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unlock-vault.component.html',
  styleUrls: ['./unlock-vault.component.scss']
})
export class UnlockVaultComponent implements OnInit {
  masterPassword = '';
  isUnlocking = signal(false);
  errorMessage = signal('');
  biometricAvailable = signal(false);
  biometricType = signal('');
  showPassword = signal(false);

  private readonly USER_ID = 'default-user';

  constructor(
    private biometric: BiometricService,
    private crypto: TripleLayerCryptoService,
    private storage: TripleLayerStorageService,
    private vaultService: VaultService,
    private sessionStorage: SessionStorageService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      // Check if user is logged in first
      if (!this.sessionStorage.hasValidSession()) {
        console.log('❌ No valid session found. Redirecting to login...');
        this.router.navigate(['/auth/login']);
        return;
      }

      await this.storage.initialize();

      // Check if vault is initialized - if not, redirect to setup
      const vaultInitialized = await this.storage.getConfig('vault_initialized');
      if (!vaultInitialized) {
        this.router.navigate(['/vault/setup']);
        return;
      }

      const { available, type } = await this.biometric.isAvailable();
      console.log('🔍 Biometric check:', { available, type });
      this.biometricAvailable.set(available);
      this.biometricType.set(type);

      // Check if password exists WITHOUT triggering biometric prompt
      const hasSavedPassword = await this.biometric.hasPassword(this.USER_ID);
      console.log('🔑 Checking for saved password:', hasSavedPassword ? 'Found' : 'Not found');

      // Auto-prompt for biometric unlock if password is saved and biometrics available
      if (hasSavedPassword && available) {
        console.log('🚀 Auto-prompting Touch ID for returning user...');
        // Small delay to let UI render first
        setTimeout(() => {
          this.unlockWithBiometric();
        }, 500);
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.errorMessage.set('Failed to initialize vault');
    }
  }

  async unlockWithPassword() {
    if (!this.masterPassword.trim()) {
      this.errorMessage.set('Please enter your master password');
      return;
    }

    this.isUnlocking.set(true);
    this.errorMessage.set('');

    try {
      const salt = await this.getSalt();
      const isFirstTime = !salt;
      console.log('🔐 Unlock: Retrieved salt:', salt ? `${salt.length} bytes` : 'NONE (first time)');

      const result = await this.crypto.deriveMasterKey(this.masterPassword, salt);
      console.log('🔐 Unlock: Master key derived successfully');

      if (isFirstTime) {
        await this.saveSalt(result.salt);
        await this.savePasswordVerification();
      } else {
        const isValid = await this.verifyPassword();
        if (!isValid) {
          this.errorMessage.set('Incorrect master password');
          this.crypto.clearMasterKey();
          this.isUnlocking.set(false);
          this.masterPassword = '';
          return;
        }
      }

      // Auto-save password for biometric unlock if available
      if (this.biometricAvailable()) {
        console.log('💾 Auto-saving password to keychain for userId:', this.USER_ID);
        const saved = await this.biometric.saveMasterPassword(this.masterPassword, this.USER_ID);
        if (saved) {
          console.log('✅ Password saved to keychain successfully');
        } else {
          console.error('❌ Failed to save password to keychain');
        }
      }

      this.onVaultUnlocked();
    } catch (error) {
      console.error('Unlock failed:', error);
      this.errorMessage.set('Invalid password or sync failed');
      this.crypto.clearMasterKey();
    } finally {
      this.isUnlocking.set(false);
      this.masterPassword = '';
    }
  }

  async unlockWithBiometric() {
    console.log('🔐 Attempting biometric unlock for userId:', this.USER_ID);

    if (!this.biometricAvailable()) {
      this.errorMessage.set('Biometric authentication not available');
      return;
    }

    this.isUnlocking.set(true);
    this.errorMessage.set('');

    try {
      console.log('📱 Requesting password from keychain...');
      const password = await this.biometric.getMasterPassword(this.USER_ID);

      if (!password) {
        console.error('❌ No saved password found in keychain');
        this.errorMessage.set('No saved password found. Please unlock with master password first.');
        this.isUnlocking.set(false);
        return;
      }

      console.log('✅ Password retrieved from keychain');
      const salt = await this.getSalt();
      console.log('🔐 Biometric Unlock: Retrieved salt:', salt ? `${salt.length} bytes` : 'NONE');
      await this.crypto.deriveMasterKey(password, salt);
      console.log('🔐 Biometric Unlock: Master key derived successfully');

      this.onVaultUnlocked();
    } catch (error) {
      console.error('❌ Biometric unlock failed:', error);
      this.errorMessage.set('Biometric authentication failed');
      this.crypto.clearMasterKey();
    } finally {
      this.isUnlocking.set(false);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  private async getSalt(): Promise<Uint8Array | undefined> {
    const saltB64 = await this.storage.getConfig('master_salt');
    
    if (saltB64) {
      const binaryString = atob(saltB64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    
    return undefined;
  }

  private async saveSalt(salt: Uint8Array) {
    const saltB64 = btoa(String.fromCharCode(...Array.from(salt)));
    await this.storage.setConfig('master_salt', saltB64);
    console.log('💾 Saved salt to storage:', salt.length, 'bytes');
  }

  private async savePasswordVerification() {
    const testData = { password: 'verification_test', notes: `${Date.now()}` };
    const contentKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const encrypted = await this.crypto.encryptCredentialData(testData, contentKey);
    
    const verificationBlob = {
      wrappedKey: btoa(String.fromCharCode(...Array.from(encrypted.wrappedKey))),
      encItem: btoa(String.fromCharCode(...Array.from(encrypted.encItem))),
      iv: btoa(String.fromCharCode(...Array.from(encrypted.iv)))
    };
    
    await this.storage.setConfig('password_verification', JSON.stringify(verificationBlob));
  }

  private async verifyPassword(): Promise<boolean> {
    try {
      const verificationData = await this.storage.getConfig('password_verification');
      if (!verificationData) {
        return false;
      }

      const blob = JSON.parse(verificationData);
      const wrappedKey = new Uint8Array(atob(blob.wrappedKey).split('').map(c => c.charCodeAt(0)));
      const encItem = new Uint8Array(atob(blob.encItem).split('').map(c => c.charCodeAt(0)));
      const iv = new Uint8Array(atob(blob.iv).split('').map(c => c.charCodeAt(0)));
      
      const decrypted = await this.crypto.decryptCredentialData(wrappedKey, encItem, iv);
      
      return decrypted.password === 'verification_test';
    } catch (error) {
      return false;
    }
  }

  private async onVaultUnlocked() {
    console.log('Vault unlocked successfully');
    this.router.navigate(['/vault/list']);
  }
}

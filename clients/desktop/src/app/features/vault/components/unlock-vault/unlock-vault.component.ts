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
  rememberPassword = signal(false);
  isFirstTimeSetup = signal(false);

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
      await this.storage.initialize();
      
      // Check if vault is initialized - if not, redirect to setup
      const vaultInitialized = await this.storage.getConfig('vault_initialized');
      if (!vaultInitialized) {
        this.router.navigate(['/vault/setup']);
        return;
      }
      
      const { available, type } = await this.biometric.isAvailable();
      this.biometricAvailable.set(available);
      this.biometricType.set(type);

      const hasSavedPassword = await this.biometric.getMasterPassword(this.USER_ID);
      if (hasSavedPassword && available) {
        this.rememberPassword.set(true);
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

      await this.crypto.deriveMasterKey(this.masterPassword, salt);

      if (isFirstTime) {
        await this.saveSalt();
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

      if (this.rememberPassword() && this.biometricAvailable()) {
        await this.biometric.saveMasterPassword(this.masterPassword, this.USER_ID);
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
    if (!this.biometricAvailable()) {
      this.errorMessage.set('Biometric authentication not available');
      return;
    }

    this.isUnlocking.set(true);
    this.errorMessage.set('');

    try {
      const password = await this.biometric.getMasterPassword(this.USER_ID);
      
      if (!password) {
        this.errorMessage.set('No saved password found. Please unlock with master password first.');
        this.isUnlocking.set(false);
        return;
      }

      const salt = await this.getSalt();
      await this.crypto.deriveMasterKey(password, salt);

      this.onVaultUnlocked();
    } catch (error) {
      console.error('Biometric unlock failed:', error);
      this.errorMessage.set('Biometric authentication failed');
      this.crypto.clearMasterKey();
    } finally {
      this.isUnlocking.set(false);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  toggleRememberPassword() {
    this.rememberPassword.update(v => !v);
    
    if (!this.rememberPassword()) {
      this.biometric.deleteMasterPassword(this.USER_ID);
    }
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

  private async saveSalt() {
    const masterKey = await this.crypto.deriveMasterKey(this.masterPassword);
    const saltB64 = btoa(String.fromCharCode(...Array.from(masterKey.salt)));
    await this.storage.setConfig('master_salt', saltB64);
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

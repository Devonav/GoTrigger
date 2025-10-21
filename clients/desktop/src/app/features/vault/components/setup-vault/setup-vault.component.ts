import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TripleLayerCryptoService } from '@core/crypto/triple-layer-crypto.service';
import { TripleLayerStorageService } from '@core/storage/triple-layer-storage.service';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

@Component({
  selector: 'app-setup-vault',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './setup-vault.component.html',
  styleUrls: ['./setup-vault.component.scss']
})
export class SetupVaultComponent implements OnInit {
  recoveryPhrase = signal<string[]>([]);
  hasConfirmed = signal(false);
  isGenerating = signal(false);
  errorMessage = signal('');

  constructor(
    private crypto: TripleLayerCryptoService,
    private storage: TripleLayerStorageService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.isGenerating.set(true);
    try {
      await this.storage.initialize();
      const phrase = await this.generateRecoveryPhrase();
      this.recoveryPhrase.set(phrase);
    } catch (error) {
      this.errorMessage.set('Failed to generate recovery phrase: ' + (error as Error).message);
      console.error('Setup error:', error);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private async generateRecoveryPhrase(): Promise<string[]> {
    try {
      // Generate 24-word mnemonic (256-bit entropy)
      const mnemonic = bip39.generateMnemonic(wordlist, 256);
      const words = mnemonic.split(' ');
      
      // Store mnemonic temporarily (will be used on confirm)
      this.tempMnemonic = mnemonic;
      
      return words;
    } catch (error) {
      console.error('Error generating recovery phrase:', error);
      throw error;
    }
  }

  private tempMnemonic: string = '';

  confirmPhrase() {
    this.hasConfirmed.set(true);
  }

  async continueToVault() {
    if (!this.tempMnemonic) {
      this.errorMessage.set('No recovery phrase found');
      return;
    }

    try {
      // Derive master key from mnemonic
      const masterKey = await this.crypto.deriveMasterKey(this.tempMnemonic);
      const saltB64 = btoa(String.fromCharCode(...Array.from(masterKey.salt)));
      await this.storage.setConfig('master_salt', saltB64);
      
      // Save verification blob
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
      
      // Mark vault as initialized
      await this.storage.setConfig('vault_initialized', 'true');
      await this.storage.setConfig('recovery_phrase_created', 'true');
      
      // Clear temp mnemonic from memory
      this.tempMnemonic = '';

      // Navigate to dashboard
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage.set('Failed to initialize vault: ' + (error as Error).message);
      console.error('Vault initialization error:', error);
    }
  }

  copyPhrase() {
    const text = this.recoveryPhrase().join(' ');
    navigator.clipboard.writeText(text);
  }

  downloadPhrase() {
    const text = this.recoveryPhrase().join(' ');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deeplyprofound-recovery-phrase.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}

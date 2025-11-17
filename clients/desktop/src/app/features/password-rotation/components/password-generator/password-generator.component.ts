import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordGeneratorService, PasswordOptions, MemorablePasswordOptions, PinOptions } from '@core/services/password-generator.service';

type PasswordType = 'random' | 'memorable' | 'pin';

@Component({
  selector: 'app-password-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-generator.component.html',
  styleUrls: ['./password-generator.component.scss']
})
export class PasswordGeneratorComponent {
  // Current password type
  passwordType = signal<PasswordType>('random');

  // Generated password
  generatedPassword = signal<string>('');

  // Password strength
  passwordStrength = signal<number>(0);
  strengthLabel = signal<string>('');
  strengthColor = signal<string>('');

  // Copy feedback
  copyFeedback = signal<boolean>(false);

  // Random password options
  randomOptions = signal<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false
  });

  // Memorable password options
  memorableOptions = signal<MemorablePasswordOptions>({
    wordCount: 4,
    separator: '-',
    capitalize: true,
    includeNumber: true
  });

  // PIN options
  pinOptions = signal<PinOptions>({
    length: 6
  });

  constructor(
    private passwordGenerator: PasswordGeneratorService,
    private router: Router
  ) {
    // Generate initial password
    this.generatePassword();
  }

  /**
   * Set password type
   */
  setPasswordType(type: PasswordType): void {
    this.passwordType.set(type);
    this.generatePassword();
  }

  /**
   * Generate password based on current type
   */
  generatePassword(): void {
    try {
      let password = '';

      switch (this.passwordType()) {
        case 'random':
          password = this.passwordGenerator.generateRandom(this.randomOptions());
          break;
        case 'memorable':
          password = this.passwordGenerator.generateMemorable(this.memorableOptions());
          break;
        case 'pin':
          password = this.passwordGenerator.generatePin(this.pinOptions());
          break;
      }

      this.generatedPassword.set(password);
      this.updateStrength(password);
    } catch (error) {
      console.error('Password generation error:', error);
      this.generatedPassword.set('');
      this.updateStrength('');
    }
  }

  /**
   * Update password strength
   */
  private updateStrength(password: string): void {
    const strength = this.passwordGenerator.calculateStrength(password);
    this.passwordStrength.set(strength);
    this.strengthLabel.set(this.passwordGenerator.getStrengthLabel(strength));
    this.strengthColor.set(this.passwordGenerator.getStrengthColor(strength));
  }

  /**
   * Update random option and regenerate
   */
  updateRandomOption(key: keyof PasswordOptions, value: any): void {
    const options = { ...this.randomOptions() };
    (options as any)[key] = value;
    this.randomOptions.set(options);
    this.generatePassword();
  }

  /**
   * Update memorable option and regenerate
   */
  updateMemorableOption(key: keyof MemorablePasswordOptions, value: any): void {
    const options = { ...this.memorableOptions() };
    (options as any)[key] = value;
    this.memorableOptions.set(options);
    this.generatePassword();
  }

  /**
   * Update PIN option and regenerate
   */
  updatePinOption(key: keyof PinOptions, value: any): void {
    const options = { ...this.pinOptions() };
    (options as any)[key] = value;
    this.pinOptions.set(options);
    this.generatePassword();
  }

  /**
   * Copy password to clipboard
   */
  async copyPassword(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedPassword());
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    } catch (error) {
      console.error('Failed to copy password:', error);
    }
  }

  /**
   * Navigate back to dashboard
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

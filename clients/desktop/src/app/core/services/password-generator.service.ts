import { Injectable } from '@angular/core';

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
}

export interface MemorablePasswordOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export interface PinOptions {
  length: number;
}

@Injectable({
  providedIn: 'root'
})
export class PasswordGeneratorService {
  private readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private readonly NUMBERS = '0123456789';
  private readonly SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  private readonly SIMILAR_CHARS = 'il1Lo0O';
  private readonly AMBIGUOUS_CHARS = '{}[]()/\\\'"`~,;:.<>';

  // Common word list for memorable passwords (EFF long wordlist subset)
  private readonly WORD_LIST = [
    'algorithm', 'bandwidth', 'calendar', 'database', 'elephant', 'firewall',
    'gateway', 'hardware', 'internet', 'keyboard', 'laptop', 'monitor',
    'network', 'optimize', 'password', 'quantum', 'register', 'software',
    'terminal', 'upload', 'virtual', 'website', 'xerox', 'youtube', 'zigzag',
    'adventure', 'beautiful', 'challenge', 'discovery', 'excellent', 'fantastic',
    'genuine', 'happiness', 'innocent', 'jubilant', 'knowledge', 'laughter',
    'magnificent', 'nightmare', 'objective', 'paradise', 'question', 'remember',
    'sunshine', 'treasure', 'umbrella', 'vacation', 'wonderful', 'xylophone',
    'yesterday', 'zeppelin', 'abstract', 'brilliant', 'creative', 'delightful',
    'energetic', 'fabulous', 'grateful', 'harmonious', 'impressive', 'joyful'
  ];

  constructor() {}

  /**
   * Generate a random password based on options
   */
  generateRandom(options: PasswordOptions): string {
    let charset = this.buildCharset(options);

    if (charset.length === 0) {
      throw new Error('At least one character type must be selected');
    }

    // Generate password
    let password = '';
    const array = new Uint32Array(options.length);
    crypto.getRandomValues(array);

    for (let i = 0; i < options.length; i++) {
      const randomIndex = array[i] % charset.length;
      password += charset[randomIndex];
    }

    // Ensure at least one character from each selected type
    password = this.ensureComplexity(password, options);

    return password;
  }

  /**
   * Generate a memorable password (passphrase)
   */
  generateMemorable(options: MemorablePasswordOptions): string {
    const words: string[] = [];

    for (let i = 0; i < options.wordCount; i++) {
      const randomIndex = this.getSecureRandomInt(0, this.WORD_LIST.length - 1);
      let word = this.WORD_LIST[randomIndex];

      if (options.capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }

      words.push(word);
    }

    let passphrase = words.join(options.separator);

    if (options.includeNumber) {
      const number = this.getSecureRandomInt(0, 9999);
      passphrase += options.separator + number;
    }

    return passphrase;
  }

  /**
   * Generate a PIN
   */
  generatePin(options: PinOptions): string {
    let pin = '';
    const array = new Uint32Array(options.length);
    crypto.getRandomValues(array);

    for (let i = 0; i < options.length; i++) {
      pin += array[i] % 10;
    }

    return pin;
  }

  /**
   * Calculate password strength (0-100)
   */
  calculateStrength(password: string): number {
    if (!password || password.length === 0) return 0;

    let score = 0;

    // Length score (up to 40 points)
    score += Math.min(password.length * 2, 40);

    // Character variety (up to 40 points)
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);

    if (hasLower) score += 10;
    if (hasUpper) score += 10;
    if (hasNumber) score += 10;
    if (hasSymbol) score += 10;

    // Entropy bonus (up to 20 points)
    const uniqueChars = new Set(password.split('')).size;
    score += Math.min(uniqueChars, 20);

    return Math.min(score, 100);
  }

  /**
   * Get strength label based on score
   */
  getStrengthLabel(score: number): string {
    if (score < 30) return 'Weak';
    if (score < 60) return 'Fair';
    if (score < 80) return 'Good';
    return 'Excellent';
  }

  /**
   * Get strength color based on score
   */
  getStrengthColor(score: number): string {
    if (score < 30) return '#ef4444'; // red
    if (score < 60) return '#f59e0b'; // orange
    if (score < 80) return '#eab308'; // yellow
    return '#22c55e'; // green
  }

  /**
   * Build character set based on options
   */
  private buildCharset(options: PasswordOptions): string {
    let charset = '';

    if (options.lowercase) charset += this.LOWERCASE;
    if (options.uppercase) charset += this.UPPERCASE;
    if (options.numbers) charset += this.NUMBERS;
    if (options.symbols) charset += this.SYMBOLS;

    // Remove similar characters if requested
    if (options.excludeSimilar) {
      charset = charset.split('').filter(c => !this.SIMILAR_CHARS.includes(c)).join('');
    }

    // Remove ambiguous characters if requested
    if (options.excludeAmbiguous) {
      charset = charset.split('').filter(c => !this.AMBIGUOUS_CHARS.includes(c)).join('');
    }

    return charset;
  }

  /**
   * Ensure password has at least one character from each selected type
   */
  private ensureComplexity(password: string, options: PasswordOptions): string {
    const chars = password.split('');
    let modified = false;

    if (options.uppercase && !/[A-Z]/.test(password)) {
      chars[this.getSecureRandomInt(0, chars.length - 1)] =
        this.UPPERCASE[this.getSecureRandomInt(0, this.UPPERCASE.length - 1)];
      modified = true;
    }

    if (options.lowercase && !/[a-z]/.test(password)) {
      chars[this.getSecureRandomInt(0, chars.length - 1)] =
        this.LOWERCASE[this.getSecureRandomInt(0, this.LOWERCASE.length - 1)];
      modified = true;
    }

    if (options.numbers && !/[0-9]/.test(password)) {
      chars[this.getSecureRandomInt(0, chars.length - 1)] =
        this.NUMBERS[this.getSecureRandomInt(0, this.NUMBERS.length - 1)];
      modified = true;
    }

    if (options.symbols && !/[^a-zA-Z0-9]/.test(password)) {
      chars[this.getSecureRandomInt(0, chars.length - 1)] =
        this.SYMBOLS[this.getSecureRandomInt(0, this.SYMBOLS.length - 1)];
      modified = true;
    }

    return modified ? chars.join('') : password;
  }

  /**
   * Get a cryptographically secure random integer between min and max (inclusive)
   */
  private getSecureRandomInt(min: number, max: number): number {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }
}

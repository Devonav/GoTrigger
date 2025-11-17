# Password Generator - 1Password Style

A feature-rich password generator for the Password Sync desktop application, inspired by 1Password's generator.

## Features

### 3 Password Types

#### 1. **Random Password**
- Cryptographically secure random generation
- Customizable length (8-64 characters)
- Character type options:
  - ✅ Uppercase letters (A-Z)
  - ✅ Lowercase letters (a-z)
  - ✅ Numbers (0-9)
  - ✅ Symbols (!@#$%^&*)
- Advanced options:
  - Exclude similar characters (i, l, 1, L, o, 0, O)
  - Exclude ambiguous symbols ({}[]()\/'"~,;:.)
- Real-time strength meter (Weak → Fair → Good → Excellent)

#### 2. **Memorable Password (Passphrase)**
- Easy-to-remember multi-word passwords
- 60+ word dictionary from EFF wordlist
- Options:
  - Word count (3-8 words)
  - Separator: Hyphen, Underscore, Period, Space, or None
  - Capitalize first letter of each word
  - Include a number at the end
- Example: `Algorithm-Beautiful-Network-7234`

#### 3. **PIN Generator**
- Numeric codes for devices
- Length: 4-12 digits
- Cryptographically secure random generation

### UI Features

- ✅ **Live Preview** - See password as you adjust options
- ✅ **Copy to Clipboard** - One-click copy with visual feedback
- ✅ **Regenerate** - Generate new password instantly
- ✅ **Strength Meter** - Color-coded security indicator
- ✅ **Responsive Design** - Works on all screen sizes
- ✅ **Dark Theme** - Matches app's premium aesthetic

## Files Included

### Core Service
- `src/app/core/services/password-generator.service.ts` - Password generation logic with Web Crypto API

### Component Files
- `src/app/features/password-rotation/components/password-generator/password-generator.component.ts` - Component logic
- `src/app/features/password-rotation/components/password-generator/password-generator.component.html` - Template
- `src/app/features/password-rotation/components/password-generator/password-generator.component.scss` - Styles

### Integration Files (Modified)
- `src/app/app.routes.ts` - Added `/password-generator` route
- `src/app/features/dashboard/components/dashboard/dashboard.component.ts` - Navigation method
- `src/app/features/dashboard/components/dashboard/dashboard.component.html` - Updated tile

## Installation

### 1. Copy Files

Extract the zip and copy files to your desktop client:

```bash
# Copy the password-rotation feature folder
cp -r password-rotation/ your-project/clients/desktop/src/app/features/

# Copy the password generator service
cp password-generator.service.ts your-project/clients/desktop/src/app/core/services/
```

### 2. Update Routes

Add to `src/app/app.routes.ts`:

```typescript
{
  path: 'password-generator',
  loadComponent: () => import('./features/password-rotation/components/password-generator/password-generator.component').then(m => m.PasswordGeneratorComponent)
}
```

### 3. Update Dashboard (Optional)

Update the Password Rotation tile in `dashboard.component.ts`:

```typescript
navigateToPasswordRotation(): void {
  this.router.navigate(['/password-generator']);
}
```

Update tile text in `dashboard.component.html`:

```html
<h3>Password Generator</h3>
<p>Generate secure passwords</p>
```

## Usage

### From Dashboard

1. Launch the desktop app
2. Navigate to Dashboard
3. Click **"Password Generator"** tile
4. Select password type (Random/Memorable/PIN)
5. Adjust options as needed
6. Click copy to clipboard

### Programmatic Usage

```typescript
import { PasswordGeneratorService } from '@core/services/password-generator.service';

constructor(private passwordGen: PasswordGeneratorService) {}

// Generate random password
const password = this.passwordGen.generateRandom({
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: false,
  excludeAmbiguous: false
});

// Generate memorable password
const passphrase = this.passwordGen.generateMemorable({
  wordCount: 4,
  separator: '-',
  capitalize: true,
  includeNumber: true
});

// Generate PIN
const pin = this.passwordGen.generatePin({
  length: 6
});

// Calculate password strength
const strength = this.passwordGen.calculateStrength(password);
const label = this.passwordGen.getStrengthLabel(strength); // "Excellent"
const color = this.passwordGen.getStrengthColor(strength); // "#22c55e"
```

## Security

### Cryptographic Randomness

The generator uses the **Web Crypto API** (`crypto.getRandomValues()`) for cryptographically secure random number generation:

```typescript
const array = new Uint32Array(options.length);
crypto.getRandomValues(array); // Hardware-backed entropy
```

### Strength Calculation

Password strength is calculated based on:
- **Length** (up to 40 points)
- **Character variety** (up to 40 points)
  - Lowercase, Uppercase, Numbers, Symbols
- **Entropy** (up to 20 points)
  - Unique character count

Total score: 0-100

### Best Practices

- ✅ Use random passwords for important accounts
- ✅ Use memorable passwords for passwords you type frequently
- ✅ Use PINs only for devices, not account passwords
- ✅ Enable "exclude similar characters" for handwritten passwords
- ✅ Minimum 12 characters for random passwords
- ✅ Minimum 4 words for memorable passwords

## Customization

### Adding Words to Dictionary

Edit `password-generator.service.ts`:

```typescript
private readonly WORD_LIST = [
  // Add your own words here
  'custom', 'words', 'here',
  // ...existing words
];
```

### Changing Colors

Edit `password-generator.component.scss`:

```scss
// Strength meter colors
.strength-fill {
  // Weak: #ef4444 (red)
  // Fair: #f59e0b (orange)
  // Good: #eab308 (yellow)
  // Excellent: #22c55e (green)
}
```

### Adjusting Length Limits

Edit `password-generator.component.html`:

```html
<!-- Random password length -->
<input type="range" min="8" max="64" ... />

<!-- Memorable word count -->
<input type="range" min="3" max="8" ... />

<!-- PIN length -->
<input type="range" min="4" max="12" ... />
```

## API Reference

### PasswordGeneratorService

#### Methods

- `generateRandom(options: PasswordOptions): string`
- `generateMemorable(options: MemorablePasswordOptions): string`
- `generatePin(options: PinOptions): string`
- `calculateStrength(password: string): number`
- `getStrengthLabel(score: number): string`
- `getStrengthColor(score: number): string`

#### Interfaces

```typescript
interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
}

interface MemorablePasswordOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

interface PinOptions {
  length: number;
}
```

## Testing

Run the app:

```bash
cd clients/desktop
npm run electron:dev
```

Navigate to: Dashboard → Password Generator

Test cases:
- ✅ Generate random password with all character types
- ✅ Toggle character type checkboxes
- ✅ Adjust length slider
- ✅ Switch to memorable password
- ✅ Change word count and separator
- ✅ Switch to PIN
- ✅ Copy to clipboard
- ✅ Regenerate multiple times
- ✅ Verify strength meter accuracy

## Troubleshooting

**Issue:** Template syntax error with curly braces

**Solution:** Curly braces in text must be escaped:
```html
<!-- Wrong -->
<span>Text with {curly} braces</span>

<!-- Correct -->
<span>Text with {{ '{' }}curly{{ '}' }} braces</span>
```

**Issue:** Service not found

**Solution:** Ensure service is in `core/services/` directory and has `providedIn: 'root'`

**Issue:** Route not working

**Solution:** Verify route is added to `app.routes.ts` before lazy-loaded modules

## Future Enhancements

Potential features to add:
- [ ] Password history (last 10 generated)
- [ ] Custom character sets
- [ ] Export passwords to file
- [ ] Password strength requirements checker
- [ ] Integration with vault (save generated password directly)
- [ ] Pronounceable password generator
- [ ] Passphrase with custom word lists
- [ ] Entropy visualization
- [ ] Copy individual segments (for memorable passwords)

## Credits

- Inspired by [1Password Password Generator](https://1password.com/password-generator)
- Word list based on EFF's long wordlist
- Built with Angular 20 and Electron
- Part of the Password Sync project

## License

MIT - Part of Password Sync password manager

---

**Created:** November 2025
**Version:** 1.0.0
**Compatibility:** Angular 20+, Electron 27+

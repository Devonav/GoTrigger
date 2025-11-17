# Password Rotation & Email Generation Feature

## Overview

This document explains how to add password rotation and email generation functionality to your Password Generator tile, allowing users to:
1. **Rotate passwords** - Generate new passwords for existing vault credentials
2. **Generate new emails** - Create new email addresses (using email aliases or temporary emails)

## Current Structure

### Existing Components
- **Password Generator**: `src/app/features/password-rotation/components/password-generator/`
  - Generates random, memorable, and PIN passwords
  - Currently standalone (doesn't interact with vault)

- **Vault Service**: `src/app/features/vault/services/vault.service.ts`
  - Manages credentials: `LegacyVaultCredential[]`
  - Each credential has: `uuid`, `server`, `account`, `data { username, password, notes }`

## Implementation Plan

### Option 1: Add Password Rotation Feature (Simpler)

This adds a "Rotate Passwords" section to the password generator that lets users:
- Select credentials from their vault
- Generate new passwords for selected items
- Update the vault with new passwords

### Option 2: Full Password Manager Integration (Advanced)

This creates a dedicated Password Rotation page with:
- Email alias generation (using services like SimpleLogin, AnonAddy)
- Bulk password rotation
- Password rotation scheduling
- Security audit integration

---

## Solution 1: Simple Password Rotation (Recommended First Step)

### Step 1: Create Password Rotation Service

**File**: `src/app/features/password-rotation/services/password-rotation.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';
import { VaultService } from '../../vault/services/vault.service';
import { PasswordGeneratorService } from '@core/services/password-generator.service';

export interface RotationCandidate {
  uuid: string;
  server: string;
  username: string;
  currentPassword: string;
  passwordAge: number; // days since last update
  strength: number;
  selected: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PasswordRotationService {
  // Rotation candidates
  candidates = signal<RotationCandidate[]>([]);

  // Rotation progress
  isRotating = signal<boolean>(false);
  rotationProgress = signal<{ current: number; total: number }>({ current: 0, total: 0 });

  constructor(
    private vaultService: VaultService,
    private passwordGenerator: PasswordGeneratorService
  ) {}

  /**
   * Load credentials that need password rotation
   */
  async loadRotationCandidates(): Promise<void> {
    const credentials = this.vaultService.getCredentials();
    const now = Date.now();

    const candidates: RotationCandidate[] = credentials.map(cred => {
      const passwordAge = cred.updated_at
        ? Math.floor((now - cred.updated_at) / (1000 * 60 * 60 * 24))
        : 999; // Unknown age = very old

      const strength = this.passwordGenerator.calculateStrength(cred.data.password);

      return {
        uuid: cred.uuid,
        server: cred.server,
        username: cred.data.username,
        currentPassword: cred.data.password,
        passwordAge,
        strength,
        selected: false
      };
    });

    // Sort by priority: weak passwords first, then old passwords
    candidates.sort((a, b) => {
      if (a.strength !== b.strength) return a.strength - b.strength;
      return b.passwordAge - a.passwordAge;
    });

    this.candidates.set(candidates);
  }

  /**
   * Toggle candidate selection
   */
  toggleCandidate(uuid: string): void {
    const candidates = this.candidates();
    const updated = candidates.map(c =>
      c.uuid === uuid ? { ...c, selected: !c.selected } : c
    );
    this.candidates.set(updated);
  }

  /**
   * Select all weak passwords (strength < 50)
   */
  selectWeakPasswords(): void {
    const candidates = this.candidates();
    const updated = candidates.map(c => ({
      ...c,
      selected: c.strength < 50
    }));
    this.candidates.set(updated);
  }

  /**
   * Select all old passwords (> 90 days)
   */
  selectOldPasswords(): void {
    const candidates = this.candidates();
    const updated = candidates.map(c => ({
      ...c,
      selected: c.passwordAge > 90
    }));
    this.candidates.set(updated);
  }

  /**
   * Rotate selected passwords
   */
  async rotateSelectedPasswords(): Promise<{ success: number; failed: number }> {
    const selected = this.candidates().filter(c => c.selected);
    this.isRotating.set(true);
    this.rotationProgress.set({ current: 0, total: selected.length });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
      const candidate = selected[i];

      try {
        // Generate new strong password
        const newPassword = this.passwordGenerator.generateRandom({
          length: 20,
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
          excludeSimilar: true,
          excludeAmbiguous: false
        });

        // Update credential in vault
        await this.vaultService.updateCredential(
          candidate.uuid,
          candidate.server,
          candidate.username,
          newPassword
        );

        success++;
      } catch (error) {
        console.error(`Failed to rotate password for ${candidate.server}:`, error);
        failed++;
      }

      this.rotationProgress.set({ current: i + 1, total: selected.length });
    }

    this.isRotating.set(false);

    // Reload candidates to show updated data
    await this.loadRotationCandidates();

    return { success, failed };
  }
}
```

### Step 2: Update Vault Service (Add Update Method)

**File**: `src/app/features/vault/services/vault.service.ts`

Add this method to the `VaultService` class:

```typescript
/**
 * Update an existing credential's password
 */
async updateCredential(uuid: string, server: string, username: string, newPassword: string): Promise<void> {
  console.log('🔄 Updating credential:', uuid);

  // Get current credentials
  const current = this.credentials();
  const index = current.findIndex(c => c.uuid === uuid);

  if (index === -1) {
    throw new Error('Credential not found');
  }

  const credential = current[index];

  // Update the credential with new password
  const updated: LegacyVaultCredential = {
    ...credential,
    data: {
      ...credential.data,
      password: newPassword
    },
    updated_at: Date.now()
  };

  // Save to encrypted storage
  const vaultCred: VaultCredential = {
    metadata: {
      uuid: updated.uuid,
      server: updated.server,
      account: updated.account,
      path: '',
      createdAt: updated.created_at || Date.now(),
      updatedAt: updated.updated_at || Date.now()
    },
    data: {
      password: newPassword,
      notes: updated.data.notes
    }
  };

  await this.manager.updateCredential(vaultCred);

  // Update local state
  const updatedCreds = [...current];
  updatedCreds[index] = updated;
  this.credentials.set(updatedCreds);

  // Sync to server
  await this.sync.syncCredential(vaultCred);

  console.log('✅ Credential updated successfully');
}

/**
 * Get all credentials (needed by rotation service)
 */
getCredentials(): LegacyVaultCredential[] {
  return this.credentials();
}
```

### Step 3: Update Password Generator Component

**File**: `src/app/features/password-rotation/components/password-generator/password-generator.component.ts`

Add to the component:

```typescript
import { PasswordRotationService, RotationCandidate } from '../../services/password-rotation.service';

// Add to class properties
showRotationSection = signal<boolean>(false);
rotationCandidates = computed(() => this.rotationService.candidates());
isRotating = computed(() => this.rotationService.isRotating());
rotationProgress = computed(() => this.rotationService.rotationProgress());

constructor(
  private passwordGenerator: PasswordGeneratorService,
  private router: Router,
  private rotationService: PasswordRotationService  // Add this
) {
  this.generatePassword();
}

/**
 * Toggle rotation section
 */
async toggleRotationSection(): Promise<void> {
  const show = !this.showRotationSection();
  this.showRotationSection.set(show);

  if (show) {
    await this.rotationService.loadRotationCandidates();
  }
}

/**
 * Toggle candidate selection
 */
toggleCandidate(uuid: string): void {
  this.rotationService.toggleCandidate(uuid);
}

/**
 * Select weak passwords
 */
selectWeakPasswords(): void {
  this.rotationService.selectWeakPasswords();
}

/**
 * Select old passwords
 */
selectOldPasswords(): void {
  this.rotationService.selectOldPasswords();
}

/**
 * Rotate selected passwords
 */
async rotatePasswords(): Promise<void> {
  const result = await this.rotationService.rotateSelectedPasswords();

  // Show success message
  alert(`Password rotation complete!\n✅ Success: ${result.success}\n❌ Failed: ${result.failed}`);
}

/**
 * Get strength color
 */
getStrengthColor(strength: number): string {
  if (strength < 30) return '#ef4444'; // red
  if (strength < 60) return '#f59e0b'; // orange
  if (strength < 80) return '#eab308'; // yellow
  return '#22c55e'; // green
}

/**
 * Get strength label
 */
getStrengthLabel(strength: number): string {
  if (strength < 30) return 'Weak';
  if (strength < 60) return 'Fair';
  if (strength < 80) return 'Good';
  return 'Strong';
}
```

### Step 4: Update Password Generator HTML

**File**: `password-generator.component.html`

Add this section after the info box (before closing div):

```html
<!-- Password Rotation Section -->
<div class="rotation-section">
  <button
    class="rotation-toggle"
    (click)="toggleRotationSection()"
    [class.active]="showRotationSection()">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
    {{ showRotationSection() ? 'Hide' : 'Show' }} Password Rotation
  </button>

  @if (showRotationSection()) {
    <div class="rotation-content">
      <div class="rotation-header">
        <h3>Rotate Vault Passwords</h3>
        <p>Select credentials to update with new strong passwords</p>

        <div class="quick-select">
          <button class="btn-quick" (click)="selectWeakPasswords()">
            Select Weak Passwords
          </button>
          <button class="btn-quick" (click)="selectOldPasswords()">
            Select Old Passwords (>90 days)
          </button>
        </div>
      </div>

      @if (rotationCandidates().length === 0) {
        <div class="no-candidates">
          <p>No credentials in vault. Add credentials first!</p>
        </div>
      } @else {
        <div class="candidates-list">
          @for (candidate of rotationCandidates(); track candidate.uuid) {
            <div class="candidate-item" [class.selected]="candidate.selected">
              <div class="candidate-checkbox">
                <input
                  type="checkbox"
                  [checked]="candidate.selected"
                  (change)="toggleCandidate(candidate.uuid)"
                  [id]="'cand-' + candidate.uuid"
                />
              </div>

              <div class="candidate-info">
                <div class="candidate-header">
                  <label [for]="'cand-' + candidate.uuid" class="candidate-name">
                    {{ candidate.server }}
                  </label>
                  <div class="candidate-badges">
                    @if (candidate.passwordAge > 90) {
                      <span class="badge badge-warning">
                        {{ candidate.passwordAge }} days old
                      </span>
                    }
                    <span
                      class="badge badge-strength"
                      [style.background-color]="getStrengthColor(candidate.strength) + '20'"
                      [style.color]="getStrengthColor(candidate.strength)">
                      {{ getStrengthLabel(candidate.strength) }}
                    </span>
                  </div>
                </div>
                <div class="candidate-username">{{ candidate.username }}</div>
              </div>
            </div>
          }
        </div>

        <!-- Rotation Progress -->
        @if (isRotating()) {
          <div class="rotation-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                [style.width.%]="(rotationProgress().current / rotationProgress().total) * 100">
              </div>
            </div>
            <p>Rotating {{ rotationProgress().current }} of {{ rotationProgress().total }}...</p>
          </div>
        }

        <!-- Rotate Button -->
        <div class="rotation-actions">
          <button
            class="btn-rotate"
            (click)="rotatePasswords()"
            [disabled]="isRotating() || rotationCandidates().filter(c => c.selected).length === 0">
            @if (isRotating()) {
              <div class="spinner"></div>
              Rotating...
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Rotate {{ rotationCandidates().filter(c => c.selected).length }} Password(s)
            }
          </button>
        </div>
      }
    </div>
  }
</div>
```

### Step 5: Add Styles

**File**: `password-generator.component.scss`

Add these styles:

```scss
.rotation-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.rotation-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.16);
    color: #ffffff;
  }

  &.active {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }
}

.rotation-content {
  margin-top: 24px;
  animation: slideDown 0.3s ease-out;
}

.rotation-header {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #ffffff;
  }

  p {
    margin: 0 0 16px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  }

  .quick-select {
    display: flex;
    gap: 12px;

    .btn-quick {
      flex: 1;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }
    }
  }
}

.candidates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.candidate-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.2s;

  &.selected {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .candidate-checkbox {
    display: flex;
    align-items: center;

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
  }

  .candidate-info {
    flex: 1;
  }

  .candidate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .candidate-name {
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    font-size: 15px;
  }

  .candidate-badges {
    display: flex;
    gap: 6px;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;

    &.badge-warning {
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
    }

    &.badge-strength {
      border: 1px solid currentColor;
    }
  }

  .candidate-username {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }
}

.no-candidates {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.4);
}

.rotation-progress {
  margin-bottom: 20px;

  .progress-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;

    .progress-fill {
      height: 100%;
      background: #4ade80;
      transition: width 0.3s ease;
    }
  }

  p {
    text-align: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }
}

.rotation-actions {
  .btn-rotate {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 24px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## Solution 2: Email Generation Feature

### Email Alias Services Integration

To generate new emails, you can integrate with email alias services:

#### **Option A: SimpleLogin API** (Recommended)
- Free tier: 10 aliases
- API: Create aliases programmatically
- Self-hosted option available

#### **Option B: AnonAddy**
- Free tier: 20 aliases
- API similar to SimpleLogin
- Open source

#### **Option C: Temp Mail APIs**
- 10minutemail, Guerrilla Mail, etc.
- Temporary emails (not for long-term use)

### Implementation Example (SimpleLogin)

```typescript
// src/app/features/email-alias/services/email-alias.service.ts
@Injectable({ providedIn: 'root' })
export class EmailAliasService {
  private apiKey = ''; // User provides their API key

  async createAlias(prefix?: string): Promise<string> {
    const response = await fetch('https://app.simplelogin.io/api/alias/random/new', {
      method: 'POST',
      headers: {
        'Authentication': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: prefix || 'Password Sync' })
    });

    const data = await response.json();
    return data.alias; // Returns: random@user.simplelogin.com
  }
}
```

---

## Summary & Next Steps

### What You Get:
1. ✅ **Password Rotation UI** in the password generator
2. ✅ **Bulk Password Updates** for weak/old passwords
3. ✅ **Vault Integration** - Updates synced and encrypted
4. ✅ **Progress Tracking** - Visual feedback during rotation

### To Add Email Generation:
1. Choose an email alias service (SimpleLogin recommended)
2. Add API key configuration
3. Update credential form to include "Generate Email Alias" button
4. Store alias mapping in notes field

### Files Created/Modified:
1. ✅ `password-rotation.service.ts` - New service
2. ✅ `vault.service.ts` - Added `updateCredential()` and `getCredentials()`
3. ✅ `password-generator.component.ts` - Added rotation logic
4. ✅ `password-generator.component.html` - Added rotation UI
5. ✅ `password-generator.component.scss` - Added rotation styles

Would you like me to implement this for you? I can create all the files and integrate the password rotation feature into your existing code!

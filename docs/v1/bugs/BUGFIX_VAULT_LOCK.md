# Bug Fix: Vault Lock Button Not Working

**Date:** October 2, 2025  
**Severity:** MEDIUM (UX issue)  
**Status:** ✅ FIXED

## Problem

When user clicks "Lock Vault" button in the vault list:
1. Vault service tries to sync before locking
2. Sync fails because it checks for master key
3. Error appears in console: "Vault is locked. Unlock vault before syncing."
4. User stays on vault list page (doesn't navigate away)

**Error Message:**
```
ERROR Error: Vault is locked. Unlock vault before syncing.
   at _SyncService.fullSync (sync.service.ts:34:13)
   at _VaultService.lock (vault.service.ts:32:21)
```

## Root Cause

**Issue 1: Sync Order in Lock Function**
The `vault.service.ts` `lock()` method was trying to sync BEFORE checking if the vault is locked:

```typescript
// vault.service.ts:31-38
async lock(): Promise<void> {
  await this.sync.fullSync();  // ❌ Fails if vault already locked!
  this.sync.stopAutoSync();
  this.crypto.clearMasterKey();
  this.credentials.set([]);
  this.isLocked.set(true);
  this.stopAutoLockTimer();
}
```

**Issue 2: No Navigation After Lock**
The template was calling `vaultService.lock()` directly without navigating:

```html
<!-- vault-list.component.html:18 -->
<button class="btn-lock" (click)="vaultService.lock()">
```

This meant users stayed on the vault list page even after locking.

## Solution

### 1. Added Error Handling to Lock Function

**File:** `clients/desktop/src/app/features/vault/services/vault.service.ts`

```typescript
async lock(): Promise<void> {
  // Try to sync, but don't fail if vault is already locked
  try {
    await this.sync.fullSync();
  } catch (error) {
    console.warn('Final sync failed on lock:', error);
  }
  
  this.sync.stopAutoSync();
  this.crypto.clearMasterKey();
  this.credentials.set([]);
  this.isLocked.set(true);
  this.stopAutoLockTimer();
}
```

**Why:** Gracefully handles sync failures when vault is already locked.

### 2. Added Navigation After Lock

**File:** `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.ts`

```typescript
async lockVault(): Promise<void> {
  await this.vaultService.lock();
  this.router.navigate(['/vault/unlock']);  // ← Navigate to unlock screen
}
```

**File:** `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.html`

```html
<!-- Changed from vaultService.lock() to lockVault() -->
<button class="btn-lock" (click)="lockVault()">
```

**Why:** Users are properly returned to the unlock screen after locking.

### 3. Auto-Sync Already Handles Lock State

The `sync.service.ts` already checks for master key in auto-sync:

```typescript
// sync.service.ts:227
this.autoSyncInterval = setInterval(async () => {
  if (!this.crypto.hasMasterKey() || this.syncInProgress) {
    return;  // ✅ Skip sync if vault is locked
  }
  // ... sync logic
}, this.AUTO_SYNC_INTERVAL);
```

## Testing

### Before Fix
```
1. User in vault list page
2. Click "Lock Vault"
3. ❌ Error in console
4. ❌ Stays on vault list (broken UI)
```

### After Fix
```
1. User in vault list page
2. Click "Lock Vault"
3. ✅ Graceful sync attempt
4. ✅ Navigates to /vault/unlock
5. ✅ Must unlock to continue
```

## Files Changed

- `clients/desktop/src/app/features/vault/services/vault.service.ts`
  - Added try/catch to `lock()` method
  
- `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.ts`
  - Added `lockVault()` method with navigation
  
- `clients/desktop/src/app/features/vault/components/vault-list/vault-list.component.html`
  - Changed button to call `lockVault()` instead of `vaultService.lock()`

## Related Issues

- Auto-sync was already defensive (checks master key)
- Logout function properly clears session and navigates to login
- Lock vs Logout now have clear distinction:
  - **Lock:** Secure vault, stay logged in, go to unlock screen
  - **Logout:** Secure vault, clear session, go to login screen

## User Experience Improvement

**Before:**
- Confusing error messages
- Stayed on vault list (broken state)
- No clear way to proceed

**After:**
- Clean lock experience
- Proper navigation flow
- Clear distinction between lock and logout

---

**Status:** ✅ FIXED  
**Impact:** UX significantly improved  
**Breaking Changes:** None

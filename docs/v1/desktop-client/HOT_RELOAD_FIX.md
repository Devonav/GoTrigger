# Hot Reload Fix - Module-Scoped vs Global State

**Issue:** IPC handlers being registered multiple times during development hot reload  
**Date:** October 2, 2025  
**Status:** ✅ FIXED

---

## The Problem

### Error Message
```
Uncaught Exception: Error: Attempted to register a second handler for 'db:getCredentialsByServer'
at IpcMainImpl.handle (node:electron/js2c/browser_init:2:109431)
at setupTripleLayerHandlers (/Users/beck/github/password-sync/clients/desktop/dist/electron/triple-layer-handlers.js:147:24)
```

### Root Cause

The initialization guards were using **module-scoped variables**:

```typescript
// ❌ PROBLEM: Module-scoped variable
let handlersInitialized = false;

export function setupTripleLayerHandlers(): void {
  if (handlersInitialized) {
    console.log('Already initialized, skipping...');
    return;
  }
  handlersInitialized = true;
  
  // Register handlers...
}
```

**Why this failed:**

1. **Development Mode (Hot Reload):**
   ```
   File change detected
   ↓
   TypeScript recompiles
   ↓
   Module reloads
   ↓
   handlersInitialized = false (RESET!)
   ↓
   setupTripleLayerHandlers() runs again
   ↓
   Tries to register handlers again
   ↓
   ERROR: Handler already exists
   ```

2. **Module Scope Reset:**
   - Each time the module reloads, all module-scoped variables reset to their initial values
   - The guard `handlersInitialized = false` resets
   - The function thinks handlers haven't been initialized
   - Attempts to register handlers again
   - Electron throws error (can only register once)

---

## The Fix

### Use Global State (Persists Across Reloads)

```typescript
// ✅ SOLUTION: Use global object
const INIT_KEY = '__triple_layer_handlers_initialized__';

export function setupTripleLayerHandlers(): void {
  if ((global as any)[INIT_KEY]) {
    console.log('Already initialized, skipping...');
    return;
  }
  (global as any)[INIT_KEY] = true;
  
  // Register handlers...
}
```

**Why this works:**

1. **Global Object Persists:**
   ```
   File change detected
   ↓
   TypeScript recompiles
   ↓
   Module reloads
   ↓
   global[INIT_KEY] = true (STILL TRUE!)
   ↓
   setupTripleLayerHandlers() checks global
   ↓
   Guard detects initialization
   ↓
   Skips handler registration
   ↓
   NO ERROR ✅
   ```

2. **Global Scope:**
   - `global` object is process-wide
   - Survives module reloads
   - Persists until process exits
   - Perfect for development hot reload

---

## Files Changed

### 1. `electron/triple-layer-handlers.ts`
```diff
- let handlersInitialized = false;
+ const INIT_KEY = '__triple_layer_handlers_initialized__';

  export function setupTripleLayerHandlers(): void {
-   if (handlersInitialized) {
+   if ((global as any)[INIT_KEY]) {
      console.log('Triple-layer handlers already initialized, skipping...');
      return;
    }
-   handlersInitialized = true;
+   (global as any)[INIT_KEY] = true;
```

### 2. `electron/biometric-handler.ts`
```diff
- let handlersInitialized = false;
+ const INIT_KEY = '__biometric_handlers_initialized__';

  export function setupBiometricHandlers(): void {
-   if (handlersInitialized) {
+   if ((global as any)[INIT_KEY]) {
      console.log('Biometric handlers already initialized, skipping...');
      return;
    }
-   handlersInitialized = true;
+   (global as any)[INIT_KEY] = true;
```

### 3. `electron/database-handler.ts`
```diff
- let handlersInitialized = false;
+ const INIT_KEY = '__database_handlers_initialized__';

  export function setupDatabaseHandlers(): void {
-   if (handlersInitialized) {
+   if ((global as any)[INIT_KEY]) {
      console.log('Database handlers already initialized, skipping...');
      return;
    }
-   handlersInitialized = true;
+   (global as any)[INIT_KEY] = true;
```

---

## Why Module-Scoped Variables Don't Work in Hot Reload

### Module Lifecycle in Development

```
┌─────────────────────────────────────────────────┐
│  Initial Load                                    │
│  ─────────────────────────────────────────────  │
│  1. require('triple-layer-handlers')            │
│  2. handlersInitialized = false                 │
│  3. setupTripleLayerHandlers()                  │
│  4. handlersInitialized = true                  │
│  5. Handlers registered ✅                       │
└─────────────────────────────────────────────────┘
                    ↓
          File change detected
                    ↓
┌─────────────────────────────────────────────────┐
│  Hot Reload                                      │
│  ─────────────────────────────────────────────  │
│  1. Module cache cleared                        │
│  2. require('triple-layer-handlers') AGAIN      │
│  3. handlersInitialized = false (RESET!)        │
│  4. setupTripleLayerHandlers()                  │
│  5. handlersInitialized = true                  │
│  6. Tries to register handlers                  │
│  7. ERROR: Already registered ❌                 │
└─────────────────────────────────────────────────┘
```

### Global Object in Development

```
┌─────────────────────────────────────────────────┐
│  Initial Load                                    │
│  ─────────────────────────────────────────────  │
│  1. require('triple-layer-handlers')            │
│  2. Check global[INIT_KEY] → undefined          │
│  3. setupTripleLayerHandlers()                  │
│  4. global[INIT_KEY] = true                     │
│  5. Handlers registered ✅                       │
└─────────────────────────────────────────────────┘
                    ↓
          File change detected
                    ↓
┌─────────────────────────────────────────────────┐
│  Hot Reload                                      │
│  ─────────────────────────────────────────────  │
│  1. Module cache cleared                        │
│  2. require('triple-layer-handlers') AGAIN      │
│  3. Check global[INIT_KEY] → true (PERSISTS!)   │
│  4. Skip handler registration                   │
│  5. No error ✅                                  │
└─────────────────────────────────────────────────┘
```

---

## Testing

### Before Fix
```bash
cd clients/desktop
npm run electron:dev

# Make any change to TypeScript file
# Watch for error:
❌ Error: Attempted to register a second handler for 'db:getCredentialsByServer'
```

### After Fix
```bash
cd clients/desktop
npm run electron:dev

# Make any change to TypeScript file
# Check console:
✅ Triple-layer handlers already initialized, skipping...
✅ No error, app continues working
```

---

## Other Approaches (Not Used)

### Option 1: Remove Handlers Before Registering
```typescript
// ❌ Doesn't work - no ipcMain.removeHandler in Electron
ipcMain.removeHandler('db:getCredentialsByServer');
ipcMain.handle('db:getCredentialsByServer', ...);
```

### Option 2: Try-Catch
```typescript
// ❌ Masks real errors, doesn't fix root cause
try {
  ipcMain.handle('db:getCredentialsByServer', ...);
} catch (error) {
  // Silently ignore
}
```

### Option 3: Only Register Once in App Lifecycle
```typescript
// ❌ Doesn't work with hot reload - app doesn't restart
app.once('ready', () => {
  setupHandlers();
});
```

### Option 4: Use Global (Chosen)
```typescript
// ✅ Works perfectly
const INIT_KEY = '__handlers_initialized__';
if (!(global as any)[INIT_KEY]) {
  setupHandlers();
  (global as any)[INIT_KEY] = true;
}
```

---

## Key Learnings

1. **Module-scoped variables reset on hot reload**
   - Only use for truly local state
   - Don't use for initialization guards

2. **Global object persists across reloads**
   - Perfect for process-wide state
   - Survives module reloads
   - Cleared only on process restart

3. **Electron IPC handlers are process-level**
   - Registered once per process
   - Cannot be unregistered (no removeHandler)
   - Must guard against duplicate registration

4. **Development vs Production**
   - Development: Hot reload common
   - Production: Process restarts between runs
   - Guards needed for development only

---

## Production Implications

**Good news:** This is primarily a development issue.

In production:
- No hot reload
- App fully restarts between runs
- Process exits completely
- Global state cleared
- Module cache cleared
- Fresh initialization every time

However, the global guard **doesn't hurt** in production and provides defense against:
- Accidental double initialization
- Plugin systems that might reload modules
- Future refactoring mistakes

---

## Related Issues Fixed

This same pattern was applied to:
- ✅ Biometric handlers
- ✅ Database handlers  
- ✅ Triple-layer handlers

All now use global state for initialization guards.

---

**Status:** ✅ FIXED  
**Impact:** Development experience greatly improved  
**Side Effects:** None  
**Production Safe:** Yes

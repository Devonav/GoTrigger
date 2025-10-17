# IPC Handler Registration Fix

## Error
```
Uncaught Exception: Error: Attempted to register a second handler for 'db:getCredentialsByServer'
at IpcMainImpl.handle (node:electron/js2c/browser_init:2:109431)
```

## Root Cause

Electron's `ipcMain.handle()` only allows **one handler per channel**. This error occurs when:

1. **Multiple app instances** - User launched the app multiple times
2. **Hot reload in development** - File watching triggers code re-execution
3. **macOS activate event** - App stays running when windows close, handlers persist

## What Was Happening

### Original Flow (Buggy)
```
1. User launches app → app.on('ready') fires
2. Setup handlers (biometric, database, triple-layer)
3. User accidentally launches app again
4. New instance tries to register same handlers
5. ❌ Error: "Attempted to register a second handler"
```

### macOS Specific Issue
```
1. User closes all windows
2. App stays running (macOS behavior)
3. User clicks dock icon → app.on('activate') fires
4. Handlers already registered from first launch
5. On next launch, handlers try to register again
```

## The Fix

### 1. Added Handler Initialization Guards

**biometric-handler.ts:**
```typescript
let handlersInitialized = false;

export function setupBiometricHandlers(): void {
  if (handlersInitialized) {
    console.log('Biometric handlers already initialized, skipping...');
    return;
  }
  handlersInitialized = true;
  
  // Register handlers...
}
```

**database-handler.ts:**
```typescript
let handlersInitialized = false;

export function setupDatabaseHandlers(): void {
  if (handlersInitialized) {
    console.log('Database handlers already initialized, skipping...');
    return;
  }
  handlersInitialized = true;
  
  // Register handlers...
}
```

**triple-layer-handlers.ts:**
```typescript
let handlersInitialized = false;

export function setupTripleLayerHandlers(): void {
  if (handlersInitialized) {
    console.log('Triple-layer handlers already initialized, skipping...');
    return;
  }
  handlersInitialized = true;
  
  // Register handlers...
}
```

### 2. Added Single Instance Lock

**main.ts:**
```typescript
// Prevent multiple app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window instead of launching new instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

### 3. Protected Main IPC Handler

**main.ts:**
```typescript
// Only register this handler once
if (!ipcMain.listenerCount('get-app-version')) {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}
```

## How It Works Now

### New Flow (Fixed)
```
1. User launches app → app.on('ready') fires
2. Setup handlers (only first time)
3. User tries to launch app again
4. ✅ Single instance lock: Focus existing window instead
5. No duplicate handler registration!
```

### macOS Flow (Fixed)
```
1. User closes all windows
2. App stays running (macOS behavior)
3. User clicks dock icon → app.on('activate') fires
4. createWindow() runs (no handler setup)
5. ✅ Handlers already initialized, skipped
```

## Benefits

1. **Prevents crashes** - No duplicate handler registration errors
2. **Better UX** - Single instance enforcement (industry standard)
3. **macOS compatible** - Handles activate event properly
4. **Development friendly** - Works with hot reload
5. **Production ready** - Robust error handling

## Testing

### Test Duplicate Launch
```bash
# Terminal 1
npm run electron:dev

# Terminal 2 (try to launch again)
npm run electron:dev

# Expected: Terminal 2 quits, Terminal 1 window focuses
```

### Test macOS Activate
```bash
# 1. Launch app
npm run electron:dev

# 2. Close all windows (Cmd+W)
# App should stay running (see dock icon)

# 3. Click dock icon
# Window reopens, no errors in console
```

### Verify Console Logs
Look for these logs (only on second attempt):
```
Biometric handlers already initialized, skipping...
Database handlers already initialized, skipping...
Triple-layer handlers already initialized, skipping...
```

## Files Changed

```
electron/
├── biometric-handler.ts       - Added initialization guard
├── database-handler.ts         - Added initialization guard
├── triple-layer-handlers.ts   - Added initialization guard
└── main.ts                     - Added single instance lock
```

## Alternative Solutions (Not Used)

### Option 1: Remove Existing Handlers
```typescript
ipcMain.removeHandler('db:getCredentialsByServer');
ipcMain.handle('db:getCredentialsByServer', async () => {
  // handler code
});
```
**Why not?** Removes handler even if needed, can cause race conditions.

### Option 2: Try-Catch
```typescript
try {
  ipcMain.handle('db:getCredentialsByServer', async () => {
    // handler code
  });
} catch (error) {
  // Silently ignore
}
```
**Why not?** Masks real errors, doesn't fix root cause.

## Related Issues

- Electron docs: https://www.electronjs.org/docs/latest/api/ipc-main#ipcmainhandlechannel-listener
- Single instance: https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelock

---

**Fixed:** Oct 2, 2025
**Status:** ✅ Resolved

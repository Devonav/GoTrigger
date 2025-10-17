# Desktop Client Troubleshooting Guide

## Build Issues

### Issue: better-sqlite3 Won't Rebuild

**Error:**
```
error: "C++20 or later required."
fatal error: too many errors emitted
```

**Cause:** better-sqlite3 v9.x is incompatible with Electron 38

**Fix:**
```bash
npm install better-sqlite3@11.9.0
npm run rebuild
```

**See:** `ELECTRON_BUILD_FIX.md` for details

---

## Runtime Issues

### Issue: "Attempted to register a second handler"

**Error:**
```
Uncaught Exception: Error: Attempted to register a second handler for 'db:getCredentialsByServer'
```

**Cause:** Multiple app instances or handlers registered twice

**Fix:**
```bash
# Kill any running instances
pkill -f "password-sync"

# Rebuild and restart
npm run electron:build
npm run electron:dev
```

**Prevention:** The code now has guards to prevent this. If you still see it:
1. Check for multiple instances: `ps aux | grep electron | grep password-sync`
2. Kill them: `pkill -f "password-sync"`
3. Clear app data: `rm -rf ~/Library/Application\ Support/password-sync-desktop`

**See:** `IPC_HANDLER_FIX.md` for technical details

---

### Issue: App Won't Start

**Symptoms:**
- Blank window
- Immediate crash
- No console logs

**Troubleshooting Steps:**

1. **Check if process is running:**
   ```bash
   ps aux | grep -i electron | grep password-sync
   ```

2. **Kill any existing processes:**
   ```bash
   pkill -f "password-sync"
   ```

3. **Clear cache and rebuild:**
   ```bash
   rm -rf ~/Library/Application\ Support/password-sync-desktop
   rm -rf node_modules
   npm install
   npm run rebuild
   npm run electron:build
   ```

4. **Check Angular dev server:**
   ```bash
   # In separate terminal
   npm run start
   # Should see: Angular Live Development Server is listening on localhost:4200
   ```

5. **Check for port conflicts:**
   ```bash
   lsof -i :4200
   # If something else is using port 4200, kill it
   ```

---

### Issue: Database Errors

**Error:**
```
Error: SQLITE_ERROR: no such table: credentials
```

**Fix:**
```bash
# Delete corrupted database
rm -rf ~/Library/Application\ Support/password-sync-desktop
rm -f vault.db

# Restart app to recreate
npm run electron:dev
```

---

### Issue: Biometric Not Working

**Symptoms:**
- Touch ID/Face ID prompt doesn't appear
- "Biometric not available" error

**Troubleshooting:**

1. **Check platform support:**
   - ✅ macOS: Touch ID / Face ID
   - ✅ Windows: Windows Hello
   - ❌ Linux: Not supported

2. **macOS specific:**
   ```bash
   # Check if keychain access is enabled for terminal
   # System Settings > Privacy & Security > Full Disk Access
   # Add Terminal.app or your IDE
   ```

3. **Clear saved passwords:**
   ```bash
   # Open Keychain Access.app
   # Search for "PasswordSync"
   # Delete any entries
   ```

---

## Development Issues

### Issue: Hot Reload Not Working

**Symptoms:**
- Changes to Angular code don't reflect
- Have to restart app manually

**Fix:**
```bash
# Make sure both processes are running:

# Terminal 1: Angular dev server
npm run start

# Terminal 2: Electron (in watch mode)
npm run electron:dev
```

---

### Issue: TypeScript Compilation Errors

**Error:**
```
error TS2307: Cannot find module 'electron'
```

**Fix:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: CORS Errors

**Error:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix:**
This should not happen in Electron (no CORS restrictions). If you see this:

1. **Check if connecting to correct server:**
   ```typescript
   // src/app/services/api.service.ts
   private baseURL = 'http://localhost:8080/api/v1';
   ```

2. **Make sure server is running:**
   ```bash
   cd ../..  # Go to project root
   make run-multi
   ```

---

## Clean Slate (Nuclear Option)

If all else fails:

```bash
# 1. Kill everything
pkill -f "password-sync"
pkill -f "electron"
pkill -f "angular"

# 2. Clean all caches
rm -rf node_modules
rm -rf dist
rm -rf ~/Library/Application\ Support/password-sync-desktop
rm -rf ~/Library/Caches/password-sync-desktop
rm package-lock.json

# 3. Fresh install
npm install
npm run rebuild

# 4. Rebuild
npm run electron:build

# 5. Start fresh
npm run electron:dev
```

---

## Logging and Debugging

### View Console Logs

**Electron Main Process:**
```bash
# Terminal shows main process logs
npm run electron:dev
```

**Electron Renderer Process:**
- Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
- Check Console tab in DevTools

### Enable Verbose Logging

Add to `electron/main.ts`:
```typescript
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('v', '1');
```

### Check IPC Communication

Add to `electron/main.ts`:
```typescript
ipcMain.on('*', (event, ...args) => {
  console.log('IPC:', event.sender.getProcessId(), args);
});
```

---

## Common Port Issues

### Port 4200 Already in Use

```bash
# Find process using port 4200
lsof -i :4200

# Kill it
kill -9 <PID>
```

### Port 8080 Already in Use (Backend Server)

```bash
# Find process using port 8080
lsof -i :8080

# Kill it
kill -9 <PID>
```

---

## Getting Help

### Before Asking for Help, Provide:

1. **Error message** (full stack trace)
2. **Console output** (main + renderer)
3. **Steps to reproduce**
4. **Environment:**
   ```bash
   node --version
   npm --version
   cat package.json | grep electron
   uname -a  # macOS/Linux
   ver       # Windows
   ```

### Check These First:

- [ ] Killed all existing processes
- [ ] Ran `npm install` and `npm run rebuild`
- [ ] Checked console for errors
- [ ] Verified backend server is running
- [ ] Cleared app cache and data

### Useful Commands:

```bash
# Full diagnostic
npm run electron:build && npm run electron:dev

# Check process tree
ps aux | grep -E "(electron|angular|password)"

# Check open files
lsof | grep password-sync

# Check network
netstat -an | grep -E "(4200|8080)"
```

---

**Last Updated:** Oct 2, 2025

// Paste this in the Electron DevTools console to capture important logs

window.vaultDebugLogs = [];
const maxLogs = 100;

// Override console methods to capture vault-related logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('🔍') || msg.includes('🔐') || msg.includes('➕') || msg.includes('❌') || msg.includes('💾') || msg.includes('✅')) {
    window.vaultDebugLogs.push('[LOG] ' + msg);
    if (window.vaultDebugLogs.length > maxLogs) window.vaultDebugLogs.shift();
  }
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('decrypt') || msg.includes('credential') || msg.includes('master') || msg.includes('salt')) {
    window.vaultDebugLogs.push('[ERROR] ' + msg);
    if (window.vaultDebugLogs.length > maxLogs) window.vaultDebugLogs.shift();
  }
  originalError.apply(console, args);
};

console.warn = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('decrypt') || msg.includes('credential') || msg.includes('master') || msg.includes('salt')) {
    window.vaultDebugLogs.push('[WARN] ' + msg);
    if (window.vaultDebugLogs.length > maxLogs) window.vaultDebugLogs.shift();
  }
  originalWarn.apply(console, args);
};

console.log('✅ Debug logger installed! Logs will be captured.');
console.log('To see logs, run: copy(window.vaultDebugLogs.join("\\n"))');

// Also provide a function to copy logs
window.copyVaultLogs = function() {
  const logs = window.vaultDebugLogs.join('\n');
  copy(logs);
  console.log('✅ Logs copied to clipboard! (' + window.vaultDebugLogs.length + ' entries)');
};

console.log('Or run: copyVaultLogs()');

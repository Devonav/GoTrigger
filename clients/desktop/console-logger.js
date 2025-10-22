// Run this in the Electron DevTools console to save logs to a file
const fs = require('fs');
const path = require('path');

const logFile = path.join(require('os').homedir(), 'vault-console-logs.txt');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

let logs = [];

console.log = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logs.push('[LOG] ' + msg);
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logs.push('[ERROR] ' + msg);
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logs.push('[WARN] ' + msg);
  originalConsoleWarn.apply(console, args);
};

// Save logs every 2 seconds
setInterval(() => {
  if (logs.length > 0) {
    fs.writeFileSync(logFile, logs.join('\n'));
  }
}, 2000);

console.log('📝 Console logging to:', logFile);

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { setupBiometricHandlers } from './biometric-handler';
import { setupDatabaseHandlers } from './database-handler';
import { initializeDatabase, closeDatabase } from './sqlite-database';
import { setupTripleLayerHandlers } from './triple-layer-handlers';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Password Sync',
    show: false,
  });

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../password-sync-desktop/browser/index.html'),
        protocol: 'file:',
        slashes: true,
      })
    );
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  initializeDatabase();
  setupBiometricHandlers();
  setupDatabaseHandlers();
  setupTripleLayerHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Only register this handler once
if (!ipcMain.listenerCount('get-app-version')) {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}

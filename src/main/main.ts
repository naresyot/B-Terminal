import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SSHConnectionPool } from './services/SSHConnectionPool';
import { SecureVault } from './services/SecureVault';
import { SessionManager } from './services/SessionManager';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Modern, premium Mac appearance
    backgroundColor: '#020617', // Match Slate-955
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Disconnect all sessions when the window is closed
  SSHConnectionPool.getInstance().disconnectAll();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Secure IPC Channels Registration ---

// SSH Connections
ipcMain.handle('ssh:connect', async (event, sessionId) => {
  try {
    const sessionConfig = SessionManager.getInstance().resolveConnectionConfig(sessionId);
    const connectionId = await SSHConnectionPool.getInstance().createConnection(
      sessionConfig,
      (data) => {
        // Send stream stdout/stderr back to specific xterm tab in the renderer
        if (mainWindow) {
          mainWindow.webContents.send(`ssh:data:${connectionId}`, data);
        }
      },
      (err) => {
        // Handle unexpected disconnects
        if (mainWindow) {
          mainWindow.webContents.send(`ssh:error:${connectionId}`, err.message);
        }
      }
    );
    return { success: true, connectionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Fire-and-forget — no round-trip needed for keystroke data
ipcMain.on('ssh:write', (_event, { connectionId, data }) => {
  try {
    SSHConnectionPool.getInstance().write(connectionId, data);
  } catch {
    // Connection may have closed between keypress and delivery; safe to ignore
  }
});

ipcMain.handle('ssh:resize', async (event, { connectionId, cols, rows }) => {
  try {
    SSHConnectionPool.getInstance().resize(connectionId, cols, rows);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh:disconnect', async (event, connectionId) => {
  try {
    SSHConnectionPool.getInstance().disconnect(connectionId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// SFTP Sync Interface
ipcMain.handle('sftp:list', async (event, { connectionId, remotePath }) => {
  try {
    const list = await SSHConnectionPool.getInstance().listSFTP(connectionId, remotePath);
    return { success: true, list };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Vault IPC Handlers
ipcMain.handle('vault:unlock', async (event, { password, saltHex }) => {
  try {
    const salt = SecureVault.getInstance().unlock(password, saltHex);
    return { success: true, saltHex: salt };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('vault:lock', () => {
  SecureVault.getInstance().lock();
});

ipcMain.handle('vault:isUnlocked', () => {
  return SecureVault.getInstance().isUnlocked();
});

ipcMain.handle('vault:setCredential', (event, { id, secret }) => {
  SecureVault.getInstance().setCredential(id, secret);
});

ipcMain.handle('vault:deleteCredential', (event, id) => {
  SecureVault.getInstance().deleteCredential(id);
});

// Sessions IPC Handlers
ipcMain.handle('sessions:getNodes', () => {
  return SessionManager.getInstance().getNodes();
});

ipcMain.handle('sessions:addNode', (event, node) => {
  SessionManager.getInstance().addNode(node);
});

ipcMain.handle('sessions:updateNode', (event, { id, fields }) => {
  SessionManager.getInstance().updateNode(id, fields);
});

ipcMain.handle('sessions:deleteNode', (event, id) => {
  SessionManager.getInstance().deleteNode(id);
  if (SecureVault.getInstance().isUnlocked()) {
    SecureVault.getInstance().deleteCredential(id);
  }
});

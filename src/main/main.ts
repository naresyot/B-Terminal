import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SSHConnectionPool } from './services/SSHConnectionPool';

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
ipcMain.handle('ssh:connect', async (event, sessionConfig) => {
  try {
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

ipcMain.handle('ssh:write', async (event, { connectionId, data }) => {
  try {
    SSHConnectionPool.getInstance().write(connectionId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
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

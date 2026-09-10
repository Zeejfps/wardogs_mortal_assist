const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;
let pinned = true;

// 'screen-saver' is the highest z-level Electron exposes. On Windows it maps to
// HWND_TOPMOST; re-asserting it on blur keeps us above games that also set topmost.
function applyPin() {
  if (!win) return;
  win.setAlwaysOnTop(pinned, 'screen-saver');
}

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 420,
    minWidth: 260,
    minHeight: 360,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#14171c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  applyPin();

  // Some games/overlays steal the topmost slot when they gain focus; take it back.
  win.on('blur', () => { if (pinned) applyPin(); });
  win.on('show', applyPin);
  win.on('restore', applyPin);
  win.on('closed', () => { win = null; });
}

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.handle('win:togglePin', () => {
  pinned = !pinned;
  applyPin();
  return pinned;
});
ipcMain.handle('win:isPinned', () => pinned);

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

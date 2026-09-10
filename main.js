const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 420,
    minWidth: 260,
    minHeight: 360,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: '#14171c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.handle('win:togglePin', () => {
  if (!win) return false;
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next);
  return next;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

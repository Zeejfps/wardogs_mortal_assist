const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mortar', {
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  togglePin: () => ipcRenderer.invoke('win:togglePin'),
});

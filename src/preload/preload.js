const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  search: (query) => ipcRenderer.invoke('search', query),
  insertEmoji: (emoji) => ipcRenderer.send('insert-emoji', emoji),
  onWindowShown: (callback) => ipcRenderer.on('window-shown', callback),
  hideApp: () => ipcRenderer.send('hide-app'),
  reloadData: () => ipcRenderer.send('reload-data'),
  quitApp: () => ipcRenderer.send('quit-app')
});

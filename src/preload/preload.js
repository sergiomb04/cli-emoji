const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  search: (query) => ipcRenderer.invoke('search', query),
  getRecents: () => ipcRenderer.invoke('get-recents'),
  removeRecent: (emoji) => ipcRenderer.invoke('remove-recent', emoji),
  clearRecents: () => ipcRenderer.invoke('clear-recents'),
  setRecents: (list) => ipcRenderer.invoke('set-recents', list),
  trackEmoji: (emoji) => ipcRenderer.send('track-emoji', emoji),
  insertEmoji: (emoji) => ipcRenderer.send('insert-emoji', emoji),
  onWindowShown: (callback) => ipcRenderer.on('window-shown', callback),
  hideApp: () => ipcRenderer.send('hide-app'),
  reloadData: () => ipcRenderer.send('reload-data'),
  quitApp: () => ipcRenderer.send('quit-app')
});

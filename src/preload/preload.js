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
  buildAndReloadData: () => ipcRenderer.invoke('build-and-reload-data'),
  getEmojiDetails: (emoji) => ipcRenderer.invoke('get-emoji-details', emoji),
  saveEmoji: (data) => ipcRenderer.invoke('save-emoji', data),
  deleteEmoji: (emoji) => ipcRenderer.invoke('delete-emoji', emoji),
  quitApp: () => ipcRenderer.send('quit-app')
});

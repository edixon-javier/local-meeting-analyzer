// electron/preload.js
// Bridge seguro entre el mundo Electron (Node) y el mundo React (web).
// Expone solo las funciones necesarias via contextBridge.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Control de la ventana (frameless)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  
  // Exportar a PDF
  exportPDF: (defaultName) => ipcRenderer.invoke('export:pdf', defaultName),
  
  // Atajos globales
  onShortcutToggleRecording: (callback) => {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on('shortcut:toggle-recording', subscription)
    return () => ipcRenderer.off('shortcut:toggle-recording', subscription)
  }
})

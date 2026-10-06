// electron/preload.js
// Bridge seguro entre el mundo Electron (Node) y el mundo React (web).
// Expone solo las funciones necesarias via contextBridge.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Control de la ventana (frameless)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  show: () => ipcRenderer.send('window:show'),
  // Solo http(s) y mailto: (validado en el proceso principal)
  openExternal: (url) => ipcRenderer.send('open:external', url),
  
  // Exportar a PDF
  exportPDF: (defaultName) => ipcRenderer.invoke('export:pdf', defaultName),

  // Ayuda y soporte (todo local: no se envía nada a ningún servidor)
  // -> { version, electron, chrome, node, os, arch, isPackaged, isStore, dataDir, logsDir }
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  // Abre la carpeta de registros en el Explorador -> boolean
  openLogsFolder: () => ipcRenderer.invoke('app:open-logs-folder'),
  // Copia al portapapeles un diagnóstico sin claves y devuelve el texto -> string
  copyDiagnostics: () => ipcRenderer.invoke('app:copy-diagnostics'),
  // id: 'privacy' | 'eula' | 'third_party' | 'changelog' | 'consent' -> boolean
  openLegalDoc: (id) => ipcRenderer.invoke('app:open-legal-doc', id),
  
  // Atajos globales
  onShortcutToggleRecording: (callback) => {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on('shortcut:toggle-recording', subscription)
    return () => ipcRenderer.off('shortcut:toggle-recording', subscription)
  }
})

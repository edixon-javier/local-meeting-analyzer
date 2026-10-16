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
  reload: () => ipcRenderer.send('window:reload'),
  // Solo http(s) y mailto: (validado en el proceso principal)
  openExternal: (url) => ipcRenderer.send('open:external', url),
  
  // Exportar a PDF
  exportPDF: (defaultName) => ipcRenderer.invoke('export:pdf', defaultName),

  // Ayuda y soporte (todo local: no se envía nada a ningún servidor)
  // -> { version, electron, chrome, node, os, arch, isPackaged, isStore, dataDir, logsDir }
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  // Comando para conectar asistentes de IA al servidor MCP local -> { command, args, env }
  getMcpConfig: () => ipcRenderer.invoke('app:get-mcp-config'),
  // Abre la carpeta de registros en el Explorador -> boolean
  openLogsFolder: () => ipcRenderer.invoke('app:open-logs-folder'),
  // Copia al portapapeles un diagnóstico sin claves y devuelve el texto -> string
  copyDiagnostics: () => ipcRenderer.invoke('app:copy-diagnostics'),
  // id: 'privacy' | 'eula' | 'third_party' | 'changelog' | 'consent' -> boolean
  // Archivos de audio locales (descargar o revelar en Explorador de archivos)
  showItemInFolder: (itemPath) => ipcRenderer.invoke('app:show-item-in-folder', itemPath),
  saveAudioFile: (defaultFilename, sourcePath) => ipcRenderer.invoke('app:save-audio', { defaultFilename, sourcePath }),

  // Atajos globales
  onShortcutToggleRecording: (callback) => {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on('shortcut:toggle-recording', subscription)
    return () => ipcRenderer.off('shortcut:toggle-recording', subscription)
  },

  // Dictado interactivo y micro-píldora
  dictationToggle: () => ipcRenderer.invoke('dictation:toggle'),
  dictationStart: () => ipcRenderer.invoke('dictation:start'),
  dictationStop: (opts) => ipcRenderer.invoke('dictation:stop', opts),
  dictationCancel: () => ipcRenderer.invoke('dictation:cancel'),
  dictationSetShortcut: (shortcut) => ipcRenderer.invoke('dictation:set-shortcut', shortcut),
  dictationDragStart: (coords) => ipcRenderer.send('dictation:drag-start', coords),
  dictationDragMove: (coords) => ipcRenderer.send('dictation:drag-move', coords),
  dictationDragEnd: () => ipcRenderer.send('dictation:drag-end'),
  onDictationStateChanged: (callback) => {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on('dictation:state-changed', subscription)
    return () => ipcRenderer.off('dictation:state-changed', subscription)
  }
})

// electron/main.js
// Proceso principal de Electron. Lanza la ventana del app.

const { app, BrowserWindow, ipcMain, shell, Menu, Tray, globalShortcut } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let pythonProcess
let tray = null
let isQuitting = false

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // Sin barra de título nativa (usamos la nuestra)
    backgroundColor: '#090E17',
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,           // Prevenir parpadeo o ventana en blanco antes de pintar el splash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Renderer Gone]', details)
  })

  // Mostrar la ventana tan pronto como el splash inicial esté listo para pintarse
  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] ready-to-show disparado')
    mainWindow.show()
  })

  // Timeout de seguridad en caso de que ready-to-show se retrase
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 1000)

  // Interceptar cierre para ocultar en la bandeja (System Tray)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    return false
  })
}

function startPythonBackend() {
  if (process.env.EXTERNAL_BACKEND === 'true') {
    console.log('[Electron] Usando backend externo (start_dev.bat)');
    return;
  }

  let pythonExecutable;
  let args = [];

  if (app.isPackaged) {
    pythonExecutable = path.join(process.resourcesPath, 'backend', 'main.exe');
  } else {
    pythonExecutable = path.join(__dirname, '../../backend/venv/Scripts/python.exe');
    args = [path.join(__dirname, '../../backend/main.py')];
  }

  try {
    // windowsHide: true evita que se abra una ventana cmd visible
    pythonProcess = spawn(pythonExecutable, args, { detached: false, windowsHide: true });
    
    pythonProcess.stdout.on('data', (data) => console.log('[Python]', data.toString()));
    pythonProcess.stderr.on('data', (data) => console.error('[Python ERR]', data.toString()));
    
    pythonProcess.on('error', (err) => {
      console.error('[Electron] Error al intentar iniciar el backend Python:', err);
    });
  } catch (e) {
    console.error('[Electron] Excepción al lanzar backend Python:', e);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png')
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Aplicación',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Iniciar/Detener Grabación',
      click: () => {
        mainWindow?.webContents.send('shortcut:toggle-recording')
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('Local Meeting Analyzer')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─────────────────────────────────────────
// IPC Handlers - Ventana sin bordes y PDF
// ─────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close()) // Esto gatillará el close interceptado
ipcMain.on('open:external', (_, url) => {
  try {
    const parsedUrl = new URL(url)
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      shell.openExternal(url)
    } else {
      console.warn('[Electron Security] Se bloqueó intento de abrir protocolo no seguro:', parsedUrl.protocol)
    }
  } catch (e) {
    console.error('[Electron Security] Error al analizar URL para apertura externa:', url, e)
  }
})

// Exportar a PDF usando la API de impresión nativa de Electron Chromium
ipcMain.handle('export:pdf', async (event, defaultFilename) => {
  const { dialog } = require('electron')
  const fs = require('fs')

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (filePath) {
    try {
      const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 1
      })
      fs.writeFileSync(filePath, data)
      return true
    } catch (err) {
      console.error('Error generando PDF:', err)
      return false
    }
  }
  return false
})

// ─────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────
app.whenReady().then(() => {
  startPythonBackend()
  createWindow()
  createTray()

  // Registrar atajo de teclado global Ctrl+Shift+R
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('shortcut:toggle-recording')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

function killProcessTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', pid, '/f', '/t'])
  } else {
    try {
      process.kill(pid)
    } catch (e) {
      console.error('[Electron] Error al matar proceso:', e)
    }
  }
}

app.on('window-all-closed', () => {
  if (pythonProcess) {
    killProcessTree(pythonProcess.pid)
  }
  if (process.platform !== 'darwin') app.quit()
})

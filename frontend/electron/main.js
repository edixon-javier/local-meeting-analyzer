// electron/main.js
// Proceso principal de Electron. Lanza la ventana del app.

const { app, BrowserWindow, ipcMain, shell, Menu, Tray, globalShortcut } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let pythonProcess
let tray = null
let isQuitting = false

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // Sin barra de título nativa (usamos la nuestra)
    backgroundColor: '#0F172A',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

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
  if (!isDev) {
    const pythonPath = path.join(process.resourcesPath, 'backend', 'main.exe')
    pythonProcess = spawn(pythonPath, [], { detached: false })
    pythonProcess.stdout.on('data', (data) => console.log('[Python]', data.toString()))
    pythonProcess.stderr.on('data', (data) => console.error('[Python ERR]', data.toString()))
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
ipcMain.on('open:external', (_, url) => shell.openExternal(url))

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

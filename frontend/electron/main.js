// electron/main.js
// Proceso principal de Electron. Lanza la ventana del app.

const { app, BrowserWindow, ipcMain, shell, Menu, Tray, globalShortcut, dialog, clipboard, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn, spawnSync } = require('child_process')
const { createLogger, maskSecrets, formatArgs, tailFile } = require('./logging')

let mainWindow
let pythonProcess
let tray = null
let isQuitting = false

// Píldora flotante para dictado global en cursor
let pillWindow = null
let isDictating = false
let dictationShortcut = 'CommandOrControl+Shift+D'

const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_URL)

// El frontend usa http://localhost:8765 (api.js, CSP de index.html)
const BACKEND_PORT = 8765

// ─────────────────────────────────────────
// Registro local (sin telemetría): <userData>/logs/main.log, rotación 1 MB + main.log.old
// ─────────────────────────────────────────
const REPO_ROOT = path.join(__dirname, '..', '..')
const logsDir = path.join(app.getPath('userData'), 'logs')
const mainLog = createLogger(path.join(logsDir, 'main.log'))

// Todo console.* del proceso principal queda también en el archivo (con claves enmascaradas)
const nativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}
function emitConsole(level, args) {
  try {
    nativeConsole[level](...args)
  } catch {
    // Sin consola (app empaquetada): se ignora
  }
}
for (const [method, level] of [['log', 'INFO'], ['info', 'INFO'], ['warn', 'WARN'], ['error', 'ERROR']]) {
  console[method] = (...args) => {
    emitConsole(method, args)
    mainLog.write(level, 'main', formatArgs(args))
  }
}

process.on('uncaughtException', (err) => {
  mainLog.write('ERROR', 'main', `uncaughtException: ${formatArgs([err])}`)
  mainLog.flush()
})
process.on('unhandledRejection', (reason) => {
  mainLog.write('ERROR', 'main', `unhandledRejection: ${formatArgs([reason])}`)
  mainLog.flush()
})
process.on('exit', () => mainLog.flush())

const UPDATE_CHECK_DELAY_MS = 10 * 1000
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const UPDATE_BUSY_RETRY_MS = 5 * 60 * 1000

// Vite copia public/icon.png a dist/icon.png, que sí se incluye en el paquete
const APP_ICON = app.isPackaged
  ? path.join(__dirname, '../dist/icon.png')
  : path.join(__dirname, '../public/icon.png')

// Una sola instancia: una segunda copia intentaría levantar otro backend en el mismo puerto
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents?.reloadIgnoringCache()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // Sin barra de título nativa (usamos la nuestra)
    backgroundColor: '#090E17',
    icon: APP_ICON,
    show: false,           // Prevenir parpadeo o ventana en blanco antes de pintar el splash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Atajos de teclado para recarga e inspección en ventana sin bordes
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
        mainWindow.webContents.reloadIgnoringCache()
      }
      if (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools()
      }
    }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Consola del renderer: en el archivo solo warn/error (para mantenerlo pequeño);
  // en desarrollo se reenvía todo a la terminal.
  mainWindow.webContents.on('console-message', (event, ...legacy) => {
    // Electron >= 35 entrega un objeto de detalles; el formato posicional antiguo está obsoleto
    const details = event && typeof event.level === 'string'
      ? event
      : { level: ['debug', 'info', 'warning', 'error'][legacy[0]] || 'info', message: legacy[1], lineNumber: legacy[2], sourceId: legacy[3] }
    const { level, message, lineNumber, sourceId } = details
    const where = sourceId ? ` (${String(sourceId).split(/[\\/]/).pop()}:${lineNumber})` : ''
    const isProblem = level === 'warning' || level === 'error'
    if (isDev || isProblem) emitConsole(level === 'error' ? 'error' : (level === 'warning' ? 'warn' : 'log'), [`[Renderer] ${message}${where}`])
    if (isProblem) mainLog.write(level === 'error' ? 'ERROR' : 'WARN', 'renderer', `${message}${where}`)
  })

  // Mostrar la ventana tan pronto como el splash inicial esté listo para pintarse
  mainWindow.once('ready-to-show', () => {
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

// ─────────────────────────────────────────
// Micro-Píldora Flotante para Dictado en Cursor
// ─────────────────────────────────────────
function createPillWindow() {
  if (pillWindow && !pillWindow.isDestroyed()) return pillWindow

  pillWindow = new BrowserWindow({
    width: 360,
    height: 54,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.platform === 'win32') {
    pillWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  // Prevenir que robe el foco bajo cualquier circunstancia
  pillWindow.setFocusable(false)

  if (isDev) {
    pillWindow.loadURL(`${process.env.VITE_DEV_URL || 'http://localhost:5173'}#dictation-pill`)
  } else {
    pillWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'dictation-pill' })
  }

  pillWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      pillWindow.hide()
    }
    return false
  })

  return pillWindow
}

function positionPillWindow() {
  if (!pillWindow || pillWindow.isDestroyed()) return
  try {
    const point = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const { workArea } = display
    const pillWidth = 360
    const pillHeight = 54
    const x = Math.round(workArea.x + (workArea.width - pillWidth) / 2)
    const y = Math.round(workArea.y + workArea.height - pillHeight - 40)
    pillWindow.setBounds({ x, y, width: pillWidth, height: pillHeight })
  } catch (err) {
    console.error('[Electron] Error posicionando pillWindow:', err)
  }
}

async function startDictationSession() {
  try {
    if (!pillWindow || pillWindow.isDestroyed()) {
      createPillWindow()
    }
    positionPillWindow()
    pillWindow.showInactive()
    isDictating = true

    pillWindow.webContents?.send('dictation:state-changed', { state: 'recording', started_at: Date.now() })
    mainWindow?.webContents?.send('dictation:state-changed', { state: 'recording' })

    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/dictation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.detail || `HTTP ${res.status}`)
    }
    console.log('[Electron] Dictado iniciado en backend:', data)
    return data
  } catch (err) {
    console.error('[Electron] Error iniciando dictado:', err)
    isDictating = false
    pillWindow?.hide()
    mainWindow?.webContents?.send('dictation:state-changed', { state: 'idle', error: String(err) })
    return null
  }
}

async function stopDictationSession(mode) {
  if (!isDictating) return null
  isDictating = false
  try {
    pillWindow?.webContents?.send('dictation:state-changed', { state: 'processing' })
    mainWindow?.webContents?.send('dictation:state-changed', { state: 'processing' })

    const reqBody = { inject: true }
    if (mode) reqBody.mode = mode

    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/dictation/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.detail || `HTTP ${res.status}`)
    }
    console.log('[Electron] Dictado completado e inyectado:', data.id)

    pillWindow?.webContents?.send('dictation:state-changed', { state: 'finished', data })
    mainWindow?.webContents?.send('dictation:state-changed', { state: 'idle', data })

    const isProblem = !data?.id || data?.status === 'silence_or_too_short' || data?.status === 'empty_audio' || data?.status === 'no_speech_detected'
    const hideDelayMs = isProblem ? 2500 : 1200

    setTimeout(() => {
      if (!isDictating && pillWindow && !pillWindow.isDestroyed()) {
        pillWindow.hide()
      }
    }, hideDelayMs)

    return data
  } catch (err) {
    console.error('[Electron] Error finalizando dictado:', err)
    pillWindow?.webContents?.send('dictation:state-changed', { state: 'finished', data: { detail: String(err) } })
    mainWindow?.webContents?.send('dictation:state-changed', { state: 'idle', error: String(err) })
    setTimeout(() => {
      if (!isDictating && pillWindow && !pillWindow.isDestroyed()) {
        pillWindow.hide()
      }
    }, 2500)
    return null
  }
}

async function cancelDictationSession() {
  isDictating = false
  try {
    await fetch(`http://127.0.0.1:${BACKEND_PORT}/dictation/cancel`, { method: 'POST' })
  } catch (err) {
    console.error('[Electron] Error cancelando dictado:', err)
  }
  pillWindow?.hide()
  pillWindow?.webContents?.send('dictation:state-changed', { state: 'idle' })
  mainWindow?.webContents?.send('dictation:state-changed', { state: 'idle' })
}

async function toggleDictation() {
  if (isDictating) {
    return await stopDictationSession()
  } else {
    return await startDictationSession()
  }
}

function registerDictationShortcut(shortcut) {
  if (dictationShortcut) {
    try {
      globalShortcut.unregister(dictationShortcut)
    } catch {}
  }
  dictationShortcut = shortcut || 'CommandOrControl+Shift+D'
  try {
    const ok = globalShortcut.register(dictationShortcut, () => {
      toggleDictation()
    })
    if (!ok) {
      console.warn(`[Electron] No se pudo registrar el atajo global de dictado: ${dictationShortcut}`)
    } else {
      console.log(`[Electron] Atajo global de dictado registrado: ${dictationShortcut}`)
    }
  } catch (e) {
    console.error('[Electron] Error registrando atajo de dictado:', e)
  }
}

function killDanglingPort(port) {
  if (process.platform !== 'win32') return
  try {
    const res = spawnSync('netstat', ['-ano', '-p', 'tcp'], { windowsHide: true, encoding: 'utf8' })
    if (res.stdout) {
      const lines = res.stdout.split(/\r?\n/)
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            console.log(`[Electron] Liberando puerto ${port} (PID ${pid} residual)...`)
            spawnSync('taskkill', ['/pid', pid, '/f', '/t'], { windowsHide: true })
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Electron] No se pudo comprobar puerto residual:', err?.message || err)
  }
}

function ensureOllamaRunning() {
  if (process.platform !== 'win32') return
  try {
    fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(1000) })
      .catch(() => {
        try {
          const ollamaProc = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          })
          ollamaProc.unref()
          console.log('[Electron] Ollama no estaba en ejecución; iniciado silenciosamente en segundo plano.')
        } catch {
          // Ollama no instalado en el sistema
        }
      })
  } catch {
    // Ignorar
  }
}

function startPythonBackend() {
  if (process.env.EXTERNAL_BACKEND === 'true') {
    console.log('[Electron] Usando backend externo (start_dev.bat)');
    return;
  }

  killDanglingPort(BACKEND_PORT);

  let pythonExecutable;
  let args = [];
  let backendDir;
  const env = {
    ...process.env,
    BACKEND_PORT: String(BACKEND_PORT),
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
  };

  if (app.isPackaged) {
    // Backend congelado con PyInstaller (resources/backend/meeting-backend.exe)
    backendDir = path.join(process.resourcesPath, 'backend');
    pythonExecutable = path.join(backendDir, 'meeting-backend.exe');
    // Config, grabaciones y logs fuera de la carpeta de instalación (de solo lectura en MSIX)
    env.MEETING_ANALYZER_DATA_DIR = app.getPath('userData');
    env.MEETING_ANALYZER_BIN_DIR = path.join(process.resourcesPath, 'bin');
  } else {
    // Desarrollo: venv local; preferir pythonw.exe para evitar asignación de consolas en Windows
    backendDir = path.join(__dirname, '../../backend');
    const pythonw = path.join(backendDir, 'venv/Scripts/pythonw.exe');
    const python = path.join(backendDir, 'venv/Scripts/python.exe');
    pythonExecutable = fs.existsSync(pythonw) ? pythonw : python;
    args = [path.join(backendDir, 'main.py')];
  }

  try {
    // windowsHide: true evita que se abra una ventana cmd visible
    pythonProcess = spawn(pythonExecutable, args, { cwd: backendDir, env, detached: false, windowsHide: true });
    
    // La salida del backend va a la consola y a main.log (enmascarada). El propio backend ya
    // escribe backend.log; esto cubre fallos previos a que su registro arranque (p. ej. imports).
    const pipeBackendOutput = (stream, tag, consoleMethod, logSource) => {
      let pending = ''
      stream.on('data', (data) => {
        const text = data.toString()
        emitConsole(consoleMethod, [tag, text])
        pending += text
        const lines = pending.split(/\r?\n/)
        pending = lines.pop()
        for (const line of lines) if (line.trim()) mainLog.write('INFO', logSource, line)
      })
      stream.on('end', () => {
        if (pending.trim()) mainLog.write('INFO', logSource, pending)
        pending = ''
      })
    }
    pipeBackendOutput(pythonProcess.stdout, '[Python]', 'log', 'backend-out')
    pipeBackendOutput(pythonProcess.stderr, '[Python ERR]', 'error', 'backend-err')

    pythonProcess.on('error', (err) => {
      console.error('[Electron] Error al intentar iniciar el backend Python:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
      const message = `[Electron] Backend Python finalizado (código ${code}${signal ? `, señal ${signal}` : ''})`
      if (!isQuitting && code !== 0) console.error(message)
      else console.log(message)
    });
  } catch (e) {
    console.error('[Electron] Excepción al lanzar backend Python:', e);
  }
}

function createTray() {
  tray = new Tray(APP_ICON)

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
ipcMain.on('window:reload', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents?.reloadIgnoringCache()
  }
})
// Trae la ventana al frente (p. ej. para pedir consentimiento si se grabó desde el atajo o la bandeja)
ipcMain.on('window:show', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.show()
  mainWindow?.focus()
})
ipcMain.on('open:external', (_, url) => {
  try {
    const parsedUrl = new URL(url)
    // mailto: solo para "Reportar problema" por correo cuando no hay repositorio de incidencias
    if (['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
      shell.openExternal(url)
    } else {
      console.warn('[Electron Security] Se bloqueó intento de abrir protocolo no seguro:', parsedUrl.protocol)
    }
  } catch (e) {
    console.error('[Electron Security] Error al analizar URL para apertura externa:', url, e)
  }
})

// ─────────────────────────────────────────
// IPC - Información de la app, registros, diagnóstico y documentos legales
// ─────────────────────────────────────────

// Carpeta de datos que usa el backend: userData empaquetado; backend/ en desarrollo
function getBackendDataDir() {
  return app.isPackaged ? app.getPath('userData') : path.join(REPO_ROOT, 'backend')
}

function getAppInfo() {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    os: os.release(),
    arch: process.arch,
    isPackaged: app.isPackaged,
    isStore: !!process.windowsStore,
    dataDir: getBackendDataDir(),
    logsDir,
  }
}

// Documentos que se pueden abrir desde la UI (lista cerrada: el renderer nunca envía rutas)
const LEGAL_DOCS = {
  privacy: { file: 'PRIVACY.md', devDir: 'legal' },
  eula: { file: 'EULA.txt', devDir: 'legal' },
  consent: { file: 'CONSENT_NOTICE.md', devDir: 'legal' },
  third_party: { file: 'THIRD_PARTY_NOTICES.md', devDir: '' },
  changelog: { file: 'CHANGELOG.md', devDir: '' },
}

function resolveLegalDoc(id) {
  const doc = Object.prototype.hasOwnProperty.call(LEGAL_DOCS, id) ? LEGAL_DOCS[id] : null
  if (!doc) return null
  // Empaquetado: resources/docs/ (extraResources). Desarrollo: raíz del repositorio.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', doc.file)
    : path.join(REPO_ROOT, doc.devDir, doc.file)
}

ipcMain.handle('app:get-info', () => getAppInfo())

ipcMain.handle('app:open-logs-folder', async () => {
  try {
    fs.mkdirSync(logsDir, { recursive: true })
    const error = await shell.openPath(logsDir)
    if (error) console.error('[Electron] No se pudo abrir la carpeta de registros:', error)
    return !error
  } catch (e) {
    console.error('[Electron] Error al abrir la carpeta de registros:', e)
    return false
  }
})

ipcMain.handle('app:open-legal-doc', async (_event, id) => {
  const source = resolveLegalDoc(id)
  if (!source || !fs.existsSync(source)) {
    console.error('[Electron] Documento legal no disponible:', id)
    return false
  }
  try {
    let target = source
    // Windows no asocia .md a ningún programa por defecto: se abre una copia .txt (Bloc de notas)
    if (path.extname(source).toLowerCase() === '.md') {
      const tmpDir = path.join(app.getPath('temp'), 'LocalMeetingAnalyzer-docs')
      fs.mkdirSync(tmpDir, { recursive: true })
      target = path.join(tmpDir, path.basename(source, '.md') + '.txt')
      fs.copyFileSync(source, target)
    }
    const error = await shell.openPath(target)
    if (error) console.error('[Electron] No se pudo abrir el documento:', id, error)
    return !error
  } catch (e) {
    console.error('[Electron] Error al abrir el documento:', id, e)
    return false
  }
})

async function fetchBackendStatusText() {
  try {
    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/status`, { signal: AbortSignal.timeout(3000) })
    return JSON.stringify(await res.json(), null, 2)
  } catch (e) {
    return `(el backend no responde: ${e?.message || e})`
  }
}

// Texto de soporte para pegar en un reporte. Sin transcripciones ni claves (se enmascaran).
async function buildDiagnosticsReport() {
  const info = getAppInfo()
  const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1)
  const backendLog = path.join(info.dataDir, 'logs', 'backend.log')
  mainLog.flush()
  const parts = [
    '=== Local Meeting Analyzer — Diagnóstico ===',
    `Generado: ${new Date().toISOString()}`,
    '',
    `Versión de la app: ${info.version}`,
    `Electron ${info.electron} · Chrome ${info.chrome} · Node ${info.node}`,
    `Sistema: ${os.type()} ${info.os} (${info.arch})`,
    `Instalación: ${info.isPackaged ? 'empaquetada' : 'desarrollo'}${info.isStore ? ' · Microsoft Store' : ''}`,
    `RAM total: ${gb(os.totalmem())} GB (libre: ${gb(os.freemem())} GB)`,
    `Carpeta de datos: ${info.dataDir}`,
    `Carpeta de registros: ${info.logsDir}`,
    '',
    '--- Estado del backend (/status) ---',
    await fetchBackendStatusText(),
    '',
    '--- main.log (últimas 150 líneas) ---',
    tailFile(mainLog.filePath, 150) || '(vacío)',
    '',
    '--- backend.log (últimas 150 líneas) ---',
    tailFile(backendLog, 150) || '(vacío)',
    '',
  ]
  // Oculta el nombre de usuario de Windows en las rutas y cualquier clave de API
  const report = maskSecrets(parts.join('\n'))
  const home = os.homedir()
  return home && home.length > 3 ? report.split(home).join('%USERPROFILE%') : report
}

ipcMain.handle('app:copy-diagnostics', async () => {
  try {
    const report = await buildDiagnosticsReport()
    clipboard.writeText(report)
    return report
  } catch (e) {
    console.error('[Electron] Error al generar el diagnóstico:', e)
    return ''
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

// Mostrar archivo de audio en el Explorador de Windows con el archivo seleccionado
ipcMain.handle('app:show-item-in-folder', async (_event, itemPath) => {
  try {
    if (!itemPath || typeof itemPath !== 'string') return false
    const recordingsDir = path.join(getBackendDataDir(), 'recordings')
    let target = itemPath
    if (!path.isAbsolute(target)) {
      target = path.join(recordingsDir, path.basename(target))
    }
    target = path.normalize(target)
    if (!fs.existsSync(target)) {
      console.warn('[Electron] Archivo a mostrar no existe:', target)
      return false
    }
    shell.showItemInFolder(target)
    return true
  } catch (err) {
    console.error('[Electron] Error al mostrar archivo en carpeta:', err)
    return false
  }
})

// Guardar copia del archivo de audio en ubicación elegida por el usuario
ipcMain.handle('app:save-audio', async (_event, { defaultFilename, sourcePath }) => {
  const { dialog } = require('electron')
  try {
    if (!sourcePath || typeof sourcePath !== 'string') return false
    const recordingsDir = path.join(getBackendDataDir(), 'recordings')
    let src = sourcePath
    if (!path.isAbsolute(src)) {
      src = path.join(recordingsDir, path.basename(src))
    }
    src = path.normalize(src)
    if (!fs.existsSync(src)) {
      console.warn('[Electron] Archivo de origen no existe:', src)
      return false
    }

    const ext = path.extname(src).replace('.', '').toLowerCase() || 'wav'
    const cleanDefault = defaultFilename || path.basename(src)

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: cleanDefault,
      filters: [
        { name: 'Archivos de audio', extensions: [ext, 'wav', 'mp3', 'm4a', 'ogg', 'flac'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })

    if (filePath) {
      fs.copyFileSync(src, filePath)
      return true
    }
    return false
  } catch (err) {
    console.error('[Electron] Error al guardar archivo de audio:', err)
    return false
  }
})

// ─────────────────────────────────────────
// IPC - Dictado interactivo y píldora flotante
// ─────────────────────────────────────────
ipcMain.handle('dictation:toggle', () => toggleDictation())
ipcMain.handle('dictation:start', () => startDictationSession())
ipcMain.handle('dictation:stop', (_event, opts) => stopDictationSession(opts?.mode))
ipcMain.handle('dictation:cancel', () => cancelDictationSession())
ipcMain.handle('dictation:set-shortcut', (_event, sc) => {
  registerDictationShortcut(sc)
  return true
})

let pillDragState = null

ipcMain.on('dictation:drag-start', (_event, { screenX, screenY }) => {
  if (!pillWindow || pillWindow.isDestroyed()) return
  const [winX, winY] = pillWindow.getPosition()
  pillDragState = {
    initialWinX: winX,
    initialWinY: winY,
    grabMouseX: screenX,
    grabMouseY: screenY,
  }
})

ipcMain.on('dictation:drag-move', (_event, { screenX, screenY }) => {
  if (!pillWindow || pillWindow.isDestroyed() || !pillDragState) return
  const deltaX = screenX - pillDragState.grabMouseX
  const deltaY = screenY - pillDragState.grabMouseY
  const newX = Math.round(pillDragState.initialWinX + deltaX)
  const newY = Math.round(pillDragState.initialWinY + deltaY)
  pillWindow.setPosition(newX, newY)
})

ipcMain.on('dictation:drag-end', () => {
  pillDragState = null
})

// Detiene el backend (y sus hijos, p. ej. ffmpeg) de forma SÍNCRONA: debe terminar antes de
// salir y antes de que el instalador de una actualización reemplace meeting-backend.exe.
function stopPythonBackend() {
  const proc = pythonProcess
  pythonProcess = null
  if (!proc || !proc.pid || proc.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true })
  } else {
    try {
      proc.kill()
    } catch (e) {
      console.error('[Electron] Error al matar proceso:', e)
    }
  }
}

// ─────────────────────────────────────────
// Actualizaciones automáticas (electron-updater + GitHub Releases)
// Solo para el instalador .exe: la Microsoft Store gestiona sus propias actualizaciones.
// ─────────────────────────────────────────
let updateDialogOpen = false

async function isBackendBusy() {
  try {
    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/status`, { signal: AbortSignal.timeout(3000) })
    const status = await res.json()
    return Boolean(status.recording || status.processing)
  } catch {
    return false
  }
}

async function promptInstallUpdate(autoUpdater, info) {
  if (updateDialogOpen) return

  // No interrumpir una grabación ni una transcripción en curso
  if (await isBackendBusy()) {
    setTimeout(() => promptInstallUpdate(autoUpdater, info), UPDATE_BUSY_RETRY_MS)
    return
  }

  updateDialogOpen = true
  try {
    const options = {
      type: 'info',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Actualización disponible',
      message: 'Hay una actualización lista',
      detail: `La versión ${info?.version || 'nueva'} de Local Meeting Analyzer ya se descargó. ` +
        'Si eliges "Más tarde", se instalará automáticamente al cerrar la aplicación.',
    }
    const parent = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? mainWindow : null
    const { response } = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)

    if (response === 0) {
      isQuitting = true
      stopPythonBackend()
      // isSilent = true, isForceRunAfter = true: instala sin asistente y vuelve a abrir la app
      autoUpdater.quitAndInstall(true, true)
    }
  } catch (e) {
    console.error('[Updater] Error mostrando el diálogo de actualización:', e)
  } finally {
    updateDialogOpen = false
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged || process.windowsStore) return

  let autoUpdater
  try {
    ({ autoUpdater } = require('electron-updater'))
  } catch (e) {
    console.error('[Updater] electron-updater no está disponible:', e)
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Sin conexión, repositorio inexistente, etc.: solo se registra; nunca se interrumpe al usuario
  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err?.message || err)
  })
  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Descargando la versión ${info?.version}...`)
  })
  autoUpdater.on('update-downloaded', (info) => {
    promptInstallUpdate(autoUpdater, info)
  })

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] No se pudo buscar actualizaciones:', err?.message || err)
    })
  }
  setTimeout(checkForUpdates, UPDATE_CHECK_DELAY_MS)
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS)
}

// ─────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────
app.on('render-process-gone', (_event, _webContents, details) => {
  console.error(`[Electron] render-process-gone: ${details?.reason} (código ${details?.exitCode})`)
  mainLog.flush()
})
app.on('child-process-gone', (_event, details) => {
  console.error(`[Electron] child-process-gone: ${details?.type} ${details?.name || ''} ${details?.reason} (código ${details?.exitCode})`)
  mainLog.flush()
})

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return

  const info = getAppInfo()
  console.log(`[Electron] Local Meeting Analyzer v${info.version} · Electron ${info.electron} · ${os.type()} ${info.os} ${info.arch} · empaquetado: ${info.isPackaged}`)

  ensureOllamaRunning()
  startPythonBackend()
  createWindow()
  createTray()
  setupAutoUpdater()

  // Registrar atajo de teclado global Ctrl+Shift+R
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('shortcut:toggle-recording')
  })

  // Cargar atajo de dictado personalizado si existe en config.json
  try {
    const cfgPath = path.join(getBackendDataDir(), 'config.json')
    if (fs.existsSync(cfgPath)) {
      const savedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      if (savedCfg?.dictation_shortcut) {
        dictationShortcut = savedCfg.dictation_shortcut
      }
    }
  } catch (e) {
    console.warn('[Electron] No se pudo leer dictation_shortcut de config.json:', e)
  }

  // Micro-píldora y atajo global de dictado (Ctrl+Shift+D por defecto)
  createPillWindow()
  registerDictationShortcut(dictationShortcut)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  mainLog.flush()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopPythonBackend()
})

app.on('window-all-closed', () => {
  stopPythonBackend()
  if (process.platform !== 'darwin') app.quit()
})

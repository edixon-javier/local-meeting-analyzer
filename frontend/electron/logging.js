// electron/logging.js
// Registro local del proceso principal de Electron (sin dependencias y sin telemetría).
// Escribe en <userData>/logs/main.log y rota a main.log.old al superar 1 MB.
// Nada de lo que se registra sale del equipo: solo se usa para el soporte manual
// ("Copiar diagnóstico" en Ajustes > Ayuda y soporte).

const fs = require('fs')
const path = require('path')

const MAX_LOG_BYTES = 1024 * 1024 // 1 MB
const FLUSH_DELAY_MS = 500

const SECRET_RE = /sk-[A-Za-z0-9_-]{8,}/g

// Líneas de acceso del backend por sondeo periódico de la UI: se omiten del archivo
const NOISE_RE =
  /"(?:GET (?:\/status|\/session|\/status\/ollama-models|\/recording\/test\/levels|\/recording\/bookmarks)(?:\?\S*)?|OPTIONS \S+) HTTP\/[\d.]+" 2\d\d/

/** Reemplaza cualquier clave tipo sk-xxxxxxxx por sk-***. */
function maskSecrets(text) {
  return String(text).replace(SECRET_RE, 'sk-***')
}

/** Convierte los argumentos de console.* en una sola cadena. */
function formatArgs(args) {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

function createLogger(filePath) {
  let buffer = []
  let timer = null

  function rotateIfNeeded() {
    try {
      if (fs.statSync(filePath).size < MAX_LOG_BYTES) return
    } catch {
      return // el archivo aún no existe
    }
    try {
      const oldPath = `${filePath}.old`
      try {
        fs.unlinkSync(oldPath)
      } catch {
        // no había .old previo
      }
      fs.renameSync(filePath, oldPath)
    } catch {
      // Si no se puede rotar (archivo en uso), se sigue anexando al actual
    }
  }

  /** Escribe de forma síncrona lo pendiente. Se llama al cerrar y ante fallos graves. */
  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (buffer.length === 0) return
    const chunk = buffer.join('')
    buffer = []
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      rotateIfNeeded()
      fs.appendFileSync(filePath, chunk, 'utf8')
    } catch {
      // El registro nunca debe romper la aplicación
    }
  }

  function write(level, source, message) {
    const text = maskSecrets(message)
    if (NOISE_RE.test(text)) return
    const lines = text.split(/\r?\n/).filter((line, i, all) => line.length > 0 || i < all.length - 1)
    if (lines.length === 0) return
    const stamp = new Date().toISOString()
    // Una sola marca de tiempo por mensaje; las líneas siguientes (trazas) van con sangría
    buffer.push(`${stamp} ${level.padEnd(5)} [${source}] ${lines[0]}\n`)
    for (const line of lines.slice(1)) buffer.push(`    ${line}\n`)
    if (!timer) {
      timer = setTimeout(flush, FLUSH_DELAY_MS)
      if (typeof timer.unref === 'function') timer.unref()
    }
  }

  return { filePath, write, flush }
}

/** Últimas `count` líneas de un archivo de texto (vacío si no existe), con claves enmascaradas. */
function tailFile(filePath, count = 150) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return maskSecrets(content.split(/\r?\n/).filter(Boolean).slice(-count).join('\n'))
  } catch {
    return ''
  }
}

module.exports = { createLogger, maskSecrets, formatArgs, tailFile, MAX_LOG_BYTES }

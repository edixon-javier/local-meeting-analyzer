// src/utils/recordingName.js
// Nombres legibles para las grabaciones.
//
// El backend guarda las grabaciones como "meeting_AAAAMMDD_HHMMSS.mp3". Ese nombre técnico se
// mantiene en disco (es estable y ordenable), pero en la interfaz se muestra como
// "Reunión · 6 oct, 19:56". Si el usuario renombró la grabación (o subió un archivo con su
// propio nombre) se respeta su nombre tal cual.

const DEFAULT_NAME = /^meeting_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/

/** Nombre sin extensión. */
export function stripExtension(filename = '') {
  return String(filename).replace(/\.[^/.]+$/, '')
}

/** Fecha codificada en un nombre automático, o null si el nombre es personalizado. */
export function parseDefaultName(filename) {
  const m = DEFAULT_NAME.exec(stripExtension(filename))
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(date.getTime()) ? null : date
}

/** True si la grabación conserva el nombre automático (meeting_AAAAMMDD_HHMMSS). */
export function hasDefaultName(filename) {
  return parseDefaultName(filename) !== null
}

function formatShortDate(date) {
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const day = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${day.replace('.', '')}, ${time}`
}

/** Título para mostrar: el nombre del usuario o "Reunión · 6 oct, 19:56" para nombres automáticos. */
export function getRecordingTitle(filename) {
  const date = parseDefaultName(filename)
  if (date) return `Reunión · ${formatShortDate(date)}`
  return stripExtension(filename)
}

/** Duración legible: "45 s", "2:48 min", "1 h 05 min". */
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return null
  const total = Math.round(Number(seconds))
  if (total < 60) return `${total} s`
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m}:${String(s).padStart(2, '0')} min`
}

/**
 * Nombre sugerido al renombrar: el nombre actual si es personalizado; si es automático, el
 * tema detectado por el análisis (primer punto del resumen), acortado y sin caracteres
 * que Windows no admite en nombres de archivo.
 */
export function suggestRecordingName(rec) {
  if (!rec) return ''
  if (!hasDefaultName(rec.filename)) return stripExtension(rec.filename)
  const topic = (rec.summary_preview || '').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()
  if (!topic) return ''
  if (topic.length <= 60) return topic.replace(/[.…]+$/, '')
  const cut = topic.slice(0, 60)
  return cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 60).trim()
}

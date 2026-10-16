// src/utils/tasksExport.js
// Generador y descargador de compromisos y tareas en formato iCalendar (.ics) y CSV (compatible con Excel)

import { exportMeetingTasks, exportConsolidatedTasks } from '../api'

/**
 * Escapa valores para formato CSV estándar RFC 4180.
 */
export function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""'
  let str = String(val)
  // Neutralizar inyección de fórmulas (CWE-1236) y errores #NAME? en Excel (=, +, -, @, \t) si no es un número puro
  if (/^[=+\-@\t]/.test(str) && isNaN(Number(str))) {
    str = `'${str}`
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Genera contenido de texto plano / Markdown con checklist de compromisos para descarga directa.
 */
export function generateTasksText(tasks = [], { meetingTitle = 'Reunión' } = {}) {
  let txt = `TAREAS Y COMPROMISOS: ${meetingTitle}\n`
  txt += `======================================================================\n\n`
  if (!tasks || tasks.length === 0) {
    return txt + 'Sin compromisos registrados.\n'
  }
  tasks.forEach((t, idx) => {
    const status = t.completed ? '[X] Completada' : '[ ] Pendiente'
    const assignee = t.assignee || 'Sin asignar'
    const deadline = t.deadline || 'Sin fecha'
    txt += `${idx + 1}. ${status} - ${t.task || 'Sin descripción'}\n`
    txt += `   Responsable: ${assignee} | Fecha límite: ${deadline}\n\n`
  })
  return txt
}

/**
 * Genera contenido CSV de tareas con BOM UTF-8 (\ufeff) para compatibilidad nativa con Microsoft Excel.
 */
export function generateTasksCsv(tasks = [], { meetingTitle = 'Reunión', isConsolidated = false } = {}) {
  const rows = []

  if (isConsolidated) {
    rows.push(['Reunión', 'Fecha Reunión', 'Nº', 'Tarea / Compromiso', 'Responsable', 'Fecha Límite', 'Estado'].map(escapeCsvValue).join(','))
    tasks.forEach((t, idx) => {
      const meet = t.meeting_title || meetingTitle || 'Reunión'
      const meetDate = t.meeting_date || ''
      const taskText = t.task || ''
      const assignee = t.assignee || 'Sin asignar'
      const deadline = t.deadline || 'Sin fecha'
      const estado = t.completed ? 'Completada' : 'Pendiente'
      rows.push([meet, meetDate, idx + 1, taskText, assignee, deadline, estado].map(escapeCsvValue).join(','))
    })
  } else {
    rows.push(['Nº', 'Tarea / Compromiso', 'Responsable', 'Fecha Límite', 'Estado'].map(escapeCsvValue).join(','))
    tasks.forEach((t, idx) => {
      const taskText = t.task || ''
      const assignee = t.assignee || 'Sin asignar'
      const deadline = t.deadline || 'Sin fecha'
      const estado = t.completed ? 'Completada' : 'Pendiente'
      rows.push([idx + 1, taskText, assignee, deadline, estado].map(escapeCsvValue).join(','))
    })
  }

  // BOM UTF-8 al inicio para que Excel en Windows abra acentos y ñ sin caracteres extraños
  return '\ufeff' + rows.join('\r\n') + '\r\n'
}

/**
 * Escapa cadenas de texto para propiedades de iCalendar RFC 5545.
 */
export function escapeIcsText(text = '') {
  if (!text) return ''
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Realiza el line folding según la especificación RFC 5545 (máximo 75 octetos por línea).
 */
export function foldIcsLine(line) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line

  const chars = Array.from(line)
  const chunks = []
  let currentChunk = ''
  let currentLen = 0
  let maxLen = 75

  for (const ch of chars) {
    const chLen = encoder.encode(ch).length
    if (currentLen + chLen > maxLen) {
      chunks.push(currentChunk)
      currentChunk = ch
      currentLen = chLen
      maxLen = 74 // El espacio inicial de la continuación cuenta como 1 byte
    } else {
      currentChunk += ch
      currentLen += chLen
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.join('\r\n ')
}

const SPANISH_MONTHS = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, set: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12
}

/**
 * Intenta convertir un string de deadline en un objeto Date válido o null.
 * Soporta formatos ISO (con o sin hora), formatos latinos DD/MM/YYYY o DD/MM/YY,
 * números de uno o dos dígitos, y nombres textuales de mes en español.
 */
export function parseDeadlineDate(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string') return null
  const cleaned = deadlineStr.trim().toLowerCase()
  if (['sin fecha', 'ninguna', 'n/a', 'none', '-'].includes(cleaned)) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (cleaned === 'hoy') return today
  if (cleaned === 'mañana' || cleaned === 'manana') {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  }

  // 1. ISO YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (incluso con hora / T)
  const isoMatch = deadlineStr.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])(?=[^\d]|$)/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  // 2. DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, o con año de 2 dígitos DD/MM/YY
  const latamMatch = deadlineStr.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b/)
  if (latamMatch) {
    let year = Number(latamMatch[3])
    if (year < 100) year += 2000
    return new Date(year, Number(latamMatch[2]) - 1, Number(latamMatch[1]))
  }

  // 3. Formato textual en español: ej. '15 de octubre de 2026', '15 de octubre', '15 oct 2026'
  const textMatch = deadlineStr.match(/\b(0?[1-9]|[12]\d|3[01])\s+(?:de\s+)?([a-záéíóúñ]+)(?:\s+(?:del?\s+)?(20\d{2}|\d{2}))?\b/i)
  if (textMatch) {
    const day = Number(textMatch[1])
    const monthName = textMatch[2].toLowerCase()
    const month = SPANISH_MONTHS[monthName]
    if (month) {
      let year = textMatch[3] ? Number(textMatch[3]) : today.getFullYear()
      if (year < 100) year += 2000
      return new Date(year, month - 1, day)
    }
  }

  return null
}

function formatDateToIcsString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * Genera un archivo iCalendar (.ics) estándar RFC 5545 compatible con Google Calendar, Apple Calendar y Outlook.
 */
export function generateTasksIcs(tasks = [], { meetingTitle = 'Reunión', isConsolidated = false, calendarName = null } = {}) {
  const calTitle = calendarName || (isConsolidated ? 'Compromisos Consolidados' : `Compromisos - ${meetingTitle}`)
  const now = new Date()
  const nowUtc = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const rawLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Local Meeting Analyzer//Compromisos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calTitle)}`,
    'X-WR-TIMEZONE:UTC'
  ]

  tasks.forEach((t, idx) => {
    const taskNum = idx + 1
    const taskText = (t.task || `Compromiso ${taskNum}`).trim()
    const assignee = t.assignee || 'Sin asignar'
    const deadlineStr = t.deadline || 'Sin fecha'
    const completed = Boolean(t.completed)
    const meetName = t.meeting_title || meetingTitle || 'Reunión'

    let startDate = parseDeadlineDate(deadlineStr)
    if (!startDate && t.meeting_date) {
      startDate = parseDeadlineDate(t.meeting_date)
    }
    if (!startDate) {
      startDate = today
    }

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)

    const startStr = formatDateToIcsString(startDate)
    const endStr = formatDateToIcsString(endDate)

    const summaryTag = completed ? '[Compromiso - Completado]' : '[Compromiso]'
    const summaryParts = [`${summaryTag} ${taskText}`]
    if (assignee && assignee !== 'Sin asignar') {
      summaryParts.push(`(${assignee})`)
    }
    const summary = summaryParts.join(' ')

    const descLines = [
      `Compromiso: ${taskText}`,
      `Responsable: ${assignee}`,
      `Fecha límite: ${deadlineStr}`,
      `Estado: ${completed ? 'Completada' : 'Pendiente'}`,
      `Reunión origen: ${meetName}`
    ]
    const description = descLines.join('\n')

    const uid = `task-${taskNum}-${Math.random().toString(36).substring(2, 10)}@local-meeting-analyzer`
    // En RFC 5545 sección 3.8.3.8, en VEVENT los únicos estados válidos son CONFIRMED, TENTATIVE y CANCELLED
    const status = 'CONFIRMED'

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART;VALUE=DATE:${startStr}`,
      `DTEND;VALUE=DATE:${endStr}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `STATUS:${status}`,
    ]
    if (completed) {
      eventLines.push('X-STATUS:COMPLETED')
    }
    eventLines.push(
      'PRIORITY:1',
      'TRANSP:TRANSPARENT',
      'CATEGORIES:Compromisos,Reunión',
      'END:VEVENT'
    )
    rawLines.push(...eventLines)
  })

  rawLines.push('END:VCALENDAR')
  const folded = rawLines.map(foldIcsLine)
  return folded.join('\r\n') + '\r\n'
}

/**
 * Dispara la descarga en navegador usando un Blob o enlace virtual.
 */
export function triggerFileDownload(blobOrContent, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = blobOrContent instanceof Blob
    ? blobOrContent
    : new Blob([blobOrContent], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Descarga compromisos de una reunión individual en formato .ics o .csv.
 * Intenta invocar el endpoint del backend; si ocurre una falla de red, utiliza la generación local como fallback.
 */
export async function downloadMeetingTasks(filename, format = 'csv', tasks = [], meetingTitle = 'Reunión', showToast = null, options = {}) {
  const status = options?.status || 'all'
  const safeTitle = (meetingTitle || filename || 'compromisos')
    .replace(/[^\w\d\-_.]/g, '_')
    .replace(/_{2,}/g, '_')
  const downloadName = `compromisos_${safeTitle}.${format}`

  try {
    // 1. Intentar descargar mediante el endpoint optimizado del backend (solo ics y csv tienen endpoint)
    if (filename && format !== 'txt') {
      try {
        const response = await exportMeetingTasks(filename, format, status, meetingTitle)
        triggerFileDownload(
          response.data,
          downloadName,
          format === 'ics' ? 'text/calendar;charset=utf-8' : 'text/csv;charset=utf-8'
        )
        const formatLabel = format === 'ics' ? 'iCalendar (.ics)' : 'CSV (.csv)'
        const statusLabel = status === 'pending' ? ' pendientes' : (status === 'completed' ? ' completados' : '')
        showToast?.({
          type: 'success',
          message: `Compromisos${statusLabel} descargados en formato ${formatLabel}`
        })
        return true
      } catch (backendErr) {
        console.warn('[tasksExport] Backend export failed, using client fallback:', backendErr)
      }
    }

    // 2. Fallback de generación directa en frontend
    if (!tasks || tasks.length === 0) {
      showToast?.({
        type: 'warning',
        message: 'No hay compromisos disponibles para exportar.'
      })
      return false
    }

    const filteredTasks = status === 'pending'
      ? tasks.filter(t => !t.completed)
      : (status === 'completed' ? tasks.filter(t => Boolean(t.completed)) : tasks)

    if (filteredTasks.length === 0) {
      showToast?.({
        type: 'warning',
        message: status === 'pending'
          ? 'No hay compromisos pendientes para exportar.'
          : 'No hay compromisos completados para exportar.'
      })
      return false
    }

    const content = format === 'ics'
      ? generateTasksIcs(filteredTasks, { meetingTitle })
      : (format === 'txt'
          ? generateTasksText(filteredTasks, { meetingTitle })
          : generateTasksCsv(filteredTasks, { meetingTitle }))

    const mime = format === 'ics'
      ? 'text/calendar;charset=utf-8'
      : (format === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8')

    triggerFileDownload(content, downloadName, mime)
    const formatLabel = format === 'ics' ? 'iCalendar (.ics)' : (format === 'txt' ? 'Texto (.txt)' : 'CSV (.csv)')
    const statusLabel = status === 'pending' ? ' pendientes' : (status === 'completed' ? ' completados' : '')
    showToast?.({
      type: 'success',
      message: `Compromisos${statusLabel} generados y descargados en formato ${formatLabel}`
    })
    return true
  } catch (err) {
    showToast?.({
      type: 'error',
      message: `Error al exportar compromisos: ${err.message}`
    })
    return false
  }
}

/**
 * Descarga compromisos consolidados de todo el historial en formato .ics o .csv.
 */
export async function downloadConsolidatedTasks(format = 'csv', showToast = null, { status = 'all', category = null, tasks = [] } = {}) {
  // Asegurar que status sea un valor aceptado por el backend ('all', 'pending', 'completed')
  const validStatus = ['all', 'pending', 'completed'].includes(status) ? status : 'all'
  const downloadName = `compromisos_consolidados.${format}`

  try {
    // 1. Intentar endpoint consolidado de backend
    try {
      const response = await exportConsolidatedTasks(format, validStatus, category)
      triggerFileDownload(
        response.data,
        downloadName,
        format === 'ics' ? 'text/calendar;charset=utf-8' : 'text/csv;charset=utf-8'
      )
      const formatLabel = format === 'ics' ? 'iCalendar (.ics)' : 'CSV (.csv)'
      const statusLabel = validStatus === 'pending' ? ' pendientes' : ''
      showToast?.({
        type: 'success',
        message: `Compromisos${statusLabel} consolidados descargados en formato ${formatLabel}`
      })
      return true
    } catch (backendErr) {
      console.warn('[tasksExport] Consolidated backend export failed, using client fallback:', backendErr)
    }

    // 2. Fallback directo si se pasaron tareas
    if (!tasks || tasks.length === 0) {
      showToast?.({
        type: 'error',
        message: 'No se pudieron descargar los compromisos consolidados del servidor.'
      })
      return false
    }

    const filteredTasks = validStatus === 'pending'
      ? tasks.filter(t => !t.completed)
      : (validStatus === 'completed' ? tasks.filter(t => Boolean(t.completed)) : tasks)

    const content = format === 'ics'
      ? generateTasksIcs(filteredTasks, { isConsolidated: true, calendarName: 'Compromisos Consolidados' })
      : generateTasksCsv(filteredTasks, { isConsolidated: true })

    triggerFileDownload(
      content,
      downloadName,
      format === 'ics' ? 'text/calendar;charset=utf-8' : 'text/csv;charset=utf-8'
    )
    const formatLabel = format === 'ics' ? 'iCalendar (.ics)' : 'CSV (.csv)'
    showToast?.({
      type: 'success',
      message: `Compromisos consolidados generados y descargados en formato ${formatLabel}`
    })
    return true
  } catch (err) {
    showToast?.({
      type: 'error',
      message: `Error al exportar compromisos consolidados: ${err.message}`
    })
    return false
  }
}

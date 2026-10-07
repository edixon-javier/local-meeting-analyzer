// src/utils/support.js
// Utilidades compartidas de soporte (Ajustes > Ayuda y soporte y ErrorBoundary):
// información de la app, "Reportar problema" y copiar al portapapeles.
// Nada se envía automáticamente: el usuario decide si abre el reporte y qué pega en él.

import { APP_NAME, SUPPORT_EMAIL, ISSUES_URL, isPlaceholder } from '../appInfo'

const FALLBACK_INFO = {
  version: 'desconocida',
  electron: '',
  chrome: '',
  node: '',
  os: '',
  arch: '',
  isPackaged: false,
  isStore: false,
  dataDir: '',
  logsDir: '',
}

// Texto prefijado para el campo "pasos" del reporte
const STEPS_TEMPLATE = '1. \n2. \n3. '

const MAX_DETAILS_CHARS = 1500 // mantiene la URL del reporte por debajo del límite de GitHub (~8 KB)

/** Enmascara claves de API tipo sk-xxxxxxxx. */
export function maskSecrets(text) {
  return String(text ?? '').replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
}

/**
 * Información de la app desde Electron; valores neutros si se ejecuta en un navegador.
 * La versión de Electron tiene prioridad; `fallbackVersion` (p. ej. la del backend) solo se usa
 * cuando Electron no aporta ninguna. Si tampoco hay, queda 'desconocida'.
 */
export async function loadAppInfo({ fallbackVersion } = {}) {
  let info = { ...FALLBACK_INFO }
  try {
    const api = typeof window !== 'undefined' ? window.electronAPI : null
    if (api && typeof api.getAppInfo === 'function') {
      info = { ...FALLBACK_INFO, ...(await api.getAppInfo()) }
    }
  } catch (err) {
    console.warn('No se pudo obtener la información de la app:', err)
  }
  if (!info.version || info.version === FALLBACK_INFO.version) {
    info.version = fallbackVersion ? String(fallbackVersion) : FALLBACK_INFO.version
  }
  return info
}

/** "Windows 11 (10.0.26300), x64" a partir de os.release() de Electron. */
export function describeOs(info) {
  const release = info?.os || ''
  const build = parseInt(release.split('.')[2], 10)
  const name = Number.isFinite(build) ? (build >= 22000 ? 'Windows 11' : 'Windows 10') : 'Windows'
  const parts = [release ? `${name} (${release})` : name]
  if (info?.arch) parts.push(info.arch)
  if (info?.isStore) parts.push('Microsoft Store')
  return parts.join(', ')
}

/** True si hay al menos un canal real (repositorio de incidencias o correo) para reportar. */
export function canReportProblem() {
  return !isPlaceholder(ISSUES_URL) || !isPlaceholder(SUPPORT_EMAIL)
}

function buildMailBody(info, details) {
  return [
    'Describe el problema:',
    '',
    '',
    'Pasos para reproducirlo:',
    STEPS_TEMPLATE,
    '',
    details ? `Detalles del error:\n${details}\n` : '',
    '--- Datos de la aplicación ---',
    `Versión: ${info.version}`,
    `Sistema: ${describeOs(info)}`,
    '',
    'No se adjunta ningún registro automáticamente. Si quieres, pega aquí el diagnóstico',
    '(Ajustes > Ayuda y soporte > Copiar diagnóstico). Revisa que no contenga información privada.',
  ].join('\n')
}

/**
 * URL del canal de reporte: nuevo issue de GitHub si ISSUES_URL es real; si no, mailto: al
 * correo de soporte; si ninguno está configurado, null.
 * @returns {{ channel: 'github' | 'email', url: string } | null}
 */
export function buildReportTarget(info, { title = '', details = '' } = {}) {
  const safeDetails = maskSecrets(details).slice(0, MAX_DETAILS_CHARS)
  const baseTitle = title || `Problema en ${APP_NAME} ${info.version}`

  if (!isPlaceholder(ISSUES_URL)) {
    const params = new URLSearchParams()
    // Campos del formulario .github/ISSUE_TEMPLATE/bug_report.yml (por id)
    params.set('template', 'bug_report.yml')
    params.set('title', baseTitle)
    params.set('version', info.version)
    params.set('os', describeOs(info))
    params.set('steps', STEPS_TEMPLATE)
    if (safeDetails) params.set('what', safeDetails)
    // Respaldo (corto) si el repositorio no tiene el formulario: GitHub lo ignora al usar template
    params.set('body', buildMailBody(info, ''))
    return { channel: 'github', url: `${ISSUES_URL}/new?${params.toString()}` }
  }

  if (!isPlaceholder(SUPPORT_EMAIL)) {
    const subject = encodeURIComponent(baseTitle)
    const body = encodeURIComponent(buildMailBody(info, safeDetails))
    return { channel: 'email', url: `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}` }
  }

  return null
}

/** Abre una URL en el navegador/cliente de correo del sistema. */
export function openExternalUrl(url) {
  if (typeof window === 'undefined') return
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * "Reportar problema": abre el canal configurado con la plantilla prellenada.
 * @returns {'github' | 'email' | null} canal usado, o null si no hay ninguno configurado
 */
export async function reportProblem(options = {}) {
  const info = options.info || (await loadAppInfo())
  const target = buildReportTarget(info, options)
  if (!target) return null
  openExternalUrl(target.url)
  return target.channel
}

/** Copia texto al portapapeles; devuelve true si lo logró. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // se intenta el método alternativo
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Texto con el error, la pila de componentes y la versión (para "Copiar detalles"). */
export function formatErrorDetails({ error, componentStack, info }) {
  const lines = [
    `${APP_NAME} v${info?.version || 'desconocida'}`,
    `Sistema: ${describeOs(info)}`,
    '',
    `Error: ${error?.message || String(error ?? 'desconocido')}`,
  ]
  if (error?.stack) lines.push('', error.stack)
  if (componentStack) lines.push('', 'Pila de componentes:', componentStack.trim())
  return maskSecrets(lines.join('\n'))
}

// src/components/onboarding/openExternal.js
// Abre una URL http/https en el navegador del sistema. En Electron usa el puente seguro
// (preload.openExternal, que solo admite http/https); en navegador/desarrollo usa window.open.

export function openExternal(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
  } catch {
    return
  }
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export default openExternal

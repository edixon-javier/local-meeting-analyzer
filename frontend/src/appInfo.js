// src/appInfo.js
// Única fuente de verdad de los datos públicos de la app (soporte, repositorio, políticas).
// Mientras un valor siga siendo un marcador [ENTRE CORCHETES], la interfaz oculta o
// deshabilita el enlace correspondiente (ver isPlaceholder).
//
// ANTES DE PUBLICAR: sustituir los marcadores por los valores reales.

export const APP_NAME = 'Local Meeting Analyzer'

// Canal secundario de soporte (correo). Marcador: reemplazar por la dirección real.
export const SUPPORT_EMAIL = '[CORREO DE SOPORTE]'

// Repositorio público en GitHub, p. ej. 'https://github.com/usuario/local-meeting-analyzer'
export const REPO_URL = '[URL DEL REPOSITORIO]'

// Canal principal de soporte: GitHub Issues del repositorio
export const ISSUES_URL = `${REPO_URL.replace(/\/+$/, '')}/issues`

// Política de privacidad publicada (docs/privacy.html servida por GitHub Pages u otro host)
export const PRIVACY_URL = '[URL PÚBLICA DE docs/privacy.html]'

// Ficha de la app en Microsoft Store
export const STORE_URL = '[URL DE LA FICHA EN MICROSOFT STORE]'

/** True si el valor está vacío o sigue siendo un marcador [ENTRE CORCHETES]. */
export function isPlaceholder(value) {
  if (typeof value !== 'string' || value.trim() === '') return true
  return /\[[^\]]+\]/.test(value)
}

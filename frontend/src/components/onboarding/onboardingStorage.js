// src/components/onboarding/onboardingStorage.js
// Acceso seguro a localStorage para el onboarding y el consentimiento de grabación.
// Todo acceso va dentro de try/catch: en modo privado o con el almacenamiento bloqueado
// la app debe seguir funcionando (se vuelve a mostrar el aviso en cada sesión).

export const ONBOARDING_KEY = 'onboarding_completed_v1'
export const CONSENT_KEY = 'consent_accepted_v1'
// Se incrementa si el texto del aviso cambia de forma relevante (vuelve a pedirse la aceptación).
export const CONSENT_VERSION = 1

export function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorage(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignorar restricción de localStorage
  }
}

export function isOnboardingCompleted() {
  return Boolean(readStorage(ONBOARDING_KEY))
}

export function markOnboardingCompleted() {
  writeStorage(ONBOARDING_KEY, new Date().toISOString())
}

// Aceptación guardada solo en local: { version, acceptedAt }.
export function getConsentRecord() {
  const raw = readStorage(CONSENT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // Valor heredado no JSON (p. ej. "true"): se interpreta como aceptación de la versión 1
  }
  return { version: 1, acceptedAt: null }
}

export function isConsentAccepted() {
  const record = getConsentRecord()
  return Boolean(record) && Number(record.version || 1) >= CONSENT_VERSION
}

export function markConsentAccepted() {
  return writeStorage(
    CONSENT_KEY,
    JSON.stringify({ version: CONSENT_VERSION, acceptedAt: new Date().toISOString() })
  )
}

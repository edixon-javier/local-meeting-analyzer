// src/components/onboarding/useConsent.js
import { useContext } from 'react'
import { ConsentContext } from './consentContextDef'

// ensureConsent(): Promise<boolean>. Resuelve true de inmediato si ya hay consentimiento
// guardado; si no, muestra el modal y resuelve true al aceptar / false al cancelar.
// isConsentPending(): true mientras el modal está abierto (para ignorar atajos duplicados).
export function useConsent() {
  const context = useContext(ConsentContext)
  if (!context) {
    throw new Error('useConsent debe usarse dentro de un ConsentProvider')
  }
  return context
}

export default useConsent

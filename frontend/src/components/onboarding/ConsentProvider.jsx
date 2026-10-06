// src/components/onboarding/ConsentProvider.jsx
// Puerta de consentimiento común a los tres puntos de entrada de grabación
// (botón, atajo Ctrl+Shift+R y menú de la bandeja): ninguna grabación empieza
// hasta que el usuario acepta el aviso.

import { useCallback, useMemo, useRef, useState } from 'react'
import { ConsentContext } from './consentContextDef'
import ConsentModal from './ConsentModal'
import { isConsentAccepted, markConsentAccepted } from './onboardingStorage'
import { useSystem } from '../../hooks/useSystem'
import { t } from './consentText'

export default function ConsentProvider({ children }) {
  const { showToast } = useSystem()
  const [open, setOpen] = useState(false)
  const pendingRef = useRef(null) // { promise, resolve }

  const ensureConsent = useCallback(() => {
    if (isConsentAccepted()) return Promise.resolve(true)
    if (pendingRef.current) return pendingRef.current.promise

    let resolve
    const promise = new Promise((r) => {
      resolve = r
    })
    pendingRef.current = { promise, resolve }
    // Si la grabación se pidió desde el atajo o la bandeja con la ventana oculta,
    // hay que mostrarla para que el aviso sea visible.
    window.electronAPI?.show?.()
    setOpen(true)
    return promise
  }, [])

  const isConsentPending = useCallback(() => pendingRef.current !== null, [])

  const settle = useCallback((accepted) => {
    const pending = pendingRef.current
    pendingRef.current = null
    setOpen(false)
    pending?.resolve(accepted)
  }, [])

  const handleAccept = useCallback(() => {
    markConsentAccepted()
    settle(true)
  }, [settle])

  const handleCancel = useCallback(() => {
    showToast?.({ type: 'info', message: t('consent.blocked.message') })
    settle(false)
  }, [settle, showToast])

  const value = useMemo(() => ({ ensureConsent, isConsentPending }), [ensureConsent, isConsentPending])

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {open && <ConsentModal onAccept={handleAccept} onCancel={handleCancel} />}
    </ConsentContext.Provider>
  )
}

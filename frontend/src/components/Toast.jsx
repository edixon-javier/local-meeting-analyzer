// src/components/Toast.jsx
// Sistema de notificaciones flotantes en la esquina inferior derecha.
// Accesible: se anuncia por lector de pantalla (role status/alert), se pausa al pasar el ratón
// o al enfocarlo y se puede cerrar con su botón.

import { useEffect, useState } from 'react'
import Icon from './Icon'

const ICONS = { success: 'check-circle', error: 'alert-triangle', warning: 'alert-triangle', info: 'info' }
// Los errores permanecen más tiempo para que dé tiempo a leerlos
const DURATIONS = { error: 6500, warning: 5500, success: 4000, info: 4000 }

export default function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!toast || paused) return
    const timer = setTimeout(() => onDismiss(), DURATIONS[toast.type] || 4000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss, paused])

  if (!toast) return null

  const type = ICONS[toast.type] ? toast.type : 'info'
  const isError = type === 'error'

  return (
    <div className="toast-container">
      <div
        className={`toast ${type}`}
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <Icon name={ICONS[type]} size={16} className="toast-icon" />
        <span className="toast-message">{toast.message}</span>
        <button type="button" className="toast-close" onClick={onDismiss} aria-label="Cerrar notificación">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  )
}

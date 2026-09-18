// src/components/Toast.jsx
// Sistema de notificaciones flotantes en la esquina inferior derecha.

import { useEffect } from 'react'

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => onDismiss(), 4000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="toast-container">
      <div className={`toast ${toast.type}`} onClick={onDismiss} style={{ cursor: 'pointer' }}>
        {toast.message}
      </div>
    </div>
  )
}

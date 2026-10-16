import { useState, useRef } from 'react'
import { getStatus } from '../api'
import { useSystem } from '../hooks/useSystem'
import Icon from './Icon'
import { useFocusTrap } from './onboarding/useFocusTrap'

export default function OfflineOverlay() {
  const { isBackendOffline, isStartupComplete, showToast } = useSystem()
  const [retrying, setRetrying] = useState(false)
  const dialogRef = useRef(null)

  // Diálogo obligatorio: foco atrapado y sin cierre con Esc
  useFocusTrap(dialogRef, isStartupComplete && isBackendOffline)

  if (!isStartupComplete || !isBackendOffline) return null

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await getStatus()
      showToast({ type: 'success', message: 'Conexión restablecida con éxito' })
    } catch {
      showToast({ type: 'error', message: 'El backend sigue sin responder. Inténtalo de nuevo.' })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="glass"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="offline-overlay-title"
        aria-describedby="offline-overlay-desc"
        style={{
          padding: '40px 32px',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{
          marginBottom: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon name="alert-triangle" size={52} style={{ color: 'var(--red-record)' }} />
        </div>
        <h2 id="offline-overlay-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Conexión del Backend Perdida
        </h2>
        <p id="offline-overlay-desc" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
          No es posible comunicarse con el motor local de procesamiento. Reinicia la aplicación.
          {import.meta.env.DEV && (
            <>
              {' '}En desarrollo, asegúrate de que el backend de Python esté ejecutándose (ejecuta <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>start.bat</code>).
            </>
          )}
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="btn btn-primary"
          style={{
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 600,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          {retrying ? (
            <>
              <span className="spinner-small on-accent" style={{ width: 16, height: 16 }} aria-hidden="true" />
              Reintentando conexión...
            </>
          ) : (
            <>
              <Icon name="refresh" size={16} /> Reintentar Conexión
            </>
          )}
        </button>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {window.electronAPI?.reload && (
            <button
              type="button"
              onClick={() => window.electronAPI.reload()}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px 14px', fontSize: 13, justifyContent: 'center' }}
            >
              <Icon name="refresh" size={14} /> Recargar
            </button>
          )}
          {window.electronAPI?.openLogsFolder && (
            <button
              type="button"
              onClick={() => window.electronAPI.openLogsFolder()}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px 14px', fontSize: 13, justifyContent: 'center' }}
              title="Abrir registros para diagnóstico"
            >
              <Icon name="file-text" size={14} /> Ver registros
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

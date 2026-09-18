import { useState } from 'react'
import { getStatus } from '../api'
import { useSystem } from '../context/SystemContext'

export default function OfflineOverlay() {
  const { isBackendOffline, showToast } = useSystem()
  const [retrying, setRetrying] = useState(false)

  if (!isBackendOffline) return null

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
      <div className="glass" style={{
        padding: '40px 32px',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 460,
        border: '1px solid var(--border-subtle)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          animation: 'pulse 2s infinite ease-in-out',
          display: 'inline-block'
        }}>
          📡
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Conexión del Backend Perdida
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
          No es posible comunicarse con el motor local de procesamiento. Asegúrate de que el backend de Python esté ejecutándose (ejecuta <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>start.bat</code>).
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
              <span className="spinner-sm" style={{ borderLeftColor: 'transparent', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Reintentando conexión...
            </>
          ) : (
            'Reintentar Conexión'
          )}
        </button>
      </div>
    </div>
  )
}

// src/components/Sidebar.jsx
// Navegación lateral con estado del sistema y historial de reuniones.

import { useState, useEffect } from 'react'
import { updateConfig } from '../api'
import { useSystem } from '../context/SystemContext'
import { useRecordings } from '../context/RecordingsContext'

export default function Sidebar({ currentView, onNavigate }) {
  const { systemStatus, showToast, isBackendOffline } = useSystem()
  const { 
    recordings, 
    loadRecordings, 
    setDeletingFile, 
    setRenamingFile, 
    setNewNameInput, 
    formatDate 
  } = useRecordings()
  const [filterQuery, setFilterQuery] = useState('')

  useEffect(() => {
    if (!isBackendOffline) {
      loadRecordings()
    }
  }, [currentView, isBackendOffline]) // Recargar cuando cambie la vista o la conexión

  const handleToggleProvider = async () => {
    if (isBackendOffline) return
    const newProvider = systemStatus?.ai_provider === 'local' ? 'openai' : 'local'
    try {
      await updateConfig({ ai_provider: newProvider })
      showToast({ type: 'success', message: `⚙️ Procesamiento cambiado a: ${newProvider === 'local' ? 'Local' : 'Nube (OpenAI)'}` })
    } catch (e) {
      showToast({ type: 'error', message: 'Error al cambiar de proveedor' })
    }
  }

  // Filtrar grabaciones locales en la barra lateral
  const filteredRecs = recordings.filter(rec => 
    rec.filename.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const handleDeleteClick = (e, filename) => {
    e.stopPropagation()
    if (isBackendOffline) return
    setDeletingFile(filename)
  }

  const handleRenameClick = (e, rec) => {
    e.stopPropagation()
    if (isBackendOffline) return
    const cleanName = rec.filename.replace(/\.(wav|mp3)$/i, '')
    setRenamingFile(rec)
    setNewNameInput(cleanName)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🎙️</div>
          <div>
            <div className="sidebar-logo-text">MeetingAI</div>
            <div className="sidebar-logo-sub">100% Local</div>
          </div>
        </div>

        {/* Estado del sistema */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Estado del sistema</span>
            <button 
              onClick={handleToggleProvider}
              disabled={isBackendOffline}
              title={isBackendOffline ? 'Sin conexión al backend' : 'Cambiar entre 100% Local y Procesamiento en la Nube (OpenAI)'}
              style={{
                background: isBackendOffline 
                  ? 'var(--bg-surface)' 
                  : (systemStatus?.ai_provider === 'openai' ? 'var(--accent-violet)' : 'var(--bg-surface)'),
                color: isBackendOffline
                  ? 'var(--text-muted)'
                  : (systemStatus?.ai_provider === 'openai' ? '#fff' : 'var(--text-secondary)'),
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '10px',
                cursor: isBackendOffline ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: isBackendOffline ? 0.5 : 1
              }}
            >
              {isBackendOffline ? '⚠️ Offline' : (systemStatus?.ai_provider === 'openai' ? '☁️ Nube' : '💻 Local')}
            </button>
          </div>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', marginTop: 6 }}>
            <div className="status-indicator" style={{ marginBottom: 6 }}>
              <span className={`status-dot ${(!isBackendOffline && systemStatus?.ollama_running) ? 'online' : 'offline'}`} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Ollama {(!isBackendOffline && systemStatus?.ollama_running) ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="status-indicator">
              <span className={`status-dot ${!isBackendOffline ? 'online' : 'offline'}`} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Whisper {!isBackendOffline ? `(${systemStatus?.whisper_model || 'small'})` : 'desconectado'}
              </span>
            </div>
          </div>
        </div>

        {/* Nav principal */}
        <div className="sidebar-section-label">Navegación</div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${currentView === 'record' ? 'active' : ''}`}
            onClick={() => onNavigate('record')}
          >
            <span className="nav-icon">🎙️</span>
            Nueva Grabación
          </button>
          <button
            className={`sidebar-nav-item ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            <span className="nav-icon">📁</span>
            Historial
          </button>
          <button
            className={`sidebar-nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
          >
            <span className="nav-icon">⚙️</span>
            Configuración
          </button>
        </nav>
      </div>

      {/* Lista de grabaciones recientes */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Recientes</span>
          <input 
            type="text" 
            placeholder="Filtrar..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            disabled={isBackendOffline}
            style={{
              width: '75px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '10px',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              opacity: isBackendOffline ? 0.5 : 1
            }}
          />
        </div>
      </div>
      <div className="sidebar-meetings">
        {isBackendOffline ? (
          <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Servidor desconectado
          </div>
        ) : filteredRecs.length === 0 ? (
          <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Aún no hay grabaciones
          </div>
        ) : (
          filteredRecs.slice(0, 15).map((rec) => (
            <div
              key={rec.filename}
              className={`meeting-item ${currentView === 'analysis' && rec.path.includes(rec.filename) ? 'active' : ''}`}
              onClick={() => !isBackendOffline && onNavigate('analysis', { path: rec.path })}
              style={{ position: 'relative', cursor: isBackendOffline ? 'not-allowed' : 'pointer' }}
              title={rec.filename}
            >
              <div className="meeting-item-name" style={{ paddingRight: 45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {rec.filename.replace(/\.(wav|mp3)$/i, '')}
              </div>
              <div className="meeting-item-meta">
                {formatDate(rec.created)} · {rec.size_mb} MB
              </div>
              
              {!isBackendOffline && (
                <div style={{ position: 'absolute', right: 8, top: 12, display: 'flex', gap: 4 }}>
                  <button 
                    onClick={(e) => handleRenameClick(e, rec)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: 10, minWidth: 'unset', opacity: 0.7 }}
                    title="Renombrar"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(e, rec.filename)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: 10, minWidth: 'unset', opacity: 0.7, background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--red-record)' }}
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}


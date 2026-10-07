// src/components/Sidebar.jsx
// Navegación lateral con estado del sistema y historial de reuniones.

import { useState, useEffect, useRef } from 'react'
import { updateConfig } from '../api'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import Icon from './Icon'
import logoImg from '../assets/icon.jpg'

// Compara rutas sin depender de mayúsculas ni del separador (\ o /) que devuelva el backend
function samePath(a, b) {
  if (!a || !b) return false
  const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase()
  return norm(a) === norm(b)
}

export default function Sidebar({ currentView, currentAudioPath, onNavigate }) {
  const { systemStatus, showToast, isBackendOffline } = useSystem()
  const { 
    recordings, 
    setDeletingFile, 
    setRenamingFile, 
    setNewNameInput, 
    formatDate 
  } = useRecordings()
  const [filterQuery, setFilterQuery] = useState('')
  const meetingsListRef = useRef(null)

  // Al abrir una reunión (p. ej. desde Historial) se desplaza la lista para que la activa sea visible
  useEffect(() => {
    if (currentView !== 'analysis') return
    const active = meetingsListRef.current?.querySelector('.meeting-item.active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [currentView, currentAudioPath, recordings])

  const handleToggleProvider = async () => {
    if (isBackendOffline) return
    const newProvider = systemStatus?.ai_provider === 'local' ? 'openai' : 'local'
    try {
      await updateConfig({ ai_provider: newProvider })
      showToast({ type: 'success', message: `Procesamiento cambiado a: ${newProvider === 'local' ? 'Local' : 'Nube (OpenAI)'}` })
    } catch {
      showToast({ type: 'error', message: 'Error al cambiar de proveedor' })
    }
  }

  // Filtrar grabaciones locales en la barra lateral
  const filteredRecs = recordings.filter(rec => 
    rec.filename.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const openRecording = (rec) => {
    if (isBackendOffline) return
    onNavigate('analysis', { path: rec.path })
  }

  // Los items son role="button": Enter y Espacio los abren (solo si el foco está en el propio item)
  const handleItemKeyDown = (e, rec) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openRecording(rec)
    }
  }

  const handleDeleteClick = (e, filename) => {
    e.stopPropagation()
    if (isBackendOffline) return
    setDeletingFile(filename)
  }

  const handleRenameClick = (e, rec) => {
    e.stopPropagation()
    if (isBackendOffline) return
    const cleanName = rec.filename.replace(/\.[^/.]+$/, '')
    setRenamingFile(rec)
    setNewNameInput(cleanName)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {/* Logo */}
        <div className="sidebar-logo">
          <img src={logoImg} alt="" className="sidebar-logo-icon" style={{ objectFit: 'cover' }} />
          <div>
            <div className="sidebar-logo-text">MeetingAI</div>
            <div className="sidebar-logo-sub">
              <Icon name={systemStatus?.ai_provider === 'openai' ? 'cloud' : 'lock'} size={12} style={{ marginRight: 4 }} />
              {systemStatus?.ai_provider === 'openai' ? 'OpenAI Cloud' : '100% Local'}
            </div>
          </div>
        </div>

        {/* Estado del sistema */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Estado del sistema</span>
            <button
              type="button"
              onClick={handleToggleProvider}
              disabled={isBackendOffline}
              className={`provider-chip ${!isBackendOffline && systemStatus?.ai_provider === 'openai' ? 'is-cloud' : ''}`}
              title={isBackendOffline ? 'Sin conexión al backend' : 'Cambiar entre 100% Local y Procesamiento en la Nube (OpenAI)'}
              aria-label={isBackendOffline
                ? 'Proveedor de IA no disponible: sin conexión'
                : `Proveedor de IA: ${systemStatus?.ai_provider === 'openai' ? 'Nube (OpenAI)' : 'Local'}. Pulsa para cambiar`}
            >
              <Icon name={isBackendOffline ? 'alert-triangle' : (systemStatus?.ai_provider === 'openai' ? 'cloud' : 'lock')} size={11} />
              {isBackendOffline ? 'Offline' : (systemStatus?.ai_provider === 'openai' ? 'Nube' : 'Local')}
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
        <nav className="sidebar-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`sidebar-nav-item ${currentView === 'record' ? 'active' : ''}`}
            onClick={() => onNavigate('record')}
            aria-current={currentView === 'record' ? 'page' : undefined}
          >
            <span className="nav-icon"><Icon name="mic" size={17} /></span>
            Nueva Grabación
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
            aria-current={currentView === 'history' ? 'page' : undefined}
          >
            <span className="nav-icon"><Icon name="folder" size={17} /></span>
            Historial
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${currentView === 'history-chat' ? 'active' : ''}`}
            onClick={() => !isBackendOffline && onNavigate('history-chat')}
            disabled={isBackendOffline}
            aria-current={currentView === 'history-chat' ? 'page' : undefined}
            title={isBackendOffline ? 'Sin conexión al backend' : 'Preguntar al historial de reuniones'}
          >
            <span className="nav-icon"><Icon name="chat" size={17} /></span>
            Preguntar al Historial
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
            aria-current={currentView === 'settings' ? 'page' : undefined}
          >
            <span className="nav-icon"><Icon name="settings" size={17} /></span>
            Configuración
          </button>
        </nav>
      </div>

      {/* Lista de grabaciones recientes */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span id="sidebar-recents-label">Recientes</span>
          <input
            type="search"
            className="sidebar-filter"
            placeholder="Filtrar…"
            aria-label="Filtrar grabaciones recientes"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setFilterQuery('') }}
            disabled={isBackendOffline}
          />
        </div>
      </div>
      <div className="sidebar-meetings" ref={meetingsListRef} role="list" aria-labelledby="sidebar-recents-label">
        {isBackendOffline ? (
          <div className="sidebar-empty">Servidor desconectado</div>
        ) : filteredRecs.length === 0 ? (
          <div className="sidebar-empty">
            {filterQuery.trim() ? `Sin coincidencias para «${filterQuery.trim()}»` : 'Aún no hay grabaciones'}
          </div>
        ) : (
          filteredRecs.slice(0, 15).map((rec) => {
            const name = rec.filename.replace(/\.[^/.]+$/, '')
            const isActive = currentView === 'analysis' && samePath(currentAudioPath, rec.path)
            return (
              <div key={rec.filename} role="listitem">
                <div
                  className={`meeting-item ${isActive ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Abrir ${name}, ${formatDate(rec.created)}`}
                  onClick={() => openRecording(rec)}
                  onKeyDown={(e) => handleItemKeyDown(e, rec)}
                  title={rec.filename}
                  style={{ position: 'relative' }}
                >
                  <div className="meeting-item-name">{name}</div>
                  <div className="meeting-item-meta">
                    {formatDate(rec.created)} · {rec.size_mb} MB
                  </div>

                  <div className="meeting-item-actions">
                    <button
                      type="button"
                      onClick={(e) => handleRenameClick(e, rec)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="btn btn-secondary btn-square btn-sm"
                      title="Renombrar"
                      aria-label={`Renombrar ${name}`}
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, rec.filename)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="btn btn-danger btn-square btn-sm"
                      title="Eliminar"
                      aria-label={`Eliminar ${name}`}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}


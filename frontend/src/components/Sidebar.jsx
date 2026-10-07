// src/components/Sidebar.jsx
// Navegación lateral y grabaciones recientes. El estado del motor vive en la barra inferior;
// aquí solo aparece un aviso cuando algo requiere atención.

import { useState, useEffect, useRef } from 'react'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import { getEngineStatus } from '../utils/engineStatus'
import { getRecordingTitle, hasDefaultName, formatDuration, suggestRecordingName } from '../utils/recordingName'
import { APP_NAME } from '../appInfo'
import Icon from './Icon'
import logoImg from '../assets/icon.jpg'

const MAX_RECENTS = 15

// Compara rutas sin depender de mayúsculas ni del separador (\ o /) que devuelva el backend
function samePath(a, b) {
  if (!a || !b) return false
  const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase()
  return norm(a) === norm(b)
}

export default function Sidebar({ currentView, currentAudioPath, onNavigate }) {
  const { systemStatus, isBackendOffline } = useSystem()
  const engine = getEngineStatus(systemStatus, isBackendOffline)
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

  // Busca en el nombre de archivo, el título legible y el tema detectado por el análisis
  const query = filterQuery.trim().toLowerCase()
  const filteredRecs = query
    ? recordings.filter((rec) =>
        [rec.filename, getRecordingTitle(rec.filename), rec.summary_preview]
          .some((text) => (text || '').toLowerCase().includes(query)))
    : recordings

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
    setRenamingFile(rec)
    setNewNameInput(suggestRecordingName(rec))
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {/* Marca */}
        <div className="sidebar-logo">
          <img src={logoImg} alt="" className="sidebar-logo-icon" style={{ objectFit: 'cover' }} />
          <div className="sidebar-logo-text">{APP_NAME}</div>
        </div>

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

        {/* Aviso solo cuando el motor necesita atención (el detalle está en la barra inferior) */}
        {engine.attention && !isBackendOffline && (
          <button
            type="button"
            className={`sidebar-attention tone-${engine.tone}`}
            onClick={() => onNavigate('settings')}
          >
            <Icon name="alert-triangle" size={15} />
            <div>
              <strong>{engine.attention.title}</strong>
              <span>{engine.attention.detail}</span>
              <span className="sidebar-attention-cta">Revisar configuración</span>
            </div>
          </button>
        )}
      </div>

      {/* Lista de grabaciones recientes */}
      <div className="sidebar-recents-header">
        <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, margin: 0 }}>
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
            {query ? `Sin coincidencias para «${filterQuery.trim()}»` : 'Aún no hay grabaciones'}
          </div>
        ) : (
          filteredRecs.slice(0, MAX_RECENTS).map((rec) => {
            const name = getRecordingTitle(rec.filename)
            const duration = formatDuration(rec.duration)
            // Segunda línea: el tema detectado si existe; si no, duración (y fecha si el título no la lleva)
            const meta = rec.summary_preview
              || [duration, hasDefaultName(rec.filename) ? null : formatDate(rec.created), rec.has_metadata ? null : 'Sin analizar']
                .filter(Boolean).join(' · ')
            const isActive = currentView === 'analysis' && samePath(currentAudioPath, rec.path)
            return (
              <div key={rec.filename} role="listitem">
                <div
                  className={`meeting-item ${isActive ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Abrir ${name}${duration ? `, ${duration}` : ''}`}
                  onClick={() => openRecording(rec)}
                  onKeyDown={(e) => handleItemKeyDown(e, rec)}
                  title={[name, rec.summary_preview, duration, rec.filename].filter(Boolean).join('\n')}
                  style={{ position: 'relative' }}
                >
                  <div className="meeting-item-name">{name}</div>
                  <div className="meeting-item-meta">{meta}</div>

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
        {!isBackendOffline && !query && recordings.length > MAX_RECENTS && (
          <button type="button" className="sidebar-see-all" onClick={() => onNavigate('history')}>
            Ver las {recordings.length} grabaciones en Historial
          </button>
        )}
      </div>
    </aside>
  )
}

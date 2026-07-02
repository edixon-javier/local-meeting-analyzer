// src/components/HistoryScreen.jsx
// Pantalla completa del Historial de reuniones con buscador, filtros y gestión (renombrar/eliminar).

import { useState, useEffect } from 'react'
import { useSystem } from '../context/SystemContext'
import { useRecordings } from '../context/RecordingsContext'

export default function HistoryScreen({ onNavigate }) {
  const { isBackendOffline } = useSystem()
  const { 
    recordings, 
    loading, 
    loadRecordings, 
    setDeletingFile, 
    setRenamingFile, 
    setNewNameInput, 
    formatDate 
  } = useRecordings()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dateSort, setDateSort] = useState('newest') // newest | oldest

  useEffect(() => {
    if (!isBackendOffline) {
      loadRecordings()
    }
  }, [isBackendOffline])

  // Filtrado y ordenamiento de reuniones
  const filteredRecordings = recordings.filter(rec => {
    const cleanName = rec.filename.replace(/\.(wav|mp3)$/i, '').toLowerCase()
    const matchesSearch = cleanName.includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || rec.category === categoryFilter
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    return dateSort === 'newest' ? b.created - a.created : a.created - b.created
  })

  // Obtener categorías únicas del listado de reuniones
  const categories = ['All', ...new Set(recordings.map(r => r.category).filter(Boolean))]

  const handleOpenDetails = (rec) => {
    if (isBackendOffline) return
    onNavigate('analysis', { path: rec.path })
  }

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

  if (isBackendOffline) {
    return (
      <div className="history-screen" style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450 }}>
          <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Servidor Desconectado</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            El historial no se puede cargar porque el motor local de la aplicación no está disponible.
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" />
        <div className="processing-label">Cargando historial de reuniones...</div>
      </div>
    )
  }

  return (
    <div className="history-screen" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* Cabecera */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Historial de Reuniones</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Administra, busca y revisa los análisis de tus reuniones guardadas localmente.</p>
        </div>
      </div>

      {/* Barra de Filtros e Búsqueda */}
      <div className="filters-container" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Buscar reunión por título..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 13
          }}
        />

        {/* Filtro de Categoría */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 13,
            minWidth: 150
          }}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'Todas las Categorías' : c}</option>
          ))}
        </select>

        {/* Ordenar por Fecha */}
        <select
          value={dateSort}
          onChange={(e) => setDateSort(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 13
          }}
        >
          <option value="newest">Más recientes primero</option>
          <option value="oldest">Más antiguos primero</option>
        </select>
      </div>

      {/* Listado de Reuniones */}
      <div style={{ flex: 1 }}>
        {filteredRecordings.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 0', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">No se encontraron reuniones</div>
            <div className="empty-state-sub">Prueba con otros términos de búsqueda o filtros.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredRecordings.map(rec => (
              <div 
                key={rec.filename} 
                className="meeting-card glass"
                onClick={() => handleOpenDetails(rec)}
                style={{
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ overflow: 'hidden', paddingRight: 40 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={rec.filename.replace(/\.(wav|mp3)$/i, '')}>
                      {rec.filename.replace(/\.(wav|mp3)$/i, '')}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(rec.created)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, position: 'absolute', right: 16, top: 16 }}>
                    <button 
                      onClick={(e) => handleRenameClick(e, rec)} 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      title="Renombrar"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(e, rec.filename)} 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--red-record)' }}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📁 {rec.size_mb} MB</span>
                  {rec.has_metadata ? (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--green-glow)', color: 'var(--green-ok)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      Analizado 🧠
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      Sin análisis 🎙️
                    </span>
                  )}
                </div>

                {rec.has_metadata && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {rec.category && <span className="pill category" style={{ fontSize: 11, padding: '2px 8px' }}>{rec.category}</span>}
                    {rec.tone && <span className="pill tone" style={{ fontSize: 11, padding: '2px 8px' }}>🎭 {rec.tone}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

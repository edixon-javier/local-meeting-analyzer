import { useState, useEffect } from 'react'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import { getRecordingMetadata } from '../api'
import Icon from './Icon'
import { 
  copyExecutiveMinutes, 
  downloadExecutiveMarkdown, 
  exportExecutivePdf,
  formatTime 
} from '../utils/minutesExport'

export default function HistoryScreen({ onNavigate }) {
  const { isBackendOffline, showToast } = useSystem()
  const { 
    recordings, 
    loading, 
    isRefreshing,
    loadRecordings, 
    setDeletingFile, 
    setRenamingFile, 
    setNewNameInput, 
    formatDate 
  } = useRecordings()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dateSort, setDateSort] = useState('newest') // newest | oldest
  const [exportingMeeting, setExportingMeeting] = useState(null)

  useEffect(() => {
    if (!isBackendOffline) {
      loadRecordings({ silent: true })
    }
  }, [isBackendOffline, loadRecordings])

  // Filtrado y ordenamiento de reuniones
  const filteredRecordings = recordings.filter(rec => {
    const cleanName = rec.filename.replace(/\.[^/.]+$/, '').toLowerCase()
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
    const cleanName = rec.filename.replace(/\.[^/.]+$/, '')
    setRenamingFile(rec)
    setNewNameInput(cleanName)
  }

  const handleExportClick = async (e, rec) => {
    e.stopPropagation()
    if (isBackendOffline) return
    try {
      const res = await getRecordingMetadata(rec.path)
      if (res.data && res.data.exists !== false) {
        setExportingMeeting({
          ...res.data,
          title: rec.filename.replace(/\.[^/.]+$/, ''),
          createdDate: formatDate(rec.created)
        })
      } else {
        showToast?.({ type: 'warning', message: 'No se encontraron metadatos para esta reunión' })
      }
    } catch {
      showToast?.({ type: 'error', message: 'Error cargando metadatos de la reunión' })
    }
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

  if (loading && recordings.length === 0) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Historial de Reuniones</h1>
            {isRefreshing && (
              <span style={{ fontSize: 11, color: 'var(--text-accent)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
                <span className="spinner-small" style={{ width: 10, height: 10, borderWidth: 2 }} /> Actualizando...
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Administra, busca y revisa los análisis de tus reuniones guardadas localmente.</p>
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
            <div className="empty-state-icon" style={{ opacity: 0.6 }}>
              <Icon name="search" size={32} />
            </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={rec.filename.replace(/\.[^/.]+$/, '')}>
                      {rec.filename.replace(/\.[^/.]+$/, '')}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(rec.created)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    {rec.has_metadata && (
                      <button 
                        onClick={(e) => handleExportClick(e, rec)} 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.3)', color: 'var(--text-accent)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        title="Exportar Minuta Ejecutiva (PDF, MD, Copiar)"
                      >
                        <Icon name="file-text" size={13} />
                        <span>Minuta</span>
                      </button>
                    )}
                    <button 
                      onClick={(e) => handleRenameClick(e, rec)} 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Renombrar"
                      aria-label="Renombrar reunión"
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(e, rec.filename)} 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--red-record)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Eliminar"
                      aria-label="Eliminar reunión"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="folder" size={12} /> {rec.size_mb} MB
                  </span>
                  {rec.has_metadata ? (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--green-glow)', color: 'var(--green-ok)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="check-circle" size={11} /> Analizado
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="mic" size={11} /> Sin análisis
                    </span>
                  )}
                  {rec.bookmarks_count > 0 && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="bookmark" size={11} /> {rec.bookmarks_count} {rec.bookmarks_count === 1 ? 'marcador' : 'marcadores'}
                    </span>
                  )}
                </div>

                {rec.has_metadata && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {rec.category && <span className="pill category" style={{ fontSize: 11, padding: '2px 8px' }}>{rec.category}</span>}
                    {rec.tone && <span className="pill tone" style={{ fontSize: 11, padding: '2px 8px' }}>{rec.tone}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Exportación de Minuta desde Historial */}
      {exportingMeeting && (
        <div 
          className="modal-overlay"
          onClick={() => setExportingMeeting(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              padding: 24, borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="file-text" size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Minuta Ejecutiva
                </h3>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setExportingMeeting(null)}
                style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Cerrar modal"
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-accent)', marginBottom: 6 }}>
              {exportingMeeting.title}
            </p>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {exportingMeeting.createdDate && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="calendar" size={12} /> {exportingMeeting.createdDate}
                </span>
              )}
              {exportingMeeting.analysis?.category && <span>{exportingMeeting.analysis.category}</span>}
              {exportingMeeting.analysis?.tone && <span>{exportingMeeting.analysis.tone}</span>}
            </div>

            {exportingMeeting.analysis?.summary && exportingMeeting.analysis.summary.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Puntos destacados:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {exportingMeeting.analysis.summary.slice(0, 3).map((pt, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  const data = {
                    title: exportingMeeting.title,
                    date: exportingMeeting.createdDate || '',
                    category: exportingMeeting.analysis?.category || 'General',
                    tone: exportingMeeting.analysis?.tone || 'Profesional',
                    durationInsight: exportingMeeting.analysis?.duration_insight || '',
                    summary: exportingMeeting.analysis?.summary || [],
                    keyDecisions: exportingMeeting.analysis?.key_decisions || [],
                    actionItems: exportingMeeting.analysis?.action_items || [],
                    segments: exportingMeeting.segments || [],
                    transcript: exportingMeeting.transcript || '',
                    bookmarks: exportingMeeting.bookmarks || []
                  }
                  await copyExecutiveMinutes(data, showToast)
                  setExportingMeeting(null)
                }}
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="copy" size={15} /> Copiar Minuta (Slack / Email)
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  const data = {
                    title: exportingMeeting.title,
                    date: exportingMeeting.createdDate || '',
                    category: exportingMeeting.analysis?.category || 'General',
                    tone: exportingMeeting.analysis?.tone || 'Profesional',
                    durationInsight: exportingMeeting.analysis?.duration_insight || '',
                    summary: exportingMeeting.analysis?.summary || [],
                    keyDecisions: exportingMeeting.analysis?.key_decisions || [],
                    actionItems: exportingMeeting.analysis?.action_items || [],
                    segments: exportingMeeting.segments || [],
                    transcript: exportingMeeting.transcript || '',
                    bookmarks: exportingMeeting.bookmarks || []
                  }
                  downloadExecutiveMarkdown(data, exportingMeeting.title, showToast)
                  setExportingMeeting(null)
                }}
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="download" size={15} /> Descargar Markdown (.md)
              </button>

              <button
                className="btn btn-primary"
                onClick={async () => {
                  const data = {
                    title: exportingMeeting.title,
                    date: exportingMeeting.createdDate || '',
                    category: exportingMeeting.analysis?.category || 'General',
                    tone: exportingMeeting.analysis?.tone || 'Profesional',
                    durationInsight: exportingMeeting.analysis?.duration_insight || '',
                    summary: exportingMeeting.analysis?.summary || [],
                    keyDecisions: exportingMeeting.analysis?.key_decisions || [],
                    actionItems: exportingMeeting.analysis?.action_items || [],
                    segments: exportingMeeting.segments || [],
                    transcript: exportingMeeting.transcript || '',
                    bookmarks: exportingMeeting.bookmarks || []
                  }
                  await exportExecutivePdf(data, exportingMeeting.title, showToast)
                }}
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="file-text" size={15} /> Exportar / Imprimir PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plantilla oculta para impresión si se lanza PDF desde Historial */}
      {exportingMeeting && (
        <div className="executive-print-report" aria-hidden="true">
          <div className="print-header">
            <div className="print-badge-header">MEETING ANALYZER &bull; MINUTA EJECUTIVA OFICIAL</div>
            <h1 className="print-title">📋 Minuta Ejecutiva: {exportingMeeting.title}</h1>
            <div className="print-meta-row">
              {exportingMeeting.createdDate && <span>📅 {exportingMeeting.createdDate}</span>}
              <span>🏷️ <strong>Categoría:</strong> {exportingMeeting.analysis?.category || 'General'}</span>
              <span>🎭 <strong>Tono:</strong> {exportingMeeting.analysis?.tone || 'Neutro'}</span>
            </div>
            {exportingMeeting.analysis?.duration_insight && (
              <div className="print-insight-box">
                💡 <strong>Observación:</strong> {exportingMeeting.analysis.duration_insight}
              </div>
            )}
          </div>

          <div className="print-section">
            <h2 className="print-section-title">📌 Resumen Ejecutivo</h2>
            <ul className="print-summary-list">
              {exportingMeeting.analysis?.summary && exportingMeeting.analysis.summary.length > 0 ? (
                exportingMeeting.analysis.summary.map((pt, idx) => <li key={idx}>{pt}</li>)
              ) : (
                <li>Sin puntos de resumen.</li>
              )}
            </ul>
          </div>

          {exportingMeeting.analysis?.key_decisions && exportingMeeting.analysis.key_decisions.length > 0 && (
            <div className="print-section">
              <h2 className="print-section-title">🎯 Decisiones Clave</h2>
              <ul className="print-decisions-list">
                {exportingMeeting.analysis.key_decisions.map((dec, idx) => <li key={idx}>{dec}</li>)}
              </ul>
            </div>
          )}

          <div className="print-section">
            <h2 className="print-section-title">✅ Tareas y Compromisos</h2>
            <table className="print-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>OK</th>
                  <th>Tarea / Acción</th>
                  <th style={{ width: '150px' }}>Responsable</th>
                  <th style={{ width: '130px' }}>Fecha Límite</th>
                </tr>
              </thead>
              <tbody>
                {exportingMeeting.analysis?.action_items && exportingMeeting.analysis.action_items.length > 0 ? (
                  exportingMeeting.analysis.action_items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>⬜</td>
                      <td className="task-desc">{item.task}</td>
                      <td><span className="print-pill-assignee">{item.assignee || 'Sin asignar'}</span></td>
                      <td className="task-date">{item.deadline || 'Sin fecha'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>
                      No se identificaron tareas pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="print-section print-page-break">
            <h2 className="print-section-title">📝 Transcripción Completa</h2>
            <div className="print-transcript-list">
              {exportingMeeting.segments && exportingMeeting.segments.length > 0 ? (
                exportingMeeting.segments.map((seg, idx) => (
                  <div key={idx} className="print-transcript-item">
                    <div className="print-transcript-speaker">
                      <strong>👥 {seg.speaker || 'Hablante'}</strong>
                      <span className="print-transcript-time">⏱️ {formatTime(seg.start)} - {formatTime(seg.end)}</span>
                    </div>
                    <p className="print-transcript-text">{seg.text}</p>
                  </div>
                ))
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{exportingMeeting.transcript || 'Sin transcripción.'}</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

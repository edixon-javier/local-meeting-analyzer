import { useState, useEffect } from 'react'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import { getRecordingMetadata } from '../api'
import Icon from './Icon'
import Modal from './Modal'
import { getRecordingTitle, hasDefaultName, formatDuration, suggestRecordingName } from '../utils/recordingName'
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
  const [loadingExportFor, setLoadingExportFor] = useState(null) // filename mientras se cargan los metadatos

  useEffect(() => {
    if (!isBackendOffline) {
      loadRecordings({ silent: true })
    }
  }, [isBackendOffline, loadRecordings])

  // Filtrado y ordenamiento de reuniones
  // La búsqueda cubre el nombre de archivo, el título legible y el tema detectado por el análisis
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = !normalizedQuery || [rec.filename, getRecordingTitle(rec.filename), rec.summary_preview, rec.category]
      .some((text) => (text || '').toLowerCase().includes(normalizedQuery))
    const matchesCategory = categoryFilter === 'All' || rec.category === categoryFilter
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    return dateSort === 'newest' ? b.created - a.created : a.created - b.created
  })

  // Resumen de la cabecera: cuántas reuniones, cuánto tiempo grabado y cuántas están analizadas
  const analyzedCount = recordings.filter((r) => r.has_metadata).length
  const totalSeconds = recordings.reduce((acc, r) => acc + (Number(r.duration) || 0), 0)
  const totalDuration = totalSeconds >= 3600
    ? `${Math.floor(totalSeconds / 3600)} h ${Math.round((totalSeconds % 3600) / 60)} min`
    : totalSeconds > 0 ? `${Math.max(1, Math.round(totalSeconds / 60))} min` : null

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
    setRenamingFile(rec)
    setNewNameInput(suggestRecordingName(rec))
  }

  const handleExportClick = async (e, rec) => {
    e.stopPropagation()
    if (isBackendOffline || loadingExportFor) return
    setLoadingExportFor(rec.filename)
    try {
      const res = await getRecordingMetadata(rec.path)
      if (res.data && res.data.exists !== false) {
        setExportingMeeting({
          ...res.data,
          title: getRecordingTitle(rec.filename),
          createdDate: formatDate(rec.created)
        })
      } else {
        showToast?.({ type: 'warning', message: 'No se encontraron metadatos para esta reunión' })
      }
    } catch {
      showToast?.({ type: 'error', message: 'Error cargando metadatos de la reunión' })
    } finally {
      setLoadingExportFor(null)
    }
  }

  // Las tarjetas son role="button": Enter y Espacio las abren (solo si el foco está en la propia tarjeta)
  const handleCardKeyDown = (e, rec) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpenDetails(rec)
    }
  }

  if (isBackendOffline) {
    return (
      <div className="history-screen" style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450 }}>
          <div className="empty-state-icon" style={{ marginBottom: 16, opacity: 1 }}>
            <Icon name="alert-triangle" size={48} style={{ color: 'var(--red-record)' }} />
          </div>
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
                <span className="spinner-small" style={{ width: 10, height: 10, borderWidth: 2 }} aria-hidden="true" /> Actualizando…
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {recordings.length === 0
              ? 'Aquí aparecerán tus reuniones grabadas o subidas.'
              : [
                  `${recordings.length} ${recordings.length === 1 ? 'reunión' : 'reuniones'}`,
                  totalDuration ? `${totalDuration} grabadas` : null,
                  `${analyzedCount} ${analyzedCount === 1 ? 'analizada' : 'analizadas'}`,
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Búsqueda */}
      <div className="filters-container" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex' }}>
          <Icon name="search" size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="filter-control"
            placeholder="Buscar por título, tema o categoría…"
            aria-label="Buscar reuniones por título, tema o categoría"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery('') }}
            style={{ flex: 1, paddingLeft: 36 }}
          />
        </div>

        {/* Filtro de Categoría */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-control input-select"
          aria-label="Filtrar por categoría"
          style={{ minWidth: 170 }}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'Todas las Categorías' : c}</option>
          ))}
        </select>

        {/* Ordenar por Fecha */}
        <select
          value={dateSort}
          onChange={(e) => setDateSort(e.target.value)}
          className="filter-control input-select"
          aria-label="Ordenar por fecha"
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
{recordings.length === 0 ? (
              <>
                <div className="empty-state-title">Aún no hay reuniones guardadas</div>
                <div className="empty-state-sub">Graba una reunión o sube un archivo de audio para verla aquí.</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('record')}>
                  <Icon name="mic" size={14} /> Nueva grabación
                </button>
              </>
            ) : (
              <>
                <div className="empty-state-title">No se encontraron reuniones</div>
                <div className="empty-state-sub">Prueba con otros términos de búsqueda o filtros.</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSearchQuery(''); setCategoryFilter('All') }}
                >
                  <Icon name="x" size={13} /> Limpiar filtros
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredRecordings.map(rec => {
              const title = getRecordingTitle(rec.filename)
              const duration = formatDuration(rec.duration)
              const customName = !hasDefaultName(rec.filename)
              return (
              <div
                key={rec.filename}
                className="meeting-card glass"
                role="button"
                tabIndex={0}
                aria-label={`Abrir ${title}${duration ? `, ${duration}` : ''}`}
                title={`${rec.filename} · ${rec.size_mb} MB`}
                onClick={() => handleOpenDetails(rec)}
                onKeyDown={(e) => handleCardKeyDown(e, rec)}
              >
                <div className="meeting-card-head">
                  <h3 className="meeting-card-title">{title}</h3>
                  <div className="meeting-card-meta">
                    {duration && <span><Icon name="clock" size={12} /> {duration}</span>}
                    {customName && <span><Icon name="calendar" size={12} /> {formatDate(rec.created)}</span>}
                    {rec.bookmarks_count > 0 && (
                      <span className="meeting-card-bookmarks">
                        <Icon name="bookmark" size={12} /> {rec.bookmarks_count} {rec.bookmarks_count === 1 ? 'marcador' : 'marcadores'}
                      </span>
                    )}
                  </div>
                </div>

                {rec.summary_preview ? (
                  <p className="meeting-card-topic">{rec.summary_preview}</p>
                ) : (
                  <p className="meeting-card-topic is-empty">
                    {rec.has_metadata ? 'Sin resumen disponible.' : 'Aún sin analizar. Ábrela para transcribirla y obtener el resumen.'}
                  </p>
                )}

                <div className="meeting-card-footer">
                  <div className="meeting-card-tags">
                    {rec.has_metadata ? (
                      <>
                        {rec.category && <span className="pill category">{rec.category}</span>}
                        {rec.tone && <span className="pill tone">{rec.tone}</span>}
                        {!rec.category && !rec.tone && (
                          <span className="meeting-card-status is-done"><Icon name="check-circle" size={11} /> Analizada</span>
                        )}
                      </>
                    ) : (
                      <span className="meeting-card-status"><Icon name="mic" size={11} /> Sin analizar</span>
                    )}
                  </div>
                  <div className="meeting-card-actions">
                    {rec.has_metadata && (
                      <button
                        type="button"
                        onClick={(e) => handleExportClick(e, rec)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="btn btn-secondary btn-sm meeting-card-export"
                        disabled={loadingExportFor === rec.filename}
                        aria-busy={loadingExportFor === rec.filename || undefined}
                        title="Exportar minuta ejecutiva (PDF, Markdown o copiar)"
                      >
                        {loadingExportFor === rec.filename
                          ? <span className="spinner-small" style={{ width: 12, height: 12 }} aria-hidden="true" />
                          : <Icon name="file-text" size={13} />}
                        <span>Minuta</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRenameClick(e, rec)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="btn btn-secondary btn-square btn-sm"
                      title="Renombrar"
                      aria-label={`Renombrar ${title}`}
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, rec.filename)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="btn btn-danger btn-square btn-sm"
                      title="Eliminar"
                      aria-label={`Eliminar ${title}`}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Exportación de Minuta desde Historial */}
      {exportingMeeting && (
        <Modal titleId="export-minutes-title" onClose={() => setExportingMeeting(null)} maxWidth={480}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="file-text" size={20} style={{ color: 'var(--accent-primary-hover)' }} />
                <h3 id="export-minutes-title" className="modal-title" style={{ margin: 0 }}>
                  Minuta Ejecutiva
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-square btn-sm"
                onClick={() => setExportingMeeting(null)}
                aria-label="Cerrar"
                title="Cerrar (Esc)"
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
        </Modal>
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

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { getAudioUrl } from '../../api'
import Icon from '../Icon'

export default function TranscriptPanel({ 
  audioPath, 
  transcript, 
  segments, 
  step, 
  onBack, 
  audioRef, 
  playbackSpeed, 
  changeSpeed, 
  handleTimeUpdate, 
  activeSegmentIndex, 
  handleSegmentClick, 
  formatSegmentTime,
  reprocess,
  onOpenRenameSpeaker,
  bookmarks = [],
  onAddBookmark,
  onDeleteBookmark
}) {
  const [isAddingBookmark, setIsAddingBookmark] = useState(false)
  const [newBookmarkNote, setNewBookmarkNote] = useState('')

  // Estados de Búsqueda y Filtro de Hablantes
  const [searchQuery, setSearchQuery] = useState('')
  const [speakerFilter, setSpeakerFilter] = useState('all')
  const [onlyShowMatches, setOnlyShowMatches] = useState(false)
  const [currentMatchPointer, setCurrentMatchPointer] = useState(0)
  const searchInputRef = useRef(null)

  // Extraer lista única de hablantes
  const uniqueSpeakers = useMemo(() => {
    if (!segments || segments.length === 0) return []
    return Array.from(new Set(segments.map(s => s.speaker).filter(Boolean)))
  }, [segments])

  // Calcular segmentos coincidentes
  const cleanQuery = searchQuery.trim().toLowerCase()
  const indexedSegments = useMemo(() => {
    return (segments || []).map((seg, idx) => ({ ...seg, originalIndex: idx }))
  }, [segments])

  const matchingSegments = useMemo(() => {
    return indexedSegments.filter(seg => {
      const matchesSpeaker = speakerFilter === 'all' || seg.speaker === speakerFilter
      const matchesText = !cleanQuery || (seg.text && seg.text.toLowerCase().includes(cleanQuery))
      return matchesSpeaker && matchesText
    })
  }, [indexedSegments, speakerFilter, cleanQuery])

  const totalMatches = matchingSegments.length
  const isFilteringActive = cleanQuery.length > 0 || speakerFilter !== 'all'

  // Ajustar puntero si cambia el resultado de búsqueda
  useEffect(() => {
    setCurrentMatchPointer(0)
  }, [cleanQuery, speakerFilter])

  // Scroll suave al segmento coincidente activo
  const scrollToActiveMatch = (pointer) => {
    if (matchingSegments.length === 0) return
    const targetSegment = matchingSegments[pointer]
    if (!targetSegment) return

    const el = document.getElementById(`segment-${targetSegment.originalIndex}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleNextMatch = () => {
    if (totalMatches === 0) return
    const nextPointer = (currentMatchPointer + 1) % totalMatches
    setCurrentMatchPointer(nextPointer)
    scrollToActiveMatch(nextPointer)
  }

  const handlePrevMatch = () => {
    if (totalMatches === 0) return
    const prevPointer = (currentMatchPointer - 1 + totalMatches) % totalMatches
    setCurrentMatchPointer(prevPointer)
    scrollToActiveMatch(prevPointer)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setCurrentMatchPointer(0)
    searchInputRef.current?.focus()
  }

  // Atajo de teclado global Ctrl+F para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSavePlaybackBookmark = () => {
    const currentTime = audioRef.current?.currentTime || 0
    onAddBookmark?.(currentTime, newBookmarkNote)
    setNewBookmarkNote('')
    setIsAddingBookmark(false)
  }

  // Resaltado de coincidencias en el texto
  const renderHighlightedText = (text, query, isCurrentMatch) => {
    if (!query || !query.trim()) return text
    const cleanQ = query.trim()
    try {
      const regex = new RegExp(`(${cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) => 
        regex.test(part) ? (
          <mark 
            key={i} 
            style={{
              background: isCurrentMatch ? '#F59E0B' : 'rgba(234, 179, 8, 0.4)',
              color: isCurrentMatch ? '#000000' : '#FEF08A',
              fontWeight: 700,
              padding: '1px 3px',
              borderRadius: 3
            }}
          >
            {part}
          </mark>
        ) : part
      )
    } catch {
      return text
    }
  }

  // Segmentos a renderizar (todos con resaltado o solo los filtrados)
  const segmentsToRender = onlyShowMatches && isFilteringActive ? matchingSegments : indexedSegments
  const activeMatchingOriginalIndex = matchingSegments[currentMatchPointer]?.originalIndex

  return (
    <div className="transcript-panel">
      <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        {/* Fila Superior: Título y Acciones Principales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div className="panel-title">
            <Icon name="file-text" size={16} />
            <span className="panel-title-text" title={`Transcripción (${segments?.length || 0} intervenciones)`}>
              Transcripción ({segments?.length || 0} intervenciones)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={reprocess}
              title="Volver a transcribir y analizar esta reunión"
              aria-label="Reprocesar reunión"
            >
              <Icon name="refresh" size={14} /> <span className="btn-label-collapsible">Reprocesar</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onBack}
              title="Volver a la pantalla de grabación"
              aria-label="Nueva reunión"
            >
              <Icon name="mic" size={14} /> <span className="btn-label-collapsible">Nueva Reunión</span>
            </button>
          </div>
        </div>
        
        {/* Reproductor de Audio Integrado */}
        {audioPath && step === 'done' && (
          <div className="audio-player-container">
            <button 
              onClick={changeSpeed}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', fontSize: 12, minWidth: 45, background: 'var(--bg-elevated)' }}
              title="Velocidad de reproducción"
            >
              {playbackSpeed}x
            </button>
            <audio 
              ref={audioRef}
              src={getAudioUrl(audioPath)}
              controls
              className="custom-audio-player"
              onTimeUpdate={handleTimeUpdate}
            />
            {onAddBookmark && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddingBookmark(prev => !prev)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: isAddingBookmark ? '#F59E0B' : 'inherit',
                  borderColor: isAddingBookmark ? '#F59E0B' : undefined
                }}
                title="Marcar momento en el segundo actual del audio"
                aria-label="Marcar momento clave"
              >
                <Icon name="bookmark" size={13} />
                <span className="btn-label-collapsible">Marcar Momento</span>
              </button>
            )}
          </div>
        )}

        {/* Formulario para añadir marcador en reproducción */}
        {isAddingBookmark && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid #F59E0B',
            borderRadius: 'var(--radius-md)'
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace' }}>
              [{formatSegmentTime(audioRef.current?.currentTime || 0)}]
            </span>
            <input
              type="text"
              placeholder="Nota del momento clave..."
              value={newBookmarkNote}
              onChange={(e) => setNewBookmarkNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePlaybackBookmark()
                if (e.key === 'Escape') setIsAddingBookmark(false)
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)'
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSavePlaybackBookmark}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddingBookmark(false)}
              style={{ padding: '4px 8px', fontSize: 12 }}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        )}

        {/* Tira interactiva de marcadores clave */}
        {bookmarks && bookmarks.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '6px 10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="bookmark" size={12} /> Momentos:
            </span>
            {bookmarks.map((bm) => (
              <span
                key={bm.id}
                onClick={() => handleSegmentClick(bm.time)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 11,
                  color: '#F59E0B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.22)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)' }}
                title="Clic para reproducir e ir a este momento"
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatSegmentTime(bm.time)}</span>
                {bm.note && <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.note}</span>}
                {onDeleteBookmark && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteBookmark(bm.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'inherit',
                      opacity: 0.6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Eliminar marcador"
                  >
                    <Icon name="x" size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* ── BARRA DE BÚSQUEDA Y FILTRO DE DIÁLOGOS (Decisión de Producto 1) ── */}
        {segments && segments.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: 'var(--bg-elevated)',
            border: isFilteringActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap',
            transition: 'border-color 0.2s ease'
          }}>
            {/* Input de Búsqueda */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 170 }}>
              <Icon name="search" size={14} style={{ color: isFilteringActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                id="transcript-search-input"
                type="text"
                placeholder="Buscar en la transcripción... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) handlePrevMatch()
                    else handleNextMatch()
                  } else if (e.key === 'Escape') {
                    handleClearSearch()
                  }
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--text-primary)'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Limpiar búsqueda (Esc)"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            {/* Filtro por Hablante */}
            {uniqueSpeakers.length > 1 && (
              <select
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: speakerFilter !== 'all' ? 'var(--text-accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  maxWidth: 150
                }}
                title="Filtrar intervenciones por hablante"
              >
                <option value="all">Todos los hablantes</option>
                {uniqueSpeakers.map((spk, idx) => (
                  <option key={idx} value={spk}>{spk}</option>
                ))}
              </select>
            )}

            {/* Contador de coincidencias y botones de navegación */}
            {isFilteringActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: totalMatches > 0 ? 'var(--text-primary)' : '#EF4444',
                  background: totalMatches > 0 ? 'var(--bg-surface)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'monospace'
                }}>
                  {totalMatches > 0 
                    ? `${cleanQuery ? `${currentMatchPointer + 1}/${totalMatches}` : `${totalMatches} segs`}`
                    : 'Sin resultados'
                  }
                </span>

                {totalMatches > 1 && cleanQuery && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      type="button"
                      onClick={handlePrevMatch}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 6px', fontSize: 11 }}
                      title="Coincidencia anterior (Shift+Enter)"
                    >
                      <Icon name="arrow-left" size={11} style={{ transform: 'rotate(90deg)' }} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMatch}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 6px', fontSize: 11 }}
                      title="Siguiente coincidencia (Enter)"
                    >
                      <Icon name="arrow-right" size={11} style={{ transform: 'rotate(90deg)' }} />
                    </button>
                  </div>
                )}

                {/* Botón para alternar 'Solo coincidencias' */}
                <button
                  type="button"
                  onClick={() => setOnlyShowMatches(prev => !prev)}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: onlyShowMatches ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    color: onlyShowMatches ? '#FFF' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={onlyShowMatches ? 'Mostrar todo el diálogo con resaltado' : 'Mostrar solo los fragmentos coincidentes'}
                >
                  {onlyShowMatches ? 'Ver todos' : 'Aislar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-body">
        {segments && segments.length > 0 ? (
          segmentsToRender.length > 0 ? (
            <div className="diarized-chat" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 12 }}>
              {segmentsToRender.map((seg) => {
                const originalIdx = seg.originalIndex
                const segBookmarks = (bookmarks || []).filter(
                  b => b.time >= (seg.start - 0.5) && b.time <= (seg.end + 0.5)
                )
                const isSelectedBySearch = cleanQuery && activeMatchingOriginalIndex === originalIdx
                const isActivePlayback = originalIdx === activeSegmentIndex

                return (
                  <div 
                    key={originalIdx} 
                    id={`segment-${originalIdx}`}
                    onClick={() => handleSegmentClick(seg.start)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSegmentClick(seg.start)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Reproducir desde ${formatSegmentTime(seg.start)}: ${seg.speaker || 'Hablante'}`}
                    className={`chat-bubble glass ${isActivePlayback ? 'active-segment' : ''}`} 
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelectedBySearch 
                        ? 'rgba(99, 102, 241, 0.15)' 
                        : (isActivePlayback ? 'var(--bg-elevated)' : 'var(--bg-surface)'),
                      border: isSelectedBySearch 
                        ? '2px solid var(--accent-primary)' 
                        : (segBookmarks.length > 0 
                            ? '1px solid rgba(245, 158, 11, 0.4)' 
                            : '1px solid var(--border-subtle)'),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: 6, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenRenameSpeaker?.(seg.speaker)
                          }}
                          className="speaker-badge-btn"
                          onKeyDown={(e) => e.stopPropagation()}
                          title={`Clic para renombrar a "${seg.speaker || 'Hablante'}" en toda la reunión`}
                          aria-label={`Renombrar hablante ${seg.speaker || 'sin nombre'}`}
                          style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-full)',
                            padding: '3px 8px',
                            color: 'var(--text-accent)',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <Icon name="user" size={13} />
                          <span>{seg.speaker || 'Hablante'}</span>
                          <Icon name="edit" size={11} style={{ opacity: 0.7 }} />
                        </button>
                        {segBookmarks.map((bm) => (
                          <span
                            key={bm.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              color: '#F59E0B',
                              borderRadius: 'var(--radius-full)',
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 600
                            }}
                            title={bm.note || 'Momento clave'}
                          >
                            <Icon name="bookmark" size={11} />
                            <span>{bm.note || 'Momento Clave'}</span>
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatSegmentTime(seg.start)} – {formatSegmentTime(seg.end)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                      {renderHighlightedText(seg.text, cleanQuery, isSelectedBySearch)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon">
                <Icon name="search" size={32} />
              </div>
              <div className="empty-state-title">Sin coincidencias</div>
              <div className="empty-state-sub">
                No se encontraron fragmentos para "{searchQuery}"
                {speakerFilter !== 'all' ? ` con el hablante "${speakerFilter}"` : ''}.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearchQuery(''); setSpeakerFilter('all'); }}
                style={{ marginTop: 12 }}
              >
                Restablecer filtros
              </button>
            </div>
          )
        ) : (
          transcript ? (
            <pre className="transcript-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{transcript}</pre>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="file-text" size={40} />
              </div>
              <div className="empty-state-title">Sin transcripción</div>
              <div className="empty-state-sub">No se encontró texto en el audio.</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

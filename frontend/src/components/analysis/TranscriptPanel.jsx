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
  onDeleteBookmark,
  meetingTitle
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
            className={`transcript-mark ${isCurrentMatch ? 'is-current' : ''}`}
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
      <div className="panel-header transcript-header">
        {/* Fila Superior: Título y Acciones Principales */}
        <div className="transcript-header-top">
          <div className="panel-title transcript-title">
            <div className="transcript-title-text">
              <h1 className="panel-title-text analysis-meeting-title" title={meetingTitle}>{meetingTitle || 'Reunión'}</h1>
              <span className="analysis-meeting-sub">
                <Icon name="file-text" size={12} /> Transcripción · {segments?.length || 0} {segments?.length === 1 ? 'intervención' : 'intervenciones'}
              </span>
            </div>
          </div>
          <div className="transcript-header-actions">
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
              className="btn btn-secondary btn-sm transcript-speed-btn"
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
                className={`btn btn-secondary btn-sm transcript-bookmark-btn ${isAddingBookmark ? 'is-active' : ''}`}
                onClick={() => setIsAddingBookmark(prev => !prev)}
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
          <div className="transcript-bookmark-form">
            <span className="transcript-bookmark-time">
              [{formatSegmentTime(audioRef.current?.currentTime || 0)}]
            </span>
            <input
              type="text"
              className="transcript-bookmark-input"
              placeholder="Nota del momento clave..."
              value={newBookmarkNote}
              onChange={(e) => setNewBookmarkNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePlaybackBookmark()
                if (e.key === 'Escape') setIsAddingBookmark(false)
              }}
              autoFocus
            />
            <button
              type="button"
              className="btn btn-primary btn-sm transcript-bookmark-save"
              onClick={handleSavePlaybackBookmark}
            >
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm transcript-bookmark-cancel"
              onClick={() => setIsAddingBookmark(false)}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        )}

        {/* Tira interactiva de marcadores clave */}
        {bookmarks && bookmarks.length > 0 && (
          <div className="transcript-bookmark-strip">
            <span className="transcript-bookmark-strip-label">
              <Icon name="bookmark" size={12} /> Momentos:
            </span>
            {bookmarks.map((bm) => (
              <span
                key={bm.id}
                className="transcript-bookmark-chip"
                onClick={() => handleSegmentClick(bm.time)}
                title="Clic para reproducir e ir a este momento"
              >
                <span className="transcript-bookmark-chip-time">{formatSegmentTime(bm.time)}</span>
                {bm.note && <span className="transcript-bookmark-chip-note">{bm.note}</span>}
                {onDeleteBookmark && (
                  <button
                    type="button"
                    className="transcript-bookmark-chip-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteBookmark(bm.id)
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
          <div className={`transcript-search-bar ${isFilteringActive ? 'is-filtering' : ''}`}>
            {/* Input de Búsqueda */}
            <div className="transcript-search-field">
              <Icon name="search" size={14} />
              <input
                ref={searchInputRef}
                id="transcript-search-input"
                className="transcript-search-input"
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
              />
              {searchQuery && (
                <button
                  type="button"
                  className="transcript-search-clear"
                  onClick={handleClearSearch}
                  title="Limpiar búsqueda (Esc)"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            {/* Filtro por Hablante */}
            {uniqueSpeakers.length > 1 && (
              <select
                className={`transcript-speaker-select ${speakerFilter !== 'all' ? 'is-filtered' : ''}`}
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
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
              <div className="transcript-match-controls">
                <span className={`transcript-match-count ${totalMatches > 0 ? '' : 'is-empty'}`}>
                  {totalMatches > 0
                    ? `${cleanQuery ? `${currentMatchPointer + 1}/${totalMatches}` : `${totalMatches} segs`}`
                    : 'Sin resultados'
                  }
                </span>

                {totalMatches > 1 && cleanQuery && (
                  <div className="transcript-match-nav">
                    <button
                      type="button"
                      onClick={handlePrevMatch}
                      className="btn btn-secondary btn-sm transcript-match-nav-btn"
                      title="Coincidencia anterior (Shift+Enter)"
                    >
                      <Icon name="arrow-left" size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMatch}
                      className="btn btn-secondary btn-sm transcript-match-nav-btn"
                      title="Siguiente coincidencia (Enter)"
                    >
                      <Icon name="arrow-right" size={11} />
                    </button>
                  </div>
                )}

                {/* Botón para alternar 'Solo coincidencias' */}
                <button
                  type="button"
                  className={`transcript-isolate-btn ${onlyShowMatches ? 'is-active' : ''}`}
                  onClick={() => setOnlyShowMatches(prev => !prev)}
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
            <div className="diarized-chat transcript-list">
              {segmentsToRender.map((seg) => {
                const originalIdx = seg.originalIndex
                const segBookmarks = (bookmarks || []).filter(
                  b => b.time >= (seg.start - 0.5) && b.time <= (seg.end + 0.5)
                )
                const isSelectedBySearch = cleanQuery && activeMatchingOriginalIndex === originalIdx
                const isActivePlayback = originalIdx === activeSegmentIndex
                const segmentClasses = [
                  'chat-bubble glass transcript-segment',
                  isActivePlayback && 'active-segment is-playing',
                  segBookmarks.length > 0 && 'has-bookmarks',
                  isSelectedBySearch && 'is-search-match'
                ].filter(Boolean).join(' ')

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
                    className={segmentClasses}
                  >
                    <div className="transcript-segment-head">
                      <div className="transcript-segment-who">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenRenameSpeaker?.(seg.speaker)
                          }}
                          className="speaker-badge-btn transcript-speaker-badge"
                          onKeyDown={(e) => e.stopPropagation()}
                          title={`Clic para renombrar a "${seg.speaker || 'Hablante'}" en toda la reunión`}
                          aria-label={`Renombrar hablante ${seg.speaker || 'sin nombre'}`}
                        >
                          <Icon name="user" size={13} />
                          <span>{seg.speaker || 'Hablante'}</span>
                          <Icon name="edit" size={11} />
                        </button>
                        {segBookmarks.map((bm) => (
                          <span
                            key={bm.id}
                            className="transcript-segment-bookmark"
                            title={bm.note || 'Momento clave'}
                          >
                            <Icon name="bookmark" size={11} />
                            <span>{bm.note || 'Momento Clave'}</span>
                          </span>
                        ))}
                      </div>
                      <span className="transcript-segment-time">
                        {formatSegmentTime(seg.start)} – {formatSegmentTime(seg.end)}
                      </span>
                    </div>
                    <p className="transcript-segment-text">
                      {renderHighlightedText(seg.text, cleanQuery, isSelectedBySearch)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state transcript-empty-filter">
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
                className="btn btn-secondary btn-sm transcript-reset-btn"
                onClick={() => { setSearchQuery(''); setSpeakerFilter('all'); }}
              >
                Restablecer filtros
              </button>
            </div>
          )
        ) : (
          transcript ? (
            <pre className="transcript-text transcript-plain">{transcript}</pre>
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

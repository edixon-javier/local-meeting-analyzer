// src/components/recording/LiveTranscriptPanel.jsx
// Componente accesible y de alto rendimiento para visualizar la transcripción en vivo (SSE)
// Soporta auto-scroll inteligente, indicador de nuevo contenido fuera de vista y ARIA para lectores de pantalla.

import React, { useRef, useEffect, useState, memo } from 'react'
import Icon from '../Icon'

const LiveTranscriptPanel = memo(function LiveTranscriptPanel({
  liveSegments = [],
  partialText = '',
  streamStatus = 'listening',
  errorMessage = '',
  totalWords = 0,
  isPaused = false,
  formatSegmentTime = (_s) => '00:00'
}) {
  const containerRef = useRef(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  const [hasNewUnseenText, setHasNewUnseenText] = useState(false)
  const lastSeenSegmentCountRef = useRef(0)

  // Detección de scroll manual del usuario
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    // Si la distancia al fondo es mayor a 45px, el usuario subió intencionalmente
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 45
    setIsUserScrolledUp(!isNearBottom)

    if (isNearBottom) {
      setHasNewUnseenText(false)
      lastSeenSegmentCountRef.current = liveSegments.length
    }
  }

  // Auto-scroll si el usuario está al final; de lo contrario, indicar que hay nuevo texto
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (!isUserScrolledUp) {
      el.scrollTop = el.scrollHeight
      setHasNewUnseenText(false)
      lastSeenSegmentCountRef.current = liveSegments.length
    } else {
      // Si el usuario está leyendo arriba y llegaron nuevos segmentos confirmados
      if (liveSegments.length > lastSeenSegmentCountRef.current) {
        setHasNewUnseenText(true)
      }
    }
  }, [liveSegments, partialText, isUserScrolledUp])

  const scrollToBottom = () => {
    const el = containerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setIsUserScrolledUp(false)
      setHasNewUnseenText(false)
      lastSeenSegmentCountRef.current = liveSegments.length
    }
  }

  // Mapeo accesible y visual de estados
  const getStatusConfig = () => {
    if (errorMessage) {
      return {
        dotClass: 'error',
        text: 'Error en transcripción',
        iconName: 'alert-triangle',
        ariaText: 'Error en la transcripción en vivo'
      }
    }
    if (isPaused || streamStatus === 'paused') {
      return {
        dotClass: 'paused',
        text: 'Transcripción en pausa',
        iconName: 'pause',
        ariaText: 'Transcripción pausada'
      }
    }
    if (streamStatus === 'transcribing') {
      return {
        dotClass: 'pulsing',
        text: 'Transcribiendo en vivo',
        iconName: 'mic',
        ariaText: 'Transcribiendo voz en tiempo real'
      }
    }
    if (streamStatus === 'connecting' || streamStatus === 'reconnecting') {
      return {
        dotClass: 'reconnecting',
        text: 'Reconectando stream...',
        iconName: 'refresh',
        ariaText: 'Reconectando el servicio de transcripción'
      }
    }
    if (streamStatus === 'finalizing') {
      return {
        dotClass: 'finalizing',
        text: 'Finalizando transcripción...',
        iconName: 'refresh',
        ariaText: 'Finalizando y consolidando la transcripción'
      }
    }
    // listening / sin voz
    return {
      dotClass: 'listening',
      text: 'Escuchando audio...',
      iconName: 'mic',
      ariaText: 'Escuchando. En espera de voz'
    }
  }

  const statusConfig = getStatusConfig()
  const hasContent = liveSegments.length > 0 || Boolean(partialText)

  return (
    <section
      className="live-transcript-panel glass"
      aria-label="Transcripción de la reunión en tiempo real"
      role="region"
    >
      {/* Cabecera del Panel */}
      <header className="live-transcript-header">
        <div className="live-transcript-status" aria-live="polite">
          <span
            className={`live-status-dot ${statusConfig.dotClass}`}
            aria-hidden="true"
          />
          <span className="live-status-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name={statusConfig.iconName} size={14} aria-hidden="true" />
            <span>{statusConfig.text}</span>
          </span>
        </div>

        <div className="live-transcript-meta">
          <span
            className="live-transcript-badge"
            aria-label={`${totalWords} palabras transcritas`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Icon name="file-text" size={12} />
            <span>{totalWords} {totalWords === 1 ? 'palabra' : 'palabras'}</span>
          </span>
        </div>
      </header>

      {/* Región de estado para lectores de pantalla (anuncios discretos de estado) */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusConfig.ariaText}
      </div>

      {/* Contenedor del Texto */}
      <div className="live-transcript-body-wrapper">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="live-transcript-body"
          tabIndex={0}
          role="log"
          aria-label="Registro de transcripción continua"
        >
          {/* Estado vacío (Sin voz detectada aún) */}
          {!hasContent && (
            <div className="live-transcript-empty" role="note">
              <span className="empty-icon" aria-hidden="true">
                <Icon name="mic" size={32} />
              </span>
              <p className="empty-title">En espera de voz...</p>
              <p className="empty-subtitle">
                Habla con normalidad. Las palabras transcritas aparecerán aquí de forma progresiva.
              </p>
            </div>
          )}

          {/* Segmentos confirmados: se anuncian educadamente al lector de pantalla */}
          <div aria-live="polite" aria-atomic="false" className="live-segments-list">
            {liveSegments.map((seg, idx) => (
              <article key={seg.seq || idx} className="live-segment-item">
                <time
                  className="live-segment-time"
                  dateTime={`PT${Math.floor(seg.start || 0)}S`}
                  title={`Minuto ${formatSegmentTime(seg.start)}`}
                >
                  [{formatSegmentTime(seg.start)}]
                </time>
                <p className="live-segment-text">{seg.text}</p>
              </article>
            ))}
          </div>

          {/* Texto parcial en curso: visual para sighted users, aria-hidden para no inundar screen readers */}
          {partialText && (
            <div
              className="live-segment-item live-segment-partial"
              aria-hidden="true"
            >
              <span className="live-segment-time">
                [en vivo]
              </span>
              <p className="live-partial-text">
                {partialText}
                <span className="live-typing-caret" />
              </p>
            </div>
          )}
        </div>

        {/* Botón flotante para volver abajo si el usuario subió el scroll */}
        {hasNewUnseenText && isUserScrolledUp && (
          <button
            type="button"
            className="btn-scroll-bottom-pill"
            onClick={scrollToBottom}
            aria-label="Desplazarse al texto más reciente"
          >
            <Icon name="chevron-down" size={14} /> Nuevo texto abajo
          </button>
        )}
      </div>
    </section>
  )
})

export default LiveTranscriptPanel

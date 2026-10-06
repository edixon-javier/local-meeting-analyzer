// src/components/RecordScreen.jsx
// Pantalla principal de grabación: captura de audio, medidores RMS,
// streaming en tiempo real de transcripción palabra por palabra (SSE),
// controles de pausar, reanudar, cancelar y detener.

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  startRecording,
  stopRecording,
  cancelRecording,
  pauseRecording,
  resumeRecording,
  uploadAudioFile,
  getAudioTestLevels,
  getLiveTranscriptionUrl,
  addLiveBookmark,
  deleteLiveBookmark
} from '../api'
import { useSystem } from '../hooks/useSystem'
import Icon from './Icon'
import LiveTranscriptPanel from './recording/LiveTranscriptPanel'

export default function RecordScreen({ onRecordingDone }) {
  const { showToast, isBackendOffline, isRecording, setIsRecording, isPaused, setIsPaused } = useSystem()
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef(null)
  const audioPathRef = useRef(null)

  // Niveles RMS en vivo
  const [sysLevel, setSysLevel] = useState(0)
  const [micLevel, setMicLevel] = useState(0)

  // Estados de Transcripción en Vivo (Live Transcription SSE)
  const [_sessionId, setSessionId] = useState(null)
  const sessionIdRef = useRef(null)
  const [liveSegments, setLiveSegments] = useState([])
  const [partialText, setPartialText] = useState('')
  const [streamStatus, setStreamStatus] = useState('idle') // idle | connecting | listening | transcribing | paused | reconnecting | finalizing
  const [streamError, setStreamError] = useState('')
  const [isPreparing, setIsPreparing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  
  const [isLiveTranscriptionEnabled, setIsLiveTranscriptionEnabled] = useState(() => {
    try {
      return localStorage.getItem('meeting_live_transcription_enabled') === 'true'
    } catch {
      return false
    }
  })

  // Marcadores de momentos clave en vivo (Live Bookmarking)
  const [bookmarks, setBookmarks] = useState([])
  const [bookmarkNote, setBookmarkNote] = useState('')
  const noteInputRef = useRef(null)

  const handleLiveBookmark = async (customNote = null) => {
    if (!isRecording) return
    const note = customNote !== null ? customNote : bookmarkNote
    const currentSecs = seconds
    const tempId = `bm_${Date.now()}`
    const newBm = { id: tempId, time: currentSecs, note: note.trim() }

    setBookmarks(prev => [...prev, newBm].sort((a, b) => a.time - b.time))
    setBookmarkNote('')

    try {
      const res = await addLiveBookmark(currentSecs, note.trim())
      if (res.data?.bookmarks) {
        setBookmarks(res.data.bookmarks)
      }
      showToast({
        type: 'success',
        message: `Momento marcado [${formatTime(currentSecs)}]${note.trim() ? ': ' + note.trim() : ''}`
      })
    } catch (err) {
      console.error('Error al guardar marcador:', err)
    }
  }

  const handleDeleteBookmark = async (bookmarkId) => {
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId))
    try {
      await deleteLiveBookmark(bookmarkId)
    } catch (err) {
      console.error('Error al eliminar marcador:', err)
    }
  }

  // Atajo de teclado para marcar momento clave: tecla 'M' o 'Ctrl+B'
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      if (!isRecording) return

      if (e.key === 'm' || e.key === 'M' || (e.ctrlKey && (e.key === 'b' || e.key === 'B'))) {
        e.preventDefault()
        noteInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording])

  const handleToggleLiveTranscription = (enabled) => {
    setIsLiveTranscriptionEnabled(enabled)
    try {
      localStorage.setItem('meeting_live_transcription_enabled', String(enabled))
    } catch {
      // Ignorar restricción de localStorage
    }
  }

  const sseRef = useRef(null)

  // Polling de niveles de audio mientras se graba activamente
  useEffect(() => {
    let intervalId
    let isFetching = false
    if (isRecording && !isPaused && !isBackendOffline) {
      intervalId = setInterval(async () => {
        if (isFetching) return
        isFetching = true
        try {
          const res = await getAudioTestLevels()
          const scaleLevel = (val) => Math.min(100, Math.round(Math.sqrt(val) * 160))
          setMicLevel(scaleLevel(res.data.mic_level))
          setSysLevel(scaleLevel(res.data.sys_level))
        } catch (err) {
          console.error('Error al obtener niveles en tiempo real:', err)
        } finally {
          isFetching = false
        }
      }, 250)
    } else {
      setMicLevel(0)
      setSysLevel(0)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRecording, isPaused, isBackendOffline])

  // Estados para carga de archivos (Drag & Drop)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    if (isBackendOffline || isUploading) return
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (isBackendOffline || isUploading) return
    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleFileChange = (e) => {
    if (isBackendOffline || isUploading) return
    const file = e.target.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleUpload = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const allowed = ['wav', 'mp3', 'm4a', 'mp4', 'ogg', 'aac', 'flac']
    if (!allowed.includes(ext)) {
      showToast({ 
        type: 'error', 
        message: 'Formato de audio no soportado. Formatos válidos: WAV, MP3, M4A, MP4, OGG, AAC, FLAC.' 
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    showToast({ type: 'info', message: 'Subiendo archivo de audio...' })

    try {
      const res = await uploadAudioFile(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(percent)
      })

      showToast({ type: 'success', message: '✅ Archivo subido con éxito. Iniciando análisis...' })
      setIsUploading(false)
      onRecordingDone(res.data.path)
    } catch (err) {
      console.error('Error al subir archivo:', err)
      const msg = err.response?.data?.detail || 'Error al subir el archivo de audio'
      showToast({ type: 'error', message: msg })
      setIsUploading(false)
    }
  }

  // Timer: incrementa solo si está grabando y no está pausado
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording, isPaused])

  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const formatSegmentTime = (s) => {
    if (s == null || isNaN(s)) return '00:00'
    const totalSecs = Math.floor(s)
    const m = Math.floor(totalSecs / 60)
    const sec = totalSecs % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Conexión SSE de Live Transcription
  const connectLiveSse = useCallback((sid) => {
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }

    setLiveSegments([])
    setPartialText('')
    setStreamError('')
    setStreamStatus('connecting')

    const url = getLiveTranscriptionUrl(sid)
    const es = new EventSource(url)
    sseRef.current = es

    es.onopen = () => {
      setStreamStatus('listening')
      setStreamError('')
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'init') {
          if (data.confirmed_segments && data.confirmed_segments.length > 0) {
            setLiveSegments(data.confirmed_segments)
          }
          setStreamStatus('listening')
        } else if (data.event === 'partial') {
          setStreamStatus('transcribing')
          setPartialText(data.text || '')
        } else if (data.event === 'final_segment') {
          setLiveSegments((prev) => {
            if (prev.some((s) => s.seq === data.seq)) return prev
            return [...prev, data]
          })
          setPartialText('')
          setStreamStatus('listening')
        } else if (data.event === 'paused') {
          setStreamStatus('paused')
        } else if (data.event === 'resumed') {
          setStreamStatus('listening')
        } else if (data.event === 'complete') {
          setStreamStatus('idle')
          if (sseRef.current) {
            sseRef.current.close()
            sseRef.current = null
          }
        } else if (data.event === 'cancelled') {
          setStreamStatus('idle')
          setLiveSegments([])
          setPartialText('')
          if (sseRef.current) {
            sseRef.current.close()
            sseRef.current = null
          }
        }
      } catch {
        // Ignorar comentarios keep-alive (: ping)
      }
    }

    es.onerror = () => {
      setStreamStatus((prev) => (prev === 'idle' ? 'idle' : 'reconnecting'))
    }
  }, [])

  // Limpieza rigurosa de SSE al desmontar el componente
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

  const handleStartStop = async () => {
    if (isBackendOffline || isPreparing || isCancelling) return
    if (!isRecording) {
      // INICIAR GRABACIÓN
      try {
        setIsPreparing(true)
        setIsRecording(true)
        setIsPaused(false)
        setSeconds(0)
        setStreamError('')
        setBookmarks([])

        const res = await startRecording()
        audioPathRef.current = res.data.audio_path
        const sid = res.data.session_id
        setSessionId(sid)
        sessionIdRef.current = sid
        if (isLiveTranscriptionEnabled) {
          connectLiveSse(sid)
        }
        showToast({ type: 'success', message: 'Grabación iniciada' })
      } catch (err) {
        setIsRecording(false)
        setIsPaused(false)
        setStreamStatus('idle')
        const msg = err.response?.data?.detail || 'Error al iniciar la grabación'
        setStreamError(msg)
        showToast({ type: 'error', message: msg })
      } finally {
        setIsPreparing(false)
      }
    } else {
      // DETENER GRABACIÓN
      try {
        const currentPath = audioPathRef.current
        setStreamStatus('finalizing')
        setIsPaused(false)

        if (sseRef.current) {
          sseRef.current.close()
          sseRef.current = null
        }

        const res = await stopRecording(bookmarks)
        showToast({ type: 'info', message: 'Grabación guardada. Procesando...' })
        setIsRecording(false)
        setStreamStatus('idle')
        onRecordingDone(res.data.audio_path || currentPath)
      } catch (err) {
        setIsRecording(false)
        setIsPaused(false)
        setStreamStatus('idle')
        const msg = err.response?.data?.detail || 'Error al detener la grabación'
        showToast({ type: 'error', message: msg })
      }
    }
  }

  const handleCancelRecording = async () => {
    if (isBackendOffline || isCancelling || isPreparing) return
    try {
      setIsCancelling(true)
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      await cancelRecording()
      setIsRecording(false)
      setIsPaused(false)
      setLiveSegments([])
      setPartialText('')
      setBookmarks([])
      setSeconds(0)
      audioPathRef.current = null
      setSessionId(null)
      sessionIdRef.current = null
      setStreamStatus('idle')
      setStreamError('')
      showToast({ type: 'info', message: 'Grabación y transcripción canceladas' })
    } catch (err) {
      console.error('Error al cancelar grabación:', err)
      showToast({ type: 'error', message: 'Error al cancelar la grabación' })
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePauseResume = async () => {
    if (isBackendOffline || isCancelling || isPreparing) return
    if (isPaused) {
      try {
        setIsPaused(false)
        await resumeRecording()
        setStreamStatus('listening')
        showToast({ type: 'success', message: 'Grabación reanudada' })
      } catch {
        setIsPaused(true)
        showToast({ type: 'error', message: 'Error al reanudar la grabación' })
      }
    } else {
      try {
        setIsPaused(true)
        await pauseRecording()
        setStreamStatus('paused')
        showToast({ type: 'info', message: '⏸️ Grabación pausada' })
      } catch {
        setIsPaused(false)
        showToast({ type: 'error', message: 'Error al pausar la grabación' })
      }
    }
  }

  // Cálculo total de palabras reconocidas
  const totalWords =
    liveSegments.reduce(
      (acc, seg) => acc + (seg.text ? seg.text.split(/\s+/).filter(Boolean).length : 0),
      0
    ) + (partialText ? partialText.split(/\s+/).filter(Boolean).length : 0)

  const isFinalizing = streamStatus === 'finalizing'
  const isStudioActive = isRecording || isFinalizing

  return (
    <div className={`record-screen ${isStudioActive ? 'is-recording' : ''}`}>
      {/* Estado inactivo / Inicial */}
      {!isStudioActive && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h1 className="record-title" style={{ fontSize: 36, marginBottom: 12 }}>Listo para grabar</h1>
          <p className="record-subtitle" style={{ margin: '0 auto', fontSize: 16 }}>
            Presiona el botón para iniciar la captura de audio y análisis automático con IA.
          </p>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
              <input 
                type="checkbox" 
                checked={isLiveTranscriptionEnabled} 
                onChange={(e) => handleToggleLiveTranscription(e.target.checked)} 
              />
              Transcripción en tiempo real
            </label>
          </div>
        </div>
      )}

      {/* ─── Recording Studio Dashboard (Pantalla Completa Activa) ─── */}
      {isStudioActive && (
        <div className="record-studio" role="region" aria-label="Estudio de Grabación Activa">
          {/* Overlay de Finalización Suave */}
          {isFinalizing && (
            <div className="studio-finalizing-overlay">
              <div className="spinner-small" style={{ width: 36, height: 36, borderWidth: 3 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>
                Finalizando reunión...
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Guardando audio y preparando el motor de análisis con IA
              </div>
            </div>
          )}
          {/* Barra Superior del Estudio */}
          <div className="record-studio-header">
            <div className="record-studio-status">
              <span className="live-rec-badge">
                <span className={`live-rec-dot ${isPaused ? 'paused' : 'pulsing'}`} />
                <span>{isPaused ? 'PAUSADO' : 'GRABANDO EN VIVO'}</span>
              </span>
              <div className="record-audio-meters-pill" aria-label="Niveles de audio">
                <span className="meter-label">
                  <Icon name="mic" size={12} /> Mic:
                </span>
                <div className="meter-track">
                  <div className="meter-fill" style={{ width: `${micLevel}%` }} />
                </div>
                <span className="meter-label">
                  <Icon name="volume" size={12} /> Sis:
                </span>
                <div className="meter-track">
                  <div className="meter-fill sys" style={{ width: `${sysLevel}%` }} />
                </div>
              </div>
            </div>

            <div className="record-studio-timer" aria-label={`Tiempo transcurrido: ${formatTime(seconds)}`}>
              <span className={`timer-digits ${isPaused ? 'paused' : ''}`}>{formatTime(seconds)}</span>
            </div>

            <div className="record-studio-actions">
              {isPaused ? (
                <button
                  type="button"
                  className="btn btn-resume"
                  onClick={handlePauseResume}
                  disabled={isBackendOffline || isCancelling || isPreparing}
                  title="Reanudar captura de audio"
                >
                  <Icon name="play" size={15} />
                  <span>Reanudar</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-pause"
                  onClick={handlePauseResume}
                  disabled={isBackendOffline || isCancelling || isPreparing}
                  title="Pausar grabación temporalmente"
                >
                  <Icon name="pause" size={15} />
                  <span>Pausar</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-finish"
                onClick={handleStartStop}
                disabled={isBackendOffline || isCancelling || isPreparing || isFinalizing}
                title={isFinalizing ? "Finalizando grabación y preparando análisis..." : "Detener y procesar reunión con IA"}
              >
                {isFinalizing ? (
                  <>
                    <div className="spinner-small" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    <span>Finalizando...</span>
                  </>
                ) : (
                  <>
                    <Icon name="stop" size={15} />
                    <span>Finalizar Reunión</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-cancel-recording"
                onClick={handleCancelRecording}
                disabled={isBackendOffline || isCancelling || isPreparing}
                title="Descartar grabación sin guardar"
              >
                <Icon name="x" size={15} />
                <span>Descartar</span>
              </button>
            </div>
          </div>

          {/* Área Principal de 2 Columnas */}
          <div className="record-studio-body">
            {/* Columna Izquierda (65%): Transcripción en Vivo o Estudio Visualizador */}
            <div className="record-studio-left glass">
              {isLiveTranscriptionEnabled ? (
                <LiveTranscriptPanel
                  liveSegments={liveSegments}
                  partialText={partialText}
                  streamStatus={streamStatus}
                  errorMessage={streamError}
                  totalWords={totalWords}
                  isPaused={isPaused}
                  formatSegmentTime={formatSegmentTime}
                />
              ) : (
                <div className="record-studio-visualizer-panel">
                  <div className="visualizer-header">
                    <div className="visualizer-title-group">
                      <Icon name="mic" size={18} style={{ color: 'var(--accent-primary)' }} />
                      <h2 className="visualizer-title">Captura de Audio Activa</h2>
                    </div>
                    <button
                      type="button"
                      className="btn-enable-live-transcription"
                      onClick={() => {
                        handleToggleLiveTranscription(true)
                        if (sessionIdRef.current) {
                          connectLiveSse(sessionIdRef.current)
                        }
                      }}
                      title="Activar transcripción en tiempo real palabra por palabra"
                    >
                      <Icon name="target" size={14} />
                      <span>Activar Transcripción en Vivo</span>
                    </button>
                  </div>

                  <div className="visualizer-body">
                    <div className={`studio-waveform ${isPaused ? 'paused' : ''}`}>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className="studio-wave-bar"
                          style={{
                            animationDelay: `${(i % 8) * 0.12}s`,
                            animationPlayState: isPaused ? 'paused' : 'running',
                            height: isPaused ? '8px' : `${Math.max(14, Math.min(76, ((micLevel + sysLevel) / 2) * 0.8 + ((i * 7) % 25)))}px`
                          }}
                        />
                      ))}
                    </div>

                    <div className="visualizer-status-text">
                      {isPaused
                        ? 'Grabación pausada. El micrófono no está capturando audio.'
                        : 'Capturando audio del sistema y micrófono con máxima privacidad.'}
                    </div>

                    <div className="studio-rms-dashboard">
                      <div className="rms-meter-card">
                        <div className="rms-card-header">
                          <span className="rms-card-title">
                            <Icon name="mic" size={14} /> Micrófono
                          </span>
                          <span className="rms-card-val">{micLevel}%</span>
                        </div>
                        <div className="rms-large-track">
                          <div
                            className="rms-large-fill mic"
                            style={{ width: `${micLevel}%` }}
                          />
                        </div>
                      </div>

                      <div className="rms-meter-card">
                        <div className="rms-card-header">
                          <span className="rms-card-title">
                            <Icon name="volume" size={14} /> Audio del Sistema
                          </span>
                          <span className="rms-card-val">{sysLevel}%</span>
                        </div>
                        <div className="rms-large-track">
                          <div
                            className="rms-large-fill sys"
                            style={{ width: `${sysLevel}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="visualizer-tips-card">
                      <div className="tip-item">
                        <Icon name="lock" size={14} style={{ color: 'var(--green-ok)' }} />
                        <span>Privacidad Total: Todo el procesamiento es local en tu equipo.</span>
                      </div>
                      <div className="tip-item">
                        <Icon name="bookmark" size={14} style={{ color: '#F59E0B' }} />
                        <span>Presiona la tecla <strong>M</strong> para fijar un momento clave con nota.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Columna Derecha (35%): Estación de Marcadores en Vivo */}
            <div className="record-studio-right glass">
              <div className="bookmarks-station-header">
                <div className="bookmarks-title-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="bookmark" size={16} style={{ color: '#F59E0B' }} />
                    <h3 className="bookmarks-title">Momentos Clave</h3>
                  </div>
                  <span className="bookmarks-count-badge">
                    {bookmarks.length} {bookmarks.length === 1 ? 'marcador' : 'marcadores'}
                  </span>
                </div>
                <p className="bookmarks-subtitle">
                  Fija acuerdos o temas importantes con un clic o atajo.
                </p>
              </div>

              {/* Formulario de Marcador */}
              <div className="bookmark-form-box">
                <div className="bookmark-input-row">
                  <span className="bookmark-timestamp-tag">
                    {formatTime(seconds)}
                  </span>
                  <input
                    ref={noteInputRef}
                    type="text"
                    className="bookmark-text-input"
                    placeholder="Nota rápida (Enter para guardar)..."
                    value={bookmarkNote}
                    onChange={(e) => setBookmarkNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleLiveBookmark()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-save-bm"
                    onClick={() => handleLiveBookmark()}
                    disabled={!isRecording}
                    title="Guardar marcador"
                  >
                    <Icon name="check" size={13} />
                    <span>Fijar</span>
                  </button>
                </div>

                <div className="quick-tags-container">
                  <span className="quick-tags-hint">Etiquetas rápidas:</span>
                  <div className="quick-tags-list">
                    {['Decisión', 'Punto Clave', 'Acuerdo / Tarea', 'Importante', 'Duda'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-tag-pill"
                        onClick={() => handleLiveBookmark(tag)}
                        title={`Agregar marcador con etiqueta "${tag}"`}
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Línea de tiempo de marcadores */}
              <div className="bookmarks-timeline-wrapper">
                <div className="bookmarks-timeline-header">
                  <span>Línea de tiempo</span>
                  <span className="shortcut-hint">Atajo: Tecla [M]</span>
                </div>

                {bookmarks.length === 0 ? (
                  <div className="bookmarks-empty-state">
                    <div className="bm-empty-icon">
                      <Icon name="bookmark" size={22} />
                    </div>
                    <p className="bm-empty-text">Sin marcadores aún</p>
                    <p className="bm-empty-sub">
                      Presiona <strong>M</strong> o usa las etiquetas rápidas para resaltar momentos en el audio.
                    </p>
                  </div>
                ) : (
                  <div className="bookmarks-items-list">
                    {bookmarks.map((bm) => (
                      <div key={bm.id} className="bookmark-item-row">
                        <span className="bm-item-time">{formatSegmentTime(bm.time)}</span>
                        <span className="bm-item-note">{bm.note || 'Momento destacado'}</span>
                        <button
                          type="button"
                          className="bm-item-delete"
                          onClick={() => handleDeleteBookmark(bm.id)}
                          title="Eliminar marcador"
                          aria-label={`Eliminar marcador a los ${formatSegmentTime(bm.time)}`}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botón Iniciar Grabación (Solo cuando NO está grabando) */}
      {!isStudioActive && (
        <div className={`record-btn-wrapper ${isBackendOffline ? 'offline' : ''}`}>
          <button
            type="button"
            className="record-btn"
            onClick={handleStartStop}
            disabled={isBackendOffline || isPreparing}
            style={{
              cursor: isBackendOffline || isPreparing ? 'not-allowed' : 'pointer',
              opacity: isBackendOffline || isPreparing ? 0.5 : 1,
              filter: isBackendOffline ? 'grayscale(1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label={isPreparing ? 'Iniciando grabación...' : 'Iniciar grabación'}
            title={isBackendOffline ? 'Sin conexión al backend' : 'Iniciar grabación'}
          >
            {isPreparing ? (
              <div className="spinner-small" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: 24, height: 24, borderWidth: 3 }}></div>
            ) : (
              <span className="btn-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="mic" size={32} />
              </span>
            )}
          </button>
        </div>
      )}

      {/* Carga de audio (Solo si no está grabando) */}
      {!isStudioActive && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 24, textAlign: 'center' }}>
            Se utilizará el <strong>Micrófono</strong> o el <strong>Sistema</strong> según tu configuración.
          </p>

          <div className="upload-container" style={{ width: '100%', maxWidth: 420, marginTop: 12 }}>
            <div className="upload-divider">
              <span>o también</span>
            </div>

            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''} ${isBackendOffline ? 'disabled' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isBackendOffline && !isUploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac,audio/*"
                style={{ display: 'none' }}
              />

              {isUploading ? (
                <div className="upload-progress-box">
                  <div className="spinner-small" />
                  <div className="upload-progress-text">Subiendo audio... {uploadProgress}%</div>
                  <div className="upload-progress-bar">
                    <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="upload-prompt">
                  <span className="upload-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <Icon name="upload" size={28} style={{ color: 'var(--accent-primary)' }} />
                  </span>
                  <span className="upload-text">
                    Arrastra un archivo de audio aquí o <span className="upload-link">selecciónalo</span>
                  </span>
                  <span className="upload-subtext">WAV, MP3, M4A, MP4, OGG, FLAC</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

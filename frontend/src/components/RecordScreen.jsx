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
  getLiveTranscriptionUrl
} from '../api'
import { useSystem } from '../context/SystemContext'

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
  const [liveSegments, setLiveSegments] = useState([])
  const [partialText, setPartialText] = useState('')
  const [streamStatus, setStreamStatus] = useState('idle') // idle | connecting | listening | transcribing | paused | finalizing
  const [isCancelling, setIsCancelling] = useState(false)

  const sseRef = useRef(null)
  const transcriptContainerRef = useRef(null)
  const userScrolledUpRef = useRef(false)

  // Polling de niveles de audio mientras se graba activamente
  useEffect(() => {
    let intervalId
    if (isRecording && !isPaused && !isBackendOffline) {
      intervalId = setInterval(async () => {
        try {
          const res = await getAudioTestLevels()
          const scaleLevel = (val) => Math.min(100, Math.round(Math.sqrt(val) * 160))
          setMicLevel(scaleLevel(res.data.mic_level))
          setSysLevel(scaleLevel(res.data.sys_level))
        } catch (err) {
          console.error('Error al obtener niveles en tiempo real:', err)
        }
      }, 150)
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
    setStreamStatus('connecting')
    userScrolledUpRef.current = false

    const url = getLiveTranscriptionUrl(sid)
    const es = new EventSource(url)
    sseRef.current = es

    es.onopen = () => {
      setStreamStatus('listening')
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
      setStreamStatus((prev) => (prev === 'idle' ? 'idle' : 'connecting'))
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

  // Auto-scroll inteligente: solo baja automáticamente si el usuario no ha subido manualmente
  const handleTranscriptScroll = () => {
    const el = transcriptContainerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledUpRef.current = !isNearBottom
  }

  useEffect(() => {
    if (!userScrolledUpRef.current && transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight
    }
  }, [liveSegments, partialText])

  const handleStartStop = async () => {
    if (isBackendOffline) return
    if (!isRecording) {
      // INICIAR GRABACIÓN
      try {
        setIsRecording(true)
        setIsPaused(false)
        setSeconds(0)

        const res = await startRecording()
        audioPathRef.current = res.data.audio_path
        const sid = res.data.session_id
        setSessionId(sid)
        connectLiveSse(sid)
        showToast({ type: 'success', message: '🎙️ Grabación y transcripción en vivo iniciadas' })
      } catch (err) {
        setIsRecording(false)
        setIsPaused(false)
        const msg = err.response?.data?.detail || 'Error al iniciar la grabación'
        showToast({ type: 'error', message: msg })
      }
    } else {
      // DETENER GRABACIÓN
      try {
        const currentPath = audioPathRef.current
        setStreamStatus('finalizing')
        setIsRecording(false)
        setIsPaused(false)

        if (sseRef.current) {
          sseRef.current.close()
          sseRef.current = null
        }

        const res = await stopRecording()
        showToast({ type: 'info', message: '✅ Grabación guardada. Procesando...' })
        onRecordingDone(res.data.audio_path || currentPath)
      } catch (err) {
        setIsRecording(false)
        setIsPaused(false)
        const msg = err.response?.data?.detail || 'Error al detener la grabación'
        showToast({ type: 'error', message: msg })
      }
    }
  }

  const handleCancelRecording = async () => {
    if (isBackendOffline || isCancelling) return
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
      setSeconds(0)
      audioPathRef.current = null
      setSessionId(null)
      setStreamStatus('idle')
      showToast({ type: 'info', message: 'Grabación y transcripción canceladas' })
    } catch (err) {
      console.error('Error al cancelar grabación:', err)
      showToast({ type: 'error', message: 'Error al cancelar la grabación' })
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePauseResume = async () => {
    if (isBackendOffline) return
    if (isPaused) {
      try {
        setIsPaused(false)
        await resumeRecording()
        setStreamStatus('listening')
        showToast({ type: 'success', message: '🎙️ Grabación reanudada' })
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

  return (
    <div className="record-screen" style={{ paddingTop: isRecording ? 40 : 80 }}>
      {/* Estado inactivo / Inicial */}
      {!isRecording && (
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="record-title" style={{ fontSize: 36, marginBottom: 12 }}>Listo para grabar</h1>
          <p className="record-subtitle" style={{ margin: '0 auto', fontSize: 16 }}>
            Presiona el botón para iniciar la captura de audio y análisis automático con IA.
          </p>
        </div>
      )}

      {/* Tarjeta de Grabación Activa */}
      {isRecording && (
        <div className="glass record-active-card">
          <div style={{ textAlign: 'center' }}>
            <h1 className="record-title" style={{ fontSize: 24, color: isPaused ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
              {isPaused ? 'Grabación pausada' : 'Grabando reunión...'}
            </h1>
            <p className="record-subtitle" style={{ margin: '8px auto 0', fontSize: 14 }}>
              {isPaused 
                ? 'El audio no está siendo capturado. Haz clic en Reanudar para continuar.' 
                : 'Capturando audio y transcribiendo en vivo.'}
            </p>
          </div>

          <div className={`waveform ${isPaused ? 'paused' : ''}`} style={{ marginTop: 12, marginBottom: 12 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{ 
                  animationDelay: `${i * 0.1}s`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                  opacity: isPaused ? 0.3 : 1,
                  background: isPaused ? 'var(--text-muted)' : 'var(--accent-primary)'
                }}
              />
            ))}
          </div>

          <div className="timer big-digital" style={{ opacity: isPaused ? 0.5 : 1 }}>
            {formatTime(seconds)}
          </div>

          {/* Indicadores de volumen discretos */}
          {!isPaused && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 20, 
              marginTop: 12, 
              padding: '6px 16px',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: 'var(--radius-full)',
              width: 'fit-content',
              margin: '12px auto 0'
            }}>
              {/* Medidor de Micrófono */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>🎤 Mic:</span>
                <div style={{ width: 45, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${micLevel}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-violet))', transition: 'width 80ms ease' }} />
                </div>
              </div>

              {/* Medidor de Sistema */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>🖥️ Sis:</span>
                <div style={{ width: 45, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${sysLevel}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, var(--accent-primary))', transition: 'width 80ms ease' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles de Grabación */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', marginTop: isRecording ? -20 : 0, zIndex: 10 }}>
        {isRecording && (
          <button
            className="btn btn-secondary"
            onClick={handlePauseResume}
            disabled={isBackendOffline || isCancelling}
            style={{
              borderRadius: 'var(--radius-full)',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-md)',
              cursor: isBackendOffline || isCancelling ? 'not-allowed' : 'pointer',
              transition: 'transform var(--transition-fast)',
              opacity: isBackendOffline || isCancelling ? 0.5 : 1
            }}
            onMouseEnter={(e) => !isBackendOffline && !isCancelling && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => !isBackendOffline && !isCancelling && (e.currentTarget.style.transform = 'scale(1)')}
            title={isBackendOffline ? 'Sin conexión al backend' : (isPaused ? 'Reanudar grabación' : 'Pausar grabación')}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
        )}

        <div className={`record-btn-wrapper ${isRecording ? 'recording' : ''} ${isPaused ? 'paused' : ''} ${isBackendOffline ? 'offline' : ''}`}>
          <button
            className="record-btn"
            onClick={handleStartStop}
            disabled={isBackendOffline || isCancelling}
            style={{
              cursor: isBackendOffline || isCancelling ? 'not-allowed' : 'pointer',
              opacity: isBackendOffline || isCancelling ? 0.5 : 1,
              filter: isBackendOffline ? 'grayscale(1)' : 'none'
            }}
            title={isBackendOffline ? 'Sin conexión al backend' : (isRecording ? 'Detener grabación' : 'Iniciar grabación')}
          >
            <span className="btn-icon">
              {isRecording ? '⬛' : '⏺'}
            </span>
          </button>
        </div>

        {/* Botón Cancelar Grabación */}
        {isRecording && (
          <button
            className="btn btn-secondary"
            onClick={handleCancelRecording}
            disabled={isBackendOffline || isCancelling}
            style={{
              borderRadius: 'var(--radius-full)',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              boxShadow: 'var(--shadow-md)',
              cursor: isBackendOffline || isCancelling ? 'not-allowed' : 'pointer',
              transition: 'transform var(--transition-fast), background var(--transition-fast)',
              opacity: isBackendOffline || isCancelling ? 0.5 : 1
            }}
            onMouseEnter={(e) => !isBackendOffline && !isCancelling && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => !isBackendOffline && !isCancelling && (e.currentTarget.style.transform = 'scale(1)')}
            title="Cancelar y descartar grabación"
          >
            ✕
          </button>
        )}
      </div>

      {/* Panel de Transcripción en Vivo (Visible mientras se graba) */}
      {isRecording && (
        <div className="live-transcript-card">
          <div className="live-transcript-header">
            <div className="live-transcript-status">
              <span
                className={`live-status-dot ${
                  streamStatus === 'transcribing'
                    ? 'pulsing'
                    : streamStatus === 'paused'
                    ? 'paused'
                    : streamStatus === 'listening'
                    ? 'listening'
                    : ''
                }`}
              />
              <span>
                {streamStatus === 'transcribing'
                  ? 'Transcribiendo en vivo'
                  : streamStatus === 'listening'
                  ? 'Escuchando audio...'
                  : streamStatus === 'paused'
                  ? 'Pausado'
                  : streamStatus === 'connecting'
                  ? 'Conectando stream...'
                  : streamStatus === 'finalizing'
                  ? 'Finalizando...'
                  : 'En vivo'}
              </span>
            </div>
            <div className="live-transcript-badge">
              📝 {totalWords} {totalWords === 1 ? 'palabra' : 'palabras'}
            </div>
          </div>

          <div
            ref={transcriptContainerRef}
            onScroll={handleTranscriptScroll}
            className="live-transcript-body"
          >
            {liveSegments.length === 0 && !partialText && (
              <div className="live-transcript-empty">
                🎙️ Habla con normalidad. La transcripción aparecerá aquí palabra por palabra en tiempo real...
              </div>
            )}

            {liveSegments.map((seg, idx) => (
              <div key={seg.seq || idx} className="live-segment-item">
                <span className="live-segment-time">
                  [{formatSegmentTime(seg.start)}]
                </span>
                <span className="live-segment-text">{seg.text}</span>
              </div>
            ))}

            {partialText && (
              <div className="live-segment-item">
                <span className="live-segment-time">
                  [{formatSegmentTime(seconds)}]
                </span>
                <span className="live-partial-text">
                  {partialText}
                  <span className="live-typing-caret" />
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Carga de audio (Solo si no está grabando) */}
      {!isRecording && (
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
                  <span className="upload-icon">📂</span>
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

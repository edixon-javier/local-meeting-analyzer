// src/components/RecordScreen.jsx
// Pantalla principal de grabación: botón record, timer, pause/resume, waveform animado.

import { useState, useEffect, useRef } from 'react'
import { startRecording, stopRecording, pauseRecording, resumeRecording, getStatus, uploadAudioFile } from '../api'
import { useSystem } from '../context/SystemContext'

export default function RecordScreen({ onRecordingDone }) {
  const { showToast, isBackendOffline, isRecording: globalIsRecording, setIsRecording: setGlobalIsRecording, systemStatus } = useSystem()
  const [isRecording, setIsRecording] = useState(globalIsRecording)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef(null)
  const audioPathRef = useRef(null)

  // Estados para carga de archivos
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


  // Sincronizar con el estado global (Atajos de teclado)
  useEffect(() => {
    setIsRecording(globalIsRecording)
  }, [globalIsRecording])

  // Sincronizar con el status del polling
  useEffect(() => {
    if (systemStatus) {
      setIsRecording(systemStatus.recording)
      setIsPaused(systemStatus.paused)
    }
  }, [systemStatus])

  // Restaurar estado si ya hay una grabación activa al entrar/recargar
  useEffect(() => {
    if (isBackendOffline) return
    const checkActiveSession = async () => {
      try {
        const res = await getStatus()
        if (res.data.recording) {
          setIsRecording(true)
          setGlobalIsRecording(true)
          setIsPaused(res.data.paused)
        }
      } catch (err) {
        console.warn('No se pudo verificar el estado inicial de grabación.')
      }
    }
    checkActiveSession()
  }, [isBackendOffline])

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

  const handleStartStop = async () => {
    if (isBackendOffline) return
    if (!isRecording) {
      // INICIAR GRABACIÓN
      try {
        const res = await startRecording()
        audioPathRef.current = res.data.audio_path
        setIsRecording(true)
        setGlobalIsRecording(true)
        setIsPaused(false)
        setSeconds(0)
        showToast({ type: 'success', message: '🎙️ Grabación iniciada' })
      } catch (err) {
        const msg = err.response?.data?.detail || 'Error al iniciar la grabación'
        showToast({ type: 'error', message: msg })
      }
    } else {
      // DETENER GRABACIÓN
      try {
        const res = await stopRecording()
        setIsRecording(false)
        setGlobalIsRecording(false)
        setIsPaused(false)
        showToast({ type: 'info', message: '✅ Grabación guardada. Procesando...' })
        onRecordingDone(res.data.audio_path)
      } catch (err) {
        const msg = err.response?.data?.detail || 'Error al detener la grabación'
        showToast({ type: 'error', message: msg })
        setIsRecording(false)
        setGlobalIsRecording(false)
        setIsPaused(false)
      }
    }
  }

  const handlePauseResume = async () => {
    if (isBackendOffline) return
    if (isPaused) {
      try {
        await resumeRecording()
        setIsPaused(false)
        showToast({ type: 'success', message: '🎙️ Grabación reanudada' })
      } catch (err) {
        showToast({ type: 'error', message: 'Error al reanudar la grabación' })
      }
    } else {
      try {
        await pauseRecording()
        setIsPaused(true)
        showToast({ type: 'info', message: '⏸️ Grabación pausada' })
      } catch (err) {
        showToast({ type: 'error', message: 'Error al pausar la grabación' })
      }
    }
  }

  return (
    <div className="record-screen" style={{ paddingTop: isRecording ? 60 : 80 }}>
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
                : 'Capturando audio en segundo plano.'}
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
        </div>
      )}

      {/* Controles de Grabación (Siempre visibles, ajustan su posición según el estado) */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', marginTop: isRecording ? -20 : 0, zIndex: 10 }}>
        {isRecording && (
          <button
            className="btn btn-secondary"
            onClick={handlePauseResume}
            disabled={isBackendOffline}
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
              cursor: isBackendOffline ? 'not-allowed' : 'pointer',
              transition: 'transform var(--transition-fast)',
              opacity: isBackendOffline ? 0.5 : 1
            }}
            onMouseEnter={(e) => !isBackendOffline && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => !isBackendOffline && (e.currentTarget.style.transform = 'scale(1)')}
            title={isBackendOffline ? 'Sin conexión al backend' : (isPaused ? 'Reanudar grabación' : 'Pausar grabación')}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
        )}

        <div className={`record-btn-wrapper ${isRecording ? 'recording' : ''} ${isPaused ? 'paused' : ''} ${isBackendOffline ? 'offline' : ''}`}>
          <button
            className="record-btn"
            onClick={handleStartStop}
            disabled={isBackendOffline}
            style={{
              cursor: isBackendOffline ? 'not-allowed' : 'pointer',
              opacity: isBackendOffline ? 0.5 : 1,
              filter: isBackendOffline ? 'grayscale(1)' : 'none'
            }}
            title={isBackendOffline ? 'Sin conexión al backend' : (isRecording ? 'Detener grabación' : 'Iniciar grabación')}
          >
            <span className="btn-icon">
              {isRecording ? '⬛' : '⏺'}
            </span>
          </button>
        </div>
      </div>

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
              className={`upload-zone glass ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && !isBackendOffline && fileInputRef.current?.click()}
              style={{
                cursor: (isBackendOffline || isUploading) ? 'not-allowed' : 'pointer',
                opacity: isBackendOffline ? 0.5 : 1
              }}
              title={isBackendOffline ? 'Sin conexión al backend' : 'Cargar archivo de audio'}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac,audio/*"
                style={{ display: 'none' }}
                disabled={isBackendOffline || isUploading}
              />
              
              {isUploading ? (
                <div className="upload-progress-wrapper">
                  <div className="upload-spinner" />
                  <span className="upload-text">Subiendo archivo...</span>
                  <div className="upload-progress-bar-bg">
                    <div className="upload-progress-bar-fg" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="upload-percentage">{uploadProgress}%</span>
                </div>
              ) : (
                <div className="upload-prompt">
                  <span className="upload-icon">📂</span>
                  <span className="upload-title">Importar archivo de audio</span>
                  <span className="upload-subtitle">Arrastra y suelta tu archivo aquí, o haz clic para explorar</span>
                  <span className="upload-formats">WAV, MP3, M4A, AAC, OGG (máx. 100MB)</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tips cuando no graba */}
      {!isRecording && (
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 500,
        }}>
          {[
            { icon: '🔊', text: 'Hardware configurable' },
            { icon: '🔒', text: '100% local, sin nube' },
            { icon: '🤖', text: 'Análisis con IA offline' },
          ].map((tip) => (
            <div
              key={tip.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <span>{tip.icon}</span>
              {tip.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

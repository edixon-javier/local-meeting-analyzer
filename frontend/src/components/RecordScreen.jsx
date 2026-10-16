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
  deleteLiveBookmark,
  getConfig,
  updateConfig,
  getAudioDevices,
  startAudioTest,
  stopAudioTest
} from '../api'
import { useSystem } from '../hooks/useSystem'
import { useConsent } from './onboarding/useConsent'
import { t as consentText } from './onboarding/consentText'
import Icon from './Icon'
import LiveTranscriptPanel from './recording/LiveTranscriptPanel'
import { getPrivacyNotice } from '../utils/engineStatus'

// Fuente de audio configurada (Configuración › Audio)
const RECORD_SOURCE_LABELS = {
  both: 'audio del sistema + micrófono',
  system: 'solo el audio del sistema',
  mic: 'solo el micrófono',
}

export default function RecordScreen({ onRecordingDone }) {
  const { showToast, isBackendOffline, isRecording, setIsRecording, isPaused, setIsPaused, systemStatus } = useSystem()
  const { ensureConsent } = useConsent()
  const consentPendingRef = useRef(false)
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

  // Prueba de niveles de audio antes de iniciar la grabación
  const [isTestingAudio, setIsTestingAudio] = useState(false)
  const [testMicLevel, setTestMicLevel] = useState(0)
  const [testSysLevel, setTestSysLevel] = useState(0)
  const testIntervalRef = useRef(null)

  const toggleAudioTest = async () => {
    if (isTestingAudio) {
      setIsTestingAudio(false)
      if (testIntervalRef.current) clearInterval(testIntervalRef.current)
      try {
        await stopAudioTest()
      } catch (e) {
        console.error(e)
      }
      setTestMicLevel(0)
      setTestSysLevel(0)
    } else {
      setIsTestingAudio(true)
      try {
        await startAudioTest()
        testIntervalRef.current = setInterval(async () => {
          try {
            const res = await getAudioTestLevels()
            if (res.data) {
              setTestMicLevel(Math.min(100, Math.round(res.data.mic_level * 100)))
              setTestSysLevel(Math.min(100, Math.round(res.data.sys_level * 100)))
            }
          } catch {
            // ignorar
          }
        }, 150)
      } catch (err) {
        console.error('Error al iniciar prueba de audio:', err)
        setIsTestingAudio(false)
        showToast({ type: 'error', message: 'No se pudo iniciar la prueba de audio' })
      }
    }
  }

  useEffect(() => {
    return () => {
      if (testIntervalRef.current) clearInterval(testIntervalRef.current)
      stopAudioTest().catch(() => {})
    }
  }, [])

  // Edición interactiva de notas de marcadores en vivo
  const [editingBookmarkId, setEditingBookmarkId] = useState(null)
  const [editingBookmarkNote, setEditingBookmarkNote] = useState('')

  const handleStartEditBookmark = (bm) => {
    setEditingBookmarkId(bm.id)
    setEditingBookmarkNote(bm.note || '')
  }

  const handleSaveEditedBookmark = async (bm) => {
    const updatedNote = editingBookmarkNote.trim()
    setBookmarks(prev => prev.map(b => b.id === bm.id ? { ...b, note: updatedNote } : b))
    setEditingBookmarkId(null)
    try {
      await addLiveBookmark(bm.time, updatedNote)
      showToast({ type: 'success', message: 'Nota actualizada' })
    } catch (err) {
      console.error('Error al actualizar nota del marcador:', err)
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

  // Dispositivos y fuente de grabación
  const [devices, setDevices] = useState([])
  const [micDeviceId, setMicDeviceId] = useState('default')
  const [recordMode, setRecordMode] = useState('both')

  // Cargar lista de dispositivos de audio
  useEffect(() => {
    if (!isBackendOffline) {
      getAudioDevices()
        .then((res) => {
          setDevices(res.data?.devices || [])
        })
        .catch(() => {})
    }
  }, [isBackendOffline])

  // Proveedor de IA configurado (para que la línea de privacidad sea veraz)
  const [privacyConfig, setPrivacyConfig] = useState(null)
  useEffect(() => {
    let cancelled = false
    getConfig()
      .then((res) => {
        if (cancelled) return
        const cfg = res.data || {}
        setPrivacyConfig({
          provider: cfg.ai_provider,
          cloudFallback: Boolean(cfg.allow_cloud_fallback),
          recordMode: cfg.record_mode || 'both'
        })
        if (cfg.mic_device_id) setMicDeviceId(cfg.mic_device_id)
        if (cfg.record_mode) setRecordMode(cfg.record_mode)
      })
      .catch(() => {
        // Sin configuración disponible: se usa el proveedor que reporta /status (si lo hay)
      })
    return () => {
      cancelled = true
    }
  }, [systemStatus?.ai_provider, systemStatus?.allow_cloud_fallback])

  const handleMicChange = async (newDeviceId) => {
    setMicDeviceId(newDeviceId)
    try {
      await updateConfig({ mic_device_id: newDeviceId })
      showToast({ type: 'success', message: 'Micrófono actualizado' })
    } catch (err) {
      console.error('Error al actualizar micrófono:', err)
      showToast({ type: 'error', message: 'No se pudo actualizar el micrófono' })
    }
  }

  const handleModeChange = async (newMode) => {
    setRecordMode(newMode)
    setPrivacyConfig(prev => prev ? { ...prev, recordMode: newMode } : { recordMode: newMode })
    try {
      await updateConfig({ record_mode: newMode })
      showToast({ type: 'success', message: `Modo: ${RECORD_SOURCE_LABELS[newMode] || newMode}` })
    } catch (err) {
      console.error('Error al actualizar modo:', err)
    }
  }

  const privacyNotice = getPrivacyNotice(
    privacyConfig?.provider || systemStatus?.ai_provider,
    privacyConfig?.cloudFallback ?? systemStatus?.allow_cloud_fallback
  )

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

  const handleDragLeave = (e) => {
    // Ignorar el dragleave que se produce al pasar sobre elementos hijos (evita parpadeo)
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDragging(false)
  }

  const openFilePicker = () => {
    if (isBackendOffline || isUploading) return
    fileInputRef.current?.click()
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
    // Permite volver a elegir el mismo archivo (p. ej. tras un error)
    e.target.value = ''
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
    showToast({ type: 'info', message: 'Subiendo archivo de audio…' })

    try {
      const res = await uploadAudioFile(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(percent)
      })

      showToast({ type: 'success', message: 'Archivo subido. Iniciando análisis…' })
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
      // CONSENTIMIENTO: antes de capturar audio hay que haber aceptado el aviso (una sola vez)
      if (consentPendingRef.current) return
      consentPendingRef.current = true
      let consented = false
      try {
        consented = await ensureConsent()
      } finally {
        consentPendingRef.current = false
      }
      if (!consented) return

      // DETENER PRUEBA PREVIA SI ESTABA ACTIVA
      if (isTestingAudio) {
        if (testIntervalRef.current) clearInterval(testIntervalRef.current)
        setIsTestingAudio(false)
        await stopAudioTest().catch(() => {})
      }

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
        showToast({ type: 'info', message: 'Grabación pausada' })
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
      {/* Consola en Reposo (Modern Audio Studio Hub) */}
      {!isStudioActive && (
        <div className="record-hub-container">
          {/* 1. Isla Superior de Selección Rápida de Micrófono, Fuente y Test */}
          <div className="record-top-island">
            <div className="record-island-left">
              {/* Selector Rápido de Micrófono */}
              <div className="quick-mic-selector" title="Dispositivo de micrófono activo">
                <Icon name="mic" size={13} style={{ color: 'var(--accent-primary)' }} />
                <select
                  value={micDeviceId}
                  onChange={(e) => handleMicChange(e.target.value)}
                  disabled={isBackendOffline}
                  className="quick-mic-select"
                  aria-label="Seleccionar micrófono"
                >
                  <option value="default">Predeterminado del sistema</option>
                  {devices
                    .filter((d) => d.id !== 'loopback')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Segmented Selector de Modo */}
              <div className="mode-segmented-pill" role="radiogroup" aria-label="Fuente de grabación">
                <button
                  type="button"
                  className={`mode-segment-btn ${recordMode === 'both' ? 'active' : ''}`}
                  onClick={() => handleModeChange('both')}
                  title="Captura tanto tu micrófono como el audio de la llamada (Meet, Teams, Zoom)"
                >
                  <Icon name="layers" size={12} />
                  <span>Ambos</span>
                </button>
                <button
                  type="button"
                  className={`mode-segment-btn ${recordMode === 'mic' ? 'active' : ''}`}
                  onClick={() => handleModeChange('mic')}
                  title="Graba solo tu micrófono"
                >
                  <Icon name="mic" size={12} />
                  <span>Solo Mic</span>
                </button>
                <button
                  type="button"
                  className={`mode-segment-btn ${recordMode === 'system' ? 'active' : ''}`}
                  onClick={() => handleModeChange('system')}
                  title="Graba solo el audio interno de tu equipo"
                >
                  <Icon name="volume" size={12} />
                  <span>Solo Sistema</span>
                </button>
              </div>
            </div>

            <div className="record-island-right">
              {/* Toggle Transcripción en Vivo */}
              <label className="switch-field" style={{ fontSize: 12, margin: 0 }}>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={isLiveTranscriptionEnabled}
                  aria-checked={isLiveTranscriptionEnabled}
                  onChange={(e) => handleToggleLiveTranscription(e.target.checked)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>En tiempo real</span>
              </label>

              {/* Botón Probar Micrófono */}
              <button
                type="button"
                className={`btn btn-secondary btn-sm ${isTestingAudio ? 'btn-active-test' : ''}`}
                onClick={toggleAudioTest}
                disabled={isBackendOffline}
                title="Comprobar niveles de tu micrófono y audio del sistema antes de iniciar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 11
                }}
              >
                <Icon name={isTestingAudio ? 'stop' : 'volume'} size={12} />
                <span>{isTestingAudio ? 'Detener' : 'Probar'}</span>
              </button>
            </div>
          </div>

          {/* Medidores de prueba desplegados si está probando */}
          {isTestingAudio && (
            <div
              className="pre-rec-meter-card glass"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="mic" size={13} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mic:</span>
                <div style={{ width: 90, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${testMicLevel}%`,
                      background: 'linear-gradient(90deg, #10B981, #F59E0B)',
                      transition: 'width 0.1s ease-out'
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', width: 28, textAlign: 'right' }}>{testMicLevel}%</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="volume" size={13} style={{ color: '#38BDF8' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sis:</span>
                <div style={{ width: 90, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${testSysLevel}%`,
                      background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
                      transition: 'width 0.1s ease-out'
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', width: 28, textAlign: 'right' }}>{testSysLevel}%</span>
              </div>
            </div>
          )}

          {/* 2. Tarjeta Consola Central de Grabación */}
          <div className="record-hero-card">
            <div className={`hero-record-core record-btn-wrapper ${isBackendOffline ? 'offline' : ''}`}>
              <button
                type="button"
                className="hero-record-btn record-btn"
                onClick={handleStartStop}
                disabled={isBackendOffline || isPreparing}
                aria-busy={isPreparing || undefined}
                aria-label={isPreparing ? 'Iniciando grabación...' : 'Iniciar grabación'}
                title={isBackendOffline ? 'Sin conexión al backend' : 'Iniciar grabación (Ctrl+Shift+R)'}
              >
                {isPreparing ? (
                  <div className="spinner-small on-accent" style={{ width: 32, height: 32, borderWidth: 3 }} />
                ) : (
                  <span className="hero-record-icon btn-icon">
                    <Icon name="mic" size={42} />
                  </span>
                )}
              </button>
            </div>

            <h1 className="hero-record-title">Iniciar Grabación</h1>
            <p className="hero-record-subtitle">
              Captura audio de llamadas de Meet, Zoom, Teams o notas con transcripción y análisis inteligente.
            </p>

            <div className="hero-hotkey-chip" title="Atajo de teclado global">
              <span>Atajo:</span>
              <kbd className="kbd-tag">Ctrl</kbd>
              <span>+</span>
              <kbd className="kbd-tag">Shift</kbd>
              <span>+</span>
              <kbd className="kbd-tag">R</kbd>
            </div>

            <div className="hero-footer-strip">
              {privacyNotice && (
                <div
                  className="record-privacy-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: privacyNotice.color,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <Icon name={privacyNotice.icon} size={12} style={{ color: privacyNotice.color }} />
                  <span>{privacyNotice.text}</span>
                </div>
              )}

              <p className="consent-reminder" style={{ margin: 0 }} title={consentText('consent.reminder.tooltip')}>
                <Icon name="alert-triangle" size={12} />
                <span>{consentText('consent.reminder.text')}</span>
              </p>
            </div>
          </div>

          {/* 3. Barra Refinada de Carga de Archivos de Audio */}
          <div
            className={`record-upload-bar upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''} ${isBackendOffline ? 'disabled' : ''}`}
            role="button"
            tabIndex={isBackendOffline || isUploading ? -1 : 0}
            aria-disabled={isBackendOffline || isUploading || undefined}
            aria-busy={isUploading || undefined}
            aria-label="Subir un archivo de audio para analizarlo"
            title={isBackendOffline ? 'Sin conexión al backend' : undefined}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openFilePicker()
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac,audio/*"
              tabIndex={-1}
              style={{ display: 'none' }}
            />

            {isUploading ? (
              <div className="upload-progress-box" style={{ width: '100%' }} aria-live="polite">
                <div className="spinner-small" style={{ width: 20, height: 20 }} />
                <div className="upload-progress-text" style={{ fontSize: 13 }}>Subiendo audio… {uploadProgress}%</div>
                <div
                  className="upload-progress-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  style={{ flex: 1, height: 6 }}
                >
                  <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)'
                    }}
                  >
                    <Icon name="upload" size={16} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isDragging ? 'Suelta el archivo aquí' : '¿Ya tienes una grabación de audio?'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Arrastra tu archivo o haz clic para seleccionarlo
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '3px 8px',
                    borderRadius: 6
                  }}
                >
                  WAV · MP3 · M4A · AAC · FLAC
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Recording Studio Dashboard (Pantalla Completa Activa) ─── */}
      {isStudioActive && (
        <div className="record-studio" role="region" aria-label="Estudio de Grabación Activa">
          {/* Overlay de Finalización Suave */}
          {isFinalizing && (
            <div className="studio-finalizing-overlay" role="status" aria-live="polite">
              <div className="spinner-small" style={{ width: 36, height: 36, borderWidth: 3 }} aria-hidden="true" />
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
              {privacyNotice && (
                <span
                  className="studio-privacy-chip"
                  title={privacyNotice.text}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: privacyNotice.color,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <Icon name={privacyNotice.icon} size={12} style={{ color: privacyNotice.color, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {privacyNotice.shortText || privacyNotice.text}
                  </span>
                </span>
              )}
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
                    <div className="spinner-small on-accent" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
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

                  <div className="visualizer-body" style={{ position: 'relative' }}>
                    <div
                      className="studio-sound-aura"
                      style={{
                        transform: `scale(${1 + Math.min(1.5, (micLevel + sysLevel) / 100)})`,
                        opacity: isPaused ? 0.04 : Math.min(0.65, 0.12 + (micLevel + sysLevel) / 120)
                      }}
                    />
                    <div className={`studio-waveform ${isPaused ? 'paused' : ''}`} style={{ zIndex: 1 }}>
                      {Array.from({ length: 32 }).map((_, i) => {
                        const freqMod = Math.sin((i / 32) * Math.PI) * 0.85 + 0.35
                        const combinedLevel = (micLevel * 1.1 + sysLevel * 0.9) / 2
                        const dynamicHeight = isPaused ? 8 : Math.max(10, Math.min(84, (combinedLevel * freqMod * 1.25) + 12 + ((i * 7) % 16)))
                        return (
                          <div
                            key={i}
                            className="studio-wave-bar"
                            style={{
                              animationDelay: `${(i % 10) * 0.08}s`,
                              animationPlayState: isPaused ? 'paused' : 'running',
                              height: `${dynamicHeight}px`,
                              background: `linear-gradient(180deg, #38BDF8 0%, #818CF8 50%, #C084FC 100%)`
                            }}
                          />
                        )
                      })}
                    </div>

                    <div className="visualizer-status-text">
                      {isPaused
                        ? 'Grabación pausada. El micrófono no está capturando audio.'
                        : 'Capturando el audio del sistema y del micrófono.'}
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
                      {privacyNotice && (
                        <div className="tip-item">
                          <Icon name={privacyNotice.icon} size={14} style={{ color: privacyNotice.color }} />
                          <span>{privacyNotice.text}</span>
                        </div>
                      )}
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
                    placeholder="Nota rápida (Enter para guardar)…"
                    aria-label="Nota del momento clave"
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
                      editingBookmarkId === bm.id ? (
                        <div key={bm.id} className="bookmark-item-row is-editing" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="bm-item-time">{formatSegmentTime(bm.time)}</span>
                          <input
                            type="text"
                            value={editingBookmarkNote}
                            onChange={(e) => setEditingBookmarkNote(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditedBookmark(bm)
                              if (e.key === 'Escape') setEditingBookmarkId(null)
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '2px 6px',
                              fontSize: 12,
                              background: 'var(--bg-base)',
                              border: '1px solid var(--accent-primary)',
                              borderRadius: 4,
                              color: 'var(--text-primary)'
                            }}
                          />
                          <button
                            type="button"
                            className="bm-item-delete"
                            onClick={() => handleSaveEditedBookmark(bm)}
                            title="Guardar nota"
                            aria-label="Guardar nota editada"
                            style={{ color: 'var(--accent-primary-hover)' }}
                          >
                            <Icon name="check" size={12} />
                          </button>
                          <button
                            type="button"
                            className="bm-item-delete"
                            onClick={() => setEditingBookmarkId(null)}
                            title="Cancelar"
                            aria-label="Cancelar edición"
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ) : (
                        <div key={bm.id} className="bookmark-item-row">
                          <span className="bm-item-time">{formatSegmentTime(bm.time)}</span>
                          <span
                            className="bm-item-note"
                            onClick={() => handleStartEditBookmark(bm)}
                            title="Clic para editar nota"
                            style={{ cursor: 'pointer' }}
                          >
                            {bm.note || 'Momento destacado'}
                          </span>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
                            <button
                              type="button"
                              className="bm-item-delete"
                              onClick={() => handleStartEditBookmark(bm)}
                              title="Editar nota"
                              aria-label={`Editar nota a los ${formatSegmentTime(bm.time)}`}
                              style={{ opacity: 0.7 }}
                            >
                              <Icon name="edit" size={12} />
                            </button>
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
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

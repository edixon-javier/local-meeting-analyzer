import { useState, useEffect, useRef, useCallback } from 'react'
import { getStatus, subscribeToNetworkStatus } from '../api'
import { SystemContext } from './systemContextDef'

export function SystemProvider({ children, onToast }) {
  const [systemStatus, setSystemStatus] = useState(null)
  const [isRecording, _setIsRecording] = useState(false)
  const [isPaused, _setIsPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isBackendOffline, setIsBackendOffline] = useState(false)

  // Estados del ciclo de vida de arranque (Startup / Splash)
  const [startupPhase, setStartupPhase] = useState('initializing') // 'initializing' | 'connecting' | 'preparing' | 'ready' | 'error'
  const [startupMessage, setStartupMessage] = useState('Iniciando aplicación...')
  const [startupProgress, setStartupProgress] = useState(20)
  const [startupError, setStartupError] = useState(null)
  const [isStartupComplete, setIsStartupComplete] = useState(false)

  const lastTransitionRef = useRef(0)
  const isMountedRef = useRef(true)
  const startupAbortRef = useRef(false)
  const systemStatusRef = useRef(systemStatus)
  systemStatusRef.current = systemStatus

  const setIsRecording = (status) => {
    _setIsRecording(status)
    setSystemStatus(prev => (prev ? { ...prev, recording: status } : { recording: status }))
    lastTransitionRef.current = Date.now()
  }

  const setIsPaused = (status) => {
    _setIsPaused(status)
    setSystemStatus(prev => (prev ? { ...prev, paused: status } : { paused: status }))
    lastTransitionRef.current = Date.now()
  }

  const setPausedState = (paused) => {
    setIsPaused(paused)
  }

  // Suscribirse al estado de la red desde Axios
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((offline) => {
      setIsBackendOffline(offline)
      if (offline) {
        setSystemStatus({ ollama_running: false, recording: false, paused: false, processing: false })
        _setIsRecording(false)
        _setIsPaused(false)
      }
    })
    return unsubscribe
  }, [])

  // Rutina de comprobación y orquestación del arranque
  const performStartupCheck = useCallback(async () => {
    startupAbortRef.current = false
    setStartupPhase('connecting')
    setStartupMessage('Conectando con el motor local...')
    setStartupProgress(35)
    setStartupError(null)

    const MAX_ATTEMPTS = 30 // ~21s máximo (30 x 700ms)
    let attempts = 0
    let connected = false

    while (attempts < MAX_ATTEMPTS && !startupAbortRef.current) {
      attempts++
      try {
        const res = await getStatus()
        if (res && res.data) {
          connected = true
          setSystemStatus(res.data)
          _setIsRecording(res.data.recording || false)
          _setIsPaused(res.data.paused || false)
          break
        }
      } catch {
        // El servidor local puede estar arrancando el venv o cargando librerías
      }

      if (!connected && !startupAbortRef.current) {
        // Incremento visual gradual para dar feedback vivo
        setStartupProgress((prev) => Math.min(65, prev + 2))
        await new Promise((r) => setTimeout(r, 700))
      }
    }

    if (startupAbortRef.current) return

    if (!connected) {
      setStartupPhase('error')
      setStartupProgress(0)
      setStartupMessage('No pudimos iniciar correctamente')
      setStartupError(
        'El motor de procesamiento local en el puerto 8765 no respondió a tiempo. Comprueba que el backend esté ejecutándose.'
      )
      return
    }

    // Paso 3: Preparando servicios
    setStartupPhase('preparing')
    setStartupMessage('Preparando servicios y modelos...')
    setStartupProgress(85)

    // Breve pausa para dar fluidez visual al usuario (300ms)
    await new Promise((r) => setTimeout(r, 300))
    if (startupAbortRef.current) return

    // Paso 4: Listo
    setStartupPhase('ready')
    setStartupMessage('¡Todo listo!')
    setStartupProgress(100)

    // Tiempo suficiente para apreciar el checkmark y permitir la animación de salida (650ms)
    await new Promise((r) => setTimeout(r, 650))
    if (startupAbortRef.current) return

    setIsStartupComplete(true)
    setLoading(false)
  }, [])

  // Refresco inmediato del estado (p. ej. tras guardar la configuración), sin esperar al siguiente sondeo
  const refreshStatus = useCallback(async () => {
    try {
      const res = await getStatus()
      if (res?.data) {
        setSystemStatus((prev) => (prev ? { ...res.data, recording: prev.recording, paused: prev.paused } : res.data))
      }
    } catch {
      // El sondeo periódico se encargará de reflejar la desconexión
    }
  }, [])

  const retryStartup = useCallback(() => {
    performStartupCheck()
  }, [performStartupCheck])

  // Iniciar arranque automáticamente al montar el provider
  useEffect(() => {
    isMountedRef.current = true
    performStartupCheck()

    return () => {
      isMountedRef.current = false
      startupAbortRef.current = true
    }
  }, [performStartupCheck])

  // Escuchar eventos SSE del backend en tiempo real (solo cuando el arranque esté completo)
  useEffect(() => {
    if (!isStartupComplete) return

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8765'
    const eventSource = new EventSource(`${backendUrl}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'ollama_status') {
          const isOnline = data.status === 'online'
          const wasOnline = Boolean(systemStatusRef.current?.ollama_running)

          setSystemStatus((prev) => (prev ? { ...prev, ollama_running: isOnline } : { ollama_running: isOnline }))

          if (isOnline && !wasOnline) {
            onToast?.({
              type: 'success',
              message: 'Ollama detectado en línea. Precalentando el modelo local...',
            })
          } else if (!isOnline && wasOnline) {
            onToast?.({
              type: 'warning',
              // La nube solo se usa si el usuario lo activó en Ajustes > Privacidad (allow_cloud_fallback)
              message: systemStatusRef.current?.allow_cloud_fallback
                ? 'Ollama se ha desconectado. Se usará la nube (OpenAI) porque lo activaste en Ajustes.'
                : 'Ollama se ha desconectado. Nada se envía a la nube: inicia Ollama para analizar tus reuniones.',
            })
          }
        }
      } catch (err) {
        console.error('Error procesando mensaje SSE:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [isStartupComplete, isBackendOffline, onToast])

  // Bucle de Polling Adaptativo (solo una vez completado el arranque inicial)
  useEffect(() => {
    if (!isStartupComplete) return

    let timeoutId = null

    const fetchStatus = async () => {
      let isBusy = false
      try {
        const res = await getStatus()

        if (Date.now() - lastTransitionRef.current > 4500) {
          setSystemStatus(res.data)
          _setIsRecording(res.data.recording)
          _setIsPaused(res.data.paused)
        } else {
          setSystemStatus((prev) => {
            if (!prev) return res.data
            return {
              ...res.data,
              recording: prev.recording,
              paused: prev.paused,
            }
          })
        }

        isBusy = res.data.processing || res.data.recording
      } catch {
        setSystemStatus({ ollama_running: false, recording: false, paused: false, processing: false })
      } finally {
        setLoading(false)
      }

      const delay = isBackendOffline ? 10000 : isBusy ? 3000 : 10000
      timeoutId = setTimeout(fetchStatus, delay)
    }

    fetchStatus()
    return () => clearTimeout(timeoutId)
  }, [isStartupComplete, isBackendOffline])

  const value = {
    systemStatus,
    setSystemStatus,
    isRecording,
    setIsRecording,
    isPaused,
    setIsPaused,
    setPausedState,
    loading,
    showToast: onToast,
    isBackendOffline,
    // Ciclo de vida de arranque
    startupPhase,
    startupMessage,
    startupProgress,
    startupError,
    isStartupComplete,
    retryStartup,
    refreshStatus,
  }

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  )
}

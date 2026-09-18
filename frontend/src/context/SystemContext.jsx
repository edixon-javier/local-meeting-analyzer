import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { getStatus, subscribeToNetworkStatus } from '../api'

const SystemContext = createContext()

export function SystemProvider({ children, onToast }) {
  const [systemStatus, setSystemStatus] = useState(null)
  const [isRecording, _setIsRecording] = useState(false)
  const [isPaused, _setIsPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isBackendOffline, setIsBackendOffline] = useState(false)
  
  const lastTransitionRef = useRef(0)

  const setIsRecording = (status) => {
    _setIsRecording(status)
    setSystemStatus(prev => prev ? { ...prev, recording: status } : { recording: status })
    lastTransitionRef.current = Date.now()
  }

  const setIsPaused = (status) => {
    _setIsPaused(status)
    setSystemStatus(prev => prev ? { ...prev, paused: status } : { paused: status })
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
    return unsubscribe;
  }, [])

  // Escuchar eventos SSE del backend en tiempo real (ej. estado de Ollama)
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8765'
    const eventSource = new EventSource(`${backendUrl}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'ollama_status') {
          const isOnline = data.status === 'online';
          
          setSystemStatus(prev => {
            if (!prev) return prev;
            
            // Reaccionar ante cambios de estado
            if (isOnline && !prev.ollama_running) {
              if (onToast) {
                onToast({ 
                  type: 'success', 
                  message: '🤖 Ollama detectado en línea. Precalentando modelo Phi-3...' 
                });
              }
            } else if (!isOnline && prev.ollama_running) {
              if (onToast) {
                onToast({ 
                  type: 'warning', 
                  message: '⚠️ Ollama se ha desconectado. Usando fallback en la nube si está configurado.' 
                });
              }
            }
            return { ...prev, ollama_running: isOnline };
          });
        }
      } catch (err) {
        console.error('Error procesando mensaje SSE:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isBackendOffline, onToast]);

  // Bucle de Polling Adaptativo
  useEffect(() => {
    let timeoutId = null
    
    const fetchStatus = async () => {
      let isBusy = false
      try {
        const res = await getStatus()
        
        // Only update recording state if we haven't had a manual transition in the last 4.5 seconds.
        // This prevents race conditions with in-flight stale polls during start/stop/pause/resume actions.
        if (Date.now() - lastTransitionRef.current > 4500) {
          setSystemStatus(res.data)
          _setIsRecording(res.data.recording)
          _setIsPaused(res.data.paused)
        } else {
          // Keep our eager user transition state, but update other system properties (like ollama_running)
          setSystemStatus(prev => {
            if (!prev) return res.data
            return {
              ...res.data,
              recording: prev.recording,
              paused: prev.paused
            }
          })
        }
        
        isBusy = res.data.processing || res.data.recording
      } catch {
        // El interceptor de Axios ya marcará isBackendOffline = true,
        // pero resguardamos el estado local aquí también.
        setSystemStatus({ ollama_running: false, recording: false, paused: false, processing: false })
      } finally {
        setLoading(false)
      }
      
      // Polling dinámico:
      // - Si está desconectado: intentar cada 10s
      // - Si está procesando/grabando: cada 3s
      // - Si está libre: cada 10s
      const delay = isBackendOffline ? 10000 : (isBusy ? 3000 : 10000)
      timeoutId = setTimeout(fetchStatus, delay)
    }
    
    fetchStatus()
    return () => clearTimeout(timeoutId)
  }, [isBackendOffline]) // Re-iniciar timeout si cambia el estado de conexión

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
    isBackendOffline
  }

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  )
}

export function useSystem() {
  const context = useContext(SystemContext)
  if (!context) {
    throw new Error('useSystem debe usarse dentro de un SystemProvider')
  }
  return context
}

import { createContext, useContext, useState, useEffect } from 'react'
import { getStatus, subscribeToNetworkStatus } from '../api'

const SystemContext = createContext()

export function SystemProvider({ children, onToast }) {
  const [systemStatus, setSystemStatus] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isBackendOffline, setIsBackendOffline] = useState(false)

  // Suscribirse al estado de la red desde Axios
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((offline) => {
      setIsBackendOffline(offline)
      if (offline) {
        setSystemStatus({ ollama_running: false, recording: false, paused: false, processing: false })
        setIsRecording(false)
      }
    })
    return unsubscribe;
  }, [])

  // Bucle de Polling Adaptativo
  useEffect(() => {
    let timeoutId = null
    
    const fetchStatus = async () => {
      let isBusy = false
      try {
        const res = await getStatus()
        setSystemStatus(res.data)
        setIsRecording(res.data.recording)
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
    isRecording,
    setIsRecording,
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

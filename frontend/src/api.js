// src/api.js
// Capa de comunicación con el backend Python (FastAPI en localhost:8765)

import axios from 'axios'

const BASE_URL = 'http://localhost:8765'
export const getAudioUrl = (audioPath) => `${BASE_URL}/recordings/audio?path=${encodeURIComponent(audioPath)}`

// Estado local de conectividad en la capa de red
let isBackendOffline = false
let networkStatusListeners = []

export const subscribeToNetworkStatus = (listener) => {
  networkStatusListeners.push(listener)
  listener(isBackendOffline) // Emitir estado inicial
  return () => {
    networkStatusListeners = networkStatusListeners.filter(l => l !== listener)
  }
}

const updateNetworkStatus = (offline) => {
  if (isBackendOffline !== offline) {
    isBackendOffline = offline
    networkStatusListeners.forEach(listener => listener(isBackendOffline))
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 min para transcripciones largas
})

// Interceptor de Peticiones: Circuit Breaker
api.interceptors.request.use(
  (config) => {
    // Si sabemos que está caído y no es para chequear /status, cancelamos de inmediato
    if (isBackendOffline && config.url !== '/status') {
      const controller = new AbortController()
      config.signal = controller.signal
      controller.abort()
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de Respuestas: Detección Automática de Conexión
api.interceptors.response.use(
  (response) => {
    // Si la petición funciona, el backend está arriba
    updateNetworkStatus(false)
    return response
  },
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }
    
    // Si no hay respuesta o hay error de red, asumimos backend caído
    if (!error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
      updateNetworkStatus(true)
    }
    return Promise.reject(error)
  }
)

export const getStatus = () => api.get('/status')
export const startRecording = () => api.post('/recording/start')
export const stopRecording = () => api.post('/recording/stop')
export const pauseRecording = () => api.post('/recording/pause')
export const resumeRecording = () => api.post('/recording/resume')
export const getAudioDevices = () => api.get('/audio/devices')
export const getOllamaModels = () => api.get('/status/ollama-models')
export const transcribeAudio = (audioPath, language = null, diarize = false) =>
  api.post('/transcribe', { audio_path: audioPath, language, diarize })
export const analyzeTranscript = (transcript, segments = null, audioPath = null) =>
  api.post('/analyze', { transcript, segments, audio_path: audioPath })
export const cancelProcessing = () => api.post('/processing/cancel')
export const getSession = () => api.get('/session')
export const getRecordings = () => api.get('/recordings')
export const getRecordingMetadata = (path) => api.get('/recordings/metadata', { params: { path } })
export const deleteRecording = (filename) => api.delete(`/recordings/${filename}`)
export const renameRecording = (filename, newName) => api.post(`/recordings/${filename}/rename`, { new_name: newName })
export const getConfig = () => api.get('/config')
export const updateConfig = (config) => api.post('/config', config)
export const chatWithMeeting = (audioPath, messages, question) => api.post('/chat', { audio_path: audioPath, messages, question })

export default api


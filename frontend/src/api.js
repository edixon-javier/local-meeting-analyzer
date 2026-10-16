// src/api.js
// Capa de comunicación con el backend Python (FastAPI en localhost:8765)

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8765'
export const getAudioUrl = (audioPath) => `${BASE_URL}/recordings/audio?path=${encodeURIComponent(audioPath)}`
export const getAudioDownloadUrl = (audioPath, filename) => {
  const fileParam = filename ? `&filename=${encodeURIComponent(filename)}` : ''
  return `${BASE_URL}/recordings/audio?path=${encodeURIComponent(audioPath)}&download=true${fileParam}`
}
export const getMeetingTasksExportUrl = (filename, format = 'csv', status = 'all', title = null) => {
  const safeFilename = filename ? filename.split(/[/\\]/).pop() : ''
  let url = `${BASE_URL}/recordings/${encodeURIComponent(safeFilename)}/tasks/export?format=${encodeURIComponent(format)}&status=${encodeURIComponent(status)}`
  if (title) {
    url += `&title=${encodeURIComponent(title)}`
  }
  return url
}
export const getConsolidatedTasksExportUrl = (format = 'csv', status = 'all', category = null) => {
  let url = `${BASE_URL}/recordings/tasks/export?format=${encodeURIComponent(format)}&status=${encodeURIComponent(status)}`
  if (category && category !== 'All') {
    url += `&category=${encodeURIComponent(category)}`
  }
  return url
}

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
  timeout: 0, // Sin timeout para procesamientos muy largos
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
export const startRecording = () => api.post('/recording/start', {})
export const stopRecording = (bookmarks = null) => api.post('/recording/stop', bookmarks ? { bookmarks } : {})
export const cancelRecording = () => api.post('/recording/cancel')
export const pauseRecording = () => api.post('/recording/pause')
export const resumeRecording = () => api.post('/recording/resume')
export const addLiveBookmark = (time, note = '') => api.post('/recording/bookmark', { time, note })
export const getLiveBookmarks = () => api.get('/recording/bookmarks')
export const deleteLiveBookmark = (bookmarkId) => api.delete(`/recording/bookmarks/${encodeURIComponent(bookmarkId)}`)
export const getLiveTranscriptionUrl = (sessionId = null) => 
  `${BASE_URL}/recording/live-transcription${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`
export const getAudioDevices = () => api.get('/audio/devices')
export const getOllamaModels = () => api.get('/status/ollama-models')
export const testAiProvider = (provider, apiKey = null, model = null) =>
  api.post('/status/test-ai', { provider, api_key: apiKey, model })
export const transcribeAudio = (audioPath, language = null, diarize = false) =>
  api.post('/transcribe', { audio_path: audioPath, language, diarize })
export const analyzeTranscript = (transcript, segments = null, audioPath = null, bookmarks = null) =>
  api.post('/analyze', { transcript, segments, audio_path: audioPath, bookmarks })
export const cancelProcessing = () => api.post('/processing/cancel')
export const getSession = () => api.get('/session')
export const getRecordings = () => api.get('/recordings')
export const getRecordingMetadata = (path) => api.get('/recordings/metadata', { params: { path } })
export const deleteRecording = (filename) => api.delete(`/recordings/${filename}`)
export const renameRecording = (filename, newName) => api.post(`/recordings/${filename}/rename`, { new_name: newName })
export const renameSpeaker = (filename, oldSpeaker, newSpeaker) =>
  api.post(`/recordings/${encodeURIComponent(filename)}/rename-speaker`, {
    old_speaker: oldSpeaker,
    new_speaker: newSpeaker,
  })

// ─── Dictado Global en Cursor y Auditoría de Voz ───
export const startDictation = (data = {}) => api.post('/dictation/start', data)
export const stopDictation = (data = {}) => api.post('/dictation/stop', data)
export const cancelDictation = () => api.post('/dictation/cancel')
export const getDictationStatus = () => api.get('/dictation/status')
export const getDictationHistory = (params = {}) => api.get('/dictation/history', { params })
export const getDictationAudioUrl = (filename) => `${BASE_URL}/dictation/audio/${encodeURIComponent(filename)}`
export const deleteDictation = (id) => api.delete(`/dictation/${encodeURIComponent(id)}`)
export const reinjectDictation = (id) => api.post(`/dictation/${encodeURIComponent(id)}/reinject`)
export const addRecordingBookmark = (filename, time, note = '') =>
  api.post(`/recordings/${encodeURIComponent(filename)}/bookmarks`, { time, note })
export const deleteRecordingBookmark = (filename, bookmarkId) =>
  api.delete(`/recordings/${encodeURIComponent(filename)}/bookmarks/${encodeURIComponent(bookmarkId)}`)
export const updateRecordingTaskStatus = (filename, taskIndex, completed) =>
  api.patch(`/recordings/${encodeURIComponent(filename)}/tasks/${taskIndex}`, { completed })
export const getConsolidatedTasks = (status = 'all', category = null) => {
  const params = { status }
  if (category && category !== 'All') {
    params.category = category
  }
  return api.get('/recordings/tasks', { params })
}
export const exportMeetingTasks = (filename, format = 'csv', status = 'all', title = null) => {
  const safeFilename = filename ? filename.split(/[/\\]/).pop() : ''
  const params = { format, status }
  if (title) {
    params.title = title
  }
  return api.get(`/recordings/${encodeURIComponent(safeFilename)}/tasks/export`, {
    params,
    responseType: 'blob'
  })
}
export const exportConsolidatedTasks = (format = 'csv', status = 'all', category = null) => {
  const params = { format, status }
  if (category && category !== 'All') {
    params.category = category
  }
  return api.get('/recordings/tasks/export', {
    params,
    responseType: 'blob'
  })
}
export const getConfig = () => api.get('/config')
export const updateConfig = (config) => api.post('/config', config)
export const chatWithMeeting = (audioPath, messages, question, options = {}) =>
  api.post('/chat', { audio_path: audioPath, messages, question }, options)
export const chatWithHistory = (messages, question, options = {}) =>
  api.post('/chat/history', { messages, question }, options)

export async function chatWithMeetingStream(audioPath, messages, question, onChunk, options = {}) {
  const signal = options.signal
  try {
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_path: audioPath, messages, question }),
      signal
    })

    if (!response.ok) {
      const fallback = await chatWithMeeting(audioPath, messages, question, options)
      if (fallback.data?.response) {
        onChunk?.(fallback.data.response)
      }
      return fallback.data
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let grounding = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.error) {
              throw new Error(data.error)
            }
            if (data.text) {
              fullText += data.text
              onChunk?.(fullText)
            }
            if (data.grounding) {
              grounding = data.grounding
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }
    }
    return { response: fullText, grounding }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') {
      const abortErr = new Error('canceled')
      abortErr.name = 'CanceledError'
      throw abortErr
    }
    const fallback = await chatWithMeeting(audioPath, messages, question, options)
    if (fallback.data?.response) {
      onChunk?.(fallback.data.response)
    }
    return fallback.data
  }
}

export async function chatWithHistoryStream(messages, question, onChunk, options = {}) {
  const signal = options.signal
  try {
    const response = await fetch(`${BASE_URL}/chat/history/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, question }),
      signal
    })

    if (!response.ok) {
      const fallback = await chatWithHistory(messages, question, options)
      if (fallback.data?.response) {
        onChunk?.(fallback.data.response)
      }
      return fallback.data
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let referencedMeetings = []
    let grounding = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.error) {
              throw new Error(data.error)
            }
            if (data.text) {
              fullText += data.text
              onChunk?.(fullText)
            }
            if (data.referenced_meetings) {
              referencedMeetings = data.referenced_meetings
            }
            if (data.grounding) {
              grounding = data.grounding
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }
    }
    return { response: fullText, referenced_meetings: referencedMeetings, grounding }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') {
      const abortErr = new Error('canceled')
      abortErr.name = 'CanceledError'
      throw abortErr
    }
    const fallback = await chatWithHistory(messages, question, options)
    if (fallback.data?.response) {
      onChunk?.(fallback.data.response)
    }
    return fallback.data
  }
}
export const uploadAudioFile = (file, onUploadProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/recordings/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}
export const startAudioTest = () => api.post('/recording/test/start')
export const stopAudioTest = () => api.post('/recording/test/stop')
export const getAudioTestLevels = () => api.get('/recording/test/levels')

// ─── Primer arranque (onboarding): requisitos, Ollama y modelos de voz ───
export const getSetupRequirements = () => api.get('/setup/requirements')
export const getSetupOllama = () => api.get('/setup/ollama')
export const startSetupOllama = () => api.post('/setup/ollama/start')
export const downloadWhisperModel = (model) => api.post('/setup/whisper/download', { model })
export const getWhisperModelStatus = (model) => api.get(`/setup/whisper/status/${encodeURIComponent(model)}`)

// Descarga un modelo de Ollama leyendo el stream NDJSON del backend.
// onProgress recibe { status, total, completed, percent, digest } por cada línea.
// Resuelve al recibir "success"; rechaza con Error(message) ante cualquier fallo.
// Se puede cancelar con un AbortController (signal): rechaza con name === 'AbortError'.
export const pullOllamaModel = async (model, onProgress, signal) => {
  const response = await fetch(`${BASE_URL}/setup/ollama/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
    signal,
  })

  if (!response.ok) {
    let detail = `No se pudo iniciar la descarga (error ${response.status}).`
    try {
      const body = await response.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // Cuerpo no JSON: se usa el mensaje genérico
    }
    throw new Error(detail)
  }
  if (!response.body) {
    throw new Error('El navegador no permite leer el progreso de la descarga.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let succeeded = false

  const handleLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let event
    try {
      event = JSON.parse(trimmed)
    } catch {
      return
    }
    if (event.status === 'error') {
      throw new Error(event.error || 'La descarga del modelo falló.')
    }
    if (event.status === 'success') succeeded = true
    onProgress?.(event)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  }
  buffer += decoder.decode()
  handleLine(buffer)

  if (!succeeded) {
    throw new Error('La descarga se interrumpió antes de terminar. Inténtalo de nuevo.')
  }
}

export default api


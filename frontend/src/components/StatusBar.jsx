// src/components/StatusBar.jsx
// Barra de estado inferior con información del sistema y modelo activo.

import { useSystem } from '../context/SystemContext'

export default function StatusBar() {
  const { systemStatus, isRecording, isBackendOffline } = useSystem()

  // Determinar si los servicios individuales están activos
  const isOllamaOnline = !isBackendOffline && systemStatus?.ollama_running
  const isWhisperOnline = !isBackendOffline
  const isLLMOnline = !isBackendOffline

  return (
    <div className="status-bar">
      <div className="status-indicator">
        <span className={`status-dot ${isOllamaOnline ? 'online' : 'offline'}`} />
        <span>Ollama {isOllamaOnline ? 'conectado' : 'desconectado'}</span>
      </div>
      <div className="status-indicator">
        <span className={`status-dot ${isWhisperOnline ? 'online' : 'offline'}`} />
        <span>Whisper {isWhisperOnline ? `(${systemStatus?.whisper_model || 'small'})` : 'desconectado'}</span>
      </div>
      <div className="status-indicator">
        <span className={`status-dot ${isLLMOnline ? 'online' : 'offline'}`} />
        <span>LLM: {isLLMOnline ? (systemStatus?.llm_model || 'phi3') : 'desconectado'}</span>
      </div>
      {isRecording && (
        <div className="status-indicator" style={{ marginLeft: 'auto' }}>
          <span className="status-dot" style={{ background: 'var(--red-record)', animation: 'none', boxShadow: '0 0 6px var(--red-glow)' }} />
          <span style={{ color: '#FCA5A5', fontWeight: 600 }}>REC</span>
        </div>
      )}
      <div style={{ marginLeft: isRecording ? 0 : 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
        {isBackendOffline ? '⚠️ Conexión perdida con el Servidor' : '🔒 Procesamiento 100% local'}
      </div>
    </div>
  )
}

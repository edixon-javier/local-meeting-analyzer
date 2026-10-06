// src/components/StatusBar.jsx
// Barra de estado inferior con información del sistema y modelo activo.

import { useSystem } from '../hooks/useSystem'
import Icon from './Icon'

export default function StatusBar() {
  const { systemStatus, isRecording, isBackendOffline } = useSystem()

  const isOpenAIMode = systemStatus?.ai_provider === 'openai'
  const isOllamaOnline = !isBackendOffline && systemStatus?.ollama_running
  const isWhisperOnline = !isBackendOffline
  const isLLMOnline = !isBackendOffline

  return (
    <div className="status-bar">
      {isOpenAIMode ? (
        <div className="status-indicator">
          <span className="status-dot online" style={{ background: 'var(--accent-primary)' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="cloud" size={13} /> Proveedor: OpenAI (Nube)
          </span>
        </div>
      ) : (
        <div className="status-indicator">
          <span className={`status-dot ${isOllamaOnline ? 'online' : 'offline'}`} />
          <span>Ollama {isOllamaOnline ? 'conectado' : 'desconectado'}</span>
        </div>
      )}

      <div className="status-indicator">
        <span className={`status-dot ${isWhisperOnline ? 'online' : 'offline'}`} />
        <span>Whisper {isWhisperOnline ? `(${systemStatus?.whisper_model || 'small'})` : 'desconectado'}</span>
      </div>

      <div className="status-indicator">
        <span className={`status-dot ${isLLMOnline ? 'online' : 'offline'}`} />
        <span>LLM: {isLLMOnline ? (isOpenAIMode ? (systemStatus?.llm_model || 'gpt-4o') : (systemStatus?.llm_model || 'phi3')) : 'desconectado'}</span>
      </div>

      {isRecording && (
        <div className="status-indicator" style={{ marginLeft: 'auto' }}>
          <span className="status-dot" style={{ background: 'var(--red-record)', animation: 'none', boxShadow: '0 0 6px var(--red-glow)' }} />
          <span style={{ color: '#FCA5A5', fontWeight: 600 }}>REC</span>
        </div>
      )}

      <div style={{ marginLeft: isRecording ? 0 : 'auto', fontSize: 11, color: isOpenAIMode ? 'var(--text-accent)' : 'var(--text-muted)', fontWeight: isOpenAIMode ? 600 : 400 }}>
        {isBackendOffline ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--red-record)' }}>
            <Icon name="alert-triangle" size={13} /> Conexión perdida con el Servidor
          </span>
        ) : isOpenAIMode ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="cloud" size={13} /> Modo Nube Activo (OpenAI)
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={13} /> Procesamiento 100% local
          </span>
        )}
      </div>
    </div>
  )
}

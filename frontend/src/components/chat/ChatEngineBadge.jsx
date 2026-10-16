import React from 'react'
import Icon from '../Icon'

export default function ChatEngineBadge({ systemStatus, onNavigate, showOfflineAlert = true }) {
  if (!systemStatus) return null

  const provider = systemStatus.ai_provider || 'local'
  const model = systemStatus.llm_model || ''
  const isOllamaRunning = Boolean(systemStatus.ollama_running)

  let badgeIcon = 'lock'
  let badgeLabel = ''
  let badgeTooltip = ''
  let badgeClass = 'chat-engine-badge-local'
  let isOfflineWarning = false

  if (provider === 'local') {
    if (isOllamaRunning) {
      badgeIcon = 'lock'
      badgeLabel = `Local: ${model || 'Phi-3'} · Privado`
      badgeTooltip = 'Procesamiento 100% local en tu dispositivo. Ningún dato sale a la nube.'
      badgeClass = 'chat-engine-badge-local'
    } else {
      badgeIcon = 'alert-triangle'
      badgeLabel = 'Ollama desconectado'
      badgeTooltip = 'Ollama no está respondiendo localmente. Inícialo o activa la nube en Ajustes.'
      badgeClass = 'chat-engine-badge-warning'
      isOfflineWarning = true
    }
  } else if (provider === 'openai') {
    badgeIcon = 'cloud'
    badgeLabel = `Nube: OpenAI (${model || 'gpt-4o-mini'})`
    badgeTooltip = 'Consultas procesadas a través de la API de OpenAI.'
    badgeClass = 'chat-engine-badge-cloud'
  } else if (provider === 'claude') {
    badgeIcon = 'cloud'
    badgeLabel = `Nube: Claude (${model || 'Haiku'})`
    badgeTooltip = 'Consultas procesadas a través de la API de Anthropic Claude.'
    badgeClass = 'chat-engine-badge-cloud'
  } else if (provider === 'gemini') {
    badgeIcon = 'cloud'
    badgeLabel = `Nube: Google Gemini (${model || 'Flash'})`
    badgeTooltip = 'Consultas procesadas a través de la API de Google Gemini.'
    badgeClass = 'chat-engine-badge-cloud'
  } else {
    badgeIcon = 'cpu'
    badgeLabel = `Motor: ${provider}`
    badgeTooltip = `Proveedor de IA activo: ${provider}`
    badgeClass = 'chat-engine-badge-cloud'
  }

  return (
    <div className="chat-engine-badge-container">
      <div
        className={`chat-engine-badge ${badgeClass}`}
        title={badgeTooltip}
        role="status"
        aria-label={`Motor de IA activo: ${badgeLabel}. ${badgeTooltip}`}
      >
        <Icon name={badgeIcon} size={12} />
        <span>{badgeLabel}</span>
      </div>

      {isOfflineWarning && showOfflineAlert && (
        <div className="chat-engine-alert" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <Icon name="alert-triangle" size={14} style={{ color: 'var(--red-record)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              El motor local de Ollama está detenido. Inícialo en tu computadora o cambia a un proveedor de nube.
            </span>
          </div>
          {onNavigate && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('settings')}
              style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
            >
              Abrir Ajustes
            </button>
          )}
        </div>
      )}
    </div>
  )
}

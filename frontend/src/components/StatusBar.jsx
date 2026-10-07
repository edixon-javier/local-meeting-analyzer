// src/components/StatusBar.jsx
// Barra de estado inferior: único lugar con el detalle del motor de IA.
//  - Motor: proveedor + estado (botón que abre Configuración).
//  - Qué modelo transcribe y cuál analiza (según el proveedor real, no el modelo local por defecto).
//  - Actividad en curso (grabando / procesando).
//  - Dónde van los datos (privacidad).

import { useSystem } from '../hooks/useSystem'
import { getEngineStatus } from '../utils/engineStatus'
import Icon from './Icon'

export default function StatusBar({ onNavigate }) {
  const { systemStatus, isRecording, isPaused, isBackendOffline } = useSystem()
  const engine = getEngineStatus(systemStatus, isBackendOffline)
  const isProcessing = !isBackendOffline && Boolean(systemStatus?.processing)
  const progress = Math.round(systemStatus?.transcription_progress || 0)

  return (
    <footer className="status-bar" aria-label="Estado del sistema">
      <button
        type="button"
        className={`status-engine tone-${engine.tone}`}
        onClick={() => onNavigate?.('settings')}
        title="Abrir la configuración del motor de IA"
        aria-label={`Motor: ${engine.providerLabel}. ${engine.headline}. Abrir configuración`}
      >
        <span className="status-dot-indicator" aria-hidden="true" />
        <Icon name={engine.provider === 'openai' ? 'cloud' : 'cpu'} size={13} />
        <span className="status-engine-label">{engine.providerLabel}</span>
        <span className="status-engine-state">{engine.headline}</span>
      </button>

      {!isBackendOffline && (
        <>
          <span className="status-sep" aria-hidden="true" />
          <span className="status-item" title="Modelo que convierte el audio en texto">
            <span className="status-key">Transcripción</span> {engine.transcription}
          </span>
          <span className="status-item" title="Modelo que genera el resumen, las decisiones y las tareas">
            <span className="status-key">Análisis</span> {engine.analysis}
          </span>
        </>
      )}

      <div className="status-right">
        {isRecording && (
          <span className={`status-activity ${isPaused ? 'is-paused' : 'is-recording'}`} role="status">
            <span className="status-activity-dot" aria-hidden="true" />
            {isPaused ? 'En pausa' : 'Grabando'}
          </span>
        )}
        {!isRecording && isProcessing && (
          <span className="status-activity is-processing" role="status">
            <span className="spinner-small" style={{ width: 10, height: 10, borderWidth: 2 }} aria-hidden="true" />
            Procesando{progress > 0 && progress < 100 ? ` ${progress}%` : '…'}
          </span>
        )}
        <span className={`status-privacy tone-${engine.privacy.tone}`} title="Dónde se procesan tus reuniones">
          <Icon name={engine.privacy.icon} size={12} />
          {engine.privacy.text}
        </span>
      </div>
    </footer>
  )
}

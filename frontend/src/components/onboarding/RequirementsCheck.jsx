// src/components/onboarding/RequirementsCheck.jsx
// Paso «Tu equipo»: muestra el resultado de GET /setup/requirements con filas ok / warn / fail
// y los modelos sugeridos. Nunca bloquea: aunque algo falle se puede continuar.

import Icon from '../Icon'

const STATUS_ICON = {
  ok: { name: 'check-circle', color: 'var(--green-ok)', label: 'Cumple' },
  warn: { name: 'alert-triangle', color: 'var(--yellow-warn)', label: 'Justo' },
  fail: { name: 'x-circle', color: 'var(--red-record)', label: 'No cumple' },
}

const OVERALL = {
  ok: {
    icon: 'check-circle',
    tone: 'ok',
    title: 'Tu equipo cumple los requisitos',
    text: 'Puedes transcribir y analizar tus reuniones en local sin problema.',
  },
  warn: {
    icon: 'alert-triangle',
    tone: 'warn',
    title: 'Tu equipo cumple el mínimo',
    text: 'Todo debería funcionar, pero algunas tareas pueden ir más despacio. Te sugerimos modelos adaptados a tu equipo.',
  },
  fail: {
    icon: 'x-circle',
    tone: 'fail',
    title: 'Tu equipo no cumple algunos requisitos',
    text: 'Puedes continuar, pero la transcripción y el análisis locales pueden ir muy lentos o fallar. Si te ocurre, usa modelos más ligeros o configura OpenAI en Ajustes (enviaría el audio o el texto a ese servicio).',
  },
}

export default function RequirementsCheck({ state, onRetry }) {
  if (state.status === 'loading') {
    return (
      <div className="onb-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Comprobando tu equipo…</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="onb-callout onb-callout-warn" role="alert">
        <Icon name="alert-triangle" size={18} />
        <div className="onb-callout-text">
          <strong>No pudimos comprobar tu equipo</strong>
          <span>{state.error} Puedes continuar de todos modos.</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={13} /> Reintentar
        </button>
      </div>
    )
  }

  const { items, overall, recommendations } = state.data
  const summary = OVERALL[overall] || OVERALL.warn

  return (
    <div className="onb-requirements">
      <div className={`onb-callout onb-callout-${summary.tone}`} role="status">
        <Icon name={summary.icon} size={20} />
        <div className="onb-callout-text">
          <strong>{summary.title}</strong>
          <span>{summary.text}</span>
        </div>
      </div>

      <ul className="onb-req-list" aria-label="Resultado de la comprobación del equipo">
        {items.map((item) => {
          const icon = STATUS_ICON[item.status] || STATUS_ICON.warn
          return (
            <li key={item.id} className={`onb-req-row onb-req-${item.status}`}>
              <Icon name={icon.name} size={18} style={{ color: icon.color }} aria-label={icon.label} />
              <span className="onb-req-label">{item.label}</span>
              <span className="onb-req-value">{item.value}</span>
              <span className="onb-req-detail">{item.detail}</span>
            </li>
          )
        })}
      </ul>

      {recommendations && (
        <div className="onb-recommendation">
          <Icon name="lightbulb" size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <div className="onb-callout-text">
            <strong>Modelos sugeridos para tu equipo</strong>
            <span>
              Voz (Whisper): <code>{recommendations.whisper_model}</code>
              {recommendations.whisper_size ? ` (${recommendations.whisper_size})` : ''} · Análisis (Ollama):{' '}
              <code>{recommendations.llm_model}</code>
              {recommendations.llm_size ? ` (${recommendations.llm_size})` : ''}
            </span>
            {recommendations.reason && <span className="onb-muted">{recommendations.reason}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

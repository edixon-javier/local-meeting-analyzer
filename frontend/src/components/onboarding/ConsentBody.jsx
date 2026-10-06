// src/components/onboarding/ConsentBody.jsx
// Cuerpo del aviso de consentimiento (textos de legal/CONSENT_NOTICE.md), compartido por
// el modal de primera grabación y el último paso del asistente de bienvenida.

import { useState, useId } from 'react'
import Icon from '../Icon'
import { t, CONSENT_SCRIPT, CONSENT_TIPS } from './consentText'

export default function ConsentBody({ checked, onChange, checkboxId }) {
  const [showMore, setShowMore] = useState(false)
  const moreId = useId()

  return (
    <div className="onb-consent-body">
      <p>{t('consent.modal.body.p1')}</p>
      <p>{t('consent.modal.body.p2')}</p>
      <p>{t('consent.modal.body.p3')}</p>

      <button
        type="button"
        className="onb-link"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        aria-controls={moreId}
      >
        {t('consent.modal.learnMore')}
        <Icon name="chevron-down" size={13} className={showMore ? 'onb-chevron-open' : ''} />
      </button>

      {showMore && (
        <div id={moreId} className="onb-consent-more">
          <strong>Guion para leer al inicio de la reunión</strong>
          <blockquote>{CONSENT_SCRIPT}</blockquote>
          <ul>
            {CONSENT_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <span className="onb-muted">
            Información orientativa, no es asesoría legal. Ante cualquier duda, consulta a un abogado.
          </span>
        </div>
      )}

      <label className="onb-checkbox" htmlFor={checkboxId}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{t('consent.modal.checkbox')}</span>
      </label>
    </div>
  )
}

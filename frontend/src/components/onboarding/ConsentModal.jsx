// src/components/onboarding/ConsentModal.jsx
// Modal de consentimiento que se muestra antes de la primera grabación (usuarios que no
// completaron el onboarding o que vienen de una versión anterior).
// Accesibilidad: role="dialog", aria-modal, título enlazado, foco atrapado y Esc = «Ahora no».

import { useRef, useState, useId } from 'react'
import Icon from '../Icon'
import ConsentBody from './ConsentBody'
import { useFocusTrap } from './useFocusTrap'
import { t } from './consentText'

export default function ConsentModal({ onAccept, onCancel }) {
  const [checked, setChecked] = useState(false)
  const dialogRef = useRef(null)
  const titleId = useId()
  const checkboxId = useId()

  useFocusTrap(dialogRef, true, onCancel)

  return (
    <div className="onb-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        ref={dialogRef}
        className="glass onb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="onb-modal-header">
          <Icon name="alert-triangle" size={22} style={{ color: 'var(--yellow-warn)' }} />
          <h2 id={titleId}>{t('consent.modal.title')}</h2>
        </div>

        <div className="onb-modal-scroll">
          <ConsentBody checked={checked} onChange={setChecked} checkboxId={checkboxId} />
        </div>

        <div className="onb-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('consent.modal.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept} disabled={!checked}>
            <Icon name="check" size={14} /> {t('consent.modal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// src/components/onboarding/WelcomeScreen.jsx
// Asistente de bienvenida a pantalla completa (bajo la barra de título), mostrado una vez tras el splash
// (clave localStorage `onboarding_completed_v1`) o cuando Ajustes dispara el evento `onboarding:open`.
// Pasos: 1 Bienvenida · 2 Tu equipo · 3 Motor de IA local · 4 Cómo se usa · 5 Consentimiento.

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import Icon from '../Icon'
import logoImg from '../../assets/icon.jpg'
import RequirementsCheck from './RequirementsCheck'
import OllamaSetup from './OllamaSetup'
import WhisperDownload from './WhisperDownload'
import ConsentBody from './ConsentBody'
import { useFocusTrap } from './useFocusTrap'
import { getSetupRequirements } from '../../api'
import { markConsentAccepted, markOnboardingCompleted, isConsentAccepted } from './onboardingStorage'
import { t } from './consentText'

const STEPS = [
  { id: 'welcome', label: 'Bienvenida' },
  { id: 'system', label: 'Tu equipo' },
  { id: 'engine', label: 'Motor de IA' },
  { id: 'usage', label: 'Cómo se usa' },
  { id: 'consent', label: 'Consentimiento' },
]
const LAST_STEP = STEPS.length - 1

function WelcomeStep() {
  return (
    <>
      <div className="onb-hero">
        <img src={logoImg} alt="" className="onb-logo" />
        <div>
          <h1 className="onb-title" data-step-title tabIndex={-1}>Bienvenido a Local Meeting Analyzer</h1>
          <p className="onb-lead">
            Graba tus reuniones, transcríbelas y obtén resúmenes, decisiones y tareas con ayuda de IA.
          </p>
        </div>
      </div>

      <ul className="onb-features">
        <li>
          <Icon name="mic" size={18} />
          <span>Captura el audio de tu micrófono y del sistema (Teams, Zoom, Meet…).</span>
        </li>
        <li>
          <Icon name="file-text" size={18} />
          <span>Transcribe con Whisper y genera el acta, los acuerdos y las tareas.</span>
        </li>
        <li>
          <Icon name="chat" size={18} />
          <span>Consulta tu historial y conversa con la IA sobre cualquier reunión.</span>
        </li>
      </ul>

      <div className="onb-callout onb-callout-ok">
        <Icon name="lock" size={20} />
        <div className="onb-callout-text">
          <strong>Local por defecto</strong>
          <span>
            Con la IA local, la transcripción y el análisis se hacen en tu equipo y tus grabaciones no salen de él. Solo
            si eliges un servicio en la nube en Ajustes (OpenAI, Claude o Gemini), el audio o el texto de tus reuniones
            se enviará a ese servicio. Necesitarás
            internet únicamente para descargar modelos.
          </span>
        </div>
      </div>
    </>
  )
}

function UsageStep() {
  return (
    <>
      <h1 className="onb-title" data-step-title tabIndex={-1}>Cómo se usa</h1>
      <p className="onb-lead">Tres pasos para pasar de la reunión al acta.</p>

      <ol className="onb-usage">
        <li className="onb-usage-card">
          <span className="onb-usage-num" aria-hidden="true">1</span>
          <Icon name="mic" size={26} style={{ color: 'var(--red-record)' }} />
          <h3>Grabar</h3>
          <p>Pulsa el botón de grabar al empezar la reunión y finalízala cuando termine. También puedes subir un audio.</p>
        </li>
        <li className="onb-usage-card">
          <span className="onb-usage-num" aria-hidden="true">2</span>
          <Icon name="zap" size={26} style={{ color: 'var(--yellow-warn)' }} />
          <h3>Analizar</h3>
          <p>La app transcribe el audio y genera el resumen, las decisiones y las tareas acordadas.</p>
        </li>
        <li className="onb-usage-card">
          <span className="onb-usage-num" aria-hidden="true">3</span>
          <Icon name="chat" size={26} style={{ color: 'var(--accent-primary-hover)' }} />
          <h3>Historial y chat</h3>
          <p>Encuentra reuniones anteriores y pregunta a la IA por lo que se habló en ellas.</p>
        </li>
      </ol>

      <div className="onb-callout">
        <Icon name="info" size={20} style={{ color: 'var(--accent-primary-hover)' }} />
        <div className="onb-callout-text">
          <strong>
            Atajo global: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>
          </strong>
          <span>
            Inicia o detiene la grabación desde cualquier aplicación. Al cerrar la ventana, la app sigue en la bandeja
            del sistema para que el atajo siga funcionando. Mientras grabas, pulsa <kbd>M</kbd> para marcar un momento
            clave.
          </span>
        </div>
      </div>
    </>
  )
}

export default function WelcomeScreen({ onClose }) {
  const [step, setStep] = useState(0)
  const [requirements, setRequirements] = useState({ status: 'loading', data: null, error: '' })
  const [alreadyAccepted] = useState(() => isConsentAccepted())
  const [consentChecked, setConsentChecked] = useState(alreadyAccepted)

  const dialogRef = useRef(null)
  const bodyRef = useRef(null)
  const mountedRef = useRef(true)
  const labelId = useId()
  const checkboxId = useId()

  // Sin onEscape: el asistente no se cierra con Esc (se sale con «Saltar» o terminando el recorrido)
  useFocusTrap(dialogRef, true)

  const loadRequirements = useCallback(async () => {
    setRequirements({ status: 'loading', data: null, error: '' })
    try {
      const res = await getSetupRequirements()
      if (mountedRef.current) setRequirements({ status: 'ready', data: res.data, error: '' })
    } catch (err) {
      if (mountedRef.current) {
        setRequirements({
          status: 'error',
          data: null,
          error: err.response?.data?.detail || 'El motor local no respondió.',
        })
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadRequirements()
    return () => {
      mountedRef.current = false
    }
  }, [loadRequirements])

  // Al cambiar de paso: vuelve al inicio del contenido y mueve el foco al título del paso
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    bodyRef.current?.querySelector('[data-step-title]')?.focus()
  }, [step])

  const isConsentStep = step === LAST_STEP
  const recommendations = requirements.data?.recommendations || null

  const goNext = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const goBack = () => setStep((s) => Math.max(0, s - 1))

  // «Saltar»: no se guarda consentimiento (se pedirá antes de la primera grabación)
  const handleSkip = () => {
    markOnboardingCompleted()
    onClose()
  }

  const handleFinish = () => {
    if (!consentChecked) return
    markConsentAccepted()
    markOnboardingCompleted()
    onClose()
  }

  return (
    <div className="onb-overlay">
      <div
        ref={dialogRef}
        className="onb-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        <header className="onb-header">
          <div className="onb-brand">
            <img src={logoImg} alt="" className="onb-brand-logo" />
            <span id={labelId}>Configuración inicial</span>
          </div>

          <ol className="onb-stepper" aria-label="Progreso de la configuración">
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={`onb-stepper-item ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="onb-stepper-dot" aria-hidden="true">
                  {i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="onb-stepper-label">{s.label}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            className="onb-link onb-skip"
            onClick={handleSkip}
            disabled={isConsentStep}
            title={isConsentStep ? 'Acepta el aviso para terminar, o vuelve atrás para saltar la configuración' : 'Saltar la configuración inicial'}
          >
            Saltar
          </button>
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          Paso {step + 1} de {STEPS.length}: {STEPS[step].label}
        </p>

        <div className="onb-body" ref={bodyRef}>
          {step === 0 && <WelcomeStep />}

          {step === 1 && (
            <>
              <h1 className="onb-title" data-step-title tabIndex={-1}>Tu equipo</h1>
              <p className="onb-lead">
                Comprobamos que tu equipo pueda transcribir y analizar reuniones sin depender de la nube.
              </p>
              <RequirementsCheck state={requirements} onRetry={loadRequirements} />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="onb-title" data-step-title tabIndex={-1}>Motor de IA local</h1>
              <p className="onb-lead">
                El análisis con IA local lo ejecuta Ollama en tu equipo. Prepáralo ahora para que tu primera reunión se
                procese sin esperas.
              </p>
              <OllamaSetup recommendations={recommendations} onSkip={goNext} />
              <WhisperDownload recommendations={recommendations} />
            </>
          )}

          {step === 3 && <UsageStep />}

          {step === 4 && (
            <>
              <h1 className="onb-title" data-step-title tabIndex={-1}>{t('consent.modal.title')}</h1>
              {alreadyAccepted && (
                <p className="onb-inline-note">
                  <Icon name="check-circle" size={14} style={{ color: 'var(--green-ok)' }} /> Ya aceptaste este aviso
                  anteriormente. Puedes volver a leerlo.
                </p>
              )}
              <ConsentBody checked={consentChecked} onChange={setConsentChecked} checkboxId={checkboxId} />
            </>
          )}
        </div>

        <footer className="onb-footer">
          <button type="button" className="btn btn-secondary" onClick={goBack} disabled={step === 0}>
            <Icon name="arrow-left" size={14} /> Atrás
          </button>
          <span className="onb-footer-count">
            Paso {step + 1} de {STEPS.length}
          </span>
          {isConsentStep ? (
            <button type="button" className="btn btn-primary" onClick={handleFinish} disabled={!consentChecked}>
              <Icon name="check" size={14} /> Finalizar y empezar
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Siguiente <Icon name="arrow-left" size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

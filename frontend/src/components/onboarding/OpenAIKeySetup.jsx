// src/components/onboarding/OpenAIKeySetup.jsx
// Alternativa a Ollama en el paso «Motor de IA»: conectar una clave de OpenAI en tres pasos
// (abrir la página de claves, pegarla, probar y usar). La clave solo se guarda si la prueba funciona
// y el usuario lo pide expresamente, porque implica enviar el audio y el texto a OpenAI.

import { useEffect, useState } from 'react'
import Icon from '../Icon'
import { getConfig, testAiProvider, updateConfig } from '../../api'
import { useSystem } from '../../hooks/useSystem'
import { openExternal } from './openExternal'
import '../../styles/onboarding-openai.css'

const OPENAI_KEYS_URL = 'https://platform.openai.com/api-keys'
const OPENAI_BILLING_URL = 'https://platform.openai.com/settings/organization/billing/overview'
// Modelo económico por defecto para quien empieza; se puede cambiar en Configuración
const STARTER_MODEL = 'gpt-4o-mini'

// Traduce los errores del backend (/status/test-ai) a pasos concretos
function friendlyError(err) {
  const status = err?.response?.status
  const detail = err?.response?.data?.detail
  if (status === 401) {
    return { text: 'OpenAI no reconoce esta clave. Cópiala de nuevo completa (empieza por «sk-») o crea una nueva.' }
  }
  if (status === 429) {
    return {
      text: 'La clave funciona, pero tu cuenta de OpenAI no tiene saldo disponible. Añade crédito y vuelve a probar.',
      billing: true,
    }
  }
  if (!err?.response) {
    return { text: 'No hay conexión con OpenAI. Comprueba tu conexión a Internet y vuelve a probar.' }
  }
  return { text: typeof detail === 'string' ? detail : 'No se pudo conectar con OpenAI. Inténtalo de nuevo.' }
}

export default function OpenAIKeySetup({ defaultOpen = false }) {
  const { refreshStatus } = useSystem()
  const [open, setOpen] = useState(defaultOpen)
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

  // Si ya está configurado OpenAI con una clave, se muestra como conectado
  useEffect(() => {
    let alive = true
    getConfig()
      .then((res) => {
        if (alive && res.data?.ai_provider === 'openai' && res.data?.has_api_key) setConnected(true)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const trimmed = key.trim()
  const looksWrong = trimmed.length > 0 && !trimmed.startsWith('sk-')

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setKey(text.replace(/\s+/g, ''))
        setError(null)
      }
    } catch {
      setError({ text: 'No se pudo leer el portapapeles. Pega la clave con Ctrl+V en el campo.' })
    }
  }

  const handleConnect = async () => {
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await testAiProvider('openai', trimmed, STARTER_MODEL)
      await updateConfig({ ai_provider: 'openai', openai_api_key: trimmed, openai_model: STARTER_MODEL })
      setConnected(true)
      setKey('')
      refreshStatus?.()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (connected) {
    return (
      <div className="onb-callout onb-callout-ok" role="status">
        <Icon name="check-circle" size={20} />
        <div className="onb-callout-text">
          <strong>Conectado con OpenAI</strong>
          <span>
            Ya puedes grabar: la transcripción y el análisis se harán con OpenAI. Puedes cambiar el modelo o volver a la
            IA local cuando quieras en Configuración.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="onb-engine-card onb-openai">
      <div className="onb-engine-head">
        <Icon name="cloud" size={22} style={{ color: 'var(--accent-primary-hover)' }} />
        <div>
          <h3>¿Prefieres no instalar nada? Usa tu clave de OpenAI</h3>
          <p>
            Sin instalar Ollama ni descargar modelos: la app transcribe y analiza en la nube de OpenAI. Necesitas una
            cuenta de OpenAI con saldo (cobran según el uso).
          </p>
        </div>
      </div>

      {!open ? (
        <div className="onb-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
            <Icon name="lock" size={14} /> Usar mi clave de OpenAI
          </button>
        </div>
      ) : (
        <>
          <ol className="onb-openai-steps">
            <li>
              <span>Abre la página de claves de OpenAI e inicia sesión.</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openExternal(OPENAI_KEYS_URL)}>
                <Icon name="external-link" size={13} /> Abrir platform.openai.com
              </button>
            </li>
            <li>
              <span>Pulsa <strong>«Create new secret key»</strong>, cópiala y pégala aquí:</span>
              <div className="onb-openai-key-row">
                <div className="onb-openai-input">
                  <label htmlFor="onb-openai-key" className="sr-only">Clave de OpenAI</label>
                  <input
                    id="onb-openai-key"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="sk-..."
                    value={key}
                    onChange={(e) => { setKey(e.target.value.replace(/\s+/g, '')); setError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConnect() }}
                    disabled={busy}
                    aria-invalid={looksWrong || Boolean(error) || undefined}
                    aria-describedby="onb-openai-hint"
                  />
                  <button
                    type="button"
                    className="onb-openai-eye"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Ocultar la clave' : 'Mostrar la clave'}
                    title={showKey ? 'Ocultar' : 'Mostrar'}
                  >
                    <Icon name={showKey ? 'eye-off' : 'eye'} size={15} />
                  </button>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handlePaste} disabled={busy}>
                  <Icon name="copy" size={14} /> Pegar
                </button>
              </div>
              <span id="onb-openai-hint" className={`onb-muted ${looksWrong ? 'onb-openai-warn' : ''}`}>
                {looksWrong
                  ? 'Las claves de OpenAI empiezan por «sk-». Revisa que la hayas copiado completa.'
                  : 'La clave se guarda solo en este equipo y nunca se vuelve a mostrar completa.'}
              </span>
            </li>
            <li>
              <span>Comprueba que funciona y empieza a usarla:</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!trimmed || busy}
                aria-busy={busy || undefined}
              >
                {busy
                  ? <><span className="spinner-small on-accent" style={{ width: 14, height: 14 }} aria-hidden="true" /> Comprobando…</>
                  : <><Icon name="check" size={14} /> Probar y usar OpenAI</>}
              </button>
            </li>
          </ol>

          {error && (
            <div className="onb-callout onb-callout-fail" role="alert">
              <Icon name="alert-triangle" size={18} />
              <div className="onb-callout-text">
                <span>{error.text}</span>
              </div>
              {error.billing && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openExternal(OPENAI_BILLING_URL)}>
                  <Icon name="external-link" size={13} /> Añadir saldo
                </button>
              )}
            </div>
          )}

          <p className="onb-inline-note">
            <Icon name="info" size={14} /> Con OpenAI, el audio y el texto de tus reuniones se envían a OpenAI para
            procesarlos. Si prefieres que nada salga de tu equipo, usa Ollama (arriba).
          </p>
        </>
      )}
    </div>
  )
}

// src/components/onboarding/OllamaSetup.jsx
// Paso «Motor de IA local»: detecta Ollama, guía su instalación, lo inicia y descarga el modelo
// configurado mostrando el progreso del stream NDJSON. Estados:
//   not_installed -> stopped -> model_missing -> ready

import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from '../Icon'
import {
  getSetupOllama,
  startSetupOllama,
  pullOllamaModel,
  updateConfig,
} from '../../api'
import { openExternal } from './openExternal'

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/windows'
const POLL_INTERVAL_MS = 4000
const START_TIMEOUT_MS = 40000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

function statusLabel(status = '') {
  if (status.startsWith('pulling manifest')) return 'Preparando la descarga…'
  if (status.startsWith('pulling')) return 'Descargando el modelo…'
  if (status.startsWith('verifying')) return 'Verificando la descarga…'
  if (status.startsWith('writing') || status.startsWith('removing')) return 'Finalizando…'
  if (status === 'success') return 'Descarga completada'
  return 'Descargando…'
}

function deriveState(info) {
  if (!info) return 'loading'
  if (!info.installed) return 'not_installed'
  if (!info.running) return 'stopped'
  if (!info.configured_model_present) return 'model_missing'
  return 'ready'
}

export default function OllamaSetup({ recommendations, onSkip }) {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [pulling, setPulling] = useState(false)
  const [progress, setProgress] = useState(null)
  const [pullError, setPullError] = useState('')
  const [pullCancelled, setPullCancelled] = useState(false)
  const [switching, setSwitching] = useState(false)

  const mountedRef = useRef(true)
  const abortRef = useRef(null)
  const busyRef = useRef(false)

  const state = deriveState(info)

  const refresh = useCallback(async () => {
    try {
      const res = await getSetupOllama()
      if (!mountedRef.current) return null
      setInfo(res.data)
      setLoadError('')
      return res.data
    } catch {
      if (mountedRef.current) setLoadError('No pudimos consultar el estado de Ollama.')
      return null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [refresh])

  useEffect(() => {
    busyRef.current = starting || pulling || verifying || switching
  }, [starting, pulling, verifying, switching])

  // Detecta cambios hechos fuera de la app (el usuario instala o inicia Ollama por su cuenta)
  useEffect(() => {
    if (state === 'ready') return undefined
    const id = setInterval(() => {
      if (!busyRef.current) refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [state, refresh])

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyMessage('')
    const data = await refresh()
    if (mountedRef.current) {
      setVerifying(false)
      if (data && !data.installed) {
        setVerifyMessage('Todavía no detectamos Ollama. Si acabas de instalarlo, espera unos segundos e inténtalo de nuevo.')
      }
    }
  }

  const handleStart = async () => {
    setStarting(true)
    setStartError('')
    try {
      await startSetupOllama()
      const deadline = Date.now() + START_TIMEOUT_MS
      while (Date.now() < deadline && mountedRef.current) {
        await sleep(1000)
        const data = await refresh()
        if (data?.running) return
      }
      if (mountedRef.current) {
        setStartError('Ollama tardó demasiado en responder. Inténtalo de nuevo o ábrelo desde el menú Inicio de Windows.')
      }
    } catch (err) {
      if (mountedRef.current) {
        setStartError(err.response?.data?.detail || 'No se pudo iniciar Ollama.')
      }
    } finally {
      if (mountedRef.current) setStarting(false)
    }
  }

  const handlePull = async () => {
    const model = info?.configured_model
    if (!model) return
    const controller = new AbortController()
    abortRef.current = controller
    const layers = {}
    let best = 0

    setPulling(true)
    setPullError('')
    setPullCancelled(false)
    setProgress({ percent: 0, label: 'Preparando la descarga…', completed: 0, total: 0 })

    try {
      await pullOllamaModel(
        model,
        (event) => {
          if (!mountedRef.current) return
          if (event.digest && event.total) {
            layers[event.digest] = { total: event.total, completed: event.completed || 0 }
          }
          const values = Object.values(layers)
          const total = values.reduce((acc, l) => acc + l.total, 0)
          const completed = values.reduce((acc, l) => acc + l.completed, 0)
          const percent = total > 0 ? (completed * 100) / total : 0
          best = Math.max(best, percent) // evita retrocesos cuando aparecen capas nuevas
          setProgress({ percent: best, label: statusLabel(event.status), completed, total })
        },
        controller.signal
      )
      await refresh()
    } catch (err) {
      if (!mountedRef.current) return
      if (err.name === 'AbortError') setPullCancelled(true)
      else setPullError(err.message || 'No se pudo descargar el modelo.')
    } finally {
      abortRef.current = null
      if (mountedRef.current) {
        setPulling(false)
        setProgress(null)
      }
    }
  }

  const handleSwitchToRecommended = async () => {
    setSwitching(true)
    setPullError('')
    try {
      await updateConfig({ ollama_model: recommendations.llm_model })
      await refresh()
    } catch {
      if (mountedRef.current) setPullError('No se pudo cambiar el modelo. Puedes hacerlo más tarde en Ajustes.')
    } finally {
      if (mountedRef.current) setSwitching(false)
    }
  }

  const model = info?.configured_model || ''
  const modelSize = recommendations && recommendations.llm_model === model ? recommendations.llm_size : ''
  const suggestLighter =
    state === 'model_missing' &&
    recommendations?.low_ram &&
    recommendations.llm_model &&
    recommendations.llm_model !== model

  const percent = Math.round(progress?.percent || 0)

  return (
    <div className="onb-engine">
      <div className={`onb-engine-card onb-engine-${state}`}>
        {state === 'loading' && !loadError && (
          <div className="onb-loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Buscando Ollama…</span>
          </div>
        )}

        {state === 'loading' && loadError && (
          <div className="onb-callout onb-callout-warn" role="alert">
            <Icon name="alert-triangle" size={18} />
            <div className="onb-callout-text">
              <strong>{loadError}</strong>
              <span>Puedes continuar y configurarlo más tarde.</span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={refresh}>
              <Icon name="refresh" size={13} /> Reintentar
            </button>
          </div>
        )}

        {state === 'not_installed' && (
          <>
            <div className="onb-engine-head">
              <Icon name="download" size={22} style={{ color: 'var(--accent-primary-hover)' }} />
              <div>
                <h3>Ollama no está instalado</h3>
                <p>
                  Ollama es un programa gratuito que ejecuta la IA en tu equipo. Descárgalo, instálalo y, al
                  terminar, vuelve aquí y verifica.
                </p>
              </div>
            </div>
            <div className="onb-actions">
              <button type="button" className="btn btn-primary" onClick={() => openExternal(OLLAMA_DOWNLOAD_URL)}>
                <Icon name="external-link" size={14} /> Descargar Ollama
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleVerify} disabled={verifying}>
                {verifying ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" size={14} />}
                Ya lo instalé — verificar
              </button>
            </div>
            {verifyMessage && (
              <p className="onb-inline-note" role="status">
                <Icon name="info" size={14} /> {verifyMessage}
              </p>
            )}
          </>
        )}

        {state === 'stopped' && (
          <>
            <div className="onb-engine-head">
              <Icon name="zap" size={22} style={{ color: 'var(--yellow-warn)' }} />
              <div>
                <h3>Ollama está instalado, pero no está en ejecución</h3>
                <p>Inícialo para poder usar la IA local. Se ejecuta en segundo plano, sin ventana.</p>
              </div>
            </div>
            <div className="onb-actions">
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting}>
                {starting ? <span className="spinner" aria-hidden="true" /> : <Icon name="play" size={14} />}
                {starting ? 'Iniciando Ollama…' : 'Iniciar Ollama'}
              </button>
            </div>
            {startError && (
              <p className="onb-inline-note onb-inline-error" role="alert">
                <Icon name="alert-triangle" size={14} /> {startError}
              </p>
            )}
          </>
        )}

        {state === 'model_missing' && (
          <>
            <div className="onb-engine-head">
              <Icon name="download" size={22} style={{ color: 'var(--accent-primary-hover)' }} />
              <div>
                <h3>Falta descargar el modelo de IA</h3>
                <p>
                  Ollama está en marcha, pero aún no tiene <code>{model}</code>
                  {modelSize ? ` (${modelSize})` : ''}. Se descarga una sola vez y necesita conexión a internet.
                </p>
              </div>
            </div>

            {pulling ? (
              <div className="onb-progress-box">
                <div
                  className="onb-progress-track"
                  role="progressbar"
                  aria-label={`Descarga del modelo ${model}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div className="onb-progress-fill" style={{ width: `${percent}%` }} />
                </div>
                <div className="onb-progress-meta">
                  <span>{progress?.label}</span>
                  <span>
                    {percent}%
                    {progress?.total ? ` · ${formatBytes(progress.completed)} de ${formatBytes(progress.total)}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => abortRef.current?.abort()}
                >
                  <Icon name="x" size={13} /> Cancelar descarga
                </button>
              </div>
            ) : (
              <div className="onb-actions">
                <button type="button" className="btn btn-primary" onClick={handlePull} disabled={switching}>
                  <Icon name="download" size={14} /> Descargar modelo {model}
                </button>
              </div>
            )}

            {pullCancelled && !pulling && (
              <p className="onb-inline-note" role="status">
                <Icon name="info" size={14} /> Descarga cancelada. Puedes reanudarla cuando quieras: continuará donde se quedó.
              </p>
            )}

            {pullError && (
              <p className="onb-inline-note onb-inline-error" role="alert">
                <Icon name="alert-triangle" size={14} /> {pullError}
              </p>
            )}

            {suggestLighter && !pulling && (
              <p className="onb-inline-note">
                <Icon name="lightbulb" size={14} /> Tu equipo tiene poca memoria: te sugerimos el modelo más ligero{' '}
                <code>{recommendations.llm_model}</code>
                {recommendations.llm_size ? ` (${recommendations.llm_size})` : ''}.{' '}
                <button type="button" className="onb-link" onClick={handleSwitchToRecommended} disabled={switching}>
                  Usar {recommendations.llm_model}
                </button>
              </p>
            )}
          </>
        )}

        {state === 'ready' && (
          <div className="onb-engine-head">
            <Icon name="check-circle" size={24} style={{ color: 'var(--green-ok)' }} />
            <div>
              <h3>Ollama está listo</h3>
              <p>
                Ollama está en ejecución y el modelo <code>{model}</code> está instalado. El análisis con IA se hará en
                tu equipo.
              </p>
            </div>
          </div>
        )}

        {['openai', 'claude', 'gemini'].includes(info?.ai_provider) && state !== 'ready' && (
          <p className="onb-inline-note">
            <Icon name="cloud" size={14} /> Ahora mismo usas un proveedor de IA en la nube. Ollama solo se usará si
            eliges IA local en Ajustes.
          </p>
        )}
      </div>

      {state !== 'ready' && (
        <p className="onb-later">
          <button type="button" className="onb-link" onClick={onSkip}>
            Configurar después
          </button>
          <span>
            Puedes instalar Ollama más tarde, usar tu clave de OpenAI (aquí abajo) o elegir Claude o Gemini en Ajustes.
            Con un servicio en la nube, el audio o el texto de tus reuniones se envía a ese servicio.
          </span>
        </p>
      )}
    </div>
  )
}

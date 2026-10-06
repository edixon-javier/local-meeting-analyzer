// src/components/onboarding/WhisperDownload.jsx
// Pre-descarga opcional del modelo de voz (faster-whisper) para que la primera transcripción
// no tenga que esperar. Sin progreso en bytes: basta con un indicador de actividad.

import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from '../Icon'
import { getConfig, updateConfig, downloadWhisperModel, getWhisperModelStatus } from '../../api'

const POLL_INTERVAL_MS = 2000

export default function WhisperDownload({ recommendations }) {
  const [configured, setConfigured] = useState(null)
  const [configuredReady, setConfiguredReady] = useState(false)
  const [targetReady, setTargetReady] = useState(false)
  const [status, setStatus] = useState('loading') // loading | idle | downloading | done | error
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  const recommended = recommendations?.whisper_model || null
  const target = recommended || configured
  const size = recommended && recommended === target ? recommendations?.whisper_size : ''

  const check = useCallback(async (model) => {
    try {
      const res = await getWhisperModelStatus(model)
      return res.data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    ;(async () => {
      let current = null
      try {
        const res = await getConfig()
        current = res.data?.whisper_model || null
      } catch {
        // Sin configuración: se usa la sugerencia
      }
      if (cancelled) return
      setConfigured(current)
      const wanted = recommended || current
      if (!wanted) {
        setStatus('error')
        setError('No pudimos leer la configuración del modelo de voz.')
        return
      }
      const [cfgState, targetState] = await Promise.all([
        current ? check(current) : null,
        wanted === current ? null : check(wanted),
      ])
      if (cancelled) return
      const cfgReady = cfgState?.status === 'downloaded'
      setConfiguredReady(cfgReady)
      setTargetReady(wanted === current ? cfgReady : targetState?.status === 'downloaded')
      const downloading = (wanted === current ? cfgState : targetState)?.status === 'downloading'
      setStatus(downloading ? 'downloading' : 'idle')
    })()
    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [recommended, check])

  // Sondeo mientras se descarga
  useEffect(() => {
    if (status !== 'downloading' || !target) return undefined
    const id = setInterval(async () => {
      const data = await check(target)
      if (!mountedRef.current || !data) return
      if (data.status === 'downloaded') {
        try {
          if (configured !== target) {
            await updateConfig({ whisper_model: target })
            if (mountedRef.current) setConfigured(target)
          }
        } catch {
          // El modelo ya está descargado; el cambio de ajuste puede hacerse luego
        }
        if (mountedRef.current) {
          setTargetReady(true)
          setConfiguredReady(true)
          setStatus('done')
        }
      } else if (data.status === 'error') {
        setError(data.error || 'No se pudo descargar el modelo de voz.')
        setStatus('error')
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status, target, configured, check])

  const handleDownload = async () => {
    setError('')
    setStatus('downloading')
    try {
      await downloadWhisperModel(target)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo iniciar la descarga del modelo de voz.')
      setStatus('error')
    }
  }

  const handleUseTarget = async () => {
    setError('')
    try {
      await updateConfig({ whisper_model: target })
      setConfigured(target)
      setConfiguredReady(true)
    } catch {
      setError('No se pudo cambiar el modelo. Puedes hacerlo en Ajustes.')
      setStatus('error')
    }
  }

  const ready = configuredReady || status === 'done'
  const shownModel = ready ? configured || target : target

  return (
    <div className={`onb-engine-card onb-whisper ${ready ? 'onb-engine-ready' : ''}`}>
      <div className="onb-engine-head">
        <Icon
          name={ready ? 'check-circle' : 'mic'}
          size={22}
          style={{ color: ready ? 'var(--green-ok)' : 'var(--accent-primary-hover)' }}
        />
        <div>
          <h3>Modelo de voz (Whisper){shownModel ? `: ${shownModel}` : ''}</h3>
          <p>
            {ready
              ? 'El modelo de voz está descargado: tu primera transcripción empezará sin esperas.'
              : `Transcribe el audio en tu equipo. Puedes descargarlo ahora${size ? ` (${size})` : ''} o se descargará solo la primera vez que transcribas.`}{' '}
            La transcripción en vivo (opcional) usa el modelo <code>tiny</code> (~75 MB).
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <div className="onb-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Comprobando el modelo de voz…</span>
        </div>
      )}

      {status === 'downloading' && (
        <div className="onb-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Descargando el modelo {target}… puede tardar unos minutos.</span>
        </div>
      )}

      {(status === 'idle' || status === 'error') && !ready && target && (
        <div className="onb-actions">
          {targetReady && configured !== target ? (
            <button type="button" className="btn btn-secondary" onClick={handleUseTarget}>
              <Icon name="check" size={14} /> Usar el modelo {target}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={handleDownload}>
              <Icon name="download" size={14} />
              {configured && configured !== target ? `Descargar y usar ${target}` : `Descargar modelo ${target}`}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="onb-inline-note onb-inline-error" role="alert">
          <Icon name="alert-triangle" size={14} /> {error}
        </p>
      )}
    </div>
  )
}

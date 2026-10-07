// src/components/SettingsScreen.jsx
// Pantalla de Configuración: selección de hardware, modelos e IA local.

import { useState, useEffect, useCallback } from 'react'
import { getConfig, updateConfig, getAudioDevices, getOllamaModels, testAiProvider, startAudioTest, stopAudioTest, getAudioTestLevels, getAudioUrl } from '../api'
import { useSystem } from '../hooks/useSystem'
import { PRIVACY_URL, isPlaceholder } from '../appInfo'
import { canReportProblem, describeOs, loadAppInfo, openExternalUrl, reportProblem } from '../utils/support'
import Icon from './Icon'

// Modelo local por defecto (Apache-2.0, buen español, ~2.5 GB) y lista usada si Ollama no responde
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b'
const FALLBACK_OLLAMA_MODELS = ['qwen3:4b', 'qwen3:1.7b', 'phi3', 'mistral', 'llama3.2']

// Clave de localStorage que reinicia el asistente de bienvenida (ver components/onboarding)
const ONBOARDING_STORAGE_KEY = 'onboarding_completed_v1'

const SECTION_STYLE = {
  padding: 20,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}
const SECTION_TITLE_STYLE = { fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }
const LABEL_STYLE = { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 8, fontSize: 14 }
const TEXT_INPUT_STYLE = { width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

const LEGAL_DOCS = [
  { id: 'privacy', label: 'Política de privacidad' },
  { id: 'eula', label: 'Licencia y términos de uso' },
  { id: 'consent', label: 'Aviso de consentimiento de grabación' },
  { id: 'third_party', label: 'Avisos de software de terceros' },
  { id: 'changelog', label: 'Registro de cambios' },
]

export default function SettingsScreen() {
  const { showToast, isBackendOffline } = useSystem()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [devices, setDevices] = useState([])
  const [ollamaModels, setOllamaModels] = useState(FALLBACK_OLLAMA_MODELS)

  // Estados de configuración
  const [recordMode, setRecordMode] = useState('both')
  const [micDeviceId, setMicDeviceId] = useState('default')
  const [whisperModel, setWhisperModel] = useState('small')
  const [aiProvider, setAiProvider] = useState('local')
  // Clave de API: el backend nunca la devuelve en claro. `openaiApiKey` es solo lo que el usuario
  // escribe ahora (vacío = conservar la guardada); `maskedApiKey` es el enmascarado (••••1234).
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedApiKey, setMaskedApiKey] = useState('')
  const [deletingKey, setDeletingKey] = useState(false)
  const [allowCloudFallback, setAllowCloudFallback] = useState(false)
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL)
  const [analysisFocus, setAnalysisFocus] = useState('')
  const [diarize, setDiarize] = useState(false)

  // Estados de prueba de proveedor de IA (OpenAI / Ollama)
  const [testingAi, setTestingAi] = useState(false)
  const [aiTestResult, setAiTestResult] = useState(null)

  // Estados de prueba de audio
  const [testing, setTesting] = useState(false)
  const [sysLevel, setSysLevel] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [testAudioPath, setTestAudioPath] = useState(null)
  const [testAudioTimestamp, setTestAudioTimestamp] = useState(0)

  const loadSettingsAndHardware = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Cargar Configuración del backend y Dispositivos de Audio en paralelo (~35ms)
      const [configRes, devicesRes] = await Promise.all([
        getConfig(),
        getAudioDevices()
      ])
      const cfg = configRes.data
      setWhisperModel(cfg.whisper_model || 'small')
      setAiProvider(cfg.ai_provider || 'local')
      setOpenaiApiKey('')
      setHasApiKey(Boolean(cfg.has_api_key))
      setMaskedApiKey(cfg.openai_api_key || '')
      setAllowCloudFallback(Boolean(cfg.allow_cloud_fallback))
      setOpenaiModel(cfg.openai_model || 'gpt-4o-mini')
      setOllamaModel(cfg.ollama_model || DEFAULT_OLLAMA_MODEL)
      setAnalysisFocus(cfg.analysis_focus || '')
      setRecordMode(cfg.record_mode || 'both')
      setMicDeviceId(cfg.mic_device_id || 'default')
      setDiarize(cfg.diarize || false)

      setDevices(devicesRes.data.devices || [])
    } catch {
      showToast({ type: 'error', message: 'Error al cargar la configuración.' })
    } finally {
      // Liberar la pantalla de inmediato sin esperar el timeout de Ollama
      setLoading(false)
    }

    // 2. Cargar Modelos de Ollama de forma asíncrona en segundo plano
    try {
      const ollamaRes = await getOllamaModels()
      const models = ollamaRes.data?.models || []
      if (models.length > 0) {
        setOllamaModels(models)
      }
    } catch (err) {
      console.warn('No se pudieron listar los modelos de Ollama desde el backend, usando fallback:', err)
      setOllamaModels(FALLBACK_OLLAMA_MODELS)
    }
  }, [showToast])

  useEffect(() => {
    if (!isBackendOffline) {
      loadSettingsAndHardware()
    }
  }, [isBackendOffline, loadSettingsAndHardware])

  // Polling de niveles durante la prueba
  useEffect(() => {
    let intervalId
    let isFetching = false
    if (testing) {
      intervalId = setInterval(async () => {
        if (isFetching) return
        isFetching = true
        try {
          const res = await getAudioTestLevels()
          const scaleLevel = (val) => Math.min(100, Math.round(Math.sqrt(val) * 160))
          setMicLevel(scaleLevel(res.data.mic_level))
          setSysLevel(scaleLevel(res.data.sys_level))
        } catch (err) {
          console.error('Error al obtener niveles de prueba:', err)
        } finally {
          isFetching = false
        }
      }, 200)
    } else {
      setMicLevel(0)
      setSysLevel(0)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [testing])

  // Detener la prueba si se desmonta la pantalla
  useEffect(() => {
    return () => {
      if (testing) {
        stopAudioTest().catch(() => {})
      }
    }
  }, [testing])

  // Payload de configuración. La clave solo se envía si el usuario escribió una nueva:
  // un campo vacío (o el enmascarado) deja intacta la clave guardada.
  const buildConfigPayload = () => {
    const payload = {
      whisper_model: whisperModel,
      ai_provider: aiProvider,
      openai_model: openaiModel,
      ollama_model: ollamaModel,
      allow_cloud_fallback: allowCloudFallback,
      analysis_focus: analysisFocus,
      record_mode: recordMode,
      mic_device_id: micDeviceId,
      diarize: diarize
    }
    const typedKey = openaiApiKey.trim()
    if (typedKey) payload.openai_api_key = typedKey
    return payload
  }

  // Refleja en pantalla el estado de la clave que devolvió el backend (siempre enmascarada)
  const applySavedKeyState = (savedConfig) => {
    if (!savedConfig) return
    setOpenaiApiKey('')
    setHasApiKey(Boolean(savedConfig.has_api_key))
    setMaskedApiKey(savedConfig.openai_api_key || '')
  }

  const handleDeleteKey = async () => {
    if (isBackendOffline || deletingKey) return
    setDeletingKey(true)
    try {
      const res = await updateConfig({ openai_api_key: '' })
      applySavedKeyState(res.data?.config)
      setAiTestResult(null)
      showToast({ type: 'success', message: 'Clave de API borrada de este equipo.' })
    } catch {
      showToast({ type: 'error', message: 'No se pudo borrar la clave de API.' })
    } finally {
      setDeletingKey(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isBackendOffline) return
    setSaving(true)
    try {
      const res = await updateConfig(buildConfigPayload())
      applySavedKeyState(res.data?.config)
      showToast({ type: 'success', message: 'Configuración guardada correctamente' })
    } catch {
      showToast({ type: 'error', message: 'Error al guardar la configuración' })
    } finally {
      setSaving(false)
    }
  }

  const handleStartTest = async () => {
    if (isBackendOffline) return
    setTesting(true)
    setTestAudioPath(null)
    try {
      // Guardar selección actual en el backend antes de testear
      const res = await updateConfig(buildConfigPayload())
      applySavedKeyState(res.data?.config)
      await startAudioTest()
      showToast({ type: 'success', message: 'Prueba iniciada. Habla o reproduce algún sonido.' })
    } catch {
      showToast({ type: 'error', message: 'Error al iniciar la prueba de audio' })
      setTesting(false)
    }
  }

  const handleStopTest = async () => {
    try {
      const res = await stopAudioTest()
      setTesting(false)
      if (res.data.audio_path) {
        setTestAudioPath(res.data.audio_path)
        setTestAudioTimestamp(Date.now())
        showToast({ type: 'success', message: 'Prueba finalizada. Reproduce para escuchar.' })
      }
    } catch {
      showToast({ type: 'error', message: 'Error al detener la prueba de audio' })
      setTesting(false)
    }
  }

  const handleTestAiConnection = async () => {
    if (isBackendOffline || testingAi) return
    setTestingAi(true)
    setAiTestResult(null)
    try {
      const activeModel = aiProvider === 'openai' ? openaiModel : ollamaModel
      // Sin clave escrita, el backend usa la guardada
      const activeKey = aiProvider === 'openai' ? (openaiApiKey.trim() || null) : null
      const res = await testAiProvider(aiProvider, activeKey, activeModel)
      const data = res.data
      setAiTestResult({
        success: true,
        provider: aiProvider,
        message: data.message || 'Conexión verificada exitosamente.',
        latency_ms: data.latency_ms,
        model: data.model
      })
      showToast({ type: 'success', message: data.message || `Conexión exitosa (${data.latency_ms} ms)` })
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Error al conectar con el motor de IA.'
      setAiTestResult({
        success: false,
        provider: aiProvider,
        message: errorMsg
      })
      showToast({ type: 'error', message: errorMsg })
    } finally {
      setTestingAi(false)
    }
  }

  if (isBackendOffline) {
    return (
      <div className="settings-screen glass" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450, marginTop: 'auto' }}>
          <div className="empty-state-icon" style={{ marginBottom: 16 }}>
            <Icon name="alert-triangle" size={48} style={{ color: 'var(--red-record)' }} />
          </div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Servidor Desconectado</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            La configuración no está disponible porque el motor local de la aplicación no está respondiendo.
          </div>
        </div>
        <div style={{ width: '100%', maxWidth: 650, marginBottom: 'auto' }}>
          <HelpAndLegal />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" />
        <div className="processing-label">Cargando configuración...</div>
      </div>
    )
  }

  // Se muestra dentro del bloque de OpenAI o, si el proveedor es local, en la sección Privacidad
  const apiKeyField = (
    <div className="form-group">
      <label htmlFor="openai-key-input" style={LABEL_STYLE}>
        <Icon name="lock" size={16} /> OpenAI API Key
      </label>
      {hasApiKey && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check-circle" size={14} style={{ color: 'var(--green-ok)' }} />
            Clave guardada ({maskedApiKey})
          </span>
          <button
            type="button"
            onClick={handleDeleteKey}
            disabled={deletingKey || isBackendOffline}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: 12 }}
          >
            <Icon name="trash" size={13} /> {deletingKey ? 'Borrando...' : 'Borrar clave'}
          </button>
        </div>
      )}
      <input
        id="openai-key-input"
        type="password"
        autoComplete="off"
        value={openaiApiKey}
        onChange={(e) => {
          setOpenaiApiKey(e.target.value)
          setAiTestResult(null)
        }}
        placeholder={hasApiKey ? 'Escribe una nueva clave para reemplazar la guardada' : 'sk-...'}
        style={TEXT_INPUT_STYLE}
      />
      <span className="form-hint">
        La clave se guarda solo en este equipo y nunca se vuelve a mostrar completa. Si dejas el campo vacío se conserva la guardada.
      </span>
    </div>
  )

  return (
    <div className="settings-screen glass" style={{ flex: 1, padding: '24px 32px 0', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Configuración del Sistema</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ajusta los motores de IA y hardware para el procesamiento 100% local.</p>
      </div>

      <form id="settings-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 650 }}>

        {/* Modo de Grabación */}
        <div className="form-group">
          <label htmlFor="record-mode-select" style={LABEL_STYLE}>
            <Icon name="mic" size={16} /> Modo de Grabación de Audio
          </label>
          <select
            id="record-mode-select"
            value={recordMode}
            onChange={(e) => setRecordMode(e.target.value)}
            className="input-select"
            style={TEXT_INPUT_STYLE}
          >
            <option value="both">Sistema + Micrófono (Recomendado para reuniones)</option>
            <option value="system">Solo Audio del Sistema (Loopback)</option>
            <option value="mic">Solo Micrófono (Físico)</option>
          </select>
          <span className="form-hint">
            {recordMode === 'both' ? 'Graba lo que escuchas y lo que dices al mismo tiempo. Se mezclará automáticamente.' : ''}
            {recordMode === 'system' ? 'Graba solo el sonido de la PC. Ideal para videos, podcasts o si no vas a hablar.' : ''}
            {recordMode === 'mic' ? 'Graba solo tu micrófono. Ideal para notas de voz o dictado.' : ''}
          </span>
        </div>

        {/* Micrófono Físico (Solo visible si el modo usa micrófono) */}
        {(recordMode === 'both' || recordMode === 'mic') && (
          <div className="form-group">
            <label htmlFor="mic-device-select" style={LABEL_STYLE}>
              <Icon name="mic" size={16} /> Selección de Micrófono
            </label>
            <select
              id="mic-device-select"
            value={micDeviceId}
              onChange={(e) => setMicDeviceId(e.target.value)}
              className="input-select"
              style={TEXT_INPUT_STYLE}
            >
              <option value="default">Micrófono por Defecto de Windows</option>
              {devices.filter(d => d.id !== 'loopback').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Panel de Prueba de Audio */}
        <div className="form-group" style={{
          padding: '20px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          marginTop: 12
        }}>
          <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 8 }}>
            <Icon name="volume" size={17} /> Probar Micrófono y Sonido
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Valida los niveles de audio en tiempo real y asegúrate de que la grabación de voz y del sistema funcionen correctamente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {/* Medidor de Micrófono */}
            {(recordMode === 'both' || recordMode === 'mic') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  <span>Volumen del Micrófono Físico</span>
                  <span style={{ fontWeight: 600, color: micLevel > 70 ? 'var(--yellow-warn)' : (micLevel > 0 ? 'var(--accent-primary)' : 'var(--text-muted)') }}>
                    {micLevel}%
                  </span>
                </div>
                <div role="meter" aria-label="Volumen del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={micLevel} style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{
                    height: '100%',
                    width: `${micLevel}%`,
                    background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-violet) 100%)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 80ms ease'
                  }} />
                </div>
              </div>
            )}

            {/* Medidor de Sistema */}
            {(recordMode === 'both' || recordMode === 'system') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  <span>Volumen del Audio del Sistema (Loopback)</span>
                  <span style={{ fontWeight: 600, color: sysLevel > 70 ? 'var(--yellow-warn)' : (sysLevel > 0 ? 'var(--accent-primary)' : 'var(--text-muted)') }}>
                    {sysLevel}%
                  </span>
                </div>
                <div role="meter" aria-label="Volumen del audio del sistema" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sysLevel} style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{
                    height: '100%',
                    width: `${sysLevel}%`,
                    background: 'linear-gradient(90deg, #10B981 0%, var(--accent-primary) 100%)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 80ms ease'
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {!testing ? (
              <button
                type="button"
                onClick={handleStartTest}
                disabled={isBackendOffline}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Icon name="play" size={15} /> Iniciar Prueba
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTest}
                className="btn btn-primary pulse-animation"
                style={{
                  background: 'var(--red-record)',
                  border: '1px solid transparent',
                  boxShadow: '0 0 12px var(--red-glow)',
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Icon name="stop" size={15} /> Detener Prueba
              </button>
            )}

            {/* Reproductor si hay audio grabado */}
            {testAudioPath && !testing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '4px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                flex: 1,
                minWidth: 260
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-accent)', whiteSpace: 'nowrap', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="volume" size={14} /> Escuchar:
                </span>
                <audio
                  src={`${getAudioUrl(testAudioPath)}&t=${testAudioTimestamp}`}
                  controls
                  style={{
                    height: 28,
                    outline: 'none',
                    borderRadius: 'var(--radius-sm)',
                    flex: 1,
                    maxWidth: '100%'
                  }}
                />
              </div>
            )}
          </div>
          {testing && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 12 }}>
              Habla o haz algún ruido y luego detén para escuchar la mezcla.
            </span>
          )}
        </div>

        {/* Modelo Whisper */}
        <div className="form-group" style={{ opacity: aiProvider === 'openai' ? 0.5 : 1, pointerEvents: aiProvider === 'openai' ? 'none' : 'auto' }}>
          <label htmlFor="whisper-model-select" style={LABEL_STYLE}>
            <Icon name="file-text" size={16} /> Modelo de Transcripción (Local)
          </label>
          <select
            id="whisper-model-select"
            value={whisperModel}
            onChange={(e) => setWhisperModel(e.target.value)}
            className="input-select"
            style={TEXT_INPUT_STYLE}
          >
            <option value="tiny">Tiny (Muy rápido - ~75MB)</option>
            <option value="base">Base (Rápido - ~140MB)</option>
            <option value="small">Small (Recomendado, buen balance - ~460MB)</option>
            <option value="medium">Medium (Preciso, requiere GPU/RAM - ~1.5GB)</option>
            <option value="large">Large (Máxima precisión - ~3.0GB)</option>
          </select>
          <span className="form-hint">
            {aiProvider === 'openai'
              ? 'Se utilizará el modelo Whisper-1 en la nube (la selección local será ignorada).'
              : 'Nota: Al cambiar el modelo, la primera transcripción puede tardar más mientras se descarga.'}
          </span>
        </div>

        {/* Proveedor de IA */}
        <div className="form-group">
          <label htmlFor="ai-provider-select" style={LABEL_STYLE}>
            <Icon name="cloud" size={16} /> Proveedor de Inteligencia Artificial (Transcripción y Análisis)
          </label>
          <select
            id="ai-provider-select"
            value={aiProvider}
            onChange={(e) => {
              setAiProvider(e.target.value)
              setAiTestResult(null)
            }}
            className="input-select"
            style={TEXT_INPUT_STYLE}
          >
            <option value="local">Ollama & Whisper (100% Local y Privado)</option>
            <option value="openai">OpenAI (Procesamiento en la Nube ultra rápido)</option>
          </select>
          <span className="form-hint">
            Al usar OpenAI, <strong>tanto el audio como el texto</strong> se enviarán a la nube. La transcripción y el análisis serán casi instantáneos (sin sobrecargar tu PC).
          </span>
        </div>

        {/* Configuraciones Específicas del Proveedor */}
        {aiProvider === 'local' ? (
          <div className="form-group" style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="ollama-model-select" style={LABEL_STYLE}>
                <Icon name="lock" size={16} /> Modelo de Análisis (Ollama LLM)
              </label>
              <select
                id="ollama-model-select"
            value={ollamaModel}
                onChange={(e) => {
                  setOllamaModel(e.target.value)
                  setAiTestResult(null)
                }}
                className="input-select"
                style={TEXT_INPUT_STYLE}
              >
                {ollamaModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {!ollamaModels.includes(ollamaModel) && (
                  <option value={ollamaModel}>{ollamaModel} (Personalizado)</option>
                )}
              </select>
              <span className="form-hint">
                Detectados desde tu servidor local de Ollama. Asegúrate de haber ejecutado 'ollama run &lt;modelo&gt;' en tu terminal previamente.
              </span>
            </div>

            {/* Acciones de Prueba de Conexión Ollama */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={testingAi || isBackendOffline}
                  className="btn btn-secondary"
                  style={{ padding: '7px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                  <Icon
                    name={testingAi ? 'refresh' : 'zap'}
                    size={14}
                    style={testingAi ? { animation: 'spin 0.8s linear infinite', color: 'var(--text-accent)' } : { color: 'var(--yellow-warn)' }}
                  />
                  {testingAi ? 'Comprobando Ollama...' : 'Probar Conexión Ollama'}
                </button>

                {aiTestResult && aiTestResult.provider === 'local' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: aiTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: aiTestResult.success ? '#10B981' : '#EF4444',
                      border: `1px solid ${aiTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}
                  >
                    <Icon name={aiTestResult.success ? 'check-circle' : 'alert-triangle'} size={14} />
                    {aiTestResult.success ? `Respuesta en ${aiTestResult.latency_ms} ms` : 'Fallo de Conexión'}
                  </span>
                )}
              </div>

              {aiTestResult && aiTestResult.provider === 'local' && (
                <div
                  role="status"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    background: aiTestResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: aiTestResult.success ? 'var(--text-primary)' : '#FCA5A5',
                    borderLeft: `3px solid ${aiTestResult.success ? '#10B981' : '#EF4444'}`,
                    lineHeight: 1.4
                  }}
                >
                  {aiTestResult.message}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {apiKeyField}
            <div className="form-group">
              <label htmlFor="openai-model-select" style={LABEL_STYLE}>
                <Icon name="cloud" size={16} /> Modelo OpenAI
              </label>
              <select
                id="openai-model-select"
            value={openaiModel}
                onChange={(e) => {
                  setOpenaiModel(e.target.value)
                  setAiTestResult(null)
                }}
                className="input-select"
                style={TEXT_INPUT_STYLE}
              >
                <option value="gpt-4o-mini">GPT-4o-Mini (Rápido, Barato)</option>
                <option value="gpt-4o">GPT-4o (Máxima Precisión)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
              </select>
            </div>

            {/* Acciones de Prueba de Conexión OpenAI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={testingAi || isBackendOffline}
                  className="btn btn-secondary"
                  style={{ padding: '7px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                  <Icon
                    name={testingAi ? 'refresh' : 'zap'}
                    size={14}
                    style={testingAi ? { animation: 'spin 0.8s linear infinite' } : { color: 'var(--accent-primary)' }}
                  />
                  {testingAi ? 'Verificando OpenAI...' : 'Probar Conexión OpenAI'}
                </button>

                {aiTestResult && aiTestResult.provider === 'openai' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: aiTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: aiTestResult.success ? '#10B981' : '#EF4444',
                      border: `1px solid ${aiTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}
                  >
                    <Icon name={aiTestResult.success ? 'check-circle' : 'alert-triangle'} size={14} />
                    {aiTestResult.success ? `Latencia: ${aiTestResult.latency_ms} ms` : 'Fallo de Verificación'}
                  </span>
                )}
              </div>

              {aiTestResult && aiTestResult.provider === 'openai' && (
                <div
                  role="status"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    background: aiTestResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: aiTestResult.success ? 'var(--text-primary)' : '#FCA5A5',
                    borderLeft: `3px solid ${aiTestResult.success ? '#10B981' : '#EF4444'}`,
                    lineHeight: 1.4
                  }}
                >
                  {aiTestResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Diarización de Hablantes */}
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <input
            type="checkbox"
            id="diarize-chk"
            checked={diarize}
            onChange={(e) => setDiarize(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="diarize-chk" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="user" size={15} /> Habilitar Diarización de Hablantes (Speaker Separation)
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Separa automáticamente los diálogos en "Hablante A", "Hablante B", o por nombres si se mencionan en la reunión.
            </span>
          </div>
        </div>

        {/* Prompts Personalizados (Enfoque de Análisis) */}
        <div className="form-group">
          <label htmlFor="analysis-focus-input" style={LABEL_STYLE}>
            <Icon name="target" size={16} /> Enfoque de Análisis Personalizado (Prompt)
          </label>
          <textarea
            id="analysis-focus-input"
            value={analysisFocus}
            onChange={(e) => setAnalysisFocus(e.target.value)}
            placeholder="Ej: 'Concéntrate solo en los aspectos técnicos y fechas límite' o 'Extrae los puntos donde haya desacuerdos entre el equipo'..."
            rows={4}
            style={{ ...TEXT_INPUT_STYLE, padding: '12px', resize: 'vertical', fontSize: 13, lineHeight: 1.5, minHeight: 96 }}
          />
          <span className="form-hint">
            Instrucciones adicionales que se inyectarán en la IA para guiar cómo extrae los insights de tus reuniones.
          </span>
        </div>

        {/* Privacidad */}
        <section aria-labelledby="privacy-section-title" style={SECTION_STYLE}>
          <h2 id="privacy-section-title" style={SECTION_TITLE_STYLE}>
            <Icon name="lock" size={17} /> Privacidad
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Por defecto todo se procesa en tu equipo. Nada se envía a la nube sin que tú lo actives.
          </p>

          <div
            className="form-group"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12,
              borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              opacity: aiProvider === 'openai' ? 0.5 : 1,
            }}
          >
            <input
              type="checkbox"
              id="cloud-fallback-chk"
              checked={allowCloudFallback}
              disabled={aiProvider === 'openai'}
              onChange={(e) => setAllowCloudFallback(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="cloud-fallback-chk" style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Usar la nube (OpenAI) si el modelo local no está disponible
              </label>
              <span style={{ fontSize: 11, color: 'var(--yellow-warn)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Icon name="alert-triangle" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Si Ollama no responde, el texto de tus reuniones (transcripción y preguntas) se enviará a OpenAI para analizarlo,
                  y se aplicarán sus condiciones. Requiere una clave de API. Está desactivado por defecto.
                </span>
              </span>
              {aiProvider === 'openai' && (
                <span className="form-hint">No aplica: ya usas OpenAI como proveedor principal.</span>
              )}
              {aiProvider !== 'openai' && allowCloudFallback && !hasApiKey && !openaiApiKey.trim() && (
                <span className="form-hint">Añade una clave de API abajo para que el respaldo funcione.</span>
              )}
            </div>
          </div>

          {/* Con proveedor OpenAI la clave se gestiona en su propio bloque (arriba) */}
          {aiProvider !== 'openai' && apiKeyField}
        </section>
      </form>

      {/* Acciones: fijas al pie mientras se recorre el formulario (fuera del <form> para ocupar todo el ancho) */}
      <div className="settings-actions">
          <button
            type="submit"
            form="settings-form"
            disabled={saving}
            aria-busy={saving || undefined}
            className="btn btn-primary"
            style={{ padding: '10px 20px', minWidth: 160 }}
          >
            {saving
              ? <><span className="spinner-small on-accent" style={{ width: 14, height: 14 }} aria-hidden="true" /> Guardando…</>
              : <><Icon name="save" size={16} /> Guardar ajustes</>}
          </button>
          <span className="settings-actions-hint">Los cambios se aplican al guardar.</span>
      </div>

      <div style={{ maxWidth: 650, marginTop: 8, paddingBottom: 32 }}>
        <HelpAndLegal />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Ayuda y soporte + Acerca de / Legal
// Todo es local: el diagnóstico se copia al portapapeles y el usuario decide si lo comparte.
// ─────────────────────────────────────────
function HelpAndLegal() {
  const { showToast } = useSystem()
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState('')
  const electron = typeof window !== 'undefined' ? window.electronAPI : undefined
  const reportAvailable = canReportProblem()

  useEffect(() => {
    let alive = true
    loadAppInfo().then((loaded) => {
      if (alive) setInfo(loaded)
    })
    return () => {
      alive = false
    }
  }, [])

  const desktopOnly = () => showToast({ type: 'info', message: 'Esta función solo está disponible en la aplicación de escritorio.' })

  const handleReport = async () => {
    const channel = await reportProblem({ info: info || undefined })
    if (!channel) {
      showToast({ type: 'error', message: 'El canal de soporte aún no está configurado.' })
      return
    }
    showToast({
      type: 'info',
      message: channel === 'github'
        ? 'Se abrió GitHub con el reporte listo. Puedes pegar el diagnóstico copiado.'
        : 'Se abrió tu correo con el reporte listo. Puedes pegar el diagnóstico copiado.',
    })
  }

  const handleCopyDiagnostics = async () => {
    if (!electron?.copyDiagnostics) return desktopOnly()
    setBusy('diagnostics')
    try {
      const report = await electron.copyDiagnostics()
      if (report) {
        showToast({ type: 'success', message: 'Diagnóstico copiado. Revísalo antes de compartirlo: no incluye transcripciones ni claves.' })
      } else {
        showToast({ type: 'error', message: 'No se pudo generar el diagnóstico.' })
      }
    } catch {
      showToast({ type: 'error', message: 'No se pudo generar el diagnóstico.' })
    } finally {
      setBusy('')
    }
  }

  const handleOpenLogs = async () => {
    if (!electron?.openLogsFolder) return desktopOnly()
    try {
      const ok = await electron.openLogsFolder()
      if (!ok) showToast({ type: 'error', message: 'No se pudo abrir la carpeta de registros.' })
    } catch {
      showToast({ type: 'error', message: 'No se pudo abrir la carpeta de registros.' })
    }
  }

  const handleShowWelcome = () => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    } catch {
      // Sin almacenamiento disponible: el asistente se abre igualmente
    }
    window.dispatchEvent(new Event('onboarding:open'))
  }

  const handleOpenDoc = async (id) => {
    if (!electron?.openLegalDoc) return desktopOnly()
    try {
      const ok = await electron.openLegalDoc(id)
      if (!ok) showToast({ type: 'error', message: 'No se pudo abrir el documento.' })
    } catch {
      showToast({ type: 'error', message: 'No se pudo abrir el documento.' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Ayuda y soporte */}
      <section aria-labelledby="support-section-title" style={SECTION_STYLE}>
        <h2 id="support-section-title" style={SECTION_TITLE_STYLE}>
          <Icon name="info" size={17} /> Ayuda y soporte
        </h2>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Versión {info ? info.version : '…'}
          </div>
          {info && info.electron && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Electron {info.electron} · Chrome {info.chrome} · {describeOs(info)}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          Si algo falla, copia el diagnóstico y pégalo en tu reporte. Nada se envía automáticamente: la aplicación
          no recopila telemetría y los registros se guardan solo en este equipo.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReport}
            disabled={!reportAvailable}
            title={reportAvailable ? 'Abre un reporte con la versión y el sistema ya completados' : 'El canal de soporte aún no está configurado'}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <Icon name="flag" size={15} /> Reportar problema
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyDiagnostics}
            disabled={busy === 'diagnostics'}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <Icon name="copy" size={15} /> {busy === 'diagnostics' ? 'Generando...' : 'Copiar diagnóstico'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenLogs}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <Icon name="folder" size={15} /> Abrir carpeta de registros
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleShowWelcome}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <Icon name="lightbulb" size={15} /> Ver bienvenida de nuevo
          </button>
        </div>
      </section>

      {/* Acerca de / Legal */}
      <section aria-labelledby="legal-section-title" style={SECTION_STYLE}>
        <h2 id="legal-section-title" style={SECTION_TITLE_STYLE}>
          <Icon name="file-text" size={17} /> Acerca de / Legal
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {LEGAL_DOCS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="btn btn-secondary"
              onClick={() => handleOpenDoc(doc.id)}
              style={{ padding: '7px 12px', fontSize: 12 }}
            >
              <Icon name="file-text" size={14} /> {doc.label}
            </button>
          ))}
          {!isPlaceholder(PRIVACY_URL) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openExternalUrl(PRIVACY_URL)}
              style={{ padding: '7px 12px', fontSize: 12 }}
            >
              <Icon name="external-link" size={14} /> Política de privacidad en línea
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

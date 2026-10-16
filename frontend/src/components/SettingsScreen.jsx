// src/components/SettingsScreen.jsx
// Pantalla de Configuración: selección de hardware, modelos e IA local.

import { useState, useEffect, useCallback, useRef } from 'react'
import { getConfig, updateConfig, getAudioDevices, getOllamaModels, testAiProvider, startAudioTest, stopAudioTest, getAudioTestLevels, getAudioUrl } from '../api'
import { useSystem } from '../hooks/useSystem'
import { PRIVACY_URL, isPlaceholder } from '../appInfo'
import { canReportProblem, describeOs, loadAppInfo, openExternalUrl, reportProblem } from '../utils/support'
import Icon from './Icon'
import { openExternal } from './onboarding/openExternal'
import { getEngineStatus } from '../utils/engineStatus'
import '../styles/settings-chat.css'

// Modelo local por defecto (Apache-2.0, buen español, ~2.5 GB) y lista usada si Ollama no responde
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b'
const FALLBACK_OLLAMA_MODELS = ['qwen3:4b', 'qwen3:1.7b', 'phi3', 'mistral', 'llama3.2']

// Clave de localStorage que reinicia el asistente de bienvenida (ver components/onboarding)
const ONBOARDING_STORAGE_KEY = 'onboarding_completed_v1'

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

const RECORD_MODE_LABELS = {
  both: 'Sistema + micrófono',
  system: 'Solo audio del sistema',
  mic: 'Solo micrófono',
}

// Valores del formulario a partir de la configuración del backend (mismos valores por defecto en todos los usos)
function normalizeConfig(cfg = {}) {
  return {
    whisper_model: cfg.whisper_model || 'small',
    ai_provider: cfg.ai_provider || 'local',
    openai_model: cfg.openai_model || 'gpt-4o-mini',
    claude_model: cfg.claude_model || 'claude-3-5-haiku-20241022',
    gemini_model: cfg.gemini_model || 'gemini-2.0-flash',
    ollama_model: cfg.ollama_model || DEFAULT_OLLAMA_MODEL,
    allow_cloud_fallback: Boolean(cfg.allow_cloud_fallback),
    analysis_focus: cfg.analysis_focus || '',
    record_mode: cfg.record_mode || 'both',
    mic_device_id: cfg.mic_device_id || 'default',
    diarize: Boolean(cfg.diarize),
    groq_api_key: cfg.groq_api_key || '',
    dictation_mode: cfg.dictation_mode || 'smart_polish',
    dictation_provider: cfg.dictation_provider || 'local',
    dictation_shortcut: cfg.dictation_shortcut || 'CommandOrControl+Shift+D',
  }
}

const PRESET_SHORTCUTS = [
  { value: 'CommandOrControl+Shift+D', label: 'Ctrl + Shift + D (Recomendado - Sin conflictos con Claude)' },
  { value: 'Alt+Shift+D', label: 'Alt + Shift + D' },
  { value: 'CommandOrControl+Alt+D', label: 'Ctrl + Alt + D' },
  { value: 'CommandOrControl+Shift+Space', label: 'Ctrl + Shift + Espacio' },
  { value: 'F8', label: 'F8 (Tecla de función)' },
  { value: 'F9', label: 'F9 (Tecla de función)' },
  { value: 'CommandOrControl+Alt+Space', label: 'Ctrl + Alt + Espacio (⚠️ Ocupado por Claude Desktop)' },
  { value: 'custom', label: 'Personalizado...' },
]

function formatShortcutDisplay(sc) {
  if (!sc) return 'Ctrl + Shift + D'
  return sc
    .replace(/CommandOrControl/g, 'Ctrl')
    .replace(/Control/g, 'Ctrl')
    .replace(/Shift/g, 'Shift')
    .replace(/Alt/g, 'Alt')
    .replace(/Space/g, 'Espacio')
    .replace(/\+/g, ' + ')
}

const SETTINGS_SECTIONS = [
  { id: 'settings-audio', label: 'Audio', icon: 'mic' },
  { id: 'settings-ai', label: 'Motor de IA', icon: 'cpu' },
  { id: 'settings-dictation', label: 'Dictado en Cursor', icon: 'edit' },
  { id: 'settings-analysis', label: 'Análisis', icon: 'target' },
  { id: 'settings-privacy', label: 'Privacidad', icon: 'lock' },
  { id: 'settings-mcp', label: 'Asistentes de IA (MCP)', icon: 'chat' },
  { id: 'settings-support', label: 'Ayuda y soporte', icon: 'info' },
  { id: 'settings-legal', label: 'Acerca de / Legal', icon: 'file-text' },
]

export default function SettingsScreen() {
  const { showToast, isBackendOffline, systemStatus, refreshStatus } = useSystem()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [devices, setDevices] = useState([])
  const [ollamaModels, setOllamaModels] = useState(FALLBACK_OLLAMA_MODELS)

  // Estados de configuración
  const [recordMode, setRecordMode] = useState('both')
  const [micDeviceId, setMicDeviceId] = useState('default')
  const [whisperModel, setWhisperModel] = useState('small')
  const [aiProvider, setAiProvider] = useState('local')
  // Claves de API enmascaradas
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedApiKey, setMaskedApiKey] = useState('')

  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [hasClaudeKey, setHasClaudeKey] = useState(false)
  const [maskedClaudeKey, setMaskedClaudeKey] = useState('')

  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [hasGeminiKey, setHasGeminiKey] = useState(false)
  const [maskedGeminiKey, setMaskedGeminiKey] = useState('')

  const [groqApiKey, setGroqApiKey] = useState('')
  const [hasGroqKey, setHasGroqKey] = useState(false)
  const [maskedGroqKey, setMaskedGroqKey] = useState('')

  const [dictationMode, setDictationMode] = useState('smart_polish')
  const [dictationProvider, setDictationProvider] = useState('local')
  const [dictationShortcut, setDictationShortcut] = useState('CommandOrControl+Shift+D')
  const [isCustomShortcut, setIsCustomShortcut] = useState(false)

  // Estados de edición y visibilidad para claves API
  const [showOpenaiPassword, setShowOpenaiPassword] = useState(false)
  const [isEditingOpenai, setIsEditingOpenai] = useState(false)

  const [showClaudePassword, setShowClaudePassword] = useState(false)
  const [isEditingClaude, setIsEditingClaude] = useState(false)

  const [showGeminiPassword, setShowGeminiPassword] = useState(false)
  const [isEditingGemini, setIsEditingGemini] = useState(false)

  const [showGroqPassword, setShowGroqPassword] = useState(false)
  const [isEditingGroq, setIsEditingGroq] = useState(false)

  const [deletingKey, setDeletingKey] = useState(false)
  const [allowCloudFallback, setAllowCloudFallback] = useState(false)
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [claudeModel, setClaudeModel] = useState('claude-3-5-haiku-20241022')
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash')
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL)
  const [analysisFocus, setAnalysisFocus] = useState('')
  const [diarize, setDiarize] = useState(false)

  // Estados de prueba de proveedor de IA (OpenAI / Claude / Gemini / Ollama)
  const [testingAi, setTestingAi] = useState(false)
  const [aiTestResult, setAiTestResult] = useState(null)

  // Estados de prueba de audio
  const [testing, setTesting] = useState(false)
  const [sysLevel, setSysLevel] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [testAudioPath, setTestAudioPath] = useState(null)
  const [testAudioTimestamp, setTestAudioTimestamp] = useState(0)

  // Última configuración guardada: permite saber si hay cambios pendientes y descartarlos
  const savedConfigRef = useRef(null)
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  const applyConfig = useCallback((values) => {
    setWhisperModel(values.whisper_model)
    setAiProvider(values.ai_provider)
    setAllowCloudFallback(values.allow_cloud_fallback)
    setOpenaiModel(values.openai_model)
    setClaudeModel(values.claude_model)
    setGeminiModel(values.gemini_model)
    setOllamaModel(values.ollama_model)
    setAnalysisFocus(values.analysis_focus)
    setRecordMode(values.record_mode)
    setMicDeviceId(values.mic_device_id)
    setDiarize(values.diarize)
    setDictationMode(values.dictation_mode)
    setDictationProvider(values.dictation_provider)
    setDictationShortcut(values.dictation_shortcut)
    setIsCustomShortcut(!PRESET_SHORTCUTS.some(s => s.value === values.dictation_shortcut && s.value !== 'custom'))
  }, [])

  const markSaved = useCallback((values) => {
    savedConfigRef.current = values
    setSavedSnapshot(JSON.stringify(values))
  }, [])

  const loadSettingsAndHardware = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Cargar Configuración del backend y Dispositivos de Audio en paralelo (~35ms)
      const [configRes, devicesRes] = await Promise.all([
        getConfig(),
        getAudioDevices()
      ])
      const cfg = configRes.data
      const values = normalizeConfig(cfg)
      applyConfig(values)
      markSaved(values)
      setOpenaiApiKey('')
      setHasApiKey(Boolean(cfg.has_api_key || cfg.has_openai_key))
      setMaskedApiKey(cfg.openai_api_key || '')

      setAnthropicApiKey('')
      setHasClaudeKey(Boolean(cfg.has_claude_key))
      setMaskedClaudeKey(cfg.anthropic_api_key || '')

      setGeminiApiKey('')
      setHasGeminiKey(Boolean(cfg.has_gemini_key))
      setMaskedGeminiKey(cfg.gemini_api_key || '')

      setGroqApiKey('')
      setHasGroqKey(Boolean(cfg.has_groq_key))
      setMaskedGroqKey(cfg.groq_api_key || '')

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
  }, [showToast, applyConfig, markSaved])

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
      claude_model: claudeModel,
      gemini_model: geminiModel,
      ollama_model: ollamaModel,
      allow_cloud_fallback: allowCloudFallback,
      analysis_focus: analysisFocus,
      record_mode: recordMode,
      mic_device_id: micDeviceId,
      diarize: diarize,
      dictation_mode: dictationMode,
      dictation_provider: dictationProvider,
      dictation_shortcut: dictationShortcut,
    }
    const typedKey = openaiApiKey.trim()
    if (typedKey) payload.openai_api_key = typedKey

    const typedClaude = anthropicApiKey.trim()
    if (typedClaude) payload.anthropic_api_key = typedClaude

    const typedGemini = geminiApiKey.trim()
    if (typedGemini) payload.gemini_api_key = typedGemini

    const typedGroq = groqApiKey.trim()
    if (typedGroq) payload.groq_api_key = typedGroq

    return payload
  }

  // Refleja en pantalla el estado de la clave que devolvió el backend (siempre enmascarada)
  const applySavedKeyState = (savedConfig) => {
    if (!savedConfig) return
    setOpenaiApiKey('')
    setHasApiKey(Boolean(savedConfig.has_api_key || savedConfig.has_openai_key))
    setMaskedApiKey(savedConfig.openai_api_key || '')
    setIsEditingOpenai(false)

    setAnthropicApiKey('')
    setHasClaudeKey(Boolean(savedConfig.has_claude_key))
    setMaskedClaudeKey(savedConfig.anthropic_api_key || '')
    setIsEditingClaude(false)

    setGeminiApiKey('')
    setHasGeminiKey(Boolean(savedConfig.has_gemini_key))
    setMaskedGeminiKey(savedConfig.gemini_api_key || '')
    setIsEditingGemini(false)

    setGroqApiKey('')
    setHasGroqKey(Boolean(savedConfig.has_groq_key))
    setMaskedGroqKey(savedConfig.groq_api_key || '')
    setIsEditingGroq(false)
  }

  const handleDeleteKey = async (providerToDelete = 'openai') => {
    if (isBackendOffline || deletingKey) return
    setDeletingKey(true)
    try {
      const deletePayload = {}
      if (providerToDelete === 'claude') deletePayload.anthropic_api_key = ''
      else if (providerToDelete === 'gemini') deletePayload.gemini_api_key = ''
      else if (providerToDelete === 'groq') deletePayload.groq_api_key = ''
      else deletePayload.openai_api_key = ''

      const res = await updateConfig(deletePayload)
      applySavedKeyState(res.data?.config)
      setAiTestResult(null)
      refreshStatus?.()
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
      const payload = buildConfigPayload()
      const res = await updateConfig(payload)
      applySavedKeyState(res.data?.config)
      markSaved(normalizeConfig(payload))
      if (window.electronAPI?.dictationSetShortcut && payload.dictation_shortcut) {
        window.electronAPI.dictationSetShortcut(payload.dictation_shortcut).catch(() => {})
      }
      refreshStatus?.()
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
      const payload = buildConfigPayload()
      const res = await updateConfig(payload)
      applySavedKeyState(res.data?.config)
      markSaved(normalizeConfig(payload))
      refreshStatus?.()
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
      let activeModel = ollamaModel
      let activeKey = null

      if (aiProvider === 'openai') {
        activeModel = openaiModel
        activeKey = openaiApiKey.trim() || null
      } else if (aiProvider === 'claude') {
        activeModel = claudeModel
        activeKey = anthropicApiKey.trim() || null
      } else if (aiProvider === 'gemini') {
        activeModel = geminiModel
        activeKey = geminiApiKey.trim() || null
      }

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

  const currentValues = normalizeConfig({
    whisper_model: whisperModel,
    ai_provider: aiProvider,
    openai_model: openaiModel,
    claude_model: claudeModel,
    gemini_model: geminiModel,
    ollama_model: ollamaModel,
    allow_cloud_fallback: allowCloudFallback,
    analysis_focus: analysisFocus,
    record_mode: recordMode,
    mic_device_id: micDeviceId,
    diarize,
    dictation_mode: dictationMode,
    dictation_provider: dictationProvider,
    dictation_shortcut: dictationShortcut,
  })
  const isDirty = savedSnapshot !== null && (
    JSON.stringify(currentValues) !== savedSnapshot || 
    openaiApiKey.trim() !== '' || 
    anthropicApiKey.trim() !== '' || 
    geminiApiKey.trim() !== '' ||
    groqApiKey.trim() !== ''
  )

  const handleDiscard = () => {
    if (savedConfigRef.current) applyConfig(savedConfigRef.current)
    setOpenaiApiKey('')
    setIsEditingOpenai(false)
    setAnthropicApiKey('')
    setIsEditingClaude(false)
    setGeminiApiKey('')
    setIsEditingGemini(false)
    setGroqApiKey('')
    setIsEditingGroq(false)
    setAiTestResult(null)
  }

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const micName = micDeviceId === 'default'
    ? 'Predeterminado de Windows'
    : (devices.find((d) => d.id === micDeviceId)?.name || 'Dispositivo seleccionado')

  const handleShortcutSelectChange = (newVal) => {
    if (newVal === 'custom') {
      setIsCustomShortcut(true)
    } else {
      setIsCustomShortcut(false)
      setDictationShortcut(newVal)
      if (window.electronAPI?.dictationSetShortcut) {
        window.electronAPI.dictationSetShortcut(newVal).catch(() => {})
      }
      showToast({ type: 'success', message: `Atajo actualizado a ${formatShortcutDisplay(newVal)}` })
    }
  }

  const handleCustomShortcutChange = (e) => {
    const val = e.target.value
    setDictationShortcut(val)
    if (val.trim() && window.electronAPI?.dictationSetShortcut) {
      window.electronAPI.dictationSetShortcut(val.trim()).catch(() => {})
    }
  }

  const renderApiKeyControl = ({
    id,
    label,
    hasKey,
    maskedKey,
    typedKey,
    setTypedKey,
    isEditing,
    setIsEditing,
    showPassword,
    setShowPassword,
    onDelete,
    placeholder,
    helpText,
    getKeyUrl,
    keyPrefix,
  }) => {
    const isShowingSaved = hasKey && !isEditing
    // Aviso temprano si lo pegado no parece una clave de este proveedor (p. ej. se copió incompleta)
    const looksWrong = isEditing && typedKey.length > 0 && keyPrefix && !typedKey.startsWith(keyPrefix)
    return (
      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <label htmlFor={id} style={LABEL_STYLE}>
            <Icon name="lock" size={16} /> {label}
          </label>
          {hasKey ? (
            <span style={{ fontSize: 12, color: 'var(--green-ok)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <Icon name="check-circle" size={13} /> Activa
            </span>
          ) : getKeyUrl && (
            <button type="button" className="onb-link" onClick={() => openExternal(getKeyUrl)} style={{ fontSize: 12 }}>
              <Icon name="external-link" size={12} /> Conseguir una clave
            </button>
          )}
        </div>

        {hasKey && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 2
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check-circle" size={14} style={{ color: 'var(--green-ok)' }} />
              Clave guardada ({maskedKey})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true)
                    setTypedKey('')
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  <Icon name="edit" size={12} /> Cambiar clave
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setTypedKey('')
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={deletingKey || isBackendOffline}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                <Icon name="trash" size={12} /> {deletingKey ? 'Borrando...' : 'Borrar clave'}
              </button>
            </div>
          </div>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id={id}
            type={showPassword ? 'text' : 'password'}
            autoComplete="off"
            value={isEditing ? typedKey : (typedKey !== '' ? typedKey : (hasKey ? maskedKey : ''))}
            onChange={(e) => {
              setIsEditing(true)
              // Al pegar suelen colarse espacios o saltos de línea: una clave nunca los lleva
              setTypedKey(e.target.value.replace(/\s+/g, ''))
              setAiTestResult(null)
            }}
            spellCheck={false}
            placeholder={hasKey ? 'Escribe una nueva clave para reemplazar la guardada' : placeholder}
            style={{
              ...TEXT_INPUT_STYLE,
              flex: 1,
              paddingRight: 40,
              fontFamily: isShowingSaved && !showPassword ? 'monospace' : 'inherit',
              letterSpacing: isShowingSaved && !showPassword ? '1px' : 'normal',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Ocultar caracteres' : 'Mostrar caracteres'}
            aria-label={showPassword ? 'Ocultar la clave' : 'Mostrar la clave'}
            style={{
              position: 'absolute',
              right: 10,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={15} />
          </button>
        </div>

        {looksWrong ? (
          <span className="form-hint" style={{ color: 'var(--yellow-warn)' }} role="status">
            Las claves de este servicio empiezan por «{keyPrefix}». Revisa que la hayas copiado completa.
          </span>
        ) : hasKey && !isEditing ? (
          <span className="form-hint" style={{ color: 'var(--green-ok)' }}>
            ✓ Tu clave está guardada solo en este equipo (se muestra enmascarada).
          </span>
        ) : isEditing ? (
          <span className="form-hint" style={{ color: 'var(--yellow-warn)' }}>
            ⚠️ Escribiendo nueva clave. Recuerda hacer clic en "Guardar ajustes" al pie para confirmarla.
          </span>
        ) : (
          <span className="form-hint">
            {helpText}
          </span>
        )}
      </div>
    )
  }

  const apiKeyField = renderApiKeyControl({
    id: 'openai-key-input',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    label: 'OpenAI API Key',
    hasKey: hasApiKey,
    maskedKey: maskedApiKey,
    typedKey: openaiApiKey,
    setTypedKey: setOpenaiApiKey,
    isEditing: isEditingOpenai,
    setIsEditing: setIsEditingOpenai,
    showPassword: showOpenaiPassword,
    setShowPassword: setShowOpenaiPassword,
    onDelete: () => handleDeleteKey('openai'),
    placeholder: 'sk-...',
    helpText: 'La clave se guarda solo en este equipo y nunca se vuelve a mostrar completa.',
  })

  const claudeApiKeyField = renderApiKeyControl({
    id: 'claude-key-input',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    label: 'Anthropic (Claude) API Key',
    hasKey: hasClaudeKey,
    maskedKey: maskedClaudeKey,
    typedKey: anthropicApiKey,
    setTypedKey: setAnthropicApiKey,
    isEditing: isEditingClaude,
    setIsEditing: setIsEditingClaude,
    showPassword: showClaudePassword,
    setShowPassword: setShowClaudePassword,
    onDelete: () => handleDeleteKey('claude'),
    placeholder: 'sk-ant-...',
    helpText: 'La clave se guarda únicamente en este equipo local y nunca se muestra completa.',
  })

  const geminiApiKeyField = renderApiKeyControl({
    id: 'gemini-key-input',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
    label: 'Google Gemini API Key',
    hasKey: hasGeminiKey,
    maskedKey: maskedGeminiKey,
    typedKey: geminiApiKey,
    setTypedKey: setGeminiApiKey,
    isEditing: isEditingGemini,
    setIsEditing: setIsEditingGemini,
    showPassword: showGeminiPassword,
    setShowPassword: setShowGeminiPassword,
    onDelete: () => handleDeleteKey('gemini'),
    placeholder: 'AIzaSy...',
    helpText: 'La clave de Google Gemini se almacena de forma local y privada en tu equipo.',
  })

  const groqApiKeyField = renderApiKeyControl({
    id: 'groq-key-input',
    getKeyUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
    label: 'Clave API de Groq Cloud (Ultra-rápida)',
    hasKey: hasGroqKey,
    maskedKey: maskedGroqKey,
    typedKey: groqApiKey,
    setTypedKey: setGroqApiKey,
    isEditing: isEditingGroq,
    setIsEditing: setIsEditingGroq,
    showPassword: showGroqPassword,
    setShowPassword: setShowGroqPassword,
    onDelete: () => handleDeleteKey('groq'),
    placeholder: 'gsk_...',
    helpText: 'Obtén tu clave de alta velocidad sin costo en console.groq.com. Transcribe en ~240ms con Whisper Large v3 Turbo.',
  })

  return (
    <div className="settings-screen glass" style={{ flex: 1, padding: '24px 32px 0', overflowY: 'auto' }}>
      <div className="settings-header">
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Configuración</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Audio, motor de IA y privacidad. Los cambios se aplican al guardar.</p>
      </div>

      <div className="settings-layout">
      <div className="settings-main">
      <form id="settings-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <section id="settings-audio" className="settings-section" aria-labelledby="settings-audio-title">
          <header className="settings-section-head">
            <h2 id="settings-audio-title"><Icon name="mic" size={17} /> Audio</h2>
            <p>Fuentes de audio, micrófono y prueba de sonido.</p>
          </header>

        {/* Modo de Grabación */}
        <div className="form-group">
          <label htmlFor="record-mode-select" style={LABEL_STYLE}>
            <Icon name="mic" size={16} /> Qué se graba
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
              <Icon name="mic" size={16} /> Micrófono
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
        <div className="form-group settings-subcard">
          <h3 className="settings-subcard-title">
            <Icon name="volume" size={15} /> Probar micrófono y sonido
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Comprueba los niveles en tiempo real y escucha una grabación corta antes de una reunión.
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

        </section>

        <section id="settings-ai" className="settings-section" aria-labelledby="settings-ai-title">
          <header className="settings-section-head">
            <h2 id="settings-ai-title"><Icon name="cpu" size={17} /> Motor de IA</h2>
            <p>Quién transcribe y analiza tus reuniones.</p>
          </header>

        {/* Proveedor de IA */}
        <div className="form-group">
          <label htmlFor="ai-provider-select" style={LABEL_STYLE}>
            <Icon name="cloud" size={16} /> ¿Dónde se procesan tus reuniones?
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
            <option value="local">En este equipo (Whisper + Ollama) · privado</option>
            <option value="openai">En la nube (OpenAI) · más rápido, envía audio y texto</option>
            <option value="claude">En la nube (Anthropic Claude) · máxima calidad de análisis</option>
            <option value="gemini">En la nube (Google Gemini) · multimodal directo, económico</option>
          </select>
          <span className="form-hint">
            {aiProvider === 'openai' && (
              <>Se envían <strong>el audio y el texto</strong> a OpenAI: transcribe Whisper-1 y analiza el modelo elegido abajo. No sobrecarga tu equipo.</>
            )}
            {aiProvider === 'claude' && (
              <>Anthropic Claude analiza y diariza la conversación con gran fidelidad contextual; la transcripción inicial se procesa en tu equipo con Whisper.</>
            )}
            {aiProvider === 'gemini' && (
              <>Google Gemini procesa el audio de forma multimodal directa (hasta varias horas) a bajo costo y alta velocidad.</>
            )}
            {aiProvider === 'local' && (
              'Todo se procesa en tu equipo: Whisper transcribe y Ollama analiza. Nada sale de este equipo.'
            )}
          </span>
        </div>

        {/* Modelo Whisper */}
        {aiProvider === 'local' && (
        <div className="form-group">
          <label htmlFor="whisper-model-select" style={LABEL_STYLE}>
            <Icon name="file-text" size={16} /> Modelo de transcripción (Whisper)
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
            Los modelos más grandes son más precisos pero más lentos. Al cambiarlo, la primera transcripción tarda más mientras se descarga.
          </span>
        </div>
        )}

        {/* Configuraciones Específicas del Proveedor: LOCAL */}
        {aiProvider === 'local' && (
          <div className="form-group" style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="ollama-model-select" style={LABEL_STYLE}>
                <Icon name="lock" size={16} /> Modelo de análisis (Ollama)
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
        )}

        {/* Configuraciones Específicas del Proveedor: OPENAI */}
        {aiProvider === 'openai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {apiKeyField}
            <div className="form-group">
              <label htmlFor="openai-model-select" style={LABEL_STYLE}>
                <Icon name="cloud" size={16} /> Modelo de análisis (OpenAI)
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

        {/* Configuraciones Específicas del Proveedor: CLAUDE */}
        {aiProvider === 'claude' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {claudeApiKeyField}
            <div className="form-group">
              <label htmlFor="claude-model-select" style={LABEL_STYLE}>
                <Icon name="cloud" size={16} /> Modelo de análisis (Anthropic Claude)
              </label>
              <select
                id="claude-model-select"
                value={claudeModel}
                onChange={(e) => {
                  setClaudeModel(e.target.value)
                  setAiTestResult(null)
                }}
                className="input-select"
                style={TEXT_INPUT_STYLE}
              >
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Rápido, Económico, Diarización Precisa)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Máxima Calidad y Razonamiento)</option>
              </select>
            </div>

            {/* Acciones de Prueba de Conexión Claude */}
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
                  {testingAi ? 'Verificando Claude...' : 'Probar Conexión Claude'}
                </button>

                {aiTestResult && aiTestResult.provider === 'claude' && (
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

              {aiTestResult && aiTestResult.provider === 'claude' && (
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

        {/* Configuraciones Específicas del Proveedor: GEMINI */}
        {aiProvider === 'gemini' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {geminiApiKeyField}
            <div className="form-group">
              <label htmlFor="gemini-model-select" style={LABEL_STYLE}>
                <Icon name="cloud" size={16} /> Modelo de transcripción y análisis (Google Gemini)
              </label>
              <select
                id="gemini-model-select"
                value={geminiModel}
                onChange={(e) => {
                  setGeminiModel(e.target.value)
                  setAiTestResult(null)
                }}
                className="input-select"
                style={TEXT_INPUT_STYLE}
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Multimodal, Rápido, Muy Económico - Recomendado)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Gran Contexto, Estable)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Máximo Razonamiento y 2M Tokens)</option>
              </select>
            </div>

            {/* Acciones de Prueba de Conexión Gemini */}
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
                  {testingAi ? 'Verificando Gemini...' : 'Probar Conexión Gemini'}
                </button>

                {aiTestResult && aiTestResult.provider === 'gemini' && (
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

              {aiTestResult && aiTestResult.provider === 'gemini' && (
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

        </section>

        {/* Dictado en Cursor y Notas de Voz */}
        <section id="settings-dictation" className="settings-section" aria-labelledby="settings-dictation-title">
          <header className="settings-section-head">
            <h2 id="settings-dictation-title"><Icon name="edit" size={17} /> Dictado en Cursor y Notas de Voz</h2>
            <p>Escribe con tu voz directamente donde esté colocado el cursor en cualquier aplicación.</p>
          </header>

          {/* Atajo de teclado global interactivo */}
          <div className="form-group" style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label htmlFor="dictation-shortcut-select" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, display: 'block' }}>
                  Atajo Global de Activación
                </label>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Presiona esta combinación para iniciar o detener el dictado sin perder el foco del cursor.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="shortcut-chip" style={{ fontSize: 13, padding: '6px 14px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {formatShortcutDisplay(dictationShortcut)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                id="dictation-shortcut-select"
                value={isCustomShortcut ? 'custom' : dictationShortcut}
                onChange={(e) => handleShortcutSelectChange(e.target.value)}
                className="input-select"
                style={{ ...TEXT_INPUT_STYLE, flex: 1, minWidth: 260 }}
              >
                {PRESET_SHORTCUTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {isCustomShortcut && (
                <input
                  type="text"
                  value={dictationShortcut}
                  onChange={handleCustomShortcutChange}
                  placeholder="Ej: Control+Shift+X"
                  style={{ ...TEXT_INPUT_STYLE, width: 180 }}
                />
              )}
            </div>

            <span className="form-hint" style={{ color: 'var(--text-muted)' }}>
              💡 <strong>Nota:</strong> <code>Ctrl + Alt + Espacio</code> suele estar ocupado por Claude Desktop. El atajo recomendado por defecto es <code>Ctrl + Shift + D</code> (D de Dictado) para evitar conflictos.
            </span>
          </div>

          {/* Proveedor de Dictado */}
          <div className="form-group">
            <label htmlFor="dictation-provider-select" style={LABEL_STYLE}>
              <Icon name="zap" size={16} /> Motor de Transcripción (STT) para Dictado
            </label>
            <select
              id="dictation-provider-select"
              value={dictationProvider}
              onChange={(e) => setDictationProvider(e.target.value)}
              className="input-select"
              style={TEXT_INPUT_STYLE}
            >
              <option value="local">En este equipo (Faster-Whisper) · privado, sin Internet</option>
              <option value="groq">En la nube: Groq · el más rápido, envía el audio del dictado</option>
              <option value="openai">En la nube: OpenAI (Whisper-1) · envía el audio del dictado</option>
            </select>
            <span className="form-hint">
              {dictationProvider === 'local'
                ? 'El audio del dictado no sale de tu equipo. El modo "Ideas claras" usa un formateador local.'
                : 'El audio del dictado (y el texto, si usas "Ideas claras") se envía a este servicio. Si no hay clave o falla, se transcribe en tu equipo: nunca se usa otro servicio en la nube.'}
            </span>
          </div>

          {/* Clave de Groq si está seleccionado o para tenerla configurada */}
          {groqApiKeyField}

          {/* Modo de Dictado: Ideas Claras vs Literal */}
          <div className="form-group">
            <label htmlFor="dictation-mode-select" style={LABEL_STYLE}>
              <Icon name="lightbulb" size={16} /> Modo de Redacción y Procesamiento
            </label>
            <select
              id="dictation-mode-select"
              value={dictationMode}
              onChange={(e) => setDictationMode(e.target.value)}
              className="input-select"
              style={TEXT_INPUT_STYLE}
            >
              <option value="smart_polish">✨ Ideas Claras (Pulido con LLM - Elimina muletillas, autocorrige titubeos y formatea)</option>
              <option value="literal">📝 Literal (Inyecta el texto exacto tal cual fue pronunciado)</option>
            </select>
            <span className="form-hint">
              En modo <strong>Ideas Claras</strong>, el modelo de lenguaje elimina los "eh, o sea, bueno", convierte dudas ("vamos a enviar tres, no, cuatro") en la redacción final, y soporta comandos como "punto y aparte" o "nueva línea".
            </span>
          </div>
        </section>

        <section id="settings-analysis" className="settings-section" aria-labelledby="settings-analysis-title">
          <header className="settings-section-head">
            <h2 id="settings-analysis-title"><Icon name="target" size={17} /> Análisis</h2>
            <p>Cómo se interpreta la conversación.</p>
          </header>

        {/* Diarización de Hablantes */}
        <div className="form-group form-group-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <input
            type="checkbox"
            id="diarize-chk"
            checked={diarize}
            onChange={(e) => setDiarize(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="diarize-chk" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="user" size={15} /> Separar a los hablantes
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Separa automáticamente los diálogos en "Hablante A", "Hablante B", o por nombres si se mencionan en la reunión.
            </span>
          </div>
        </div>

        {/* Prompts Personalizados (Enfoque de Análisis) */}
        <div className="form-group">
          <label htmlFor="analysis-focus-input" style={LABEL_STYLE}>
            <Icon name="target" size={16} /> Instrucciones para el análisis (opcional)
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
            Se añaden a cada análisis: por ejemplo, qué temas priorizar o qué tipo de tareas buscar.
          </span>
        </div>

        </section>

        {/* Privacidad */}
        <section id="settings-privacy" className="settings-section" aria-labelledby="privacy-section-title">
          <header className="settings-section-head">
            <h2 id="privacy-section-title"><Icon name="lock" size={17} /> Privacidad</h2>
          </header>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Por defecto todo se procesa en tu equipo. Nada se envía a la nube sin que tú lo actives.
          </p>

          <div
            className="form-group form-group-row"
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
              disabled={aiProvider !== 'local'}
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
              {aiProvider !== 'local' && (
                <span className="form-hint">No aplica: ya usas un proveedor en la nube ({aiProvider === 'openai' ? 'OpenAI' : aiProvider === 'claude' ? 'Claude' : 'Gemini'}) como motor principal.</span>
              )}
              {aiProvider === 'local' && allowCloudFallback && !hasApiKey && !openaiApiKey.trim() && (
                <span className="form-hint">Añade una clave de API abajo para que el respaldo funcione.</span>
              )}
            </div>
          </div>

          {/* Con proveedores de nube la clave se gestiona en su propio bloque; en local se muestra aquí para respaldo */}
          {aiProvider === 'local' && apiKeyField}
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
          {isDirty ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleDiscard} disabled={saving}>
                Descartar
              </button>
              <span className="settings-actions-hint is-dirty" role="status">
                <span className="settings-dirty-dot" aria-hidden="true" /> Tienes cambios sin guardar
              </span>
            </>
          ) : (
            <span className="settings-actions-hint" role="status">
              <Icon name="check-circle" size={13} /> Todo guardado
            </span>
          )}
      </div>

      <div style={{ marginTop: 20, paddingBottom: 32 }}>
        <HelpAndLegal />
      </div>
      </div>

      <SettingsSummary
        values={currentValues}
        micName={micName}
        isDirty={isDirty}
        engine={getEngineStatus(systemStatus, isBackendOffline)}
        onJump={scrollToSection}
      />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Panel lateral: resumen de lo configurado (incluidos cambios sin guardar), estado del motor y
// accesos directos a cada sección. Aprovecha el ancho libre sin repetir controles.
// ─────────────────────────────────────────
function SettingsSummary({ values, micName, isDirty, engine, onJump }) {
  const tocRef = useRef(null)
  const jumpLockRef = useRef(null)
  const [activeId, setActiveId] = useState(SETTINGS_SECTIONS[0].id)

  // Scroll-spy: la sección activa es la última cuyo borde superior ya pasó la cabecera del
  // contenedor; al llegar al final del scroll se marca la última (las secciones cortas nunca
  // alcanzan el borde superior). El contenedor con scroll es .settings-screen, no la ventana.
  useEffect(() => {
    const container = tocRef.current?.closest('.settings-screen')
    if (!container) return undefined
    let frame = 0

    const update = () => {
      frame = 0
      // Sin layout (contenedor oculto o entorno de tests) no hay posiciones fiables que medir
      if (jumpLockRef.current || container.clientHeight === 0) return
      const top = container.getBoundingClientRect().top
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 4
      let current = SETTINGS_SECTIONS[0].id
      if (atBottom && container.scrollTop > 0) {
        current = SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id
      } else {
        for (const section of SETTINGS_SECTIONS) {
          const el = document.getElementById(section.id)
          if (el && el.getBoundingClientRect().top - top <= 96) current = section.id
        }
      }
      setActiveId(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      clearTimeout(jumpLockRef.current)
    }
  }, [])

  // Al hacer clic se marca de inmediato y se ignora el scroll-spy mientras dura el desplazamiento suave
  const handleJump = (id) => {
    setActiveId(id)
    clearTimeout(jumpLockRef.current)
    jumpLockRef.current = setTimeout(() => {
      jumpLockRef.current = null
      onScrollSettled()
    }, 700)
    onJump(id)
  }
  const onScrollSettled = () => {
    const container = tocRef.current?.closest('.settings-screen')
    container?.dispatchEvent(new Event('scroll'))
  }

  const usesMic = values.record_mode !== 'system'

  let privacy = { icon: 'lock', tone: 'ok', title: 'Se procesa en este equipo', text: 'El audio y el texto nunca salen de tu equipo.' }
  if (values.ai_provider === 'openai') {
    privacy = { icon: 'cloud', tone: 'warn', title: 'Se procesa en la nube (OpenAI)', text: 'El audio y el texto de tus reuniones se envían a OpenAI.' }
  } else if (values.ai_provider === 'claude') {
    privacy = { icon: 'cloud', tone: 'warn', title: 'Híbrido (Whisper + Claude)', text: 'El audio se transcribe en tu equipo; el texto se envía a Anthropic Claude.' }
  } else if (values.ai_provider === 'gemini') {
    privacy = { icon: 'cloud', tone: 'warn', title: 'Se procesa en la nube (Google Gemini)', text: 'El audio y el texto se envían a Google Gemini.' }
  } else if (values.allow_cloud_fallback) {
    privacy = { icon: 'lock', tone: 'ok', title: 'Se procesa en este equipo', text: 'Si Ollama no responde, el texto se enviará a la nube (respaldo activado).' }
  }

  let transcriptionLabel = `Whisper ${values.whisper_model}`
  if (values.ai_provider === 'openai') transcriptionLabel = 'Whisper-1 (OpenAI)'
  else if (values.ai_provider === 'claude') transcriptionLabel = `Whisper ${values.whisper_model} + Claude`
  else if (values.ai_provider === 'gemini') transcriptionLabel = `${values.gemini_model || 'Gemini 2.0 Flash'} (Google)`

  let analysisLabel = `${values.ollama_model} (Ollama)`
  if (values.ai_provider === 'openai') analysisLabel = `${values.openai_model} (OpenAI)`
  else if (values.ai_provider === 'claude') analysisLabel = `${values.claude_model} (Claude)`
  else if (values.ai_provider === 'gemini') analysisLabel = `${values.gemini_model} (Gemini)`

  const rows = [
    { label: 'Grabación', value: RECORD_MODE_LABELS[values.record_mode] || values.record_mode },
    usesMic ? { label: 'Micrófono', value: micName } : null,
    { label: 'Transcripción', value: transcriptionLabel },
    { label: 'Análisis', value: analysisLabel },
    { label: 'Hablantes', value: values.diarize ? 'Separados por contexto (IA)' : 'Sin separar' },
    { label: 'Enfoque', value: values.analysis_focus.trim() ? 'Personalizado' : 'Estándar' },
  ].filter(Boolean)

  return (
    <aside className="settings-aside" aria-label="Resumen de la configuración">
      <div className="settings-summary">
        <div className="settings-summary-head">
          <h2>Resumen</h2>
          {isDirty && <span className="settings-badge-dirty">Sin guardar</span>}
        </div>

        <div className={`settings-privacy-card tone-${privacy.tone}`}>
          <Icon name={privacy.icon} size={16} />
          <div>
            <strong>{privacy.title}</strong>
            <span>{privacy.text}</span>
          </div>
        </div>

        <dl className="settings-summary-list">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd title={row.value}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className={`settings-engine-state tone-${engine.tone}`}>
          <span className="status-dot-indicator" aria-hidden="true" />
          <span>Estado del motor: <strong>{engine.headline}</strong></span>
        </div>
        {engine.attention && (
          <p className="settings-engine-hint">{engine.attention.detail}</p>
        )}
      </div>

      <nav ref={tocRef} className="settings-toc" aria-label="Secciones de configuración">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeId === section.id ? 'is-active' : undefined}
            aria-current={activeId === section.id ? 'true' : undefined}
            onClick={() => handleJump(section.id)}
          >
            <Icon name={section.icon} size={13} /> {section.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ─────────────────────────────────────────
// Ayuda y soporte + Acerca de / Legal
// Todo es local: el diagnóstico se copia al portapapeles y el usuario decide si lo comparte.
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Conectar asistentes de IA (Claude Desktop, Cursor...) al servidor MCP local.
// Muestra el bloque JSON listo para pegar en la configuración del asistente, con la ruta real
// del ejecutable (app instalada) o del venv (desarrollo).
// ─────────────────────────────────────────
function McpConnectSection() {
  const { showToast } = useSystem()
  const [mcpConfig, setMcpConfig] = useState(null)
  const electron = typeof window !== 'undefined' ? window.electronAPI : undefined

  useEffect(() => {
    let alive = true
    electron?.getMcpConfig?.()
      .then((cfg) => { if (alive) setMcpConfig(cfg || null) })
      .catch(() => {})
    return () => { alive = false }
  }, [electron])

  const server = mcpConfig
    ? { command: mcpConfig.command, args: mcpConfig.args, ...(mcpConfig.env && Object.keys(mcpConfig.env).length ? { env: mcpConfig.env } : {}) }
    : { command: 'C:\\ruta\\a\\Local Meeting Analyzer\\resources\\backend\\meeting-backend.exe', args: ['--mcp'] }
  const snippet = JSON.stringify({ mcpServers: { 'local-meeting-analyzer': server } }, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      showToast({ type: 'success', message: 'Configuración MCP copiada. Pégala en el archivo de configuración de tu asistente.' })
    } catch {
      showToast({ type: 'error', message: 'No se pudo copiar al portapapeles.' })
    }
  }

  return (
    <section id="settings-mcp" className="settings-section" aria-labelledby="mcp-section-title">
      <h2 id="mcp-section-title" style={SECTION_TITLE_STYLE}>
        <Icon name="chat" size={17} /> Asistentes de IA (MCP)
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
        Permite que Claude Desktop, Cursor u otro asistente compatible con MCP consulte tus reuniones (resúmenes,
        transcripciones y tareas). El servidor corre en tu equipo; añade este bloque a la configuración del asistente
        (por ejemplo, <code>claude_desktop_config.json</code>) y reinícialo.
      </p>
      <pre className="mcp-snippet" aria-label="Configuración MCP para pegar en tu asistente">{snippet}</pre>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={handleCopy} style={{ padding: '8px 14px', fontSize: 13 }}>
          <Icon name="copy" size={15} /> Copiar configuración
        </button>
        {!mcpConfig && (
          <span className="form-hint" style={{ margin: 0 }}>Abre la aplicación de escritorio para ver la ruta exacta de tu instalación.</span>
        )}
      </div>
      <p className="form-hint" style={{ margin: 0, color: 'var(--yellow-warn)' }}>
        <Icon name="alert-triangle" size={12} /> El asistente que conectes puede enviar a su propio proveedor en la nube la
        información que consulte. Revisa su política de privacidad.
      </p>
    </section>
  )
}

function HelpAndLegal() {
  const { showToast, systemStatus } = useSystem()
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState('')
  const electron = typeof window !== 'undefined' ? window.electronAPI : undefined
  const reportAvailable = canReportProblem()
  // Versión del backend (GET /status): respaldo cuando Electron no la aporta (navegador/desarrollo)
  const backendVersion = systemStatus?.version

  useEffect(() => {
    let alive = true
    loadAppInfo({ fallbackVersion: backendVersion }).then((loaded) => {
      if (alive) setInfo(loaded)
    })
    return () => {
      alive = false
    }
  }, [backendVersion])

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
      <McpConnectSection />

      {/* Ayuda y soporte */}
      <section id="settings-support" className="settings-section" aria-labelledby="support-section-title">
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
      <section id="settings-legal" className="settings-section" aria-labelledby="legal-section-title">
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

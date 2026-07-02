// src/components/SettingsScreen.jsx
// Pantalla de Configuración: selección de hardware, modelos e IA local.

import { useState, useEffect } from 'react'
import { getConfig, updateConfig, getAudioDevices, getOllamaModels, startAudioTest, stopAudioTest, getAudioTestLevels, getAudioUrl } from '../api'
import { useSystem } from '../context/SystemContext'

export default function SettingsScreen() {
  const { showToast, isBackendOffline } = useSystem()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [devices, setDevices] = useState([])
  const [ollamaModels, setOllamaModels] = useState([])
  
  // Estados de configuración
  const [recordMode, setRecordMode] = useState('both')
  const [micDeviceId, setMicDeviceId] = useState('default')
  const [whisperModel, setWhisperModel] = useState('small')
  const [aiProvider, setAiProvider] = useState('local')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [ollamaModel, setOllamaModel] = useState('phi3')
  const [analysisFocus, setAnalysisFocus] = useState('')
  const [diarize, setDiarize] = useState(false)

  // Estados de prueba de audio
  const [testing, setTesting] = useState(false)
  const [sysLevel, setSysLevel] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [testAudioPath, setTestAudioPath] = useState(null)
  const [testAudioTimestamp, setTestAudioTimestamp] = useState(0)

  useEffect(() => {
    if (!isBackendOffline) {
      loadSettingsAndHardware()
    }
  }, [isBackendOffline])

  // Polling de niveles durante la prueba
  useEffect(() => {
    let intervalId
    if (testing) {
      intervalId = setInterval(async () => {
        try {
          const res = await getAudioTestLevels()
          const scaleLevel = (val) => Math.min(100, Math.round(Math.sqrt(val) * 160))
          setMicLevel(scaleLevel(res.data.mic_level))
          setSysLevel(scaleLevel(res.data.sys_level))
        } catch (err) {
          console.error('Error al obtener niveles de prueba:', err)
        }
      }, 100)
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

  const loadSettingsAndHardware = async () => {
    setLoading(true)
    try {
      // 1. Cargar Configuración del backend
      const configRes = await getConfig()
      const cfg = configRes.data
      setWhisperModel(cfg.whisper_model || 'small')
      setAiProvider(cfg.ai_provider || 'local')
      setOpenaiApiKey(cfg.openai_api_key || '')
      setOpenaiModel(cfg.openai_model || 'gpt-4o-mini')
      setOllamaModel(cfg.ollama_model || 'phi3')
      setAnalysisFocus(cfg.analysis_focus || '')
      setRecordMode(cfg.record_mode || 'both')
      setMicDeviceId(cfg.mic_device_id || 'default')
      setDiarize(cfg.diarize || false)

      // 2. Cargar Dispositivos de Audio
      const devicesRes = await getAudioDevices()
      setDevices(devicesRes.data.devices || [])

      // 3. Cargar Modelos de Ollama Localmente (vía backend)
      try {
        const ollamaRes = await getOllamaModels()
        const models = ollamaRes.data.models || []
        setOllamaModels(models)
      } catch (err) {
        console.warn('No se pudieron listar los modelos de Ollama desde el backend, usando fallback:', err)
        setOllamaModels(['phi3', 'llama3', 'gemma', 'mistral'])
      }

    } catch (err) {
      showToast({ type: 'error', message: 'Error al cargar la configuración.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isBackendOffline) return
    setSaving(true)
    try {
      await updateConfig({
        whisper_model: whisperModel,
        ai_provider: aiProvider,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        ollama_model: ollamaModel,
        analysis_focus: analysisFocus,
        record_mode: recordMode,
        mic_device_id: micDeviceId,
        diarize: diarize
      })
      showToast({ type: 'success', message: '⚙️ Configuración guardada correctamente' })
    } catch (err) {
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
      await updateConfig({
        whisper_model: whisperModel,
        ai_provider: aiProvider,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        ollama_model: ollamaModel,
        analysis_focus: analysisFocus,
        record_mode: recordMode,
        mic_device_id: micDeviceId,
        diarize: diarize
      })
      await startAudioTest()
      showToast({ type: 'success', message: '🎙️ Prueba iniciada. Habla o reproduce algún sonido.' })
    } catch (err) {
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
        showToast({ type: 'success', message: '✅ Prueba finalizada. Reproduce para escuchar.' })
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Error al detener la prueba de audio' })
      setTesting(false)
    }
  }

  if (isBackendOffline) {
    return (
      <div className="settings-screen glass" style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450 }}>
          <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Servidor Desconectado</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            La configuración no está disponible porque el motor local de la aplicación no está respondiendo.
          </div>
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

  return (
    <div className="settings-screen glass" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Configuración del Sistema</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ajusta los motores de IA y hardware para el procesamiento 100% local.</p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 650 }}>
        
        {/* Modo de Grabación */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            🎙️ Modo de Grabación de Audio
          </label>
          <select 
            value={recordMode} 
            onChange={(e) => setRecordMode(e.target.value)}
            className="input-select"
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="both">👥 Sistema + Micrófono (Recomendado para reuniones)</option>
            <option value="system">🖥️ Solo Audio del Sistema (Loopback)</option>
            <option value="mic">🎙️ Solo Micrófono (Físico)</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            {recordMode === 'both' ? 'Graba lo que escuchas y lo que dices al mismo tiempo. Se mezclará automáticamente.' : ''}
            {recordMode === 'system' ? 'Graba solo el sonido de la PC. Ideal para videos, podcasts o si no vas a hablar.' : ''}
            {recordMode === 'mic' ? 'Graba solo tu micrófono. Ideal para notas de voz o dictado.' : ''}
          </span>
        </div>

        {/* Micrófono Físico (Solo visible si el modo usa micrófono) */}
        {(recordMode === 'both' || recordMode === 'mic') && (
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              🎤 Selección de Micrófono
            </label>
            <select 
              value={micDeviceId} 
              onChange={(e) => setMicDeviceId(e.target.value)}
              className="input-select"
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
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
          background: 'rgba(30, 41, 59, 0.4)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-lg)',
          marginTop: 12
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🎙️ Probar Micrófono y Sonido
          </h3>
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
                <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                className="btn"
                style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border-subtle)', 
                  color: 'var(--text-primary)',
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>🎤</span> Iniciar Prueba
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
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ 
                  width: 8, 
                  height: 8, 
                  background: '#fff', 
                  borderRadius: '50%',
                  display: 'inline-block'
                }} /> Detener Prueba
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
                <span style={{ fontSize: 12, color: 'var(--text-accent)', whiteSpace: 'nowrap', fontWeight: 600 }}>🔊 Escuchar:</span>
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
              ⚠️ Habla o haz algún ruido y luego detén para escuchar la mezcla.
            </span>
          )}
        </div>

        {/* Modelo Whisper */}
        <div className="form-group" style={{ opacity: aiProvider === 'openai' ? 0.5 : 1, pointerEvents: aiProvider === 'openai' ? 'none' : 'auto' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            📝 Modelo de Transcripción (Local)
          </label>
          <select 
            value={whisperModel} 
            onChange={(e) => setWhisperModel(e.target.value)}
            className="input-select"
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="tiny">Tiny (Muy rápido - ~75MB)</option>
            <option value="base">Base (Rápido - ~140MB)</option>
            <option value="small">Small (Recomendado, buen balance - ~460MB)</option>
            <option value="medium">Medium (Preciso, requiere GPU/RAM - ~1.5GB)</option>
            <option value="large">Large (Máxima precisión - ~3.0GB)</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            {aiProvider === 'openai' 
              ? 'Se utilizará el modelo Whisper-1 en la nube (la selección local será ignorada).' 
              : 'Nota: Al cambiar el modelo, la primera transcripción puede tardar más mientras se descarga.'}
          </span>
        </div>

        {/* Proveedor de IA */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            🌐 Proveedor de Inteligencia Artificial (Transcripción y Análisis)
          </label>
          <select 
            value={aiProvider} 
            onChange={(e) => setAiProvider(e.target.value)}
            className="input-select"
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="local">Ollama & Whisper (100% Local y Privado)</option>
            <option value="openai">OpenAI (Procesamiento en la Nube ultra rápido)</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            Al usar OpenAI, <strong>tanto el audio como el texto</strong> se enviarán a la nube. La transcripción y el análisis serán casi instantáneos (sin sobrecargar tu PC).
          </span>
        </div>

        {/* Configuraciones Específicas del Proveedor */}
        {aiProvider === 'local' ? (
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              🧠 Modelo de Análisis (Ollama LLM)
            </label>
            <select 
              value={ollamaModel} 
              onChange={(e) => setOllamaModel(e.target.value)}
              className="input-select"
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {ollamaModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
              {!ollamaModels.includes(ollamaModel) && (
                <option value={ollamaModel}>{ollamaModel} (Personalizado)</option>
              )}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
              Detectados desde tu servidor local de Ollama. Asegúrate de haber ejecutado 'ollama run &lt;modelo&gt;' en tu terminal previamente.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                🔑 OpenAI API Key
              </label>
              <input 
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                🧠 Modelo OpenAI
              </label>
              <select 
                value={openaiModel} 
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="input-select"
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <option value="gpt-4o-mini">GPT-4o-Mini (Rápido, Barato)</option>
                <option value="gpt-4o">GPT-4o (Máxima Precisión)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
              </select>
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
            <label htmlFor="diarize-chk" style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              👥 Habilitar Diarización de Hablantes (Speaker Separation)
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Separa automáticamente los diálogos en "Hablante A", "Hablante B", o por nombres si se mencionan en la reunión.
            </span>
          </div>
        </div>

        {/* Prompts Personalizados (Enfoque de Análisis) */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            🎯 Enfoque de Análisis Personalizado (Prompt)
          </label>
          <textarea
            value={analysisFocus}
            onChange={(e) => setAnalysisFocus(e.target.value)}
            placeholder="Ej: 'Concéntrate solo en los aspectos técnicos y fechas límite' o 'Extrae los puntos donde haya desacuerdos entre el equipo'..."
            rows={4}
            style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            Instrucciones adicionales que se inyectarán en la IA para guiar cómo extrae los insights de tus reuniones.
          </span>
        </div>

        {/* Acciones */}
        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
          <button 
            type="submit" 
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '10px 20px', minWidth: 150 }}
          >
            {saving ? 'Guardando...' : 'Guardar Ajustes'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { getEngineStatus, getPrivacyNotice } from './engineStatus'

const base = { whisper_model: 'small', llm_model: 'qwen3:4b', ai_provider: 'local', allow_cloud_fallback: false, ollama_running: true }

describe('getEngineStatus', () => {
  it('local y listo: datos en el equipo, sin avisos', () => {
    const s = getEngineStatus(base, false)
    expect(s.tone).toBe('ok')
    expect(s.attention).toBeNull()
    expect(s.transcription).toBe('Whisper small (local)')
    expect(s.analysis).toBe('qwen3:4b (Ollama)')
    expect(s.privacy.text).toMatch(/no salen de este equipo/)
  })

  it('local sin Ollama: pide atención', () => {
    const s = getEngineStatus({ ...base, ollama_running: false }, false)
    expect(s.tone).toBe('warn')
    expect(s.headline).toBe('Ollama no responde')
    expect(s.attention).not.toBeNull()
  })

  it('nube: transcribe Whisper-1 aunque el backend informe el modelo local', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'openai', llm_model: 'gpt-4o' }, false)
    expect(s.transcription).toBe('Whisper-1 (OpenAI)')
    expect(s.analysis).toBe('gpt-4o (OpenAI)')
    expect(s.privacy.tone).toBe('warn')
  })

  it('nube sin clave: avisa de la clave', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'openai', llm_model: 'gpt-4o', ollama_running: false }, false)
    expect(s.headline).toBe('Falta la clave de OpenAI')
  })

  it('local con respaldo en uso: lo indica y avisa', () => {
    const s = getEngineStatus({ ...base, allow_cloud_fallback: true, llm_model: 'gpt-4o-mini' }, false)
    expect(s.analysis).toBe('gpt-4o-mini (OpenAI, respaldo)')
    expect(s.tone).toBe('warn')
  })

  it('claude: transcribe Whisper local + Claude, análisis Claude', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'claude', llm_model: 'claude-3-5-haiku-20241022' }, false)
    expect(s.transcription).toBe('Whisper small + Claude')
    expect(s.analysis).toBe('claude-3-5-haiku-20241022 (Claude)')
    expect(s.privacy.tone).toBe('warn')
    expect(s.privacy.text).toMatch(/Anthropic/)
  })

  it('claude sin clave: avisa de la clave', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'claude', ollama_running: false }, false)
    expect(s.headline).toBe('Falta la clave de Claude')
  })

  it('gemini: transcribe con Gemini, análisis Gemini', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'gemini', gemini_model: 'gemini-2.0-flash', llm_model: 'gemini-2.0-flash' }, false)
    expect(s.transcription).toBe('gemini-2.0-flash (Google)')
    expect(s.analysis).toBe('gemini-2.0-flash (Gemini)')
    expect(s.privacy.tone).toBe('warn')
    expect(s.privacy.text).toMatch(/Google/)
  })

  it('gemini sin clave: avisa de la clave', () => {
    const s = getEngineStatus({ ...base, ai_provider: 'gemini', ollama_running: false }, false)
    expect(s.headline).toBe('Falta la clave de Gemini')
  })

  it('sin conexión con el backend', () => {
    const s = getEngineStatus(base, true)
    expect(s.tone).toBe('error')
    expect(s.headline).toBe('Sin conexión')
  })
})

describe('getPrivacyNotice', () => {
  it('local sin respaldo: 100% local', () => {
    const n = getPrivacyNotice('local', false)
    expect(n.icon).toBe('lock')
    expect(n.text).toMatch(/100% local/)
    expect(n.shortText).toBe('100% Local')
  })

  it('local con respaldo: advierte sobre el respaldo', () => {
    const n = getPrivacyNotice('local', true)
    expect(n.icon).toBe('cloud')
    expect(n.text).toMatch(/respaldo en la nube/)
    expect(n.shortText).toBe('Local (respaldo)')
  })

  it('openai: advierte sobre envío a OpenAI', () => {
    const n = getPrivacyNotice('openai', false)
    expect(n.icon).toBe('cloud')
    expect(n.text).toMatch(/OpenAI/)
    expect(n.shortText).toBe('Nube · OpenAI')
  })

  it('claude: advierte sobre envío a Claude (Anthropic)', () => {
    const n = getPrivacyNotice('claude', false)
    expect(n.icon).toBe('cloud')
    expect(n.text).toMatch(/Anthropic \(Claude\)/)
    expect(n.shortText).toBe('Híbrido · Claude')
  })

  it('gemini: advierte sobre envío a Google (Gemini)', () => {
    const n = getPrivacyNotice('gemini', false)
    expect(n.icon).toBe('cloud')
    expect(n.text).toMatch(/Google \(Gemini\)/)
    expect(n.shortText).toBe('Nube · Gemini')
  })
})

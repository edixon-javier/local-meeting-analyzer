import { describe, it, expect } from 'vitest'
import { getEngineStatus } from './engineStatus'

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

  it('sin conexión con el backend', () => {
    const s = getEngineStatus(base, true)
    expect(s.tone).toBe('error')
    expect(s.headline).toBe('Sin conexión')
  })
})

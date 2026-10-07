// src/utils/engineStatus.js
// Interpreta GET /status en algo que el usuario entienda. Única fuente para los indicadores de
// estado (barra inferior y aviso del sidebar), para no repetir ni contradecir la información.
//
// Cómo se calculan los campos del backend (api/routers/system.py):
//  - ollama_running = analyzer.is_running(). Con proveedor "openai" significa "hay clave de OpenAI";
//    con "local" significa "Ollama responde" o "el respaldo en la nube está permitido".
//  - whisper_model  = modelo local de faster-whisper. Con "openai" NO se usa: transcribe Whisper-1.
//  - llm_model      = modelo del proveedor activo (con respaldo puede ser un modelo de OpenAI).

const isCloudModel = (model) => /^(gpt-|o\d)/i.test(model || '')

/**
 * @returns {{
 *   tone: 'ok' | 'warn' | 'error',
 *   provider: 'local' | 'openai',
 *   providerLabel: string,
 *   headline: string,          // estado corto: "Listo", "Ollama no responde"...
 *   attention: null | { title: string, detail: string },
 *   transcription: string,
 *   analysis: string,
 *   privacy: { icon: string, text: string, tone: 'ok' | 'warn' },
 * }}
 */
export function getEngineStatus(systemStatus, isBackendOffline) {
  const provider = systemStatus?.ai_provider === 'openai' ? 'openai' : 'local'
  const fallbackAllowed = Boolean(systemStatus?.allow_cloud_fallback)
  const engineReady = Boolean(systemStatus?.ollama_running)
  const llm = systemStatus?.llm_model || (provider === 'openai' ? 'gpt-4o-mini' : 'qwen3:4b')

  const transcription = provider === 'openai'
    ? 'Whisper-1 (OpenAI)'
    : `Whisper ${systemStatus?.whisper_model || 'small'} (local)`

  // En local con respaldo, el backend informa el modelo de OpenAI cuando Ollama no responde
  const usingFallback = provider === 'local' && fallbackAllowed && isCloudModel(llm)
  const analysis = provider === 'openai'
    ? `${llm} (OpenAI)`
    : usingFallback ? `${llm} (OpenAI, respaldo)` : `${llm} (Ollama)`

  const privacy = provider === 'openai'
    ? { icon: 'cloud', tone: 'warn', text: 'El audio y el texto se envían a OpenAI' }
    : usingFallback
      ? { icon: 'cloud', tone: 'warn', text: 'Respaldo activo: el texto se envía a OpenAI' }
      : fallbackAllowed
        ? { icon: 'lock', tone: 'ok', text: 'Local (respaldo en la nube permitido)' }
        : { icon: 'lock', tone: 'ok', text: 'Tus datos no salen de este equipo' }

  const base = {
    provider,
    providerLabel: provider === 'openai' ? 'IA en la nube' : 'IA local',
    transcription,
    analysis,
    privacy,
  }

  if (isBackendOffline) {
    return {
      ...base,
      tone: 'error',
      headline: 'Sin conexión',
      attention: {
        title: 'Sin conexión con el motor',
        detail: 'El servicio local de la aplicación no responde.',
      },
    }
  }

  if (!engineReady) {
    return provider === 'openai'
      ? {
          ...base,
          tone: 'warn',
          headline: 'Falta la clave de OpenAI',
          attention: {
            title: 'Falta la clave de OpenAI',
            detail: 'Añádela en Configuración o vuelve a la IA local.',
          },
        }
      : {
          ...base,
          tone: 'warn',
          headline: 'Ollama no responde',
          attention: {
            title: 'Ollama no responde',
            detail: 'Puedes grabar y transcribir; el análisis necesita que Ollama esté activo.',
          },
        }
  }

  if (usingFallback) {
    return {
      ...base,
      tone: 'warn',
      headline: 'Usando respaldo en la nube',
      attention: {
        title: 'Ollama no responde',
        detail: 'El análisis se hará con OpenAI, como permitiste en Configuración.',
      },
    }
  }

  return { ...base, tone: 'ok', headline: 'Listo', attention: null }
}

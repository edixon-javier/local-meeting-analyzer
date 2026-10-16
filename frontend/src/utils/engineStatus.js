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
  const rawProvider = systemStatus?.ai_provider
  const provider = ['openai', 'claude', 'gemini'].includes(rawProvider) ? rawProvider : 'local'
  const fallbackAllowed = Boolean(systemStatus?.allow_cloud_fallback)
  const engineReady = Boolean(systemStatus?.ollama_running)

  let defaultLlm = 'qwen3:4b'
  if (provider === 'openai') defaultLlm = 'gpt-4o-mini'
  else if (provider === 'claude') defaultLlm = 'claude-3-5-haiku-20241022'
  else if (provider === 'gemini') defaultLlm = 'gemini-2.0-flash'

  const llm = systemStatus?.llm_model || defaultLlm

  let transcription = `Whisper ${systemStatus?.whisper_model || 'small'} (local)`
  if (provider === 'openai') {
    transcription = 'Whisper-1 (OpenAI)'
  } else if (provider === 'claude') {
    transcription = `Whisper ${systemStatus?.whisper_model || 'small'} + Claude`
  } else if (provider === 'gemini') {
    transcription = `${systemStatus?.gemini_model || 'Gemini 2.0 Flash'} (Google)`
  }

  // En local con respaldo, el backend informa el modelo de OpenAI cuando Ollama no responde
  const usingFallback = provider === 'local' && fallbackAllowed && isCloudModel(llm)

  let analysis = `${llm} (Ollama)`
  if (provider === 'openai') {
    analysis = `${llm} (OpenAI)`
  } else if (provider === 'claude') {
    analysis = `${llm} (Claude)`
  } else if (provider === 'gemini') {
    analysis = `${llm} (Gemini)`
  } else if (usingFallback) {
    analysis = `${llm} (OpenAI, respaldo)`
  }

  let privacy = { icon: 'lock', tone: 'ok', text: 'Tus datos no salen de este equipo' }
  if (provider === 'openai') {
    privacy = { icon: 'cloud', tone: 'warn', text: 'El audio y el texto se envían a OpenAI' }
  } else if (provider === 'claude') {
    privacy = { icon: 'cloud', tone: 'warn', text: 'El texto se envía a Anthropic (Claude)' }
  } else if (provider === 'gemini') {
    privacy = { icon: 'cloud', tone: 'warn', text: 'El audio y el texto se envían a Google (Gemini)' }
  } else if (usingFallback) {
    privacy = { icon: 'cloud', tone: 'warn', text: 'Respaldo activo: el texto se envía a OpenAI' }
  } else if (fallbackAllowed) {
    privacy = { icon: 'lock', tone: 'ok', text: 'Local (respaldo en la nube permitido)' }
  }

  const base = {
    provider,
    isCloud: provider !== 'local',
    providerLabel: provider !== 'local' ? 'IA en la nube' : 'IA local',
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
    if (provider === 'openai') {
      return {
        ...base,
        tone: 'warn',
        headline: 'Falta la clave de OpenAI',
        attention: {
          title: 'Falta la clave de OpenAI',
          detail: 'Añádela en Configuración o vuelve a la IA local.',
        },
      }
    }
    if (provider === 'claude') {
      return {
        ...base,
        tone: 'warn',
        headline: 'Falta la clave de Claude',
        attention: {
          title: 'Falta la clave de Claude',
          detail: 'Añádela en Configuración o vuelve a la IA local.',
        },
      }
    }
    if (provider === 'gemini') {
      return {
        ...base,
        tone: 'warn',
        headline: 'Falta la clave de Gemini',
        attention: {
          title: 'Falta la clave de Gemini',
          detail: 'Añádela en Configuración o vuelve a la IA local.',
        },
      }
    }
    return {
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

/**
 * Resumen de privacidad directo para el indicador en la pantalla de grabación.
 * @param {string} provider - 'local' | 'openai' | 'claude' | 'gemini'
 * @param {boolean} cloudFallback - Si el usuario activó respaldo en la nube
 */
export function getPrivacyNotice(provider, cloudFallback) {
  if (provider === 'openai') {
    return {
      icon: 'cloud',
      color: 'var(--yellow-warn)',
      text: 'Modo nube: el audio y el texto se envían a OpenAI.',
      shortText: 'Nube · OpenAI'
    }
  }
  if (provider === 'claude') {
    return {
      icon: 'cloud',
      color: 'var(--yellow-warn)',
      text: 'Modo híbrido/nube: el texto se envía a Anthropic (Claude).',
      shortText: 'Híbrido · Claude'
    }
  }
  if (provider === 'gemini') {
    return {
      icon: 'cloud',
      color: 'var(--yellow-warn)',
      text: 'Modo nube: el audio y el texto se envían a Google (Gemini).',
      shortText: 'Nube · Gemini'
    }
  }
  if (provider === 'local') {
    if (cloudFallback) {
      return {
        icon: 'cloud',
        color: 'var(--yellow-warn)',
        text: 'Procesamiento local (respaldo en la nube activo si Ollama no responde).',
        shortText: 'Local (respaldo)'
      }
    }
    return {
      icon: 'lock',
      color: 'var(--green-ok)',
      text: 'Procesamiento 100% local: tus datos no salen de este equipo.',
      shortText: '100% Local'
    }
  }
  return {
    icon: 'lock',
    color: 'var(--green-ok)',
    text: 'Procesamiento local: tus datos no salen de este equipo.',
    shortText: '100% Local'
  }
}

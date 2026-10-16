/**
 * Utilidades para procesamiento y formateo de texto y markdown en componentes de chat.
 */

/**
 * Convierte un timestamp [MM:SS] o [HH:MM:SS] a segundos enteros para reproducción de audio.
 */
export function parseTimestampToSeconds(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

/**
 * Separa el texto principal de la sección de preguntas sugeridas si existe al final.
 */
export function extractSuggestions(rawText) {
  if (!rawText) return { mainText: '', suggestions: [] }

  const markerMatch = rawText.match(/(?:---\s*\n)?\*\*Preguntas sugeridas:\*\*([\s\S]*)$/i)
  if (!markerMatch) {
    return { mainText: rawText, suggestions: [] }
  }

  const mainText = rawText.substring(0, markerMatch.index).trimEnd()
  const rawSuggestionsBlock = markerMatch[1] || ''

  const suggestions = rawSuggestionsBlock
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-') || line.startsWith('*'))
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(q => q.length > 3)

  return { mainText, suggestions }
}

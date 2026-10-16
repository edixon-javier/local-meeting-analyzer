import React from 'react'
import Icon from '../Icon'
import { parseTimestampToSeconds, extractSuggestions } from '../../utils/markdownHelpers'

/**
 * Renderiza texto en línea soportando negrita, cursiva, código en línea,
 * citas temporales [MM:SS] y referencias de reunión [Reunión: ...].
 * Cero dangerouslySetInnerHTML: 100% elementos React seguros.
 */
function renderInline(text, keyPrefix = 'inline', onSeekAudio = null) {
  if (!text) return null

  // Tokenización por regex para estilos en línea
  // 1: Cita de reunión: **[Reunión: ...]** o [Reunión: ...]
  // 2: Timestamp: [MM:SS] o [HH:MM:SS]
  // 3: Negrita: **...**
  // 4: Cursiva: *...*
  // 5: Inline code: `...`
  const pattern = /(\*\*\[Reunión:[^\]]+\]\*\*|\[Reunión:[^\]]+\]|\[\d{1,2}:\d{2}(?::\d{2})?\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(pattern)

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`
    if (!part) return null

    // Cita de reunión
    if (part.startsWith('**[Reunión:') && part.endsWith(']**')) {
      const inner = part.slice(3, -3) // quita ** y **
      return (
        <span key={key} className="chat-inline-badge chat-inline-badge-meeting">
          <Icon name="folder" size={12} />
          <span>{inner}</span>
        </span>
      )
    }
    if (part.startsWith('[Reunión:') && part.endsWith(']')) {
      return (
        <span key={key} className="chat-inline-badge chat-inline-badge-meeting">
          <Icon name="folder" size={12} />
          <span>{part.slice(1, -1)}</span>
        </span>
      )
    }

    // Timestamp [MM:SS] o [HH:MM:SS] interactivo si onSeekAudio está presente
    if (/^\[\d{1,2}:\d{2}(?::\d{2})?\]$/.test(part)) {
      const timeStr = part.slice(1, -1)
      const seconds = parseTimestampToSeconds(timeStr)
      if (typeof onSeekAudio === 'function') {
        return (
          <button
            key={key}
            type="button"
            className="chat-inline-timestamp chat-inline-timestamp-btn"
            onClick={() => onSeekAudio(seconds)}
            title={`Reproducir audio desde ${timeStr}`}
            aria-label={`Reproducir audio desde el minuto ${timeStr}`}
          >
            <Icon name="clock" size={11} />
            <span>{timeStr}</span>
          </button>
        )
      }
      return (
        <span key={key} className="chat-inline-timestamp" title="Marca temporal">
          <Icon name="clock" size={11} />
          <span>{timeStr}</span>
        </span>
      )
    }

    // Negrita
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={key} style={{ color: 'var(--text-primary)', fontWeight: 650 }}>{part.slice(2, -2)}</strong>
    }

    // Cursiva
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={key} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{part.slice(1, -1)}</em>
    }

    // Código en línea
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={key} className="chat-inline-code">
          {part.slice(1, -1)}
        </code>
      )
    }

    return <span key={key}>{part}</span>
  })
}


/**
 * Componente principal MarkdownViewer
 */
export default function MarkdownViewer({ content = '', onSelectSuggestion, isUser = false, onSeekAudio = null }) {
  if (isUser) {
    return <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{content}</div>
  }

  const { mainText, suggestions } = extractSuggestions(content)
  const lines = mainText.split('\n')

  const elements = []
  let inCodeBlock = false
  let codeBuffer = []
  let listItems = []
  let listType = null // 'ul' | 'ol'

  const flushList = (keySuffix) => {
    if (listItems.length === 0) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    elements.push(
      <Tag
        key={`list-${keySuffix}`}
        style={{
          margin: '8px 0',
          paddingLeft: listType === 'ol' ? '22px' : '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}
      >
        {listItems.map((item, idx) => (
          <li key={`li-${keySuffix}-${idx}`} style={{ lineHeight: 1.55 }}>
            {renderInline(item, `li-${keySuffix}-${idx}`, onSeekAudio)}
          </li>
        ))}
      </Tag>
    )
    listItems = []
    listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Manejo de bloques de código (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="chat-code-block"
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              overflowX: 'auto',
              margin: '10px 0'
            }}
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        )
        codeBuffer = []
        inCodeBlock = false
      } else {
        flushList(i)
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    // Línea separadora horizontal (---)
    if (/^---{1,}$/.test(trimmed)) {
      flushList(i)
      elements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-subtle)',
            margin: '14px 0'
          }}
        />
      )
      continue
    }

    // Encabezados (###, ##, #)
    if (trimmed.startsWith('#')) {
      flushList(i)
      const level = trimmed.match(/^#+/)[0].length
      const headingText = trimmed.replace(/^#+\s*/, '')
      const fontSize = level === 1 ? '16px' : level === 2 ? '15px' : '14px'
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            fontWeight: 700,
            fontSize,
            color: 'var(--text-primary)',
            marginTop: '12px',
            marginBottom: '6px'
          }}
        >
          {renderInline(headingText, `h-${i}`, onSeekAudio)}
        </div>
      )
      continue
    }

    // Citas en bloque (> ...)
    if (trimmed.startsWith('>')) {
      flushList(i)
      const quoteText = trimmed.replace(/^>\s*/, '')
      elements.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            borderLeft: '3px solid var(--accent-primary)',
            paddingLeft: '12px',
            margin: '8px 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            background: 'rgba(99, 102, 241, 0.04)',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
          }}
        >
          {renderInline(quoteText, `quote-${i}`, onSeekAudio)}
        </blockquote>
      )
      continue
    }

    // Listas con viñetas (- ..., * ...)
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      if (listType !== 'ul') flushList(i)
      listType = 'ul'
      listItems.push(bulletMatch[1])
      continue
    }

    // Listas ordenadas (1. ..., 2. ...)
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      if (listType !== 'ol') flushList(i)
      listType = 'ol'
      listItems.push(orderedMatch[1])
      continue
    }

    // Línea en blanco / separación de párrafos
    if (trimmed === '') {
      flushList(i)
      continue
    }

    // Párrafo normal
    flushList(i)
    elements.push(
      <p key={`p-${i}`} style={{ margin: '6px 0', lineHeight: 1.6, wordBreak: 'break-word' }}>
        {renderInline(line, `p-${i}`, onSeekAudio)}
      </p>
    )
  }

  // Vaciar cualquier lista pendiente al final
  flushList('end')

  return (
    <div className="chat-markdown-body">
      {elements}

      {/* Sugerencias de seguimiento interactivas */}
      {suggestions.length > 0 && onSelectSuggestion && (
        <div
          className="chat-followup-container"
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-accent)', fontWeight: 650, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="lightbulb" size={13} /> Preguntas sugeridas para continuar:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="chat-suggestion-chip"
                onClick={() => onSelectSuggestion(q)}
                title="Hacer esta pregunta"
              >
                <span>{q}</span>
                <Icon name="arrow-right" size={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

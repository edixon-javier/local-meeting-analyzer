import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import Icon from '../Icon'

const ChatInput = forwardRef(function ChatInput(
  {
    value,
    onChange,
    onSubmit,
    onCancel,
    isLoading = false,
    disabled = false,
    placeholder = 'Escribe tu mensaje aquí…',
    ariaLabel = 'Entrada de mensaje de chat',
    submitText = 'Preguntar',
    compact = false
  },
  ref
) {
  const textareaRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    getNode: () => textareaRef.current
  }))

  // Auto-ajuste dinámico de la altura del textarea según el contenido
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const newHeight = Math.min(Math.max(el.scrollHeight, 40), 160)
    el.style.height = `${newHeight}px`
  }, [value])

  const handleKeyDown = (e) => {
    // Enter envía, Shift+Enter inserta salto de línea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim() && !disabled) {
        onSubmit()
      }
    }
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (isLoading && onCancel) {
      onCancel()
    } else if (!isLoading && value.trim() && !disabled) {
      onSubmit()
    }
  }

  const canSubmit = !disabled && Boolean(value.trim())

  return (
    <form onSubmit={handleFormSubmit} className={`chat-input-form ${compact ? 'is-compact' : ''}`}>
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          rows={1}
          className="chat-textarea"
          aria-multiline="true"
        />

        <div className="chat-input-hints" aria-hidden="true">
          <span>Shift+Enter para nueva línea</span>
        </div>
      </div>

      {isLoading && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary chat-stop-btn"
          aria-label="Detener generación de respuesta"
          title="Detener respuesta en curso"
        >
          <div className="chat-stop-icon" aria-hidden="true" />
          {!compact && <span>Detener</span>}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSubmit || isLoading}
          className="btn btn-primary chat-send-btn"
          aria-busy={isLoading || undefined}
          aria-label={isLoading ? 'Generando respuesta…' : ariaLabel.includes('reunión') ? 'Enviar mensaje' : submitText}
          title={compact ? 'Enviar mensaje' : undefined}
        >
          {isLoading ? (
            <>
              <span className="spinner-small on-accent" style={{ width: 14, height: 14 }} aria-hidden="true" />
              {!compact && <span>Consultando…</span>}
            </>
          ) : (
            <>
              {!compact && <span>{submitText}</span>}
              <Icon name="send" size={compact ? 16 : 14} />
            </>
          )}
        </button>
      )}
    </form>
  )
})

export default ChatInput

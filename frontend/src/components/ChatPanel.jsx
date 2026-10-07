import { useState, useRef, useEffect } from 'react'
import { chatWithMeeting } from '../api'
import Icon from './Icon'

export default function ChatPanel({ audioPath }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Puedes hacerme preguntas sobre esta reunión o pedirme que redacte correos y resúmenes personalizados basados en lo que se habló.' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef(null)
  const inputRef = useRef(null)

  // Mantener visible el último mensaje (y el indicador de "escribiendo")
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Devolver el foco al campo al terminar cada respuesta
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userQuestion = input.trim()
    setInput('')

    // Add user message to UI
    const updatedMessages = [...messages, { role: 'user', content: userQuestion }]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      // Filtrar mensaje inicial para enviar al backend solo el historial real
      const apiMessages = updatedMessages.filter(m => m !== updatedMessages[0]).slice(0, -1)
      const res = await chatWithMeeting(audioPath, apiMessages, userQuestion)

      if (res.data && res.data.response) {
        setMessages([...updatedMessages, { role: 'assistant', content: res.data.response }])
      }
    } catch (err) {
      console.error(err)
      setMessages([...updatedMessages, { role: 'assistant', isError: true, content: 'Hubo un error al obtener la respuesta. Verifica tu configuración o si el motor de IA está activo.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-panel">
      {/* Messages list */}
      <div
        ref={chatContainerRef}
        role="log"
        aria-live="polite"
        aria-label="Conversación sobre la reunión"
        className="chat-panel-messages"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-panel-msg ${msg.role === 'user' ? 'is-user' : 'is-assistant'} ${msg.isError ? 'is-error' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="chat-panel-msg-label">
                {msg.isError && <Icon name="alert-triangle" size={12} />}
                {msg.isError ? 'No se pudo responder' : 'Asistente IA'}
              </div>
            )}
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div role="status" className="chat-panel-typing">
            <span className="dot-typing" aria-hidden="true" />
            <span className="chat-panel-typing-text">Escribiendo…</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="chat-panel-footer">
        <form onSubmit={handleSend} className="chat-panel-form">
          <input
            ref={inputRef}
            type="text"
            className="chat-input chat-panel-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta algo sobre la reunión…"
            aria-label="Pregunta sobre esta reunión"
            disabled={isLoading || !audioPath}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !audioPath}
            className="btn btn-primary chat-panel-send"
            aria-busy={isLoading || undefined}
            aria-label="Enviar mensaje"
            title="Enviar mensaje"
          >
            <Icon name="send" size={17} />
          </button>
        </form>
      </div>
    </div>
  )
}

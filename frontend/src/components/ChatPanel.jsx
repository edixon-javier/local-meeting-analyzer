import { useState, useRef, useEffect } from 'react'
import { chatWithMeeting } from '../api'

export default function ChatPanel({ audioPath }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Puedes hacerme preguntas sobre esta reunión o pedirme que redacte correos y resúmenes personalizados basados en lo que se habló.' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

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
      setMessages([...updatedMessages, { role: 'assistant', content: '❌ Hubo un error al obtener la respuesta. Verifica tu configuración o si el motor de IA está activo.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Messages list */}
      <div 
        ref={chatContainerRef} 
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ 
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '12px 16px',
            borderRadius: '16px',
            borderBottomRightRadius: msg.role === 'user' ? 0 : '16px',
            borderBottomLeftRadius: msg.role === 'assistant' ? 0 : '16px',
            background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
            color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
            border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
            fontSize: '13px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap'
          }}>
            {msg.role === 'assistant' && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>Asistente IA</div>}
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <span className="dot-typing" style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>Escribiendo...</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta algo sobre la reunión..."
            disabled={isLoading || !audioPath}
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              borderRadius: '24px', 
              border: '1px solid var(--border-subtle)', 
              background: 'var(--bg-surface)', 
              color: 'var(--text-primary)' 
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim() || !audioPath}
            className="btn btn-primary"
            style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  )
}

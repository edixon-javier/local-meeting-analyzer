import { useState, useRef, useEffect } from 'react'
import { chatWithHistory } from '../api'
import { useSystem } from '../context/SystemContext'
import { useRecordings } from '../context/RecordingsContext'

export default function HistoryChatScreen({ onNavigate }) {
  const { isBackendOffline, systemStatus } = useSystem()
  const { recordings, formatDate } = useRecordings()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de reuniones. Puedo consultar y analizar el historial completo de tus grabaciones transcritas.\n\nHazme preguntas como:\n• "¿Qué decisiones tomamos sobre el presupuesto el mes pasado?"\n• "¿Quién quedó a cargo de las tareas del frontend?"\n• "Hazme un resumen consolidado de las últimas reuniones sobre el diseño del producto."',
      referenced_meetings: []
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Filtrar solo reuniones que ya están analizadas/transcritas para saber si hay información
  const transcribedRecordings = recordings.filter(r => r.has_metadata)

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isBackendOffline) return

    const userQuestion = input.trim()
    setInput('')

    // Agregar mensaje de usuario al estado de la interfaz
    const updatedMessages = [...messages, { role: 'user', content: userQuestion, referenced_meetings: [] }]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      // Filtrar el mensaje de bienvenida inicial para enviar solo la conversación real
      const apiHistory = updatedMessages
        .filter(m => m !== updatedMessages[0])
        .map(m => ({ role: m.role, content: m.content }))
        .slice(0, -1) // Excluir la última pregunta que va por separado

      const res = await chatWithHistory(apiHistory, userQuestion)

      if (res.data && res.data.response) {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: res.data.response,
            referenced_meetings: res.data.referenced_meetings || []
          }
        ])
      }
    } catch (err) {
      console.error('Error al chatear con el historial:', err)
      const errorMsg = err.response?.data?.detail || 'Hubo un error al obtener la respuesta del motor de IA. Verifica tu conexión o el estado de Ollama/OpenAI.'
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `❌ Error: ${errorMsg}`,
          referenced_meetings: []
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReferenceClick = (path) => {
    if (path) {
      onNavigate('analysis', { path })
    }
  }

  // ── Vista offline ──
  if (isBackendOffline) {
    return (
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450 }}>
          <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Servidor Desconectado</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            El chat global no está disponible porque el servidor local de la aplicación no está conectado.
          </div>
        </div>
      </div>
    )
  }

  // ── Vista sin reuniones transcritas ──
  if (transcribedRecordings.length === 0) {
    return (
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 500 }}>
          <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Sin datos en el historial</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: '1.6' }}>
            Para poder hacer consultas globales, primero necesitas tener reuniones guardadas con su respectiva transcripción y análisis.
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('record')}>
            Ir a Nueva Grabación
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-chat-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Cabecera */}
      <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            Preguntar al Historial 
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-violet-glow)', color: 'var(--text-accent)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              RAG Activo
            </span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Realiza preguntas globales, cruza información y genera resúmenes consolidados de todas tus reuniones.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span>Motor activo: <strong>{systemStatus?.ai_provider === 'openai' ? '☁️ OpenAI (Nube)' : '💻 Ollama (Local)'}</strong></span>
        </div>
      </div>

      {/* Listado de mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((msg, i) => (
          <div 
            key={i} 
            style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.role === 'user' ? '75%' : '85%',
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              borderBottomRightRadius: msg.role === 'user' ? 0 : 'var(--radius-lg)',
              borderBottomLeftRadius: msg.role === 'assistant' ? 0 : 'var(--radius-lg)',
              background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
              fontSize: '13.5px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ fontSize: '11px', color: 'var(--text-accent)', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Asistente AI
              </div>
            )}
            
            <div style={{ wordBreak: 'break-word' }}>
              {msg.content}
            </div>

            {/* Visualización de referencias RAG */}
            {msg.referenced_meetings && msg.referenced_meetings.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  📂 Reuniones consultadas para esta respuesta:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {msg.referenced_meetings.map((ref, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleReferenceClick(ref.path)}
                      title="Haz clic para ver el análisis de esta reunión"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11.5px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast), border-color var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)'
                        e.currentTarget.style.borderColor = 'var(--accent-primary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-elevated)'
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      }}
                    >
                      <span>🎙️</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{ref.filename.replace(/\.(wav|mp3)$/i, '')}</span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                          {ref.category} · {formatDate(ref.created)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner-border" style={{ width: '1rem', height: '1rem', border: '2px solid var(--text-muted)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '13px' }}>Consultando tu historial de reuniones...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Formulario de entrada */}
      <div style={{ padding: '20px 32px 28px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', maxWidth: '1000px', margin: '0 auto' }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta algo sobre las reuniones guardadas..."
            disabled={isLoading || isBackendOffline}
            style={{ 
              flex: 1, 
              padding: '14px 20px', 
              borderRadius: 'var(--radius-xl)', 
              border: '1px solid var(--border-subtle)', 
              background: 'var(--bg-surface)', 
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              outline: 'none',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim() || isBackendOffline}
            className="btn btn-primary"
            style={{ borderRadius: 'var(--radius-xl)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', gap: '8px', fontWeight: 600 }}
          >
            Preguntar <span>↑</span>
          </button>
        </form>
      </div>
    </div>
  )
}

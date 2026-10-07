import { useState, useRef, useEffect } from 'react'
import { chatWithHistory } from '../api'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import Icon from './Icon'
import { getRecordingTitle } from '../utils/recordingName'
import '../styles/settings-chat.css'

const SUGGESTED_QUESTIONS = [
  '¿Qué decisiones tomamos sobre el presupuesto el mes pasado?',
  '¿Quién quedó a cargo de las tareas del frontend?',
  'Hazme un resumen consolidado de las últimas reuniones sobre el diseño del producto.',
]

export default function HistoryChatScreen({ onNavigate }) {
  const { isBackendOffline } = useSystem()
  const { recordings, formatDate } = useRecordings()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de reuniones. Puedo consultar y analizar el historial completo de tus grabaciones transcritas.\n\nEscribe tu pregunta o elige una de estas para empezar:',
      referenced_meetings: []
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef(null)
  const inputRef = useRef(null)

  // Mantener visible el último mensaje (y el indicador de "consultando")
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Devolver el foco al campo al terminar cada respuesta para encadenar preguntas con el teclado
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  // Filtrar solo reuniones que ya están analizadas/transcritas para saber si hay información
  const transcribedRecordings = recordings.filter(r => r.has_metadata)

  // Envía una pregunta (escrita o elegida de las sugerencias) y añade la respuesta a la conversación
  const sendQuestion = async (question) => {
    const userQuestion = (question || '').trim()
    if (!userQuestion || isLoading || isBackendOffline) return
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
          content: errorMsg,
          isError: true,
          referenced_meetings: []
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    sendQuestion(input)
  }

  // Las sugerencias solo se ofrecen mientras el usuario aún no ha preguntado nada
  const showSuggestions = !messages.some(m => m.role === 'user')

  const handleReferenceClick =(path) => {
    if (path) {
      onNavigate('analysis', { path })
    }
  }

  // ── Vista offline ──
  if (isBackendOffline) {
    return (
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state glass" style={{ padding: '48px 32px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: 450 }}>
          <div className="empty-state-icon" style={{ marginBottom: 16 }}>
            <Icon name="alert-triangle" size={48} style={{ color: 'var(--red-record)' }} />
          </div>
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
          <div className="empty-state-icon" style={{ marginBottom: 16 }}>
            <Icon name="search" size={48} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="empty-state-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Sin datos en el historial</div>
          <div className="empty-state-sub" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: '1.6' }}>
            Para poder hacer consultas globales, primero necesitas tener reuniones guardadas con su respectiva transcripción y análisis.
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('record')}>
            <Icon name="mic" size={16} /> Ir a Nueva Grabación
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-chat-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Cabecera */}
      <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Preguntar al Historial
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Haz preguntas sobre varias reuniones a la vez: decisiones, responsables, temas recurrentes o resúmenes consolidados.
          </p>
        </div>

        <span
          className="chat-scope-chip"
          title="Solo se consultan las reuniones que ya tienen transcripción y análisis"
        >
          <Icon name="folder" size={13} />
          Consulta {transcribedRecordings.length} {transcribedRecordings.length === 1 ? 'reunión analizada' : 'reuniones analizadas'}
        </span>
      </div>

      {/* Listado de mensajes */}
      <div
        ref={chatContainerRef}
        role="log"
        aria-live="polite"
        aria-label="Conversación con el historial"
        style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}
      >
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
              background: msg.role === 'user' ? 'var(--accent-primary)' : msg.isError ? 'rgba(248, 113, 113, 0.08)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? `1px solid ${msg.isError ? 'rgba(248, 113, 113, 0.35)' : 'var(--border-subtle)'}` : 'none',
              userSelect: 'text',
              fontSize: '13.5px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ fontSize: '11px', color: msg.isError ? 'var(--red-record)' : 'var(--text-accent)', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                {msg.isError && <Icon name="alert-triangle" size={12} />}
                {msg.isError ? 'No se pudo responder' : 'Asistente IA'}
              </div>
            )}

            <div style={{ wordBreak: 'break-word' }}>
              {msg.content}
            </div>

            {/* Visualización de referencias RAG */}
            {msg.referenced_meetings && msg.referenced_meetings.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="folder" size={13} /> Reuniones consultadas para esta respuesta:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {msg.referenced_meetings.map((ref, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="chat-reference"
                      onClick={() => handleReferenceClick(ref.path)}
                      title="Ver el análisis de esta reunión"
                    >
                      <Icon name="mic" size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{getRecordingTitle(ref.filename)}</span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                          {ref.category} · {formatDate(ref.created)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {showSuggestions && (
          <div className="chat-suggestions" role="group" aria-label="Preguntas sugeridas">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="chat-suggestion"
                onClick={() => sendQuestion(question)}
                disabled={isLoading || isBackendOffline}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {isLoading && (
          <div role="status" style={{ alignSelf: 'flex-start', padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner-small" aria-hidden="true" />
            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '13px' }}>Consultando tu historial de reuniones...</span>
          </div>
        )}
      </div>

      {/* Formulario de entrada */}
      <div style={{ padding: '20px 32px 28px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', maxWidth: '1000px', margin: '0 auto' }}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta algo sobre las reuniones guardadas…"
            aria-label="Pregunta sobre tus reuniones"
            disabled={isLoading || isBackendOffline}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || isBackendOffline}
            className="btn btn-primary"
            aria-busy={isLoading || undefined}
            style={{ borderRadius: 'var(--radius-xl)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', gap: '8px', fontWeight: 600 }}
          >
            {isLoading
              ? <><span className="spinner-small on-accent" style={{ width: 14, height: 14 }} aria-hidden="true" /> Consultando…</>
              : <>Preguntar <Icon name="send" size={15} /></>}
          </button>
        </form>
      </div>
    </div>
  )
}

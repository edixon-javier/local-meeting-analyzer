import { useState, useRef, useEffect, useCallback } from 'react'
import { chatWithHistory, chatWithHistoryStream } from '../api'
import { useSystem } from '../hooks/useSystem'
import { useRecordings } from '../hooks/useRecordings'
import Icon from './Icon'
import MarkdownViewer from './chat/MarkdownViewer'
import ChatInput from './chat/ChatInput'
import ChatEngineBadge from './chat/ChatEngineBadge'
import GroundingBadge from './chat/GroundingBadge'
import ChatSessionsModal from './chat/ChatSessionsModal'
import { getRecordingTitle } from '../utils/recordingName'
import '../styles/settings-chat.css'

const SUGGESTED_QUESTIONS = [
  '¿Qué decisiones tomamos sobre el presupuesto el mes pasado?',
  '¿Quién quedó a cargo de las tareas del frontend?',
  'Hazme un resumen consolidado de las últimas reuniones sobre el diseño del producto.',
]

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: '¡Hola! Soy tu asistente de reuniones. Puedo consultar y analizar el historial completo de tus grabaciones transcritas.\n\nEscribe tu pregunta o elige una de estas para empezar:',
  referenced_meetings: []
}

const GLOBAL_CHAT_STORAGE_KEY = 'global_history_chat'
const GLOBAL_CHAT_SESSIONS_KEY = 'global_history_chat_sessions'

const loadSavedHistoryMessages = () => {
  try {
    const raw = localStorage.getItem(GLOBAL_CHAT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return [INITIAL_MESSAGE]
}

const loadSavedHistorySessions = () => {
  try {
    const raw = localStorage.getItem(GLOBAL_CHAT_SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

export default function HistoryChatScreen({ onNavigate }) {
  const { isBackendOffline, systemStatus } = useSystem()
  const { recordings, formatDate } = useRecordings()
  const [messages, setMessages] = useState(loadSavedHistoryMessages)
  const [sessions, setSessions] = useState(loadSavedHistorySessions)
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [expandedSnippets, setExpandedSnippets] = useState({})
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [srAnnouncement, setSrAnnouncement] = useState('')

  const chatContainerRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const userScrolledUpRef = useRef(false)

  // Persistir mensajes en localStorage
  useEffect(() => {
    try {
      if (messages.length > 1) {
        localStorage.setItem(GLOBAL_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)))
      }
    } catch {
      // ignore
    }
  }, [messages])

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      userScrolledUpRef.current = false
      setShowScrollBottom(false)
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }, [])

  // Autoscroll adaptativo inteligente: respeta la lectura si el usuario subió
  useEffect(() => {
    if (!userScrolledUpRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Devolver el foco al campo al terminar cada respuesta para encadenar preguntas
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  const handleContainerScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isUp = distanceFromBottom > 120
    userScrolledUpRef.current = isUp
    setShowScrollBottom(isUp)
  }

  // Filtrar solo reuniones que ya están analizadas/transcritas para saber si hay información
  const transcribedRecordings = recordings.filter(r => r.has_metadata)

  // Envía una pregunta (escrita o elegida de las sugerencias) y añade la respuesta
  const sendQuestion = async (question) => {
    const userQuestion = (question || '').trim()
    if (!userQuestion || isLoading || isBackendOffline) return
    setInput('')
    userScrolledUpRef.current = false
    setShowScrollBottom(false)

    // Agregar mensaje de usuario al estado de la interfaz
    const updatedMessages = [...messages, { role: 'user', content: userQuestion, referenced_meetings: [] }]
    setMessages(updatedMessages)
    setIsLoading(true)
    setSrAnnouncement(`Pregunta enviada: ${userQuestion}. Esperando respuesta del asistente…`)

    abortControllerRef.current = new AbortController()

    try {
      // Filtrar el mensaje de bienvenida inicial para enviar solo la conversación real
      const apiHistory = updatedMessages
        .filter(m => m !== updatedMessages[0])
        .map(m => ({ role: m.role, content: m.content }))
        .slice(0, -1) // Excluir la última pregunta que va por separado

      const streamFn = chatWithHistoryStream || ((hist, q, onChunk, opts) =>
        chatWithHistory(hist, q, opts).then(r => {
          if (r?.data?.response) onChunk?.(r.data.response)
          return r?.data || r
        }))

      const res = await streamFn(
        apiHistory,
        userQuestion,
        (currentText) => {
          setMessages([
            ...updatedMessages,
            {
              role: 'assistant',
              content: currentText,
              referenced_meetings: []
            }
          ])
        },
        { signal: abortControllerRef.current.signal }
      )

      const responseText = res?.response || res?.data?.response
      const grounding = res?.grounding || res?.data?.grounding || null
      if (responseText) {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: responseText,
            referenced_meetings: res?.referenced_meetings || res?.data?.referenced_meetings || [],
            grounding
          }
        ])
        setSrAnnouncement('Nueva respuesta del asistente recibida.')
      }
    } catch (err) {
      const isCanceled = err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled'
      if (isCanceled) {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: 'Consulta detenida por el usuario.',
            isError: false,
            isCancelled: true,
            failedQuestion: userQuestion,
            referenced_meetings: []
          }
        ])
        setSrAnnouncement('Generación de respuesta detenida.')
      } else {
        console.error('Error al chatear con el historial:', err)
        const errorMsg = err.response?.data?.detail || 'Hubo un error al obtener la respuesta del motor de IA. Verifica tu conexión o el estado de Ollama/OpenAI.'
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: errorMsg,
            isError: true,
            failedQuestion: userQuestion,
            referenced_meetings: []
          }
        ])
        setSrAnnouncement(`Error al responder: ${errorMsg}`)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleRetry = (failedQuestion) => {
    if (failedQuestion) {
      sendQuestion(failedQuestion)
    }
  }

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setSrAnnouncement('Respuesta copiada al portapapeles.')
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch (err) {
      console.error('Error copiando al portapapeles:', err)
    }
  }

  const handleClearHistory = () => {
    const hasUserQuestions = messages.some(m => m.role === 'user')
    if (hasUserQuestions) {
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Consulta global'
      const title = firstUserMsg.length > 55 ? firstUserMsg.slice(0, 52) + '...' : firstUserMsg
      const newSession = {
        id: `sess_${Date.now()}`,
        title,
        createdAt: Date.now(),
        messages: [...messages]
      }
      const updatedSessions = [newSession, ...sessions.filter(s => s.id !== newSession.id)].slice(0, 15)
      setSessions(updatedSessions)
      try {
        localStorage.setItem(GLOBAL_CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions))
      } catch {}
    }

    try {
      localStorage.removeItem(GLOBAL_CHAT_STORAGE_KEY)
    } catch {}
    setMessages([INITIAL_MESSAGE])
    setExpandedSnippets({})
    userScrolledUpRef.current = false
    setShowScrollBottom(false)
    setSrAnnouncement(hasUserQuestions ? 'Consulta archivada y conversación reiniciada.' : 'Conversación reiniciada.')
  }

  const handleSelectSession = (session) => {
    if (session && Array.isArray(session.messages)) {
      setMessages(session.messages)
      userScrolledUpRef.current = false
      setShowScrollBottom(false)
      setSrAnnouncement(`Consulta "${session.title}" recuperada.`)
    }
  }

  const handleDeleteSession = (sessionId) => {
    const updated = sessions.filter(s => s.id !== sessionId)
    setSessions(updated)
    try {
      localStorage.setItem(GLOBAL_CHAT_SESSIONS_KEY, JSON.stringify(updated))
    } catch {}
    setSrAnnouncement('Sesión archivada eliminada.')
  }

  const toggleSnippets = (refKey) => {
    setExpandedSnippets(prev => ({
      ...prev,
      [refKey]: !prev[refKey]
    }))
  }

  // Las sugerencias solo se ofrecen mientras el usuario aún no ha preguntado nada
  const showSuggestions = !messages.some(m => m.role === 'user')

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
    <div className="history-chat-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Región oculta para anuncios accesibles en lectores de pantalla */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {srAnnouncement}
      </div>

      {/* Cabecera */}
      <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Preguntar al Historial
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Haz preguntas sobre varias reuniones a la vez: decisiones, responsables, temas recurrentes o resúmenes consolidados.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Badge del motor activo (Configuración ↔ Chat) */}
          <ChatEngineBadge systemStatus={systemStatus} onNavigate={onNavigate} />

          {sessions.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSessionsModal(true)}
              title={`Ver consultas anteriores archivadas (${sessions.length})`}
              aria-label={`Sesiones (${sessions.length})`}
              style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="clock" size={13} />
              <span>Sesiones ({sessions.length})</span>
            </button>
          )}

          {messages.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearHistory}
              title="Nueva consulta: archivar conversación actual"
              aria-label="Nueva consulta: archivar conversación actual"
              style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="refresh" size={13} />
              <span>Nueva consulta</span>
            </button>
          )}

          <span
            className="chat-scope-chip"
            title="Solo se consultan las reuniones que ya tienen transcripción y análisis"
          >
            <Icon name="folder" size={13} />
            Consulta {transcribedRecordings.length} {transcribedRecordings.length === 1 ? 'reunión analizada' : 'reuniones analizadas'}
          </span>
        </div>
      </div>

      {/* Listado de mensajes */}
      <div
        ref={chatContainerRef}
        onScroll={handleContainerScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversación con el historial"
        style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            tabIndex={0}
            aria-label={`${msg.role === 'user' ? 'Tu pregunta' : 'Respuesta del asistente'}: ${msg.content.slice(0, 80)}…`}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.role === 'user' ? '75%' : '85%',
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              borderBottomRightRadius: msg.role === 'user' ? 0 : 'var(--radius-lg)',
              borderBottomLeftRadius: msg.role === 'assistant' ? 0 : 'var(--radius-lg)',
              background: msg.role === 'user' ? 'var(--accent-primary)' : msg.isError ? 'rgba(248, 113, 113, 0.08)' : msg.isCancelled ? 'rgba(100, 116, 139, 0.1)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? `1px solid ${msg.isError ? 'rgba(248, 113, 113, 0.35)' : 'var(--border-subtle)'}` : 'none',
              userSelect: 'text',
              fontSize: '13.5px',
              lineHeight: 1.6,
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              outline: 'none'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ fontSize: '11px', color: msg.isError ? 'var(--red-record)' : msg.isCancelled ? 'var(--text-muted)' : 'var(--text-accent)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {msg.isError && <Icon name="alert-triangle" size={12} />}
                  {msg.isCancelled && <Icon name="stop" size={11} />}
                  {msg.isError ? 'No se pudo responder' : msg.isCancelled ? 'Consulta detenida' : 'Asistente IA'}
                </div>
              </div>
            )}

            <MarkdownViewer
              content={msg.content}
              isUser={msg.role === 'user'}
              onSelectSuggestion={i === messages.length - 1 && !isLoading ? sendQuestion : undefined}
            />

            {/* Indicador de Grounding / Confianza */}
            {msg.role === 'assistant' && !msg.isError && !msg.isCancelled && msg.grounding && (
              <GroundingBadge grounding={msg.grounding} />
            )}

            {/* Acciones del mensaje del asistente: Copiar */}
            {msg.role === 'assistant' && i !== 0 && !msg.isError && !msg.isCancelled && (
              <div className="chat-msg-actions">
                <button
                  type="button"
                  className={`chat-action-btn ${copiedIdx === i ? 'is-success' : ''}`}
                  onClick={() => handleCopy(msg.content, i)}
                  aria-label="Copiar texto de la respuesta"
                  title="Copiar texto de la respuesta"
                >
                  <Icon name={copiedIdx === i ? 'check' : 'copy'} size={13} />
                  <span>{copiedIdx === i ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {/* Reintento en caso de error o detención */}
            {(msg.isError || msg.isCancelled) && (
              <div className="chat-msg-actions">
                <button
                  type="button"
                  className="chat-action-btn"
                  onClick={() => handleRetry(msg.failedQuestion)}
                  disabled={isLoading}
                  aria-label="Reintentar esta pregunta"
                  style={{ color: msg.isError ? 'var(--red-record)' : 'var(--text-accent)', borderColor: msg.isError ? 'rgba(248, 113, 113, 0.4)' : 'var(--border-default)' }}
                >
                  <Icon name="refresh" size={13} />
                  <span>Reintentar pregunta</span>
                </button>
              </div>
            )}

            {/* Visualización de referencias RAG */}
            {msg.referenced_meetings && msg.referenced_meetings.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="folder" size={13} /> Reuniones consultadas para esta respuesta:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {msg.referenced_meetings.map((ref, idx) => {
                    const snippetKey = `${i}-${idx}`
                    const hasSnippets = ref.snippets && ref.snippets.length > 0
                    const isExpanded = !!expandedSnippets[snippetKey]

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          type="button"
                          className="chat-reference"
                          onClick={() => handleReferenceClick(ref.path)}
                          title="Ver el análisis completo de esta reunión"
                          aria-label={`Ver análisis de la reunión ${getRecordingTitle(ref.filename)}`}
                        >
                          <Icon name="mic" size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{getRecordingTitle(ref.filename)}</span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {ref.category} · {formatDate(ref.created)}
                              {ref.pending_tasks_count > 0 && (
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                  · {ref.pending_tasks_count} {ref.pending_tasks_count === 1 ? 'tarea pend.' : 'tareas pend.'}
                                </span>
                              )}
                            </span>
                          </div>
                        </button>

                        {hasSnippets && (
                          <div>
                            <button
                              type="button"
                              className="chat-evidence-toggle"
                              onClick={() => toggleSnippets(snippetKey)}
                              aria-expanded={isExpanded}
                              title="Mostrar fragmentos de texto coincidentes"
                            >
                              <Icon name={isExpanded ? 'chevron-down' : 'search'} size={11} />
                              <span>{isExpanded ? 'Ocultar evidencia' : `Ver ${ref.snippets.length} fragmentos`}</span>
                            </button>
                            {isExpanded && (
                              <div className="chat-evidence-box" role="region" aria-label="Fragmentos de evidencia de la transcripción">
                                {ref.snippets.map((snip, sIdx) => (
                                  <div key={sIdx} className="chat-evidence-item">
                                    {snip}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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

      {/* Botón flotante para regresar al final del scroll */}
      {showScrollBottom && (
        <button
          type="button"
          className="chat-scroll-bottom-btn"
          onClick={() => scrollToBottom(true)}
          aria-label="Desplazarse al último mensaje de la conversación"
        >
          <Icon name="chevron-down" size={14} />
          <span>Volver abajo</span>
        </button>
      )}

      {/* Formulario de entrada conversacional accesible */}
      <div style={{ padding: '16px 32px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <ChatInput
          ref={inputRef}
          value={input}
          onChange={setInput}
          onSubmit={() => sendQuestion(input)}
          onCancel={handleCancel}
          isLoading={isLoading}
          disabled={isBackendOffline}
          placeholder="Pregunta algo sobre las reuniones guardadas… (Shift+Enter para nueva línea)"
          ariaLabel="Pregunta sobre tus reuniones"
          submitText="Preguntar"
        />
      </div>

      {/* Modal de Sesiones del Historial */}
      <ChatSessionsModal
        isOpen={showSessionsModal}
        onClose={() => setShowSessionsModal(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        title="Historial de consultas globales"
        emptyMessage="No hay consultas anteriores archivadas en el historial."
      />
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { chatWithMeeting, chatWithMeetingStream } from '../api'
import { useSystem } from '../hooks/useSystem'
import Icon from './Icon'
import MarkdownViewer from './chat/MarkdownViewer'
import ChatInput from './chat/ChatInput'
import ChatEngineBadge from './chat/ChatEngineBadge'
import GroundingBadge from './chat/GroundingBadge'
import ChatSessionsModal from './chat/ChatSessionsModal'

const MEETING_STARTER_QUESTIONS = [
  '¿Cuáles fueron las conclusiones y decisiones clave?',
  '¿Qué compromisos y tareas pendientes quedaron asignados?',
  '¿Qué temas generaron mayor discusión o dudas?'
]

const INITIAL_GREETING = {
  role: 'assistant',
  content: '¡Hola! Puedes hacerme preguntas sobre lo conversado en esta reunión, consultar decisiones tomadas, tareas pendientes o pedirme redacciones basadas en el diálogo.'
}

const getStorageKey = (path) => path ? `meeting_chat_${encodeURIComponent(path)}` : null
const getSessionsKey = (path) => path ? `meeting_chat_sessions_${encodeURIComponent(path)}` : null

const loadSavedMessages = (path) => {
  const key = getStorageKey(path)
  if (!key) return [INITIAL_GREETING]
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return [INITIAL_GREETING]
}

const loadSavedSessions = (path) => {
  const key = getSessionsKey(path)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return []
}

export default function ChatPanel({ audioPath, onNavigate, onSeekAudio }) {
  const { systemStatus, isBackendOffline } = useSystem()
  const [messages, setMessages] = useState(() => loadSavedMessages(audioPath))
  const [sessions, setSessions] = useState(() => loadSavedSessions(audioPath))
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [srAnnouncement, setSrAnnouncement] = useState('')

  const chatContainerRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const userScrolledUpRef = useRef(false)

  // Sincronizar mensajes y sesiones si cambia la reunión seleccionada
  useEffect(() => {
    setMessages(loadSavedMessages(audioPath))
    setSessions(loadSavedSessions(audioPath))
  }, [audioPath])

  // Persistir mensajes en localStorage
  useEffect(() => {
    const key = getStorageKey(audioPath)
    if (!key) return
    try {
      if (messages.length > 1) {
        localStorage.setItem(key, JSON.stringify(messages.slice(-30)))
      }
    } catch {
      // ignore
    }
  }, [messages, audioPath])

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

  // Autoscroll adaptativo inteligente
  useEffect(() => {
    if (!userScrolledUpRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Devolver el foco al campo al terminar cada respuesta
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  const handleContainerScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isUp = distanceFromBottom > 100
    userScrolledUpRef.current = isUp
    setShowScrollBottom(isUp)
  }

  const sendQuestion = async (questionText) => {
    const userQuestion = (questionText || '').trim()
    if (!userQuestion || isLoading || !audioPath || isBackendOffline) return
    setInput('')
    userScrolledUpRef.current = false
    setShowScrollBottom(false)

    // Añadir mensaje del usuario al estado
    const updatedMessages = [...messages, { role: 'user', content: userQuestion }]
    setMessages(updatedMessages)
    setIsLoading(true)
    setSrAnnouncement(`Pregunta enviada sobre la reunión: ${userQuestion}`)

    abortControllerRef.current = new AbortController()

    try {
      // Filtrar mensaje inicial para enviar al backend solo el historial real
      const apiMessages = updatedMessages
        .filter(m => m !== updatedMessages[0])
        .map(m => ({ role: m.role, content: m.content }))
        .slice(0, -1)

      const streamFn = chatWithMeetingStream || ((path, msgs, q, onChunk, opts) =>
        chatWithMeeting(path, msgs, q, opts).then(r => {
          if (r?.data?.response) onChunk?.(r.data.response)
          return r?.data || r
        }))

      const res = await streamFn(
        audioPath,
        apiMessages,
        userQuestion,
        (currentText) => {
          setMessages([
            ...updatedMessages,
            { role: 'assistant', content: currentText }
          ])
        },
        { signal: abortControllerRef.current.signal }
      )

      const responseText = res?.response || res?.data?.response
      const grounding = res?.grounding || res?.data?.grounding || null
      if (responseText) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: responseText, grounding }
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
            failedQuestion: userQuestion
          }
        ])
        setSrAnnouncement('Generación de respuesta detenida.')
      } else {
        console.error('Error al chatear sobre la reunión:', err)
        const errorMsg = err.response?.data?.detail || 'Hubo un error al obtener la respuesta. Verifica tu configuración o si el motor de IA está activo.'
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            isError: true,
            content: errorMsg,
            failedQuestion: userQuestion
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
      console.error('Error al copiar al portapapeles:', err)
    }
  }

  const handleResetChat = () => {
    const hasUserQuestions = messages.some(m => m.role === 'user')
    if (hasUserQuestions) {
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Consulta'
      const title = firstUserMsg.length > 55 ? firstUserMsg.slice(0, 52) + '...' : firstUserMsg
      const newSession = {
        id: `sess_${Date.now()}`,
        title,
        createdAt: Date.now(),
        messages: [...messages]
      }
      const updatedSessions = [newSession, ...sessions.filter(s => s.id !== newSession.id)].slice(0, 15)
      setSessions(updatedSessions)
      const sessKey = getSessionsKey(audioPath)
      if (sessKey) {
        try {
          localStorage.setItem(sessKey, JSON.stringify(updatedSessions))
        } catch {}
      }
    }

    const key = getStorageKey(audioPath)
    if (key) {
      try {
        localStorage.removeItem(key)
      } catch {}
    }
    setMessages([INITIAL_GREETING])
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
    const sessKey = getSessionsKey(audioPath)
    if (sessKey) {
      try {
        localStorage.setItem(sessKey, JSON.stringify(updated))
      } catch {}
    }
    setSrAnnouncement('Sesión archivada eliminada.')
  }

  const showStarters = !messages.some(m => m.role === 'user')

  return (
    <div className="chat-panel" style={{ position: 'relative' }}>
      {/* Región oculta para lectores de pantalla */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* Cabecera del panel de chat con badge del motor, sesiones anteriores y botón de limpieza */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', flexWrap: 'wrap', gap: 8 }}>
        <ChatEngineBadge systemStatus={systemStatus} onNavigate={onNavigate} showOfflineAlert={false} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sessions.length > 0 && (
            <button
              type="button"
              className="chat-action-btn"
              onClick={() => setShowSessionsModal(true)}
              title={`Ver consultas anteriores archivadas (${sessions.length})`}
              aria-label={`Sesiones (${sessions.length})`}
            >
              <Icon name="clock" size={12} />
              <span>Sesiones ({sessions.length})</span>
            </button>
          )}

          {messages.length > 1 && (
            <button
              type="button"
              className="chat-action-btn"
              onClick={handleResetChat}
              title="Nueva consulta: archivar conversación actual"
              aria-label="Nueva consulta: archivar conversación actual"
            >
              <Icon name="refresh" size={12} />
              <span>Nueva consulta</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div
        ref={chatContainerRef}
        onScroll={handleContainerScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversación sobre la reunión"
        className="chat-panel-messages"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            tabIndex={0}
            aria-label={`${msg.role === 'user' ? 'Tu pregunta' : 'Respuesta del asistente'}: ${msg.content.slice(0, 80)}…`}
            className={`chat-panel-msg ${msg.role === 'user' ? 'is-user' : 'is-assistant'} ${msg.isError ? 'is-error' : ''} ${msg.isCancelled ? 'is-cancelled' : ''}`}
            style={{ outline: 'none' }}
          >
            {msg.role === 'assistant' && (
              <div className="chat-panel-msg-label">
                {msg.isError && <Icon name="alert-triangle" size={12} />}
                {msg.isCancelled && <Icon name="stop" size={11} />}
                {msg.isError ? 'No se pudo responder' : msg.isCancelled ? 'Consulta detenida' : 'Asistente IA'}
              </div>
            )}

            <MarkdownViewer
              content={msg.content}
              isUser={msg.role === 'user'}
              onSelectSuggestion={i === messages.length - 1 && !isLoading ? sendQuestion : undefined}
              onSeekAudio={onSeekAudio}
            />

            {/* Indicador de Grounding / Confianza */}
            {msg.role === 'assistant' && !msg.isError && !msg.isCancelled && msg.grounding && (
              <GroundingBadge grounding={msg.grounding} />
            )}

            {/* Acciones del mensaje: copiar */}
            {msg.role === 'assistant' && i !== 0 && !msg.isError && !msg.isCancelled && (
              <div className="chat-msg-actions" style={{ marginTop: '8px', paddingTop: '6px' }}>
                <button
                  type="button"
                  className={`chat-action-btn ${copiedIdx === i ? 'is-success' : ''}`}
                  onClick={() => handleCopy(msg.content, i)}
                  aria-label="Copiar respuesta al portapapeles"
                  title="Copiar respuesta"
                >
                  <Icon name={copiedIdx === i ? 'check' : 'copy'} size={12} />
                  <span>{copiedIdx === i ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {/* Reintento en caso de error o cancelación */}
            {(msg.isError || msg.isCancelled) && (
              <div className="chat-msg-actions" style={{ marginTop: '8px', paddingTop: '6px' }}>
                <button
                  type="button"
                  className="chat-action-btn"
                  onClick={() => handleRetry(msg.failedQuestion)}
                  disabled={isLoading}
                  aria-label="Reintentar esta pregunta"
                  style={{ color: msg.isError ? 'var(--red-record)' : 'var(--text-accent)', borderColor: msg.isError ? 'rgba(248, 113, 113, 0.4)' : 'var(--border-default)' }}
                >
                  <Icon name="refresh" size={12} />
                  <span>Reintentar</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Sugerencias de preguntas iniciales */}
        {showStarters && (
          <div className="chat-suggestions" style={{ marginTop: '4px', maxWidth: '100%' }} role="group" aria-label="Preguntas sugeridas sobre la reunión">
            {MEETING_STARTER_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="chat-suggestion"
                onClick={() => sendQuestion(question)}
                disabled={isLoading || !audioPath || isBackendOffline}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div role="status" className="chat-panel-typing">
            <span className="dot-typing" aria-hidden="true" />
            <span className="chat-panel-typing-text">Analizando la reunión…</span>
          </div>
        )}
      </div>

      {/* Botón flotante para regresar al final del scroll */}
      {showScrollBottom && (
        <button
          type="button"
          className="chat-scroll-bottom-btn"
          onClick={() => scrollToBottom(true)}
          aria-label="Desplazarse al último mensaje"
          style={{ bottom: '80px', right: '20px' }}
        >
          <Icon name="chevron-down" size={13} />
          <span>Abajo</span>
        </button>
      )}

      {/* Input area con ChatInput accesible */}
      <div className="chat-panel-footer">
        <ChatInput
          ref={inputRef}
          value={input}
          onChange={setInput}
          onSubmit={() => sendQuestion(input)}
          onCancel={handleCancel}
          isLoading={isLoading}
          disabled={!audioPath || isBackendOffline}
          placeholder="Pregunta algo sobre la reunión… (Shift+Enter para nueva línea)"
          ariaLabel="Pregunta sobre esta reunión"
          compact={true}
        />
      </div>

      {/* Modal de Sesiones / Consultas Anteriores */}
      <ChatSessionsModal
        isOpen={showSessionsModal}
        onClose={() => setShowSessionsModal(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        title="Consultas de esta reunión"
        emptyMessage="No hay consultas anteriores archivadas para esta grabación."
      />
    </div>
  )
}

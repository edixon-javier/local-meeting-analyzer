import React from 'react'
import Modal from '../Modal'
import Icon from '../Icon'

export default function ChatSessionsModal({
  isOpen,
  onClose,
  sessions = [],
  onSelectSession,
  onDeleteSession,
  title = 'Historial de consultas',
  emptyMessage = 'No hay consultas previas guardadas.'
}) {
  if (!isOpen) return null

  const formatSessionDate = (timestamp) => {
    if (!timestamp) return ''
    try {
      const d = new Date(timestamp)
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  return (
    <Modal
      titleId="chat-sessions-modal-title"
      onClose={onClose}
      maxWidth={520}
    >
      <div className="modal-header" style={{ marginBottom: 12 }}>
        <h3
          id="chat-sessions-modal-title"
          className="modal-title"
          style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 16 }}
        >
          <Icon name="clock" size={18} /> {title}
        </h3>
        <button
          type="button"
          className="btn btn-secondary btn-square"
          onClick={onClose}
          aria-label="Cerrar ventana de consultas"
          style={{ width: 28, height: 28, padding: 0 }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Selecciona una consulta anterior para retomar la conversación o elimínala si ya no la necesitas:
      </p>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ marginBottom: 8, opacity: 0.5 }}>
            <Icon name="chat" size={28} />
          </div>
          {emptyMessage}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
          {sessions.map((sess) => {
            const userMsgCount = (sess.messages || []).filter(m => m.role === 'user').length
            const totalMsgCount = (sess.messages || []).length
            return (
              <div
                key={sess.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 4
                    }}
                    title={sess.title}
                  >
                    {sess.title || 'Consulta sin título'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{formatSessionDate(sess.createdAt || sess.updatedAt)}</span>
                    <span>•</span>
                    <span>{userMsgCount} {userMsgCount === 1 ? 'pregunta' : 'preguntas'} ({totalMsgCount} msgs)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onSelectSession(sess)
                      onClose()
                    }}
                    title="Cargar esta conversación"
                    aria-label={`Retomar consulta: ${sess.title}`}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Retomar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-square"
                    onClick={() => onDeleteSession(sess.id)}
                    title="Eliminar esta consulta archivada"
                    aria-label={`Eliminar consulta: ${sess.title}`}
                    style={{ width: 28, height: 28, padding: 0, color: 'var(--text-muted)' }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          style={{ fontSize: 12 }}
        >
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

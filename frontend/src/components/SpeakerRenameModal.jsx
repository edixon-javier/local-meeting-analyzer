// src/components/SpeakerRenameModal.jsx
// Modal interactivo para renombrar hablantes en toda la reunión

import { useState, useEffect, useRef } from 'react'
import Icon from './Icon'

export default function SpeakerRenameModal({
  isOpen,
  oldSpeaker,
  segmentsCount = 0,
  onConfirm,
  onClose
}) {
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setNewName(oldSpeaker || '')
      setIsSaving(false)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 50)
    }
  }, [isOpen, oldSpeaker])

  if (!isOpen) return null

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldSpeaker) {
      onClose()
      return
    }
    setIsSaving(true)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch {
      setIsSaving(false)
    }
  }

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div 
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="user" size={22} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Renombrar Hablante
          </h3>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
          Asigna el nombre real a <strong>"{oldSpeaker}"</strong>. Se actualizará en los{' '}
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            {segmentsCount} {segmentsCount === 1 ? 'segmento' : 'segmentos'}
          </span>{' '}
          de diálogo, tareas asignadas y en el historial RAG.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Nombre del participante
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Carlos Mendoza, Ana, etc."
              disabled={isSaving}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color var(--transition-fast)'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !newName.trim() || newName.trim() === oldSpeaker}
              style={{ padding: '8px 18px', fontSize: 13 }}
            >
              <Icon name="check" size={14} /> {isSaving ? 'Guardando...' : 'Guardar Nombre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

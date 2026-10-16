// src/components/SpeakerRenameModal.jsx
// Modal interactivo para renombrar hablantes en toda la reunión

import { useState, useEffect, useRef } from 'react'
import Icon from './Icon'
import Modal from './Modal'

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
    <Modal titleId="speaker-rename-title" onClose={onClose} dismissible={!isSaving}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="user" size={20} style={{ color: 'var(--accent-primary-hover)' }} />
          <h3 id="speaker-rename-title" className="modal-title" style={{ margin: 0 }}>
            Renombrar hablante
          </h3>
        </div>

        <p className="modal-text" style={{ marginBottom: 16 }}>
          Asigna el nombre real a <strong>"{oldSpeaker}"</strong>. Se actualizará en los{' '}
          <span style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
            {segmentsCount} {segmentsCount === 1 ? 'segmento' : 'segmentos'}
          </span>{' '}
          de diálogo, tareas asignadas y en el historial RAG.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 4 }}>
            <label htmlFor="speaker-rename-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Nombre del participante
            </label>
            <input
              id="speaker-rename-input"
              ref={inputRef}
              type="text"
              className="modal-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Carlos Mendoza, Ana, etc."
              disabled={isSaving}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !newName.trim() || newName.trim() === oldSpeaker}
              aria-busy={isSaving || undefined}
            >
              <Icon name="check" size={14} /> {isSaving ? 'Guardando…' : 'Guardar nombre'}
            </button>
          </div>
        </form>
    </Modal>
  )
}

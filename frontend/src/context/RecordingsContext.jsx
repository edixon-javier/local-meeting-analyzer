import { useState, useEffect, useCallback, useRef } from 'react'
import { getRecordings, deleteRecording, renameRecording } from '../api'
import { useSystem } from '../hooks/useSystem'
import { RecordingsContext } from './recordingsContextDef'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

export function RecordingsProvider({ children }) {
  const { showToast, isBackendOffline, isStartupComplete } = useSystem()
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isFetchingRef = useRef(false)

  // Estados de modales comunes
  const [deletingFile, setDeletingFile] = useState(null) // filename
  const [renamingFile, setRenamingFile] = useState(null) // { filename }
  const [newNameInput, setNewNameInput] = useState('')
  const [modalBusy, setModalBusy] = useState(false)

  const recordingsRef = useRef(recordings)
  recordingsRef.current = recordings

  const loadRecordings = useCallback(async (options = {}) => {
    if (isBackendOffline || isFetchingRef.current) return
    isFetchingRef.current = true

    const isInitial = recordingsRef.current.length === 0 && !options.silent
    if (isInitial) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const res = await getRecordings()
      const list = res.data.recordings || []
      recordingsRef.current = list
      setRecordings(list)
    } catch (err) {
      console.error('Error cargando grabaciones en contexto:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [isBackendOffline])

  const confirmDelete = async () => {
    if (!deletingFile || modalBusy) return
    setModalBusy(true)
    try {
      await deleteRecording(deletingFile)
      showToast({ type: 'success', message: 'Grabación eliminada correctamente' })
      setDeletingFile(null)
      loadRecordings()
    } catch {
      showToast({ type: 'error', message: 'Error al eliminar la grabación' })
    } finally {
      setModalBusy(false)
    }
  }

  const confirmRename = async () => {
    if (!renamingFile || !newNameInput.trim() || modalBusy) return
    setModalBusy(true)
    try {
      await renameRecording(renamingFile.filename, newNameInput.trim())
      showToast({ type: 'success', message: 'Grabación renombrada correctamente' })
      setRenamingFile(null)
      setNewNameInput('')
      loadRecordings()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al renombrar la grabación'
      showToast({ type: 'error', message: msg })
    } finally {
      setModalBusy(false)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '—'
    return new Date(timestamp * 1000).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Cargar grabaciones únicamente cuando el arranque esté completo y haya conectividad
  useEffect(() => {
    if (isStartupComplete && !isBackendOffline) {
      loadRecordings()
    } else if (isBackendOffline) {
      setRecordings([])
    }
  }, [isStartupComplete, isBackendOffline, loadRecordings])

  const value = {
    recordings,
    loading,
    isRefreshing,
    loadRecordings,
    deletingFile,
    setDeletingFile,
    renamingFile,
    setRenamingFile,
    newNameInput,
    setNewNameInput,
    confirmDelete,
    confirmRename,
    formatDate
  }

  return (
    <RecordingsContext.Provider value={value}>
      {children}

      {/* Modal de Eliminación Centralizado */}
      {deletingFile && (
        <Modal
          titleId="delete-recording-title"
          describedBy="delete-recording-desc"
          onClose={() => setDeletingFile(null)}
          dismissible={!modalBusy}
          maxWidth={400}
        >
          <h3 id="delete-recording-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="trash" size={18} style={{ color: 'var(--red-record)' }} />
            ¿Eliminar grabación?
          </h3>
          <p id="delete-recording-desc" className="modal-text">
            Esta acción eliminará de forma permanente <strong>{deletingFile}</strong> y su análisis. No se puede deshacer.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDeletingFile(null)} disabled={modalBusy}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger-solid" onClick={confirmDelete} disabled={modalBusy} aria-busy={modalBusy || undefined}>
              {modalBusy ? <><span className="spinner-small on-accent" style={{ width: 13, height: 13 }} aria-hidden="true" /> Eliminando…</> : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Renombrado Centralizado */}
      {renamingFile && (() => {
        const currentName = renamingFile.filename.replace(/.[^/.]+$/, '')
        const trimmed = newNameInput.trim()
        const canSave = Boolean(trimmed) && trimmed !== currentName && !modalBusy
        return (
          <Modal
            titleId="rename-recording-title"
            onClose={() => setRenamingFile(null)}
            dismissible={!modalBusy}
            maxWidth={400}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (canSave) confirmRename()
              }}
            >
              <h3 id="rename-recording-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="edit" size={18} style={{ color: 'var(--accent-primary-hover)' }} />
                Renombrar grabación
              </h3>
              <label htmlFor="rename-recording-input" className="sr-only">Nuevo nombre</label>
              <input
                id="rename-recording-input"
                type="text"
                className="modal-input"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Ej: Reunion_Diaria"
                autoFocus
                disabled={modalBusy}
                style={{ marginTop: 12 }}
              />
              <span className="form-hint">Pulsa Enter para guardar o Esc para cancelar.</span>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRenamingFile(null)} disabled={modalBusy}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!canSave} aria-busy={modalBusy || undefined}>
                  {modalBusy ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </Modal>
        )
      })()}
    </RecordingsContext.Provider>
  )
}

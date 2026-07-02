import { createContext, useContext, useState, useEffect } from 'react'
import { getRecordings, deleteRecording, renameRecording } from '../api'
import { useSystem } from './SystemContext'

const RecordingsContext = createContext()

export function RecordingsProvider({ children }) {
  const { showToast, isBackendOffline } = useSystem()
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(false)

  // Estados de modales comunes
  const [deletingFile, setDeletingFile] = useState(null) // filename
  const [renamingFile, setRenamingFile] = useState(null) // { filename }
  const [newNameInput, setNewNameInput] = useState('')

  const loadRecordings = async () => {
    if (isBackendOffline) return
    setLoading(true)
    try {
      const res = await getRecordings()
      setRecordings(res.data.recordings || [])
    } catch (err) {
      console.error('Error cargando grabaciones en contexto:', err)
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingFile) return
    try {
      await deleteRecording(deletingFile)
      showToast({ type: 'success', message: 'Grabación eliminada correctamente' })
      setDeletingFile(null)
      loadRecordings()
    } catch (err) {
      showToast({ type: 'error', message: 'Error al eliminar la grabación' })
    }
  }

  const confirmRename = async () => {
    if (!renamingFile || !newNameInput.trim()) return
    try {
      await renameRecording(renamingFile.filename, newNameInput.trim())
      showToast({ type: 'success', message: 'Grabación renombrada correctamente' })
      setRenamingFile(null)
      setNewNameInput('')
      loadRecordings()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al renombrar la grabación'
      showToast({ type: 'error', message: msg })
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

  // Cargar grabaciones al montar o cuando cambie la conectividad
  useEffect(() => {
    if (!isBackendOffline) {
      loadRecordings()
    } else {
      setRecordings([])
    }
  }, [isBackendOffline])

  const value = {
    recordings,
    loading,
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 400, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>¿Eliminar grabación?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Esta acción eliminará de forma permanente <strong>{deletingFile}</strong>. No se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setDeletingFile(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--red-record)', borderColor: 'var(--red-record)' }} onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Renombrado Centralizado */}
      {renamingFile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 400, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Renombrar grabación</h3>
            <input 
              type="text" 
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="Ej: Reunion_Diaria"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 14,
                marginBottom: 24,
                marginTop: 12
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setRenamingFile(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmRename}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </RecordingsContext.Provider>
  )
}

export function useRecordings() {
  const context = useContext(RecordingsContext)
  if (!context) {
    throw new Error('useRecordings debe usarse dentro de un RecordingsProvider')
  }
  return context
}

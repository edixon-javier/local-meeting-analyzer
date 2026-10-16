// frontend/src/components/dictation/DictationHistoryScreen.jsx
// Pantalla de administración y auditoría de notas de voz y dictados.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  getDictationHistory,
  getDictationAudioUrl,
  deleteDictation,
  reinjectDictation,
} from '../../api'
import { useSystem } from '../../hooks/useSystem'
import Icon from '../Icon'
import '../../styles/dictation.css'

export default function DictationHistoryScreen({ onNavigate }) {
  const { showToast } = useSystem()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'smart_polish' | 'literal'
  const [activeTabs, setActiveTabs] = useState({}) // { [id]: 'polished' | 'raw' }
  const [playingId, setPlayingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const audioRef = useRef(null)
  const copyTimeoutRef = useRef(null)

  // Limpieza al desmontar la pantalla para no dejar audios sonando ni timers huérfanos
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const loadHistory = useCallback(async (searchQuery = '') => {
    try {
      setLoading(true)
      const res = await getDictationHistory({ limit: 100, search: searchQuery })
      setItems(res.data || [])
    } catch (err) {
      console.error('Error cargando historial de dictados:', err)
      showToast({ type: 'error', message: 'No se pudo cargar el historial de dictados' })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadHistory(search)
  }, [loadHistory, search])

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro y su grabación de voz?')) return
    try {
      await deleteDictation(id)
      setItems(prev => prev.filter(item => item.id !== id))
      if (playingId === id && audioRef.current) {
        audioRef.current.pause()
        setPlayingId(null)
      }
      showToast({ type: 'info', message: 'Dictado eliminado' })
    } catch (err) {
      console.error('Error al eliminar dictado:', err)
      showToast({ type: 'error', message: 'No se pudo eliminar el dictado' })
    }
  }

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000)
      showToast({ type: 'success', message: 'Texto copiado al portapapeles' })
    } catch {
      showToast({ type: 'error', message: 'No se pudo copiar el texto' })
    }
  }

  const handleReinject = async (id) => {
    try {
      showToast({ type: 'info', message: 'Preparando texto para inyección...' })
      const res = await reinjectDictation(id)
      if (res.data?.injected) {
        showToast({ type: 'success', message: '¡Texto re-inyectado en el cursor!' })
      } else {
        showToast({
          type: 'info',
          message: res.data?.message || 'Texto copiado al portapapeles. Ve a tu aplicación y presiona Ctrl+V.',
        })
      }
    } catch (err) {
      console.error('Error re-inyectando dictado:', err)
      showToast({ type: 'error', message: 'Error al re-inyectar en cursor' })
    }
  }

  const handlePlayAudio = (id, audioFile) => {
    if (!audioFile) return
    const url = getDictationAudioUrl(audioFile)

    if (playingId === id && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play()
      } else {
        audioRef.current.pause()
        setPlayingId(null)
      }
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingId(id)

    audio.play().catch(e => {
      console.error('Error reproduciendo audio:', e)
      setPlayingId(null)
    })

    audio.onended = () => {
      setPlayingId(null)
    }
  }

  const filteredItems = items.filter(item => {
    if (filterMode === 'smart_polish') return item.mode === 'smart_polish'
    if (filterMode === 'literal') return item.mode === 'literal'
    return true
  })

  const formatDate = (iso) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="dictation-screen">
      {/* Cabecera */}
      <div className="dictation-header">
        <div className="dictation-title-group">
          <h1>
            <Icon name="edit" size={24} style={{ color: 'var(--accent-primary)' }} />
            Notas de Voz y Dictados en Cursor
          </h1>
          <p className="dictation-subtitle">
            Auditoría de ideas transmitidas por voz con inyección directa en el cursor de tus aplicaciones.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="shortcut-chip" title="Atajo global para iniciar/detener dictado">
            <Icon name="zap" size={13} />
            Ctrl + Shift + D
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadHistory(search)}
            title="Recargar historial"
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="dictation-controls-bar">
        <div className="dictation-search-box">
          <span className="dictation-search-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            className="dictation-search-input"
            placeholder="Buscar por texto, aplicación (ej. Code.exe) o fecha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="btn btn-secondary btn-square btn-sm"
              style={{ position: 'absolute', right: 8 }}
              onClick={() => setSearch('')}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('all')}
          >
            Todos ({items.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'smart_polish' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('smart_polish')}
          >
            ✨ Ideas Claras
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'literal' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('literal')}
          >
            📝 Literal
          </button>
        </div>
      </div>

      {/* Lista de dictados */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="pill-spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="dictation-empty">
          <div className="dictation-empty-icon">
            <Icon name="mic" size={56} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            {search ? 'No se encontraron dictados con esa búsqueda' : 'Aún no hay dictados registrados'}
          </h3>
          <p style={{ margin: '0 0 16px 0', maxWidth: 440, fontSize: 13 }}>
            Coloca el cursor en cualquier aplicación (VS Code, Word, Chrome, Bloc de Notas) y presiona{' '}
            <strong style={{ color: 'var(--accent-primary-hover)' }}>Ctrl + Alt + Espacio</strong> para comenzar a hablar.
          </p>
          {onNavigate && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('settings')}
            >
              <Icon name="settings" size={14} />
              Configurar Clave Groq y Ajustes de Dictado
            </button>
          )}
        </div>
      ) : (
        <div className="dictation-list">
          {filteredItems.map((item) => {
            const currentTab = activeTabs[item.id] || (item.mode === 'smart_polish' ? 'polished' : 'raw')
            const textToDisplay = currentTab === 'raw' ? item.raw_transcript : (item.polished_transcript || item.raw_transcript)
            const targetApp = item.target_app || {}
            const metrics = item.metrics || {}

            return (
              <div key={item.id} className="dictation-card">
                {/* Metadatos superiores */}
                <div className="dictation-card-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="dictation-app-badge" title={targetApp.title || 'Aplicación'}>
                      <Icon name="target" size={12} />
                      {targetApp.exe_name || 'Desconocido'}
                    </span>
                    {targetApp.title && targetApp.title !== 'Sin título' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={targetApp.title}>
                        {targetApp.title}
                      </span>
                    )}
                    <span className="dictation-time-badge">
                      {formatDate(item.timestamp)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      • {item.duration_seconds}s
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.provider && (
                      <span className="dictation-metric-badge" title="Proveedor STT">
                        {item.provider.toUpperCase()}
                      </span>
                    )}
                    {metrics.total_latency_ms > 0 && (
                      <span className="dictation-metric-badge" title="Latencia total de procesamiento">
                        <Icon name="zap" size={11} />
                        {Math.round(metrics.total_latency_ms)}ms
                      </span>
                    )}
                  </div>
                </div>

                {/* Pestañas de texto (si fue pulido) */}
                {item.mode === 'smart_polish' && item.raw_transcript && item.polished_transcript && (
                  <div className="dictation-tabs">
                    <button
                      type="button"
                      className={`dictation-tab-btn ${currentTab === 'polished' ? 'active' : ''}`}
                      onClick={() => setActiveTabs(prev => ({ ...prev, [item.id]: 'polished' }))}
                    >
                      ✨ Ideas Claras (Inyectado)
                    </button>
                    <button
                      type="button"
                      className={`dictation-tab-btn ${currentTab === 'raw' ? 'active' : ''}`}
                      onClick={() => setActiveTabs(prev => ({ ...prev, [item.id]: 'raw' }))}
                    >
                      🎙️ Original ({item.raw_transcript.split(/\s+/).length} palabras)
                    </button>
                  </div>
                )}

                {/* Cuerpo del texto */}
                <div className="dictation-body">
                  {textToDisplay}
                </div>

                {/* Acciones y reproductor de audio */}
                <div className="dictation-actions">
                  <div className="dictation-audio-player">
                    {item.audio_file ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePlayAudio(item.id, item.audio_file)}
                        title={playingId === item.id ? 'Pausar audio' : 'Escuchar dictado'}
                      >
                        <Icon name={playingId === item.id ? 'pause' : 'play'} size={14} />
                        {playingId === item.id ? 'Pausar' : 'Escuchar Voz'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin audio</span>
                    )}
                  </div>

                  <div className="dictation-btn-group">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(item.id, textToDisplay)}
                      title="Copiar texto al portapapeles"
                    >
                      <Icon name={copiedId === item.id ? 'check' : 'copy'} size={13} />
                      {copiedId === item.id ? 'Copiado' : 'Copiar'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleReinject(item.id)}
                      title="Re-inyectar este texto en la aplicación donde tengas el cursor"
                    >
                      <Icon name="send" size={13} />
                      Re-inyectar
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger btn-square btn-sm"
                      onClick={() => handleDelete(item.id)}
                      title="Eliminar registro"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

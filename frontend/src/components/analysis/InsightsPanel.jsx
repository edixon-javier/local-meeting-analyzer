import React, { useState, useRef, useEffect } from 'react'
import Icon from '../Icon'
import { downloadMeetingTasks } from '../../utils/tasksExport'

export default function InsightsPanel({ 
  analysis, 
  bookmarks = [], 
  onSeekAudio, 
  onToggleTask,
  meetingTitle = 'Reunión',
  filename = null,
  audioPath = null,
  showToast = null
}) {
  const [taskFilter, setTaskFilter] = useState('all') // 'all' | 'pending' | 'completed'
  const [copiedTasks, setCopiedTasks] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

  // Cerrar menú de exportación al hacer clic fuera
  useEffect(() => {
    if (!exportMenuOpen) return
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [exportMenuOpen])

  if (!analysis) {
    return (
      <div className="empty-state insights-empty">
        <div className="empty-state-icon">
          <Icon name="search" size={40} />
        </div>
        <div className="empty-state-title">Sin análisis</div>
        <div className="empty-state-sub">El análisis no está disponible.</div>
      </div>
    )
  }

  const rawTasks = (analysis.action_items || []).map((t) => {
    if (typeof t === 'string') {
      return { task: t, completed: false, assignee: 'Sin asignar', deadline: 'Sin fecha' }
    }
    if (t && typeof t === 'object') {
      return {
        task: t.task || '',
        completed: Boolean(t.completed),
        assignee: t.assignee || 'Sin asignar',
        deadline: t.deadline || 'Sin fecha'
      }
    }
    return { task: String(t || ''), completed: false, assignee: 'Sin asignar', deadline: 'Sin fecha' }
  })
  const totalTasks = rawTasks.length
  const completedTasks = rawTasks.filter(t => Boolean(t.completed)).length
  const pendingTasks = totalTasks - completedTasks
  const percentDone = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Filtrado de tareas
  const filteredTasks = rawTasks.map((task, originalIndex) => ({
    ...task,
    originalIndex
  })).filter(item => {
    if (taskFilter === 'pending') return !item.completed
    if (taskFilter === 'completed') return Boolean(item.completed)
    return true
  })

  // Copiar tareas al portapapeles en formato Markdown checklist
  const handleCopyTaskChecklist = async () => {
    if (totalTasks === 0) return
    let md = `### ✅ Tareas y Compromisos: ${meetingTitle}\n`
    md += `*Progreso: ${completedTasks}/${totalTasks} completadas (${percentDone}%)*\n\n`
    rawTasks.forEach(t => {
      const box = t.completed ? '[x]' : '[ ]'
      const assigneeStr = t.assignee && t.assignee !== 'Sin asignar' ? ` (@${t.assignee})` : ''
      const deadlineStr = t.deadline && t.deadline !== 'Sin fecha' ? ` [Fecha: ${t.deadline}]` : ''
      md += `- ${box} ${t.task}${assigneeStr}${deadlineStr}\n`
    })

    try {
      await navigator.clipboard.writeText(md)
      setCopiedTasks(true)
      setTimeout(() => setCopiedTasks(false), 2000)
    } catch (err) {
      console.error('Error al copiar tareas:', err)
    }
  }

  // Exportar compromisos en formato calendario (.ics) o tabla (.csv)
  const handleExportTasks = async (format) => {
    if (totalTasks === 0) return
    const safeFilename = filename || (audioPath ? audioPath.split(/[/\\]/).pop() : null)
    const exportTasksList = taskFilter === 'all' ? rawTasks : filteredTasks
    await downloadMeetingTasks(safeFilename, format, exportTasksList, meetingTitle, showToast, {
      status: taskFilter
    })
  }

  return (
    <div className="insights-scroll">
      {/* Tono + Categoría */}
      <div className="insight-card">
        <div className="insight-card-header">
          <Icon name="target" size={15} />
          Tono & Categoría
        </div>
        <div className="insights-chips">
          <span className="pill tone">{analysis.tone || 'Desconocido'}</span>
          <span className="pill category">{analysis.category || 'Sin categoría'}</span>
        </div>
      </div>

      {/* Resumen 3 puntos */}
      <div className="insight-card">
        <div className="insight-card-header">
          <Icon name="file-text" size={15} />
          Resumen Ejecutivo
        </div>
        {analysis.summary?.length > 0 ? (
          <ul className="summary-list">
            {analysis.summary.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="insights-muted">Sin puntos clave</p>
        )}
      </div>

      {/* Momentos Clave Marcados (Live Bookmarking) */}
      {bookmarks && bookmarks.length > 0 && (
        <div className="insight-card insights-bookmarks-card">
          <div className="insight-card-header insights-bookmarks-header">
            <Icon name="bookmark" size={15} />
            Momentos Clave Marcados ({bookmarks.length})
          </div>
          <div className="insights-bookmark-list">
            {bookmarks.map((bm, i) => {
              const mins = Math.floor(bm.time / 60)
              const secs = Math.floor(bm.time % 60)
              const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
              return (
                <div
                  key={bm.id || i}
                  className={`insights-bookmark-row ${onSeekAudio ? 'is-clickable' : ''}`}
                  onClick={() => onSeekAudio?.(bm.time)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSeekAudio?.(bm.time)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Reproducir momento clave ${timeStr}${bm.note ? ': ' + bm.note : ''}`}
                  title={onSeekAudio ? 'Haz clic para escuchar este momento' : undefined}
                >
                  <div className="insights-bookmark-main">
                    <span className="insights-bookmark-time">
                      {timeStr}
                    </span>
                    <span className="insights-bookmark-note">
                      {bm.note || 'Momento clave marcado'}
                    </span>
                  </div>
                  {onSeekAudio && (
                    <Icon name="play" size={13} className="insights-bookmark-play" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tareas y Compromisos Interactivos con Seguimiento de Estado */}
      <div className="insight-card action-items-card">
        <div className="insights-tasks-head">
          <div className="insight-card-header insights-tasks-title">
            <Icon name="check-circle" size={15} />
            Tareas y Compromisos ({totalTasks})
          </div>

          {totalTasks > 0 && (
            <span className={`insights-progress-badge ${percentDone === 100 ? 'is-complete' : ''}`}>
              {completedTasks}/{totalTasks} ({percentDone}%)
            </span>
          )}
        </div>

        {/* Barra visual de progreso */}
        {totalTasks > 0 && (
          <div className="insights-progress-track">
            <div
              className={`insights-progress-fill ${percentDone === 100 ? 'is-complete' : ''}`}
              style={{ width: `${percentDone}%` }}
            />
          </div>
        )}

        {/* Barra de herramientas y filtros de compromisos */}
        {totalTasks > 0 && (
          <div className="insights-tasks-toolbar">
            {/* Filtros de estado: solo cuando hay más de 1 tarea para evitar saturación visual */}
            {totalTasks > 1 ? (
              <div className="insights-filters" role="group" aria-label="Filtrar compromisos por estado">
                <button
                  type="button"
                  className={`insights-filter-btn ${taskFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setTaskFilter('all')}
                  aria-pressed={taskFilter === 'all'}
                >
                  Todas ({totalTasks})
                </button>
                <button
                  type="button"
                  className={`insights-filter-btn ${taskFilter === 'pending' ? 'is-active' : ''}`}
                  onClick={() => setTaskFilter('pending')}
                  aria-pressed={taskFilter === 'pending'}
                >
                  Pendientes ({pendingTasks})
                </button>
                <button
                  type="button"
                  className={`insights-filter-btn ${taskFilter === 'completed' ? 'is-active' : ''}`}
                  onClick={() => setTaskFilter('completed')}
                  aria-pressed={taskFilter === 'completed'}
                >
                  Completadas ({completedTasks})
                </button>
              </div>
            ) : <div />}

            {/* Acciones de exportación de compromisos */}
            <div className="insights-tasks-actions">
              <button
                type="button"
                className={`btn btn-secondary btn-sm insights-copy-btn ${copiedTasks ? 'is-copied' : ''}`}
                onClick={handleCopyTaskChecklist}
                title="Copiar lista de tareas en Markdown con checkboxes"
                aria-label="Copiar checklist de tareas"
              >
                <Icon name={copiedTasks ? 'check-circle' : 'copy'} size={12} />
                <span>{copiedTasks ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <div className="insights-export-dropdown" ref={exportMenuRef}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm insights-action-btn"
                  onClick={() => setExportMenuOpen(prev => !prev)}
                  title="Descargar compromisos en formato texto, calendario o Excel"
                  aria-expanded={exportMenuOpen}
                  aria-haspopup="true"
                  aria-label="Descargar compromisos"
                >
                  <Icon name="download" size={12} />
                  <span>Descargar</span>
                  <Icon name="chevron-down" size={10} />
                </button>

                {exportMenuOpen && (
                  <div className="insights-dropdown-menu" role="menu">
                    <button
                      type="button"
                      className="insights-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportTasks('txt')
                      }}
                      aria-label="Exportar compromisos a Texto (.txt)"
                    >
                      <Icon name="file-text" size={13} />
                      <div className="insights-dropdown-item-text">
                        <span className="insights-dropdown-label">Lista de tareas (.txt)</span>
                        <span className="insights-dropdown-desc">Checklist universal en texto</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="insights-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportTasks('ics')
                      }}
                      aria-label="Exportar compromisos a iCalendar (.ics)"
                    >
                      <Icon name="calendar" size={13} />
                      <div className="insights-dropdown-item-text">
                        <span className="insights-dropdown-label">Calendario (.ics)</span>
                        <span className="insights-dropdown-desc">Google Calendar / Outlook</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="insights-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportTasks('csv')
                      }}
                      aria-label="Exportar compromisos a CSV (.csv)"
                    >
                      <Icon name="download" size={13} />
                      <div className="insights-dropdown-item-text">
                        <span className="insights-dropdown-label">Hoja de cálculo (.csv)</span>
                        <span className="insights-dropdown-desc">Excel / Google Sheets</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de tareas */}
        {totalTasks > 0 ? (
          filteredTasks.length > 0 ? (
            <div className="insights-task-list">
              {filteredTasks.map((item) => {
                const isCompleted = Boolean(item.completed)
                return (
                  <div
                    key={item.originalIndex}
                    className={`task-item insights-task ${isCompleted ? 'task-completed' : ''}`}
                  >
                    {/* Checkbox Interactivo */}
                    <button
                      type="button"
                      className={`insights-task-checkbox ${isCompleted ? 'is-checked' : ''}`}
                      onClick={() => onToggleTask?.(item.originalIndex, !isCompleted)}
                      disabled={!onToggleTask}
                      role="checkbox"
                      aria-checked={isCompleted}
                      aria-label={`Tarea completada: ${item.task || ''}`}
                      title={isCompleted ? 'Clic para desmarcar' : 'Clic para marcar como completada'}
                    >
                      {isCompleted && (
                        <Icon name="check" size={13} strokeWidth={3} />
                      )}
                    </button>

                    <div className="insights-task-body">
                      <div
                        className={`insights-task-text ${onToggleTask ? 'is-clickable' : ''} ${isCompleted ? 'is-completed' : ''}`}
                        onClick={() => onToggleTask?.(item.originalIndex, !isCompleted)}
                      >
                        {item.task}
                      </div>

                      <div className="task-item-meta insights-task-meta">
                        {item.assignee !== 'Sin asignar' && (
                          <span className="task-badge insights-task-badge">
                            <Icon name="user" size={11} /> {item.assignee}
                          </span>
                        )}
                        {item.deadline !== 'Sin fecha' && (
                          <span className="task-badge insights-task-badge">
                            <Icon name="calendar" size={11} /> {item.deadline}
                          </span>
                        )}
                        {item.assignee === 'Sin asignar' && item.deadline === 'Sin fecha' && (
                          <span className="task-badge insights-task-badge is-unassigned">
                            Sin asignar
                          </span>
                        )}
                        {isCompleted && (
                          <span className="insights-task-done-pill">
                            <Icon name="check-circle" size={10} /> Completada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="insights-muted is-centered">
              No hay tareas en el filtro "{taskFilter === 'pending' ? 'Pendientes' : 'Completadas'}".
            </p>
          )
        ) : (
          <p className="insights-muted">No se identificaron tareas pendientes</p>
        )}
      </div>

      {/* Decisiones clave */}
      {analysis.key_decisions?.length > 0 && (
        <div className="insight-card">
          <div className="insight-card-header">
            <Icon name="target" size={15} />
            Decisiones Clave
          </div>
          <ul className="summary-list">
            {analysis.key_decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Insight de duración */}
      {analysis.duration_insight && (
        <div className="insight-card">
          <div className="insight-card-header">
            <Icon name="lightbulb" size={15} />
            Observación
          </div>
          <p className="insights-note">
            {analysis.duration_insight}
          </p>
        </div>
      )}
    </div>
  )
}

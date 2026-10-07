import React, { useState } from 'react'
import Icon from '../Icon'

export default function InsightsPanel({ 
  analysis, 
  bookmarks = [], 
  onSeekAudio, 
  onToggleTask,
  meetingTitle = 'Reunión'
}) {
  const [taskFilter, setTaskFilter] = useState('all') // 'all' | 'pending' | 'completed'
  const [copiedTasks, setCopiedTasks] = useState(false)

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

  const rawTasks = analysis.action_items || []
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
            <div className="insights-tasks-tools">
              {/* Badge de Progreso */}
              <span className={`insights-progress-badge ${percentDone === 100 ? 'is-complete' : ''}`}>
                {completedTasks}/{totalTasks} ({percentDone}%)
              </span>

              {/* Botón Copiar Checklist */}
              <button
                type="button"
                className={`btn btn-secondary btn-sm insights-copy-btn ${copiedTasks ? 'is-copied' : ''}`}
                onClick={handleCopyTaskChecklist}
                title="Copiar lista de tareas en formato Markdown con checkboxes para Slack, Notion o Trello"
              >
                <Icon name={copiedTasks ? 'check-circle' : 'copy'} size={12} />
                <span>{copiedTasks ? '¡Copiadas!' : 'Copiar Checklist'}</span>
              </button>
            </div>
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

        {/* Filtros de estado de tareas */}
        {totalTasks > 1 && (
          <div className="insights-filters">
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

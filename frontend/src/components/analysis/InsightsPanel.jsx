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
      <div className="empty-state" style={{ marginTop: '40px' }}>
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
    <div style={{ overflowY: 'auto', padding: '16px', height: '100%' }}>
      {/* Tono + Categoría */}
      <div className="insight-card">
        <div className="insight-card-header">
          <Icon name="target" size={15} />
          Tono & Categoría
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin puntos clave</p>
        )}
      </div>

      {/* Momentos Clave Marcados (Live Bookmarking) */}
      {bookmarks && bookmarks.length > 0 && (
        <div className="insight-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
          <div className="insight-card-header" style={{ color: '#F59E0B' }}>
            <Icon name="bookmark" size={15} />
            Momentos Clave Marcados ({bookmarks.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {bookmarks.map((bm, i) => {
              const mins = Math.floor(bm.time / 60)
              const secs = Math.floor(bm.time % 60)
              const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
              return (
                <div
                  key={bm.id || i}
                  onClick={() => onSeekAudio?.(bm.time)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    cursor: onSeekAudio ? 'pointer' : 'default',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (onSeekAudio) {
                      e.currentTarget.style.borderColor = '#F59E0B'
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onSeekAudio) {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      e.currentTarget.style.background = 'var(--bg-elevated)'
                    }
                  }}
                  title={onSeekAudio ? 'Haz clic para escuchar este momento' : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#F59E0B',
                      background: 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {timeStr}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {bm.note || 'Momento clave marcado'}
                    </span>
                  </div>
                  {onSeekAudio && (
                    <Icon name="play" size={13} style={{ color: '#F59E0B', opacity: 0.8 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tareas y Compromisos Interactivos con Seguimiento de Estado */}
      <div className="insight-card action-items-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div className="insight-card-header" style={{ margin: 0 }}>
            <Icon name="check-circle" size={15} />
            Tareas y Compromisos ({totalTasks})
          </div>

          {totalTasks > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Badge de Progreso */}
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: percentDone === 100 ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-elevated)',
                color: percentDone === 100 ? '#10B981' : 'var(--text-secondary)',
                border: `1px solid ${percentDone === 100 ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`
              }}>
                {completedTasks}/{totalTasks} ({percentDone}%)
              </span>

              {/* Botón Copiar Checklist */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyTaskChecklist}
                title="Copiar lista de tareas en formato Markdown con checkboxes para Slack, Notion o Trello"
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: copiedTasks ? 'rgba(16, 185, 129, 0.2)' : undefined,
                  borderColor: copiedTasks ? '#10B981' : undefined,
                  color: copiedTasks ? '#10B981' : undefined
                }}
              >
                <Icon name={copiedTasks ? 'check-circle' : 'copy'} size={12} />
                <span>{copiedTasks ? '¡Copiadas!' : 'Copiar Checklist'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra visual de progreso */}
        {totalTasks > 0 && (
          <div style={{
            height: 4,
            background: 'var(--bg-elevated)',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 14
          }}>
            <div style={{
              height: '100%',
              width: `${percentDone}%`,
              background: percentDone === 100 ? '#10B981' : 'var(--accent-primary)',
              borderRadius: 2,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        )}

        {/* Filtros de estado de tareas */}
        {totalTasks > 1 && (
          <div style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={() => setTaskFilter('all')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: taskFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                color: taskFilter === 'all' ? '#FFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Todas ({totalTasks})
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter('pending')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: taskFilter === 'pending' ? 'var(--accent-primary)' : 'transparent',
                color: taskFilter === 'pending' ? '#FFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Pendientes ({pendingTasks})
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter('completed')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: taskFilter === 'completed' ? 'var(--accent-primary)' : 'transparent',
                color: taskFilter === 'completed' ? '#FFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Completadas ({completedTasks})
            </button>
          </div>
        )}

        {/* Lista de tareas */}
        {totalTasks > 0 ? (
          filteredTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTasks.map((item) => {
                const isCompleted = Boolean(item.completed)
                return (
                  <div 
                    key={item.originalIndex} 
                    className={`task-item ${isCompleted ? 'task-completed' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      background: isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-elevated)',
                      border: isCompleted ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Checkbox Interactivo */}
                    <button
                      type="button"
                      onClick={() => onToggleTask?.(item.originalIndex, !isCompleted)}
                      disabled={!onToggleTask}
                      aria-label={isCompleted ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'}
                      style={{
                        background: isCompleted ? '#10B981' : 'var(--bg-surface)',
                        border: isCompleted ? '2px solid #10B981' : '2px solid var(--border-default)',
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: onToggleTask ? 'pointer' : 'default',
                        padding: 0,
                        marginTop: 2,
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                      title={isCompleted ? 'Clic para desmarcar' : 'Clic para marcar como completada'}
                    >
                      {isCompleted && (
                        <Icon name="check" size={13} style={{ color: '#FFFFFF', strokeWidth: 3 }} />
                      )}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        onClick={() => onToggleTask?.(item.originalIndex, !isCompleted)}
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          cursor: onToggleTask ? 'pointer' : 'default',
                          lineHeight: 1.4,
                          marginBottom: 6,
                          userSelect: 'none'
                        }}
                      >
                        {item.task}
                      </div>

                      <div className="task-item-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.assignee !== 'Sin asignar' && (
                          <span className="task-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <Icon name="user" size={11} /> {item.assignee}
                          </span>
                        )}
                        {item.deadline !== 'Sin fecha' && (
                          <span className="task-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <Icon name="calendar" size={11} /> {item.deadline}
                          </span>
                        )}
                        {item.assignee === 'Sin asignar' && item.deadline === 'Sin fecha' && (
                          <span className="task-badge" style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--text-muted)', fontSize: 11 }}>
                            Sin asignar
                          </span>
                        )}
                        {isCompleted && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#10B981',
                            background: 'rgba(16, 185, 129, 0.12)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)'
                          }}>
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
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              No hay tareas en el filtro "{taskFilter === 'pending' ? 'Pendientes' : 'Completadas'}".
            </p>
          )
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No se identificaron tareas pendientes</p>
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
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {analysis.duration_insight}
          </p>
        </div>
      )}
    </div>
  )
}

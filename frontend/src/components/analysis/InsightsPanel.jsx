import React from 'react'

export default function InsightsPanel({ analysis }) {
  if (!analysis) {
    return (
      <div className="empty-state" style={{ marginTop: '40px' }}>
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Sin análisis</div>
        <div className="empty-state-sub">El análisis no está disponible.</div>
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', padding: '16px', height: '100%' }}>
      {/* Tono + Categoría */}
      <div className="insight-card">
        <div className="insight-card-header">
          <span className="card-icon">🎭</span>
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
          <span className="card-icon">📋</span>
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

      {/* Tareas pendientes */}
      <div className="insight-card">
        <div className="insight-card-header">
          <span className="card-icon">✅</span>
          Tareas Pendientes ({analysis.action_items?.length || 0})
        </div>
        {analysis.action_items?.length > 0 ? (
          analysis.action_items.map((item, i) => (
            <div key={i} className="task-item">
              <div className="task-item-text">{item.task}</div>
              <div className="task-item-meta">
                {item.assignee !== 'Sin asignar' && (
                  <span className="task-badge">👤 {item.assignee}</span>
                )}
                {item.deadline !== 'Sin fecha' && (
                  <span className="task-badge">📅 {item.deadline}</span>
                )}
                {item.assignee === 'Sin asignar' && item.deadline === 'Sin fecha' && (
                  <span className="task-badge" style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--text-muted)' }}>Sin asignar</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No se identificaron tareas pendientes</p>
        )}
      </div>

      {/* Decisiones clave */}
      {analysis.key_decisions?.length > 0 && (
        <div className="insight-card">
          <div className="insight-card-header">
            <span className="card-icon">🎯</span>
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
            <span className="card-icon">💡</span>
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

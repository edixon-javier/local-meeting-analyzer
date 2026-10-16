import React from 'react'
import Icon from '../Icon'

export default function GroundingBadge({ grounding }) {
  if (!grounding || !grounding.label) return null

  const level = grounding.level || 'general'
  let iconName = 'info'
  if (level === 'high') {
    iconName = 'check-circle'
  } else if (level === 'unmentioned') {
    iconName = 'alert-triangle'
  } else if (level === 'medium') {
    iconName = 'info'
  }

  return (
    <div
      className={`chat-grounding-badge grounding-${level}`}
      title={grounding.label}
      role="status"
      aria-label={`Concordancia del asistente: ${grounding.label}`}
    >
      <Icon name={iconName} size={12} />
      <span>{grounding.label}</span>
    </div>
  )
}

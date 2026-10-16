import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GroundingBadge from './GroundingBadge'

describe('GroundingBadge component', () => {
  it('no renderiza nada si grounding es nulo o no tiene label', () => {
    const { container } = render(<GroundingBadge grounding={null} />)
    expect(container.firstChild).toBeNull()

    const { container: container2 } = render(<GroundingBadge grounding={{ score: 0.5 }} />)
    expect(container2.firstChild).toBeNull()
  })

  it('renderiza correctamente el badge de alta concordancia', () => {
    render(<GroundingBadge grounding={{ level: 'high', label: 'Alta concordancia con la grabación' }} />)
    const badge = screen.getByRole('status', { name: /Concordancia del asistente: Alta concordancia con la grabación/i })
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('grounding-high')
    expect(screen.getByText('Alta concordancia con la grabación')).toBeInTheDocument()
  })

  it('renderiza adecuadamente nivel unmentioned', () => {
    render(<GroundingBadge grounding={{ level: 'unmentioned', label: 'Sin mención directa en la grabación' }} />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveClass('grounding-unmentioned')
    expect(screen.getByText('Sin mención directa en la grabación')).toBeInTheDocument()
  })
})

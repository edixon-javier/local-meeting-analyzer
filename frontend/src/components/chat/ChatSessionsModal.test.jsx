import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChatSessionsModal from './ChatSessionsModal'

describe('ChatSessionsModal component', () => {
  it('no renderiza nada si isOpen es falso', () => {
    const { container } = render(
      <ChatSessionsModal
        isOpen={false}
        onClose={vi.fn()}
        sessions={[]}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('muestra estado vacío cuando no hay sesiones', () => {
    render(
      <ChatSessionsModal
        isOpen={true}
        onClose={vi.fn()}
        sessions={[]}
        onSelectSession={vi.fn()}
        onDeleteSession={vi.fn()}
        emptyMessage="Sin sesiones guardadas"
      />
    )
    expect(screen.getByText('Sin sesiones guardadas')).toBeInTheDocument()
  })

  it('muestra la lista de sesiones, permite retomar y eliminar', () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    const onClose = vi.fn()

    const sessions = [
      {
        id: 'sess_1',
        title: '¿Cuáles fueron los acuerdos de presupuesto?',
        createdAt: 1700000000000,
        messages: [
          { role: 'user', content: '¿Cuáles fueron los acuerdos de presupuesto?' },
          { role: 'assistant', content: 'Se acordó aumentar el 10%.' }
        ]
      }
    ]

    render(
      <ChatSessionsModal
        isOpen={true}
        onClose={onClose}
        sessions={sessions}
        onSelectSession={onSelect}
        onDeleteSession={onDelete}
      />
    )

    expect(screen.getByText('¿Cuáles fueron los acuerdos de presupuesto?')).toBeInTheDocument()
    expect(screen.getByText(/1 pregunta \(2 msgs\)/i)).toBeInTheDocument()

    const resumeBtn = screen.getByRole('button', { name: /Retomar consulta:/i })
    fireEvent.click(resumeBtn)
    expect(onSelect).toHaveBeenCalledWith(sessions[0])
    expect(onClose).toHaveBeenCalled()

    const deleteBtn = screen.getByRole('button', { name: /Eliminar consulta:/i })
    fireEvent.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledWith('sess_1')
  })
})

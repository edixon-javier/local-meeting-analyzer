import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TitleBar from './TitleBar'

describe('TitleBar component', () => {
  it('renders title with current view', () => {
    render(<TitleBar currentView="history" audioPath="" />)
    expect(screen.getByText(/Historial/i)).toBeInTheDocument()
  })

  it('renders reload button and calls electronAPI.reload when clicked', () => {
    const reloadMock = vi.fn()
    window.electronAPI = {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      reload: reloadMock
    }

    render(<TitleBar currentView="history" audioPath="" />)
    const reloadBtn = screen.getByRole('button', { name: /Recargar interfaz/i })
    expect(reloadBtn).toBeInTheDocument()
    fireEvent.click(reloadBtn)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('calls minimize, maximize, and close when their respective buttons are clicked', () => {
    const minMock = vi.fn()
    const maxMock = vi.fn()
    const closeMock = vi.fn()
    window.electronAPI = {
      minimize: minMock,
      maximize: maxMock,
      close: closeMock,
      reload: vi.fn()
    }

    render(<TitleBar currentView="history" audioPath="" />)
    fireEvent.click(screen.getByRole('button', { name: /Minimizar ventana/i }))
    expect(minMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Maximizar o restaurar ventana/i }))
    expect(maxMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Cerrar ventana/i }))
    expect(closeMock).toHaveBeenCalledTimes(1)
  })
})

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DictationPill from './DictationPill'
import * as api from '../../api'

describe('DictationPill Component', () => {
  let stateListener = null
  const mockElectronAPI = {
    onDictationStateChanged: vi.fn((callback) => {
      stateListener = callback
      return () => {
        stateListener = null
      }
    }),
    dictationStop: vi.fn().mockResolvedValue(),
    dictationCancel: vi.fn().mockResolvedValue(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    window.electronAPI = mockElectronAPI
    vi.spyOn(api, 'getDictationStatus').mockResolvedValue({
      data: { is_recording: true, rms_level: 0.15, mode: 'smart_polish' },
    })
    vi.spyOn(api, 'updateConfig').mockResolvedValue({ data: { success: true } })
  })

  it('muestra el texto de estado inicial en reposo', () => {
    render(<DictationPill />)
    expect(screen.getByText(/Presiona Ctrl\+Shift\+D para dictar/i)).toBeInTheDocument()
  })

  it('cambia a estado de grabación al recibir evento de electron', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'recording', started_at: Date.now() })
    })

    expect(screen.getByTitle(/Grabando dictado/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Detener e inyectar/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Cancelar/i)).toBeInTheDocument()
  })

  it('permite alternar el chip de modo y actualiza la configuración', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'recording', started_at: Date.now() })
    })

    const modeBtn = screen.getByTitle(/Modo de dictado/i)
    expect(modeBtn).toHaveTextContent(/✨ Ideas/i)

    fireEvent.click(modeBtn)
    expect(modeBtn).toHaveTextContent(/📝 Literal/i)
    expect(api.updateConfig).toHaveBeenCalledWith({ dictation_mode: 'literal' })
  })

  it('muestra estado de procesamiento y finalización', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'processing' })
    })
    expect(screen.getByText(/Transcribiendo\.\.\./i)).toBeInTheDocument()

    act(() => {
      stateListener?.({ state: 'finished', data: { injection_result: { injected: true } } })
    })
    expect(screen.getByText(/¡Inyectado!/i)).toBeInTheDocument()
  })

  it('muestra mensaje adecuado cuando no se detectó voz o audio fue corto', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'finished', data: { status: 'no_speech_detected' } })
    })
    expect(screen.getByText(/Sin voz/i)).toBeInTheDocument()

    act(() => {
      stateListener?.({ state: 'finished', data: { status: 'silence_or_too_short' } })
    })
    expect(screen.getByText(/Audio muy corto/i)).toBeInTheDocument()
  })

  it('ejecuta stop pasando el modo al pulsar el botón de detener', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'recording', started_at: Date.now() })
    })

    const stopBtn = screen.getByTitle(/Detener e inyectar/i)
    fireEvent.click(stopBtn)

    expect(mockElectronAPI.dictationStop).toHaveBeenCalledWith({ mode: 'smart_polish' })
  })

  it('ejecuta stop al pulsar el indicador interactivo REC', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'recording', started_at: Date.now() })
    })

    const recBtn = screen.getByTitle(/Grabando dictado \(clic para detener\)/i)
    fireEvent.click(recBtn)

    expect(mockElectronAPI.dictationStop).toHaveBeenCalledWith({ mode: 'smart_polish' })
  })

  it('permite iniciar arrastre desde la manija de arrastre', () => {
    mockElectronAPI.dictationDragStart = vi.fn()
    mockElectronAPI.dictationDragMove = vi.fn()
    mockElectronAPI.dictationDragEnd = vi.fn()

    render(<DictationPill />)

    const dragHandle = screen.getByTitle(/Arrastrar posición/i)
    expect(dragHandle).toBeInTheDocument()

    fireEvent.mouseDown(dragHandle, { button: 0, screenX: 100, screenY: 200 })
    expect(mockElectronAPI.dictationDragStart).toHaveBeenCalledWith({ screenX: 100, screenY: 200 })

    fireEvent.mouseMove(window, { screenX: 120, screenY: 210 })
    expect(mockElectronAPI.dictationDragMove).toHaveBeenCalledWith({ screenX: 120, screenY: 210 })

    fireEvent.mouseUp(window)
    expect(mockElectronAPI.dictationDragEnd).toHaveBeenCalled()
  })

  it('renderiza botón de confirmación solo con icono sin texto de texto adicional', () => {
    render(<DictationPill />)

    act(() => {
      stateListener?.({ state: 'recording', started_at: Date.now() })
    })

    const stopBtn = screen.getByTitle(/Detener e inyectar/i)
    expect(stopBtn).toBeInTheDocument()
    expect(stopBtn).not.toHaveTextContent('Listo')
  })
})

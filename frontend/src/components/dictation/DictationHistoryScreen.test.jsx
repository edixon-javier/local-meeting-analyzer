import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DictationHistoryScreen from './DictationHistoryScreen'
import * as api from '../../api'

const sampleDictations = [
  {
    id: 'dict_20261015_103000',
    timestamp: '2026-10-15T10:30:00',
    duration_seconds: 4.2,
    target_app: {
      title: 'main.py - Visual Studio Code',
      exe_name: 'Code.exe',
      process_id: 1234,
      is_elevated: false,
    },
    raw_transcript: 'vamos a enviar tres no cuatro reportes punto y aparte',
    polished_transcript: 'Vamos a enviar cuatro reportes.\n\n',
    injected_text: 'Vamos a enviar cuatro reportes.\n\n',
    mode: 'smart_polish',
    provider: 'groq',
    metrics: {
      total_latency_ms: 380,
      stt_latency_ms: 240,
    },
    audio_file: 'dict_20261015_103000.mp3',
  },
  {
    id: 'dict_20261015_091500',
    timestamp: '2026-10-15T09:15:00',
    duration_seconds: 2.1,
    target_app: {
      title: 'Google Chrome',
      exe_name: 'chrome.exe',
      process_id: 5678,
      is_elevated: false,
    },
    raw_transcript: 'búsqueda en internet de modelos whisper',
    polished_transcript: 'Búsqueda en internet de modelos Whisper.',
    injected_text: 'búsqueda en internet de modelos whisper',
    mode: 'literal',
    provider: 'groq',
    metrics: {
      total_latency_ms: 260,
    },
    audio_file: 'dict_20261015_091500.mp3',
  },
]

vi.mock('../../hooks/useSystem', () => ({
  useSystem: () => ({
    showToast: vi.fn(),
  }),
}))

describe('DictationHistoryScreen Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getDictationHistory').mockResolvedValue({ data: sampleDictations })
    vi.spyOn(api, 'deleteDictation').mockResolvedValue({ data: { success: true } })
    vi.spyOn(api, 'reinjectDictation').mockResolvedValue({ data: { injected: true } })

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(),
      },
    })
  })

  it('renderiza el título, subtítulo y atajo de teclado global', async () => {
    render(<DictationHistoryScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/Notas de Voz y Dictados en Cursor/i)).toBeInTheDocument()
    expect(screen.getByText(/Ctrl \+ Shift \+ D/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Code\.exe/i)).toBeInTheDocument()
      expect(screen.getByText(/chrome\.exe/i)).toBeInTheDocument()
    })
  })

  it('permite buscar y filtrar por texto o aplicación', async () => {
    render(<DictationHistoryScreen onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Code\.exe/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por texto, aplicación/i)
    fireEvent.change(searchInput, { target: { value: 'chrome' } })

    await waitFor(() => {
      expect(api.getDictationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'chrome' })
      )
    })
  })

  it('permite alternar entre pestañas Ideas Claras y Original', async () => {
    render(<DictationHistoryScreen onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Vamos a enviar cuatro reportes/i)).toBeInTheDocument()
    })

    const rawTab = screen.getByText(/🎙️ Original/i)
    fireEvent.click(rawTab)

    await waitFor(() => {
      expect(screen.getByText(/vamos a enviar tres no cuatro reportes/i)).toBeInTheDocument()
    })
  })

  it('permite copiar el texto al portapapeles', async () => {
    render(<DictationHistoryScreen onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTitle(/Copiar texto al portapapeles/i)[0]).toBeInTheDocument()
    })

    const copyBtn = screen.getAllByTitle(/Copiar texto al portapapeles/i)[0]
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(screen.getByText(/Copiado/i)).toBeInTheDocument()
    })
  })

  it('permite re-inyectar el texto en el cursor', async () => {
    render(<DictationHistoryScreen onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTitle(/Re-inyectar este texto en la aplicación/i)[0]).toBeInTheDocument()
    })

    const reinjectBtn = screen.getAllByTitle(/Re-inyectar este texto en la aplicación/i)[0]
    fireEvent.click(reinjectBtn)

    expect(api.reinjectDictation).toHaveBeenCalledWith('dict_20261015_103000')
  })
})

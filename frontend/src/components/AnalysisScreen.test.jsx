// src/components/AnalysisScreen.test.jsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAnalysisPipeline = {
  step: 'done',
  transcript: 'Hola mundo, esta es la transcripción completa de la reunión.',
  segments: [
    { start: 0, end: 5, speaker: 'Hablante 1', text: 'Hola mundo' },
    { start: 6, end: 12, speaker: 'Hablante 2', text: 'Esta es la transcripción' }
  ],
  analysis: {
    category: 'Estrategia',
    tone: 'Colaborativo',
    summary: ['Punto 1 del resumen', 'Punto 2 del resumen'],
    key_decisions: ['Decisión 1'],
    action_items: [
      { task: 'Preparar informe', assignee: 'Carlos', deadline: 'Mañana', completed: false }
    ],
    duration_insight: '45 minutos'
  },
  bookmarks: [],
  setBookmarks: vi.fn(),
  errorMsg: '',
  elapsedSeconds: 0,
  progressPercent: 100,
  cancelPipeline: vi.fn(),
  reprocess: vi.fn(),
  updateSpeakerInState: vi.fn(),
  updateTaskInState: vi.fn()
}

vi.mock('../hooks/useSystem', () => ({
  useSystem: () => ({
    showToast: vi.fn(),
    systemStatus: { whisper_model: 'base', ai_provider: 'ollama' }
  })
}))

vi.mock('../hooks/useAnalysisPipeline', () => ({
  useAnalysisPipeline: () => mockAnalysisPipeline
}))

vi.mock('../api', () => ({
  renameSpeaker: vi.fn(),
  addRecordingBookmark: vi.fn(),
  deleteRecordingBookmark: vi.fn(),
  updateRecordingTaskStatus: vi.fn(),
  getAudioUrl: vi.fn(() => 'http://localhost:8000/audio.wav')
}))

vi.mock('../utils/minutesExport', () => ({
  copyExecutiveMinutes: vi.fn(),
  downloadExecutiveMarkdown: vi.fn(),
  downloadFullDocumentMarkdown: vi.fn(),
  downloadTranscriptFile: vi.fn(),
  copyTranscript: vi.fn(),
  copyFullDocument: vi.fn(),
  exportExecutivePdf: vi.fn()
}))

import AnalysisScreen from './AnalysisScreen'
import {
  copyExecutiveMinutes,
  downloadFullDocumentMarkdown,
  downloadTranscriptFile,
  exportExecutivePdf
} from '../utils/minutesExport'

import { within } from '@testing-library/react'

describe('AnalysisScreen: Exportaciones estructuradas y descarga de conversación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza la cabecera con los 4 botones cuadrados de exportación uniformes', () => {
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} />)

    const actionsGroup = screen.getByRole('group', { name: 'Opciones de exportación' })
    const buttons = within(actionsGroup).getAllByRole('button')
    expect(buttons).toHaveLength(4)

    expect(within(actionsGroup).getByRole('button', { name: /Copiar minuta al portapapeles/i })).toBeInTheDocument()
    expect(within(actionsGroup).getByRole('button', { name: /Descargar conversación completa/i })).toBeInTheDocument()
    expect(within(actionsGroup).getByRole('button', { name: /Opciones de exportación/i })).toBeInTheDocument()
    expect(within(actionsGroup).getByRole('button', { name: /Exportar documento en PDF/i })).toBeInTheDocument()
  })

  it('permite copiar la minuta directamente desde el botón de cabecera', async () => {
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} />)

    const actionsGroup = screen.getByRole('group', { name: 'Opciones de exportación' })
    const copyBtn = within(actionsGroup).getByRole('button', { name: /Copiar minuta al portapapeles/i })
    fireEvent.click(copyBtn)

    expect(copyExecutiveMinutes).toHaveBeenCalled()
  })

  it('permite descargar la conversación completa directamente en .txt desde el botón de cabecera', () => {
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} />)

    const actionsGroup = screen.getByRole('group', { name: 'Opciones de exportación' })
    const downloadChatBtn = within(actionsGroup).getByRole('button', { name: /Descargar conversación completa/i })
    fireEvent.click(downloadChatBtn)

    expect(downloadTranscriptFile).toHaveBeenCalledWith(
      expect.any(Object),
      'reunion_estrategica',
      expect.any(Function),
      'txt'
    )
  })

  it('permite abrir el modal de exportación estructurada y ofrece Documento Completo, Minuta y Conversación', async () => {
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} />)

    const actionsGroup = screen.getByRole('group', { name: 'Opciones de exportación' })
    const optionsBtn = within(actionsGroup).getByRole('button', { name: /Opciones de exportación/i })
    fireEvent.click(optionsBtn)

    // Modal abierto
    expect(screen.getByText('Exportar Reunión y Documentos')).toBeInTheDocument()
    expect(screen.getByText('Documento Completo')).toBeInTheDocument()
    expect(screen.getByText('Minuta Ejecutiva')).toBeInTheDocument()
    expect(screen.getByText('Conversación Completa')).toBeInTheDocument()

    // Descargar Documento Completo en .md
    const downloadDocMdBtns = screen.getAllByRole('button', { name: /Descargar \.md/i })
    expect(downloadDocMdBtns.length).toBeGreaterThan(0)
    fireEvent.click(downloadDocMdBtns[0])

    expect(downloadFullDocumentMarkdown).toHaveBeenCalled()
    // El modal debe haberse cerrado
    await waitFor(() => {
      expect(screen.queryByText('Exportar Reunión y Documentos')).not.toBeInTheDocument()
    })
  })

  it('permite exportar la Minuta Ejecutiva en PDF (modo executive) desde el modal', async () => {
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} />)

    const actionsGroup = screen.getByRole('group', { name: 'Opciones de exportación' })
    const optionsBtn = within(actionsGroup).getByRole('button', { name: /Opciones de exportación/i })
    fireEvent.click(optionsBtn)

    const pdfBtns = screen.getAllByRole('button', { name: /Exportar PDF/i })
    expect(pdfBtns.length).toBeGreaterThanOrEqual(2)

    // Clic en el segundo botón de PDF (Minuta Ejecutiva)
    fireEvent.click(pdfBtns[1])

    await waitFor(() => {
      expect(exportExecutivePdf).toHaveBeenCalledWith(
        expect.any(Object),
        'reunion_estrategica',
        expect.any(Function),
        'executive'
      )
    })
  })

  it('permite alternar a la pestaña Chat IA y renderiza ChatPanel sin errores', async () => {
    const onNavigateMock = vi.fn()
    render(<AnalysisScreen audioPath="/recordings/reunion_estrategica.wav" onBack={vi.fn()} onNavigate={onNavigateMock} />)

    const chatTab = screen.getByRole('tab', { name: /Chat IA/i })
    expect(chatTab).toBeInTheDocument()
    fireEvent.click(chatTab)

    expect(chatTab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByPlaceholderText(/Pregunta algo sobre la reunión/i)).toBeInTheDocument()
  })
})

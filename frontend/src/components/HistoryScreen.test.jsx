import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sampleRecordings = [
  {
    path: 'meeting1.wav',
    filename: 'meeting1.wav',
    duration: 120,
    created: 1700000000,
    size_mb: 2.5,
    has_metadata: true,
    category: 'Ingeniería',
    tone: 'Colaborativo',
    summary_preview: 'Revisión de arquitectura',
    bookmarks_count: 1,
    tasks_count: 3,
    pending_tasks_count: 2
  },
  {
    path: 'meeting2.wav',
    filename: 'meeting2.wav',
    duration: 60,
    created: 1700001000,
    size_mb: 1.2,
    has_metadata: false,
    category: null,
    tone: null,
    summary_preview: null,
    bookmarks_count: 0,
    tasks_count: 0,
    pending_tasks_count: 0
  }
]

const mockUseRecordings = {
  recordings: sampleRecordings,
  isPinned: vi.fn(() => false),
  togglePin: vi.fn(),
  loading: false,
  isRefreshing: false,
  loadRecordings: vi.fn(),
  setDeletingFile: vi.fn(),
  setRenamingFile: vi.fn(),
  setNewNameInput: vi.fn(),
  formatDate: vi.fn(() => '01/01/2026')
}

vi.mock('../hooks/useSystem', () => ({
  useSystem: () => ({ isBackendOffline: false, showToast: vi.fn() })
}))

vi.mock('../hooks/useRecordings', () => ({
  useRecordings: () => mockUseRecordings
}))

vi.mock('../api', () => ({
  getRecordingMetadata: vi.fn()
}))

vi.mock('../utils/tasksExport', () => ({
  downloadMeetingTasks: vi.fn()
}))

vi.mock('../utils/minutesExport', () => ({
  copyExecutiveMinutes: vi.fn(),
  downloadExecutiveMarkdown: vi.fn(),
  downloadFullDocumentMarkdown: vi.fn(),
  downloadTranscriptFile: vi.fn(),
  copyTranscript: vi.fn(),
  exportExecutivePdf: vi.fn(),
  formatTime: vi.fn(() => '01:00')
}))

import HistoryScreen from './HistoryScreen'
import { downloadFullDocumentMarkdown } from '../utils/minutesExport'
import { getRecordingMetadata } from '../api'

describe('HistoryScreen: Filtros de estado y compromisos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el resumen global con conteo de tareas pendientes', () => {
    render(<HistoryScreen onNavigate={vi.fn()} />)
    expect(screen.getByText(/2 reuniones/i)).toBeInTheDocument()
    expect(screen.getByText(/1 analizada/i)).toBeInTheDocument()
    expect(screen.getByText(/2 tareas pendientes/i)).toBeInTheDocument()
  })

  it('muestra el badge de tareas en las tarjetas que tienen tareas', () => {
    render(<HistoryScreen onNavigate={vi.fn()} />)
    expect(screen.getByText('2/3 pend.')).toBeInTheDocument()
  })

  it('permite filtrar por "Solo analizadas"', () => {
    render(<HistoryScreen onNavigate={vi.fn()} />)
    const statusSelect = screen.getByLabelText('Filtrar por estado')
    fireEvent.change(statusSelect, { target: { value: 'analyzed' } })

    expect(screen.getByText('Revisión de arquitectura')).toBeInTheDocument()
    expect(screen.queryByText(/Aún sin analizar/i)).not.toBeInTheDocument()
  })

  it('permite filtrar por "Sin analizar"', () => {
    render(<HistoryScreen onNavigate={vi.fn()} />)
    const statusSelect = screen.getByLabelText('Filtrar por estado')
    fireEvent.change(statusSelect, { target: { value: 'pending' } })

    expect(screen.queryByText('Revisión de arquitectura')).not.toBeInTheDocument()
    expect(screen.getByText(/Aún sin analizar/i)).toBeInTheDocument()
  })

  it('permite filtrar por "Con tareas pendientes"', () => {
    render(<HistoryScreen onNavigate={vi.fn()} />)
    const statusSelect = screen.getByLabelText('Filtrar por estado')
    fireEvent.change(statusSelect, { target: { value: 'with_tasks' } })

    expect(screen.getByText('2/3 pend.')).toBeInTheDocument()
    expect(screen.queryByText(/Aún sin analizar/i)).not.toBeInTheDocument()
  })

  it('excluye reuniones cuyas tareas están 100% completadas al filtrar por "Con tareas pendientes"', () => {
    const completedMeeting = {
      path: 'meeting3.wav',
      filename: 'meeting3.wav',
      duration: 90,
      created: 1700002000,
      size_mb: 1.5,
      has_metadata: true,
      category: 'Producto',
      tone: 'Formal',
      summary_preview: 'Plan de lanzamiento completo',
      bookmarks_count: 0,
      tasks_count: 2,
      pending_tasks_count: 0
    }
    mockUseRecordings.recordings = [...sampleRecordings, completedMeeting]

    render(<HistoryScreen onNavigate={vi.fn()} />)
    expect(screen.getByText('2 listas')).toBeInTheDocument()

    const statusSelect = screen.getByLabelText('Filtrar por estado')
    fireEvent.change(statusSelect, { target: { value: 'with_tasks' } })

    expect(screen.getByText('2/3 pend.')).toBeInTheDocument()
    expect(screen.queryByText('Plan de lanzamiento completo')).not.toBeInTheDocument()
  })

  it('NO renderiza botones ruidosos de exportación masiva consolidada en el encabezado', () => {
    mockUseRecordings.recordings = sampleRecordings
    render(<HistoryScreen onNavigate={vi.fn()} />)

    // Los botones masivos consolidados fueron eliminados porque sobrecargaban la vista y carecían de sentido
    expect(screen.queryByRole('button', { name: /Exportar compromisos consolidados a iCalendar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar compromisos consolidados a CSV/i })).not.toBeInTheDocument()
  })

  it('permite abrir el modal de exportación individual y descargar el documento completo en .md', async () => {
    mockUseRecordings.recordings = sampleRecordings
    getRecordingMetadata.mockResolvedValueOnce({
      data: {
        exists: true,
        analysis: { summary: ['Punto clave'] },
        segments: [],
        transcript: 'texto completo'
      }
    })
    render(<HistoryScreen onNavigate={vi.fn()} />)

    // Abrir modal de exportación de la primera reunión
    const exportBtns = screen.getAllByRole('button', { name: /Exportar minuta y documentos de la reunión/i })
    expect(exportBtns.length).toBeGreaterThan(0)
    fireEvent.click(exportBtns[0])

    // Verificar que aparece el modal estructurado
    const docTitle = await screen.findByText('Documento Completo')
    expect(docTitle).toBeInTheDocument()
    expect(screen.getByText('Minuta Ejecutiva')).toBeInTheDocument()
    expect(screen.getByText('Conversación Completa')).toBeInTheDocument()

    // Descargar Documento Completo
    const downloadDocBtns = screen.getAllByRole('button', { name: /Descargar \.md/i })
    expect(downloadDocBtns.length).toBeGreaterThan(0)
    fireEvent.click(downloadDocBtns[0])
    expect(downloadFullDocumentMarkdown).toHaveBeenCalled()
  })

  it('permite exportar en PDF el documento completo y la minuta ejecutiva desde el modal', async () => {
    mockUseRecordings.recordings = sampleRecordings
    getRecordingMetadata.mockResolvedValueOnce({
      data: {
        exists: true,
        analysis: { summary: ['Punto clave'] },
        segments: [],
        transcript: 'texto completo'
      }
    })
    render(<HistoryScreen onNavigate={vi.fn()} />)

    // Abrir modal de exportación
    const exportBtns = screen.getAllByRole('button', { name: /Exportar minuta y documentos de la reunión/i })
    fireEvent.click(exportBtns[0])

    const pdfBtns = await screen.findAllByRole('button', { name: /Exportar PDF/i })
    expect(pdfBtns.length).toBeGreaterThanOrEqual(2) // 1 para Documento Completo, 1 para Minuta Ejecutiva
  })

  it('permite recargar manualmente el historial mediante el botón Actualizar', () => {
    mockUseRecordings.recordings = sampleRecordings
    render(<HistoryScreen onNavigate={vi.fn()} />)

    const refreshBtn = screen.getByRole('button', { name: /Recargar historial de reuniones/i })
    expect(refreshBtn).toBeInTheDocument()

    fireEvent.click(refreshBtn)
    expect(mockUseRecordings.loadRecordings).toHaveBeenCalled()
  })
})

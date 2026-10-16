// src/components/analysis/InsightsPanel.test.jsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InsightsPanel from './InsightsPanel'
import { downloadMeetingTasks } from '../../utils/tasksExport'

vi.mock('../../utils/tasksExport', () => ({
  downloadMeetingTasks: vi.fn()
}))

describe('InsightsPanel: Tareas, filtros y exportación de compromisos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleAnalysis = {
    category: 'Estrategia',
    tone: 'Constructivo',
    summary: ['Punto 1', 'Punto 2'],
    action_items: [
      { task: 'Definir OKRs Q4', assignee: 'Marcos', deadline: '2026-10-25', completed: false },
      { task: 'Revisar contratos', assignee: 'Lucía', deadline: 'Sin fecha', completed: true }
    ],
    key_decisions: ['Decisión A'],
    duration_insight: 'Reunión concisa'
  }

  it('muestra estado vacío si analysis es null', () => {
    render(<InsightsPanel analysis={null} />)
    expect(screen.getByText('Sin análisis')).toBeInTheDocument()
  })

  it('renderiza la lista de tareas con badges de responsable y fecha límite', () => {
    render(<InsightsPanel analysis={sampleAnalysis} meetingTitle="Plan Q4" />)
    expect(screen.getByText('Definir OKRs Q4')).toBeInTheDocument()
    expect(screen.getByText('Marcos')).toBeInTheDocument()
    expect(screen.getByText('2026-10-25')).toBeInTheDocument()
    expect(screen.getByText('Revisar contratos')).toBeInTheDocument()
    expect(screen.getByText('Lucía')).toBeInTheDocument()
  })

  it('permite alternar el estado de una tarea al hacer clic en el checkbox', () => {
    const onToggleTask = vi.fn()
    render(
      <InsightsPanel
        analysis={sampleAnalysis}
        meetingTitle="Plan Q4"
        onToggleTask={onToggleTask}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: /Tarea completada: Definir OKRs Q4/i })
    fireEvent.click(checkbox)
    expect(onToggleTask).toHaveBeenCalledWith(0, true)
  })

  it('permite abrir el menú desplegable y exportar compromisos en .txt, .ics y .csv', () => {
    const showToast = vi.fn()
    render(
      <InsightsPanel
        analysis={sampleAnalysis}
        meetingTitle="Plan Q4"
        filename="plan_q4.wav"
        showToast={showToast}
      />
    )

    // Abrir menú de descarga
    const dropdownTrigger = screen.getByRole('button', { name: /Descargar compromisos/i })
    expect(dropdownTrigger).toBeInTheDocument()
    fireEvent.click(dropdownTrigger)

    const txtBtn = screen.getByRole('menuitem', { name: /Exportar compromisos a Texto \(\.txt\)/i })
    const icsBtn = screen.getByRole('menuitem', { name: /Exportar compromisos a iCalendar \(\.ics\)/i })
    const csvBtn = screen.getByRole('menuitem', { name: /Exportar compromisos a CSV \(\.csv\)/i })

    expect(txtBtn).toBeInTheDocument()
    expect(icsBtn).toBeInTheDocument()
    expect(csvBtn).toBeInTheDocument()

    // Exportar a texto
    fireEvent.click(txtBtn)
    expect(downloadMeetingTasks).toHaveBeenCalledWith(
      'plan_q4.wav',
      'txt',
      expect.any(Array),
      'Plan Q4',
      showToast,
      expect.objectContaining({ status: 'all' })
    )

    // Abrir y exportar a iCalendar
    fireEvent.click(dropdownTrigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /Exportar compromisos a iCalendar \(\.ics\)/i }))
    expect(downloadMeetingTasks).toHaveBeenCalledWith(
      'plan_q4.wav',
      'ics',
      expect.any(Array),
      'Plan Q4',
      showToast,
      expect.objectContaining({ status: 'all' })
    )

    // Abrir y exportar a CSV
    fireEvent.click(dropdownTrigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /Exportar compromisos a CSV \(\.csv\)/i }))
    expect(downloadMeetingTasks).toHaveBeenCalledWith(
      'plan_q4.wav',
      'csv',
      expect.any(Array),
      'Plan Q4',
      showToast,
      expect.objectContaining({ status: 'all' })
    )
  })

  it('respeta el filtro activo al invocar downloadMeetingTasks (ej. solo pendientes)', () => {
    const showToast = vi.fn()
    render(
      <InsightsPanel
        analysis={sampleAnalysis}
        meetingTitle="Plan Q4"
        filename="plan_q4.wav"
        showToast={showToast}
      />
    )

    // Filtrar Pendientes y descargar
    fireEvent.click(screen.getByRole('button', { name: /Pendientes \(1\)/i }))
    const dropdownTrigger = screen.getByRole('button', { name: /Descargar compromisos/i })
    fireEvent.click(dropdownTrigger)

    const csvBtn = screen.getByRole('menuitem', { name: /Exportar compromisos a CSV \(\.csv\)/i })
    fireEvent.click(csvBtn)

    expect(downloadMeetingTasks).toHaveBeenLastCalledWith(
      'plan_q4.wav',
      'csv',
      expect.any(Array),
      'Plan Q4',
      showToast,
      expect.objectContaining({ status: 'pending' })
    )
  })

  it('filtra correctamente entre Todas, Pendientes y Completadas', () => {
    render(<InsightsPanel analysis={sampleAnalysis} meetingTitle="Plan Q4" />)

    // Filtrar Pendientes
    fireEvent.click(screen.getByRole('button', { name: /Pendientes \(1\)/i }))
    expect(screen.getByText('Definir OKRs Q4')).toBeInTheDocument()
    expect(screen.queryByText('Revisar contratos')).not.toBeInTheDocument()

    // Filtrar Completadas
    fireEvent.click(screen.getByRole('button', { name: /Completadas \(1\)/i }))
    expect(screen.queryByText('Definir OKRs Q4')).not.toBeInTheDocument()
    expect(screen.getByText('Revisar contratos')).toBeInTheDocument()
  })

  it('no muestra chips de filtro cuando solo hay 1 tarea para evitar saturación visual, pero mantiene las acciones', () => {
    const singleTaskAnalysis = {
      ...sampleAnalysis,
      action_items: [{ task: 'Única tarea', assignee: 'Ana', deadline: 'Sin fecha', completed: false }]
    }
    render(<InsightsPanel analysis={singleTaskAnalysis} meetingTitle="Plan Q4" />)

    // No debe haber filtros
    expect(screen.queryByRole('button', { name: /Todas \(/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pendientes \(/i })).not.toBeInTheDocument()

    // Pero sí deben estar las acciones de copiar y descargar
    expect(screen.getByRole('button', { name: /Copiar checklist de tareas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar compromisos/i })).toBeInTheDocument()
  })
})

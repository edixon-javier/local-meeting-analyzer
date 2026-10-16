// src/utils/tasksExport.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  escapeCsvValue,
  generateTasksCsv,
  escapeIcsText,
  foldIcsLine,
  parseDeadlineDate,
  generateTasksIcs,
  downloadMeetingTasks,
  downloadConsolidatedTasks
} from './tasksExport'
import * as api from '../api'

describe('tasksExport - Generador y utilidades de exportación', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('escapeCsvValue', () => {
    it('escapa comillas dobles duplicándolas y envolviendo en comillas', () => {
      expect(escapeCsvValue('Revisar "Sprint"')).toBe('"Revisar ""Sprint"""')
    })

    it('envuelve en comillas si contiene comas o saltos de línea', () => {
      expect(escapeCsvValue('Hola, mundo')).toBe('"Hola, mundo"')
      expect(escapeCsvValue("Línea 1\nLínea 2")).toBe('"Línea 1\nLínea 2"')
    })

    it('maneja valores simples y nulos', () => {
      expect(escapeCsvValue('Tarea simple')).toBe('"Tarea simple"')
      expect(escapeCsvValue(null)).toBe('""')
      expect(escapeCsvValue(undefined)).toBe('""')
    })

    it('neutraliza inyección de fórmulas CSV (CWE-1236) y listas de viñetas en Excel', () => {
      expect(escapeCsvValue('- Revisar presupuesto')).toBe('"\' - Revisar presupuesto"'.replace(' ', ''))
      expect(escapeCsvValue('=SUM(1+1)')).toBe('"\'=SUM(1+1)"')
      expect(escapeCsvValue('+10 puntos')).toBe('"\' +10 puntos"'.replace(' ', ''))
    })
  })

  describe('generateTasksCsv', () => {
    const sampleTasks = [
      { task: 'Definir arquitectura', assignee: 'Carlos', deadline: '2026-10-15', completed: false },
      { task: 'Publicar release', assignee: 'Diana', deadline: 'Sin fecha', completed: true }
    ]

    it('agrega BOM UTF-8 y genera columnas para reunión individual', () => {
      const csv = generateTasksCsv(sampleTasks, { meetingTitle: 'Sprint 10' })
      expect(csv.startsWith('\ufeff')).toBe(true)
      expect(csv).toContain('"Nº","Tarea / Compromiso","Responsable","Fecha Límite","Estado"')
      expect(csv).toContain('"1","Definir arquitectura","Carlos","2026-10-15","Pendiente"')
      expect(csv).toContain('"2","Publicar release","Diana","Sin fecha","Completada"')
    })

    it('genera columnas para exportación consolidada', () => {
      const consolidatedTasks = [
        {
          meeting_title: 'Demo Clientes',
          meeting_date: '2026-10-08',
          task: 'Enviar propuesta',
          assignee: 'Elena',
          deadline: '2026-10-12',
          completed: false
        }
      ]
      const csv = generateTasksCsv(consolidatedTasks, { isConsolidated: true })
      expect(csv).toContain('"Reunión","Fecha Reunión","Nº","Tarea / Compromiso","Responsable","Fecha Límite","Estado"')
      expect(csv).toContain('"Demo Clientes","2026-10-08","1","Enviar propuesta","Elena","2026-10-12","Pendiente"')
    })
  })

  describe('escapeIcsText y foldIcsLine', () => {
    it('escapa caracteres especiales según RFC 5545', () => {
      const text = 'Texto con; coma, barra C:\\ y salto\nde línea'
      const escaped = escapeIcsText(text)
      expect(escaped).toContain('\\;')
      expect(escaped).toContain('\\,')
      expect(escaped).toContain('\\\\')
      expect(escaped).toContain('\\n')
    })

    it('pliega líneas que exceden 75 octetos', () => {
      const longText = 'DESCRIPTION:' + 'X'.repeat(90)
      const folded = foldIcsLine(longText)
      expect(folded).toContain('\r\n ')
    })
  })

  describe('parseDeadlineDate', () => {
    it('parsea fechas ISO y formato latino', () => {
      const d1 = parseDeadlineDate('2026-10-25')
      expect(d1).not.toBeNull()
      expect(d1.getFullYear()).toBe(2026)
      expect(d1.getMonth()).toBe(9) // octubre (0-indexado)
      expect(d1.getDate()).toBe(25)

      const d2 = parseDeadlineDate('15/11/2026')
      expect(d2).not.toBeNull()
      expect(d2.getDate()).toBe(15)
      expect(d2.getMonth()).toBe(10) // noviembre
    })

    it('soporta formatos ISO con hora o T y fechas sin ceros', () => {
      const dIsoTime = parseDeadlineDate('2026-10-15T14:30:00Z')
      expect(dIsoTime).not.toBeNull()
      expect(dIsoTime.getDate()).toBe(15)

      const dSingle = parseDeadlineDate('5/4/2026')
      expect(dSingle).not.toBeNull()
      expect(dSingle.getMonth()).toBe(3) // abril
      expect(dSingle.getDate()).toBe(5)

      const dTwoDigitYear = parseDeadlineDate('15/10/26')
      expect(dTwoDigitYear).not.toBeNull()
      expect(dTwoDigitYear.getFullYear()).toBe(2026)
    })

    it('soporta fechas en lenguaje natural en español', () => {
      const dText = parseDeadlineDate('15 de octubre de 2026')
      expect(dText).not.toBeNull()
      expect(dText.getFullYear()).toBe(2026)
      expect(dText.getMonth()).toBe(9)
      expect(dText.getDate()).toBe(15)

      const dAbbr = parseDeadlineDate('15 oct 2026')
      expect(dAbbr).not.toBeNull()
      expect(dAbbr.getMonth()).toBe(9)
    })

    it('retorna null para textos sin fecha reconocible', () => {
      expect(parseDeadlineDate('Sin fecha')).toBeNull()
      expect(parseDeadlineDate('Próximo martes')).toBeNull()
      expect(parseDeadlineDate('')).toBeNull()
    })
  })

  describe('generateTasksIcs', () => {
    it('genera archivo iCalendar RFC 5545 con VEVENT y propiedades esperadas', () => {
      const tasks = [
        { task: 'Presentar demo', assignee: 'Roberto', deadline: '2026-10-20', completed: false },
        { task: 'Firmar contrato', assignee: 'Ana', deadline: 'Sin fecha', completed: true }
      ]
      const ics = generateTasksIcs(tasks, { meetingTitle: 'Sprint Demo' })
      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('VERSION:2.0')
      expect(ics).toContain('BEGIN:VEVENT')
      expect(ics).toContain('SUMMARY:[Compromiso] Presentar demo (Roberto)')
      expect(ics).toContain('SUMMARY:[Compromiso - Completado] Firmar contrato (Ana)')
      expect(ics).toContain('DTSTART;VALUE=DATE:20261020')
      expect(ics).toContain('STATUS:CONFIRMED')
      expect(ics).toContain('X-STATUS:COMPLETED')
      expect(ics).toContain('END:VEVENT')
      expect(ics).toContain('END:VCALENDAR')
      expect(ics.endsWith('\r\n')).toBe(true)
    })
  })

  describe('downloadMeetingTasks y downloadConsolidatedTasks', () => {
    it('invoca endpoint del backend y dispara descarga en reunión individual', async () => {
      const fakeBlob = new Blob(['fake content'], { type: 'text/csv' })
      vi.spyOn(api, 'exportMeetingTasks').mockResolvedValueOnce({ data: fakeBlob })
      const showToast = vi.fn()

      const success = await downloadMeetingTasks('reunion.wav', 'csv', [], 'Reunión Test', showToast, { status: 'pending' })
      expect(success).toBe(true)
      expect(api.exportMeetingTasks).toHaveBeenCalledWith('reunion.wav', 'csv', 'pending', 'Reunión Test')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })

    it('invoca endpoint consolidado y emite toast de confirmación', async () => {
      const fakeBlob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' })
      vi.spyOn(api, 'exportConsolidatedTasks').mockResolvedValueOnce({ data: fakeBlob })
      const showToast = vi.fn()

      const success = await downloadConsolidatedTasks('ics', showToast, { status: 'pending' })
      expect(success).toBe(true)
      expect(api.exportConsolidatedTasks).toHaveBeenCalledWith('ics', 'pending', null)
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })

    it('sanitiza status inválidos como "analyzed" a "all" en descarga consolidada para evitar 422', async () => {
      const fakeBlob = new Blob(['fake content'], { type: 'text/csv' })
      vi.spyOn(api, 'exportConsolidatedTasks').mockResolvedValueOnce({ data: fakeBlob })
      const showToast = vi.fn()

      const success = await downloadConsolidatedTasks('csv', showToast, { status: 'analyzed' })
      expect(success).toBe(true)
      expect(api.exportConsolidatedTasks).toHaveBeenCalledWith('csv', 'all', null)
    })

    it('no descarga archivos vacíos si el backend falla y no hay tareas', async () => {
      vi.spyOn(api, 'exportMeetingTasks').mockRejectedValueOnce(new Error('Network error'))
      const showToast = vi.fn()

      const success = await downloadMeetingTasks('reunion.wav', 'csv', [], 'Reunión Test', showToast)
      expect(success).toBe(false)
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
    })
  })
})

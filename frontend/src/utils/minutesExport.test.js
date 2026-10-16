// src/utils/minutesExport.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTime,
  generateTranscriptMarkdown,
  generateTranscriptText,
  generateExecutiveMarkdown,
  generateFullDocumentMarkdown,
  generateExecutiveHtml,
  downloadTranscriptFile,
  downloadFullDocumentMarkdown,
  copyTranscript,
  exportExecutivePdf
} from './minutesExport'

describe('minutesExport: utilidades de exportación ejecutiva y conversación', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const sampleData = {
    title: 'Plan Estratégico 2026',
    date: '8 de octubre de 2026',
    category: 'Estrategia',
    tone: 'Colaborativo',
    durationInsight: 'Reunión productiva de 45 minutos',
    summary: ['Definición de objetivos Q1', 'Asignación de presupuestos'],
    keyDecisions: ['Aprobar presupuesto de marketing', 'Contratar 2 desarrolladores'],
    actionItems: [
      { task: 'Publicar ofertas de empleo', assignee: 'Laura', deadline: '15/10/2026', completed: false },
      { task: 'Revisar métricas', assignee: 'Pedro', deadline: 'Sin fecha', completed: true }
    ],
    segments: [
      { speaker: 'Hablante A', start: 10, end: 35, text: 'Hola a todos, iniciamos la sesión.' },
      { speaker: 'Hablante B', start: 40, end: 85, text: 'De acuerdo, revisemos el presupuesto.' }
    ],
    bookmarks: [
      { time: 10, note: 'Inicio de agenda' }
    ]
  }

  describe('formatTime', () => {
    it('formatea segundos a MM:SS correctamente', () => {
      expect(formatTime(0)).toBe('00:00')
      expect(formatTime(65)).toBe('01:05')
      expect(formatTime(360)).toBe('06:00')
      expect(formatTime(null)).toBe('00:00')
    })
  })

  describe('generateTranscriptMarkdown y generateTranscriptText', () => {
    it('genera Markdown de la conversación con tiempos y hablantes', () => {
      const md = generateTranscriptMarkdown(sampleData)
      expect(md).toContain('# 💬 Conversación Completa: Plan Estratégico 2026')
      expect(md).toContain('**[00:10 - 00:35] Hablante A:**')
      expect(md).toContain('Hola a todos, iniciamos la sesión.')
      expect(md).toContain('**[00:40 - 01:25] Hablante B:**')
    })

    it('genera texto plano universal (.txt) de la conversación', () => {
      const txt = generateTranscriptText(sampleData)
      expect(txt).toContain('CONVERSACIÓN COMPLETA: Plan Estratégico 2026')
      expect(txt).toContain('[00:10 - 00:35] Hablante A:')
      expect(txt).toContain('Hola a todos, iniciamos la sesión.')
    })

    it('maneja fallback de texto crudo si no hay segmentos estructurados', () => {
      const fallbackData = { title: 'Charla', transcript: 'Texto continuo de la reunión.' }
      expect(generateTranscriptMarkdown(fallbackData)).toContain('Texto continuo de la reunión.')
      expect(generateTranscriptText(fallbackData)).toContain('Texto continuo de la reunión.')
    })
  })

  describe('generateExecutiveMarkdown y generateFullDocumentMarkdown', () => {
    it('Minuta Ejecutiva por defecto solo incluye resumen, decisiones y tareas (sin diálogo)', () => {
      const md = generateExecutiveMarkdown(sampleData)
      expect(md).toContain('# 📋 Minuta Ejecutiva: Plan Estratégico 2026')
      expect(md).toContain('## 📌 Resumen Ejecutivo')
      expect(md).toContain('## 🎯 Decisiones Clave')
      expect(md).toContain('## ✅ Tareas y Compromisos')
      expect(md).toContain('| [ ] | Publicar ofertas de empleo | **Laura** | 15/10/2026 |')
      expect(md).not.toContain('## 📝 Transcripción Completa')
    })

    it('Documento Completo incluye la minuta y la transcripción íntegra', () => {
      const fullMd = generateFullDocumentMarkdown(sampleData)
      expect(fullMd).toContain('# 📄 Documento Completo: Plan Estratégico 2026')
      expect(fullMd).toContain('## 📌 Resumen Ejecutivo')
      expect(fullMd).toContain('## 📝 Transcripción Completa')
      expect(fullMd).toContain('**[00:10 - 00:35] Hablante A:** Hola a todos, iniciamos la sesión.')
    })
  })

  describe('generateExecutiveHtml', () => {
    it('genera HTML con estilos para portapapeles', () => {
      const html = generateExecutiveHtml(sampleData)
      expect(html).toContain('📋 Minuta Ejecutiva: Plan Estratégico 2026')
      expect(html).toContain('Publicar ofertas de empleo')
      expect(html).toContain('Laura')
    })
  })

  describe('Descargas en archivo virtual', () => {
    it('downloadTranscriptFile dispara la descarga de archivo .txt', () => {
      const showToast = vi.fn()
      const clickSpy = vi.fn()
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: clickSpy,
        set download(val) { this._download = val },
        get download() { return this._download },
        set href(val) { this._href = val }
      })
      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()

      const res = downloadTranscriptFile(sampleData, 'plan_2026', showToast, 'txt')
      expect(res).toBe(true)
      expect(clickSpy).toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('.txt')
      }))
    })

    it('downloadFullDocumentMarkdown dispara descarga del documento completo en .md', () => {
      const showToast = vi.fn()
      const clickSpy = vi.fn()
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: clickSpy,
        set download(val) { this._download = val },
        set href(val) { this._href = val }
      })
      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()

      const res = downloadFullDocumentMarkdown(sampleData, 'plan_2026', showToast)
      expect(res).toBe(true)
      expect(clickSpy).toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('Documento completo')
      }))
    })
  })

  describe('Copiado al portapapeles', () => {
    it('copyTranscript copia la conversación completa al portapapeles', async () => {
      const showToast = vi.fn()
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      })

      const res = await copyTranscript(sampleData, showToast)
      expect(res).toBe(true)
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('CONVERSACIÓN COMPLETA'))
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: 'Conversación completa copiada al portapapeles'
      }))
    })
  })

  describe('exportExecutivePdf', () => {
    it('soporta modo full (Documento Completo) y modo executive (Minuta Ejecutiva)', async () => {
      const showToast = vi.fn()
      const exportPdfMock = vi.fn().mockResolvedValue(true)
      window.electronAPI = { exportPDF: exportPdfMock }

      // Modo full
      const fullRes = await exportExecutivePdf(sampleData, 'plan_2026', showToast, 'full')
      expect(fullRes).toBe(true)
      expect(exportPdfMock).toHaveBeenCalledWith('documento_completo_plan_2026.pdf')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('Documento completo')
      }))

      // Modo executive
      const execRes = await exportExecutivePdf(sampleData, 'plan_2026', showToast, 'executive')
      expect(execRes).toBe(true)
      expect(exportPdfMock).toHaveBeenCalledWith('minuta_ejecutiva_plan_2026.pdf')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('Minuta ejecutiva')
      }))

      delete window.electronAPI
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadAudioRecording, revealAudioRecording, copyAudioPath } from './audioExport'

describe('audioExport utility', () => {
  const sampleRec = {
    filename: 'reunion_demo.wav',
    path: 'C:\\recordings\\reunion_demo.wav'
  }

  let originalElectronAPI
  let originalClipboard

  beforeEach(() => {
    originalElectronAPI = window.electronAPI
    originalClipboard = navigator.clipboard
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true
    })
    vi.restoreAllMocks()
  })

  describe('downloadAudioRecording', () => {
    it('muestra error si la grabación no es válida', async () => {
      const showToast = vi.fn()
      const res = await downloadAudioRecording(null, showToast)
      expect(res).toBe(false)
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    })

    it('usa electronAPI.saveAudioFile cuando está disponible', async () => {
      const showToast = vi.fn()
      window.electronAPI = {
        saveAudioFile: vi.fn().mockResolvedValue(true)
      }

      const res = await downloadAudioRecording(sampleRec, showToast)
      expect(res).toBe(true)
      expect(window.electronAPI.saveAudioFile).toHaveBeenCalledWith('reunion_demo.wav', 'C:\\recordings\\reunion_demo.wav')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })

    it('maneja cancelación de guardado en Electron sin error', async () => {
      const showToast = vi.fn()
      window.electronAPI = {
        saveAudioFile: vi.fn().mockResolvedValue(false)
      }

      const res = await downloadAudioRecording(sampleRec, showToast)
      expect(res).toBe(false)
      expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    })

    it('realiza fallback web cuando electronAPI no está disponible', async () => {
      delete window.electronAPI
      const showToast = vi.fn()

      const appendSpy = vi.spyOn(document.body, 'appendChild')
      const removeSpy = vi.spyOn(document.body, 'removeChild')

      const res = await downloadAudioRecording(sampleRec, showToast)
      expect(res).toBe(true)
      expect(appendSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })

  describe('revealAudioRecording', () => {
    it('usa electronAPI.showItemInFolder cuando está disponible', async () => {
      const showToast = vi.fn()
      window.electronAPI = {
        showItemInFolder: vi.fn().mockResolvedValue(true)
      }

      const res = await revealAudioRecording(sampleRec, showToast)
      expect(res).toBe(true)
      expect(window.electronAPI.showItemInFolder).toHaveBeenCalledWith('C:\\recordings\\reunion_demo.wav')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }))
    })

    it('muestra aviso si el archivo no existe en disco', async () => {
      const showToast = vi.fn()
      window.electronAPI = {
        showItemInFolder: vi.fn().mockResolvedValue(false)
      }

      const res = await revealAudioRecording(sampleRec, showToast)
      expect(res).toBe(false)
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
    })

    it('copia la ruta al portapapeles si no está en Electron', async () => {
      delete window.electronAPI
      const writeTextMock = vi.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      })

      const showToast = vi.fn()
      const res = await revealAudioRecording(sampleRec, showToast)
      expect(res).toBe(true)
      expect(writeTextMock).toHaveBeenCalledWith('C:\\recordings\\reunion_demo.wav')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }))
    })
  })

  describe('copyAudioPath', () => {
    it('copia la ruta al portapapeles con éxito', async () => {
      const writeTextMock = vi.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      })

      const showToast = vi.fn()
      const res = await copyAudioPath(sampleRec, showToast)
      expect(res).toBe(true)
      expect(writeTextMock).toHaveBeenCalledWith('C:\\recordings\\reunion_demo.wav')
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    })
  })
})

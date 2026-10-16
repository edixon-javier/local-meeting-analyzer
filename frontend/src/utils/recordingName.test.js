import { describe, it, expect } from 'vitest'
import { getRecordingTitle, hasDefaultName, formatDuration, suggestRecordingName, stripExtension } from './recordingName'

describe('recordingName', () => {
  it('detecta los nombres automáticos', () => {
    expect(hasDefaultName('meeting_20261006_195622.mp3')).toBe(true)
    expect(hasDefaultName('Reunion_Diaria.mp3')).toBe(false)
    expect(hasDefaultName('meeting_2026_x.mp3')).toBe(false)
  })

  it('convierte el nombre automático en un título legible con fecha y hora', () => {
    const title = getRecordingTitle('meeting_20201006_195622.mp3')
    expect(title).toMatch(/^Reunión · 6 oct 2020, 19:56$/)
  })

  it('respeta los nombres personalizados', () => {
    expect(getRecordingTitle('Kickoff cliente.mp3')).toBe('Kickoff cliente')
    expect(stripExtension('a.b.wav')).toBe('a.b')
  })

  it('formatea duraciones', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(168.8)).toBe('2:49 min')
    expect(formatDuration(3906)).toBe('1 h 05 min')
    expect(formatDuration(null)).toBeNull()
  })

  it('sugiere un nombre a partir del tema solo para nombres automáticos', () => {
    expect(suggestRecordingName({ filename: 'Mi reunión.mp3', summary_preview: 'Otra cosa' })).toBe('Mi reunión')
    expect(suggestRecordingName({ filename: 'meeting_20261006_195622.mp3', summary_preview: 'Plan de lanzamiento: fechas.' }))
      .toBe('Plan de lanzamiento fechas')
    expect(suggestRecordingName({ filename: 'meeting_20261006_195622.mp3' })).toBe('')
    const long = suggestRecordingName({
      filename: 'meeting_20261006_195622.mp3',
      summary_preview: 'Se acordó revisar el presupuesto del trimestre con el equipo de finanzas antes del viernes',
    })
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith(' ')).toBe(false)
  })
})

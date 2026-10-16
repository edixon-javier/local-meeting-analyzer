import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MarkdownViewer from './MarkdownViewer'
import { extractSuggestions } from '../../utils/markdownHelpers'

describe('extractSuggestions utility', () => {
  it('extrae preguntas sugeridas al final del texto correctamente', () => {
    const raw = `Aquí está el resumen de la reunión.
---
**Preguntas sugeridas:**
- ¿Cuáles son los próximos pasos?
- ¿Quién liderará el despliegue?`

    const { mainText, suggestions } = extractSuggestions(raw)
    expect(mainText).toContain('Aquí está el resumen de la reunión.')
    expect(suggestions).toEqual([
      '¿Cuáles son los próximos pasos?',
      '¿Quién liderará el despliegue?'
    ])
  })

  it('devuelve array vacío si no hay preguntas sugeridas', () => {
    const raw = 'Texto normal sin sugerencias.'
    const { mainText, suggestions } = extractSuggestions(raw)
    expect(mainText).toBe('Texto normal sin sugerencias.')
    expect(suggestions).toEqual([])
  })
})

describe('MarkdownViewer component', () => {
  it('renderiza texto con negrita y listas correctamente', () => {
    const content = `Párrafo principal con **texto en negrita**.

- Elemento uno
- Elemento dos`

    render(<MarkdownViewer content={content} />)

    expect(screen.getByText('texto en negrita')).toBeInTheDocument()
    expect(screen.getByText('Elemento uno')).toBeInTheDocument()
    expect(screen.getByText('Elemento dos')).toBeInTheDocument()
  })

  it('renderiza badges de reunión y timestamps', () => {
    const content = 'Hablamos en **[Reunión: Planificación Q3 - 01/08/2026]** a las [04:15] Carlos dijo algo.'

    render(<MarkdownViewer content={content} />)

    expect(screen.getByText('Reunión: Planificación Q3 - 01/08/2026')).toBeInTheDocument()
    expect(screen.getByText('04:15')).toBeInTheDocument()
  })

  it('permite hacer clic en chips de sugerencias interactivas', () => {
    const onSelect = vi.fn()
    const content = `Resumen listo.
---
**Preguntas sugeridas:**
- ¿Qué tareas tiene Ana?`

    render(<MarkdownViewer content={content} onSelectSuggestion={onSelect} />)

    const chip = screen.getByRole('button', { name: /¿Qué tareas tiene Ana\?/i })
    expect(chip).toBeInTheDocument()

    fireEvent.click(chip)
    expect(onSelect).toHaveBeenCalledWith('¿Qué tareas tiene Ana?')
  })

  it('renderiza texto plano directo cuando isUser es true', () => {
    const userMsg = 'Pregunta del usuario **sin markdown especial**'
    const { container } = render(<MarkdownViewer content={userMsg} isUser={true} />)
    expect(container.textContent).toBe(userMsg)
  })

  it('convierte timestamps en botones interactivos cuando se provee onSeekAudio', () => {
    const onSeek = vi.fn()
    const content = 'Carlos intervino en [04:15] con la propuesta.'

    render(<MarkdownViewer content={content} onSeekAudio={onSeek} />)

    const timeBtn = screen.getByRole('button', { name: /Reproducir audio desde el minuto 04:15/i })
    expect(timeBtn).toBeInTheDocument()
    fireEvent.click(timeBtn)
    expect(onSeek).toHaveBeenCalledWith(255) // 4 * 60 + 15 = 255
  })
})

describe('parseTimestampToSeconds utility', () => {
  it('convierte correctamente formatos MM:SS y HH:MM:SS', async () => {
    const { parseTimestampToSeconds } = await import('../../utils/markdownHelpers')
    expect(parseTimestampToSeconds('00:45')).toBe(45)
    expect(parseTimestampToSeconds('04:15')).toBe(255)
    expect(parseTimestampToSeconds('01:30:10')).toBe(5410)
    expect(parseTimestampToSeconds('')).toBe(0)
  })
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatWithMeeting: vi.fn(),
  offline: false,
}))

vi.mock('../api', () => ({
  chatWithMeeting: mocks.chatWithMeeting,
  chatWithMeetingStream: vi.fn((path, msgs, q, onChunk, opts) =>
    mocks.chatWithMeeting(path, msgs, q, opts).then(r => {
      if (r?.data?.response) onChunk?.(r.data.response)
      return r?.data || r
    })
  ),
}))

vi.mock('../hooks/useSystem', () => ({
  useSystem: () => ({
    systemStatus: { engine: 'local', provider: 'ollama', current_model: 'llama3:8b', ollama_status: 'ready' },
    isBackendOffline: mocks.offline,
  }),
}))

import ChatPanel from './ChatPanel'

const QUESTION = '¿Cuáles fueron las conclusiones y decisiones clave?'

describe('ChatPanel component', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.chatWithMeeting.mockReset()
    mocks.offline = false
  })

  it('un clic en una sugerencia inicial envía la pregunta a chatWithMeeting', async () => {
    mocks.chatWithMeeting.mockResolvedValue({
      data: { response: 'Se acordó lanzar el producto el viernes.' }
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const button = screen.getByRole('button', { name: QUESTION })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mocks.chatWithMeeting).toHaveBeenCalledWith('/test/meeting.wav', [], QUESTION, expect.anything())
    })

    expect(await screen.findByText('Se acordó lanzar el producto el viernes.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Preguntas sugeridas sobre la reunión' })).not.toBeInTheDocument()
  })

  it('escribir y enviar una pregunta funciona correctamente', async () => {
    mocks.chatWithMeeting.mockResolvedValue({
      data: { response: 'Respuesta al usuario.' }
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const input = screen.getByLabelText('Pregunta sobre esta reunión')
    fireEvent.change(input, { target: { value: '¿Quién asistió?' } })

    const sendBtn = screen.getByLabelText('Enviar mensaje')
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(mocks.chatWithMeeting).toHaveBeenCalledWith('/test/meeting.wav', [], '¿Quién asistió?', expect.anything())
    })

    expect(await screen.findByText('Respuesta al usuario.')).toBeInTheDocument()
  })

  it('muestra mensaje de error y permite reintentar', async () => {
    mocks.chatWithMeeting.mockRejectedValueOnce(new Error('Fallo de red'))
    mocks.chatWithMeeting.mockResolvedValueOnce({
      data: { response: 'Respuesta recuperada tras reintento.' }
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const input = screen.getByLabelText('Pregunta sobre esta reunión')
    fireEvent.change(input, { target: { value: '¿Qué tareas hay?' } })
    fireEvent.click(screen.getByLabelText('Enviar mensaje'))

    const errorElements = await screen.findAllByText(/Hubo un error al obtener la respuesta/i)
    expect(errorElements.length).toBeGreaterThan(0)

    const retryBtn = screen.getByRole('button', { name: /Reintentar/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(mocks.chatWithMeeting).toHaveBeenCalledTimes(2)
    })
    const successElements = await screen.findAllByText('Respuesta recuperada tras reintento.')
    expect(successElements.length).toBeGreaterThan(0)
  })

  it('permite cancelar una consulta en curso mediante el botón Detener', async () => {
    mocks.chatWithMeeting.mockImplementation((path, hist, q, opts) => {
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const err = new Error('canceled')
          err.name = 'CanceledError'
          reject(err)
        })
      })
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const input = screen.getByLabelText('Pregunta sobre esta reunión')
    fireEvent.change(input, { target: { value: 'pregunta larga' } })
    fireEvent.click(screen.getByLabelText('Enviar mensaje'))

    const stopBtn = await screen.findByRole('button', { name: /Detener/i })
    expect(stopBtn).toBeInTheDocument()
    fireEvent.click(stopBtn)

    const cancelledElements = await screen.findAllByText('Consulta detenida por el usuario.')
    expect(cancelledElements.length).toBeGreaterThan(0)
  })

  it('muestra el badge de grounding cuando la respuesta lo incluye', async () => {
    mocks.chatWithMeeting.mockResolvedValue({
      data: {
        response: 'Se acordó lanzar el producto el viernes.',
        grounding: {
          level: 'high',
          label: 'Alta concordancia con la grabación'
        }
      }
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const input = screen.getByLabelText('Pregunta sobre esta reunión')
    fireEvent.change(input, { target: { value: '¿Cuándo es el lanzamiento?' } })
    fireEvent.click(screen.getByLabelText('Enviar mensaje'))

    expect(await screen.findByText('Alta concordancia con la grabación')).toBeInTheDocument()
  })

  it('al presionar Nueva consulta archiva la conversación y muestra el botón de sesiones', async () => {
    mocks.chatWithMeeting.mockResolvedValue({
      data: { response: 'Respuesta sobre acuerdos.' }
    })

    render(<ChatPanel audioPath="/test/meeting.wav" />)

    const input = screen.getByLabelText('Pregunta sobre esta reunión')
    fireEvent.change(input, { target: { value: '¿Qué acuerdos hubo?' } })
    fireEvent.click(screen.getByLabelText('Enviar mensaje'))

    expect(await screen.findByText('Respuesta sobre acuerdos.')).toBeInTheDocument()

    // El botón Nueva consulta debe estar presente
    const resetBtn = screen.getByRole('button', { name: /Nueva consulta/i })
    fireEvent.click(resetBtn)

    // La conversación se resetea al saludo inicial
    expect(screen.queryByText('Respuesta sobre acuerdos.')).not.toBeInTheDocument()

    // Aparece el botón de sesiones archivadas
    const sessionsBtn = screen.getByRole('button', { name: /Sesiones \(1\)/i })
    expect(sessionsBtn).toBeInTheDocument()
    fireEvent.click(sessionsBtn)

    // El modal de sesiones se abre y muestra la conversación archivada
    expect(screen.getByText('Consultas de esta reunión')).toBeInTheDocument()
    expect(screen.getByText('¿Qué acuerdos hubo?')).toBeInTheDocument()
  })
})

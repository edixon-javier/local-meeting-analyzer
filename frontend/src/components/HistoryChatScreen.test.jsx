import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chatWithHistory: vi.fn(),
  offline: false,
}));

vi.mock('../api', () => ({
  chatWithHistory: mocks.chatWithHistory,
  chatWithHistoryStream: vi.fn((hist, q, onChunk, opts) =>
    mocks.chatWithHistory(hist, q, opts).then(r => {
      if (r?.data?.response) onChunk?.(r.data.response);
      return r?.data || r;
    })
  ),
}));
vi.mock('../hooks/useSystem', () => ({
  useSystem: () => ({ isBackendOffline: mocks.offline }),
}));
vi.mock('../hooks/useRecordings', () => ({
  useRecordings: () => ({
    recordings: [{ path: 'a', filename: 'a.wav', has_metadata: true }],
    formatDate: () => 'hoy',
  }),
}));

import HistoryChatScreen from './HistoryChatScreen';

const QUESTION = '¿Quién quedó a cargo de las tareas del frontend?';

describe('HistoryChatScreen: preguntas sugeridas', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.chatWithHistory.mockReset();
    mocks.offline = false;
  });

  it('un clic en una sugerencia envía esa pregunta y oculta las sugerencias', async () => {
    mocks.chatWithHistory.mockResolvedValue({ data: { response: 'Respuesta', referenced_meetings: [] } });
    render(<HistoryChatScreen onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: QUESTION }));

    await waitFor(() => expect(mocks.chatWithHistory).toHaveBeenCalledWith([], QUESTION, expect.anything()));
    expect(await screen.findByText('Respuesta')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Preguntas sugeridas' })).not.toBeInTheDocument();
  });

  it('las sugerencias desaparecen en cuanto se envía la primera pregunta, aun sin respuesta', async () => {
    mocks.chatWithHistory.mockReturnValue(new Promise(() => {}));
    render(<HistoryChatScreen onNavigate={vi.fn()} />);
    const chip = screen.getByRole('button', { name: QUESTION });
    fireEvent.click(chip);
    await waitFor(() => expect(mocks.chatWithHistory).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: QUESTION })).not.toBeInTheDocument();
  });

  it('escribir y enviar una pregunta sigue funcionando', async () => {
    mocks.chatWithHistory.mockResolvedValue({ data: { response: 'Ok', referenced_meetings: [] } });
    render(<HistoryChatScreen onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pregunta sobre tus reuniones'), { target: { value: ' hola ' } });
    fireEvent.click(screen.getByRole('button', { name: /Preguntar/ }));
    await waitFor(() => expect(mocks.chatWithHistory).toHaveBeenCalledWith([], 'hola', expect.anything()));
  });

  it('permite cancelar una consulta en curso mediante el botón Detener', async () => {
    mocks.chatWithHistory.mockImplementation((hist, q, opts) => {
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const err = new Error('canceled');
          err.name = 'CanceledError';
          reject(err);
        });
      });
    });

    render(<HistoryChatScreen onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pregunta sobre tus reuniones'), { target: { value: 'consulta larga' } });
    fireEvent.click(screen.getByRole('button', { name: /Preguntar/ }));

    const stopBtn = await screen.findByRole('button', { name: /Detener/i });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);

    expect(await screen.findByText('Consulta detenida por el usuario.')).toBeInTheDocument();
  });

  it('muestra el badge de grounding en las respuestas del historial', async () => {
    mocks.chatWithHistory.mockResolvedValue({
      data: {
        response: 'El presupuesto fue aprobado.',
        referenced_meetings: [{ filename: 'reunion1.wav', category: 'Finanzas', created: 1700000000, snippets: [] }],
        grounding: {
          level: 'high',
          label: 'Alta concordancia (1 reunión y fragmentos verificados)'
        }
      }
    });

    render(<HistoryChatScreen onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pregunta sobre tus reuniones'), { target: { value: 'presupuesto' } });
    fireEvent.click(screen.getByRole('button', { name: /Preguntar/ }));

    expect(await screen.findByText('Alta concordancia (1 reunión y fragmentos verificados)')).toBeInTheDocument();
  });

  it('Nueva consulta archiva la conversación y permite abrir el modal de sesiones', async () => {
    mocks.chatWithHistory.mockResolvedValue({
      data: { response: 'Respuesta global.', referenced_meetings: [] }
    });

    render(<HistoryChatScreen onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pregunta sobre tus reuniones'), { target: { value: '¿Quién lidera backend?' } });
    fireEvent.click(screen.getByRole('button', { name: /Preguntar/ }));

    expect(await screen.findByText('Respuesta global.')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Nueva consulta/i });
    fireEvent.click(resetBtn);

    expect(screen.queryByText('Respuesta global.')).not.toBeInTheDocument();

    const sessionsBtn = screen.getByRole('button', { name: /Sesiones \(1\)/i });
    expect(sessionsBtn).toBeInTheDocument();
    fireEvent.click(sessionsBtn);

    expect(screen.getByText('Historial de consultas globales')).toBeInTheDocument();
    expect(screen.getByText('¿Quién lidera backend?')).toBeInTheDocument();
  });
});

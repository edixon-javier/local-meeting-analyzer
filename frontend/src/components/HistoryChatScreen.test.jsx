import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chatWithHistory: vi.fn(),
  offline: false,
}));

vi.mock('../api', () => ({ chatWithHistory: mocks.chatWithHistory }));
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
    mocks.chatWithHistory.mockReset();
    mocks.offline = false;
  });

  it('un clic en una sugerencia envía esa pregunta y oculta las sugerencias', async () => {
    mocks.chatWithHistory.mockResolvedValue({ data: { response: 'Respuesta', referenced_meetings: [] } });
    render(<HistoryChatScreen onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: QUESTION }));

    await waitFor(() => expect(mocks.chatWithHistory).toHaveBeenCalledWith([], QUESTION));
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
    await waitFor(() => expect(mocks.chatWithHistory).toHaveBeenCalledWith([], 'hola'));
  });
});

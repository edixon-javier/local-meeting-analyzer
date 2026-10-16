import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  testAiProvider: vi.fn(),
  updateConfig: vi.fn(),
  refreshStatus: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock('../../api', () => ({
  getConfig: mocks.getConfig,
  testAiProvider: mocks.testAiProvider,
  updateConfig: mocks.updateConfig,
}));
vi.mock('../../hooks/useSystem', () => ({ useSystem: () => ({ refreshStatus: mocks.refreshStatus }) }));
vi.mock('./openExternal', () => ({ openExternal: mocks.openExternal }));

import OpenAIKeySetup from './OpenAIKeySetup';

function typeKey(value) {
  fireEvent.change(screen.getByLabelText('Clave de OpenAI'), { target: { value } });
}

describe('OpenAIKeySetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfig.mockResolvedValue({ data: { ai_provider: 'local', has_api_key: false } });
  });

  it('prueba la clave y, si funciona, activa OpenAI con un modelo económico', async () => {
    mocks.testAiProvider.mockResolvedValue({ data: { status: 'ok' } });
    mocks.updateConfig.mockResolvedValue({ data: {} });
    render(<OpenAIKeySetup defaultOpen />);
    typeKey('  sk-test-123  ');
    fireEvent.click(screen.getByRole('button', { name: /Probar y usar OpenAI/ }));
    expect(await screen.findByText('Conectado con OpenAI')).toBeInTheDocument();
    expect(mocks.testAiProvider).toHaveBeenCalledWith('openai', 'sk-test-123', 'gpt-4o-mini');
    expect(mocks.updateConfig).toHaveBeenCalledWith({ ai_provider: 'openai', openai_api_key: 'sk-test-123', openai_model: 'gpt-4o-mini' });
    expect(mocks.refreshStatus).toHaveBeenCalled();
  });

  it('no guarda nada si OpenAI rechaza la clave y explica qué hacer', async () => {
    mocks.testAiProvider.mockRejectedValue({ response: { status: 401, data: { detail: 'x' } } });
    render(<OpenAIKeySetup defaultOpen />);
    typeKey('sk-mala');
    fireEvent.click(screen.getByRole('button', { name: /Probar y usar OpenAI/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no reconoce esta clave/);
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('sin saldo ofrece ir a la página de facturación', async () => {
    mocks.testAiProvider.mockRejectedValue({ response: { status: 429, data: {} } });
    render(<OpenAIKeySetup defaultOpen />);
    typeKey('sk-sin-saldo');
    fireEvent.click(screen.getByRole('button', { name: /Probar y usar OpenAI/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Añadir saldo/ }));
    expect(mocks.openExternal).toHaveBeenCalledWith(expect.stringContaining('platform.openai.com'));
  });

  it('avisa si lo pegado no parece una clave de OpenAI', async () => {
    render(<OpenAIKeySetup defaultOpen />);
    typeKey('hola');
    expect(screen.getByText(/empiezan por «sk-»/)).toBeInTheDocument();
  });

  it('muestra conectado si ya estaba configurado OpenAI con clave', async () => {
    mocks.getConfig.mockResolvedValue({ data: { ai_provider: 'openai', has_api_key: true } });
    render(<OpenAIKeySetup />);
    await waitFor(() => expect(screen.getByText('Conectado con OpenAI')).toBeInTheDocument());
  });
});

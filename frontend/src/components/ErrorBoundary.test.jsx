import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

// Canales de soporte sin configurar (marcadores) para probar el estado deshabilitado
vi.mock('../appInfo', async () => ({
  ...(await vi.importActual('../appInfo')),
  ISSUES_URL: '[URL DEL REPOSITORIO]/issues',
  SUPPORT_EMAIL: '[CORREO DE SOPORTE]',
}));

// Componente que siempre lanza un error
const ProblemChild = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  let errorSpy;

  beforeEach(() => {
    // Suprimir los console.error para no ensuciar el log del test (y poder inspeccionarlos)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.electronAPI = {
      getAppInfo: vi.fn().mockResolvedValue({ version: '1.6.0', os: '10.0.26100', arch: 'x64' }),
    };
  });

  afterEach(() => {
    errorSpy.mockRestore();
    delete window.electronAPI;
    delete navigator.clipboard;
    vi.restoreAllMocks();
  });

  it('renderiza children si no hay error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Todo bien</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('muestra la interfaz de fallback cuando ocurre un error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    // Debería mostrar el mensaje de error definido en el ErrorBoundary
    expect(screen.getByText('Algo salió mal.')).toBeInTheDocument();
    expect(screen.getByText('Error: Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recargar Aplicación/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar detalles/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reportar problema/i })).toBeInTheDocument();
  });

  it('usa variables CSS del tema en lugar de colores fijos', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    const title = screen.getByText('Algo salió mal.');
    expect(title.style.color).toBe('var(--red-record)');
  });

  it('registra el error en consola con la pila de componentes (llega a main.log)', async () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    await waitFor(() => {
      const logged = errorSpy.mock.calls.find(
        (args) => typeof args[0] === 'string' && args[0].startsWith('[ErrorBoundary]')
      );
      expect(logged).toBeTruthy();
      expect(logged[0]).toContain('Test error');
      expect(logged[0]).toContain('Pila de componentes');
    });
  });

  it('"Copiar detalles" copia el error, la pila y la versión al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    await waitFor(() => expect(window.electronAPI.getAppInfo).toHaveBeenCalled());
    // Espera a que la versión esté cargada en el estado antes de copiar
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole('button', { name: /Copiar detalles/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('v1.6.0');
    expect(copied).toContain('Error: Test error');
    expect(copied).toContain('Pila de componentes');
    expect(await screen.findByRole('button', { name: /Copiado/i })).toBeInTheDocument();
  });

  it('"Reportar problema" queda deshabilitado mientras el canal de soporte sea un marcador', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /Reportar problema/i })).toBeDisabled();
  });
});

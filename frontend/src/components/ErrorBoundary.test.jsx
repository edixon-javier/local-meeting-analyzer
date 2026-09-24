import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from './ErrorBoundary';

// Componente que siempre lanza un error
const ProblemChild = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  let originalError;

  beforeAll(() => {
    // Suprimir los console.error para no ensuciar el log del test
    originalError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
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
  });
});

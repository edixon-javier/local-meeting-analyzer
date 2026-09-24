import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary atrapó un error: ", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          <h1 style={{ fontSize: '24px', color: '#EF4444' }}>Algo salió mal.</h1>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Ha ocurrido un error inesperado en la interfaz. Por favor reinicia la aplicación.
          </p>
          <details style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '12px' }}>
            {this.state.error && this.state.error.toString()}
          </details>
          <button 
            style={{ marginTop: '2rem' }} 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

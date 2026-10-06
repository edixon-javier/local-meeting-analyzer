import React from 'react';
import Icon from './Icon';
import { canReportProblem, copyText, formatErrorDetails, loadAppInfo, reportProblem } from '../utils/support';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '', info: null, copied: false, notice: '' };
    this.copiedTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const componentStack = errorInfo?.componentStack || '';
    this.setState({ componentStack });
    // Una sola cadena: el proceso principal de Electron la guarda en main.log (renderer, nivel error)
    console.error(`[ErrorBoundary] ${error?.stack || String(error)}\nPila de componentes:${componentStack}`);
    loadAppInfo().then((info) => this.setState({ info }));
  }

  componentWillUnmount() {
    clearTimeout(this.copiedTimer);
  }

  handleCopyDetails = async () => {
    const { error, componentStack, info } = this.state;
    const details = formatErrorDetails({ error, componentStack, info: info || {} });
    const ok = await copyText(details);
    this.setState({ copied: ok, notice: ok ? '' : 'No se pudo copiar. Selecciona el texto de los detalles técnicos manualmente.' });
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.setState({ copied: false }), 2500);
  };

  handleReport = async () => {
    const { error, componentStack, info } = this.state;
    const details = formatErrorDetails({ error, componentStack, info: info || {} });
    const channel = await reportProblem({
      info: info || undefined,
      title: `Error de interfaz: ${error?.message || 'desconocido'}`.slice(0, 120),
      details,
    });
    this.setState({
      notice: channel
        ? 'Se abrió el formulario de reporte. Puedes pegar los detalles técnicos con "Copiar detalles".'
        : 'El canal de soporte aún no está configurado. Usa "Copiar detalles" y envíalos a quien mantiene la aplicación.',
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, copied, notice } = this.state;
      return (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          <h1 style={{ fontSize: '24px', color: 'var(--red-record)' }}>Algo salió mal.</h1>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Ha ocurrido un error inesperado en la interfaz. Puedes recargar la aplicación; si se repite,
            copia los detalles o repórtalo para que podamos corregirlo. Nada se envía automáticamente.
          </p>
          <details style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer' }}>Detalles técnicos</summary>
            <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: 8 }}>
              {error && error.toString()}
            </pre>
          </details>
          <div style={{ marginTop: '2rem', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={this.handleCopyDetails}
            >
              <Icon name={copied ? 'check-circle' : 'copy'} size={15} /> {copied ? 'Copiado' : 'Copiar detalles'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={this.handleReport}
              disabled={!canReportProblem()}
              title={canReportProblem() ? undefined : 'El canal de soporte aún no está configurado'}
            >
              <Icon name="flag" size={15} /> Reportar problema
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              <Icon name="refresh" size={15} /> Recargar Aplicación
            </button>
          </div>
          {notice && (
            <p style={{ marginTop: '1rem', fontSize: 12, color: 'var(--text-secondary)' }}>{notice}</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// src/components/TitleBar.jsx
// Barra de título personalizada para ventana sin bordes (frameless).
// La zona de drag permite mover la ventana.

import logoImg from '../assets/icon.jpg'

export default function TitleBar({ currentView }) {
  const viewLabels = {
    record: 'Grabación',
    analysis: 'Análisis',
    history: 'Historial',
    'history-chat': 'Preguntar al Historial',
  }

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <div className="title-bar">
      <span className="title-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src={logoImg} alt="Logo" style={{ width: 14, height: 14, borderRadius: '2px', objectFit: 'cover' }} />
        Local Meeting Analyzer — {viewLabels[currentView] || ''}
      </span>
      <div className="title-bar-controls">
        <button className="title-bar-btn minimize" onClick={handleMinimize} title="Minimizar">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-btn maximize" onClick={handleMaximize} title="Maximizar">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
        </button>
        <button className="title-bar-btn close" onClick={handleClose} title="Cerrar">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

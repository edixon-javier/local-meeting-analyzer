// src/components/TitleBar.jsx
// Barra de título personalizada para ventana sin bordes (frameless).
// La zona de drag permite mover la ventana.

import logoImg from '../assets/icon.jpg'
import { getRecordingTitle } from '../utils/recordingName'

export default function TitleBar({ currentView, audioPath }) {
  const viewLabels = {
    record: 'Grabación',
    analysis: 'Análisis',
    history: 'Historial',
    'history-chat': 'Preguntar al Historial',
    settings: 'Configuración',
  }

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()
  const handleReload = () => {
    if (window.electronAPI?.reload) {
      window.electronAPI.reload()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="title-bar">
      <span className="title-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src={logoImg} alt="" style={{ width: 14, height: 14, borderRadius: '2px', objectFit: 'cover' }} />
        Local Meeting Analyzer — {currentView === 'analysis' && audioPath
          ? getRecordingTitle(audioPath.split(/[/\\]/).pop())
          : (viewLabels[currentView] || '')}
      </span>
      <div className="title-bar-controls">
        <button
          className="title-bar-btn reload"
          onClick={handleReload}
          title="Recargar interfaz (F5 / Ctrl+R)"
          aria-label="Recargar interfaz de la aplicación"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        <button className="title-bar-btn minimize" onClick={handleMinimize} title="Minimizar" aria-label="Minimizar ventana">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-btn maximize" onClick={handleMaximize} title="Maximizar o restaurar" aria-label="Maximizar o restaurar ventana">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
        </button>
        <button className="title-bar-btn close" onClick={handleClose} title="Cerrar" aria-label="Cerrar ventana">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

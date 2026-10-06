// src/components/SplashScreen.jsx
// Pantalla de inicio (Splash / Loading Screen) que acompaña el ciclo real de inicialización
// del backend y servicios locales antes de dar paso a la interfaz principal.

import { useState, useEffect } from 'react'
import { useSystem } from '../hooks/useSystem'
import Icon from './Icon'
import logoImg from '../assets/icon.jpg'

export default function SplashScreen() {
  const {
    startupPhase,
    startupMessage,
    startupProgress,
    startupError,
    isStartupComplete,
    retryStartup,
  } = useSystem()

  const [isFadingOut, setIsFadingOut] = useState(false)

  // Disparar animación de salida al alcanzar estado 'ready'
  useEffect(() => {
    if (startupPhase === 'ready') {
      const timer = setTimeout(() => {
        setIsFadingOut(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [startupPhase])

  // Desmontar una vez completado el arranque y la animación
  if (isStartupComplete) {
    return null
  }

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <div
      className={`splash-screen ${isFadingOut ? 'splash-screen-exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando aplicación"
    >
      {/* Barra superior de arrastre y controles nativos */}
      <div className="splash-top-bar">
        <div className="splash-drag-handle" />
        <div className="splash-window-controls">
          <button
            type="button"
            className="splash-btn-control"
            onClick={handleMinimize}
            title="Minimizar"
            aria-label="Minimizar ventana"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="splash-btn-control splash-btn-close"
            onClick={handleClose}
            title="Cerrar"
            aria-label="Cerrar aplicación"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenedor central */}
      <div className="splash-container">
        {/* Logo con halo sutil de respiración */}
        <div className="splash-logo-wrapper">
          <div className="splash-logo-glow" />
          <img
            src={logoImg}
            alt="Logo de Local Meeting Analyzer"
            className="splash-logo-image"
          />
        </div>

        <h1 className="splash-title">Local Meeting Analyzer</h1>
        <p className="splash-tagline">Grabación y análisis privado con IA local</p>

        {/* Bloque de Estado o Bloque de Error */}
        {startupPhase !== 'error' ? (
          <div className="splash-status-block">
            {/* Barra de progreso conectada al estado real */}
            <div className="splash-progress-track">
              <div
                className={`splash-progress-bar ${startupPhase === 'ready' ? 'splash-progress-ready' : ''}`}
                style={{ width: `${Math.min(100, Math.max(10, startupProgress))}%` }}
              />
            </div>

            {/* Mensaje descriptivo amigable */}
            <div className="splash-message-row">
              {startupPhase === 'ready' ? (
                <span className="splash-indicator-ready">
                  <Icon name="check" size={14} />
                </span>
              ) : (
                <span className="splash-indicator-spinner" />
              )}
              <span className="splash-message-text">{startupMessage}</span>
            </div>

            {/* Pasos visuales del ciclo de vida */}
            <div className="splash-steps-row" aria-hidden="true">
              <div
                className={`splash-step ${
                  ['initializing', 'connecting', 'preparing', 'ready'].includes(startupPhase) ? 'active' : ''
                }`}
                title="Iniciando"
              >
                <span className="splash-step-dot" />
                <span className="splash-step-label">Inicio</span>
              </div>
              <div
                className={`splash-step ${
                  ['connecting', 'preparing', 'ready'].includes(startupPhase) ? 'active' : ''
                }`}
                title="Conectando"
              >
                <span className="splash-step-dot" />
                <span className="splash-step-label">Motor</span>
              </div>
              <div
                className={`splash-step ${
                  ['preparing', 'ready'].includes(startupPhase) ? 'active' : ''
                }`}
                title="Preparando"
              >
                <span className="splash-step-dot" />
                <span className="splash-step-label">Servicios</span>
              </div>
              <div
                className={`splash-step ${startupPhase === 'ready' ? 'active ready' : ''}`}
                title="Listo"
              >
                <span className="splash-step-dot" />
                <span className="splash-step-label">Listo</span>
              </div>
            </div>
          </div>
        ) : (
          /* Estado de fallo con reintento amigable */
          <div className="splash-error-card">
            <div className="splash-error-icon">
              <Icon name="alert-triangle" size={32} />
            </div>
            <h2 className="splash-error-title">No pudimos iniciar correctamente</h2>
            <p className="splash-error-desc">
              {startupError ||
                'El motor de procesamiento local en el puerto 8765 no respondió dentro del tiempo esperado. Comprueba que no haya otra instancia bloqueando el puerto.'}
            </p>
            <div className="splash-error-actions">
              <button
                type="button"
                className="btn btn-primary splash-btn-action"
                onClick={retryStartup}
              >
                <Icon name="refresh" size={16} />
                Reintentar
              </button>
              <button
                type="button"
                className="btn btn-secondary splash-btn-action"
                onClick={handleClose}
              >
                <Icon name="x" size={16} />
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pie de pantalla discreto */}
      <footer className="splash-footer">
        <span>100% Local &bull; Privacidad Primero &bull; Whisper & Ollama</span>
      </footer>
    </div>
  )
}

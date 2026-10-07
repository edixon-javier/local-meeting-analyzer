// src/App.jsx
// Componente raíz. Gestiona el routing y los atajos de teclado globales.
// El estado global se maneja ahora en SystemContext.

import { useState, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import RecordScreen from './components/RecordScreen'
import AnalysisScreen from './components/AnalysisScreen'
import SettingsScreen from './components/SettingsScreen'
import HistoryScreen from './components/HistoryScreen'
import HistoryChatScreen from './components/HistoryChatScreen'
import Toast from './components/Toast'
import { startRecording, stopRecording } from './api'
import { SystemProvider } from './context/SystemContext'
import { RecordingsProvider } from './context/RecordingsContext'
import { useSystem } from './hooks/useSystem'
import { useRecordings } from './hooks/useRecordings'
import OfflineOverlay from './components/OfflineOverlay'
import SplashScreen from './components/SplashScreen'
import ErrorBoundary from './components/ErrorBoundary'
import WelcomeScreen from './components/onboarding/WelcomeScreen'
import ConsentProvider from './components/onboarding/ConsentProvider'
import { useConsent } from './components/onboarding/useConsent'
import { isOnboardingCompleted } from './components/onboarding/onboardingStorage'
import logoImg from './assets/icon.jpg'
import './index.css'

// Muestra el asistente de bienvenida una vez terminado el splash (y no mientras el backend arranca)
function OnboardingGate({ open, onClose }) {
  const { isStartupComplete } = useSystem()
  if (!open || !isStartupComplete) return null
  return <WelcomeScreen onClose={onClose} />
}

// Componente intermedio para poder usar useSystem() para atajos
function AppContent({ view, setView, audioPath, handleRecordingDone, handleNavigate, onboardingOpen }) {
  const { isRecording, setIsRecording, showToast, isBackendOffline } = useSystem()
  const { loadRecordings } = useRecordings()
  const { ensureConsent, isConsentPending } = useConsent()

  const handleRecordingDoneWrapper = useCallback((path) => {
    loadRecordings({ silent: true })
    handleRecordingDone(path)
  }, [handleRecordingDone, loadRecordings])

  // Registrar listener del atajo global de teclado (Ctrl+Shift+R)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onShortcutToggleRecording) {
      const unsubscribe = window.electronAPI.onShortcutToggleRecording(async () => {
        if (isBackendOffline) {
          showToast({ type: 'error', message: 'No se puede cambiar grabación: Servidor desconectado' })
          return
        }
        // Mientras el asistente de bienvenida o el aviso de consentimiento están abiertos no se graba
        if (!isRecording && onboardingOpen) {
          showToast({ type: 'info', message: 'Termina la configuración inicial para poder grabar.' })
          return
        }
        if (!isRecording && isConsentPending()) return
        try {
          if (isRecording) {
            // Detener grabación
            setIsRecording(false)
            const res = await stopRecording()
            showToast({ type: 'info', message: 'Grabación guardada (Atajo). Procesando...' })
            handleRecordingDoneWrapper(res.data.audio_path)
          } else {
            // El aviso de consentimiento va antes de capturar audio (atajo y menú de la bandeja)
            setView('record')
            const consented = await ensureConsent()
            if (!consented) return
            // Iniciar grabación (el backend usará la fuente configurada)
            setIsRecording(true)
            await startRecording()
            showToast({ type: 'success', message: 'Grabación iniciada (Atajo)' })
          }
        } catch (err) {
          console.error('Error al accionar atajo de teclado global:', err)
          showToast({ type: 'error', message: 'Error al cambiar grabación con atajo' })
          // Revertir estado si falla
          setIsRecording(isRecording)
        }
      })
      return () => unsubscribe()
    }
  }, [isRecording, setIsRecording, showToast, setView, handleRecordingDoneWrapper, isBackendOffline, onboardingOpen, ensureConsent, isConsentPending])

  return (
    <div className="app-body">
      {/* Sidebar de navegación */}
      <Sidebar
        currentView={view}
        currentAudioPath={audioPath}
        onNavigate={handleNavigate}
      />

      {/* Área de contenido principal */}
      <main className="main-content">
        {view === 'record' && (
          <RecordScreen
            onRecordingDone={handleRecordingDoneWrapper}
          />
        )}
        
        {view === 'analysis' && audioPath && (
          <AnalysisScreen
            audioPath={audioPath}
            onBack={() => setView('record')}
          />
        )}

        {view === 'analysis' && !audioPath && (
          <div className="empty-state" style={{ flex: 1 }}>
            <img src={logoImg} alt="" className="empty-state-icon" style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', opacity: 0.6 }} />
            <div className="empty-state-title">Sin grabación</div>
            <div className="empty-state-sub">Primero graba una reunión para poder analizarla.</div>
            <button className="btn btn-primary" onClick={() => setView('record')}>
              Ir a Grabación
            </button>
          </div>
        )}

        {view === 'history' && (
          <HistoryScreen
            onNavigate={handleNavigate}
          />
        )}

        {view === 'history-chat' && (
          <HistoryChatScreen
            onNavigate={handleNavigate}
          />
        )}

        {view === 'settings' && (
          <SettingsScreen />
        )}
      </main>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('record')          // 'record' | 'analysis' | 'history' | 'history-chat' | 'settings'
  const [audioPath, setAudioPath] = useState(null)   // Ruta del WAV grabado
  const [toast, setToast] = useState(null)
  // Asistente de bienvenida: se abre en el primer arranque y cuando Ajustes dispara `onboarding:open`
  const [onboardingOpen, setOnboardingOpen] = useState(() => !isOnboardingCompleted())

  useEffect(() => {
    const openOnboarding = () => setOnboardingOpen(true)
    window.addEventListener('onboarding:open', openOnboarding)
    return () => window.removeEventListener('onboarding:open', openOnboarding)
  }, [])

  const showToast = useCallback((t) => {
    setToast(t)
  }, [])

  const handleRecordingDone = useCallback((path) => {
    setAudioPath(path)
    setView('analysis')
  }, [])

  const handleNavigate = useCallback((newView, data) => {
    setView(newView)
    if (data?.path) setAudioPath(data.path)
  }, [])

  // Garantizar que ninguna navegación desplace el viewport de la ventana
  useEffect(() => {
    window.scrollTo(0, 0)
    if (document.body) document.body.scrollTop = 0
    if (document.documentElement) document.documentElement.scrollTop = 0
  }, [view])

  return (
    <SystemProvider onToast={showToast}>
      <RecordingsProvider>
        <div className="app-layout">
          {/* Barra de título personalizada (frameless) */}
          <TitleBar currentView={view} audioPath={audioPath} />

          <ErrorBoundary>
            <ConsentProvider>
              <AppContent
                view={view}
                setView={setView}
                audioPath={audioPath}
                setAudioPath={setAudioPath}
                handleRecordingDone={handleRecordingDone}
                handleNavigate={handleNavigate}
                onboardingOpen={onboardingOpen}
              />
            </ConsentProvider>
          </ErrorBoundary>

          {/* Barra de estado inferior */}
          <StatusBar onNavigate={handleNavigate} />

          {/* Notificaciones */}
          <Toast toast={toast} onDismiss={() => setToast(null)} />

          {/* Asistente de bienvenida (primer arranque / reabierto desde Ajustes) */}
          <OnboardingGate open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

          {/* Overlay de Backend Offline */}
          <OfflineOverlay />

          {/* Pantalla de Inicio / Splash Screen */}
          <SplashScreen />
        </div>
      </RecordingsProvider>
    </SystemProvider>
  )
}

// src/App.jsx
// Componente raíz. Gestiona el routing y los atajos de teclado globales.
// El estado global se maneja ahora en SystemContext.

import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import RecordScreen from './components/RecordScreen'
import AnalysisScreen from './components/AnalysisScreen'
import SettingsScreen from './components/SettingsScreen'
import HistoryScreen from './components/HistoryScreen'
import Toast from './components/Toast'
import { startRecording, stopRecording } from './api'
import { SystemProvider, useSystem } from './context/SystemContext'
import { RecordingsProvider } from './context/RecordingsContext'
import OfflineOverlay from './components/OfflineOverlay'
import './index.css'

// Componente intermedio para poder usar useSystem() para atajos
function AppContent({ view, setView, audioPath, setAudioPath, handleRecordingDone, handleNavigate }) {
  const { systemStatus, isRecording, setIsRecording, showToast, isBackendOffline } = useSystem()

  // Registrar listener del atajo global de teclado (Ctrl+Shift+R)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onShortcutToggleRecording) {
      const unsubscribe = window.electronAPI.onShortcutToggleRecording(async () => {
        if (isBackendOffline) {
          showToast({ type: 'error', message: 'No se puede cambiar grabación: Servidor desconectado' })
          return
        }
        try {
          if (isRecording) {
            // Detener grabación
            const res = await stopRecording()
            setIsRecording(false)
            showToast({ type: 'info', message: '✅ Grabación guardada (Atajo). Procesando...' })
            handleRecordingDone(res.data.audio_path)
          } else {
            // Iniciar grabación (el backend usará la fuente configurada)
            const res = await startRecording()
            setIsRecording(true)
            showToast({ type: 'success', message: '🎙️ Grabación iniciada (Atajo)' })
            setView('record') // Forzar navegación a la pantalla de grabación
          }
        } catch (err) {
          console.error('Error al accionar atajo de teclado global:', err)
          showToast({ type: 'error', message: 'Error al cambiar grabación con atajo' })
        }
      })
      return () => unsubscribe()
    }
  }, [isRecording, setIsRecording, showToast, setView, handleRecordingDone])

  return (
    <div className="app-body">
      {/* Sidebar de navegación */}
      <Sidebar
        currentView={view}
        onNavigate={handleNavigate}
      />

      {/* Área de contenido principal */}
      <main className="main-content">
        {view === 'record' && (
          <RecordScreen
            onRecordingDone={handleRecordingDone}
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
            <div className="empty-state-icon">🎙️</div>
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

        {view === 'settings' && (
          <SettingsScreen />
        )}
      </main>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('record')          // 'record' | 'analysis' | 'history' | 'settings'
  const [audioPath, setAudioPath] = useState(null)   // Ruta del WAV grabado
  const [toast, setToast] = useState(null)

  const showToast = (t) => {
    setToast(t)
  }

  const handleRecordingDone = (path) => {
    setAudioPath(path)
    setView('analysis')
  }

  const handleNavigate = (newView, data) => {
    setView(newView)
    if (data?.path) setAudioPath(data.path)
  }

  return (
    <SystemProvider onToast={showToast}>
      <RecordingsProvider>
        <div className="app-layout">
          {/* Barra de título personalizada (frameless) */}
          <TitleBar currentView={view} />

          <AppContent 
            view={view} 
            setView={setView}
            audioPath={audioPath}
            setAudioPath={setAudioPath}
            handleRecordingDone={handleRecordingDone}
            handleNavigate={handleNavigate}
          />

          {/* Barra de estado inferior */}
          <StatusBar />

          {/* Notificaciones */}
          <Toast toast={toast} onDismiss={() => setToast(null)} />

          {/* Overlay de Backend Offline */}
          <OfflineOverlay />
        </div>
      </RecordingsProvider>
    </SystemProvider>
  )
}

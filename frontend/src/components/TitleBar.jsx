// src/components/TitleBar.jsx
// Barra de título personalizada para ventana sin bordes (frameless).
// La zona de drag permite mover la ventana.

export default function TitleBar({ currentView }) {
  const viewLabels = {
    record: 'Grabación',
    analysis: 'Análisis',
    history: 'Historial',
  }

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <div className="title-bar">
      <div className="title-bar-controls">
        <button className="title-bar-btn close" onClick={handleClose} title="Cerrar" />
        <button className="title-bar-btn minimize" onClick={handleMinimize} title="Minimizar" />
        <button className="title-bar-btn maximize" onClick={handleMaximize} title="Maximizar" />
      </div>
      <span className="title-bar-title">
        Local Meeting Analyzer — {viewLabels[currentView] || ''}
      </span>
      <div style={{ width: 80 }} />
    </div>
  )
}

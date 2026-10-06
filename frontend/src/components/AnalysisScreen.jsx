import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '../hooks/useSystem'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import { renameSpeaker, addRecordingBookmark, deleteRecordingBookmark, updateRecordingTaskStatus } from '../api'
import { 
  copyExecutiveMinutes, 
  downloadExecutiveMarkdown, 
  exportExecutivePdf 
} from '../utils/minutesExport'
import TranscriptPanel from './analysis/TranscriptPanel'
import InsightsPanel from './analysis/InsightsPanel'
import ChatPanel from './ChatPanel'
import SpeakerRenameModal from './SpeakerRenameModal'
import Icon from './Icon'

export default function AnalysisScreen({ audioPath, onBack }) {
  const { showToast, systemStatus } = useSystem()
  
  const { 
    step, 
    transcript, 
    segments, 
    analysis, 
    bookmarks,
    setBookmarks,
    errorMsg, 
    elapsedSeconds, 
    progressPercent, 
    cancelPipeline, 
    reprocess,
    updateSpeakerInState,
    updateTaskInState
  } = useAnalysisPipeline(audioPath, showToast)

  // Audio Player State
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const audioRef = useRef(null)
  
  const [activeTab, setActiveTab] = useState('insights') // insights | chat

  const formatSegmentTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Speaker Rename Modal State
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false)
  const [selectedSpeaker, setSelectedSpeaker] = useState('')

  const handleOpenRenameSpeaker = (speakerName) => {
    setSelectedSpeaker(speakerName)
    setSpeakerModalOpen(true)
  }

  const handleConfirmRenameSpeaker = async (newSpeakerName) => {
    const filename = audioPath ? audioPath.split(/[/\\]/).pop() : ''
    if (!filename) return
    try {
      await renameSpeaker(filename, selectedSpeaker, newSpeakerName)
      updateSpeakerInState(selectedSpeaker, newSpeakerName)
      showToast({
        type: 'success',
        message: `Hablante renombrado a "${newSpeakerName}" en toda la reunión`
      })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al renombrar el hablante'
      showToast({ type: 'error', message: msg })
      throw err
    }
  }

  const handleAddBookmark = async (time, note = '') => {
    const filename = audioPath ? audioPath.split(/[/\\]/).pop() : ''
    if (!filename) return
    try {
      const res = await addRecordingBookmark(filename, time, note)
      if (res.data?.bookmarks) {
        setBookmarks(res.data.bookmarks)
      }
      showToast({ type: 'success', message: 'Marcador guardado' })
    } catch (err) {
      console.error('Error al agregar marcador:', err)
      showToast({ type: 'error', message: 'Error al agregar marcador' })
    }
  }

  const handleDeleteBookmark = async (bookmarkId) => {
    const filename = audioPath ? audioPath.split(/[/\\]/).pop() : ''
    if (!filename) return
    try {
      const res = await deleteRecordingBookmark(filename, bookmarkId)
      if (res.data?.bookmarks) {
        setBookmarks(res.data.bookmarks)
      }
      showToast({ type: 'info', message: 'Marcador eliminado' })
    } catch (err) {
      console.error('Error al eliminar marcador:', err)
      showToast({ type: 'error', message: 'Error al eliminar marcador' })
    }
  }

  const handleToggleTaskStatus = async (taskIndex, completed) => {
    const filename = audioPath ? audioPath.split(/[/\\]/).pop() : ''
    updateTaskInState(taskIndex, completed)
    if (!filename) return
    try {
      await updateRecordingTaskStatus(filename, taskIndex, completed)
      showToast({
        type: 'success',
        message: completed ? 'Tarea marcada como completada' : 'Tarea desmarcada'
      })
    } catch (err) {
      console.error('Error al actualizar estado de la tarea:', err)
      updateTaskInState(taskIndex, !completed)
      showToast({ type: 'error', message: 'Error al actualizar el estado de la tarea' })
    }
  }

  const selectedSpeakerSegmentsCount = segments
    ? segments.filter(s => s.speaker === selectedSpeaker).length
    : 0

  const cleanTitle = audioPath ? audioPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '') : 'Reunión'

  const getMinutesData = () => ({
    title: cleanTitle,
    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    category: analysis?.category || 'General',
    tone: analysis?.tone || 'Profesional',
    durationInsight: analysis?.duration_insight || '',
    summary: analysis?.summary || [],
    keyDecisions: analysis?.key_decisions || [],
    actionItems: analysis?.action_items || [],
    segments: segments || [],
    transcript: transcript || '',
    bookmarks: bookmarks || []
  })

  const handleCopyMinutes = async () => {
    if (!analysis) return
    await copyExecutiveMinutes(getMinutesData(), showToast)
  }

  const handleDownloadMarkdown = () => {
    if (!analysis) return
    downloadExecutiveMarkdown(getMinutesData(), cleanTitle, showToast)
  }

  const handleExportPDF = async () => {
    if (!analysis) return
    await exportExecutivePdf(getMinutesData(), cleanTitle, showToast)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      if (segments && segments.length > 0) {
        const index = segments.findIndex(seg => time >= seg.start && time <= seg.end + 0.5)
        if (index !== -1 && index !== activeSegmentIndex) {
          setActiveSegmentIndex(index)
        }
      }
    }
  }

  const handleSegmentClick = (start) => {
    if (audioRef.current) {
      audioRef.current.currentTime = start
      audioRef.current.play()
    }
  }

  const changeSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : (playbackSpeed === 1.5 ? 2 : 1)
    setPlaybackSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  useEffect(() => {
    if (activeSegmentIndex !== -1) {
      const activeEl = document.getElementById(`segment-${activeSegmentIndex}`)
      if (activeEl) {
        const container = activeEl.closest('.panel-body') || activeEl.parentElement
        if (container) {
          const topPos = activeEl.offsetTop - container.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2)
          container.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' })
        }
      }
    }
  }, [activeSegmentIndex])

  const handleCancelAndBack = async () => {
    await cancelPipeline()
    onBack()
  }

  const meetingFilename = audioPath ? audioPath.split(/[/\\]/).pop() : 'Reunión'

  // ── Pantallas de Carga y Espera Unificada (Cero sobreposición de loaders) ──
  if (step === 'checking') {
    return (
      <div className="unified-processing-screen">
        <div className="unified-processing-card" style={{ maxWidth: 440 }}>
          <div className="processing-card-header">
            <span className="processing-meeting-title">{meetingFilename}</span>
          </div>
          <div style={{ margin: '24px 0 16px', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner-small" style={{ width: 34, height: 34, borderWidth: 3 }} />
          </div>
          <h2 className="unified-processing-title" style={{ fontSize: 18 }}>Preparando reunión...</h2>
          <p className="unified-processing-sub" style={{ fontSize: 13, marginBottom: 8 }}>
            Verificando datos locales y configurando el motor de análisis.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'processing_busy') {
    return (
      <div className="unified-processing-screen">
        <div className="unified-processing-card">
          <div className="processing-card-header">
            <span className="processing-meeting-title">{meetingFilename}</span>
          </div>
          <div style={{ margin: '16px 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
            <Icon name="clock" size={30} />
          </div>
          <h2 className="unified-processing-title">Proceso previo en cola</h2>
          <p className="unified-processing-sub" style={{ maxWidth: 360 }}>
            El motor de IA está finalizando una tarea anterior o liberando memoria. Puedes esperar o desbloquear el reprocesamiento inmediato.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={reprocess}>
              <Icon name="refresh" size={15} /> Desbloquear y Reprocesar
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              <Icon name="arrow-left" size={15} /> Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'transcribing' || step === 'analyzing') {
    const isCloud = systemStatus?.ai_provider === 'openai'
    const isTranscribing = step === 'transcribing'
    const pct = Math.min(100, Math.max(0, progressPercent || (isTranscribing ? 15 : 95)))
    const strokeDashoffset = 251.2 - (251.2 * pct) / 100

    return (
      <div className="unified-processing-screen">
        <div className="unified-processing-card">
          <div className="processing-card-header">
            <span className="processing-meeting-title">{meetingFilename}</span>
          </div>

          {/* Anillo de Progreso Único (Cero sobreposiciones) */}
          <div className="unified-progress-ring-box">
            <svg className="progress-ring-svg" width="96" height="96" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="var(--border-subtle)"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                className="progress-ring-circle"
                cx="48"
                cy="48"
                r="40"
                stroke="url(#unified-gradient)"
                strokeWidth="6"
                strokeDasharray={251.2}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
              <defs>
                <linearGradient id="unified-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-primary)" />
                  <stop offset="100%" stopColor="var(--accent-violet)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="progress-ring-text">{pct}%</div>
          </div>

          {/* Título de Fase */}
          <h2 className="unified-processing-title">
            {isTranscribing
              ? (isCloud ? 'Transcribiendo con OpenAI Whisper...' : `Transcribiendo con Whisper Local (${systemStatus?.whisper_model || 'small'})...`)
              : (isCloud ? 'Analizando con OpenAI (GPT-4o)...' : 'Analizando con Phi-3 Local (Ollama)...')}
          </h2>

          {/* Subtítulo descriptivo */}
          <p className="unified-processing-sub">
            {isTranscribing
              ? (isCloud
                  ? 'Convirtiendo el audio a texto con el modelo de alta precisión en OpenAI.'
                  : 'El modelo local está procesando el audio en tu equipo con máxima privacidad.')
              : 'Extrayendo puntos clave, resumen ejecutivo, acuerdos y tareas pendientes.'}
          </p>

          {/* Medidor de Tiempo Transcurrido */}
          <div className="processing-elapsed-badge">
            <Icon name="clock" size={13} />
            <span>Tiempo transcurrido: {elapsedSeconds}s</span>
          </div>

          {/* Stepper de Fases del Pipeline */}
          <div className="processing-stages-row">
            <div className="processing-stage-item active">
              <span className="stage-dot">
                <Icon name="check" size={11} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>Audio</span>
            </div>
            <div className="processing-stage-item active">
              <span className="stage-dot">
                {!isTranscribing ? <Icon name="check" size={11} /> : '2'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>Transcripción</span>
            </div>
            <div className={`processing-stage-item ${!isTranscribing ? 'active' : ''}`}>
              <span className="stage-dot">3</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>Análisis IA</span>
            </div>
          </div>

          {/* Botón de Cancelación */}
          <button type="button" className="btn btn-secondary" onClick={handleCancelAndBack}>
            <Icon name="x" size={15} />
            <span>Cancelar Procesamiento</span>
          </button>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="unified-processing-screen">
        <div className="unified-processing-card">
          <div className="processing-card-header">
            <span className="processing-meeting-title">{meetingFilename}</span>
          </div>
          <div style={{ margin: '16px 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
            <Icon name="alert-triangle" size={32} />
          </div>
          <h2 className="unified-processing-title" style={{ color: '#EF4444' }}>Error en el procesamiento</h2>
          <p className="unified-processing-sub" style={{ maxWidth: 360 }}>
            {errorMsg || 'No fue posible completar el procesamiento de la reunión.'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={reprocess}>
              <Icon name="refresh" size={15} /> Reprocesar Audio
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              <Icon name="arrow-left" size={15} /> Volver a Grabación
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Vista completa de análisis ──
  return (
    <div className="analysis-screen">
      <TranscriptPanel 
        audioPath={audioPath}
        transcript={transcript}
        segments={segments}
        step={step}
        onBack={onBack}
        audioRef={audioRef}
        playbackSpeed={playbackSpeed}
        changeSpeed={changeSpeed}
        handleTimeUpdate={handleTimeUpdate}
        activeSegmentIndex={activeSegmentIndex}
        handleSegmentClick={handleSegmentClick}
        formatSegmentTime={formatSegmentTime}
        reprocess={reprocess}
        onOpenRenameSpeaker={handleOpenRenameSpeaker}
        bookmarks={bookmarks}
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
      />

      <div className="insights-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tabs" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`btn btn-sm ${activeTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('insights')}
              style={{ borderRadius: '16px', padding: '6px 12px', fontSize: '13px' }}
            >
              <Icon name="file-text" size={14} /> Resumen
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('chat')}
              style={{ borderRadius: '16px', padding: '6px 12px', fontSize: '13px' }}
            >
              <Icon name="chat" size={14} /> Chat IA
            </button>
          </div>
          
          {activeTab === 'insights' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button 
                onClick={handleCopyMinutes} 
                className="btn btn-secondary btn-sm" 
                title="Copiar Minuta Ejecutiva (lista para Slack/Email en Markdown y formato enriquecido)"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <Icon name="copy" size={14} /> Copiar Minuta
              </button>
              <button 
                onClick={handleDownloadMarkdown} 
                className="btn btn-secondary btn-sm" 
                title="Descargar archivo Markdown (.md) estructurado"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <Icon name="download" size={14} /> Descargar MD
              </button>
              <button 
                onClick={handleExportPDF} 
                className="btn btn-secondary btn-sm" 
                title="Generar y guardar Minuta Ejecutiva en PDF"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <Icon name="file-text" size={14} /> PDF
              </button>
            </div>
          )}
        </div>
        
        <div className="panel-body" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'chat' ? (
            <ChatPanel audioPath={audioPath} />
          ) : (
            <InsightsPanel 
              analysis={analysis} 
              bookmarks={bookmarks}
              onSeekAudio={handleSegmentClick}
              onToggleTask={handleToggleTaskStatus}
              meetingTitle={cleanTitle}
            />
          )}
        </div>
      </div>

      {/* Modal Interactivo de Renombrado de Hablantes */}
      <SpeakerRenameModal
        isOpen={speakerModalOpen}
        oldSpeaker={selectedSpeaker}
        segmentsCount={selectedSpeakerSegmentsCount}
        onConfirm={handleConfirmRenameSpeaker}
        onClose={() => setSpeakerModalOpen(false)}
      />

      {/* Plantilla invisible en pantalla para impresión / PDF formal */}
      {analysis && (
        <div className="executive-print-report" aria-hidden="true">
          <div className="print-header">
            <div className="print-badge-header">MEETING ANALYZER &bull; MINUTA EJECUTIVA OFICIAL</div>
            <h1 className="print-title">📋 Minuta Ejecutiva: {cleanTitle}</h1>
            <div className="print-meta-row">
              <span>📅 {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              <span>🏷️ <strong>Categoría:</strong> {analysis.category || 'General'}</span>
              <span>🎭 <strong>Tono:</strong> {analysis.tone || 'Neutro'}</span>
            </div>
            {analysis.duration_insight && (
              <div className="print-insight-box">
                💡 <strong>Observación:</strong> {analysis.duration_insight}
              </div>
            )}
          </div>

          <div className="print-section">
            <h2 className="print-section-title">📌 Resumen Ejecutivo</h2>
            <ul className="print-summary-list">
              {analysis.summary && analysis.summary.length > 0 ? (
                analysis.summary.map((pt, idx) => <li key={idx}>{pt}</li>)
              ) : (
                <li>Sin puntos de resumen disponibles.</li>
              )}
            </ul>
          </div>

          {bookmarks && bookmarks.length > 0 && (
            <div className="print-section">
              <h2 className="print-section-title">🔖 Momentos Clave Marcados</h2>
              <ul className="print-summary-list">
                {bookmarks.map((bm, idx) => (
                  <li key={idx}>
                    <strong>[{formatSegmentTime(bm.time)}]</strong> {bm.note || 'Momento clave marcado'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.key_decisions && analysis.key_decisions.length > 0 && (
            <div className="print-section">
              <h2 className="print-section-title">🎯 Decisiones Clave</h2>
              <ul className="print-decisions-list">
                {analysis.key_decisions.map((dec, idx) => <li key={idx}>{dec}</li>)}
              </ul>
            </div>
          )}

          <div className="print-section">
            <h2 className="print-section-title">✅ Tareas y Compromisos</h2>
            <table className="print-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>OK</th>
                  <th>Tarea / Acción</th>
                  <th style={{ width: '150px' }}>Responsable</th>
                  <th style={{ width: '130px' }}>Fecha Límite</th>
                </tr>
              </thead>
              <tbody>
                {analysis.action_items && analysis.action_items.length > 0 ? (
                  analysis.action_items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>⬜</td>
                      <td className="task-desc">{item.task}</td>
                      <td><span className="print-pill-assignee">{item.assignee || 'Sin asignar'}</span></td>
                      <td className="task-date">{item.deadline || 'Sin fecha'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>
                      No se identificaron tareas pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="print-section print-page-break">
            <h2 className="print-section-title">📝 Transcripción Completa</h2>
            <div className="print-transcript-list">
              {segments && segments.length > 0 ? (
                segments.map((seg, idx) => (
                  <div key={idx} className="print-transcript-item">
                    <div className="print-transcript-speaker">
                      <strong>👥 {seg.speaker || 'Hablante'}</strong>
                      <span className="print-transcript-time">⏱️ {formatSegmentTime(seg.start)} - {formatSegmentTime(seg.end)}</span>
                    </div>
                    <p className="print-transcript-text">{seg.text}</p>
                  </div>
                ))
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{transcript || 'Sin transcripción.'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '../hooks/useSystem'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import { renameSpeaker, addRecordingBookmark, deleteRecordingBookmark, updateRecordingTaskStatus } from '../api'
import {
  copyExecutiveMinutes,
  downloadExecutiveMarkdown,
  downloadFullDocumentMarkdown,
  downloadTranscriptFile,
  copyTranscript,
  exportExecutivePdf
} from '../utils/minutesExport'
import TranscriptPanel from './analysis/TranscriptPanel'
import InsightsPanel from './analysis/InsightsPanel'
import ChatPanel from './ChatPanel'
import SpeakerRenameModal from './SpeakerRenameModal'
import Modal from './Modal'
import Icon from './Icon'
import '../styles/analysis.css'
import { getRecordingTitle } from '../utils/recordingName'

export default function AnalysisScreen({ audioPath, onBack, onNavigate }) {
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
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [pdfPrintMode, setPdfPrintMode] = useState('full')

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

  // Título legible ("Reunión · 6 oct, 19:56" o el nombre que puso el usuario) y nombre seguro para archivos exportados
  const cleanTitle = audioPath ? getRecordingTitle(audioPath.split(/[/\\]/).pop()) : 'Reunión'
  const exportFileName = cleanTitle.replace(/[<>:"/\\|?*]/g, '-')

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
    downloadExecutiveMarkdown(getMinutesData(), exportFileName, showToast)
  }

  const handleExportPDF = async (mode = 'full') => {
    if (!analysis) return
    setPdfPrintMode(mode)
    await new Promise(resolve => setTimeout(resolve, 50))
    await exportExecutivePdf(getMinutesData(), exportFileName, showToast, mode)
  }

  const handleDownloadTranscript = (format = 'txt') => {
    if (!analysis) return
    downloadTranscriptFile(getMinutesData(), exportFileName, showToast, format)
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
      audioRef.current.play?.()
    }
    if (segments && segments.length > 0) {
      const startNum = typeof start === 'number' ? start : parseFloat(start)
      const exactIndex = segments.findIndex(seg => startNum >= seg.start && startNum <= (seg.end + 0.5))
      const targetIndex = exactIndex !== -1 ? exactIndex : segments.reduce((closest, seg, idx) => {
        return Math.abs(seg.start - startNum) < Math.abs(segments[closest].start - startNum) ? idx : closest
      }, 0)
      setActiveSegmentIndex(targetIndex)
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
        // Aplicar pulso visual para sincronizar visualmente el transcript con el timestamp del chat
        activeEl.classList.remove('chat-timestamp-pulse')
        void activeEl.offsetWidth
        activeEl.classList.add('chat-timestamp-pulse')
      }
    }
  }, [activeSegmentIndex])

  const handleCancelAndBack = async () => {
    await cancelPipeline()
    onBack()
  }


  // ── Pantallas de Carga y Espera Unificada (Cero sobreposición de loaders) ──
  if (step === 'checking') {
    return (
      <div className="unified-processing-screen">
        <div className="unified-processing-card analysis-card-compact">
          <div className="processing-card-header">
            <span className="processing-meeting-title">{cleanTitle}</span>
          </div>
          <div className="analysis-spinner-wrap">
            <div className="spinner-small analysis-spinner-lg" aria-hidden="true" />
          </div>
          <h2 className="unified-processing-title analysis-title-sm">Preparando reunión...</h2>
          <p className="unified-processing-sub analysis-sub-sm">
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
            <span className="processing-meeting-title">{cleanTitle}</span>
          </div>
          <div className="analysis-status-icon is-warning">
            <Icon name="clock" size={30} />
          </div>
          <h2 className="unified-processing-title">Proceso previo en cola</h2>
          <p className="unified-processing-sub analysis-sub-narrow">
            El motor de IA está finalizando una tarea anterior o liberando memoria. Puedes esperar o desbloquear el reprocesamiento inmediato.
          </p>
          <div className="analysis-status-actions">
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
            <span className="processing-meeting-title">{cleanTitle}</span>
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
              : (isCloud ? 'Analizando con OpenAI (GPT-4o)...' : 'Analizando con IA local (Ollama)...')}
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
              <span className="analysis-stage-label">Audio</span>
            </div>
            <div className="processing-stage-item active">
              <span className="stage-dot">
                {!isTranscribing ? <Icon name="check" size={11} /> : '2'}
              </span>
              <span className="analysis-stage-label">Transcripción</span>
            </div>
            <div className={`processing-stage-item ${!isTranscribing ? 'active' : ''}`}>
              <span className="stage-dot">3</span>
              <span className="analysis-stage-label">Análisis IA</span>
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
            <span className="processing-meeting-title">{cleanTitle}</span>
          </div>
          <div className="analysis-status-icon is-error">
            <Icon name="alert-triangle" size={32} />
          </div>
          <h2 className="unified-processing-title analysis-title-error">Error en el procesamiento</h2>
          <p className="unified-processing-sub analysis-sub-narrow">
            {errorMsg || 'No fue posible completar el procesamiento de la reunión.'}
          </p>
          <div className="analysis-status-actions">
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
        meetingTitle={cleanTitle}
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

      <div className="insights-panel analysis-side-panel">
        <div className="panel-header analysis-side-header">
          <div className="tabs analysis-tabs" role="tablist" aria-label="Vista del panel">
            <button
              type="button"
              role="tab"
              id="insights-tab"
              aria-selected={activeTab === 'insights'}
              aria-controls="insights-tabpanel"
              className={`btn btn-sm analysis-tab ${activeTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('insights')}
            >
              <Icon name="file-text" size={14} /> Resumen
            </button>
            <button
              type="button"
              role="tab"
              id="chat-tab"
              aria-selected={activeTab === 'chat'}
              aria-controls="insights-tabpanel"
              className={`btn btn-sm analysis-tab ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('chat')}
            >
              <Icon name="chat" size={14} /> Chat IA
            </button>
          </div>

          {activeTab === 'insights' && (
            <div className="analysis-export-actions" role="group" aria-label="Opciones de exportación">
              <button
                type="button"
                onClick={handleCopyMinutes}
                className="btn btn-secondary btn-square"
                title="Copiar minuta ejecutiva al portapapeles (lista para Slack / Email)"
                aria-label="Copiar minuta al portapapeles"
              >
                <Icon name="copy" size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTranscript('txt')}
                className="btn btn-secondary btn-square"
                title="Descargar conversación completa en texto (.txt)"
                aria-label="Descargar conversación completa"
              >
                <Icon name="chat" size={14} />
              </button>
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="btn btn-secondary btn-square"
                title="Opciones de exportación: Documento Completo, Minuta o Conversación"
                aria-label="Opciones de exportación"
              >
                <Icon name="download" size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleExportPDF('full')}
                className="btn btn-secondary btn-square"
                title="Exportar Documento Completo en PDF"
                aria-label="Exportar documento en PDF"
              >
                <Icon name="file-text" size={14} />
              </button>
            </div>
          )}
        </div>

        <div
          className="panel-body analysis-side-body"
          id="insights-tabpanel"
          role="tabpanel"
          aria-labelledby={activeTab === 'chat' ? 'chat-tab' : 'insights-tab'}
        >
          {activeTab === 'chat' ? (
            <ChatPanel
              audioPath={audioPath}
              onSeekAudio={handleSegmentClick}
              onNavigate={onNavigate}
            />
          ) : (
            <InsightsPanel
              analysis={analysis}
              bookmarks={bookmarks}
              onSeekAudio={handleSegmentClick}
              onToggleTask={handleToggleTaskStatus}
              meetingTitle={cleanTitle}
              audioPath={audioPath}
              filename={audioPath ? audioPath.split(/[/\\]/).pop() : null}
              showToast={showToast}
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

      {/* Modal de Exportación y Descargas Estructuradas */}
      {exportModalOpen && (
        <Modal
          titleId="export-dialog-title"
          onClose={() => setExportModalOpen(false)}
          maxWidth={480}
        >
          <div className="modal-header" style={{ marginBottom: 12 }}>
            <h3 id="export-dialog-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 16 }}>
              <Icon name="download" size={18} /> Exportar Reunión y Documentos
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-square"
              onClick={() => setExportModalOpen(false)}
              aria-label="Cerrar diálogo de exportación"
              style={{ width: 28, height: 28, padding: 0 }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Selecciona el tipo de documento que deseas generar para <strong>{cleanTitle}</strong>:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Opción 1: Documento Completo */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="file-text" size={15} style={{ color: 'var(--accent-primary)' }} />
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Documento Completo</strong>
                <span className="pill" style={{ fontSize: 10, padding: '1px 6px' }}>Recomendado</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                Informe exhaustivo: resumen ejecutivo, decisiones clave, compromisos y la transcripción íntegra de la conversación.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    downloadFullDocumentMarkdown(getMinutesData(), exportFileName, showToast)
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="download" size={13} /> Descargar .md
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setExportModalOpen(false)
                    await handleExportPDF('full')
                  }}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="file-text" size={13} /> Exportar PDF
                </button>
              </div>
            </div>

            {/* Opción 2: Minuta Ejecutiva */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="target" size={15} style={{ color: 'var(--green-ok)' }} />
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Minuta Ejecutiva</strong>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                Resumen ejecutivo de 1 página con decisiones y compromisos clave para compartir en Slack, Teams o Email.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await handleCopyMinutes()
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, minWidth: 90, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="copy" size={13} /> Copiar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    handleDownloadMarkdown()
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, minWidth: 90, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="download" size={13} /> Descargar .md
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setExportModalOpen(false)
                    await handleExportPDF('executive')
                  }}
                  style={{ flex: 1, minWidth: 90, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="file-text" size={13} /> Exportar PDF
                </button>
              </div>
            </div>

            {/* Opción 3: Conversación Completa */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="chat" size={15} style={{ color: 'var(--amber)' }} />
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Conversación Completa</strong>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                Diálogo íntegro segmentado por interlocutor con marcas de tiempo en formato texto universal.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    downloadTranscriptFile(getMinutesData(), exportFileName, showToast, 'txt')
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="download" size={13} /> Texto (.txt)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    downloadTranscriptFile(getMinutesData(), exportFileName, showToast, 'md')
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="download" size={13} /> Diálogo (.md)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await copyTranscript(getMinutesData(), showToast)
                    setExportModalOpen(false)
                  }}
                  style={{ flex: 1, minWidth: 100, justifyContent: 'center', fontSize: 12 }}
                >
                  <Icon name="copy" size={13} /> Copiar Diálogo
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Plantilla invisible en pantalla para impresión / PDF formal */}
      {analysis && (
        <div className="executive-print-report" aria-hidden="true">
          <div className="print-header">
            <div className="print-badge-header">
              {pdfPrintMode === 'executive'
                ? 'MEETING ANALYZER • MINUTA EJECUTIVA OFICIAL'
                : 'MEETING ANALYZER • DOCUMENTO COMPLETO DE REUNIÓN'}
            </div>
            <h1 className="print-title">
              {pdfPrintMode === 'executive' ? '📋 Minuta Ejecutiva: ' : '📄 Documento Completo: '}
              {cleanTitle}
            </h1>
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

          {pdfPrintMode === 'full' && (
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
          )}
        </div>
      )}
    </div>
  )
}

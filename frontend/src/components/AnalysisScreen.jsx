import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '../context/SystemContext'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import { renameSpeaker } from '../api'
import { 
  copyExecutiveMinutes, 
  downloadExecutiveMarkdown, 
  exportExecutivePdf 
} from '../utils/minutesExport'
import TranscriptPanel from './analysis/TranscriptPanel'
import InsightsPanel from './analysis/InsightsPanel'
import ChatPanel from './ChatPanel'
import SpeakerRenameModal from './SpeakerRenameModal'

export default function AnalysisScreen({ audioPath, onBack }) {
  const { showToast, systemStatus } = useSystem()
  
  const { 
    step, 
    transcript, 
    segments, 
    analysis, 
    errorMsg, 
    elapsedSeconds, 
    progressPercent, 
    cancelPipeline, 
    reprocess,
    updateSpeakerInState
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
        message: `👥 Hablante renombrado a "${newSpeakerName}" en toda la reunión`
      })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al renombrar el hablante'
      showToast({ type: 'error', message: msg })
      throw err
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
    transcript: transcript || ''
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

  // ── Pantallas de Carga y Espera ──
  if (step === 'loading') {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" />
        <div className="processing-label">Verificando datos locales...</div>
      </div>
    )
  }

  if (step === 'processing_busy') {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" style={{ borderTopColor: 'var(--accent-violet)', animation: 'spin 1.2s linear infinite' }} />
        <div className="processing-label">Proceso previo en curso o en cola</div>
        <div className="processing-sub" style={{ maxWidth: 500, textAlign: 'center', lineHeight: '1.6', marginBottom: 20 }}>
          El sistema indica que una tarea de IA estaba en ejecución o quedó pendiente de liberación.
          <br /><br />
          Puedes forzar el reprocesamiento inmediato de este archivo.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={reprocess}>
            ⚡ Desbloquear y Reprocesar
          </button>
          <button className="btn btn-secondary" onClick={onBack}>
            Volver Atrás
          </button>
        </div>
      </div>
    )
  }

  if (step === 'transcribing') {
    const isCloud = systemStatus?.ai_provider === 'openai'
    return (
      <div className="processing-overlay">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 96, height: 96, marginBottom: 8 }}>
          <div className="big-spinner" style={{ width: '100%', height: '100%', borderWidth: '4px', borderTopColor: 'var(--accent-primary)', position: 'absolute' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', zIndex: 1 }}>
            {progressPercent}%
          </div>
        </div>
        
        {/* Barra de Progreso Lineal */}
        <div style={{ width: 280, height: 8, background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden', margin: '4px 0 8px' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-violet))', transition: 'width 0.4s ease' }} />
        </div>

        <div className="processing-label">
          Transcribiendo con {isCloud ? 'OpenAI Whisper (Nube)' : `Whisper Local (${systemStatus?.whisper_model || 'small'})`}...
        </div>
        
        <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          ⏱️ Tiempo transcurrido: {elapsedSeconds}s
        </div>

        <div className="processing-sub" style={{ marginBottom: 20, maxWidth: 450 }}>
          {isCloud 
            ? 'Convirtiendo el audio a texto con el modelo de alta precisión en OpenAI.' 
            : 'El modelo local está procesando el audio. El progreso se actualiza automáticamente con cada segmento detectado.'}
        </div>
        
        <button className="btn btn-secondary" onClick={handleCancelAndBack}>
          Cancelar Procesamiento
        </button>
      </div>
    )
  }

  if (step === 'analyzing') {
    const isCloud = systemStatus?.ai_provider === 'openai'
    return (
      <div className="processing-overlay">
        <div className="big-spinner" style={{ borderTopColor: 'var(--accent-violet)', width: 56, height: 56, borderWidth: 4 }} />
        <div className="processing-label">
          Analizando con {isCloud ? 'OpenAI (GPT-4o)' : 'Ollama (Phi-3 Local)'}...
        </div>

        <div style={{ fontSize: 13, color: 'var(--accent-violet)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 8px' }}>
          ⏱️ Tiempo transcurrido: {elapsedSeconds}s
        </div>

        <div className="processing-sub" style={{ marginBottom: 20, maxWidth: 450 }}>
          Extrayendo puntos clave del resumen, tareas pendientes, acuerdos, tono de la reunión y categorías temáticas.
        </div>

        <button className="btn btn-secondary" onClick={handleCancelAndBack}>
          Cancelar Procesamiento
        </button>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="processing-overlay">
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div className="processing-label" style={{ color: '#EF4444' }}>Error en el procesamiento</div>
        <div className="processing-sub" style={{ maxWidth: 450 }}>{errorMsg}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={reprocess}>
            🔄 Reprocesar Audio
          </button>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Volver a Grabación
          </button>
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
      />

      <div className="insights-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tabs" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`btn btn-sm ${activeTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('insights')}
              style={{ borderRadius: '16px', padding: '6px 12px', fontSize: '13px' }}
            >
              🧠 Resumen
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('chat')}
              style={{ borderRadius: '16px', padding: '6px 12px', fontSize: '13px' }}
            >
              💬 Chat IA
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
                📋 Copiar Minuta
              </button>
              <button 
                onClick={handleDownloadMarkdown} 
                className="btn btn-secondary btn-sm" 
                title="Descargar archivo Markdown (.md) estructurado"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                📥 Descargar MD
              </button>
              <button 
                onClick={handleExportPDF} 
                className="btn btn-secondary btn-sm" 
                title="Generar y guardar Minuta Ejecutiva en PDF"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                📄 PDF
              </button>
            </div>
          )}
        </div>
        
        <div className="panel-body" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'chat' ? (
            <ChatPanel audioPath={audioPath} />
          ) : (
            <InsightsPanel analysis={analysis} />
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

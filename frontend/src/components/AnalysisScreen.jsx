import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '../context/SystemContext'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import TranscriptPanel from './analysis/TranscriptPanel'
import InsightsPanel from './analysis/InsightsPanel'
import ChatPanel from './ChatPanel'

export default function AnalysisScreen({ audioPath, onBack }) {
  const { showToast, systemStatus } = useSystem()
  
  const { step, transcript, segments, analysis, errorMsg, cancelPipeline } = useAnalysisPipeline(audioPath, showToast)

  // Audio Player State
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1)
  const audioRef = useRef(null)
  
  const [activeTab, setActiveTab] = useState('insights') // insights | chat

  const progressPercent = systemStatus?.transcription_progress ? Math.round(systemStatus.transcription_progress) : 0

  const formatSegmentTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const generateMarkdown = () => {
    if (!analysis) return ''
    const title = audioPath.split(/[/\\]/).pop().replace(/\.(wav|mp3)$/i, '')
    let md = `# Análisis de Reunión: ${title}\n\n`
    
    md += `## 📊 Información General\n`
    md += `- **Categoría:** ${analysis.category || 'Sin categorizar'}\n`
    md += `- **Tono general:** ${analysis.tone || 'Desconocido'}\n`
    if (analysis.duration_insight) {
      md += `- **Observación de densidad:** ${analysis.duration_insight}\n`
    }
    md += `\n`

    md += `## 📋 Resumen Ejecutivo\n`
    analysis.summary?.forEach(point => {
      md += `- ${point}\n`
    })
    md += `\n`

    if (analysis.key_decisions?.length > 0) {
      md += `## 🎯 Decisiones Clave\n`
      analysis.key_decisions.forEach(d => {
        md += `- ${d}\n`
      })
      md += `\n`
    }

    md += `## ✅ Tareas Pendientes\n`
    if (analysis.action_items?.length > 0) {
      analysis.action_items.forEach(item => {
        md += `- **Tarea:** ${item.task}\n`
        md += `  - **Responsable:** ${item.assignee || 'Sin asignar'}\n`
        md += `  - **Fecha Límite:** ${item.deadline || 'Sin fecha'}\n`
      })
    } else {
      md += `*No se identificaron tareas pendientes.*\n`
    }
    md += `\n`

    md += `## 📝 Transcripción Completa\n`
    if (segments && segments.length > 0) {
      segments.forEach(seg => {
        md += `**[${formatSegmentTime(seg.start)} - ${formatSegmentTime(seg.end)}] ${seg.speaker || 'Hablante'}:** ${seg.text}\n\n`
      })
    } else {
      md += `${transcript}\n`
    }

    return md
  }

  const handleCopyToClipboard = () => {
    const md = generateMarkdown()
    navigator.clipboard.writeText(md)
    showToast({ type: 'success', message: '📋 Formato Markdown copiado al portapapeles' })
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      setCurrentTime(time)
      
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
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeSegmentIndex])

  const handleExportMarkdown = () => {
    const md = generateMarkdown()
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cleanName = audioPath.split(/[/\\]/).pop().replace(/\.(wav|mp3)$/i, '')
    a.href = url
    a.download = `analisis_${cleanName}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', message: '📥 Archivo Markdown (.md) descargado' })
  }

  const handleExportPDF = async () => {
    const cleanName = audioPath.split(/[/\\]/).pop().replace(/\.(wav|mp3)$/i, '')
    const defaultFilename = `analisis_${cleanName}.pdf`
    try {
      const success = await window.electronAPI.exportPDF(defaultFilename)
      if (success) {
        showToast({ type: 'success', message: '📥 PDF exportado correctamente' })
      } else {
        showToast({ type: 'info', message: 'Exportación a PDF cancelada' })
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Error al exportar PDF: ' + err.message })
    }
  }

  const handleCancelAndBack = async () => {
    await cancelPipeline()
    onBack()
  }

  // ── Pantallas de Carga y Espera ──
  if (step === 'loading') {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" />
        <div className="processing-label">Verificando caché local...</div>
      </div>
    )
  }

  if (step === 'processing_busy') {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" style={{ borderTopColor: 'var(--accent-violet)', animation: 'spin 1.2s linear infinite' }} />
        <div className="processing-label">Procesamiento local en curso...</div>
        <div className="processing-sub" style={{ maxWidth: 500, textAlign: 'center', lineHeight: '1.6', marginBottom: 20 }}>
          El sistema está procesando actualmente la transcripción o análisis de otra reunión.
          <br /><br />
          Para optimizar los recursos de tu PC, las tareas de IA se procesan de forma secuencial.
          <br />
          <strong style={{ color: 'var(--text-accent)' }}>Esta pantalla se actualizará automáticamente apenas finalice el proceso actual.</strong>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>
          Volver Atrás
        </button>
      </div>
    )
  }

  if (step === 'transcribing') {
    return (
      <div className="processing-overlay">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 90, height: 90, marginBottom: 10 }}>
          <div className="big-spinner" style={{ width: '100%', height: '100%', borderWidth: '4px', borderTopColor: 'var(--accent-primary)', position: 'absolute' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', zIndex: 1 }}>
            {progressPercent}%
          </div>
        </div>
        <div className="processing-label">Transcribiendo con Whisper...</div>
        <div className="processing-sub" style={{ marginBottom: 20 }}>
          El modelo de IA está convirtiendo el audio a texto. Esto puede tardar unos minutos dependiendo de la duración de la reunión.
        </div>
        <button className="btn btn-secondary" onClick={handleCancelAndBack}>
          Cancelar Procesamiento
        </button>
      </div>
    )
  }

  if (step === 'analyzing') {
    return (
      <div className="processing-overlay">
        <div className="big-spinner" style={{ borderTopColor: 'var(--accent-violet)' }} />
        <div className="processing-label">Analizando con Ollama...</div>
        <div className="processing-sub" style={{ marginBottom: 20 }}>
          La IA local está extrayendo tareas, resumen, tono y categoría de tu reunión.
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
        <div className="processing-label" style={{ color: '#FCA5A5' }}>Error en el procesamiento</div>
        <div className="processing-sub">{errorMsg}</div>
        <button className="btn btn-secondary" onClick={onBack}>← Volver a Grabación</button>
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
                onClick={handleCopyToClipboard} 
                className="btn btn-secondary btn-sm" 
                title="Copiar al portapapeles (Markdown)"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                📋 Copiar
              </button>
              <button 
                onClick={handleExportMarkdown} 
                className="btn btn-secondary btn-sm" 
                title="Exportar archivo Markdown"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                📥 MD
              </button>
              <button 
                onClick={handleExportPDF} 
                className="btn btn-secondary btn-sm" 
                title="Exportar archivo PDF"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                📥 PDF
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
    </div>
  )
}

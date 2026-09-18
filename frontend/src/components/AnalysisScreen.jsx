import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '../context/SystemContext'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import TranscriptPanel from './analysis/TranscriptPanel'
import InsightsPanel from './analysis/InsightsPanel'
import ChatPanel from './ChatPanel'

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
    reprocess 
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

  const generateMarkdown = () => {
    if (!analysis) return ''
    const title = audioPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '')
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

  const handleExportMarkdown = () => {
    const md = generateMarkdown()
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cleanName = audioPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '')
    a.download = `analisis_${cleanName}.md`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', message: '📥 Archivo Markdown (.md) descargado' })
  }

  const handleExportPDF = async () => {
    if (!window.electronAPI?.exportPDF) {
      showToast({ type: 'warning', message: 'La exportación a PDF requiere la aplicación de escritorio' })
      return
    }
    const cleanName = audioPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '')
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

import React from 'react'
import { getAudioUrl } from '../../api'

export default function TranscriptPanel({ 
  audioPath, 
  transcript, 
  segments, 
  step, 
  onBack, 
  audioRef, 
  playbackSpeed, 
  changeSpeed, 
  handleTimeUpdate, 
  activeSegmentIndex, 
  handleSegmentClick,
  formatSegmentTime,
  reprocess
}) {
  return (
    <div className="transcript-panel">
      <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title">
            <span>📝</span>
            Transcripción
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={reprocess} 
              title="Volver a transcribir y analizar esta reunión"
            >
              🔄 Reprocesar
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onBack}>
              + Nueva Reunión
            </button>
          </div>
        </div>
        
        {/* Reproductor de Audio Integrado */}
        {audioPath && step === 'done' && (
          <div className="audio-player-container">
            <button 
              onClick={changeSpeed}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', fontSize: 12, minWidth: 45, background: 'var(--bg-elevated)' }}
              title="Velocidad de reproducción"
            >
              {playbackSpeed}x
            </button>
            <audio 
              ref={audioRef}
              src={getAudioUrl(audioPath)}
              controls
              className="custom-audio-player"
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        )}
      </div>
      <div className="panel-body">
        {segments && segments.length > 0 ? (
          <div className="diarized-chat" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 12 }}>
            {segments.map((seg, i) => (
              <div 
                key={i} 
                id={`segment-${i}`}
                onClick={() => handleSegmentClick(seg.start)}
                className={`chat-bubble glass ${i === activeSegmentIndex ? 'active-segment' : ''}`} 
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: 4, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-accent)' }}>👥 {seg.speaker}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱️ {formatSegmentTime(seg.start)} - {formatSegmentTime(seg.end)}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{seg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          transcript ? (
            <pre className="transcript-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{transcript}</pre>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <div className="empty-state-title">Sin transcripción</div>
              <div className="empty-state-sub">No se encontró texto en el audio.</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

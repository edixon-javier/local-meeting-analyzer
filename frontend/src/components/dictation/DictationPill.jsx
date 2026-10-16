// frontend/src/components/dictation/DictationPill.jsx
// Micro-píldora flotante compacta, transparente, con olas oceánicas fluidas y arrastre.

import React, { useState, useEffect, useRef } from 'react'
import { getDictationStatus, updateConfig, stopDictation, cancelDictation } from '../../api'
import Icon from '../Icon'
import '../../styles/dictation.css'

export default function DictationPill() {
  const [state, setState] = useState('idle') // 'idle' | 'recording' | 'processing' | 'finished'
  const [mode, setMode] = useState('smart_polish') // 'smart_polish' | 'literal'
  const [elapsed, setElapsed] = useState(0)
  const [rms, setRms] = useState(0.0)
  const [finishedMessage, setFinishedMessage] = useState('¡Listo!')
  const timerRef = useRef(null)
  const rmsPollRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const phaseRef = useRef(0)
  const rmsRef = useRef(0)

  // Mantener referencia al RMS en tiempo real para el loop de canvas
  useEffect(() => {
    rmsRef.current = rms
  }, [rms])

  // Asegurar transparencia en el body y html de la micro-píldora
  useEffect(() => {
    document.documentElement.classList.add('pill-mode')
    document.body.classList.add('pill-mode')
    return () => {
      document.documentElement.classList.remove('pill-mode')
      document.body.classList.remove('pill-mode')
    }
  }, [])

  // Escuchar eventos de cambio de estado desde Electron
  useEffect(() => {
    if (window.electronAPI?.onDictationStateChanged) {
      const unsubscribe = window.electronAPI.onDictationStateChanged((eventData) => {
        if (!eventData) return
        const nextState = eventData.state || 'idle'
        setState(nextState)

        if (nextState === 'recording') {
          setElapsed(0)
          setFinishedMessage('¡Listo!')
        } else if (nextState === 'finished') {
          const data = eventData.data
          if (data?.status === 'no_speech_detected') {
            setFinishedMessage('Sin voz')
          } else if (data?.status === 'silence_or_too_short' || data?.status === 'empty_audio') {
            setFinishedMessage('Audio muy corto')
          } else if (data?.detail || eventData.error) {
            setFinishedMessage('Error en dictado')
          } else {
            const wasInjected = data?.injection_result?.injected
            setFinishedMessage(wasInjected ? '¡Inyectado!' : '¡En portapapeles!')
          }
        }
      })
      return () => unsubscribe()
    }
  }, [])

  // Cronómetro durante la grabación
  useEffect(() => {
    if (state === 'recording') {
      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  // Polling de RMS durante la grabación para visualizador reactivo
  useEffect(() => {
    if (state === 'recording') {
      rmsPollRef.current = setInterval(async () => {
        try {
          const res = await getDictationStatus()
          if (res.data) {
            setRms(res.data.rms_level || 0.0)
            if (res.data.mode) setMode(res.data.mode)
          }
        } catch {
          // Ignorar fallos temporales de red
        }
      }, 80)
    } else {
      if (rmsPollRef.current) clearInterval(rmsPollRef.current)
      setRms(0.0)
    }
    return () => {
      if (rmsPollRef.current) clearInterval(rmsPollRef.current)
    }
  }, [state])

  // Motor de olas fluidas amplias en Canvas (estilo oleaje oceánico continuo)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || state !== 'recording') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = (rect.width || 350) * dpr
    canvas.height = (rect.height || 38) * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width || 350
    const height = rect.height || 38

    const render = () => {
      const currentRms = rmsRef.current
      // Movimiento continuo suave como oleaje
      phaseRef.current += 0.024 + currentRms * 0.07
      const phase = phaseRef.current

      ctx.clearRect(0, 0, width, height)

      // 3 olas fluidas amplias con degradado inferior y cresta luminosa
      const waves = [
        {
          crestColor: 'rgba(56, 189, 248, 0.65)', // Cian luminoso
          fillTop: 'rgba(56, 189, 248, 0.22)',
          fillBottom: 'rgba(56, 189, 248, 0.0)',
          freq: 0.011, // Frecuencia baja = onda amplia y larga
          speed: 1.0,
          phaseOffset: 0,
          baseAmp: 7.5,
          voiceAmp: currentRms * 22,
          yCenter: height * 0.52,
        },
        {
          crestColor: 'rgba(129, 140, 248, 0.55)', // Índigo suave
          fillTop: 'rgba(129, 140, 248, 0.18)',
          fillBottom: 'rgba(129, 140, 248, 0.0)',
          freq: 0.014,
          speed: 1.25,
          phaseOffset: 2.3,
          baseAmp: 8.5,
          voiceAmp: currentRms * 26,
          yCenter: height * 0.48,
        },
        {
          crestColor: 'rgba(52, 211, 153, 0.5)', // Esmeralda / Menta
          fillTop: 'rgba(52, 211, 153, 0.16)',
          fillBottom: 'rgba(52, 211, 153, 0.0)',
          freq: 0.009,
          speed: 0.85,
          phaseOffset: 4.1,
          baseAmp: 6.5,
          voiceAmp: currentRms * 20,
          yCenter: height * 0.54,
        },
      ]

      waves.forEach((w) => {
        const totalAmp = Math.min(height * 0.44, w.baseAmp + w.voiceAmp)
        const stepX = 5
        const points = []

        for (let x = 0; x <= width; x += stepX) {
          // Ecuación de ola compuesta (seno principal + modulación suave de cresta)
          const y =
            w.yCenter +
            Math.sin(x * w.freq + phase * w.speed + w.phaseOffset) *
              Math.cos(x * (w.freq * 0.5) - phase * 0.4) *
              totalAmp
          points.push({ x, y })
        }

        // 1. Relleno traslúcido bajo la ola
        ctx.beginPath()
        ctx.moveTo(0, height)
        points.forEach((pt, i) => {
          if (i === 0) ctx.lineTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        })
        ctx.lineTo(width, height)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, w.yCenter - totalAmp, 0, height)
        grad.addColorStop(0, w.fillTop)
        grad.addColorStop(1, w.fillBottom)
        ctx.fillStyle = grad
        ctx.fill()

        // 2. Trazo brillante en la cresta de la ola
        ctx.beginPath()
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        })
        ctx.strokeStyle = w.crestColor
        ctx.lineWidth = 1.4 + currentRms * 1.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      })

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [state])

  // Tecla Escape para cancelar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && state === 'recording') {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state])

  const handleToggleMode = async () => {
    const nextMode = mode === 'smart_polish' ? 'literal' : 'smart_polish'
    setMode(nextMode)
    try {
      await updateConfig({ dictation_mode: nextMode })
    } catch (e) {
      console.warn('Error al cambiar modo de dictado:', e)
    }
  }

  const handleStop = async () => {
    setState('processing')
    try {
      if (window.electronAPI?.dictationStop) {
        await window.electronAPI.dictationStop({ mode })
      } else {
        const res = await stopDictation({ mode, inject: true })
        setState('finished')
        const wasInjected = res.data?.injection_result?.injected
        setFinishedMessage(wasInjected ? '¡Inyectado!' : '¡En portapapeles!')
        setTimeout(() => setState('idle'), 1500)
      }
    } catch (e) {
      console.error('Error al detener dictado:', e)
      setState('finished')
      setFinishedMessage('Error en dictado')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const handleCancel = async () => {
    try {
      if (window.electronAPI?.dictationCancel) {
        await window.electronAPI.dictationCancel()
      } else {
        await cancelDictation()
      }
    } catch (e) {
      console.error('Error al cancelar dictado:', e)
    } finally {
      setState('idle')
    }
  }

  // Soporte de arrastre suave para reposicionar la píldora flotante
  const handleDragStart = (e) => {
    if (e.button !== 0) return // Solo botón izquierdo
    e.preventDefault()

    if (window.electronAPI?.dictationDragStart) {
      window.electronAPI.dictationDragStart({
        screenX: e.screenX,
        screenY: e.screenY,
      })

      const onMouseMove = (moveEvent) => {
        window.electronAPI.dictationDragMove({
          screenX: moveEvent.screenX,
          screenY: moveEvent.screenY,
        })
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        window.electronAPI.dictationDragEnd?.()
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
  }

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="dictation-pill-standalone">
      <div className={`dictation-pill-container ${state}`}>
        {/* Canvas de olas fluidas amplias en toda la caja */}
        {state === 'recording' && (
          <canvas ref={canvasRef} className="pill-wave-canvas" aria-hidden="true" />
        )}

        {state === 'recording' && (
          <>
            {/* Manija de arrastre */}
            <div
              className="pill-drag-handle"
              title="Arrastrar posición"
              onMouseDown={handleDragStart}
            >
              <Icon name="grip-vertical" size={12} />
            </div>

            {/* Micro-indicador REC + Cronómetro */}
            <button
              type="button"
              className="pill-rec-trigger"
              title="Grabando dictado (clic para detener)"
              onClick={handleStop}
            >
              <span className="pill-rec-indicator">
                <span className="pill-status-dot" />
                <span className="pill-rec-pulse-ring" />
              </span>
              <span className="pill-timer">{formatTimer(elapsed)}</span>
            </button>

            <div className="pill-divider" aria-hidden="true" />

            {/* Alternar modo de dictado (Literal vs Ideas) */}
            <button
              type="button"
              className="pill-mode-badge"
              title="Modo de dictado: clic para alternar"
              onClick={handleToggleMode}
            >
              {mode === 'smart_polish' ? '✨ Ideas' : '📝 Literal'}
            </button>

            {/* Espacio elástico para contemplar las olas fluidas */}
            <div className="pill-waves-spacer" />

            <div className="pill-divider" aria-hidden="true" />

            {/* Botón Aceptar: Solo icono en Verde Esmeralda */}
            <button
              type="button"
              className="pill-btn-confirm pill-btn-stop"
              title="Detener e inyectar (Ctrl+Shift+D)"
              onClick={handleStop}
            >
              <Icon name="check" size={13} strokeWidth={2.5} />
            </button>

            {/* Botón Cancelar: Solo icono en Neutro con hover rojo */}
            <button
              type="button"
              className="pill-btn-cancel pill-btn"
              title="Cancelar (Esc)"
              onClick={handleCancel}
            >
              <Icon name="x" size={12} strokeWidth={2.5} />
            </button>
          </>
        )}

        {state === 'processing' && (
          <div className="pill-feedback-cluster">
            <div className="pill-spinner" />
            <span className="pill-feedback-text processing">
              Transcribiendo...
            </span>
          </div>
        )}

        {state === 'finished' && (
          <div className="pill-feedback-cluster">
            <Icon name="check-circle" size={15} style={{ color: '#34D399' }} />
            <span className="pill-feedback-text finished">
              {finishedMessage}
            </span>
          </div>
        )}

        {state === 'idle' && (
          <>
            <div
              className="pill-drag-handle"
              title="Arrastrar posición"
              onMouseDown={handleDragStart}
            >
              <Icon name="grip-vertical" size={12} />
            </div>
            <span className="pill-idle-text">
              Presiona Ctrl+Shift+D para dictar
            </span>
          </>
        )}
      </div>
    </div>
  )
}

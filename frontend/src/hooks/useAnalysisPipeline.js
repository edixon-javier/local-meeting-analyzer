import { useState, useRef, useEffect, useCallback } from 'react'
import { transcribeAudio, analyzeTranscript, getRecordingMetadata, getConfig, getStatus, cancelProcessing } from '../api'

export function useAnalysisPipeline(audioPath, onToast) {
  const [step, setStep] = useState('loading') // loading | transcribing | analyzing | done | error | processing_busy
  const [transcript, setTranscript] = useState('')
  const [segments, setSegments] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)

  const isCancelledRef = useRef(false)
  const onToastRef = useRef(onToast)
  onToastRef.current = onToast

  // Timer para medir tiempo transcurrido durante transcripción y análisis
  useEffect(() => {
    let interval = null
    if (step === 'transcribing' || step === 'analyzing') {
      setElapsedSeconds(0)
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [step])

  // Polling activo de progreso mientras se transcribe
  useEffect(() => {
    let progressInterval = null
    if (step === 'transcribing') {
      setProgressPercent(10)
      let simulatedTick = 10
      progressInterval = setInterval(async () => {
        try {
          const res = await getStatus()
          const backendProgress = res.data?.transcription_progress
          if (backendProgress && backendProgress > 0) {
            setProgressPercent(Math.round(backendProgress))
          } else {
            // Estimación suave para OpenAI Whisper (que no emite streams parciales)
            simulatedTick = Math.min(95, simulatedTick + (simulatedTick < 60 ? 8 : 2))
            setProgressPercent(simulatedTick)
          }
        } catch {
          // Ignorar fallo transitorio de polling
        }
      }, 750)
    } else if (step === 'analyzing') {
      setProgressPercent(95)
    } else if (step === 'done') {
      setProgressPercent(100)
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [step])

  const runPipeline = useCallback(async (path, active) => {
    try {
      const configRes = await getConfig()
      if (isCancelledRef.current || !active) return
      const cfg = configRes.data
      const doDiarize = cfg.diarize || false

      setStep('transcribing')
      let text = ''
      let segs = []
      try {
        const transcribeRes = await transcribeAudio(path, null, doDiarize)
        if (isCancelledRef.current || !active || transcribeRes.data?.status === 'cancelled') return
        text = transcribeRes.data.text
        segs = transcribeRes.data.segments || []
        setTranscript(text)
        setSegments(segs)
      } catch (err) {
        if (isCancelledRef.current || !active) return
        if (err.response?.status === 400 && 
           (err.response.data?.detail?.includes('curso') || err.response.data?.detail?.includes('proceso'))) {
          setStep('processing_busy')
          return
        }
        throw err
      }

      setStep('analyzing')
      try {
        const analyzeRes = await analyzeTranscript(text, segs, path)
        if (isCancelledRef.current || !active) return
        setAnalysis(analyzeRes.data.analysis)
        setStep('done')
        onToastRef.current?.({ type: 'success', message: '🧠 Análisis completado y guardado en local' })
      } catch (err) {
        if (isCancelledRef.current || !active) return
        if (err.response?.status === 400 && 
           (err.response.data?.detail?.includes('curso') || err.response.data?.detail?.includes('proceso'))) {
          setStep('processing_busy')
          return
        }
        throw err
      }
    } catch (err) {
      if (isCancelledRef.current || !active) return
      const msg = err.response?.data?.detail || err.message || 'Error en el pipeline de análisis'
      setErrorMsg(msg)
      setStep('error')
      onToastRef.current?.({ type: 'error', message: msg })
    }
  }, [])

  const checkCacheAndRun = useCallback(async (path, active, forceFresh = false) => {
    await new Promise(resolve => setTimeout(resolve, 80))
    if (!active) return

    try {
      setStep('loading')
      if (!forceFresh) {
        try {
          const cacheRes = await getRecordingMetadata(path)
          if (!active) return
          if (cacheRes.data && cacheRes.data.exists !== false) {
            const meta = cacheRes.data
            const isErrorAnalysis = meta.analysis?.category === 'Error' || (meta.analysis?.summary && meta.analysis.summary[0]?.includes('Error durante'))
            // Si el análisis previo no fue un error, cargar de caché
            if (!isErrorAnalysis && meta.analysis) {
              setTranscript(meta.transcript || '')
              setSegments(meta.segments || [])
              setAnalysis(meta.analysis)
              setStep('done')
              onToastRef.current?.({ type: 'success', message: '⚡ Metadatos cargados desde caché local' })
              return
            }
          }
        } catch {
          // Ignorar fallo de caché
        }
      }

      if (isCancelledRef.current || !active) return

      const statusRes = await getStatus()
      if (!active) return
      if (statusRes.data.processing) {
        setStep('processing_busy')
        return
      }

      runPipeline(path, active)
    } catch (err) {
      if (isCancelledRef.current || !active) return
      setStep('error')
      setErrorMsg(err.message || 'Error al iniciar análisis')
    }
  }, [runPipeline])

  useEffect(() => {
    let active = true
    if (audioPath) {
      isCancelledRef.current = false
      checkCacheAndRun(audioPath, active)
    }
    return () => {
      active = false
    }
  }, [audioPath, checkCacheAndRun])

  const cancelPipeline = async () => {
    isCancelledRef.current = true
    try {
      await cancelProcessing()
      onToastRef.current?.({ type: 'info', message: 'Procesamiento cancelado por el usuario' })
    } catch (err) {
      console.error('Error al cancelar procesamiento:', err)
    }
  }

  const reprocess = async () => {
    isCancelledRef.current = false
    try {
      await cancelProcessing()
    } catch {
      // Ignorar
    }
    setTranscript('')
    setSegments([])
    setAnalysis(null)
    setErrorMsg('')
    checkCacheAndRun(audioPath, true, true)
  }

  const updateSpeakerInState = useCallback((oldSpeaker, newSpeaker) => {
    setSegments(prevSegments => {
      if (!prevSegments) return []
      return prevSegments.map(seg => 
        seg.speaker === oldSpeaker ? { ...seg, speaker: newSpeaker } : seg
      )
    })

    setTranscript(prevTranscript => {
      if (!prevTranscript) return ''
      return prevTranscript.replaceAll(`${oldSpeaker}:`, `${newSpeaker}:`)
    })

    setAnalysis(prevAnalysis => {
      if (!prevAnalysis) return prevAnalysis
      const updatedActionItems = (prevAnalysis.action_items || []).map(item => 
        item.assignee === oldSpeaker ? { ...item, assignee: newSpeaker } : item
      )
      return {
        ...prevAnalysis,
        action_items: updatedActionItems
      }
    })
  }, [])

  return { 
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
  }
}

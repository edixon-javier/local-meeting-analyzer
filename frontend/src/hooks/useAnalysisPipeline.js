import { useState, useRef, useEffect, useCallback } from 'react'
import { transcribeAudio, analyzeTranscript, getRecordingMetadata, getConfig, getStatus, cancelProcessing } from '../api'

export function useAnalysisPipeline(audioPath, onToast) {
  const [step, setStep] = useState('checking') // checking | transcribing | analyzing | done | error | processing_busy
  const [transcript, setTranscript] = useState('')
  const [segments, setSegments] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [bookmarks, setBookmarks] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)

  const isCancelledRef = useRef(false)
  const onToastRef = useRef(onToast)
  onToastRef.current = onToast
  const bookmarksRef = useRef(bookmarks)
  bookmarksRef.current = bookmarks
  const pipelineRanForAudioRef = useRef(null)

  const checkCacheAndRunRef = useRef(null)
  const runPipelineRef = useRef(null)
  const progressPercentRef = useRef(progressPercent)
  progressPercentRef.current = progressPercent

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
    } else if (step === 'processing_busy') {
      let simulatedTick = progressPercentRef.current || 10
      progressInterval = setInterval(async () => {
        try {
          const res = await getStatus()
          if (!res.data.processing) {
            checkCacheAndRunRef.current?.(audioPath, true)
          } else {
            const backendProgress = res.data?.transcription_progress
            if (backendProgress && backendProgress > 0) {
              setProgressPercent(Math.round(backendProgress))
            } else {
              simulatedTick = Math.min(95, simulatedTick + (simulatedTick < 60 ? 5 : 1))
              setProgressPercent(simulatedTick)
            }
          }
        } catch {
          // Ignorar fallo de red temporal
        }
      }, 3000)
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [step, audioPath])

  const runPipeline = useCallback(async (path, active, cachedMeta = null) => {
    try {
      const configRes = await getConfig()
      if (isCancelledRef.current || !active) return
      const cfg = configRes.data
      const doDiarize = cfg.diarize || false

      let text = ''
      let segs = []

      if (cachedMeta && cachedMeta.bookmarks) {
        setBookmarks(cachedMeta.bookmarks)
      }

      // Reanudación: solo nos saltamos la transcripción si existen transcript Y segmentos válidos
      const hasCompletedTranscript = Boolean(
        cachedMeta &&
        cachedMeta.transcript &&
        cachedMeta.transcript.trim() !== '' &&
        cachedMeta.segments &&
        cachedMeta.segments.length > 0
      )

      if (hasCompletedTranscript) {
        text = cachedMeta.transcript
        segs = cachedMeta.segments || []
        setTranscript(text)
        setSegments(segs)
        onToastRef.current?.({ type: 'info', message: 'Reanudando desde transcripción previa...' })
      } else {
        setStep('transcribing')
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
      }

      setStep('analyzing')
      try {
        const bmList = cachedMeta?.bookmarks || bookmarksRef.current
        const analyzeRes = await analyzeTranscript(text, segs, path, bmList)
        if (isCancelledRef.current || !active) return
        setAnalysis(analyzeRes.data.analysis)
        if (analyzeRes.data?.bookmarks) {
          setBookmarks(analyzeRes.data.bookmarks)
        }
        setStep('done')
        onToastRef.current?.({ type: 'success', message: 'Análisis completado y guardado en local' })
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

  runPipelineRef.current = runPipeline

  const checkCacheAndRun = useCallback(async (path, active, forceFresh = false) => {
    if (!active) return

    try {
      let cachedMeta = null
      if (!forceFresh) {
        try {
          const cacheRes = await getRecordingMetadata(path)
          if (!active) return
          if (cacheRes.data && cacheRes.data.exists !== false) {
            cachedMeta = cacheRes.data
            if (cachedMeta.bookmarks) {
              setBookmarks(cachedMeta.bookmarks)
            }
            const isErrorAnalysis = cachedMeta.analysis?.category === 'Error' || (cachedMeta.analysis?.summary && cachedMeta.analysis.summary[0]?.includes('Error durante'))
            // Si el análisis existe y no es de error, terminamos aquí de inmediato sin parpadeos
            if (!isErrorAnalysis && cachedMeta.analysis) {
              setTranscript(cachedMeta.transcript || '')
              setSegments(cachedMeta.segments || [])
              setAnalysis(cachedMeta.analysis)
              setBookmarks(cachedMeta.bookmarks || [])
              setStep('done')
              return
            }
          }
        } catch {
          // Ignorar fallo de caché
        }
      }

      if (isCancelledRef.current || !active) return

      // Comprobar estado del backend con breve reintento si el proceso previo acaba de cerrarse
      let statusRes = await getStatus()
      if (!active) return
      if (statusRes.data.processing) {
        await new Promise(resolve => setTimeout(resolve, 350))
        if (!active) return
        statusRes = await getStatus()
        if (!active) return
        if (statusRes.data.processing) {
          setStep('processing_busy')
          return
        }
      }

      runPipelineRef.current?.(path, active, cachedMeta)
    } catch (err) {
      if (isCancelledRef.current || !active) return
      setStep('error')
      setErrorMsg(err.message || 'Error al iniciar análisis')
    }
  }, [])

  checkCacheAndRunRef.current = checkCacheAndRun

  useEffect(() => {
    let active = true
    if (audioPath) {
      if (pipelineRanForAudioRef.current === audioPath) {
        return
      }
      pipelineRanForAudioRef.current = audioPath
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
    pipelineRanForAudioRef.current = null
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

  const updateTaskInState = useCallback((taskIndex, completed) => {
    setAnalysis(prevAnalysis => {
      if (!prevAnalysis || !prevAnalysis.action_items) return prevAnalysis
      const updatedActionItems = (prevAnalysis.action_items || []).map((item, idx) =>
        idx === taskIndex ? { ...item, completed: Boolean(completed) } : item
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
    bookmarks,
    setBookmarks,
    errorMsg, 
    elapsedSeconds, 
    progressPercent, 
    cancelPipeline, 
    reprocess,
    updateSpeakerInState,
    updateTaskInState
  }
}

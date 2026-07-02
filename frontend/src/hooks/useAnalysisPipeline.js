import { useState, useRef, useEffect } from 'react'
import { transcribeAudio, analyzeTranscript, getRecordingMetadata, getConfig, getStatus, cancelProcessing } from '../api'

export function useAnalysisPipeline(audioPath, onToast) {
  const [step, setStep] = useState('loading') // loading | transcribing | analyzing | done | error | processing_busy
  const [transcript, setTranscript] = useState('')
  const [segments, setSegments] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const isCancelledRef = useRef(false)

  useEffect(() => {
    let active = true
    if (audioPath) {
      isCancelledRef.current = false
      checkCacheAndRun(audioPath, active)
    }
    return () => {
      active = false
    }
  }, [audioPath])

  const checkCacheAndRun = async (path, active) => {
    try {
      setStep('loading')
      try {
        const cacheRes = await getRecordingMetadata(path)
        if (!active) return
        if (cacheRes.data && cacheRes.data.exists !== false) {
          setTranscript(cacheRes.data.transcript || '')
          setSegments(cacheRes.data.segments || [])
          setAnalysis(cacheRes.data.analysis)
          setStep('done')
          if (onToast) onToast({ type: 'success', message: '⚡ Metadatos cargados desde caché local' })
          return
        }
      } catch (err) {
        // Ignore cache miss
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
  }

  const runPipeline = async (path, active) => {
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
        if (isCancelledRef.current || !active) return
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
        if (onToast) onToast({ type: 'success', message: '🧠 Análisis completado y guardado en local' })
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
      if (onToast) onToast({ type: 'error', message: msg })
    }
  }

  const cancelPipeline = async () => {
    isCancelledRef.current = true
    try {
      await cancelProcessing()
      if (onToast) onToast({ type: 'info', message: 'Procesamiento cancelado por el usuario' })
    } catch (err) {
      console.error('Error al cancelar procesamiento:', err)
    }
  }

  return { step, transcript, segments, analysis, errorMsg, cancelPipeline }
}

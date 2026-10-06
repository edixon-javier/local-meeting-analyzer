// frontend/src/hooks/useRecordings.js
import { useContext } from 'react'
import { RecordingsContext } from '../context/recordingsContextDef'

export function useRecordings() {
  const context = useContext(RecordingsContext)
  if (!context) {
    throw new Error('useRecordings debe usarse dentro de un RecordingsProvider')
  }
  return context
}

export default useRecordings

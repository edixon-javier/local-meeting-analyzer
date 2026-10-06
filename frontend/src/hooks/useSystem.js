// frontend/src/hooks/useSystem.js
import { useContext } from 'react'
import { SystemContext } from '../context/systemContextDef'

export function useSystem() {
  const context = useContext(SystemContext)
  if (!context) {
    throw new Error('useSystem debe usarse dentro de un SystemProvider')
  }
  return context
}

export default useSystem

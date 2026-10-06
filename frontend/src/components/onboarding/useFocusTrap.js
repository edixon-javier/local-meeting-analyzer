// src/components/onboarding/useFocusTrap.js
// Gestión de foco para diálogos modales:
//  - Al abrir, mueve el foco al contenedor (o al primer elemento enfocable).
//  - Mantiene Tab / Shift+Tab dentro del diálogo.
//  - Escape llama a onEscape (solo si se proporciona; los diálogos obligatorios no lo pasan).
//  - Al cerrar, devuelve el foco al elemento que lo tenía antes.

import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

export function useFocusTrap(containerRef, active = true, onEscape) {
  const escapeRef = useRef(onEscape)
  useEffect(() => {
    escapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return undefined
    const container = containerRef.current
    const previouslyFocused = document.activeElement

    // Foco inicial en el propio diálogo (el lector de pantalla anuncia su título)
    const focusTimer = setTimeout(() => {
      if (container && !container.contains(document.activeElement)) container.focus()
    }, 0)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && escapeRef.current) {
        e.preventDefault()
        e.stopPropagation()
        escapeRef.current()
        return
      }
      if (e.key !== 'Tab' || !container) return

      const items = getFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (!container.contains(current) || current === container) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && current === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown, true)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [active, containerRef])
}

export default useFocusTrap

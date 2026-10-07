// src/components/Modal.jsx
// Diálogo modal accesible y reutilizable: role="dialog", aria-modal, título enlazado,
// foco atrapado (Tab / Shift+Tab), Esc y clic en el fondo para cerrar, y devolución del foco al cerrar.

import { useRef } from 'react'
import { useFocusTrap } from './onboarding/useFocusTrap'

export default function Modal({
  titleId,
  describedBy,
  onClose,
  children,
  maxWidth = 420,
  // false mientras hay una operación en curso: ni Esc ni el fondo cierran el diálogo
  dismissible = true,
}) {
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, true, dismissible ? onClose : undefined)

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  )
}

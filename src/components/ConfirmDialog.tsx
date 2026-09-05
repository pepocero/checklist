import { AlertTriangle, Check, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  details?: string[]
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previous = document.activeElement
    confirmRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) {
        previous.focus()
      }
    }
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`dialog-icon ${danger ? 'danger' : ''}`}>
          <AlertTriangle size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{message}</p>
        {details && details.length > 0 ? (
          <ul className="dialog-details">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{cancelLabel}</span>
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            <Check size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

import { ArrowLeft, Check, PartyPopper, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

interface CompletionDialogProps {
  open: boolean
  totalTasks: number
  onAccept: () => void
  onReset: () => void
  onGoHome: () => void
}

export function CompletionDialog({
  open,
  totalTasks,
  onAccept,
  onReset,
  onGoHome,
}: CompletionDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previous = document.activeElement
    primaryRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onAccept()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) {
        previous.focus()
      }
    }
  }, [open, onAccept])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" onClick={onAccept}>
      <div
        className="dialog swal-dialog success"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="swal-icon success" aria-hidden="true">
          <PartyPopper size={34} strokeWidth={1.8} />
        </div>
        <h2 id={titleId}>Tarea terminada</h2>
        <p id={descriptionId}>Has completado todas las tareas de esta lista.</p>
        <p className="completion-meta">{totalTasks} tareas</p>
        <div className="dialog-actions swal-actions">
          <button
            ref={primaryRef}
            type="button"
            className="btn btn-primary"
            onClick={onAccept}
          >
            <Check size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Aceptar</span>
          </button>
          <button type="button" className="btn btn-reset" onClick={onReset}>
            <RotateCcw size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Reiniciar tarea</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={onGoHome}>
            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Volver a mis listas</span>
          </button>
        </div>
      </div>
    </div>
  )
}

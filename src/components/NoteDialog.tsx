import { Check, StickyNote, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

interface NoteDialogProps {
  open: boolean
  taskText: string
  note: string
  mode: 'edit' | 'view'
  busy?: boolean
  onSave?: (note: string) => void
  onClose: () => void
}

export function NoteDialog({
  open,
  taskText,
  note,
  mode,
  busy = false,
  onSave,
  onClose,
}: NoteDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(note)

  useEffect(() => {
    if (!open) {
      return
    }

    setDraft(note)
    const previous = document.activeElement

    if (mode === 'edit') {
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) {
        previous.focus()
      }
    }
  }, [open, note, mode, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog note-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-icon">
          <StickyNote size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h2 id={titleId}>{mode === 'edit' ? 'Nota de la tarea' : 'Nota'}</h2>
        <p id={descriptionId} className="note-dialog-task">
          {taskText}
        </p>

        {mode === 'edit' ? (
          <label className="field">
            <span>Nota</span>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              placeholder="Añade un detalle, recordatorio o aclaración…"
              maxLength={1000}
            />
          </label>
        ) : (
          <p className="note-dialog-body">{note}</p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{mode === 'edit' ? 'Cancelar' : 'Cerrar'}</span>
          </button>
          {mode === 'edit' && onSave ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => onSave(draft)}
            >
              <Check size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>{busy ? 'Guardando…' : 'Guardar'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

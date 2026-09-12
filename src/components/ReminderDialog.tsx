import { Bell, BellOff, CalendarPlus, Check, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  defaultReminderLocalValue,
  formatReminderDateTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from '../utils/taskReminder'

interface ReminderDialogProps {
  open: boolean
  taskText: string
  reminderAt: number | null
  mode: 'edit' | 'view'
  busy?: boolean
  error?: string | null
  calendarBusy?: boolean
  onSave?: (reminderAt: number | null) => void
  onAddToCalendar?: () => void
  onClose: () => void
}

export function ReminderDialog({
  open,
  taskText,
  reminderAt,
  mode,
  busy = false,
  error = null,
  calendarBusy = false,
  onSave,
  onAddToCalendar,
  onClose,
}: ReminderDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(
    reminderAt !== null ? toDatetimeLocalValue(reminderAt) : defaultReminderLocalValue(),
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setDraft(
      reminderAt !== null ? toDatetimeLocalValue(reminderAt) : defaultReminderLocalValue(),
    )
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
  }, [open, reminderAt, mode, onClose])

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
          <Bell size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h2 id={titleId}>
          {mode === 'edit' ? 'Recordatorio' : 'Recordatorio programado'}
        </h2>
        <p id={descriptionId} className="note-dialog-task">
          {taskText}
        </p>

        {mode === 'edit' ? (
          <>
            <label className="field">
              <span>Fecha y hora del aviso</span>
              <input
                ref={inputRef}
                type="datetime-local"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p className="field-hint">
              Al programar se abrirá tu calendario para añadir el aviso. Así llega aunque la
              app esté cerrada y el móvil bloqueado. Confirma el evento en el calendario.
            </p>
            {error ? <p className="banner error">{error}</p> : null}
          </>
        ) : reminderAt !== null ? (
          <>
            <p className="note-dialog-body">{formatReminderDateTime(reminderAt)}</p>
            {onAddToCalendar ? (
              <p className="field-hint">
                Si aún no está en el calendario, añádelo para recibir el aviso del sistema.
              </p>
            ) : null}
          </>
        ) : (
          <p className="note-dialog-body">No hay recordatorio.</p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{mode === 'edit' ? 'Cancelar' : 'Cerrar'}</span>
          </button>
          {mode === 'view' && reminderAt !== null && onAddToCalendar ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={calendarBusy}
              onClick={onAddToCalendar}
            >
              <CalendarPlus size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>{calendarBusy ? 'Abriendo…' : 'Calendario'}</span>
            </button>
          ) : null}
          {mode === 'edit' && onSave ? (
            <>
              {reminderAt !== null ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => onSave(null)}
                >
                  <BellOff size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>Quitar</span>
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !draft.trim()}
                onClick={() => {
                  const next = fromDatetimeLocalValue(draft)
                  if (next === null) {
                    return
                  }
                  onSave(next)
                }}
              >
                <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{busy ? 'Guardando…' : 'Programar'}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

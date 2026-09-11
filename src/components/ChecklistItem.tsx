import { Bell, Check, StickyNote } from 'lucide-react'
import type { Task } from '../types'
import { taskHasNote } from '../utils/taskNote'
import { taskHasReminder } from '../utils/taskReminder'

interface ChecklistItemProps {
  task: Task
  onToggle: (taskId: string) => void
  onOpenNote?: (task: Task) => void
  onOpenReminder?: (task: Task) => void
}

export function ChecklistItem({
  task,
  onToggle,
  onOpenNote,
  onOpenReminder,
}: ChecklistItemProps) {
  const hasNote = taskHasNote(task.note)
  const hasReminder = taskHasReminder(task.reminderAt)

  return (
    <label className={`checklist-item ${task.completed ? 'is-done' : ''}`}>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
      />
      <span className="check-box" aria-hidden="true">
        {task.completed ? <Check size={18} strokeWidth={3} /> : null}
      </span>
      <span className="check-text">{task.text}</span>
      <span className="checklist-item-actions">
        {hasReminder && onOpenReminder ? (
          <button
            type="button"
            className="note-btn has-reminder"
            aria-label="Ver recordatorio"
            title="Ver recordatorio"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenReminder(task)
            }}
          >
            <Bell size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
        ) : null}
        {hasNote && onOpenNote ? (
          <button
            type="button"
            className="note-btn has-note"
            aria-label="Ver nota"
            title="Ver nota"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenNote(task)
            }}
          >
            <StickyNote size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </label>
  )
}

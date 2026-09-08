import { Check, StickyNote } from 'lucide-react'
import type { Task } from '../types'
import { taskHasNote } from '../utils/taskNote'

interface ChecklistItemProps {
  task: Task
  onToggle: (taskId: string) => void
  onOpenNote?: (task: Task) => void
}

export function ChecklistItem({ task, onToggle, onOpenNote }: ChecklistItemProps) {
  const hasNote = taskHasNote(task.note)

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
    </label>
  )
}

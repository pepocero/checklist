import { Bell, Check, Star, StickyNote } from 'lucide-react'
import type { Task } from '../types'
import { isSectionTask } from '../utils/taskKind'
import { isHighPriorityTask } from '../utils/taskPriority'
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
  if (isSectionTask(task)) {
    return (
      <div className="checklist-section" role="heading" aria-level={3}>
        <span className="checklist-section-title">{task.text}</span>
      </div>
    )
  }

  const hasNote = taskHasNote(task.note)
  const hasReminder = taskHasReminder(task.reminderAt)
  const isHigh = isHighPriorityTask(task)

  return (
    <label
      className={`checklist-item ${task.completed ? 'is-done' : ''} ${isHigh ? 'is-high-priority' : ''}`}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
      />
      <span className="check-box" aria-hidden="true">
        {task.completed ? <Check size={18} strokeWidth={3} /> : null}
      </span>
      <span className="check-text">
        {isHigh ? (
          <span className="priority-mark" aria-hidden="true">
            <Star size={15} strokeWidth={2.2} />
          </span>
        ) : null}
        <span className="check-text-label">{task.text}</span>
      </span>
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

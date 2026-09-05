import { Check } from 'lucide-react'
import type { Task } from '../types'

interface ChecklistItemProps {
  task: Task
  onToggle: (taskId: string) => void
}

export function ChecklistItem({ task, onToggle }: ChecklistItemProps) {
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
    </label>
  )
}

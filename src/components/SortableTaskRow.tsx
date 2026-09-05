import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { Task } from '../types'

interface SortableTaskRowProps {
  task: Task
  draftText: string
  onDraftChange: (taskId: string, text: string) => void
  onBlur: (task: Task, text: string) => void
  onDelete: (task: Task) => void
}

export function SortableTaskRow({
  task,
  draftText,
  onDraftChange,
  onBlur,
  onDelete,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-task-row ${isDragging ? 'is-dragging' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="drag-handle"
        aria-label="Arrastrar para reordenar"
        title="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <input
        type="text"
        value={draftText}
        aria-label="Texto de la tarea"
        onChange={(event) => onDraftChange(task.id, event.target.value)}
        onBlur={(event) => onBlur(task, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
      />
      <button
        type="button"
        className="icon-btn danger"
        aria-label="Eliminar tarea"
        onClick={() => onDelete(task)}
      >
        <Trash2 size={18} strokeWidth={2.1} />
      </button>
    </div>
  )
}

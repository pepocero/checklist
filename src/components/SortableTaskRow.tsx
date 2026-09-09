import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, StickyNote, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLeftSwipe } from '../hooks/useLeftSwipe'
import type { Task } from '../types'
import { taskHasNote } from '../utils/taskNote'

const DELETE_WIDTH = 76

interface SortableTaskRowProps {
  task: Task
  draftText: string
  closeSwipeSignal?: number
  onDraftChange: (taskId: string, text: string) => void
  onBlur: (task: Task, text: string) => void
  onRevealChange: (taskId: string, revealed: boolean) => void
  onRequestDelete: (taskId: string) => void
  onEditNote: (task: Task) => void
}

export function SortableTaskRow({
  task,
  draftText,
  closeSwipeSignal = 0,
  onDraftChange,
  onBlur,
  onRevealChange,
  onRequestDelete,
  onEditNote,
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

  const {
    offset,
    isOpen,
    isSwiping,
    setSurfaceRef,
    handlers,
    close,
  } = useLeftSwipe({
    openWidth: DELETE_WIDTH,
    closeSignal: closeSwipeSignal,
    disabled: isDragging,
  })

  const onRevealChangeRef = useRef(onRevealChange)
  const revealedRef = useRef(false)
  const hasNote = taskHasNote(task.note)

  onRevealChangeRef.current = onRevealChange

  useEffect(() => {
    if (revealedRef.current !== isOpen) {
      revealedRef.current = isOpen
      onRevealChangeRef.current(task.id, isOpen)
    }
  }, [isOpen, task.id])

  useEffect(() => {
    return () => {
      if (revealedRef.current) {
        onRevealChangeRef.current(task.id, false)
      }
    }
  }, [task.id])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-task-row ${isDragging ? 'is-dragging' : ''} ${isOpen ? 'is-revealed' : ''}`}
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

      <div className="edit-task-swipe">
        <button
          type="button"
          className="edit-task-delete"
          aria-label="Eliminar tarea"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => onRequestDelete(task.id)}
        >
          <Trash2 size={18} strokeWidth={2.1} aria-hidden="true" />
        </button>

        <div
          ref={setSurfaceRef}
          className={`edit-task-front ${isSwiping ? 'is-swiping' : ''}`}
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          {...handlers}
        >
          <input
            type="text"
            value={draftText}
            aria-label="Texto de la tarea"
            onChange={(event) => onDraftChange(task.id, event.target.value)}
            onFocus={() => {
              if (isOpen) {
                close()
              }
            }}
            onBlur={(event) => onBlur(task, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
          <button
            type="button"
            className={`note-btn ${hasNote ? 'has-note' : ''}`}
            aria-label={hasNote ? 'Editar nota' : 'Añadir nota'}
            title={hasNote ? 'Editar nota' : 'Añadir nota'}
            onClick={() => onEditNote(task)}
          >
            <StickyNote size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

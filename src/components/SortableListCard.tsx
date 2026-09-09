import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLeftSwipe } from '../hooks/useLeftSwipe'
import type { TaskListSummary } from '../types'
import { ChecklistProgress } from './ChecklistProgress'

const ACTION_WIDTH = 76
const ACTIONS_WIDTH = ACTION_WIDTH * 2

interface SortableListCardProps {
  list: TaskListSummary
  closeSwipeSignal?: number
  onDelete: (list: TaskListSummary) => void
}

export function SortableListCard({
  list,
  closeSwipeSignal = 0,
  onDelete,
}: SortableListCardProps) {
  const navigate = useNavigate()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id })

  const {
    offset,
    isOpen,
    isSwiping,
    setSurfaceRef,
    handlers,
    shouldIgnoreClick,
  } = useLeftSwipe({
    openWidth: ACTIONS_WIDTH,
    closeSignal: closeSwipeSignal,
    disabled: isDragging,
  })

  function onFrontClick() {
    if (shouldIgnoreClick()) {
      return
    }

    void navigate(`/lista/${list.id}`)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`list-card-row ${isDragging ? 'is-dragging' : ''} ${isOpen ? 'is-revealed' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="drag-handle"
        aria-label={`Reordenar ${list.name}`}
        title="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <div className="list-card-swipe">
        <div className="list-card-actions" aria-hidden={!isOpen}>
          <button
            type="button"
            className="list-card-action edit"
            aria-label={`Editar ${list.name}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => {
              void navigate(`/lista/${list.id}/editar`)
            }}
          >
            <Pencil size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="list-card-action delete"
            aria-label={`Eliminar ${list.name}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => onDelete(list)}
          >
            <Trash2 size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={setSurfaceRef}
          className={`list-card-front ${isSwiping ? 'is-swiping' : ''}`}
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          role="button"
          tabIndex={0}
          aria-label={`Abrir ${list.name}`}
          onClick={onFrontClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onFrontClick()
            }
          }}
          {...handlers}
        >
          <article className="list-card">
            <div className="list-card-top">
              <h2>{list.name}</h2>
            </div>
            <ChecklistProgress
              completed={list.completedTasks}
              total={list.totalTasks}
              compact
            />
          </article>
        </div>
      </div>
    </div>
  )
}

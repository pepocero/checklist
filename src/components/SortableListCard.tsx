import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskListSummary } from '../types'
import { ChecklistProgress } from './ChecklistProgress'

const ACTION_WIDTH = 76
const OPEN_THRESHOLD = 36
const DIRECTION_LOCK = 10

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

  const frontRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const offsetRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const originOffsetRef = useRef(0)
  const axisRef = useRef<'none' | 'horizontal' | 'vertical'>('none')
  const suppressClickRef = useRef(false)

  function applyOffset(next: number) {
    offsetRef.current = next
    setOffset(next)
  }

  function clearPointerTracking() {
    pointerIdRef.current = null
    axisRef.current = 'none'
    setIsSwiping(false)
  }

  useEffect(() => {
    if (closeSwipeSignal > 0) {
      applyOffset(0)
      clearPointerTracking()
      suppressClickRef.current = false
    }
  }, [closeSwipeSignal])

  useEffect(() => {
    if (isDragging) {
      applyOffset(0)
      clearPointerTracking()
      suppressClickRef.current = false
    }
  }, [isDragging])

  function clampOffset(value: number) {
    return Math.min(ACTION_WIDTH, Math.max(-ACTION_WIDTH, value))
  }

  function snapOffset(value: number) {
    if (value <= -OPEN_THRESHOLD) {
      return -ACTION_WIDTH
    }
    if (value >= OPEN_THRESHOLD) {
      return ACTION_WIDTH
    }
    return 0
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDragging || event.button !== 0) {
      return
    }

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    originOffsetRef.current = offsetRef.current
    axisRef.current = 'none'
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId || isDragging) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current

    if (axisRef.current === 'none') {
      if (Math.abs(deltaX) < DIRECTION_LOCK && Math.abs(deltaY) < DIRECTION_LOCK) {
        return
      }

      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        axisRef.current = 'vertical'
        return
      }

      axisRef.current = 'horizontal'
      suppressClickRef.current = true
      setIsSwiping(true)

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Algunos navegadores pueden fallar si el pointer ya terminó.
      }
    }

    if (axisRef.current !== 'horizontal') {
      return
    }

    event.preventDefault()
    applyOffset(clampOffset(originOffsetRef.current + deltaX))
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    const axis = axisRef.current
    const pointerId = event.pointerId

    if (event.currentTarget.hasPointerCapture(pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(pointerId)
      } catch {
        // Ignorar si ya se liberó.
      }
    }

    if (axis === 'horizontal') {
      suppressClickRef.current = true
      applyOffset(snapOffset(offsetRef.current))
    }

    clearPointerTracking()
  }

  function onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    if (axisRef.current === 'horizontal') {
      suppressClickRef.current = true
      applyOffset(snapOffset(offsetRef.current))
    }

    clearPointerTracking()
  }

  function onFrontClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (offsetRef.current !== 0) {
      applyOffset(0)
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
      className={`list-card-row ${isDragging ? 'is-dragging' : ''} ${offset !== 0 ? 'is-revealed' : ''}`}
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
        <button
          type="button"
          className="list-card-action edit"
          aria-label={`Editar ${list.name}`}
          tabIndex={offset > 0 ? 0 : -1}
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
          tabIndex={offset < 0 ? 0 : -1}
          onClick={() => onDelete(list)}
        >
          <Trash2 size={18} strokeWidth={2.1} aria-hidden="true" />
        </button>

        <div
          ref={frontRef}
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onLostPointerCapture={onLostPointerCapture}
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

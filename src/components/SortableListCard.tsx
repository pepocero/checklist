import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskListSummary } from '../types'
import { ChecklistProgress } from './ChecklistProgress'

const ACTION_WIDTH = 76
const ACTIONS_WIDTH = ACTION_WIDTH * 2
const OPEN_THRESHOLD = 40
const DIRECTION_LOCK = 8

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

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    if (closeSwipeSignal > 0) {
      setIsSwiping(false)
      pointerIdRef.current = null
      axisRef.current = 'none'
      suppressClickRef.current = false
      applyOffset(0)
    }
  }, [closeSwipeSignal])

  useEffect(() => {
    if (isDragging) {
      setIsSwiping(false)
      pointerIdRef.current = null
      axisRef.current = 'none'
      suppressClickRef.current = false
      applyOffset(0)
    }
  }, [isDragging])

  function clampOffset(value: number) {
    return Math.min(0, Math.max(-ACTIONS_WIDTH, value))
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
    setIsSwiping(false)
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

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        axisRef.current = 'vertical'
        pointerIdRef.current = null
        return
      }

      axisRef.current = 'horizontal'
      suppressClickRef.current = true
      setIsSwiping(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (axisRef.current !== 'horizontal') {
      return
    }

    event.preventDefault()
    const next = clampOffset(originOffsetRef.current + deltaX)
    applyOffset(next)
  }

  function finishSwipe(pointerId: number, target: HTMLDivElement) {
    if (pointerIdRef.current !== pointerId) {
      return
    }

    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }

    pointerIdRef.current = null
    setIsSwiping(false)

    if (axisRef.current !== 'horizontal') {
      axisRef.current = 'none'
      return
    }

    axisRef.current = 'none'
    const next = offsetRef.current <= -OPEN_THRESHOLD ? -ACTIONS_WIDTH : 0
    if (next !== 0) {
      suppressClickRef.current = true
    }
    applyOffset(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
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

  const isOpen = offset < 0

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
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
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

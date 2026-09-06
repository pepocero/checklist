import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Task } from '../types'

const DELETE_WIDTH = 76
const OPEN_THRESHOLD = 40
const DIRECTION_LOCK = 8

interface SortableTaskRowProps {
  task: Task
  draftText: string
  closeSwipeSignal?: number
  onDraftChange: (taskId: string, text: string) => void
  onBlur: (task: Task, text: string) => void
  onRevealChange: (taskId: string, revealed: boolean) => void
  onRequestDelete: (taskId: string) => void
}

export function SortableTaskRow({
  task,
  draftText,
  closeSwipeSignal = 0,
  onDraftChange,
  onBlur,
  onRevealChange,
  onRequestDelete,
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

  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const offsetRef = useRef(0)
  const revealedRef = useRef(false)
  const onRevealChangeRef = useRef(onRevealChange)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const originOffsetRef = useRef(0)
  const axisRef = useRef<'none' | 'horizontal' | 'vertical'>('none')

  onRevealChangeRef.current = onRevealChange

  function setRevealOffset(next: number) {
    setOffset(next)
    offsetRef.current = next
    const revealed = next < 0
    if (revealedRef.current !== revealed) {
      revealedRef.current = revealed
      onRevealChangeRef.current(task.id, revealed)
    }
  }

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    if (closeSwipeSignal > 0) {
      setIsSwiping(false)
      pointerIdRef.current = null
      axisRef.current = 'none'
      setRevealOffset(0)
    }
  }, [closeSwipeSignal])

  useEffect(() => {
    if (isDragging) {
      setIsSwiping(false)
      pointerIdRef.current = null
      axisRef.current = 'none'
      setRevealOffset(0)
    }
  }, [isDragging])

  useEffect(() => {
    return () => {
      if (revealedRef.current) {
        onRevealChangeRef.current(task.id, false)
      }
    }
  }, [task.id])

  function clampOffset(value: number) {
    return Math.min(0, Math.max(-DELETE_WIDTH, value))
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
      setIsSwiping(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (axisRef.current !== 'horizontal') {
      return
    }

    event.preventDefault()
    const next = clampOffset(originOffsetRef.current + deltaX)
    setOffset(next)
    offsetRef.current = next
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
    const next = offsetRef.current <= -OPEN_THRESHOLD ? -DELETE_WIDTH : 0
    setRevealOffset(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-task-row ${isDragging ? 'is-dragging' : ''} ${offset < 0 ? 'is-revealed' : ''}`}
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
          tabIndex={offset < 0 ? 0 : -1}
          onClick={() => onRequestDelete(task.id)}
        >
          <Trash2 size={18} strokeWidth={2.1} aria-hidden="true" />
        </button>

        <div
          className={`edit-task-front ${isSwiping ? 'is-swiping' : ''}`}
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <input
            type="text"
            value={draftText}
            aria-label="Texto de la tarea"
            onChange={(event) => onDraftChange(task.id, event.target.value)}
            onFocus={() => {
              if (offsetRef.current !== 0) {
                setRevealOffset(0)
              }
            }}
            onBlur={(event) => onBlur(task, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

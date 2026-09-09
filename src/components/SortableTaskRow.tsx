import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, StickyNote, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Task } from '../types'
import { taskHasNote } from '../utils/taskNote'

const DELETE_WIDTH = 76
const OPEN_THRESHOLD = 28
const DIRECTION_LOCK = 6
const AXIS_RATIO = 1.15

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

  const frontRef = useRef<HTMLDivElement>(null)
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
  const suppressNoteClickRef = useRef(false)
  const hasNote = taskHasNote(task.note)

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

  function clearPointerTracking() {
    pointerIdRef.current = null
    axisRef.current = 'none'
    setIsSwiping(false)
  }

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    if (closeSwipeSignal > 0) {
      clearPointerTracking()
      setRevealOffset(0)
    }
  }, [closeSwipeSignal])

  useEffect(() => {
    if (isDragging) {
      clearPointerTracking()
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

  useEffect(() => {
    const node = frontRef.current
    if (!node) {
      return
    }

    const onTouchMove = (event: TouchEvent) => {
      if (axisRef.current === 'horizontal') {
        event.preventDefault()
      }
    }

    node.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      node.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  function clampOffset(value: number) {
    return Math.min(0, Math.max(-DELETE_WIDTH, value))
  }

  function lockHorizontal(target: HTMLDivElement, pointerId: number) {
    axisRef.current = 'horizontal'
    suppressNoteClickRef.current = true
    setIsSwiping(true)

    const active = document.activeElement
    if (active instanceof HTMLElement && target.contains(active)) {
      active.blur()
    }

    try {
      target.setPointerCapture(pointerId)
    } catch {
      // Algunos navegadores pueden fallar si el pointer ya terminó.
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDragging || event.button !== 0) {
      return
    }

    // El asa de arrastre vive fuera; el botón de nota puede iniciar swipe o click.
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    originOffsetRef.current = offsetRef.current
    axisRef.current = 'none'
    suppressNoteClickRef.current = false
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId || isDragging) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (axisRef.current === 'none') {
      if (absX < DIRECTION_LOCK && absY < DIRECTION_LOCK) {
        return
      }

      if (absX >= absY * AXIS_RATIO) {
        lockHorizontal(event.currentTarget, event.pointerId)
      } else if (absY >= absX * AXIS_RATIO) {
        axisRef.current = 'vertical'
        pointerIdRef.current = null
        return
      } else {
        return
      }
    }

    if (axisRef.current !== 'horizontal') {
      return
    }

    event.preventDefault()
    const next = clampOffset(originOffsetRef.current + deltaX)
    setOffset(next)
    offsetRef.current = next
  }

  function finishSwipe(event: ReactPointerEvent<HTMLDivElement>) {
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
      suppressNoteClickRef.current = true
      const next = offsetRef.current <= -OPEN_THRESHOLD ? -DELETE_WIDTH : 0
      setRevealOffset(next)
    }

    clearPointerTracking()
  }

  function onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    if (axisRef.current === 'horizontal') {
      suppressNoteClickRef.current = true
      const next = offsetRef.current <= -OPEN_THRESHOLD ? -DELETE_WIDTH : 0
      setRevealOffset(next)
    }

    clearPointerTracking()
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
          ref={frontRef}
          className={`edit-task-front ${isSwiping ? 'is-swiping' : ''}`}
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishSwipe}
          onPointerCancel={finishSwipe}
          onLostPointerCapture={onLostPointerCapture}
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
          <button
            type="button"
            className={`note-btn ${hasNote ? 'has-note' : ''}`}
            aria-label={hasNote ? 'Editar nota' : 'Añadir nota'}
            title={hasNote ? 'Editar nota' : 'Añadir nota'}
            onClick={() => {
              if (suppressNoteClickRef.current) {
                suppressNoteClickRef.current = false
                return
              }
              onEditNote(task)
            }}
          >
            <StickyNote size={18} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

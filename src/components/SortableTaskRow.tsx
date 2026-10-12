import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Star,
  Heading2,
  ListTodo,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Task } from '../types'
import { isSectionTask } from '../utils/taskKind'
import { isHighPriorityTask } from '../utils/taskPriority'
import { taskHasNote } from '../utils/taskNote'
import { taskHasReminder } from '../utils/taskReminder'

const ACTION_WIDTH = 38
const MIN_FRONT_VISIBLE = 96
const OPEN_THRESHOLD = 28
const DIRECTION_LOCK = 8

interface SortableTaskRowProps {
  task: Task
  draftText: string
  closeSwipeSignal?: number
  highPriorityDisabled?: boolean
  onDraftChange: (taskId: string, text: string) => void
  onBlur: (task: Task, text: string) => void
  onRevealChange: (taskId: string, revealed: boolean) => void
  onRequestDelete: (taskId: string) => void
  onEditNote: (task: Task) => void
  onEditReminder: (task: Task) => void
  onTogglePriority: (task: Task) => void
  onToggleKind: (task: Task) => void
}

export function SortableTaskRow({
  task,
  draftText,
  closeSwipeSignal = 0,
  highPriorityDisabled = false,
  onDraftChange,
  onBlur,
  onRevealChange,
  onRequestDelete,
  onEditNote,
  onEditReminder,
  onTogglePriority,
  onToggleKind,
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

  const swipeRef = useRef<HTMLDivElement>(null)
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
  const isSection = isSectionTask(task)
  const hasNote = !isSection && taskHasNote(task.note)
  const hasReminder = !isSection && taskHasReminder(task.reminderAt)
  const isHigh = isHighPriorityTask(task)
  const actionCount = isSection ? 2 : 5
  const actionsWidth = ACTION_WIDTH * actionCount
  const isOpen = offset < -4

  onRevealChangeRef.current = onRevealChange

  function getMaxReveal(): number {
    const rowWidth = swipeRef.current?.clientWidth ?? 280
    const maxBySpace = Math.max(ACTION_WIDTH, rowWidth - MIN_FRONT_VISIBLE)
    return Math.min(actionsWidth, maxBySpace)
  }

  function setRevealOffset(next: number) {
    setOffset(next)
    offsetRef.current = next
    const revealed = next < -4
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
    return Math.min(0, Math.max(-getMaxReveal(), value))
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
    const maxReveal = getMaxReveal()
    const next = offsetRef.current <= -OPEN_THRESHOLD ? -maxReveal : 0
    setRevealOffset(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.pointerId, event.currentTarget)
  }

  function closeSwipe() {
    setRevealOffset(0)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-task-row ${isDragging ? 'is-dragging' : ''} ${isOpen ? 'is-revealed' : ''} ${isSection ? 'is-section' : ''} ${isHigh ? 'is-high-priority' : ''}`}
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

      <div
        ref={swipeRef}
        className={`edit-task-swipe ${isSwiping ? 'is-swiping' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="edit-task-actions-panel"
          style={{ width: actionsWidth }}
          aria-hidden={!isOpen}
        >
          <button
            type="button"
            className={`edit-task-action kind ${isSection ? 'is-section-kind' : ''}`}
            aria-label={isSection ? 'Convertir en tarea' : 'Convertir en sección'}
            title={isSection ? 'Convertir en tarea' : 'Convertir en sección'}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => onToggleKind(task)}
          >
            {isSection ? (
              <ListTodo size={16} strokeWidth={2.1} aria-hidden="true" />
            ) : (
              <Heading2 size={16} strokeWidth={2.1} aria-hidden="true" />
            )}
          </button>
          {!isSection ? (
            <>
              <button
                type="button"
                className={`edit-task-action priority ${isHigh ? 'is-active' : ''}`}
                aria-label={isHigh ? 'Quitar prioridad' : 'Marcar prioridad'}
                title={isHigh ? 'Quitar prioridad' : 'Marcar prioridad'}
                tabIndex={isOpen ? 0 : -1}
                disabled={!isHigh && highPriorityDisabled}
                onClick={() => onTogglePriority(task)}
              >
                <Star size={16} strokeWidth={2.1} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`edit-task-action reminder ${hasReminder ? 'is-active' : ''}`}
                aria-label={hasReminder ? 'Editar recordatorio' : 'Añadir recordatorio'}
                title={hasReminder ? 'Editar recordatorio' : 'Añadir recordatorio'}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => onEditReminder(task)}
              >
                <Bell size={16} strokeWidth={2.1} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`edit-task-action note ${hasNote ? 'is-active' : ''}`}
                aria-label={hasNote ? 'Editar nota' : 'Añadir nota'}
                title={hasNote ? 'Editar nota' : 'Añadir nota'}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => onEditNote(task)}
              >
                <StickyNote size={16} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="edit-task-action delete"
            aria-label={isSection ? 'Eliminar sección' : 'Eliminar tarea'}
            title={isSection ? 'Eliminar sección' : 'Eliminar tarea'}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => onRequestDelete(task.id)}
          >
            <Trash2 size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>

        <div
          className="edit-task-front"
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        >
          <div className="edit-task-front-main">
            {isHigh && !isSection ? (
              <span
                className="edit-task-priority-mark"
                aria-label="Prioridad alta"
                title="Prioridad alta"
              >
                <Star size={15} strokeWidth={2.2} aria-hidden="true" />
              </span>
            ) : null}
            <input
              type="text"
              value={draftText}
              aria-label={isSection ? 'Título de la sección' : 'Texto de la tarea'}
              className={isSection ? 'section-title-input' : undefined}
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
          <button
            type="button"
            className={`edit-task-swipe-hint${isOpen ? ' is-open' : ''}`}
            aria-label={isOpen ? 'Cerrar acciones' : 'Desliza a la izquierda'}
            title={isOpen ? 'Cerrar' : 'Desliza a la izquierda'}
            onClick={(event) => {
              event.stopPropagation()
              if (isOpen) {
                closeSwipe()
              } else {
                setRevealOffset(-getMaxReveal())
              }
            }}
          >
            {isOpen ? (
              <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Bell, BellRing, Check, Copy, CopyPlus, Heading2, Plus, Share2, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionBar } from '../components/ActionBar'
import { AppHeader } from '../components/AppHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteDialog } from '../components/NoteDialog'
import { ReminderDialog } from '../components/ReminderDialog'
import { SortableTaskRow } from '../components/SortableTaskRow'
import {
  DatabaseError,
  addSectionToList,
  addTasksToList,
  deleteList,
  deleteTasks,
  duplicateList,
  getListById,
  getTasksByListId,
  reorderTasks,
  updateListName,
  updateListReminder,
  updateTaskKind,
  updateTaskNote,
  updateTaskPriority,
  updateTaskReminder,
  updateTaskText,
} from '../services/database'
import { MAX_HIGH_PRIORITY_PER_LIST } from '../types'
import { countHighPriorityTasks } from '../utils/taskPriority'
import { isSectionTask } from '../utils/taskKind'
import {
  ReminderError,
  cancelListReminderSchedule,
  cancelTaskReminderSchedule,
  ensureNotificationPermission,
  scheduleListReminder,
  scheduleTaskReminder,
} from '../services/reminders'
import { isNativeApp } from '../services/nativeReminders'
import { addTaskReminderToCalendar } from '../utils/calendarReminder'
import type { Task, TaskList } from '../types'
import { parseListItems } from '../utils/parseTasks'
import {
  copyTextToClipboard,
  formatListAsPlainText,
  shareListText,
} from '../utils/shareList'
import { getTaskNote } from '../utils/taskNote'
import { getTaskReminderAt, taskHasReminder } from '../utils/taskReminder'

export function EditListPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [list, setList] = useState<TaskList | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [newTask, setNewTask] = useState('')
  const [bulkTasks, setBulkTasks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [pendingDeleteList, setPendingDeleteList] = useState(false)
  const [pendingDeleteTaskIds, setPendingDeleteTaskIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [swipeCloseSignals, setSwipeCloseSignals] = useState<Record<string, number>>({})
  const [revealedTaskIds, setRevealedTaskIds] = useState<string[]>([])
  const [noteTask, setNoteTask] = useState<Task | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)
  const [reminderTask, setReminderTask] = useState<Task | null>(null)
  const [listReminderOpen, setListReminderOpen] = useState(false)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderError, setReminderError] = useState<string | null>(null)
  const revealedTaskIdsRef = useRef<string[]>([])
  const highPriorityCount = useMemo(() => countHighPriorityTasks(tasks), [tasks])
  const highPriorityDisabled = highPriorityCount >= MAX_HIGH_PRIORITY_PER_LIST

  useEffect(() => {
    revealedTaskIdsRef.current = revealedTaskIds
  }, [revealedTaskIds])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setIsReady(true)
      return
    }

    void (async () => {
      try {
        const [nextList, nextTasks] = await Promise.all([
          getListById(id),
          getTasksByListId(id),
        ])

        if (!nextList) {
          setNotFound(true)
          return
        }

        setList(nextList)
        setName(nextList.name)
        setTasks(nextTasks)
        setError(null)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'No se pudo abrir la lista.'
        setError(message)
      } finally {
        setIsReady(true)
      }
    })()
  }, [id])

  function showError(cause: unknown, fallback: string) {
    const message = cause instanceof DatabaseError ? cause.message : fallback
    setError(message)
  }

  async function handleNameBlur() {
    if (!list || name.trim() === list.name) {
      return
    }

    try {
      const updated = await updateListName(list.id, name)
      setList(updated)
      setName(updated.name)
      setError(null)
    } catch (cause) {
      setName(list.name)
      showError(cause, 'No se pudo guardar el nombre.')
    }
  }

  async function handleTaskBlur(task: Task, text: string) {
    if (text.trim() === task.text) {
      setDrafts((current) => {
        const next = { ...current }
        delete next[task.id]
        return next
      })
      return
    }

    try {
      const updated = await updateTaskText(task.id, text)
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)))
      setDrafts((current) => {
        const next = { ...current }
        delete next[task.id]
        return next
      })
      setError(null)
    } catch (cause) {
      setDrafts((current) => ({ ...current, [task.id]: task.text }))
      showError(cause, 'No se pudo guardar la tarea.')
    }
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!list) {
      return
    }

    const text = newTask.trim()
    if (!text) {
      setError('Escribe el texto de la tarea en el cuadro.')
      return
    }

    try {
      // Una sola tarea con el texto del cuadro (+). Las secciones van con H2.
      const created = await addTasksToList(list.id, [{ text, kind: 'task' }])
      setTasks((current) => [...current, ...created])
      setNewTask('')
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudo añadir la tarea.')
    }
  }

  async function handleAddBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!list) {
      return
    }

    try {
      const created = await addTasksToList(list.id, parseListItems(bulkTasks))
      setTasks((current) => [...current, ...created])
      setBulkTasks('')
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudieron añadir las tareas.')
    }
  }

  async function handleAddSection() {
    if (!list) {
      return
    }

    // El botón H2 usa el texto tal cual; no hace falta escribir "##".
    const title = newTask.trim().replace(/^##\s*/, '')
    if (!title) {
      setError('Escribe el título de la sección en el cuadro de texto.')
      return
    }

    try {
      const created = await addSectionToList(list.id, title)
      setTasks((current) => [...current, created])
      setDrafts((current) => ({ ...current, [created.id]: created.text }))
      setNewTask('')
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudo añadir la sección.')
    }
  }

  async function handleDuplicateList() {
    if (!list) {
      return
    }

    setBusy(true)
    try {
      await duplicateList(list.id)
      setError(null)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch (cause) {
      showError(cause, 'No se pudo duplicar la lista.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTogglePriority(task: Task) {
    if (isSectionTask(task)) {
      return
    }

    const next = task.priority === 'high' ? 'normal' : 'high'
    try {
      const updated = await updateTaskPriority(task.id, next)
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudo cambiar la prioridad.')
    }
  }

  async function handleToggleKind(task: Task) {
    const next = isSectionTask(task) ? 'task' : 'section'
    try {
      const updated = await updateTaskKind(task.id, next)
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudo cambiar el tipo de elemento.')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!list) {
      return
    }

    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = tasks.findIndex((task) => task.id === active.id)
    const newIndex = tasks.findIndex((task) => task.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    const previous = tasks
    const nextTasks = arrayMove(tasks, oldIndex, newIndex)
    setTasks(nextTasks)

    try {
      const persisted = await reorderTasks(
        list.id,
        nextTasks.map((task) => task.id),
      )
      setTasks(persisted)
      setError(null)
    } catch (cause) {
      setTasks(previous)
      showError(cause, 'No se pudo reordenar la tarea.')
    }
  }

  const handleRevealChange = useCallback((taskId: string, revealed: boolean) => {
    setRevealedTaskIds((current) => {
      if (revealed) {
        return current.includes(taskId) ? current : [...current, taskId]
      }
      return current.filter((id) => id !== taskId)
    })
  }, [])

  function handleRequestDelete(taskId: string) {
    const current = revealedTaskIdsRef.current
    const selected = current.includes(taskId) ? current : [...current, taskId]
    setPendingDeleteTaskIds([...new Set(selected)])
  }

  function closeSwipes(taskIds: string[]) {
    setSwipeCloseSignals((current) => {
      const next = { ...current }
      for (const id of taskIds) {
        next[id] = (next[id] ?? 0) + 1
      }
      return next
    })
    setRevealedTaskIds((current) => current.filter((id) => !taskIds.includes(id)))
  }

  async function confirmDeleteTasks() {
    if (pendingDeleteTaskIds.length === 0) {
      return
    }

    const idsToDelete = pendingDeleteTaskIds
    setBusy(true)
    try {
      await deleteTasks(idsToDelete)
      for (const taskId of idsToDelete) {
        void cancelTaskReminderSchedule(taskId)
      }
      setTasks((current) => current.filter((task) => !idsToDelete.includes(task.id)))
      setDrafts((current) => {
        const next = { ...current }
        for (const taskId of idsToDelete) {
          delete next[taskId]
        }
        return next
      })
      setPendingDeleteTaskIds([])
      setRevealedTaskIds((current) => current.filter((id) => !idsToDelete.includes(id)))
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudieron eliminar las tareas.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteList() {
    if (!list) {
      return
    }

    setBusy(true)
    try {
      await cancelListReminderSchedule(list.id)
      await deleteList(list.id)
      void navigate('/app', { replace: true })
    } catch (cause) {
      showError(cause, 'No se pudo eliminar la lista.')
      setBusy(false)
    }
  }

  async function handleCopyList() {
    try {
      await copyTextToClipboard(formatListAsPlainText(tasks))
      setError(null)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch (cause) {
      showError(cause, 'No se pudo copiar la lista.')
    }
  }

  async function handleShareList() {
    try {
      const result = await shareListText(formatListAsPlainText(tasks), name)
      setError(null)

      if (result === 'copied') {
        setCopyFeedback(true)
        window.setTimeout(() => setCopyFeedback(false), 1800)
      }
    } catch (cause) {
      showError(cause, 'No se pudo compartir la lista.')
    }
  }

  async function handleSaveNote(note: string) {
    if (!noteTask) {
      return
    }

    setNoteBusy(true)
    try {
      const updated = await updateTaskNote(noteTask.id, note)
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNoteTask(null)
      setError(null)
    } catch (cause) {
      showError(cause, 'No se pudo guardar la nota.')
    } finally {
      setNoteBusy(false)
    }
  }

  async function handleSaveReminder(reminderAt: number | null) {
    if (!reminderTask) {
      return
    }

    setReminderBusy(true)
    setReminderError(null)
    try {
      if (reminderAt !== null) {
        await ensureNotificationPermission()
      }
      const updated = await updateTaskReminder(reminderTask.id, reminderAt)
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))

      if (reminderAt === null) {
        await cancelTaskReminderSchedule(updated.id)
      } else {
        await scheduleTaskReminder(updated)
        if (!isNativeApp()) {
          await addTaskReminderToCalendar({
            task: updated,
            listName: list?.name,
          })
        }
      }

      setReminderTask(null)
      setError(null)
    } catch (cause) {
      const message =
        cause instanceof ReminderError || cause instanceof DatabaseError
          ? cause.message
          : 'No se pudo guardar el recordatorio.'
      setReminderError(message)
    } finally {
      setReminderBusy(false)
    }
  }

  async function handleSaveListReminder(reminderAt: number | null) {
    if (!list) {
      return
    }

    setReminderBusy(true)
    setReminderError(null)
    try {
      if (reminderAt !== null) {
        await ensureNotificationPermission()
      }
      const updated = await updateListReminder(list.id, reminderAt)
      setList(updated)

      if (reminderAt === null) {
        await cancelListReminderSchedule(updated.id)
      } else {
        await scheduleListReminder(updated)
      }

      setListReminderOpen(false)
      setError(null)
    } catch (cause) {
      const message =
        cause instanceof ReminderError || cause instanceof DatabaseError
          ? cause.message
          : 'No se pudo guardar el recordatorio de la lista.'
      setReminderError(message)
    } finally {
      setReminderBusy(false)
    }
  }

  if (isReady && (notFound || !list)) {
    return (
      <section className="page">
        <AppHeader title="Lista no encontrada" backTo="/app" />
      </section>
    )
  }

  if (!list) {
    return (
      <section className="page">
        <AppHeader title="Editar lista" backTo="/app" />
      </section>
    )
  }

  return (
    <section className="page">
      <AppHeader
        title="Editar lista"
        subtitle="Los cambios se guardan automáticamente"
        backTo={`/lista/${list.id}`}
      />

      <ActionBar ariaLabel="Acciones de edición">
        <button
          type="button"
          className={`icon-btn${taskHasReminder(list.reminderAt) ? ' has-list-reminder' : ''}`}
          aria-label={
            taskHasReminder(list.reminderAt)
              ? 'Editar recordatorio de la lista'
              : 'Añadir recordatorio a la lista'
          }
          title={
            taskHasReminder(list.reminderAt)
              ? 'Recordatorio activo'
              : 'Recordatorio de la lista'
          }
          onClick={() => {
            setReminderError(null)
            setListReminderOpen(true)
          }}
        >
          {taskHasReminder(list.reminderAt) ? (
            <BellRing size={18} strokeWidth={2.3} aria-hidden="true" />
          ) : (
            <Bell size={18} strokeWidth={2.1} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Duplicar lista"
          title="Duplicar lista"
          disabled={busy}
          onClick={() => {
            void handleDuplicateList()
          }}
        >
          <CopyPlus size={18} strokeWidth={2.1} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Copiar lista en texto"
          title="Copiar lista en texto"
          onClick={() => {
            void handleCopyList()
          }}
        >
          {copyFeedback ? (
            <Check size={18} strokeWidth={2.1} />
          ) : (
            <Copy size={18} strokeWidth={2.1} />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Compartir lista"
          title="Compartir lista"
          onClick={() => {
            void handleShareList()
          }}
        >
          <Share2 size={18} strokeWidth={2.1} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label="Eliminar lista"
          title="Eliminar lista"
          onClick={() => setPendingDeleteList(true)}
        >
          <Trash2 size={18} strokeWidth={2.1} />
        </button>
      </ActionBar>

      {error ? <p className="banner error">{error}</p> : null}

      <label className="field">
        <span>Nombre de la lista</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            void handleNameBlur()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          maxLength={120}
        />
      </label>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          void handleDragEnd(event)
        }}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="edit-tasks">
            {tasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                draftText={drafts[task.id] ?? task.text}
                closeSwipeSignal={swipeCloseSignals[task.id] ?? 0}
                highPriorityDisabled={highPriorityDisabled}
                onDraftChange={(taskId, text) => {
                  setDrafts((current) => ({ ...current, [taskId]: text }))
                }}
                onBlur={(currentTask, text) => {
                  void handleTaskBlur(currentTask, text)
                }}
                onRevealChange={handleRevealChange}
                onRequestDelete={handleRequestDelete}
                onEditNote={setNoteTask}
                onEditReminder={(currentTask) => {
                  setReminderError(null)
                  setReminderTask(currentTask)
                }}
                onTogglePriority={(currentTask) => {
                  void handleTogglePriority(currentTask)
                }}
                onToggleKind={(currentTask) => {
                  void handleToggleKind(currentTask)
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <form className="add-row" onSubmit={(event) => void handleAddTask(event)}>
        <label className="field grow">
          <span>Añadir tarea o sección</span>
          <input
            type="text"
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="Escribe el texto y pulsa + o H2"
          />
        </label>
        <button
          type="button"
          className="icon-btn"
          aria-label="Añadir sección con este texto"
          title="Añadir sección"
          onClick={() => {
            void handleAddSection()
          }}
        >
          <Heading2 size={20} strokeWidth={2.3} />
        </button>
        <button type="submit" className="icon-btn solid" aria-label="Añadir tarea">
          <Plus size={20} strokeWidth={2.3} />
        </button>
      </form>

      <form className="stack-form" onSubmit={(event) => void handleAddBulk(event)}>
        <label className="field">
          <span>Añadir varias tareas</span>
          <textarea
            value={bulkTasks}
            onChange={(event) => setBulkTasks(event.target.value)}
            placeholder={'Una tarea por línea\n(En bloque: ## Título crea sección)'}
            rows={5}
          />
        </label>
        <button type="submit" className="btn btn-ghost">
          <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Añadir líneas</span>
        </button>
      </form>

      <NoteDialog
        open={noteTask !== null}
        taskText={noteTask?.text ?? ''}
        note={getTaskNote(noteTask?.note)}
        mode="edit"
        busy={noteBusy}
        onClose={() => {
          if (!noteBusy) {
            setNoteTask(null)
          }
        }}
        onSave={(note) => {
          void handleSaveNote(note)
        }}
      />

      <ReminderDialog
        open={reminderTask !== null}
        taskText={reminderTask?.text ?? ''}
        reminderAt={getTaskReminderAt(reminderTask?.reminderAt)}
        mode="edit"
        busy={reminderBusy}
        error={reminderError}
        onClose={() => {
          if (!reminderBusy) {
            setReminderTask(null)
            setReminderError(null)
          }
        }}
        onSave={(reminderAt) => {
          void handleSaveReminder(reminderAt)
        }}
      />

      <ReminderDialog
        open={listReminderOpen}
        taskText={list.name}
        reminderAt={getTaskReminderAt(list.reminderAt)}
        mode="edit"
        busy={reminderBusy}
        error={reminderError}
        onClose={() => {
          if (!reminderBusy) {
            setListReminderOpen(false)
            setReminderError(null)
          }
        }}
        onSave={(reminderAt) => {
          void handleSaveListReminder(reminderAt)
        }}
      />

      <ConfirmDialog
        open={pendingDeleteTaskIds.length > 0}
        title={
          pendingDeleteTaskIds.length > 1
            ? `Eliminar ${pendingDeleteTaskIds.length} tareas`
            : 'Eliminar tarea'
        }
        message={
          pendingDeleteTaskIds.length > 1
            ? 'Se eliminarán todas las tareas que tienes deslizadas. El resto de elementos y su progreso se mantendrán.'
            : 'La tarea se eliminará de esta lista. El resto de elementos y su progreso se mantendrán.'
        }
        confirmLabel={
          busy
            ? 'Eliminando…'
            : pendingDeleteTaskIds.length > 1
              ? `Eliminar ${pendingDeleteTaskIds.length}`
              : 'Eliminar tarea'
        }
        danger
        onCancel={() => {
          closeSwipes(pendingDeleteTaskIds)
          setPendingDeleteTaskIds([])
        }}
        onConfirm={() => {
          void confirmDeleteTasks()
        }}
      />

      <ConfirmDialog
        open={pendingDeleteList}
        title="¿Seguro que quieres eliminar esta lista?"
        message="Esta acción no se puede deshacer."
        details={[
          'Se eliminará la lista',
          'Se eliminarán todas sus tareas',
          'Se perderá el progreso guardado',
        ]}
        confirmLabel={busy ? 'Eliminando…' : 'Eliminar lista'}
        danger
        onCancel={() => setPendingDeleteList(false)}
        onConfirm={() => {
          void confirmDeleteList()
        }}
      />
    </section>
  )
}

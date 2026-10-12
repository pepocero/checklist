import { ArrowLeft, Bell, BellRing, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { ActionBar } from '../components/ActionBar'
import { AppHeader } from '../components/AppHeader'
import { ChecklistItem } from '../components/ChecklistItem'
import { ChecklistProgress } from '../components/ChecklistProgress'
import { CompletionDialog } from '../components/CompletionDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteDialog } from '../components/NoteDialog'
import { ReminderDialog } from '../components/ReminderDialog'
import { useChecklist } from '../hooks/useChecklist'
import { DatabaseError, updateListReminder } from '../services/database'
import {
  ReminderError,
  cancelListReminderSchedule,
  ensureNotificationPermission,
  scheduleListReminder,
} from '../services/reminders'
import type { Task } from '../types'
import { formatLastCompletedAt } from '../utils/formatLastCompleted'
import { isSectionTask } from '../utils/taskKind'
import { getTaskNote } from '../utils/taskNote'
import { getTaskReminderAt, taskHasReminder } from '../utils/taskReminder'
import { addTaskReminderToCalendar } from '../utils/calendarReminder'

export function ChecklistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    list,
    tasks,
    isReady,
    notFound,
    error,
    completedCount,
    totalCount,
    isComplete,
    toggleTask,
    resetTasks,
    refresh,
  } = useChecklist(id)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionDismissed, setCompletionDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteTask, setNoteTask] = useState<Task | null>(null)
  const [reminderTask, setReminderTask] = useState<Task | null>(null)
  const [listReminderOpen, setListReminderOpen] = useState(false)
  const [listReminderBusy, setListReminderBusy] = useState(false)
  const [listReminderError, setListReminderError] = useState<string | null>(null)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isComplete) {
      setShowCompletion(false)
      setCompletionDismissed(false)
      return
    }

    if (!completionDismissed) {
      setShowCompletion(true)
    }
  }, [isComplete, completionDismissed])

  async function handleReset() {
    setBusy(true)
    try {
      await resetTasks()
      setConfirmReset(false)
      setShowCompletion(false)
      setCompletionDismissed(false)
    } finally {
      setBusy(false)
    }
  }

  function acceptCompletion() {
    setShowCompletion(false)
    setCompletionDismissed(true)
  }

  async function handleSaveListReminder(reminderAt: number | null) {
    if (!list) {
      return
    }

    setListReminderBusy(true)
    setListReminderError(null)
    try {
      if (reminderAt !== null) {
        await ensureNotificationPermission()
      }
      const updated = await updateListReminder(list.id, reminderAt)
      if (reminderAt === null) {
        await cancelListReminderSchedule(updated.id)
      } else {
        await scheduleListReminder(updated)
      }
      await refresh()
      setListReminderOpen(false)
      setLocalError(null)
    } catch (cause) {
      const message =
        cause instanceof ReminderError || cause instanceof DatabaseError
          ? cause.message
          : 'No se pudo guardar el recordatorio de la lista.'
      setListReminderError(message)
    } finally {
      setListReminderBusy(false)
    }
  }

  if (isReady && notFound) {
    return (
      <section className="page">
        <AppHeader title="Lista no encontrada" backTo="/app" />
        <div className="empty-state">
          <p>Esta lista no existe o fue eliminada.</p>
          <Link to="/app" className="btn btn-primary">
            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Volver a mis listas</span>
          </Link>
        </div>
      </section>
    )
  }

  if (!list) {
    return (
      <section className="page">
        <AppHeader title="CheckList" backTo="/app" />
      </section>
    )
  }

  const lastCompletedLabel = formatLastCompletedAt(list.lastCompletedAt)
  const displayError = localError ?? error
  const sectionCount = tasks.filter((task) => isSectionTask(task)).length

  return (
    <section className="page">
      <AppHeader
        title={list.name}
        subtitle={lastCompletedLabel ? `Última vez: ${lastCompletedLabel}` : undefined}
        backTo="/app"
      />

      {displayError ? <p className="banner error">{displayError}</p> : null}

      <ChecklistProgress
        completed={completedCount}
        total={totalCount}
        sectionCount={sectionCount}
      />

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p>Esta lista no tiene tareas. Añade algunas desde editar.</p>
          <Link to={`/lista/${list.id}/editar`} className="btn btn-primary">
            <Pencil size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>Editar lista</span>
          </Link>
        </div>
      ) : (
        <div className="checklist">
          {tasks.map((task) => (
            <ChecklistItem
              key={task.id}
              task={task}
              onToggle={toggleTask}
              onOpenNote={setNoteTask}
              onOpenReminder={setReminderTask}
            />
          ))}
        </div>
      )}

      <ActionBar ariaLabel="Acciones de la lista">
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
            setListReminderError(null)
            setListReminderOpen(true)
          }}
        >
          {taskHasReminder(list.reminderAt) ? (
            <BellRing size={18} strokeWidth={2.3} aria-hidden="true" />
          ) : (
            <Bell size={18} strokeWidth={2.1} aria-hidden="true" />
          )}
        </button>
        <Link to={`/lista/${list.id}/editar`} className="btn btn-edit">
          <Pencil size={18} strokeWidth={2.1} aria-hidden="true" />
          <span>Editar</span>
        </Link>
        {tasks.length > 0 ? (
          <button
            type="button"
            className="btn btn-reset"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        ) : null}
      </ActionBar>

      <NoteDialog
        open={noteTask !== null}
        taskText={noteTask?.text ?? ''}
        note={getTaskNote(noteTask?.note)}
        mode="view"
        onClose={() => setNoteTask(null)}
      />

      <ReminderDialog
        open={reminderTask !== null}
        taskText={reminderTask?.text ?? ''}
        reminderAt={getTaskReminderAt(reminderTask?.reminderAt)}
        mode="view"
        calendarBusy={calendarBusy}
        onAddToCalendar={
          Capacitor.isNativePlatform()
            ? undefined
            : () => {
                if (!reminderTask) {
                  return
                }
                setCalendarBusy(true)
                void addTaskReminderToCalendar({
                  task: reminderTask,
                  listName: list?.name,
                })
                  .catch(() => {
                    // El usuario puede cancelar; no bloquear la UI.
                  })
                  .finally(() => {
                    setCalendarBusy(false)
                  })
              }
        }
        onClose={() => setReminderTask(null)}
      />

      <ReminderDialog
        open={listReminderOpen}
        taskText={list.name}
        reminderAt={getTaskReminderAt(list.reminderAt)}
        mode="edit"
        busy={listReminderBusy}
        error={listReminderError}
        onClose={() => {
          if (!listReminderBusy) {
            setListReminderOpen(false)
            setListReminderError(null)
          }
        }}
        onSave={(reminderAt) => {
          void handleSaveListReminder(reminderAt)
        }}
      />

      <CompletionDialog
        open={
          showCompletion &&
          !confirmReset &&
          noteTask === null &&
          reminderTask === null &&
          !listReminderOpen
        }
        totalTasks={totalCount}
        onAccept={acceptCompletion}
        onReset={() => setConfirmReset(true)}
        onGoHome={() => {
          void navigate('/app')
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reiniciar esta lista"
        message="Se desmarcarán todas las tareas. La lista y sus elementos se mantendrán para reutilizarla."
        confirmLabel={busy ? 'Reiniciando…' : 'Reiniciar tarea'}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void handleReset()
        }}
      />
    </section>
  )
}

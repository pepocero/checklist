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
import { ClipboardList, ArrowLeft, CalendarClock, Copy, DatabaseBackup, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionBar } from '../components/ActionBar'
import { AppHeader } from '../components/AppHeader'
import { BackupDialog } from '../components/BackupDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstallPrompt } from '../components/InstallPrompt'
import { SortableListCard } from '../components/SortableListCard'
import { useLists } from '../hooks/useLists'
import { duplicateList } from '../services/database'
import { cancelListReminderSchedule } from '../services/reminders'
import type { TaskListSummary } from '../types'

export function HomePage() {
  const { lists, setLists, isReady, error, deleteList, reorderLists, refresh } = useLists()
  const [pendingDelete, setPendingDelete] = useState<TaskListSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [duplicateBusyId, setDuplicateBusyId] = useState<string | null>(null)
  const [swipeCloseSignal, setSwipeCloseSignal] = useState(0)
  const [backupOpen, setBackupOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  async function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    setBusy(true)
    try {
      await cancelListReminderSchedule(pendingDelete.id)
      await deleteList(pendingDelete.id)
      setPendingDelete(null)
      setSwipeCloseSignal((current) => current + 1)
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate(list: TaskListSummary) {
    setDuplicateBusyId(list.id)
    setActionError(null)
    try {
      await duplicateList(list.id)
      setSwipeCloseSignal((current) => current + 1)
      await refresh()
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo duplicar la lista.'
      setActionError(message)
    } finally {
      setDuplicateBusyId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = lists.findIndex((list) => list.id === active.id)
    const newIndex = lists.findIndex((list) => list.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    const previous = lists
    const nextLists = arrayMove(lists, oldIndex, newIndex)
    setLists(nextLists)

    try {
      await reorderLists(nextLists.map((list) => list.id))
    } catch {
      setLists(previous)
    }
  }

  return (
    <section className="page">
      <AppHeader
        title="Mis listas"
        subtitle="CheckList · Creador de listas de verificación"
        homeTo="/inicio"
      />

      <ActionBar ariaLabel="Acciones de listas">
        <Link to="/nueva" className="btn btn-primary">
          <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
          <span>Nueva lista</span>
        </Link>
        <Link
          to="/hoy"
          className="icon-btn solid"
          aria-label="Hoy y próximos"
          title="Hoy y próximos"
        >
          <CalendarClock size={20} strokeWidth={2.3} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="icon-btn solid"
          aria-label="Copia de seguridad"
          title="Copia de seguridad"
          onClick={() => setBackupOpen(true)}
        >
          <DatabaseBackup size={20} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </ActionBar>

      <InstallPrompt />

      {error || actionError ? (
        <p className="banner error">{actionError ?? error}</p>
      ) : null}

      {isReady && lists.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={42} strokeWidth={1.7} aria-hidden="true" />
          <h2>Todavía no hay listas</h2>
          <p>Crea la primera pegando un bloque de texto. Cada línea se convertirá en una tarea.</p>
          <Link to="/nueva" className="btn btn-primary">
            <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
            <span>Nueva lista</span>
          </Link>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            void handleDragEnd(event)
          }}
        >
          <SortableContext
            items={lists.map((list) => list.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="swipe-hint" aria-hidden="true">
              <span className="swipe-hint-center">
                <ArrowLeft size={18} strokeWidth={2.1} />
                <span>Desliza a la izquierda</span>
              </span>
              <span className="swipe-hint-actions">
                <span className="swipe-hint-side duplicate">
                  <Copy size={14} strokeWidth={2.2} />
                </span>
                <span className="swipe-hint-side edit">
                  <Pencil size={14} strokeWidth={2.2} />
                </span>
                <span className="swipe-hint-side delete">
                  <Trash2 size={14} strokeWidth={2.2} />
                </span>
              </span>
            </div>
            <div className="list-grid">
              {lists.map((list) => (
                <SortableListCard
                  key={list.id}
                  list={list}
                  closeSwipeSignal={swipeCloseSignal}
                  onDelete={setPendingDelete}
                  onDuplicate={(item) => {
                    void handleDuplicate(item)
                  }}
                  duplicateBusy={duplicateBusyId === list.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="¿Seguro que quieres eliminar esta lista?"
        message="Esta acción no se puede deshacer."
        details={[
          'Se eliminará la lista',
          'Se eliminarán todas sus tareas',
          'Se perderá el progreso guardado',
        ]}
        confirmLabel={busy ? 'Eliminando…' : 'Eliminar lista'}
        danger
        onCancel={() => {
          setPendingDelete(null)
          setSwipeCloseSignal((current) => current + 1)
        }}
        onConfirm={() => {
          void confirmDelete()
        }}
      />

      <BackupDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onRestored={() => refresh()}
      />
    </section>
  )
}

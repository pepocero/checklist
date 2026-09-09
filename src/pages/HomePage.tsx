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
import { ClipboardList, ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionBar } from '../components/ActionBar'
import { AppHeader } from '../components/AppHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstallPrompt } from '../components/InstallPrompt'
import { SortableListCard } from '../components/SortableListCard'
import { useLists } from '../hooks/useLists'
import type { TaskListSummary } from '../types'

export function HomePage() {
  const { lists, setLists, isReady, error, deleteList, reorderLists } = useLists()
  const [pendingDelete, setPendingDelete] = useState<TaskListSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [swipeCloseSignal, setSwipeCloseSignal] = useState(0)

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
      await deleteList(pendingDelete.id)
      setPendingDelete(null)
      setSwipeCloseSignal((current) => current + 1)
    } finally {
      setBusy(false)
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

      <ActionBar ariaLabel="Crear lista">
        <Link to="/nueva" className="btn btn-primary">
          <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
          <span>Nueva lista</span>
        </Link>
      </ActionBar>

      <InstallPrompt />

      {error ? <p className="banner error">{error}</p> : null}

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
    </section>
  )
}

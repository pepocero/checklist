import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InstallPrompt } from '../components/InstallPrompt'
import { ListCard } from '../components/ListCard'
import { useLists } from '../hooks/useLists'
import type { TaskListSummary } from '../types'

export function HomePage() {
  const { lists, isReady, error, deleteList } = useLists()
  const [pendingDelete, setPendingDelete] = useState<TaskListSummary | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    setBusy(true)
    try {
      await deleteList(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <AppHeader
        title="Mis listas"
        subtitle="Listas reutilizables guardadas en este dispositivo"
        actions={
          <Link to="/nueva" className="btn btn-primary">
            <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
            <span>Nueva lista</span>
          </Link>
        }
      />

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
        <div className="list-grid">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onDelete={setPendingDelete} />
          ))}
        </div>
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
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete()
        }}
      />
    </section>
  )
}

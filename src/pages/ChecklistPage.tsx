import { ArrowLeft, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActionBar } from '../components/ActionBar'
import { AppHeader } from '../components/AppHeader'
import { ChecklistItem } from '../components/ChecklistItem'
import { ChecklistProgress } from '../components/ChecklistProgress'
import { CompletionDialog } from '../components/CompletionDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useChecklist } from '../hooks/useChecklist'

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
  } = useChecklist(id)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isComplete) {
      setShowCompletion(true)
      return
    }

    setShowCompletion(false)
  }, [isComplete])

  async function handleReset() {
    setBusy(true)
    try {
      await resetTasks()
      setConfirmReset(false)
      setShowCompletion(false)
    } finally {
      setBusy(false)
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

  return (
    <section className="page">
      <AppHeader
        title={list.name}
        backTo="/app"
      />

      {error ? <p className="banner error">{error}</p> : null}

      <ChecklistProgress completed={completedCount} total={totalCount} />

      {tasks.length > 0 ? (
        <ActionBar ariaLabel="Acciones de la lista">
          <Link to={`/lista/${list.id}/editar`} className="btn btn-edit">
            <Pencil size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>Editar</span>
          </Link>
          <button
            type="button"
            className="btn btn-reset"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        </ActionBar>
      ) : null}

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
            <ChecklistItem key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </div>
      )}

      <CompletionDialog
        open={showCompletion && !confirmReset}
        totalTasks={totalCount}
        onReset={() => setConfirmReset(true)}
        onGoHome={() => {
                void navigate('/app')
        }}
        onClose={() => setShowCompletion(false)}
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

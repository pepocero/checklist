import { Pencil, Trash2 } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskListSummary } from '../types'
import { ChecklistProgress } from './ChecklistProgress'

interface ListCardProps {
  list: TaskListSummary
  onDelete: (list: TaskListSummary) => void
}

export function ListCard({ list, onDelete }: ListCardProps) {
  const navigate = useNavigate()

  function openList() {
    void navigate(`/lista/${list.id}`)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openList()
    }
  }

  function handleEdit(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    void navigate(`/lista/${list.id}/editar`)
  }

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onDelete(list)
  }

  return (
    <article
      className="list-card"
      role="button"
      tabIndex={0}
      onClick={openList}
      onKeyDown={handleKeyDown}
      aria-label={`Abrir ${list.name}`}
    >
      <div className="list-card-top">
        <h2>{list.name}</h2>
        <div className="list-card-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Editar ${list.name}`}
            title="Editar lista"
            onClick={handleEdit}
          >
            <Pencil size={18} strokeWidth={2.1} />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label={`Eliminar ${list.name}`}
            title="Eliminar lista"
            onClick={handleDelete}
          >
            <Trash2 size={18} strokeWidth={2.1} />
          </button>
        </div>
      </div>
      <ChecklistProgress
        completed={list.completedTasks}
        total={list.totalTasks}
        compact
      />
    </article>
  )
}

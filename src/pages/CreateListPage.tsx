import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { DatabaseError, createListWithTasks } from '../services/database'
import { parseTaskLines } from '../utils/parseTasks'

export function CreateListPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [rawTasks, setRawTasks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const previewCount = parseTaskLines(rawTasks).length

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const list = await createListWithTasks(name, parseTaskLines(rawTasks))
      void navigate(`/lista/${list.id}`, { replace: true })
    } catch (cause) {
      const message =
        cause instanceof DatabaseError
          ? cause.message
          : 'No se pudo crear la lista.'
      setError(message)
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <AppHeader
        title="Crear lista"
        subtitle="Cada línea del texto se convertirá en una tarea"
        backTo="/"
      />

      <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="field">
          <span>Nombre de la lista</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Configuración ordenador nuevo"
            autoComplete="off"
            maxLength={120}
            required
          />
        </label>

        <label className="field">
          <span>Tareas</span>
          <textarea
            value={rawTasks}
            onChange={(event) => setRawTasks(event.target.value)}
            placeholder={'Outlook\nTeams\nProbar la cámara\nAuthenticator'}
            rows={14}
            required
          />
          <small>
            {previewCount === 1
              ? '1 tarea se creará al guardar'
              : `${previewCount} tareas se crearán al guardar`}
          </small>
        </label>

        {error ? <p className="banner error">{error}</p> : null}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Plus size={20} strokeWidth={2.3} aria-hidden="true" />
          <span>{busy ? 'Creando…' : 'Crear lista'}</span>
        </button>
      </form>
    </section>
  )
}

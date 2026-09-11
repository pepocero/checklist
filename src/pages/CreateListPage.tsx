import { Plus } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { DatabaseError, createListWithTasks } from '../services/database'
import { parseTaskLines } from '../utils/parseTasks'

const DEMO_LIST_NAME = 'Lista de prueba'
const DEMO_TASKS = [
  'Pasaporte',
  'Cargador del móvil',
  'Ropa interior',
  'Neceser',
  'Zapatillas',
  'Adaptador de enchufe',
]

function isDemoListName(value: string): boolean {
  return value.trim().toLocaleLowerCase('es') === DEMO_LIST_NAME.toLocaleLowerCase('es')
}

export function CreateListPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [rawTasks, setRawTasks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const previewCount = parseTaskLines(rawTasks).length

  async function createList(listName: string, taskLines: string[]) {
    setBusy(true)
    setError(null)

    try {
      const list = await createListWithTasks(listName, taskLines)
      void navigate(`/lista/${list.id}`, { replace: true })
    } catch (cause) {
      const message =
        cause instanceof DatabaseError
          ? cause.message
          : 'No se pudo crear la lista.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isDemoListName(name) && parseTaskLines(rawTasks).length === 0) {
      await createList(DEMO_LIST_NAME, DEMO_TASKS)
      return
    }

    await createList(name, parseTaskLines(rawTasks))
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    if (!isDemoListName(name)) {
      return
    }

    event.preventDefault()
    if (!busy) {
      void createList(DEMO_LIST_NAME, DEMO_TASKS)
    }
  }

  return (
    <section className="page">
      <AppHeader
        title="Crear lista"
        subtitle="Cada línea del texto se convertirá en una tarea"
        backTo="/app"
      />

      <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="field">
          <span>Nombre de la lista</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleNameKeyDown}
            placeholder="Equipaje para el viaje"
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
            placeholder={'Pasaporte\nCargador del móvil\nRopa interior\nNeceser\nZapatillas\nAdaptador de enchufe'}
            rows={14}
            required={!isDemoListName(name)}
          />
          <small>
            {isDemoListName(name) && previewCount === 0
              ? 'Pulsa Enter en el nombre para crear una lista de prueba con 6 tareas'
              : previewCount === 1
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

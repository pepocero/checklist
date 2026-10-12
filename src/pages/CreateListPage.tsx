import { Plus } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { DatabaseError, createListWithTasks } from '../services/database'
import { countTaskItems, parseListItems, parseTaskLines } from '../utils/parseTasks'

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
  const location = useLocation()
  const [name, setName] = useState('')
  const [rawTasks, setRawTasks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sharedText = (location.state as { sharedText?: string } | null)?.sharedText
    if (typeof sharedText === 'string' && sharedText.trim()) {
      setRawTasks(sharedText.trim())
      void navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const previewItems = parseListItems(rawTasks)
  const previewTaskCount = countTaskItems(previewItems)
  const previewSectionCount = previewItems.length - previewTaskCount

  async function createList(listName: string, raw: string | string[]) {
    setBusy(true)
    setError(null)

    try {
      const items =
        typeof raw === 'string' ? parseListItems(raw) : raw.map((text) => ({ text, kind: 'task' as const }))
      const list = await createListWithTasks(listName, items)
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

    await createList(name, rawTasks)
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

  function previewLabel(): string {
    if (isDemoListName(name) && previewItems.length === 0) {
      return 'Pulsa Enter en el nombre para crear una lista de prueba con 6 tareas'
    }

    const taskPart =
      previewTaskCount === 1 ? '1 tarea' : `${previewTaskCount} tareas`
    if (previewSectionCount <= 0) {
      return `${taskPart} se crearán al guardar`
    }

    const sectionPart =
      previewSectionCount === 1 ? '1 sección' : `${previewSectionCount} secciones`
    return `${taskPart} y ${sectionPart} se crearán al guardar`
  }

  return (
    <section className="page">
      <AppHeader
        title="Crear lista"
        subtitle="Cada línea es una tarea. Usa ## Título para secciones."
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
            placeholder={'## Documentos\nPasaporte\n## Electrónica\nCargador del móvil'}
            rows={14}
            required={!isDemoListName(name)}
          />
          <small>{previewLabel()}</small>
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

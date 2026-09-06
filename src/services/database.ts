import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Task, TaskList, TaskListSummary } from '../types'
import { normalizeTaskText } from '../utils/parseTasks'

const DB_NAME = 'checklist-de-tareas'
const DB_VERSION = 1

interface ChecklistSchema extends DBSchema {
  lists: {
    key: string
    value: TaskList
    indexes: { 'by-updatedAt': number }
  }
  tasks: {
    key: string
    value: Task
    indexes: { 'by-listId': string }
  }
}

export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DatabaseError'
  }
}

let dbPromise: Promise<IDBPDatabase<ChecklistSchema>> | null = null

function createId(): string {
  return crypto.randomUUID()
}

function now(): number {
  return Date.now()
}

export function getDatabase(): Promise<IDBPDatabase<ChecklistSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ChecklistSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('lists')) {
          const lists = db.createObjectStore('lists', { keyPath: 'id' })
          lists.createIndex('by-updatedAt', 'updatedAt')
        }

        if (!db.objectStoreNames.contains('tasks')) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
          tasks.createIndex('by-listId', 'listId')
        }
      },
    }).catch((cause: unknown) => {
      dbPromise = null
      throw new DatabaseError('No se pudo abrir la base de datos local.', { cause })
    })
  }

  return dbPromise
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order
    }

    return a.createdAt - b.createdAt
  })
}

function requireName(name: string): string {
  const normalized = normalizeTaskText(name)

  if (!normalized) {
    throw new DatabaseError('El nombre de la lista es obligatorio.')
  }

  return normalized
}

async function getTasksInTransaction(
  listId: string,
  taskStore: {
    index: (name: 'by-listId') => { getAll: (listId: string) => Promise<Task[]> }
  },
): Promise<Task[]> {
  const tasks = await taskStore.index('by-listId').getAll(listId)
  return sortTasks(tasks)
}

export async function getAllListSummaries(): Promise<TaskListSummary[]> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readonly')
    const lists = await tx.objectStore('lists').getAll()
    const tasks = await tx.objectStore('tasks').getAll()
    await tx.done

    const totals = new Map<string, { total: number; completed: number }>()

    for (const task of tasks) {
      const current = totals.get(task.listId) ?? { total: 0, completed: 0 }
      current.total += 1
      if (task.completed) {
        current.completed += 1
      }
      totals.set(task.listId, current)
    }

    return lists
      .map((list) => {
        const stats = totals.get(list.id) ?? { total: 0, completed: 0 }
        return {
          ...list,
          totalTasks: stats.total,
          completedTasks: stats.completed,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudieron cargar las listas.', { cause })
  }
}

export async function getListById(listId: string): Promise<TaskList | undefined> {
  try {
    const db = await getDatabase()
    return await db.get('lists', listId)
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo cargar la lista.', { cause })
  }
}

export async function getTasksByListId(listId: string): Promise<Task[]> {
  try {
    const db = await getDatabase()
    const tasks = await db.getAllFromIndex('tasks', 'by-listId', listId)
    return sortTasks(tasks)
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudieron cargar las tareas.', { cause })
  }
}

export async function createListWithTasks(
  name: string,
  taskTexts: string[],
): Promise<TaskList> {
  const listName = requireName(name)
  const texts = taskTexts.map(normalizeTaskText).filter((text) => text.length > 0)

  if (texts.length === 0) {
    throw new DatabaseError('Añade al menos una tarea.')
  }

  const createdAt = now()
  const list: TaskList = {
    id: createId(),
    name: listName,
    createdAt,
    updatedAt: createdAt,
  }

  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    await tx.objectStore('lists').add(list)

    const taskStore = tx.objectStore('tasks')
    for (const [index, text] of texts.entries()) {
      const task: Task = {
        id: createId(),
        listId: list.id,
        text,
        completed: false,
        order: index,
        createdAt,
        updatedAt: createdAt,
      }
      await taskStore.add(task)
    }

    await tx.done
    return list
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo crear la lista.', { cause })
  }
}

export async function updateListName(listId: string, name: string): Promise<TaskList> {
  const listName = requireName(name)

  try {
    const db = await getDatabase()
    const tx = db.transaction('lists', 'readwrite')
    const current = await tx.store.get(listId)

    if (!current) {
      throw new DatabaseError('La lista no existe.')
    }

    const updated: TaskList = {
      ...current,
      name: listName,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo actualizar el nombre de la lista.', { cause })
  }
}

export async function setTaskCompleted(taskId: string, completed: boolean): Promise<Task> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['tasks', 'lists'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const listStore = tx.objectStore('lists')
    const current = await taskStore.get(taskId)

    if (!current) {
      throw new DatabaseError('La tarea no existe.')
    }

    const updatedAt = now()
    const updated: Task = {
      ...current,
      completed,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await listStore.get(current.listId)
    if (list) {
      await listStore.put({ ...list, updatedAt })
    }

    await tx.done
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo guardar el estado de la tarea.', { cause })
  }
}

export async function updateTaskText(taskId: string, text: string): Promise<Task> {
  const normalized = normalizeTaskText(text)

  if (!normalized) {
    throw new DatabaseError('El texto de la tarea no puede estar vacío.')
  }

  try {
    const db = await getDatabase()
    const tx = db.transaction(['tasks', 'lists'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const current = await taskStore.get(taskId)

    if (!current) {
      throw new DatabaseError('La tarea no existe.')
    }

    const updatedAt = now()
    const updated: Task = {
      ...current,
      text: normalized,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...list, updatedAt })
    }

    await tx.done
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo actualizar la tarea.', { cause })
  }
}

export async function addTasksToList(listId: string, taskTexts: string[]): Promise<Task[]> {
  const texts = taskTexts.map(normalizeTaskText).filter((text) => text.length > 0)

  if (texts.length === 0) {
    throw new DatabaseError('Añade al menos una tarea.')
  }

  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const listStore = tx.objectStore('lists')
    const taskStore = tx.objectStore('tasks')
    const list = await listStore.get(listId)

    if (!list) {
      throw new DatabaseError('La lista no existe.')
    }

    const existing = await getTasksInTransaction(listId, taskStore)
    const createdAt = now()
    const created: Task[] = texts.map((text, index) => ({
      id: createId(),
      listId,
      text,
      completed: false,
      order: existing.length + index,
      createdAt,
      updatedAt: createdAt,
    }))

    for (const task of created) {
      await taskStore.add(task)
    }

    await listStore.put({ ...list, updatedAt: createdAt })
    await tx.done
    return created
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudieron añadir las tareas.', { cause })
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteTasks([taskId])
}

export async function deleteTasks(taskIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(taskIds.filter((taskId) => taskId.length > 0))]

  if (uniqueIds.length === 0) {
    return
  }

  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const listStore = tx.objectStore('lists')

    const affectedListIds = new Set<string>()

    for (const taskId of uniqueIds) {
      const current = await taskStore.get(taskId)
      if (!current) {
        continue
      }

      affectedListIds.add(current.listId)
      await taskStore.delete(taskId)
    }

    const updatedAt = now()

    for (const listId of affectedListIds) {
      const remaining = await getTasksInTransaction(listId, taskStore)

      for (const [index, task] of remaining.entries()) {
        if (task.order !== index) {
          await taskStore.put({ ...task, order: index, updatedAt })
        }
      }

      const list = await listStore.get(listId)
      if (list) {
        await listStore.put({ ...list, updatedAt })
      }
    }

    await tx.done
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError(
      uniqueIds.length > 1
        ? 'No se pudieron eliminar las tareas.'
        : 'No se pudo eliminar la tarea.',
      { cause },
    )
  }
}

export async function reorderTasks(
  listId: string,
  orderedTaskIds: string[],
): Promise<Task[]> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const listStore = tx.objectStore('lists')
    const list = await listStore.get(listId)

    if (!list) {
      throw new DatabaseError('La lista no existe.')
    }

    const tasks = await getTasksInTransaction(listId, taskStore)
    const byId = new Map(tasks.map((task) => [task.id, task]))

    if (
      orderedTaskIds.length !== tasks.length ||
      orderedTaskIds.some((taskId) => !byId.has(taskId))
    ) {
      throw new DatabaseError('El orden de las tareas no es válido.')
    }

    const updatedAt = now()
    const normalized = orderedTaskIds.map((taskId, order) => {
      const task = byId.get(taskId)
      if (!task) {
        throw new DatabaseError('El orden de las tareas no es válido.')
      }

      return { ...task, order, updatedAt }
    })

    for (const task of normalized) {
      await taskStore.put(task)
    }

    await listStore.put({ ...list, updatedAt })
    await tx.done
    return normalized
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo reordenar la tarea.', { cause })
  }
}

export async function resetListTasks(listId: string): Promise<Task[]> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const listStore = tx.objectStore('lists')
    const list = await listStore.get(listId)

    if (!list) {
      throw new DatabaseError('La lista no existe.')
    }

    const tasks = await getTasksInTransaction(listId, taskStore)
    const updatedAt = now()
    const resetTasks = tasks.map((task) => ({
      ...task,
      completed: false,
      updatedAt,
    }))

    for (const task of resetTasks) {
      await taskStore.put(task)
    }

    await listStore.put({ ...list, updatedAt })
    await tx.done
    return resetTasks
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo reiniciar la lista.', { cause })
  }
}

export async function deleteList(listId: string): Promise<void> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const tasks = await taskStore.index('by-listId').getAll(listId)

    for (const task of tasks) {
      await taskStore.delete(task.id)
    }

    await tx.objectStore('lists').delete(listId)
    await tx.done
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo eliminar la lista.', { cause })
  }
}

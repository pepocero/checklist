import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Task, TaskList, TaskListSummary } from '../types'
import { normalizeTaskText } from '../utils/parseTasks'

const DB_NAME = 'checklist-de-tareas'
const DB_VERSION = 4

interface ChecklistSchema extends DBSchema {
  lists: {
    key: string
    value: TaskList
    indexes: { 'by-updatedAt': number; 'by-order': number }
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
    dbPromise = new Promise<IDBPDatabase<ChecklistSchema>>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(
          new DatabaseError(
            'No se pudo abrir la base de datos. Cierra otras pestañas o ventanas de CheckList e inténtalo de nuevo.',
          ),
        )
      }, 8000)

      void openDB<ChecklistSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          if (!db.objectStoreNames.contains('lists')) {
            const lists = db.createObjectStore('lists', { keyPath: 'id' })
            lists.createIndex('by-updatedAt', 'updatedAt')
            lists.createIndex('by-order', 'order')
          } else if (oldVersion < 2) {
            const lists = transaction.objectStore('lists')
            if (!lists.indexNames.contains('by-order')) {
              lists.createIndex('by-order', 'order')
            }
          }

          if (!db.objectStoreNames.contains('tasks')) {
            const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
            tasks.createIndex('by-listId', 'listId')
          }
        },
        blocked() {
          console.warn(
            'CheckList: otra pestaña o la PWA instalada está bloqueando la base de datos. Ciérralas e inténtalo de nuevo.',
          )
        },
      })
        .then(async (db) => {
          db.addEventListener('close', () => {
            dbPromise = null
          })
          await ensureListOrders(db)
          await ensureTaskNotes(db)
          await ensureTaskReminders(db)
          return db
        })
        .then((db) => {
          window.clearTimeout(timeoutId)
          resolve(db)
        })
        .catch((cause: unknown) => {
          window.clearTimeout(timeoutId)
          if (cause instanceof DatabaseError) {
            reject(cause)
            return
          }
          reject(new DatabaseError('No se pudo abrir la base de datos local.', { cause }))
        })
    }).catch((cause: unknown) => {
      dbPromise = null
      throw cause
    })
  }

  return dbPromise
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    note: typeof task.note === 'string' ? task.note : '',
    reminderAt:
      typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt)
        ? task.reminderAt
        : null,
  }
}

function sortLists<T extends TaskList>(lists: T[]): T[] {
  return [...lists].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER
    const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER

    if (orderA !== orderB) {
      return orderA - orderB
    }

    return b.updatedAt - a.updatedAt
  })
}

async function ensureListOrders(db: IDBPDatabase<ChecklistSchema>): Promise<void> {
  const tx = db.transaction('lists', 'readwrite')
  const lists = await tx.store.getAll()
  const needsMigration = lists.some((list) => typeof list.order !== 'number')

  if (!needsMigration) {
    await tx.done
    return
  }

  const sorted = [...lists].sort((a, b) => b.updatedAt - a.updatedAt)

  for (const [index, list] of sorted.entries()) {
    await tx.store.put({ ...list, order: index })
  }

  await tx.done
}

async function ensureTaskNotes(db: IDBPDatabase<ChecklistSchema>): Promise<void> {
  const tx = db.transaction('tasks', 'readwrite')
  const tasks = await tx.store.getAll()
  const needsMigration = tasks.some((task) => typeof task.note !== 'string')

  if (!needsMigration) {
    await tx.done
    return
  }

  for (const task of tasks) {
    if (typeof task.note === 'string') {
      continue
    }

    await tx.store.put({ ...task, note: '' })
  }

  await tx.done
}

async function ensureTaskReminders(db: IDBPDatabase<ChecklistSchema>): Promise<void> {
  const readTx = db.transaction('tasks', 'readonly')
  const tasks = await readTx.store.getAll()
  await readTx.done

  const toUpdate = tasks.filter((task) => {
    const normalized = normalizeTask(task)
    return (
      !Object.prototype.hasOwnProperty.call(task, 'reminderAt') ||
      normalized.note !== task.note ||
      normalized.reminderAt !== task.reminderAt
    )
  })

  if (toUpdate.length === 0) {
    return
  }

  const writeTx = db.transaction('tasks', 'readwrite')
  for (const task of toUpdate) {
    await writeTx.store.put(normalizeTask(task))
  }
  await writeTx.done
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks]
    .map((task) => normalizeTask(task))
    .sort((a, b) => {
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

    return sortLists(
      lists.map((list) => {
        const stats = totals.get(list.id) ?? { total: 0, completed: 0 }
        return {
          ...list,
          order: typeof list.order === 'number' ? list.order : 0,
          totalTasks: stats.total,
          completedTasks: stats.completed,
        }
      }),
    )
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

  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const listStore = tx.objectStore('lists')
    const existing = await listStore.getAll()
    const nextOrder =
      existing.reduce((max, list) => Math.max(max, list.order ?? -1), -1) + 1

    const list: TaskList = {
      id: createId(),
      name: listName,
      order: nextOrder,
      createdAt,
      updatedAt: createdAt,
    }

    await listStore.add(list)

    const taskStore = tx.objectStore('tasks')
    for (const [index, text] of texts.entries()) {
      const task: Task = {
        id: createId(),
        listId: list.id,
        text,
        note: '',
        reminderAt: null,
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

export async function updateTaskNote(taskId: string, note: string): Promise<Task> {
  const normalized = note.replace(/\r\n/g, '\n').trim()

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
      note: normalized,
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

    throw new DatabaseError('No se pudo guardar la nota.', { cause })
  }
}

export async function updateTaskReminder(
  taskId: string,
  reminderAt: number | null,
): Promise<Task> {
  if (reminderAt !== null) {
    if (!Number.isFinite(reminderAt)) {
      throw new DatabaseError('La fecha del recordatorio no es válida.')
    }
    if (reminderAt <= Date.now() - 30_000) {
      throw new DatabaseError('Elige una fecha y hora futuras.')
    }
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
      reminderAt,
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

    throw new DatabaseError('No se pudo guardar el recordatorio.', { cause })
  }
}

export async function getTasksWithReminders(): Promise<Task[]> {
  try {
    const db = await getDatabase()
    const tasks = await db.getAll('tasks')
    return tasks.filter(
      (task) => typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt),
    )
  } catch (cause) {
    throw new DatabaseError('No se pudieron leer los recordatorios.', { cause })
  }
}

export async function clearTaskReminder(taskId: string): Promise<Task | null> {
  try {
    const db = await getDatabase()
    const tx = db.transaction('tasks', 'readwrite')
    const current = await tx.store.get(taskId)

    if (!current) {
      await tx.done
      return null
    }

    if (current.reminderAt === null) {
      await tx.done
      return current
    }

    const updated: Task = {
      ...current,
      reminderAt: null,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    return updated
  } catch (cause) {
    throw new DatabaseError('No se pudo limpiar el recordatorio.', { cause })
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
      note: '',
      reminderAt: null,
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

export async function reorderLists(orderedListIds: string[]): Promise<TaskList[]> {
  try {
    const db = await getDatabase()
    const tx = db.transaction('lists', 'readwrite')
    const lists = await tx.store.getAll()
    const byId = new Map(lists.map((list) => [list.id, list]))

    if (
      orderedListIds.length !== lists.length ||
      orderedListIds.some((listId) => !byId.has(listId))
    ) {
      throw new DatabaseError('El orden de las listas no es válido.')
    }

    const updatedAt = now()
    const normalized = orderedListIds.map((listId, order) => {
      const list = byId.get(listId)
      if (!list) {
        throw new DatabaseError('El orden de las listas no es válido.')
      }

      return { ...list, order, updatedAt }
    })

    for (const list of normalized) {
      await tx.store.put(list)
    }

    await tx.done
    return normalized
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo reordenar las listas.', { cause })
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

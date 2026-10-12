import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Task, TaskKind, TaskList, TaskListSummary, TaskPriority } from '../types'
import { MAX_HIGH_PRIORITY_PER_LIST } from '../types'
import { normalizeTaskText, type ParsedListItem } from '../utils/parseTasks'
import { isCountableTask, normalizeTaskKind } from '../utils/taskKind'
import { normalizeTaskPriority } from '../utils/taskPriority'

const DB_NAME = 'checklist-de-tareas'
const DB_VERSION = 5

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

async function notifyDataChanged(): Promise<void> {
  try {
    const { syncWidgetSnapshot } = await import('./widgetSync')
    await syncWidgetSnapshot()
  } catch {
    // El widget solo aplica en Android; ignorar en web u otros fallos.
  }
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
          await ensureListSchema(db)
          await ensureTaskSchema(db)
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

export function normalizeList(list: TaskList): TaskList {
  return {
    ...list,
    order: typeof list.order === 'number' ? list.order : 0,
    lastCompletedAt:
      typeof list.lastCompletedAt === 'number' && Number.isFinite(list.lastCompletedAt)
        ? list.lastCompletedAt
        : null,
    reminderAt:
      typeof list.reminderAt === 'number' && Number.isFinite(list.reminderAt)
        ? list.reminderAt
        : null,
  }
}

export function normalizeTask(task: Task): Task {
  const kind = normalizeTaskKind(task.kind)
  return {
    ...task,
    note: typeof task.note === 'string' ? task.note : '',
    reminderAt:
      typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt)
        ? task.reminderAt
        : null,
    kind,
    priority: kind === 'section' ? 'normal' : normalizeTaskPriority(task.priority),
    completed: kind === 'section' ? false : Boolean(task.completed),
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

async function ensureListSchema(db: IDBPDatabase<ChecklistSchema>): Promise<void> {
  const readTx = db.transaction('lists', 'readonly')
  const lists = await readTx.store.getAll()
  await readTx.done

  const toUpdate = lists.filter((list) => {
    const normalized = normalizeList(list)
    return (
      normalized.lastCompletedAt !== list.lastCompletedAt ||
      normalized.reminderAt !== list.reminderAt
    )
  })

  if (toUpdate.length === 0) {
    return
  }

  const writeTx = db.transaction('lists', 'readwrite')
  for (const list of toUpdate) {
    await writeTx.store.put(normalizeList(list))
  }
  await writeTx.done
}

async function ensureTaskSchema(db: IDBPDatabase<ChecklistSchema>): Promise<void> {
  const readTx = db.transaction('tasks', 'readonly')
  const tasks = await readTx.store.getAll()
  await readTx.done

  const toUpdate = tasks.filter((task) => {
    const normalized = normalizeTask(task)
    return (
      normalized.note !== task.note ||
      normalized.reminderAt !== task.reminderAt ||
      normalized.kind !== task.kind ||
      normalized.priority !== task.priority ||
      normalized.completed !== task.completed
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

function toParsedItems(items: Array<string | ParsedListItem>): ParsedListItem[] {
  return items
    .map((item) => {
      if (typeof item === 'string') {
        return { text: normalizeTaskText(item), kind: 'task' as const }
      }
      return {
        text: normalizeTaskText(item.text),
        kind: item.kind === 'section' ? ('section' as const) : ('task' as const),
      }
    })
    .filter((item) => item.text.length > 0)
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

function countableStats(tasks: Task[]): { total: number; completed: number } {
  let total = 0
  let completed = 0
  for (const task of tasks) {
    const normalized = normalizeTask(task)
    if (!isCountableTask(normalized)) {
      continue
    }
    total += 1
    if (normalized.completed) {
      completed += 1
    }
  }
  return { total, completed }
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
      const normalized = normalizeTask(task)
      if (!isCountableTask(normalized)) {
        continue
      }
      const current = totals.get(task.listId) ?? { total: 0, completed: 0 }
      current.total += 1
      if (normalized.completed) {
        current.completed += 1
      }
      totals.set(task.listId, current)
    }

    return sortLists(
      lists.map((list) => {
        const stats = totals.get(list.id) ?? { total: 0, completed: 0 }
        return {
          ...normalizeList(list),
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
    const list = await db.get('lists', listId)
    return list ? normalizeList(list) : undefined
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
  items: Array<string | ParsedListItem>,
): Promise<TaskList> {
  const listName = requireName(name)
  const parsed = toParsedItems(items)

  if (parsed.length === 0) {
    throw new DatabaseError('Añade al menos una tarea.')
  }

  if (parsed.every((item) => item.kind === 'section')) {
    throw new DatabaseError('Añade al menos una tarea (no solo secciones).')
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
      lastCompletedAt: null,
      reminderAt: null,
      createdAt,
      updatedAt: createdAt,
    }

    await listStore.add(list)

    const taskStore = tx.objectStore('tasks')
    for (const [index, item] of parsed.entries()) {
      const task: Task = {
        id: createId(),
        listId: list.id,
        text: item.text,
        note: '',
        reminderAt: null,
        kind: item.kind,
        priority: 'normal',
        completed: false,
        order: index,
        createdAt,
        updatedAt: createdAt,
      }
      await taskStore.add(task)
    }

    await tx.done
    await notifyDataChanged()
    return list
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo crear la lista.', { cause })
  }
}

export async function duplicateList(listId: string): Promise<TaskList> {
  try {
    const db = await getDatabase()
    const readTx = db.transaction(['lists', 'tasks'], 'readonly')
    const source = await readTx.objectStore('lists').get(listId)
    if (!source) {
      throw new DatabaseError('La lista no existe.')
    }
    const sourceTasks = sortTasks(
      await readTx.objectStore('tasks').index('by-listId').getAll(listId),
    )
    const allLists = await readTx.objectStore('lists').getAll()
    await readTx.done

    const createdAt = now()
    const nextOrder =
      allLists.reduce((max, list) => Math.max(max, list.order ?? -1), -1) + 1
    const baseName = source.name.trim()
    const copyName = baseName.endsWith('(copia)')
      ? `${baseName}`
      : `${baseName} (copia)`

    const list: TaskList = {
      id: createId(),
      name: copyName.slice(0, 120),
      order: nextOrder,
      lastCompletedAt: null,
      reminderAt: null,
      createdAt,
      updatedAt: createdAt,
    }

    const writeTx = db.transaction(['lists', 'tasks'], 'readwrite')
    await writeTx.objectStore('lists').add(list)

    for (const [index, sourceTask] of sourceTasks.entries()) {
      const normalized = normalizeTask(sourceTask)
      const task: Task = {
        id: createId(),
        listId: list.id,
        text: normalized.text,
        note: normalized.kind === 'section' ? '' : normalized.note,
        reminderAt: null,
        kind: normalized.kind,
        priority: normalized.kind === 'section' ? 'normal' : normalized.priority,
        completed: false,
        order: index,
        createdAt,
        updatedAt: createdAt,
      }
      await writeTx.objectStore('tasks').add(task)
    }

    await writeTx.done
    await notifyDataChanged()
    return list
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo duplicar la lista.', { cause })
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
      ...normalizeList(current),
      name: listName,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo actualizar el nombre de la lista.', { cause })
  }
}

export async function updateListLastCompletedAt(
  listId: string,
  lastCompletedAt: number,
): Promise<TaskList> {
  try {
    const db = await getDatabase()
    const tx = db.transaction('lists', 'readwrite')
    const current = await tx.store.get(listId)

    if (!current) {
      throw new DatabaseError('La lista no existe.')
    }

    const updated: TaskList = {
      ...normalizeList(current),
      lastCompletedAt,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo guardar el historial de la lista.', { cause })
  }
}

export async function updateListReminder(
  listId: string,
  reminderAt: number | null,
): Promise<TaskList> {
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
    const tx = db.transaction('lists', 'readwrite')
    const current = await tx.store.get(listId)

    if (!current) {
      throw new DatabaseError('La lista no existe.')
    }

    const updated: TaskList = {
      ...normalizeList(current),
      reminderAt,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo guardar el recordatorio de la lista.', { cause })
  }
}

export async function getListsWithReminders(): Promise<TaskList[]> {
  try {
    const db = await getDatabase()
    const lists = await db.getAll('lists')
    return lists
      .map((list) => normalizeList(list))
      .filter(
        (list) =>
          typeof list.reminderAt === 'number' && Number.isFinite(list.reminderAt),
      )
  } catch (cause) {
    throw new DatabaseError('No se pudieron leer los recordatorios de listas.', {
      cause,
    })
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

    const normalizedCurrent = normalizeTask(current)
    if (!isCountableTask(normalizedCurrent)) {
      throw new DatabaseError('Las secciones no se pueden marcar como hechas.')
    }

    const updatedAt = now()
    const updated: Task = {
      ...normalizedCurrent,
      completed,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await listStore.get(current.listId)
    if (list) {
      const siblings = await getTasksInTransaction(current.listId, taskStore)
      const withUpdate = siblings.map((task) =>
        task.id === updated.id ? updated : normalizeTask(task),
      )
      const stats = countableStats(withUpdate)
      const allDone = stats.total > 0 && stats.completed === stats.total
      await listStore.put({
        ...normalizeList(list),
        updatedAt,
        lastCompletedAt: allDone ? updatedAt : normalizeList(list).lastCompletedAt,
      })
    }

    await tx.done
    await notifyDataChanged()
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
    throw new DatabaseError('El texto no puede estar vacío.')
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
      ...normalizeTask(current),
      text: normalized,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...normalizeList(list), updatedAt })
    }

    await tx.done
    await notifyDataChanged()
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

    const normalizedCurrent = normalizeTask(current)
    if (!isCountableTask(normalizedCurrent)) {
      throw new DatabaseError('Las secciones no tienen nota.')
    }

    const updatedAt = now()
    const updated: Task = {
      ...normalizedCurrent,
      note: normalized,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...normalizeList(list), updatedAt })
    }

    await tx.done
    await notifyDataChanged()
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

    const normalizedCurrent = normalizeTask(current)
    if (!isCountableTask(normalizedCurrent)) {
      throw new DatabaseError('Las secciones no tienen recordatorio.')
    }

    const updatedAt = now()
    const updated: Task = {
      ...normalizedCurrent,
      reminderAt,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...normalizeList(list), updatedAt })
    }

    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo guardar el recordatorio.', { cause })
  }
}

export async function updateTaskKind(
  taskId: string,
  kind: TaskKind,
): Promise<Task> {
  const nextKind = normalizeTaskKind(kind)

  try {
    const db = await getDatabase()
    const tx = db.transaction(['tasks', 'lists'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const current = await taskStore.get(taskId)

    if (!current) {
      throw new DatabaseError('La tarea no existe.')
    }

    const normalizedCurrent = normalizeTask(current)
    const updatedAt = now()
    const updated: Task = {
      ...normalizedCurrent,
      kind: nextKind,
      priority: nextKind === 'section' ? 'normal' : normalizedCurrent.priority,
      completed: nextKind === 'section' ? false : normalizedCurrent.completed,
      note: nextKind === 'section' ? '' : normalizedCurrent.note,
      reminderAt: nextKind === 'section' ? null : normalizedCurrent.reminderAt,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...normalizeList(list), updatedAt })
    }

    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo cambiar el tipo de elemento.', { cause })
  }
}

export async function updateTaskPriority(
  taskId: string,
  priority: TaskPriority,
): Promise<Task> {
  const nextPriority = normalizeTaskPriority(priority)

  try {
    const db = await getDatabase()
    const tx = db.transaction(['tasks', 'lists'], 'readwrite')
    const taskStore = tx.objectStore('tasks')
    const current = await taskStore.get(taskId)

    if (!current) {
      throw new DatabaseError('La tarea no existe.')
    }

    const normalizedCurrent = normalizeTask(current)
    if (!isCountableTask(normalizedCurrent)) {
      throw new DatabaseError('Las secciones no tienen prioridad.')
    }

    if (nextPriority === 'high' && normalizedCurrent.priority !== 'high') {
      const siblings = await getTasksInTransaction(current.listId, taskStore)
      const highCount = siblings.filter(
        (task) =>
          task.id !== taskId &&
          isCountableTask(task) &&
          normalizeTaskPriority(task.priority) === 'high',
      ).length
      if (highCount >= MAX_HIGH_PRIORITY_PER_LIST) {
        throw new DatabaseError(
          `Solo puedes marcar ${MAX_HIGH_PRIORITY_PER_LIST} tareas como prioritarias por lista.`,
        )
      }
    }

    const updatedAt = now()
    const updated: Task = {
      ...normalizedCurrent,
      priority: nextPriority,
      updatedAt,
    }
    await taskStore.put(updated)

    const list = await tx.objectStore('lists').get(current.listId)
    if (list) {
      await tx.objectStore('lists').put({ ...normalizeList(list), updatedAt })
    }

    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo guardar la prioridad.', { cause })
  }
}

export async function getTasksWithReminders(): Promise<Task[]> {
  try {
    const db = await getDatabase()
    const tasks = await db.getAll('tasks')
    return tasks
      .map((task) => normalizeTask(task))
      .filter(
        (task) =>
          isCountableTask(task) &&
          typeof task.reminderAt === 'number' &&
          Number.isFinite(task.reminderAt),
      )
  } catch (cause) {
    throw new DatabaseError('No se pudieron leer los recordatorios.', { cause })
  }
}

export async function getUpcomingReminderItems(): Promise<
  Array<{ task: Task; list: TaskList }>
> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readonly')
    const lists = await tx.objectStore('lists').getAll()
    const tasks = await tx.objectStore('tasks').getAll()
    await tx.done

    const listById = new Map(lists.map((list) => [list.id, normalizeList(list)]))

    return tasks
      .map((task) => normalizeTask(task))
      .filter(
        (task) =>
          isCountableTask(task) &&
          typeof task.reminderAt === 'number' &&
          Number.isFinite(task.reminderAt),
      )
      .map((task) => {
        const list = listById.get(task.listId)
        return list ? { task, list } : null
      })
      .filter((item): item is { task: Task; list: TaskList } => item !== null)
      .sort((a, b) => (a.task.reminderAt ?? 0) - (b.task.reminderAt ?? 0))
  } catch (cause) {
    throw new DatabaseError('No se pudieron cargar los recordatorios.', { cause })
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

    const normalized = normalizeTask(current)
    if (normalized.reminderAt === null) {
      await tx.done
      return normalized
    }

    const updated: Task = {
      ...normalized,
      reminderAt: null,
      updatedAt: now(),
    }
    await tx.store.put(updated)
    await tx.done
    await notifyDataChanged()
    return updated
  } catch (cause) {
    throw new DatabaseError('No se pudo limpiar el recordatorio.', { cause })
  }
}

export async function addTasksToList(
  listId: string,
  items: Array<string | ParsedListItem>,
): Promise<Task[]> {
  const parsed = toParsedItems(items)

  if (parsed.length === 0) {
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
    const created: Task[] = parsed.map((item, index) => ({
      id: createId(),
      listId,
      text: item.text,
      note: '',
      reminderAt: null,
      kind: item.kind,
      priority: 'normal' as TaskPriority,
      completed: false,
      order: existing.length + index,
      createdAt,
      updatedAt: createdAt,
    }))

    for (const task of created) {
      await taskStore.add(task)
    }

    await listStore.put({ ...normalizeList(list), updatedAt: createdAt })
    await tx.done
    await notifyDataChanged()
    return created
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudieron añadir las tareas.', { cause })
  }
}

export async function addSectionToList(listId: string, title: string): Promise<Task> {
  const text = normalizeTaskText(title)
  if (!text) {
    throw new DatabaseError('El título de la sección no puede estar vacío.')
  }

  const [created] = await addTasksToList(listId, [{ text, kind: 'section' }])
  if (!created) {
    throw new DatabaseError('No se pudo añadir la sección.')
  }
  return created
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
        await listStore.put({ ...normalizeList(list), updatedAt })
      }
    }

    await tx.done
    await notifyDataChanged()
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

      return { ...normalizeList(list), order, updatedAt }
    })

    for (const list of normalized) {
      await tx.store.put(list)
    }

    await tx.done
    await notifyDataChanged()
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

      return { ...normalizeTask(task), order, updatedAt }
    })

    for (const task of normalized) {
      await taskStore.put(task)
    }

    await listStore.put({ ...normalizeList(list), updatedAt })
    await tx.done
    await notifyDataChanged()
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
      ...normalizeTask(task),
      completed: false,
      updatedAt,
    }))

    for (const task of resetTasks) {
      await taskStore.put(task)
    }

    await listStore.put({ ...normalizeList(list), updatedAt })
    await tx.done
    await notifyDataChanged()
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
    await notifyDataChanged()
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo eliminar la lista.', { cause })
  }
}

export async function exportAllData(): Promise<{ lists: TaskList[]; tasks: Task[] }> {
  try {
    const db = await getDatabase()
    const lists = (await db.getAll('lists')).map((list) => normalizeList(list))
    const tasks = (await db.getAll('tasks')).map((task) => normalizeTask(task))
    return { lists, tasks }
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo exportar la copia de seguridad.', { cause })
  }
}

export async function replaceAllData(lists: TaskList[], tasks: Task[]): Promise<void> {
  try {
    const db = await getDatabase()
    const tx = db.transaction(['lists', 'tasks'], 'readwrite')
    const listStore = tx.objectStore('lists')
    const taskStore = tx.objectStore('tasks')

    const existingLists = await listStore.getAllKeys()
    for (const key of existingLists) {
      await listStore.delete(key)
    }

    const existingTasks = await taskStore.getAllKeys()
    for (const key of existingTasks) {
      await taskStore.delete(key)
    }

    for (const list of lists) {
      await listStore.put(normalizeList(list))
    }

    for (const task of tasks) {
      await taskStore.put(normalizeTask(task))
    }

    await tx.done
    await notifyDataChanged()
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    throw new DatabaseError('No se pudo restaurar la copia de seguridad.', { cause })
  }
}

export type { TaskKind }

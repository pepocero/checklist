export type TaskKind = 'task' | 'section'
export type TaskPriority = 'normal' | 'high'

export interface TaskList {
  id: string
  name: string
  order: number
  /** Timestamp (ms) de la última vez que la lista llegó al 100%. */
  lastCompletedAt: number | null
  /** Recordatorio de la lista completa (ms); null si no hay. */
  reminderAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  listId: string
  text: string
  note: string
  /** Marca de tiempo (ms) para avisar; null si no hay recordatorio. */
  reminderAt: number | null
  kind: TaskKind
  priority: TaskPriority
  completed: boolean
  order: number
  createdAt: number
  updatedAt: number
}

export interface TaskListSummary extends TaskList {
  totalTasks: number
  completedTasks: number
}

/** Máximo de tareas con prioridad alta por lista. */
export const MAX_HIGH_PRIORITY_PER_LIST = 2

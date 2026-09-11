export interface TaskList {
  id: string
  name: string
  order: number
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
  completed: boolean
  order: number
  createdAt: number
  updatedAt: number
}

export interface TaskListSummary extends TaskList {
  totalTasks: number
  completedTasks: number
}

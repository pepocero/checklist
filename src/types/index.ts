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
  completed: boolean
  order: number
  createdAt: number
  updatedAt: number
}

export interface TaskListSummary extends TaskList {
  totalTasks: number
  completedTasks: number
}

import type { Task, TaskPriority } from '../types'
import { isSectionTask } from './taskKind'

export function normalizeTaskPriority(value: unknown): TaskPriority {
  return value === 'high' ? 'high' : 'normal'
}

export function isHighPriorityTask(task: Pick<Task, 'kind' | 'priority'>): boolean {
  if (isSectionTask(task)) {
    return false
  }
  return normalizeTaskPriority(task.priority) === 'high'
}

export function countHighPriorityTasks(tasks: Array<Pick<Task, 'kind' | 'priority'>>): number {
  return tasks.filter((task) => isHighPriorityTask(task)).length
}

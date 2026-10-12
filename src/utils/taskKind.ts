import type { Task, TaskKind } from '../types'

export function normalizeTaskKind(value: unknown): TaskKind {
  return value === 'section' ? 'section' : 'task'
}

export function isSectionTask(task: Pick<Task, 'kind'>): boolean {
  return normalizeTaskKind(task.kind) === 'section'
}

export function isCountableTask(task: Pick<Task, 'kind'>): boolean {
  return !isSectionTask(task)
}

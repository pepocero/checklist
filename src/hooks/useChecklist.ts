import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getListById,
  getTasksByListId,
  resetListTasks,
  setTaskCompleted,
} from '../services/database'
import type { Task, TaskList } from '../types'
import { isListComplete } from '../utils/progress'

interface UseChecklistResult {
  list: TaskList | null
  tasks: Task[]
  isReady: boolean
  notFound: boolean
  error: string | null
  completedCount: number
  totalCount: number
  isComplete: boolean
  toggleTask: (taskId: string) => void
  resetTasks: () => Promise<void>
  refresh: () => Promise<void>
}

export function useChecklist(listId: string | undefined): UseChecklistResult {
  const [list, setList] = useState<TaskList | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isReady, setIsReady] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tasksRef = useRef<Task[]>([])

  const refresh = useCallback(async () => {
    if (!listId) {
      setList(null)
      setTasks([])
      tasksRef.current = []
      setNotFound(true)
      setIsReady(true)
      return
    }

    try {
      const [nextList, nextTasks] = await Promise.all([
        getListById(listId),
        getTasksByListId(listId),
      ])

      if (!nextList) {
        setList(null)
        setTasks([])
        tasksRef.current = []
        setNotFound(true)
        setError(null)
        return
      }

      setList(nextList)
      setTasks(nextTasks)
      tasksRef.current = nextTasks
      setNotFound(false)
      setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo abrir la lista.'
      setError(message)
    } finally {
      setIsReady(true)
    }
  }, [listId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleTask = useCallback((taskId: string) => {
    const current = tasksRef.current.find((task) => task.id === taskId)
    if (!current) {
      return
    }

    const completed = !current.completed
    const nextTasks = tasksRef.current.map((task) =>
      task.id === taskId
        ? { ...task, completed, updatedAt: Date.now() }
        : task,
    )

    tasksRef.current = nextTasks
    setTasks(nextTasks)
    setList((currentList) =>
      currentList ? { ...currentList, updatedAt: Date.now() } : currentList,
    )

    void setTaskCompleted(taskId, completed).catch((cause: unknown) => {
      const reverted = tasksRef.current.map((task) =>
        task.id === taskId
          ? { ...task, completed: current.completed }
          : task,
      )
      tasksRef.current = reverted
      setTasks(reverted)
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar la tarea.'
      setError(message)
    })
  }, [])

  const resetTasks = useCallback(async () => {
    if (!listId) {
      return
    }

    const previous = tasksRef.current
    const optimistic = previous.map((task) => ({
      ...task,
      completed: false,
      updatedAt: Date.now(),
    }))
    tasksRef.current = optimistic
    setTasks(optimistic)

    try {
      const persisted = await resetListTasks(listId)
      tasksRef.current = persisted
      setTasks(persisted)
      setError(null)
    } catch (cause) {
      tasksRef.current = previous
      setTasks(previous)
      const message = cause instanceof Error ? cause.message : 'No se pudo reiniciar la lista.'
      setError(message)
      throw cause
    }
  }, [listId])

  const completedCount = tasks.filter((task) => task.completed).length
  const totalCount = tasks.length

  return {
    list,
    tasks,
    isReady,
    notFound,
    error,
    completedCount,
    totalCount,
    isComplete: isListComplete(completedCount, totalCount),
    toggleTask,
    resetTasks,
    refresh,
  }
}

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  deleteList as deleteListFromDb,
  getAllListSummaries,
  reorderLists as reorderListsInDb,
} from '../services/database'
import type { TaskListSummary } from '../types'

interface UseListsResult {
  lists: TaskListSummary[]
  setLists: Dispatch<SetStateAction<TaskListSummary[]>>
  isReady: boolean
  error: string | null
  refresh: () => Promise<void>
  deleteList: (listId: string) => Promise<void>
  reorderLists: (orderedListIds: string[]) => Promise<void>
}

export function useLists(): UseListsResult {
  const [lists, setLists] = useState<TaskListSummary[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const nextLists = await getAllListSummaries()
      setLists(nextLists)
      setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudieron cargar las listas.'
      setError(message)
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const deleteList = useCallback(async (listId: string) => {
    const previous = lists
    setLists((current) => current.filter((list) => list.id !== listId))

    try {
      await deleteListFromDb(listId)
      setError(null)
    } catch (cause) {
      setLists(previous)
      const message = cause instanceof Error ? cause.message : 'No se pudo eliminar la lista.'
      setError(message)
      throw cause
    }
  }, [lists])

  const reorderLists = useCallback(async (orderedListIds: string[]) => {
    try {
      const normalized = await reorderListsInDb(orderedListIds)
      setLists((current) => {
        const byId = new Map(current.map((list) => [list.id, list]))
        return normalized.map((list) => {
          const summary = byId.get(list.id)
          return {
            ...list,
            totalTasks: summary?.totalTasks ?? 0,
            completedTasks: summary?.completedTasks ?? 0,
          }
        })
      })
      setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo reordenar las listas.'
      setError(message)
      throw cause
    }
  }, [])

  return {
    lists,
    setLists,
    isReady,
    error,
    refresh,
    deleteList,
    reorderLists,
  }
}

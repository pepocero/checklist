import { useCallback, useEffect, useState } from 'react'
import { deleteList as deleteListFromDb, getAllListSummaries } from '../services/database'
import type { TaskListSummary } from '../types'

interface UseListsResult {
  lists: TaskListSummary[]
  isReady: boolean
  error: string | null
  refresh: () => Promise<void>
  deleteList: (listId: string) => Promise<void>
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

  return {
    lists,
    isReady,
    error,
    refresh,
    deleteList,
  }
}

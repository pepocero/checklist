import { Capacitor } from '@capacitor/core'
import { WidgetBridge, type WidgetSnapshot } from '../plugins/widgetBridge'
import { isCountableTask } from '../utils/taskKind'
import {
  exportAllData,
  getAllListSummaries,
  setTaskCompleted,
} from './database'

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function syncWidgetSnapshot(): Promise<void> {
  if (!isAndroidNative()) {
    return
  }

  const [summaries, { tasks }] = await Promise.all([
    getAllListSummaries(),
    exportAllData(),
  ])

  const snapshot: WidgetSnapshot = {
    lists: summaries.map((list) => ({
      id: list.id,
      name: list.name,
      order: list.order,
      totalTasks: list.totalTasks,
      completedTasks: list.completedTasks,
    })),
    tasks: tasks
      .filter((task) => isCountableTask(task))
      .map((task) => ({
        id: task.id,
        listId: task.listId,
        text: task.text,
        completed: task.completed,
        order: task.order,
        kind: task.kind,
      })),
    updatedAt: Date.now(),
  }

  await WidgetBridge.syncSnapshot({ snapshot })
}

export async function drainWidgetPendingToggles(): Promise<number> {
  if (!isAndroidNative()) {
    return 0
  }

  const { toggles } = await WidgetBridge.getPendingToggles()
  if (!toggles.length) {
    return 0
  }

  for (const toggle of toggles) {
    try {
      await setTaskCompleted(toggle.taskId, toggle.completed)
    } catch {
      // Tarea eliminada u otro error: continuar con el resto.
    }
  }

  await WidgetBridge.clearPendingToggles()
  await syncWidgetSnapshot()
  return toggles.length
}

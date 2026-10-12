import { registerPlugin } from '@capacitor/core'

export interface WidgetSnapshotList {
  id: string
  name: string
  order: number
  totalTasks: number
  completedTasks: number
}

export interface WidgetSnapshotTask {
  id: string
  listId: string
  text: string
  completed: boolean
  order: number
  kind: 'task' | 'section'
}

export interface WidgetSnapshot {
  lists: WidgetSnapshotList[]
  tasks: WidgetSnapshotTask[]
  updatedAt: number
}

export interface WidgetPendingToggle {
  taskId: string
  completed: boolean
}

export interface WidgetBridgePlugin {
  syncSnapshot(options: { snapshot: WidgetSnapshot }): Promise<void>
  getPendingToggles(): Promise<{ toggles: WidgetPendingToggle[] }>
  clearPendingToggles(): Promise<void>
  getSelectedListId(): Promise<{ listId: string | null }>
  setSelectedListId(options: { listId: string | null }): Promise<void>
}

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

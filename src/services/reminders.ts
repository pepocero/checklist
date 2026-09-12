import {
  clearTaskReminder,
  getTasksWithReminders,
} from './database'
import type { Task } from '../types'
import { getTaskReminderAt } from '../utils/taskReminder'
import { ReminderError } from './reminderError'
import {
  cancelNativeTaskReminder,
  ensureNativeNotificationPermission,
  isNativeApp,
  scheduleNativeTaskReminder,
  startNativeReminderListeners,
} from './nativeReminders'

export { ReminderError } from './reminderError'

const timers = new Map<string, number>()
const MAX_TIMEOUT_MS = 2_147_000_000
const SW_READY_TIMEOUT_MS = 1500

export function notificationsSupported(): boolean {
  if (isNativeApp()) {
    return true
  }
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (isNativeApp()) {
    return 'granted'
  }
  if (!notificationsSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (isNativeApp()) {
    await ensureNativeNotificationPermission()
    return 'granted'
  }

  if (!notificationsSupported()) {
    throw new ReminderError('Este dispositivo no admite notificaciones.')
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    throw new ReminderError(
      'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o del sistema.',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new ReminderError('Necesitas permitir notificaciones para programar el aviso.')
  }

  return permission
}

function reminderTag(taskId: string): string {
  return `task-reminder-${taskId}`
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || isNativeApp()) {
    return null
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing?.active) {
      return existing
    }

    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)
      }),
    ])
  } catch {
    return null
  }
}

async function cancelBrowserNotification(taskId: string): Promise<void> {
  const registration = await getServiceWorkerRegistration()
  if (!registration?.getNotifications) {
    return
  }

  const existing = await registration.getNotifications({ tag: reminderTag(taskId) })
  for (const notification of existing) {
    notification.close()
  }
}

async function displayReminderNotification(task: Task): Promise<void> {
  const title = 'Recordatorio de tarea'
  const body = task.text
  const options: NotificationOptions = {
    body,
    tag: reminderTag(task.id),
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    data: {
      url: `/lista/${task.listId}`,
      taskId: task.id,
      listId: task.listId,
    },
  }

  const registration = await getServiceWorkerRegistration()
  if (registration) {
    await registration.showNotification(title, options)
    return
  }

  if (notificationsSupported() && Notification.permission === 'granted') {
    new Notification(title, options)
  }
}

export async function showTaskReminderNotification(task: Task): Promise<void> {
  const reminderAt = getTaskReminderAt(task.reminderAt)
  if (reminderAt === null) {
    return
  }

  try {
    await displayReminderNotification(task)
  } finally {
    clearScheduledTimer(task.id)
    await clearTaskReminder(task.id)
  }
}

function clearScheduledTimer(taskId: string): void {
  const timerId = timers.get(taskId)
  if (timerId !== undefined) {
    window.clearTimeout(timerId)
    timers.delete(taskId)
  }
}

export async function cancelTaskReminderSchedule(taskId: string): Promise<void> {
  clearScheduledTimer(taskId)
  try {
    await cancelBrowserNotification(taskId)
  } catch {
    // Ignorar si el service worker no está listo.
  }
  try {
    await cancelNativeTaskReminder(taskId)
  } catch {
    // Ignorar si el plugin nativo no está listo.
  }
}

/**
 * Programa el aviso:
 * - App Android (Capacitor): notificación local nativa (funciona con la app cerrada).
 * - Web: temporizador solo mientras la página sigue abierta.
 */
export async function scheduleTaskReminder(task: Task): Promise<void> {
  clearScheduledTimer(task.id)

  const reminderAt = getTaskReminderAt(task.reminderAt)
  if (reminderAt === null) {
    return
  }

  if (isNativeApp()) {
    await scheduleNativeTaskReminder(task)
    return
  }

  if (!notificationsSupported() || Notification.permission !== 'granted') {
    return
  }

  void cancelBrowserNotification(task.id).catch(() => undefined)

  const delay = reminderAt - Date.now()
  if (delay <= 0) {
    await showTaskReminderNotification(task)
    return
  }

  const wait = Math.min(delay, MAX_TIMEOUT_MS)
  const timerId = window.setTimeout(() => {
    void (async () => {
      timers.delete(task.id)
      try {
        const latest = (await getTasksWithReminders()).find((item) => item.id === task.id)
        if (!latest || getTaskReminderAt(latest.reminderAt) === null) {
          return
        }

        const latestAt = getTaskReminderAt(latest.reminderAt)
        if (latestAt === null) {
          return
        }

        if (latestAt > Date.now() + 1_000) {
          await scheduleTaskReminder(latest)
          return
        }

        await showTaskReminderNotification(latest)
      } catch {
        // Evitar fallos silenciosos del timer.
      }
    })()
  }, wait)

  timers.set(task.id, timerId)
}

export async function syncAllTaskReminders(): Promise<void> {
  if (isNativeApp()) {
    const tasks = await getTasksWithReminders()
    for (const task of tasks) {
      try {
        await scheduleNativeTaskReminder(task)
      } catch {
        // Continuar con el resto.
      }
    }
    return
  }

  if (!notificationsSupported() || Notification.permission !== 'granted') {
    return
  }

  const tasks = await getTasksWithReminders()
  const activeIds = new Set(tasks.map((task) => task.id))

  for (const taskId of [...timers.keys()]) {
    if (!activeIds.has(taskId)) {
      clearScheduledTimer(taskId)
    }
  }

  for (const task of tasks) {
    try {
      await scheduleTaskReminder(task)
    } catch {
      // Continuar con el resto.
    }
  }
}

let syncStarted = false

export function startReminderSync(): void {
  if (syncStarted || typeof window === 'undefined') {
    return
  }

  syncStarted = true
  startNativeReminderListeners()

  const run = () => {
    void syncAllTaskReminders().catch(() => {
      // Silenciar errores de sincronización en segundo plano.
    })
  }

  run()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      run()
    }
  })

  window.addEventListener('focus', run)
}

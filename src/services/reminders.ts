import {
  clearTaskReminder,
  getTasksWithReminders,
} from './database'
import type { Task } from '../types'
import { getTaskReminderAt } from '../utils/taskReminder'
import {
  fetchVapidPublicKey,
  getPushApiBase,
  pushApiConfigured,
  urlBase64ToUint8Array,
} from '../config/push'

const timers = new Map<string, number>()
const MAX_TIMEOUT_MS = 2_147_000_000
const SW_READY_TIMEOUT_MS = 1500

export class ReminderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ReminderError'
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
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
  if (!('serviceWorker' in navigator)) {
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

async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export async function ensurePushSubscription(): Promise<PushSubscription> {
  if (!pushSupported()) {
    throw new ReminderError('Este dispositivo no admite notificaciones push.')
  }

  if (!pushApiConfigured()) {
    throw new ReminderError(
      'Las notificaciones en segundo plano no están configuradas en este entorno.',
    )
  }

  await ensureNotificationPermission()

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    throw new ReminderError('El service worker no está listo. Recarga la app e inténtalo de nuevo.')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const publicKey = await fetchVapidPublicKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const base = getPushApiBase()
  const response = await fetch(`${base}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  if (!response.ok) {
    throw new ReminderError('No se pudo registrar este dispositivo para avisos en segundo plano.')
  }

  return subscription
}

async function scheduleRemoteReminder(task: Task): Promise<void> {
  const reminderAt = getTaskReminderAt(task.reminderAt)
  if (reminderAt === null || !pushApiConfigured()) {
    return
  }

  const subscription = await ensurePushSubscription()
  const base = getPushApiBase()
  const response = await fetch(`${base}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: task.id,
      listId: task.listId,
      text: task.text,
      reminderAt,
      subscription: subscription.toJSON(),
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ReminderError(
      payload?.error ?? 'No se pudo programar el aviso en segundo plano.',
    )
  }
}

async function cancelRemoteReminder(taskId: string): Promise<void> {
  if (!pushApiConfigured()) {
    return
  }

  const subscription = await getPushSubscription()
  if (!subscription) {
    return
  }

  const base = getPushApiBase()
  await fetch(`${base}/reminders`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      endpoint: subscription.endpoint,
    }),
  }).catch(() => undefined)
}

export async function cancelTaskReminderSchedule(taskId: string): Promise<void> {
  clearScheduledTimer(taskId)
  try {
    await cancelBrowserNotification(taskId)
  } catch {
    // Ignorar si el service worker no está listo.
  }
  await cancelRemoteReminder(taskId)
}

export async function scheduleTaskReminder(task: Task): Promise<void> {
  clearScheduledTimer(task.id)

  const reminderAt = getTaskReminderAt(task.reminderAt)
  if (reminderAt === null) {
    return
  }

  if (Notification.permission !== 'granted') {
    return
  }

  void cancelBrowserNotification(task.id).catch(() => undefined)

  // Aviso en segundo plano (app cerrada) vía Cloudflare Worker + Web Push.
  if (pushApiConfigured() && pushSupported()) {
    await scheduleRemoteReminder(task)
  }

  // Respaldo local mientras la app sigue abierta.
  const delay = reminderAt - Date.now()
  if (delay <= 0) {
    // Si el push en segundo plano ya debió enviarse, solo limpiar local.
    if (pushApiConfigured() && delay < -120_000) {
      clearScheduledTimer(task.id)
      await clearTaskReminder(task.id)
      return
    }
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
      // Continuar con el resto si uno falla (p. ej. sin API push).
    }
  }
}

let syncStarted = false

export function startReminderSync(): void {
  if (syncStarted || typeof window === 'undefined') {
    return
  }

  syncStarted = true

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

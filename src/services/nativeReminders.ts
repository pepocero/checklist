import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Task } from '../types'
import { getTaskReminderAt } from '../utils/taskReminder'
import { ReminderError } from './reminderError'

/** Canal nuevo: el anterior se creó sin sonido real de sistema (no se puede editar). */
const CHANNEL_ID = 'task-reminders-v2'
const LEGACY_CHANNEL_ID = 'task-reminders'
let channelReady = false
let listenersReady = false

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** ID numérico estable a partir del UUID de la tarea (requisito de Local Notifications). */
export function nativeNotificationId(taskId: string): number {
  let hash = 0
  for (let index = 0; index < taskId.length; index += 1) {
    hash = (Math.imul(31, hash) + taskId.charCodeAt(index)) | 0
  }
  const id = Math.abs(hash)
  return id === 0 ? 1 : id
}

async function ensureNotificationChannel(): Promise<void> {
  if (channelReady || Capacitor.getPlatform() !== 'android') {
    channelReady = true
    return
  }

  // Quitar canal antiguo (sound: "default" apuntaba a raw/default inexistente → silencio).
  try {
    await LocalNotifications.deleteChannel({ id: LEGACY_CHANNEL_ID })
  } catch {
    // Puede no existir.
  }

  // Sin propiedad `sound`: Android usa el tono de notificación del sistema.
  // IMPORTANCE_HIGH (5) permite heads-up + sonido.
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Recordatorios',
    description: 'Avisos de tareas de Checklist',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0284c7',
  })
  channelReady = true
}

export async function ensureNativeNotificationPermission(): Promise<void> {
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') {
    await ensureNotificationChannel()
    return
  }

  const requested = await LocalNotifications.requestPermissions()
  if (requested.display !== 'granted') {
    throw new ReminderError(
      'Necesitas permitir notificaciones para programar el aviso.',
    )
  }

  await ensureNotificationChannel()
}

export async function cancelNativeTaskReminder(taskId: string): Promise<void> {
  if (!isNativeApp()) {
    return
  }

  const id = nativeNotificationId(taskId)
  await LocalNotifications.cancel({ notifications: [{ id }] })
}

export async function scheduleNativeTaskReminder(task: Task): Promise<void> {
  if (!isNativeApp()) {
    return
  }

  const reminderAt = getTaskReminderAt(task.reminderAt)
  if (reminderAt === null) {
    return
  }

  await ensureNativeNotificationPermission()
  await cancelNativeTaskReminder(task.id)

  // Ya vencido: no reprogramar ni borrar; el icono de campana se mantiene en la tarea.
  if (reminderAt <= Date.now()) {
    return
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: nativeNotificationId(task.id),
        title: 'Recordatorio de tarea',
        body: task.text,
        schedule: {
          at: new Date(reminderAt),
          allowWhileIdle: true,
        },
        channelId: CHANNEL_ID,
        // Dejar que el canal defina el tono del sistema.
        extra: {
          taskId: task.id,
          listId: task.listId,
        },
      },
    ],
  })
}

export function startNativeReminderListeners(): void {
  if (!isNativeApp() || listenersReady || typeof window === 'undefined') {
    return
  }

  listenersReady = true

  // No borrar reminderAt al disparar: el usuario debe ver que había aviso a esa hora.
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const listId = action.notification.extra?.listId
    if (typeof listId === 'string' && listId.length > 0) {
      window.location.hash = ''
      window.location.assign(`/lista/${listId}`)
    }
  })
}

import type { Task } from '../types'
import { getTaskReminderAt } from './taskReminder'

const EVENT_DURATION_MS = 15 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** UTC compacto para enlaces de Google Calendar (`YYYYMMDDTHHMMSSZ`). */
function toGoogleUtcDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function buildEventDescription(listName?: string, appUrl?: string): string {
  return [listName?.trim() ? `Lista: ${listName.trim()}` : null, 'Recordatorio de CheckList', appUrl ?? null]
    .filter(Boolean)
    .join('\n')
}

export function buildGoogleCalendarUrl(input: {
  task: Task
  listName?: string
  appUrl?: string
}): string {
  const reminderAt = getTaskReminderAt(input.task.reminderAt)
  if (reminderAt === null) {
    throw new Error('La tarea no tiene recordatorio.')
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.task.text.trim() || 'Tarea pendiente',
    dates: `${toGoogleUtcDateTime(reminderAt)}/${toGoogleUtcDateTime(reminderAt + EVENT_DURATION_MS)}`,
    details: buildEventDescription(input.listName, input.appUrl),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function openExternalUrl(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * Abre el calendario con el evento ya rellenado (Google Calendar web/app).
 * En Android/iOS suele abrir la app nativa; no descarga archivos .ics.
 */
export async function addTaskReminderToCalendar(input: {
  task: Task
  listName?: string
}): Promise<void> {
  const reminderAt = getTaskReminderAt(input.task.reminderAt)
  if (reminderAt === null) {
    throw new Error('La tarea no tiene recordatorio.')
  }

  const appUrl =
    typeof window !== 'undefined'
      ? new URL(`/lista/${input.task.listId}`, window.location.origin).href
      : undefined

  openExternalUrl(
    buildGoogleCalendarUrl({
      task: input.task,
      listName: input.listName,
      appUrl,
    }),
  )
}

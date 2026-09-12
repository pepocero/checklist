import type { Task } from '../types'
import { getTaskReminderAt } from './taskReminder'

const EVENT_DURATION_MS = 15 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Fecha/hora local en formato ICS (sin zona: el calendario usa la del dispositivo). */
function toIcsLocalDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/** UTC compacto para enlaces de Google Calendar (`YYYYMMDDTHHMMSSZ`). */
function toGoogleUtcDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function isLikelyMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false
  }

  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true
  }

  return navigator.maxTouchPoints > 0 && window.matchMedia('(max-width: 900px)').matches
}

function buildEventDescription(task: Task, listName?: string, appUrl?: string): string {
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
    details: buildEventDescription(input.task, input.listName, input.appUrl),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) {
    return line
  }

  const chunks: string[] = []
  let remaining = line
  chunks.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`)
    remaining = remaining.slice(74)
  }
  return chunks.join('\r\n')
}

export function buildTaskReminderIcs(input: {
  task: Task
  listName?: string
  appUrl?: string
}): string {
  const reminderAt = getTaskReminderAt(input.task.reminderAt)
  if (reminderAt === null) {
    throw new Error('La tarea no tiene recordatorio.')
  }

  const stamp = toIcsLocalDateTime(Date.now())
  const start = toIcsLocalDateTime(reminderAt)
  const end = toIcsLocalDateTime(reminderAt + EVENT_DURATION_MS)
  const summary = escapeIcsText(input.task.text.trim() || 'Tarea pendiente')
  const description = escapeIcsText(
    buildEventDescription(input.task, input.listName, input.appUrl),
  )
  const uid = `task-${input.task.id}@checklist.carlinitools.com`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CarliniTools//CheckList//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0S',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}

function fileNameForTask(task: Task): string {
  const slug = task.text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `checklist-${slug || task.id.slice(0, 8)}.ics`
}

function downloadIcsFile(ics: string, fileName: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

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

  // Escritorio: abrir Google Calendar (probar sin desplegar ni usar el móvil).
  if (!isLikelyMobileDevice()) {
    const googleUrl = buildGoogleCalendarUrl({
      task: input.task,
      listName: input.listName,
      appUrl,
    })
    const opened = window.open(googleUrl, '_blank', 'noopener,noreferrer')
    if (opened) {
      return
    }
  }

  const ics = buildTaskReminderIcs({
    task: input.task,
    listName: input.listName,
    appUrl,
  })
  const fileName = fileNameForTask(input.task)

  // Móvil: compartir / guardar .ics para el calendario nativo.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([ics], fileName, { type: 'text/calendar' })
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: input.task.text,
          text: 'Añadir recordatorio al calendario',
        })
        return
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return
      }
      // Si el share falla, continuar con descarga.
    }
  }

  downloadIcsFile(ics, fileName)
}

export function getTaskReminderAt(
  reminderAt: number | null | undefined,
): number | null {
  return typeof reminderAt === 'number' && Number.isFinite(reminderAt)
    ? reminderAt
    : null
}

export function taskHasReminder(reminderAt: number | null | undefined): boolean {
  return getTaskReminderAt(reminderAt) !== null
}

export function formatReminderDateTime(reminderAt: number): string {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(reminderAt))
}

/** Valor para <input type="datetime-local"> en zona horaria local. */
export function toDatetimeLocalValue(reminderAt: number): string {
  const date = new Date(reminderAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)
  const time = parsed.getTime()
  return Number.isFinite(time) ? time : null
}

export function defaultReminderLocalValue(): string {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  return toDatetimeLocalValue(date.getTime())
}

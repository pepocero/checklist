export function getTaskNote(note: string | undefined | null): string {
  return typeof note === 'string' ? note.trim() : ''
}

export function taskHasNote(note: string | undefined | null): boolean {
  return getTaskNote(note).length > 0
}

export function formatLastCompletedAt(timestamp: number | null | undefined): string | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null
  }

  try {
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp))
  } catch {
    return null
  }
}

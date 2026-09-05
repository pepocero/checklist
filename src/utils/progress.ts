export function getCompletionPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.round((completed / total) * 100)
}

export function isListComplete(completed: number, total: number): boolean {
  return total > 0 && completed === total
}

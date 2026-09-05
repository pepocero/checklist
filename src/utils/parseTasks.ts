export function parseTaskLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function normalizeTaskText(rawText: string): string {
  return rawText.replace(/\s+/g, ' ').trim()
}

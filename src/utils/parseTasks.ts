import type { TaskKind } from '../types'

export interface ParsedListItem {
  text: string
  kind: TaskKind
}

/** Líneas no vacías (texto crudo), sin clasificar. */
export function parseTaskLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Parsea líneas de lista. Las que empiezan por `## ` son secciones.
 * Ejemplo: `## Documentos`
 */
export function parseListItems(rawText: string): ParsedListItem[] {
  return parseTaskLines(rawText).map((line) => {
    const sectionMatch = /^##\s+(.+)$/.exec(line)
    if (sectionMatch) {
      return {
        text: normalizeTaskText(sectionMatch[1] ?? ''),
        kind: 'section' as const,
      }
    }

    return {
      text: normalizeTaskText(line),
      kind: 'task' as const,
    }
  }).filter((item) => item.text.length > 0)
}

export function normalizeTaskText(rawText: string): string {
  return rawText.replace(/\s+/g, ' ').trim()
}

export function countTaskItems(items: ParsedListItem[]): number {
  return items.filter((item) => item.kind === 'task').length
}

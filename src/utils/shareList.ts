import type { Task } from '../types'

/** Texto plano de tareas (una por línea), listo para pegar en "Nueva lista". */
export function formatListAsPlainText(tasks: Task[]): string {
  return tasks
    .map((task) => task.text.trim())
    .filter((text) => text.length > 0)
    .join('\n')
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text.trim()) {
    throw new Error('No hay tareas para copiar.')
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const ok = document.execCommand('copy')
    if (!ok) {
      throw new Error('No se pudo copiar al portapapeles.')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

export async function shareListText(
  text: string,
  title?: string,
): Promise<'shared' | 'copied'> {
  if (!text.trim()) {
    throw new Error('No hay tareas para compartir.')
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: title?.trim() || 'Checklist',
        text,
      })
      return 'shared'
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return 'shared'
      }
      throw cause
    }
  }

  await copyTextToClipboard(text)
  return 'copied'
}


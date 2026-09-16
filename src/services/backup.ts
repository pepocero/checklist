import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { Task, TaskList } from '../types'
import { decryptText, encryptText } from './backupCrypto'
import { exportAllData, replaceAllData } from './database'

export const BACKUP_FORMAT = 'checklist-backup' as const
export const BACKUP_VERSION = 1
export const BACKUP_FILE_NAME = 'checklist-backup.json'

export class BackupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'BackupError'
  }
}

interface BackupPlainPayload {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: number
  encrypted: false
  lists: TaskList[]
  tasks: Task[]
}

interface BackupEncryptedPayload {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: number
  encrypted: true
  salt: string
  iv: string
  ciphertext: string
}

export type BackupFilePayload = BackupPlainPayload | BackupEncryptedPayload

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTaskList(value: unknown): value is TaskList {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.order === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.listId === 'string' &&
    typeof value.text === 'string' &&
    typeof value.note === 'string' &&
    (typeof value.reminderAt === 'number' || value.reminderAt === null) &&
    typeof value.completed === 'boolean' &&
    typeof value.order === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

function assertPlainPayload(value: unknown): BackupPlainPayload {
  if (!isRecord(value)) {
    throw new BackupError('El archivo de copia no es válido.')
  }

  if (value.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es una copia de Checklist.')
  }

  if (value.version !== BACKUP_VERSION) {
    throw new BackupError('Esta copia usa una versión no compatible.')
  }

  if (value.encrypted !== false) {
    throw new BackupError('La copia no tiene el formato esperado.')
  }

  if (!Array.isArray(value.lists) || !Array.isArray(value.tasks)) {
    throw new BackupError('La copia no incluye listas y tareas válidas.')
  }

  if (!value.lists.every(isTaskList) || !value.tasks.every(isTask)) {
    throw new BackupError('Algunos datos de la copia están dañados.')
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : Date.now(),
    encrypted: false,
    lists: value.lists,
    tasks: value.tasks,
  }
}

export async function buildBackupJson(password?: string): Promise<string> {
  try {
    const { lists, tasks } = await exportAllData()
    const plain: BackupPlainPayload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      encrypted: false,
      lists,
      tasks,
    }

    const trimmed = password?.trim() ?? ''
    if (!trimmed) {
      return JSON.stringify(plain)
    }

    const encryptedBody = await encryptText(JSON.stringify(plain), trimmed)
    const encrypted: BackupEncryptedPayload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: plain.exportedAt,
      encrypted: true,
      ...encryptedBody,
    }
    return JSON.stringify(encrypted)
  } catch (cause) {
    if (cause instanceof BackupError) {
      throw cause
    }

    throw new BackupError('No se pudo generar la copia de seguridad.', { cause })
  }
}

export async function parseBackupJson(raw: string, password?: string): Promise<BackupPlainPayload> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (cause) {
    throw new BackupError('El archivo de copia no es JSON válido.', { cause })
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es una copia de Checklist.')
  }

  if (parsed.encrypted === true) {
    const trimmed = password?.trim() ?? ''
    if (!trimmed) {
      throw new BackupError('Esta copia está cifrada. Introduce la contraseña.')
    }

    if (
      typeof parsed.salt !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string'
    ) {
      throw new BackupError('La copia cifrada está incompleta.')
    }

    const decrypted = await decryptText(
      {
        salt: parsed.salt,
        iv: parsed.iv,
        ciphertext: parsed.ciphertext,
      },
      trimmed,
    )
    return assertPlainPayload(JSON.parse(decrypted) as unknown)
  }

  return assertPlainPayload(parsed)
}

export async function restoreFromBackupJson(raw: string, password?: string): Promise<void> {
  const payload = await parseBackupJson(raw, password)
  await replaceAllData(payload.lists, payload.tasks)
}

export async function saveBackupToDevice(json: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: BACKUP_FILE_NAME,
        data: json,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      return result.uri
    } catch (cause) {
      throw new BackupError('No se pudo guardar el archivo en el dispositivo.', { cause })
    }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = BACKUP_FILE_NAME
  anchor.click()
  URL.revokeObjectURL(url)
  return BACKUP_FILE_NAME
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new BackupError('No se pudo leer el archivo seleccionado.'))
    }
    reader.onerror = () => {
      reject(new BackupError('No se pudo leer el archivo seleccionado.'))
    }
    reader.readAsText(file)
  })
}

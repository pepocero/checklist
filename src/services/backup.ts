import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { Task, TaskList } from '../types'
import { SaveToDownloads } from '../plugins/saveToDownloads'
import { decryptText, encryptText } from './backupCrypto'
import {
  exportAllData,
  normalizeList,
  normalizeTask,
  replaceAllData,
} from './database'

export const BACKUP_FORMAT = 'checklist-backup' as const
export const BACKUP_VERSION = 2
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

function isTaskListShape(value: unknown): value is TaskList {
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

function isTaskShape(value: unknown): value is Task {
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

function migrateBackupLists(lists: unknown[]): TaskList[] {
  return lists.filter(isTaskListShape).map((list) => normalizeList(list))
}

function migrateBackupTasks(tasks: unknown[]): Task[] {
  return tasks.filter(isTaskShape).map((task) => normalizeTask(task as Task))
}

function assertPlainPayload(value: unknown): BackupPlainPayload {
  if (!isRecord(value)) {
    throw new BackupError('El archivo de copia no es válido.')
  }

  if (value.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es una copia de Checklist.')
  }

  const version = value.version
  if (version !== 1 && version !== 2) {
    throw new BackupError('Esta copia usa una versión no compatible.')
  }

  if (value.encrypted !== false) {
    throw new BackupError('La copia no tiene el formato esperado.')
  }

  if (!Array.isArray(value.lists) || !Array.isArray(value.tasks)) {
    throw new BackupError('La copia no incluye listas y tareas válidas.')
  }

  if (!value.lists.every(isTaskListShape) || !value.tasks.every(isTaskShape)) {
    throw new BackupError('Algunos datos de la copia están dañados.')
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : Date.now(),
    encrypted: false,
    lists: migrateBackupLists(value.lists),
    tasks: migrateBackupTasks(value.tasks),
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

export type SaveBackupResult = {
  /** URI o nombre del archivo. */
  target: string
  /** En Android se guardó en la carpeta Descargas del sistema. */
  savedToDownloads: boolean
  /** Se abrió el menú Compartir (p. ej. para Drive). */
  shared: boolean
}

async function writeBackupToCache(json: string): Promise<string> {
  const written = await Filesystem.writeFile({
    path: BACKUP_FILE_NAME,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  })

  try {
    const resolved = await Filesystem.getUri({
      path: BACKUP_FILE_NAME,
      directory: Directory.Cache,
    })
    return resolved.uri
  } catch {
    return written.uri
  }
}

async function shareBackupFile(uri: string): Promise<boolean> {
  try {
    await Share.share({
      title: 'Copia de Checklist',
      text: 'Copia de seguridad de Checklist',
      files: [uri],
      dialogTitle: 'Guardar en Drive o enviar',
    })
    return true
  } catch {
    return false
  }
}

export async function saveBackupToDevice(json: string): Promise<SaveBackupResult> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const downloads = await SaveToDownloads.saveTextFile({
        fileName: BACKUP_FILE_NAME,
        content: json,
      })
      return {
        target: downloads.uri,
        savedToDownloads: true,
        shared: false,
      }
    } catch (cause) {
      throw new BackupError(
        'No se pudo guardar el archivo en Descargas. Comprueba el almacenamiento e inténtalo de nuevo.',
        { cause },
      )
    }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = BACKUP_FILE_NAME
  anchor.click()
  URL.revokeObjectURL(url)
  return { target: BACKUP_FILE_NAME, savedToDownloads: false, shared: false }
}

/** Comparte la copia (p. ej. Google Drive) sin depender de Descargas. */
export async function shareBackupToDevice(json: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    await saveBackupToDevice(json)
    return
  }

  try {
    const cacheUri = await writeBackupToCache(json)
    const shared = await shareBackupFile(cacheUri)
    if (!shared) {
      throw new BackupError('No se abrió el menú para compartir. Inténtalo de nuevo.')
    }
  } catch (cause) {
    if (cause instanceof BackupError) {
      throw cause
    }
    throw new BackupError('No se pudo compartir la copia de seguridad.', { cause })
  }
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

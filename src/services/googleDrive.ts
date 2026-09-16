import { BACKUP_FILE_NAME, BackupError } from './backup'
import { getGoogleDriveAccessToken } from './googleAuth'

interface DriveFileSummary {
  id: string
  name: string
  modifiedTime?: string
}

async function driveFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? ''
    } catch {
      // Ignorar cuerpo no JSON.
    }

    throw new BackupError(
      detail
        ? `Google Drive: ${detail}`
        : `Google Drive respondió con error (${response.status}).`,
    )
  }

  return response
}

async function findChecklistBackupFile(
  accessToken: string,
): Promise<DriveFileSummary | null> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FILE_NAME}' and trashed = false and appProperties has { key='checklist' and value='backup' }`,
  )
  const response = await driveFetch(
    accessToken,
    `/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=5`,
  )
  const body = (await response.json()) as { files?: DriveFileSummary[] }
  const files = body.files ?? []
  return files[0] ?? null
}

export async function uploadChecklistBackup(json: string): Promise<DriveFileSummary> {
  const accessToken = await getGoogleDriveAccessToken()
  const existing = await findChecklistBackupFile(accessToken)

  if (existing) {
    const response = await driveFetch(
      accessToken,
      `/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,name,modifiedTime`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: json,
      },
    )
    return (await response.json()) as DriveFileSummary
  }

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    appProperties: {
      checklist: 'backup',
    },
  }

  const boundary = `checklist_${crypto.randomUUID().replace(/-/g, '')}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    json,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await driveFetch(
    accessToken,
    '/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )

  return (await response.json()) as DriveFileSummary
}

export async function downloadChecklistBackup(): Promise<{
  json: string
  file: DriveFileSummary
}> {
  const accessToken = await getGoogleDriveAccessToken()
  const existing = await findChecklistBackupFile(accessToken)
  if (!existing) {
    throw new BackupError('No hay ninguna copia de Checklist en tu Google Drive.')
  }

  const response = await driveFetch(
    accessToken,
    `/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
  )
  const json = await response.text()
  return { json, file: existing }
}

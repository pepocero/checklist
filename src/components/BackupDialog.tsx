import {
  Check,
  CloudDownload,
  CloudUpload,
  HardDriveDownload,
  HardDriveUpload,
  Lock,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  BackupError,
  buildBackupJson,
  readFileAsText,
  restoreFromBackupJson,
  saveBackupToDevice,
} from '../services/backup'
import {
  GOOGLE_DRIVE_BACKUP_ENABLED,
  isGoogleDriveConfigured,
} from '../services/googleAuth'
import { downloadChecklistBackup, uploadChecklistBackup } from '../services/googleDrive'
import { syncAllTaskReminders } from '../services/reminders'

interface BackupDialogProps {
  open: boolean
  onClose: () => void
  onRestored: () => Promise<void> | void
}

type BusyAction =
  | 'local-save'
  | 'local-restore'
  | 'drive-upload'
  | 'drive-restore'
  | null

export function BackupDialog({ open, onClose, onRestored }: BackupDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<'local' | 'drive' | null>(null)
  const driveConfigured = isGoogleDriveConfigured()

  useEffect(() => {
    if (!open) {
      return
    }

    setPassword('')
    setBusy(null)
    setError(null)
    setSuccess(null)
    setConfirmRestore(null)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, busy])

  if (!open) {
    return null
  }

  async function runRestore(source: 'local' | 'drive', raw?: string) {
    setBusy(source === 'local' ? 'local-restore' : 'drive-restore')
    setError(null)
    setSuccess(null)
    try {
      const json =
        source === 'drive' ? (await downloadChecklistBackup()).json : (raw ?? '')
      if (!json) {
        throw new BackupError('No se encontró contenido para restaurar.')
      }

      await restoreFromBackupJson(json, password)
      await onRestored()
      await syncAllTaskReminders()
      setSuccess(
        source === 'drive'
          ? 'Copia restaurada desde Google Drive.'
          : 'Copia restaurada desde el archivo.',
      )
      setConfirmRestore(null)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo restaurar la copia.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  async function handleLocalSave() {
    setBusy('local-save')
    setError(null)
    setSuccess(null)
    try {
      const json = await buildBackupJson(password)
      const target = await saveBackupToDevice(json)
      setSuccess(`Copia guardada: ${target}`)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo guardar la copia.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  async function handleDriveUpload() {
    setBusy('drive-upload')
    setError(null)
    setSuccess(null)
    try {
      const json = await buildBackupJson(password)
      await uploadChecklistBackup(json)
      setSuccess('Copia subida a tu Google Drive.')
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo subir la copia a Drive.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onClick={() => {
        if (!busy) {
          onClose()
        }
      }}
    >
      <div
        className="dialog backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-icon">
          <HardDriveUpload size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h2 id={titleId}>Copia de seguridad</h2>
        <p id={descriptionId}>
          Guarda o restaura todas tus listas. Opcionalmente cifra el archivo con una
          contraseña.
        </p>

        <label className="field">
          <span>
            <Lock size={16} strokeWidth={2.2} aria-hidden="true" /> Contraseña (opcional)
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={busy !== null}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Dejar vacío para copia sin cifrar"
          />
          <small className="field-hint">
            Si cifras, necesitarás la misma contraseña al restaurar.
          </small>
        </label>

        <div className="backup-section">
          <h3>En este dispositivo</h3>
          <div className="backup-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => {
                void handleLocalSave()
              }}
            >
              <HardDriveUpload size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>{busy === 'local-save' ? 'Guardando…' : 'Guardar archivo'}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy !== null}
              onClick={() => setConfirmRestore('local')}
            >
              <HardDriveDownload size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>Restaurar archivo</span>
            </button>
          </div>
        </div>

        {GOOGLE_DRIVE_BACKUP_ENABLED ? (
          <div className="backup-section">
            <h3>Google Drive</h3>
            {!driveConfigured ? (
              <p className="field-hint">
                Configura <code>VITE_GOOGLE_WEB_CLIENT_ID</code> para activar Drive.
              </p>
            ) : null}
            <div className="backup-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null || !driveConfigured}
                onClick={() => {
                  void handleDriveUpload()
                }}
              >
                <CloudUpload size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{busy === 'drive-upload' ? 'Subiendo…' : 'Subir a Drive'}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null || !driveConfigured}
                onClick={() => setConfirmRestore('drive')}
              >
                <CloudDownload size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  {busy === 'drive-restore' ? 'Restaurando…' : 'Restaurar desde Drive'}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {confirmRestore ? (
          <div className="backup-confirm">
            <p>
              La restauración <strong>reemplaza</strong> todas las listas y tareas
              actuales. ¿Continuar?
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => setConfirmRestore(null)}
              >
                <X size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy !== null}
                onClick={() => {
                  if (confirmRestore === 'local') {
                    fileInputRef.current?.click()
                    return
                  }
                  void runRestore('drive')
                }}
              >
                <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  {busy === 'local-restore' || busy === 'drive-restore'
                    ? 'Restaurando…'
                    : 'Sí, restaurar'}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="banner error">{error}</p> : null}
        {success ? <p className="banner success">{success}</p> : null}

        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy !== null}
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Cerrar</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) {
              return
            }
            void (async () => {
              try {
                const raw = await readFileAsText(file)
                await runRestore('local', raw)
              } catch (cause) {
                const message =
                  cause instanceof Error
                    ? cause.message
                    : 'No se pudo leer el archivo seleccionado.'
                setError(message)
              }
            })()
          }}
        />
      </div>
    </div>
  )
}

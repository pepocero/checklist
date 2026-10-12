import { Capacitor } from '@capacitor/core'
import {
  Check,
  CloudDownload,
  CloudUpload,
  DatabaseBackup,
  HardDriveDownload,
  HardDriveUpload,
  Lock,
  Share2,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  BACKUP_FILE_NAME,
  BackupError,
  buildBackupJson,
  readFileAsText,
  restoreFromBackupJson,
  saveBackupToDevice,
  shareBackupToDevice,
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

type BackupTab = 'create' | 'restore'

type BusyAction =
  | 'local-save'
  | 'local-share'
  | 'local-restore'
  | 'drive-upload'
  | 'drive-restore'
  | null

export function BackupDialog({ open, onClose, onRestored }: BackupDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<BackupTab>('create')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<'local' | 'drive' | null>(null)
  const driveConfigured = isGoogleDriveConfigured()
  const canShareBackup =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

  useEffect(() => {
    if (!open) {
      return
    }

    setTab('create')
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

  function switchTab(next: BackupTab) {
    if (busy) {
      return
    }
    setTab(next)
    setError(null)
    setSuccess(null)
    setConfirmRestore(null)
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
      const result = await saveBackupToDevice(json)
      setSuccess(
        result.savedToDownloads
          ? `Copia guardada en Descargas (${BACKUP_FILE_NAME}).`
          : `Copia descargada (${BACKUP_FILE_NAME}).`,
      )
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo guardar la copia.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  async function handleLocalShare() {
    setBusy('local-share')
    setError(null)
    setSuccess(null)
    try {
      const json = await buildBackupJson(password)
      await shareBackupToDevice(json)
      setSuccess('Elige Google Drive u otra app para guardar la copia.')
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo compartir la copia.'
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
        <header className="backup-dialog-header">
          <div className="dialog-icon">
            <DatabaseBackup size={22} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div className="backup-dialog-heading">
            <h2 id={titleId}>Copia de seguridad</h2>
            <p id={descriptionId}>
              Protege tus listas o recupéralas desde un archivo.
            </p>
          </div>
          <button
            type="button"
            className="icon-btn backup-dialog-close"
            aria-label="Cerrar"
            title="Cerrar"
            disabled={busy !== null}
            onClick={onClose}
          >
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className="backup-tabs" role="tablist" aria-label="Tipo de operación">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'create'}
            className={`backup-tab${tab === 'create' ? ' is-active' : ''}`}
            disabled={busy !== null}
            onClick={() => switchTab('create')}
          >
            <HardDriveUpload size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Crear copia</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'restore'}
            className={`backup-tab${tab === 'restore' ? ' is-active' : ''}`}
            disabled={busy !== null}
            onClick={() => switchTab('restore')}
          >
            <HardDriveDownload size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Restaurar</span>
          </button>
        </div>

        <label className="field backup-password">
          <span>
            <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
            {tab === 'create' ? 'Contraseña (opcional)' : 'Contraseña (si la copia está cifrada)'}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={busy !== null}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              tab === 'create'
                ? 'Dejar vacío para copia sin cifrar'
                : 'Solo si cifraste al guardar'
            }
          />
        </label>

        {tab === 'create' ? (
          <div className="backup-panel" role="tabpanel">
            <article className="backup-card">
              <div className="backup-card-icon">
                <HardDriveUpload size={20} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="backup-card-body">
                <h3>Guardar en el dispositivo</h3>
                <p>
                  {Capacitor.isNativePlatform()
                    ? `Guarda ${BACKUP_FILE_NAME} en la carpeta Descargas.`
                    : `Descarga ${BACKUP_FILE_NAME} a tu ordenador.`}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary backup-card-action"
                disabled={busy !== null}
                onClick={() => {
                  void handleLocalSave()
                }}
              >
                <span>{busy === 'local-save' ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </article>

            {canShareBackup ? (
              <article className="backup-card">
                <div className="backup-card-icon">
                  <Share2 size={20} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <div className="backup-card-body">
                  <h3>Compartir o enviar a Drive</h3>
                  <p>Abre el menú del sistema para guardar en Google Drive u otra app.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost backup-card-action"
                  disabled={busy !== null}
                  onClick={() => {
                    void handleLocalShare()
                  }}
                >
                  <span>{busy === 'local-share' ? 'Abriendo…' : 'Compartir'}</span>
                </button>
              </article>
            ) : null}

            {GOOGLE_DRIVE_BACKUP_ENABLED ? (
              <article className="backup-card">
                <div className="backup-card-icon">
                  <CloudUpload size={20} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <div className="backup-card-body">
                  <h3>Subir a Google Drive</h3>
                  <p>
                    {driveConfigured
                      ? 'Copia directa en tu cuenta de Google.'
                      : 'Configura VITE_GOOGLE_WEB_CLIENT_ID para activarlo.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost backup-card-action"
                  disabled={busy !== null || !driveConfigured}
                  onClick={() => {
                    void handleDriveUpload()
                  }}
                >
                  <span>{busy === 'drive-upload' ? 'Subiendo…' : 'Subir'}</span>
                </button>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="backup-panel" role="tabpanel">
            <article className="backup-card backup-card-restore">
              <div className="backup-card-icon">
                <HardDriveDownload size={20} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="backup-card-body">
                <h3>Desde un archivo</h3>
                <p>
                  Elige un {BACKUP_FILE_NAME} guardado antes. Esto reemplaza todas las
                  listas actuales.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary backup-card-action"
                disabled={busy !== null || confirmRestore !== null}
                onClick={() => setConfirmRestore('local')}
              >
                <span>Elegir archivo</span>
              </button>
            </article>

            {GOOGLE_DRIVE_BACKUP_ENABLED ? (
              <article className="backup-card backup-card-restore">
                <div className="backup-card-icon">
                  <CloudDownload size={20} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <div className="backup-card-body">
                  <h3>Desde Google Drive</h3>
                  <p>
                    {driveConfigured
                      ? 'Recupera la última copia guardada en tu Drive.'
                      : 'Configura VITE_GOOGLE_WEB_CLIENT_ID para activarlo.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost backup-card-action"
                  disabled={busy !== null || !driveConfigured || confirmRestore !== null}
                  onClick={() => setConfirmRestore('drive')}
                >
                  <span>Restaurar</span>
                </button>
              </article>
            ) : null}

            {confirmRestore ? (
              <div className="backup-confirm">
                <p>
                  La restauración <strong>borra y sustituye</strong> todas las listas y
                  tareas actuales. Esta acción no se puede deshacer.
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
          </div>
        )}

        {error ? <p className="banner error">{error}</p> : null}
        {success ? <p className="banner success">{success}</p> : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json,text/plain,application/octet-stream,*/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) {
              setError('No se seleccionó ningún archivo.')
              return
            }
            void (async () => {
              try {
                const raw = await readFileAsText(file)
                if (!raw.trim()) {
                  throw new BackupError('El archivo está vacío.')
                }
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

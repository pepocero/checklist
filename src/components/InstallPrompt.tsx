import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  subscribeInstallPrompt,
  waitForInstallPrompt,
} from '../utils/installPrompt'
import { isIosDevice, isRunningAsInstalledPwa } from '../utils/pwa'

const DISMISS_KEY = 'checklist-install-dismissed'

export function InstallPrompt() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') {
      return false
    }
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })
  const [installed, setInstalled] = useState(() => isRunningAsInstalledPwa())
  const [busy, setBusy] = useState(false)
  const [manualHint, setManualHint] = useState(false)

  useEffect(() => {
    function sync() {
      setInstalled(isRunningAsInstalledPwa())
      if (getDeferredInstallPrompt()) {
        setManualHint(false)
      }
    }

    sync()
    return subscribeInstallPrompt(sync)
  }, [])

  if (Capacitor.isNativePlatform() || installed || dismissed) {
    return null
  }

  const ios = isIosDevice()

  async function install() {
    setBusy(true)
    setManualHint(false)

    try {
      const event =
        getDeferredInstallPrompt() ?? (await waitForInstallPrompt(2500))

      if (!event) {
        setManualHint(true)
        return
      }

      await event.prompt()
      const choice = await event.userChoice
      clearDeferredInstallPrompt()

      if (choice.outcome === 'accepted') {
        setInstalled(true)
      }
    } catch {
      setManualHint(true)
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="install-banner">
      <div className="install-copy">
        <p className="install-title">Instala CheckList</p>
        {ios ? (
          <p>
            En Safari, pulsa{' '}
            <Share size={14} strokeWidth={2.2} className="install-inline-icon" aria-hidden="true" />{' '}
            y elige <strong>Añadir a pantalla de inicio</strong>.
          </p>
        ) : manualHint ? (
          <p>
            Si no aparece el diálogo, abre el menú del navegador y elige{' '}
            <strong>Instalar aplicación</strong>.
          </p>
        ) : (
          <p>Instálala para abrirla como una app y usarla sin conexión.</p>
        )}
      </div>
      <div className="install-actions">
        {!ios ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              void install()
            }}
          >
            <Download size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{busy ? 'Preparando…' : 'Instalar'}</span>
          </button>
        ) : null}
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={dismiss}>
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

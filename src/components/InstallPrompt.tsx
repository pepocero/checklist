import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  subscribeInstallPrompt,
} from '../utils/installPrompt'
import { isIosDevice, isRunningAsInstalledPwa } from '../utils/pwa'

const DISMISS_KEY = 'checklist-install-dismissed'

export function InstallPrompt() {
  const [canNativeInstall, setCanNativeInstall] = useState(
    () => getDeferredInstallPrompt() !== null,
  )
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') {
      return false
    }
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })
  const [installed, setInstalled] = useState(() => isRunningAsInstalledPwa())

  useEffect(() => {
    function sync() {
      setCanNativeInstall(getDeferredInstallPrompt() !== null)
      setInstalled(isRunningAsInstalledPwa())
    }

    sync()
    return subscribeInstallPrompt(sync)
  }, [])

  if (installed || dismissed) {
    return null
  }

  const ios = isIosDevice()

  async function install() {
    const event = getDeferredInstallPrompt()
    if (!event) {
      return
    }

    await event.prompt()
    const choice = await event.userChoice
    clearDeferredInstallPrompt()

    if (choice.outcome === 'accepted') {
      setInstalled(true)
    } else {
      setCanNativeInstall(false)
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
            En Safari, pulsa <Share size={14} strokeWidth={2.2} className="install-inline-icon" aria-hidden="true" />{' '}
            y elige <strong>Añadir a pantalla de inicio</strong>.
          </p>
        ) : canNativeInstall ? (
          <p>Instálala para abrirla como una app y usarla sin conexión.</p>
        ) : (
          <p>
            Desde el menú del navegador elige <strong>Instalar aplicación</strong> o{' '}
            <strong>Añadir a la pantalla de inicio</strong>.
          </p>
        )}
      </div>
      <div className="install-actions">
        {canNativeInstall && !ios ? (
          <button type="button" className="btn btn-primary" onClick={() => void install()}>
            <Download size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Instalar</span>
          </button>
        ) : null}
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={dismiss}>
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

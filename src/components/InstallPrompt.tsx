import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'checklist-install-dismissed'

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return
    }

    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      return
    }

    function onPrompt(rawEvent: Event) {
      rawEvent.preventDefault()
      const installEvent = rawEvent as BeforeInstallPromptEvent
      setEvent(installEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!visible || !event) {
    return null
  }

  async function install() {
    await event?.prompt()
    const choice = await event?.userChoice
    if (choice?.outcome === 'accepted') {
      setVisible(false)
      setEvent(null)
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="install-banner">
      <p>Instala CheckList para usarla sin conexión, como una aplicación.</p>
      <div className="install-actions">
        <button type="button" className="btn btn-primary" onClick={() => void install()}>
          <Download size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Instalar</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={dismiss}>
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void

let deferredPrompt: BeforeInstallPromptEvent | null = null
let captureStarted = false
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export function startInstallPromptCapture(): void {
  if (captureStarted || typeof window === 'undefined') {
    return
  }

  captureStarted = true

  window.addEventListener('beforeinstallprompt', (rawEvent) => {
    rawEvent.preventDefault()
    deferredPrompt = rawEvent as BeforeInstallPromptEvent
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

export function clearDeferredInstallPrompt(): void {
  deferredPrompt = null
  notify()
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

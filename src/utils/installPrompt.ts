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

export function waitForInstallPrompt(
  timeoutMs = 2500,
): Promise<BeforeInstallPromptEvent | null> {
  const current = getDeferredInstallPrompt()
  if (current) {
    return Promise.resolve(current)
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = (value: BeforeInstallPromptEvent | null) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(value)
    }

    const unsubscribe = subscribeInstallPrompt(() => {
      const next = getDeferredInstallPrompt()
      if (next) {
        finish(next)
      }
    })

    const timer = window.setTimeout(() => finish(null), timeoutMs)
  })
}


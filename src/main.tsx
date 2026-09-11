import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { startReminderSync } from './services/reminders'
import { startInstallPromptCapture } from './utils/installPrompt'
import './index.css'

startInstallPromptCapture()

const UPDATE_CHECK_MS = 60_000

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nueva versión detectada: activar SW y recargar.
    void updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return
    }

    const checkForUpdates = () => {
      void registration.update().catch(() => {
        // Ignorar fallos de red al buscar actualizaciones.
      })
    }

    checkForUpdates()
    window.setInterval(checkForUpdates, UPDATE_CHECK_MS)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    })

    window.addEventListener('focus', checkForUpdates)
  },
})

// Si el SW nuevo toma el control, recargar para servir assets del deploy.
let refreshing = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return
    }
    refreshing = true
    window.location.reload()
  })
}

window.setTimeout(() => {
  startReminderSync()
}, 0)

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el elemento raíz de la aplicación.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

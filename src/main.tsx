import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { startInstallPromptCapture } from './utils/installPrompt'
import './index.css'

startInstallPromptCapture()
registerSW({ immediate: true })

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el elemento raíz de la aplicación.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

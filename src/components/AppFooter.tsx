import { Capacitor } from '@capacitor/core'
import { Smartphone } from 'lucide-react'
import { PLAY_STORE_URL } from '../constants/store'

export function AppFooter() {
  const showPlayStore = !Capacitor.isNativePlatform()

  return (
    <footer className="app-footer">
      <p>
        Creado por{' '}
        <a href="https://carlinitools.com" target="_blank" rel="noopener noreferrer">
          CarliniTools
        </a>
      </p>
      {showPlayStore ? (
        <p className="app-footer-play">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Descargar Checklist en Google Play"
            title="Descargar en Google Play"
          >
            <Smartphone size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Google Play</span>
          </a>
        </p>
      ) : null}
    </footer>
  )
}

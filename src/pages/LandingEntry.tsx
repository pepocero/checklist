import { Navigate } from 'react-router-dom'
import { useIsInstalledPwa } from '../hooks/useIsInstalledPwa'
import { LandingPage } from './LandingPage'

/** Entrada pública `/`: si la PWA está instalada, siempre va a la app. */
export function LandingEntry() {
  const installed = useIsInstalledPwa()

  if (installed) {
    return <Navigate to="/app" replace />
  }

  return <LandingPage />
}

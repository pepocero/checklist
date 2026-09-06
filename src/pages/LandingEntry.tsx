import { Navigate } from 'react-router-dom'
import { useIsInstalledPwa } from '../hooks/useIsInstalledPwa'
import { LandingPage } from './LandingPage'

export function LandingEntry() {
  const installed = useIsInstalledPwa()

  if (installed) {
    return <Navigate to="/app" replace />
  }

  return <LandingPage />
}

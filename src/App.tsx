import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AppFooter } from './components/AppFooter'
import { ChecklistPage } from './pages/ChecklistPage'
import { CreateListPage } from './pages/CreateListPage'
import { EditListPage } from './pages/EditListPage'
import { HomePage } from './pages/HomePage'
import { LandingEntry } from './pages/LandingEntry'
import { LandingPage } from './pages/LandingPage'
import { useIsInstalledPwa } from './hooks/useIsInstalledPwa'

function ServiceWorkerNavigationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null
      if (!data || data.type !== 'CHECKLIST_NAVIGATE' || typeof data.url !== 'string') {
        return
      }

      const url = data.url.startsWith('/') ? data.url : `/${data.url}`
      navigate(url)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [navigate])

  return null
}

function AppRoutes() {
  const location = useLocation()
  const installed = useIsInstalledPwa()
  const isLanding =
    location.pathname === '/inicio' ||
    (location.pathname === '/' && !installed)

  return (
    <div className={isLanding ? 'landing-shell' : 'app-shell'}>
      <div className={isLanding ? 'landing-content' : 'app-content'}>
        <ServiceWorkerNavigationBridge />
        <Routes>
          <Route path="/" element={<LandingEntry />} />
          <Route path="/inicio" element={<LandingPage />} />
          <Route path="/app" element={<HomePage />} />
          <Route path="/nueva" element={<CreateListPage />} />
          <Route path="/lista/:id" element={<ChecklistPage />} />
          <Route path="/lista/:id/editar" element={<EditListPage />} />
          <Route
            path="*"
            element={<Navigate to={installed ? '/app' : '/'} replace />}
          />
        </Routes>
      </div>
      <AppFooter />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

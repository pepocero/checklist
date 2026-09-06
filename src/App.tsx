import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppFooter } from './components/AppFooter'
import { ChecklistPage } from './pages/ChecklistPage'
import { CreateListPage } from './pages/CreateListPage'
import { EditListPage } from './pages/EditListPage'
import { HomePage } from './pages/HomePage'
import { LandingEntry } from './pages/LandingEntry'
import { LandingPage } from './pages/LandingPage'
import { useIsInstalledPwa } from './hooks/useIsInstalledPwa'

function AppRoutes() {
  const location = useLocation()
  const installed = useIsInstalledPwa()
  const isLanding =
    location.pathname === '/inicio' ||
    (location.pathname === '/' && !installed)

  return (
    <div className={isLanding ? 'landing-shell' : 'app-shell'}>
      <div className={isLanding ? 'landing-content' : 'app-content'}>
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

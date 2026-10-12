import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AndroidBackHandler } from './components/AndroidBackHandler'
import { AppFooter } from './components/AppFooter'
import { ChecklistPage } from './pages/ChecklistPage'
import { CreateListPage } from './pages/CreateListPage'
import { EditListPage } from './pages/EditListPage'
import { HomePage } from './pages/HomePage'
import { LandingEntry } from './pages/LandingEntry'
import { LandingPage } from './pages/LandingPage'
import { TodayPage } from './pages/TodayPage'
import { useIsInstalledPwa } from './hooks/useIsInstalledPwa'
import { ShareImport } from './plugins/shareImport'
import { drainWidgetPendingToggles, syncWidgetSnapshot } from './services/widgetSync'

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

function NativeIntentsBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return
    }

    let cancelled = false

    async function consumeSharedText() {
      try {
        const { text } = await ShareImport.getPendingSharedText()
        if (cancelled || !text?.trim()) {
          return
        }
        await ShareImport.clearPendingSharedText()
        navigate('/nueva', { state: { sharedText: text } })
      } catch {
        // Plugin no disponible fuera de Android nativo.
      }
    }

    async function drainWidget() {
      try {
        const count = await drainWidgetPendingToggles()
        if (count === 0) {
          await syncWidgetSnapshot()
        }
      } catch {
        // Ignorar si el widget aún no está registrado.
      }
    }

    function pathFromUrl(url: string): string | null {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'checklist:') {
          // checklist://app/lista/:id → pathname /lista/:id
          const path = parsed.pathname || '/app'
          return path.startsWith('/') ? path : `/${path}`
        }
        if (
          parsed.pathname.startsWith('/lista/') ||
          parsed.pathname === '/hoy' ||
          parsed.pathname === '/nueva' ||
          parsed.pathname === '/app'
        ) {
          return `${parsed.pathname}${parsed.search}`
        }
      } catch {
        const match = /checklist:\/\/app(\/.*)$/.exec(url)
        if (match?.[1]) {
          return match[1]
        }
      }
      return null
    }

    void consumeSharedText()
    void drainWidget()

    const appUrlSub = CapApp.addListener('appUrlOpen', (event) => {
      const path = pathFromUrl(event.url)
      if (path) {
        navigate(path)
      }
    })

    const resumeSub = CapApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        void consumeSharedText()
        void drainWidget()
      }
    })

    return () => {
      cancelled = true
      void appUrlSub.then((handle) => handle.remove())
      void resumeSub.then((handle) => handle.remove())
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
        <NativeIntentsBridge />
        <AndroidBackHandler />
        <Routes>
          <Route path="/" element={<LandingEntry />} />
          <Route path="/inicio" element={<LandingPage />} />
          <Route path="/app" element={<HomePage />} />
          <Route path="/hoy" element={<TodayPage />} />
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

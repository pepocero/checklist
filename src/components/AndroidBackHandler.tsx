import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const EXIT_WINDOW_MS = 2000

const ROOT_PATHS = new Set(['/', '/app', '/inicio'])

/**
 * Android: atrás recorre el historial de pantallas.
 * En la raíz, el primer atrás muestra aviso; el segundo (en 2 s) cierra la app.
 */
export function AndroidBackHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const [toastVisible, setToastVisible] = useState(false)
  const exitReadyRef = useRef(false)
  const exitTimerRef = useRef<number | null>(null)
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
    // Al cambiar de ruta, reiniciar el doble atrás.
    exitReadyRef.current = false
    setToastVisible(false)
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [location])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return
    }

    function clearExitArmed() {
      exitReadyRef.current = false
      setToastVisible(false)
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }

    function armExit() {
      exitReadyRef.current = true
      setToastVisible(true)
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
      }
      exitTimerRef.current = window.setTimeout(() => {
        clearExitArmed()
      }, EXIT_WINDOW_MS)
    }

    const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const path = locationRef.current.pathname
      const atRoot = ROOT_PATHS.has(path)

      if (canGoBack && !atRoot) {
        clearExitArmed()
        navigate(-1)
        return
      }

      if (canGoBack && atRoot) {
        // Hay historial (p. ej. landing), pero estamos en home: ir a salir.
        // Preferir no salir de /app hacia landing en la app nativa.
        if (path === '/app') {
          if (exitReadyRef.current) {
            clearExitArmed()
            void CapApp.exitApp()
            return
          }
          armExit()
          return
        }
        clearExitArmed()
        navigate(-1)
        return
      }

      // Sin historial hacia atrás.
      if (exitReadyRef.current) {
        clearExitArmed()
        void CapApp.exitApp()
        return
      }

      armExit()
    })

    return () => {
      clearExitArmed()
      void listener.then((handle) => {
        void handle.remove()
      })
    }
  }, [navigate])

  if (!toastVisible) {
    return null
  }

  return (
    <div className="exit-toast" role="status" aria-live="polite">
      Pulsa otra vez para salir
    </div>
  )
}

import { useEffect, useState } from 'react'
import { isRunningAsInstalledPwa } from '../utils/pwa'

export function useIsInstalledPwa(): boolean {
  const [installed, setInstalled] = useState(() => isRunningAsInstalledPwa())

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')

    function sync() {
      setInstalled(isRunningAsInstalledPwa())
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return installed
}

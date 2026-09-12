import { Capacitor } from '@capacitor/core'

const STANDALONE_MQ = '(display-mode: standalone)'

export function isRunningAsInstalledPwa(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // App nativa (Capacitor): ya está instalada; no mostrar prompts de PWA.
  if (Capacitor.isNativePlatform()) {
    return true
  }

  const mediaStandalone = window.matchMedia(STANDALONE_MQ).matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return mediaStandalone || iosStandalone
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua)
  const ipadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return ios || ipadOs
}

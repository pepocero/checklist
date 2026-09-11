const DEFAULT_API = ''

export function getPushApiBase(): string {
  const configured = import.meta.env.VITE_PUSH_API_URL
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.replace(/\/$/, '')
  }
  return DEFAULT_API
}

export function pushApiConfigured(): boolean {
  return getPushApiBase().length > 0
}

export async function fetchVapidPublicKey(): Promise<string> {
  const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim()
  }

  const base = getPushApiBase()
  if (!base) {
    throw new Error('Falta configurar VITE_PUSH_API_URL')
  }

  const response = await fetch(`${base}/vapid-public-key`)
  if (!response.ok) {
    throw new Error('No se pudo obtener la clave pública VAPID')
  }

  const data = (await response.json()) as { publicKey?: string }
  if (!data.publicKey) {
    throw new Error('Clave pública VAPID vacía')
  }

  return data.publicKey
}

export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

import { SocialLogin } from '@capgo/capacitor-social-login'

/** Desactivado de momento; activar cuando se configure Google Cloud OAuth. */
export const GOOGLE_DRIVE_BACKUP_ENABLED = false

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export class GoogleAuthError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'GoogleAuthError'
  }
}

let initializedForClientId: string | null = null

export function getGoogleWebClientId(): string {
  return (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? '').trim()
}

export function isGoogleDriveConfigured(): boolean {
  return GOOGLE_DRIVE_BACKUP_ENABLED && getGoogleWebClientId().length > 0
}

async function ensureInitialized(): Promise<string> {
  const webClientId = getGoogleWebClientId()
  if (!webClientId) {
    throw new GoogleAuthError(
      'Falta configurar VITE_GOOGLE_WEB_CLIENT_ID para usar Google Drive.',
    )
  }

  if (initializedForClientId !== webClientId) {
    await SocialLogin.initialize({
      google: {
        webClientId,
        mode: 'online',
      },
    })
    initializedForClientId = webClientId
  }

  return webClientId
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  if (!GOOGLE_DRIVE_BACKUP_ENABLED) {
    throw new GoogleAuthError('La copia en Google Drive está desactivada de momento.')
  }

  try {
    await ensureInitialized()

    const login = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile', DRIVE_FILE_SCOPE],
        forceRefreshToken: true,
        prompt: 'consent',
      },
    })

    if (login.result.responseType === 'offline') {
      throw new GoogleAuthError(
        'Google devolvió un código de servidor. Configura el cliente OAuth en modo online.',
      )
    }

    const token = login.result.accessToken?.token?.trim()
    if (!token) {
      throw new GoogleAuthError(
        'Google no devolvió un token de acceso. Revisa el Client ID web y los scopes de Drive.',
      )
    }

    return token
  } catch (cause) {
    if (cause instanceof GoogleAuthError) {
      throw cause
    }

    const message = cause instanceof Error ? cause.message : 'No se pudo iniciar sesión con Google.'
    throw new GoogleAuthError(message, { cause })
  }
}

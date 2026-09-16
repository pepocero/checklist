import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.carlinitools.checklist',
  appName: 'Checklist',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#0284c7',
      // No usar "default": Android lo busca en res/raw y si no existe no hay sonido.
    },
    // Solo Google (para Drive más adelante). Facebook mete AD_ID y rompe la declaración "No" en Play.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
}

export default config

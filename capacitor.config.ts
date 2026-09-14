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
  },
}

export default config

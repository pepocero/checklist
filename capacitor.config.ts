import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.carlinitools.checklist',
  appName: 'CheckList',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#0284c7',
      sound: 'default',
    },
  },
}

export default config

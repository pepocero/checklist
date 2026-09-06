import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-icon-192.png',
        'pwa-icon-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'CheckList',
        short_name: 'CheckList',
        description:
          'Creador de listas de verificación. Tareas repetitivas, viajes y rutinas, con privacidad local y modo offline.',
        lang: 'es',
        theme_color: '#1c1917',
        background_color: '#f3efe6',
        display: 'standalone',
        orientation: 'any',
        start_url: '/app',
        scope: '/',
        id: '/app',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})

/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

void self.skipWaiting()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request)
      } catch {
        const cached =
          (await caches.match('/index.html')) ??
          (await caches.match('index.html')) ??
          (await caches.match(new URL('index.html', self.registration.scope).href))

        if (cached) {
          return cached
        }

        return Response.error()
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data as { url?: string } | undefined
  const targetPath = data?.url && typeof data.url === 'string' ? data.url : '/app'
  const targetUrl = new URL(targetPath, self.registration.scope).href

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windowClients) {
        const windowClient = client as WindowClient

        try {
          await windowClient.focus()
        } catch {
          continue
        }

        // navigate() falla en dev si este SW no controla la ventana.
        try {
          await windowClient.navigate(targetUrl)
        } catch {
          windowClient.postMessage({ type: 'CHECKLIST_NAVIGATE', url: targetPath })
        }

        return
      }

      await self.clients.openWindow(targetUrl)
    })(),
  )
})

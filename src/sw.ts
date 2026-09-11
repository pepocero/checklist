/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

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
  const targetUrl = data?.url && typeof data.url === 'string' ? data.url : '/app'

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of clients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await client.navigate(targetUrl)
          }
          return
        }
      }

      await self.clients.openWindow(targetUrl)
    })(),
  )
})

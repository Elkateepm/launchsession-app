/* LaunchSession push notification service worker.
 * Intentionally minimal — this is NOT a full offline/PWA precaching worker,
 * it exists solely to receive push events and handle notification clicks.
 */

const DEFAULT_ICON = '/logo192.png'
const DEFAULT_BADGE = '/favicon.png'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    // Not JSON — fall back to a safe generic notification rather than
    // showing raw/untrusted text.
    payload = {}
  }

  const title = payload.title || 'LaunchSession'
  const body = payload.body || 'You have a new update.'
  const url = payload.url || '/'
  const tag = payload.tag || payload.event_type || undefined

  const options = {
    body,
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag,
    // Re-notify only for genuinely new events sharing a tag (e.g. don't spam
    // if the same category fires twice quickly), but don't silently merge
    // distinct notifications either.
    renotify: !!tag,
    data: { url, event_type: payload.event_type || null, category: payload.category || null },
    requireInteraction: payload.priority === 'critical',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing LaunchSession tab if one is open, and navigate it.
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: targetUrl })
            if ('navigate' in client) {
              client.navigate(targetUrl).catch(() => {})
            }
            return client.focus()
          }
        } catch (e) {}
      }
      // No LaunchSession window open — open a new one.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('notificationclose', (event) => {
  // Reserved for future delivery-analytics (e.g. logging dismissals).
  // Intentionally a no-op for now — nothing sensitive to clean up client-side.
})

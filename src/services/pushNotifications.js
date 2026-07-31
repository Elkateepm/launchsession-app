// Reusable push-notification service. Handles service worker registration,
// permission requests, subscribe/unsubscribe, and keeping the server's copy
// of the subscription in sync. No sensitive data ever passes through here —
// the VAPID public key is safe to ship in the frontend bundle by design.
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
    return registration
  } catch (e) {
    console.error('Service worker registration failed', e)
    return null
  }
}

// Only call this after the user has clicked an explicit "Enable notifications"
// action in our own branded prompt — never on page load.
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  try {
    return await Notification.requestPermission()
  } catch (e) {
    return 'denied'
  }
}

function detectDeviceName() {
  const ua = navigator.userAgent
  let platform = 'Unknown device'
  if (/iPhone/.test(ua)) platform = 'iPhone'
  else if (/iPad/.test(ua)) platform = 'iPad'
  else if (/Android/.test(ua)) platform = 'Android device'
  else if (/Macintosh/.test(ua)) platform = 'Mac'
  else if (/Windows/.test(ua)) platform = 'Windows PC'
  else if (/Linux/.test(ua)) platform = 'Linux'

  let browser = 'browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/OPR\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'

  return `${platform} · ${browser}`
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

// Subscribes this browser to push and upserts the subscription row server-side.
// Returns { success, error }.
export async function subscribeToPush(orgId, userId) {
  if (!isPushSupported()) return { success: false, error: 'Push notifications are not supported on this browser.' }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return { success: false, error: permission === 'denied' ? 'blocked' : 'dismissed' }
  }

  const registration = await registerServiceWorker()
  if (!registration) return { success: false, error: 'Could not set up notifications on this device.' }

  try {
    await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    await syncSubscriptionWithServer(subscription, orgId, userId)
    return { success: true }
  } catch (e) {
    console.error('Push subscribe failed', e)
    return { success: false, error: 'Could not enable notifications. Please try again.' }
  }
}

// Writes/updates the subscription row. RLS restricts this to the caller's own
// row (user_id = auth.uid()), so it's safe to call directly from the client.
export async function syncSubscriptionWithServer(subscription, orgId, userId) {
  if (!subscription) return
  const json = subscription.toJSON()
  const payload = {
    org_id: orgId,
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
    device_name: detectDeviceName(),
    platform: navigator.platform || null,
    is_active: true,
    updated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    revoked_at: null,
  }
  await supabase.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' })
}

export async function unsubscribeFromPush() {
  try {
    const subscription = await getCurrentSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await supabase.from('push_subscriptions')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('endpoint', endpoint)
    }
    return { success: true }
  } catch (e) {
    console.error('Push unsubscribe failed', e)
    return { success: false, error: 'Could not disable notifications. Please try again.' }
  }
}

// Removes a specific device by subscription id (used from "registered devices" list —
// e.g. removing a lost phone remotely). RLS ensures only the owning user can do this.
export async function revokeSubscriptionById(subscriptionId) {
  await supabase.from('push_subscriptions')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', subscriptionId)
}

export async function listMySubscriptions(userId) {
  const { data } = await supabase.from('push_subscriptions')
    .select('id, device_name, platform, is_active, created_at, last_used_at, endpoint')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false })
  return data || []
}

// Sends a real server-generated test push to this user's active devices.
export async function sendTestNotification() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { success: false, error: 'Not signed in' }
  try {
    const res = await fetch('/api/send-form-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type: 'push', event_type: 'TEST_NOTIFICATION' }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data?.error || 'Failed to send test notification' }
    return { success: true, sent: data.sent, failed: data.failed }
  } catch (e) {
    return { success: false, error: 'Network error — please try again' }
  }
}

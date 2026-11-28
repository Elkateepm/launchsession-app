// What a notification looks like and where it leads, shared by Home's bell
// and the Notification Centre so the two can never disagree.

export const NOTIF_ICONS = {
  safeguarding: '🛡️', sessions: '📅', registers: '📋', volunteers: '🤝', forms: '📝',
  consents: '✅', medical: '⚕️', resources: '🧰', reflections: '💭', messaging: '💬',
  security: '🔒', reports: '📊', children: '🧒',
}

export const NOTIF_LABELS = {
  safeguarding: 'Safeguarding', sessions: 'Sessions', registers: 'Registers', volunteers: 'Volunteers',
  forms: 'Forms', consents: 'Consents', medical: 'Medical', resources: 'Resources',
  reflections: 'Reflections', messaging: 'Messages', security: 'Security', reports: 'Reports',
  children: 'Registrations',
}

// Colour identity per category so the list scans at a glance — safeguarding
// and security read as urgent/red, everything else gets a calm, distinct hue.
export const NOTIF_COLORS = {
  safeguarding: '#DC2626', security: '#DC2626', medical: '#DC2626',
  registers: '#2563EB', sessions: '#7C3AED', volunteers: '#0D9488',
  forms: '#D97706', consents: '#16A34A', resources: '#0891B2',
  reflections: '#9333EA', messaging: '#2563EB', reports: '#4B5563',
  children: '#0D9488',
}

export function notifColor(n, fallback) {
  if (n.priority === 'critical') return '#DC2626'
  return NOTIF_COLORS[n.category] || fallback
}

export function notifDayLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Identical alerts fire more than once (two "Reflection due" rows for the
// same session, for example). Collapse repeats within the same day into a
// single row carrying the rest in `dupes`, so 25 notifications don't read as
// 25 things.
export function groupNotifications(items) {
  const groups = []
  let lastLabel = null
  let seen = new Map()
  items.forEach(n => {
    const label = notifDayLabel(n.created_at)
    if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; seen = new Map() }
    const key = `${n.category}|${n.title}|${n.body}`
    const hit = seen.get(key)
    if (hit) { hit.dupes.push(n); return }
    const stack = { ...n, dupes: [n] }
    seen.set(key, stack)
    groups[groups.length - 1].items.push(stack)
  })
  return groups
}

// Where tapping a notification goes, as the app's own tab navigation.
export function notifDestination(n) {
  if (!n?.target_url) return null
  try {
    const params = new URLSearchParams(n.target_url.split('?')[1] || '')
    const tab = params.get('tab')
    if (!tab) return null
    const payload = {}
    if (params.get('sub') === 'requests') payload.openRegistrationRequests = true
    if (params.get('thread')) payload.initialThreadId = params.get('thread')
    if (params.get('session')) payload.sessionId = params.get('session')
    return { tab, payload: Object.keys(payload).length ? payload : undefined }
  } catch (e) {
    return null
  }
}

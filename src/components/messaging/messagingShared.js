// Pure helpers for Messaging, kept out of the component so they can be tested.

// Audience keys stored on message_threads.audience. `dm:<volunteer id>` is
// created by the volunteer portal when a volunteer writes to staff; it is not
// in this list and is handled by audienceOf().
export const AUDIENCES = [
  { key: 'all_staff',        label: 'All staff',        short: 'Staff',      icon: '👥', color: 'var(--info-text)', who: 'Admins and staff' },
  { key: 'volunteers',       label: 'Volunteers',       short: 'Volunteers', icon: '❤️', color: '#DB2777', who: 'Volunteers, and staff who read along' },
  { key: 'team',             label: 'Team leads',       short: 'Leads',      icon: '⭐', color: 'var(--warn-text)', who: 'Admins and owners' },
  { key: 'general',          label: 'Everyone',         short: 'Everyone',   icon: '💬', color: '#475569', who: 'Staff and volunteers' },
  { key: 'event_staff',      label: 'Event staff',      short: 'Event',      icon: '📅', color: 'var(--violet-text)', who: 'Staff on this event' },
  { key: 'event_volunteers', label: 'Event volunteers', short: 'Event',      icon: '📅', color: '#0891B2', who: 'Volunteers on this event' },
]

// Event threads are created against a session automatically, so they are not
// offered when starting a conversation.
export const MANUAL_AUDIENCES = AUDIENCES.filter(a => !a.key.startsWith('event_'))

const DIRECT = { key: 'direct', label: 'Direct message', short: 'Direct', icon: '✉️', color: '#0F766E', who: 'Staff and this volunteer' }

export const isDirect = (audience) => typeof audience === 'string' && audience.startsWith('dm:')
export const directUserId = (audience) => (isDirect(audience) ? audience.slice(3) : null)

export function audienceOf(audience) {
  if (isDirect(audience)) return DIRECT
  return AUDIENCES.find(a => a.key === audience) || AUDIENCES.find(a => a.key === 'general')
}

// Filter chips on the thread list. Each maps to a predicate over the audience.
export const FILTERS = [
  { key: 'all',        label: 'All',        test: () => true },
  { key: 'staff',      label: 'Staff',      test: a => a === 'all_staff' || a === 'team' },
  { key: 'volunteers', label: 'Volunteers', test: a => a === 'volunteers' },
  { key: 'everyone',   label: 'Everyone',   test: a => a === 'general' },
  { key: 'events',     label: 'Events',     test: a => typeof a === 'string' && a.startsWith('event_') },
  { key: 'direct',     label: 'Direct',     test: a => isDirect(a) },
]

// Who is notified when a message is posted. Roles, plus for a direct message
// the one volunteer it belongs to -- it used to fall through to 'general' and
// ping every volunteer in the organisation about someone else's private thread.
const AUDIENCE_ROLES = {
  all_staff: ['admin', 'owner', 'staff'],
  event_staff: ['admin', 'owner', 'staff'],
  volunteers: ['volunteer'],
  event_volunteers: ['volunteer'],
  team: ['admin', 'owner'],
  general: ['admin', 'owner', 'staff', 'volunteer'],
}

export function notificationTargets(audience) {
  if (isDirect(audience)) return { roles: ['admin', 'owner', 'staff'], extraIds: [directUserId(audience)] }
  return { roles: AUDIENCE_ROLES[audience] || AUDIENCE_ROLES.general, extraIds: [] }
}

export function displayName(profile) {
  if (!profile) return 'Someone'
  const first = profile.preferred_name || profile.first_name
  if (first && profile.last_name) return `${first} ${profile.last_name}`
  return profile.full_name || first || 'Someone'
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const DAY = 24 * 60 * 60 * 1000

// "Today", "Yesterday", "Monday" within the week, then "12 Sep" / "12 Sep 2025".
export function dayLabel(date, now = new Date()) {
  const d = startOfDay(date), today = startOfDay(now)
  const diff = Math.round((today - d) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' })
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export const clockTime = (date) =>
  new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Compact stamp for the thread list: 14:05 today, "Yesterday", "Mon", "12 Sep".
export function listTime(date, now = new Date()) {
  if (!date) return ''
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / DAY)
  if (diff === 0) return clockTime(date)
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })
  return dayLabel(date, now)
}

// Group consecutive messages from the same sender, within five minutes and on
// the same day, so a run of short messages reads as one turn with one name
// and one timestamp. Day separators are emitted between groups.
export function buildTimeline(messages, gapMs = 5 * 60 * 1000) {
  const items = []
  let group = null
  let lastDay = null
  for (const m of messages) {
    const day = startOfDay(m.created_at).getTime()
    if (day !== lastDay) {
      items.push({ type: 'day', key: `day-${day}`, label: dayLabel(m.created_at) })
      lastDay = day
      group = null
    }
    const prev = group && group.messages[group.messages.length - 1]
    const joins = prev && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) <= gapMs
    if (joins) {
      group.messages.push(m)
    } else {
      group = { type: 'group', key: `g-${m.id}`, sender_id: m.sender_id, messages: [m] }
      items.push(group)
    }
  }
  return items
}

// The newest message per thread from a list ordered newest first.
export function latestByThread(recent) {
  const out = {}
  for (const m of recent || []) if (!out[m.thread_id]) out[m.thread_id] = m
  return out
}

// A thread is unread when something arrived after this person last opened
// it, and they were not the one who sent it.
export function isUnread(thread, last, seenAt, userId) {
  if (!last || last.sender_id === userId) return false
  if (!seenAt) return true
  return new Date(last.created_at) > new Date(seenAt)
}

export const QUICK_MESSAGES = [
  'Reminder: the session starts at the usual time.',
  'Please arrive 15 minutes early this week.',
  'Weather update: please check for changes before you set off.',
  'Registers need updating before Friday.',
  'Great work today, everyone. Thank you.',
]

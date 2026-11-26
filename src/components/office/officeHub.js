// What the Office hub says, worked out from rows the overview loads. Pure, so
// "Needs you", "This month" and "Recent" are tested here, not in the screen.
//
// Every input may be missing (the tool is hidden from this person, or its
// query failed). Missing means "say nothing", never "zero".

export const money = n => {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const DAY = 86400000
const dayDiff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY)

export function relative(iso, now = new Date()) {
  const t = new Date(iso)
  if (isNaN(t)) return ''
  const mins = Math.round((now - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
}

/**
 * The jobs waiting in the Office, most urgent first. Each says what, how
 * many, and where to go. Only tools in `tabs` can appear.
 */
export function buildNeeds(d, { tabs, today, now = new Date() }) {
  const can = key => tabs.some(t => t.tab === key)
  const out = []

  if (can('forms')) {
    const unread = d.unread || []
    if (unread.length) {
      const names = [...new Set(unread.map(u => u.org_forms?.name).filter(Boolean))]
      out.push({ key: 'replies', tab: 'forms', tone: 'urgent', icon: 'forms',
        title: plural(unread.length, 'new form reply', 'new form replies'),
        detail: names.length ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''}. Newest ${relative(unread[0].created_at, now)}.` : `Newest ${relative(unread[0].created_at, now)}.`,
        action: 'Read replies' })
    }
    const closing = (d.forms || []).filter(f => f.closing_date && f.closing_date >= today && dayDiff(today, f.closing_date) <= 7)
    if (closing.length) {
      const first = closing.sort((a, b) => a.closing_date.localeCompare(b.closing_date))[0]
      const n = dayDiff(today, first.closing_date)
      out.push({ key: 'closing', tab: 'forms', tone: 'soon', icon: 'forms',
        title: closing.length === 1 ? `"${first.name}" closes ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}` : `${closing.length} forms close this week`,
        detail: 'Chase anyone who has not replied yet.', action: 'Open forms' })
    }
  }

  if (can('payments') && d.charges) {
    const owed = d.charges.filter(c => ['unpaid', 'part_paid'].includes(c.computed_status) && Number(c.remaining) > 0)
    const overdue = owed.filter(c => c.due_date && c.due_date < today)
    const dueSoon = owed.filter(c => c.due_date && c.due_date >= today && dayDiff(today, c.due_date) <= 7)
    const sum = list => list.reduce((s, c) => s + Number(c.remaining || 0), 0)
    if (overdue.length) out.push({ key: 'overdue', tab: 'payments', tone: 'urgent', icon: 'payments',
      title: `${money(sum(overdue))} overdue`, detail: `${plural(overdue.length, 'payment is', 'payments are')} past the due date.`, action: 'Chase payments' })
    if (dueSoon.length) out.push({ key: 'due', tab: 'payments', tone: 'soon', icon: 'payments',
      title: `${money(sum(dueSoon))} due this week`, detail: plural(dueSoon.length, 'payment', 'payments') + ' due in the next 7 days.', action: 'View payments' })
  }

  if (can('resource_booking')) {
    const late = (d.checkouts || []).filter(c => !c.returned_at && c.expected_return_at && new Date(c.expected_return_at) < now)
    if (late.length) out.push({ key: 'returns', tab: 'resource_booking', tone: 'urgent', icon: 'resources',
      title: plural(late.length, 'item not returned', 'items not returned'), detail: 'Past the time it was due back.', action: 'See who has it' })
    const pending = (d.bookings || []).filter(b => b.status === 'pending')
    if (pending.length) out.push({ key: 'approve', tab: 'resource_booking', tone: 'soon', icon: 'resources',
      title: plural(pending.length, 'booking to approve', 'bookings to approve'), detail: 'Someone is waiting to hear back.', action: 'Review bookings' })
  }

  if (can('hr') && d.hr && d.hr.count > 0) {
    out.push({ key: 'hr', tab: 'hr', tone: d.hr.urgent > 0 ? 'urgent' : 'later', icon: 'hr',
      title: plural(d.hr.count, 'HR task', 'HR tasks'),
      detail: d.hr.urgent > 0 ? `${d.hr.urgent} overdue. Checks, supervisions and leave.` : 'Checks, supervisions and leave.', action: 'Open HR' })
  }

  if (can('newsletter')) {
    const drafts = (d.newsletters || []).filter(n => n.status === 'draft')
    if (drafts.length) out.push({ key: 'drafts', tab: 'newsletter', tone: 'later', icon: 'newsletter',
      title: plural(drafts.length, 'newsletter draft', 'newsletter drafts'),
      detail: drafts[0].subject ? `"${drafts[0].subject}"${drafts.length > 1 ? ` and ${drafts.length - 1} more` : ''}` : 'Pick up where you left off.', action: 'Continue writing' })
  }

  const rank = { urgent: 0, soon: 1, later: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone])
}

/** Headline numbers for this month. A tile is left out when its tool is hidden or its data is missing. */
export function monthTiles(d, { tabs, monthStart, today }) {
  const can = key => tabs.some(t => t.tab === key)
  const tiles = []
  if (can('forms') && typeof d.repliesThisMonth === 'number') tiles.push({ key: 'replies', tab: 'forms', icon: 'forms', value: String(d.repliesThisMonth), label: 'Form replies' })
  if (can('newsletter') && d.newsletters) {
    const sent = d.newsletters.filter(n => n.status === 'sent' && n.sent_at && n.sent_at >= monthStart)
    const reached = sent.reduce((s, n) => s + (n.sent_count || 0), 0)
    tiles.push({ key: 'sent', tab: 'newsletter', icon: 'newsletter', value: String(sent.length), label: sent.length === 1 ? 'Newsletter sent' : 'Newsletters sent', hint: reached ? `${reached.toLocaleString('en-GB')} emails delivered` : null })
  }
  if (can('payments') && d.transactions) {
    const inMonth = d.transactions.filter(t => (t.payment_date || t.created_at || '').slice(0, 10) >= monthStart.slice(0, 10))
    tiles.push({ key: 'money', tab: 'payments', icon: 'payments', value: money(inMonth.reduce((s, t) => s + Number(t.amount || 0), 0)), label: 'Money in', hint: inMonth.length ? plural(inMonth.length, 'payment', 'payments') : null })
  }
  if (can('resource_booking') && d.bookings) {
    const week = d.bookings.filter(b => b.status !== 'cancelled' && b.start_time && b.start_time.slice(0, 10) >= today && dayDiff(today, b.start_time.slice(0, 10)) < 7)
    tiles.push({ key: 'bookings', tab: 'resource_booking', icon: 'resources', value: String(week.length), label: 'Bookings this week' })
  }
  return tiles
}

/** The last few things that happened across the Office, newest first. */
export function recentActivity(d, { tabs, resourceNames = {}, limit = 6 }) {
  const can = key => tabs.some(t => t.tab === key)
  const items = []
  if (can('forms')) for (const s of d.recentReplies || []) items.push({ at: s.created_at, tab: 'forms', icon: 'forms', text: `${s.submitted_name || 'Someone'} replied to ${s.org_forms?.name || 'a form'}` })
  if (can('newsletter')) for (const n of d.newsletters || []) if (n.status === 'sent' && n.sent_at) items.push({ at: n.sent_at, tab: 'newsletter', icon: 'newsletter', text: `"${n.subject || 'Newsletter'}" sent to ${n.sent_count || 0} ${n.sent_count === 1 ? 'person' : 'people'}` })
  if (can('payments')) for (const t of d.transactions || []) items.push({ at: t.created_at, tab: 'payments', icon: 'payments', text: `${money(t.amount)} payment recorded` })
  if (can('resource_booking')) for (const b of d.recentBookings || []) items.push({ at: b.created_at, tab: 'resource_booking', icon: 'resources', text: `${resourceNames[b.resource_id] || 'A resource'} booked` })
  return items.filter(i => i.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

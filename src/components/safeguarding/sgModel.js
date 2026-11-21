// What the Safeguarding Hub knows, worked out from the rows it loads.
//
// Pure functions only, so every rule here can be tested without a database.
// The hub used to work each of these out separately inside the screen that
// showed them, which is how Overview listed one concern twice ("DSL not
// notified" and "Nobody assigned", one row each) while Cases had its own idea
// of what slipping meant and the accident book had a third.
//
// Wording: "child", "concern" and "safeguarding lead" are terms of art and stay
// fixed here whatever an organisation calls the people it works with -- see
// src/lib/terminology.js.

const DAY = 864e5

/** Today's date in the UK, as YYYY-MM-DD. The database runs UTC. */
export function londonToday(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d)
}

/** The UK calendar date of a timestamp or a plain date. */
export function dayOf(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const t = new Date(value)
  return Number.isNaN(t.getTime()) ? null : londonToday(t)
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
}

export function addDays(day, n) {
  const t = new Date(Date.parse(day + 'T12:00:00Z') + n * DAY)
  return t.toISOString().slice(0, 10)
}

const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// ── Concerns and cases ────────────────────────────────────────

// A concern with a case behind it has been handed over: the case is where the
// work happens now, so the concern stops being chased or counted as open.
// Read from the link rather than a status, because escalation never set one.
export const isHandedOver = (c) => !!c.escalated_to_case_id
export const isOpenConcern = (c) => c.status !== 'resolved' && c.status !== 'closed'
export const isOpenCase = (c) => !c.archived && !c.resolved_at && c.status !== 'closed' && c.status !== 'resolved'

export const CONCERN_STATUS = {
  open:        { bg: 'var(--danger-bg)', color: 'var(--danger-text)', label: 'Open' },
  in_progress: { bg: 'var(--warn-bg)',   color: 'var(--warn-text)',   label: 'In progress' },
  resolved:    { bg: 'var(--ok-bg)',     color: 'var(--ok-text)',     label: 'Resolved' },
  closed:      { bg: 'var(--border-soft, rgba(100,116,139,0.12))', color: 'var(--text2)', label: 'Closed' },
}

export const CONCERN_PRIORITY = {
  urgent: { bg: 'var(--danger-bg)', color: 'var(--danger-text)', label: 'Urgent' },
  high:   { bg: 'var(--warn-bg)',   color: 'var(--warn-text)',   label: 'High' },
  medium: { bg: 'var(--info-bg)',   color: 'var(--info-text)',   label: 'Medium' },
  low:    { bg: 'var(--border-soft, rgba(100,116,139,0.12))', color: 'var(--text2)', label: 'Low' },
}

export const MOODS = [
  { key: 'happy',   emoji: '😊', label: 'Happy',   color: '#15803D' },
  { key: 'settled', emoji: '🙂', label: 'Settled', color: '#1D4ED8' },
  { key: 'quiet',   emoji: '😐', label: 'Quiet',   color: '#475569' },
  { key: 'worried', emoji: '😟', label: 'Worried', color: '#B45309' },
  { key: 'upset',   emoji: '😢', label: 'Upset',   color: '#B91C1C' },
]
export const moodOf = (key) => MOODS.find(m => m.key === key) || null
const LOW_MOODS = ['worried', 'upset']

/** "Neglect concern" -- the register files its quick concerns as 'other'. */
export function concernLabel(c) {
  const type = (c.concern_type || '').trim()
  return type && type.toLowerCase() !== 'other' ? `${cap(type)} concern` : 'Concern'
}

/** What has gone wrong with an open concern, worst first. */
export function concernProblems(c, today = londonToday()) {
  if (!isOpenConcern(c) || isHandedOver(c)) return []
  const out = []
  if (!c.dsl_notified) out.push({ code: 'lead', urgency: 'urgent', text: "the safeguarding lead hasn't been told" })
  if (c.follow_up_required && c.follow_up_due) {
    const late = daysBetween(dayOf(c.follow_up_due), today)
    if (late > 0) out.push({ code: 'overdue', urgency: 'urgent', text: `follow-up ${plural(late, 'day')} overdue` })
    else if (late === 0) out.push({ code: 'due', urgency: 'soon', text: 'follow-up due today' })
  }
  // A follow-up with no date can never come due, so it would sit silently forever.
  if (c.follow_up_required && !c.follow_up_due) out.push({ code: 'nodate', urgency: 'soon', text: 'follow-up has no date' })
  if (!c.assigned_to) out.push({ code: 'owner', urgency: 'soon', text: 'nobody owns it' })
  const age = c.created_at ? daysBetween(dayOf(c.created_at), today) : 0
  if (age >= 14) out.push({ code: 'stale', urgency: 'later', text: `open ${age} days` })
  return out
}

/** What has gone wrong with an open case, worst first. */
export function caseProblems(cs, tasks = [], today = londonToday()) {
  if (!isOpenCase(cs)) return []
  const out = []
  if (cs.immediate_danger && !cs.risk_ack_at) out.push({ code: 'danger', urgency: 'urgent', text: 'immediate danger, not acknowledged' })
  if (cs.next_review_date && cs.next_review_date < today) {
    const late = daysBetween(cs.next_review_date, today)
    out.push({ code: 'review', urgency: 'urgent', text: `review ${plural(late, 'day')} overdue` })
  }
  const lateTasks = tasks.filter(t => t.case_id === cs.id && !t.completed && t.due_date && t.due_date < today)
  if (lateTasks.length === 1) out.push({ code: 'tasks', urgency: 'soon', text: `task overdue: ${lateTasks[0].title}` })
  else if (lateTasks.length > 1) out.push({ code: 'tasks', urgency: 'soon', text: `${lateTasks.length} tasks overdue` })
  if (!cs.assigned_to_user_id) out.push({ code: 'owner', urgency: 'soon', text: 'nobody owns it' })
  if (cs.requires_dsl) out.push({ code: 'lead', urgency: 'soon', text: 'waiting for the safeguarding lead' })
  return out
}

const RANK = { urgent: 0, soon: 1, later: 2 }
const worstOf = (problems) => problems.reduce((w, p) => (RANK[p.urgency] < RANK[w.urgency] ? p : w))

/** Accident book entries still to finish -- the same rule the accident book uses. */
export const injuryToFinish = (r) => !r.parent_notified || !!r.follow_up_needed

/**
 * Everything that needs someone, one item per record.
 *
 * Grouped on purpose: a concern nobody owns and the lead hasn't heard about is
 * one thing to sort out, not two rows that look like two incidents.
 */
export function hubAttention({ concerns = [], cases = [], tasks = [], injuries = [], today = londonToday() }) {
  const items = []
  for (const c of concerns) {
    const problems = concernProblems(c, today)
    if (!problems.length) continue
    const top = worstOf(problems)
    items.push({
      key: `concern-${c.id}`, kind: 'concern', id: c.id, urgency: top.urgency, problems,
      icon: top.code === 'lead' ? '🚨' : top.code === 'overdue' || top.code === 'due' ? '⏰' : '🛡️',
      title: `${c.child_name || 'Unnamed'}: ${top.text}`,
      detail: [`${concernLabel(c)}, raised ${relativeDay(c.created_at, today)}`, ...problems.filter(p => p !== top).map(p => cap(p.text))].join(' · '),
      action: 'Open concern',
    })
  }
  for (const cs of cases) {
    const problems = caseProblems(cs, tasks, today)
    if (!problems.length) continue
    const top = worstOf(problems)
    items.push({
      key: `case-${cs.id}`, kind: 'case', id: cs.id, urgency: top.urgency, problems,
      icon: top.code === 'danger' ? '🚨' : top.code === 'review' || top.code === 'tasks' ? '⏰' : '📁',
      title: `${cs.child_name || 'Unnamed'}: ${top.text}`,
      detail: [`${cap(cs.category || cs.case_type || 'Safeguarding')} case`, ...problems.filter(p => p !== top).map(p => cap(p.text))].join(' · '),
      action: 'Open case',
    })
  }
  const todo = injuries.filter(injuryToFinish)
  if (todo.length) {
    const untold = todo.filter(r => !r.parent_notified).length
    const follow = todo.filter(r => r.follow_up_needed).length
    items.push({
      key: 'injuries', kind: 'injuries', urgency: untold ? 'urgent' : 'soon', icon: '🩹',
      title: untold ? `${plural(untold, 'parent')} not told about an injury` : `${plural(follow, 'accident book follow-up')} open`,
      detail: [untold && follow ? `${plural(follow, 'follow-up')} open as well` : null, `${plural(todo.length, 'accident book entry', 'accident book entries')} to finish`].filter(Boolean).join(' · '),
      action: 'Open accident book',
    })
  }
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => RANK[a.item.urgency] - RANK[b.item.urgency] || a.i - b.i)
    .map(x => x.item)
}

/**
 * Where every open piece of work sits on the way from concern to case.
 * Closed counts the UK calendar month, concerns and cases together.
 */
export function flowCounts(concerns = [], cases = [], today = londonToday()) {
  const open = concerns.filter(c => isOpenConcern(c) && !isHandedOver(c))
  const month = today.slice(0, 7)
  const inMonth = (v) => !!v && (dayOf(v) || '').slice(0, 7) === month
  const caseClosedAt = (c) => c.resolved_at || (c.status === 'closed' || c.status === 'resolved' ? c.updated_at : null)
  return {
    raised: open.filter(c => !c.dsl_notified).length,
    withLead: open.filter(c => c.dsl_notified).length,
    cases: cases.filter(isOpenCase).length,
    closed: concerns.filter(c => inMonth(c.closed_at)).length + cases.filter(c => inMonth(caseClosedAt(c))).length,
  }
}

/** The one line under the title: what needs doing, then what is open. */
export function hubSummary(attention, flow) {
  const urgent = attention.filter(i => i.urgency === 'urgent').length
  const open = flow.raised + flow.withLead
  const openBits = [open ? plural(open, 'open concern') : null, flow.cases ? plural(flow.cases, 'open case') : null].filter(Boolean)
  const head = urgent ? `${plural(urgent, 'thing')} to sort out now` : attention.length ? `${plural(attention.length, 'thing')} to look at` : 'Nothing needs you right now'
  return openBits.length ? `${head} · ${openBits.join(' · ')}` : `${head}. No open concerns or cases.`
}

// ── Children ────────────────────────────────────────

export const fullName = (ch) => `${ch.first_name || ''} ${ch.last_name || ''}`.trim()

/**
 * Whether a concern, case or injury is about this child.
 *
 * Linked by id where it was picked from the register; older and quick
 * reports only carry the typed name, and a concern's name field can list
 * several people ("Amy Lee, Sam Lee"). A concern that names a child belongs
 * in that child's history even if another child was the linked subject:
 * leaving it out is the failure a chronology exists to prevent.
 */
export function belongsTo(record, child) {
  if (!record || !child) return false
  if (record.child_id && record.child_id === child.id) return true
  const full = norm(fullName(child))
  if (!full) return false
  return norm(record.child_name).split(',').map(s => s.trim()).includes(full)
}

export function ageFrom(dob, today = londonToday()) {
  if (!dob) return null
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - y
  if (tm < m || (tm === m && td < d)) age -= 1
  return age >= 0 ? age : null
}

/** Medical and support flags worth knowing in a safeguarding conversation. */
export function childFlags(ch) {
  const out = []
  if (ch.has_epipen) out.push({ key: 'epipen', label: 'EpiPen', tone: 'danger' })
  if (ch.allergies) out.push({ key: 'allergies', label: 'Allergies', tone: 'danger' })
  if (ch.has_asthma) out.push({ key: 'asthma', label: 'Asthma', tone: 'info' })
  if (ch.has_diabetes) out.push({ key: 'diabetes', label: 'Diabetes', tone: 'info' })
  if (ch.takes_medication) out.push({ key: 'medication', label: 'Medication', tone: 'info' })
  if (ch.has_behaviour_plan) out.push({ key: 'plan', label: 'Support plan', tone: 'warn' })
  if (ch.sen) out.push({ key: 'sen', label: 'SEN', tone: 'ok' })
  if (ch.collection_restricted) out.push({ key: 'collection', label: 'Collection restricted', tone: 'danger' })
  return out
}

/**
 * Per child: what is open about them and how they have seemed lately, with a
 * score that puts the children who most need a look first.
 */
export function childSignals({ children = [], concerns = [], cases = [], injuries = [], checks = [], today = londonToday() }) {
  const since30 = addDays(today, -30)
  const since14 = addDays(today, -14)
  const out = {}
  for (const ch of children) {
    const mine = concerns.filter(c => belongsTo(c, ch))
    const openConcerns = mine.filter(c => isOpenConcern(c) && !isHandedOver(c)).length
    const openCases = cases.filter(c => isOpenCase(c) && belongsTo(c, ch)).length
    const injuries30 = injuries.filter(r => belongsTo(r, ch) && (dayOf(r.occurred_at || r.created_at) || '') >= since30).length
    const myChecks = checks.filter(w => w.child_id === ch.id)
    const lastCheck = myChecks.reduce((best, w) => (!best || String(w.created_at) > String(best.created_at) ? w : best), null)
    const lowMoods = myChecks.filter(w => LOW_MOODS.includes(w.mood) && (dayOf(w.created_at) || '') >= since14).length
    out[ch.id] = {
      openConcerns, openCases, injuries30, lowMoods, lastCheck,
      concernsEver: mine.length,
      score: openCases * 5 + openConcerns * 4 + lowMoods * 2 + injuries30,
    }
  }
  return out
}

/** Children with something open or worrying, most in need first. */
export function childrenToWatch(children, signals, limit = 6) {
  return children
    .filter(ch => (signals[ch.id]?.score || 0) > 0)
    .sort((a, b) => signals[b.id].score - signals[a.id].score || fullName(a).localeCompare(fullName(b)))
    .slice(0, limit)
}

// ── Chronology ────────────────────────────────────────

const atMs = (v) => {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v + 'T12:00:00Z' : v)
  return Number.isNaN(t) ? 0 : t
}
const clip = (s, n = 160) => {
  const t = (s || '').trim().replace(/\s+/g, ' ')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function entriesFor({ concerns = [], cases = [], injuries = [], checks = [] }, keep) {
  const e = []
  for (const c of concerns) {
    if (!keep.concern(c)) continue
    e.push({
      key: `concern-${c.id}`, kind: 'concern', id: c.id, child: c.child_name, at: c.date_of_incident || c.created_at,
      title: `${concernLabel(c)} raised`, detail: clip(c.description),
      meta: [c.submitter_name ? `by ${c.submitter_name}` : null, c.location || null].filter(Boolean).join(' · '),
      status: isHandedOver(c) ? 'Now a case' : (CONCERN_STATUS[c.status] || CONCERN_STATUS.open).label,
    })
    if (c.closed_at) e.push({ key: `concern-closed-${c.id}`, kind: 'concern', id: c.id, child: c.child_name, at: c.closed_at, title: `${concernLabel(c)} closed`, detail: clip(c.resolution_notes), meta: '' })
  }
  for (const cs of cases) {
    if (!keep.caseRow(cs)) continue
    e.push({
      key: `case-${cs.id}`, kind: 'case', id: cs.id, child: cs.child_name, at: cs.created_at,
      title: `${cap(cs.category || cs.case_type || 'Safeguarding')} case opened`, detail: clip(cs.summary),
      meta: cs.risk_level ? `${cap(cs.risk_level)} risk` : '', status: isOpenCase(cs) ? 'Open' : 'Closed',
    })
    if (cs.resolved_at) e.push({ key: `case-closed-${cs.id}`, kind: 'case', id: cs.id, child: cs.child_name, at: cs.resolved_at, title: 'Case closed', detail: '', meta: '' })
  }
  for (const r of injuries) {
    if (!keep.injury(r)) continue
    const what = [r.injury_type, r.body_part].filter(Boolean).join(', ')
    e.push({
      key: `injury-${r.id}`, kind: 'injury', id: r.id, child: r.child_name, at: r.occurred_at || r.created_at,
      title: what ? `Injury: ${what}` : 'Injury logged', detail: clip(r.what_happened),
      meta: [!r.parent_notified ? 'Parent not told yet' : 'Parent told', r.sent_to_hospital ? 'Went to hospital' : null].filter(Boolean).join(' · '),
      warn: !r.parent_notified || !!r.sent_to_hospital,
    })
  }
  for (const w of checks) {
    if (!keep.check(w)) continue
    const mood = moodOf(w.mood)
    e.push({
      key: `check-${w.id}`, kind: 'check', id: w.id, childId: w.child_id, mood: w.mood, at: w.created_at,
      title: `Check-in: ${mood ? mood.label.toLowerCase() : w.mood || 'logged'}`, detail: clip(w.note), meta: '',
      warn: LOW_MOODS.includes(w.mood),
    })
  }
  return e.sort((a, b) => atMs(b.at) - atMs(a.at))
}

/** One child's safeguarding history, newest first. */
export function childChronology(child, data) {
  return entriesFor(data, {
    concern: c => belongsTo(c, child),
    caseRow: c => belongsTo(c, child),
    injury: r => belongsTo(r, child),
    check: w => w.child_id === child.id,
  })
}

/** The latest things that happened across the hub. */
export function recentActivity(data, limit = 8) {
  const all = () => true
  const byId = Object.fromEntries((data.children || []).map(ch => [ch.id, fullName(ch)]))
  return entriesFor(data, { concern: all, caseRow: all, injury: all, check: all })
    .filter(e => !e.key.includes('-closed-'))
    .map(e => (e.kind === 'check' ? { ...e, child: byId[e.childId] || 'A child' } : e))
    .slice(0, limit)
}

/** Plain text for pasting into a referral form or an email to the lead. */
export function chronologyText(child, entries, today = londonToday()) {
  const head = [`Safeguarding chronology: ${fullName(child)}`, `Prepared ${formatDay(today)}`, '']
  const lines = entries.map(e => [`${formatDay(e.at)}: ${e.title}`, e.detail, e.meta].filter(Boolean).join(' - '))
  return [...head, ...(lines.length ? lines : ['Nothing recorded.'])].join('\n')
}

// ── Dates for people ────────────────────────────────────────

export function formatDay(value) {
  if (!value) return ''
  const t = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00Z') : new Date(value)
  if (Number.isNaN(t.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(t)
}

/** "today", "yesterday", "3 days ago", then a date. */
export function relativeDay(value, today = londonToday()) {
  const day = dayOf(value)
  if (!day) return 'on an unknown date'
  const ago = daysBetween(day, today)
  if (ago <= 0) return 'today'
  if (ago === 1) return 'yesterday'
  if (ago < 7) return `${ago} days ago`
  return `on ${formatDay(day)}`
}

/** A person's name for display, falling back to their email only as a last resort. */
export function personName(p) {
  if (!p) return null
  const full = (p.full_name || '').trim()
  if (full) return full
  const built = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (built) return built
  if ((p.preferred_name || '').trim()) return p.preferred_name.trim()
  return p.email || 'Unknown'
}

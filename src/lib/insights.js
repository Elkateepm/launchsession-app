import { AGE_BANDS } from './funderReport'
import { todayInLondon } from './today'

// The arithmetic behind the Reports & Insights page and the report studio.
//
// Everything here is pure: periods, comparisons, the plain-language facts and
// the shape the screens draw from. The numbers themselves are counted in
// Postgres (report_insights_metrics, or the older per-report aggregates when
// that is not available yet) and arrive here already aggregated, so nothing
// in this file ever sees a child, a volunteer or a concern.

export { AGE_BANDS }

// ─────────────────────────────────────────────────────────── dates

// Calendar dates are handled as midnight UTC so that adding a day is always
// exactly a day. "Today" itself comes from todayInLondon(): the organisations
// are in the UK and a UTC "today" is yesterday for the first hour of BST.
const D = (iso) => new Date(`${iso}T00:00:00Z`)
const ISO = (d) => d.toISOString().slice(0, 10)

export function addDays(iso, n) {
  const d = D(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return ISO(d)
}

export const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 86400000)

const isIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(D(v).getTime())

// Month names written out rather than taken from Intl: en-GB now abbreviates
// September as "Sept" in some engines and "Sep" in others, and a printed
// report should not depend on which browser made it.
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function formatDay(iso, { year = false } = {}) {
  if (!isIso(iso)) return '—'
  const d = D(iso)
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`
}

/** "1 Sep – 24 Nov 2026", or with both years when the range crosses one. */
export function formatRange(from, to) {
  if (!isIso(from) || !isIso(to)) return '—'
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatDay(from, { year: !sameYear })} – ${formatDay(to, { year: true })}`
}

// ─────────────────────────────────────────────────────────── periods

// UK school terms as youth organisations plan around them. Summer runs to the
// end of August so the holiday programme lands in the term it follows rather
// than in no term at all.
export function termFor(iso) {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  if (m >= 9) return { season: 'Autumn', name: `Autumn term ${y}`, from: `${y}-09-01`, to: `${y}-12-31` }
  if (m <= 3) return { season: 'Spring', name: `Spring term ${y}`, from: `${y}-01-01`, to: `${y}-03-31` }
  return { season: 'Summer', name: `Summer term ${y}`, from: `${y}-04-01`, to: `${y}-08-31` }
}

export const previousTerm = (term) => termFor(addDays(term.from, -1))

export const PERIODS = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'term', label: 'This term' },
  { key: 'last_term', label: 'Last term' },
  { key: 'year', label: 'This academic year' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'custom', label: 'Custom dates' },
]

const MAX_SPAN_DAYS = 1830 // the SQL refuses anything longer

/**
 * A period key resolved to dates.
 *
 * Returns { key, from, to, label, valid, problem }. A custom range that is
 * incomplete, reversed or too long comes back with valid: false and the dates
 * as typed, so the screen can say what is wrong rather than silently
 * substituting a different period.
 */
export function resolvePeriod(key, { today = todayInLondon(), from, to } = {}) {
  const base = PERIODS.find(p => p.key === key) || PERIODS[1]
  const out = (f, t, label) => ({ key: base.key, from: f, to: t, label, valid: true, problem: null })
  switch (base.key) {
    case '30d': return out(addDays(today, -29), today, 'Last 30 days')
    case '90d': return out(addDays(today, -89), today, 'Last 90 days')
    case '12m': return out(addDays(today, -364), today, 'Last 12 months')
    case 'term': {
      const t = termFor(today)
      return out(t.from, today < t.to ? today : t.to, `${t.name} so far`)
    }
    case 'last_term': {
      const t = previousTerm(termFor(today))
      return out(t.from, t.to, t.name)
    }
    case 'year': {
      const y = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) >= 9 ? 0 : 1)
      return out(`${y}-09-01`, today, `${y}/${String(y + 1).slice(2)} academic year so far`)
    }
    case 'custom': {
      let problem = null
      if (!isIso(from) || !isIso(to)) problem = 'Choose a start and an end date.'
      else if (to < from) problem = 'The end date is before the start date.'
      else if (daysBetween(from, to) > MAX_SPAN_DAYS) problem = 'Choose a period of five years or less.'
      return { key: 'custom', from: from || '', to: to || '', label: problem ? 'Custom dates' : formatRange(from, to), valid: !problem, problem }
    }
    default: return out(addDays(today, -89), today, 'Last 90 days')
  }
}

/** The window of the same length immediately before, as the SQL computes it. */
export function previousPeriod({ from, to }) {
  const span = daysBetween(from, to)
  const prevTo = addDays(from, -1)
  return { from: addDays(prevTo, -span), to: prevTo }
}

/** How the comparison is described in a sentence: "the 90 days before". */
export function comparisonPhrase({ from, to }) {
  const days = daysBetween(from, to) + 1
  if (days <= 1) return 'the day before'
  if (days === 7) return 'the week before'
  if (days <= 120) return `the ${days} days before`
  const months = Math.round(days / 30.44)
  if (months === 12) return 'the year before'
  return `the ${months} months before`
}

// ─────────────────────────────────────────────────────────── numbers

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

export function fmtCount(v) {
  const n = num(v)
  if (n == null) return '—'
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1).replace(/\.0$/, '')}K`
  return Math.round(n).toLocaleString('en-GB')
}

export function fmtHours(v) {
  const n = num(v)
  if (n == null) return '—'
  const r = n < 10 && n % 1 !== 0 ? n.toFixed(1).replace(/\.0$/, '') : fmtCount(n)
  return `${r}h`
}

export const fmtRate = (v) => (num(v) == null ? '—' : `${Math.round(num(v))}%`)

/** Hours in a sentence: "162 hours", "8.5 hours", "1 hour". */
export function hoursInWords(v) {
  const n = num(v)
  if (n == null) return '—'
  const r = n < 10 && n % 1 !== 0 ? n.toFixed(1).replace(/\.0$/, '') : fmtCount(n)
  return `${r} ${n === 1 ? 'hour' : 'hours'}`
}

export function fmtValue(v, kind) {
  if (kind === 'rate') return fmtRate(v)
  if (kind === 'hours') return fmtHours(v)
  return fmtCount(v)
}

const MINUS = '−'
const signed = (n, suffix = '') => (n === 0 ? `0${suffix}` : `${n > 0 ? '+' : MINUS}${Math.abs(n).toLocaleString('en-GB')}${suffix}`)

/**
 * This period against the one before.
 *
 * Rates change by percentage points, not by a percentage of themselves. Counts
 * on a small base change by their absolute amount: 2 to 3 is "+1", because
 * "+50%" would make a single extra person sound like a trend.
 */
export function compare(current, previous, kind = 'count') {
  const c = num(current)
  const p = num(previous)
  if (c == null || p == null) return null
  if (kind === 'rate') {
    const d = Math.round(c - p)
    return { delta: d, pct: null, direction: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', text: d === 0 ? 'No change' : `${signed(d)} pts` }
  }
  const d = Math.round((c - p) * 10) / 10
  if (d === 0) return { delta: 0, pct: 0, direction: 'flat', text: 'No change' }
  const direction = d > 0 ? 'up' : 'down'
  if (p === 0) return { delta: d, pct: null, direction, text: `${signed(d, kind === 'hours' ? 'h' : '')} from none` }
  const pct = Math.round((d / p) * 100)
  if (p < 10) return { delta: d, pct, direction, text: signed(d, kind === 'hours' ? 'h' : '') }
  return { delta: d, pct, direction, text: `${pct > 0 ? '+' : MINUS}${Math.abs(pct)}%` }
}

/** Whether a change is good news, bad news, or simply a change. */
export function changeTone(change, good) {
  if (!change || change.direction === 'flat' || good === 'neutral' || !good) return 'neutral'
  return (change.direction === 'up') === (good === 'up') ? 'good' : 'bad'
}

// ─────────────────────────────────────────────────────────── series labels

export function bucketLabel(start, bucket, { multiYear = false } = {}) {
  if (!isIso(start)) return ''
  if (bucket === 'week') return formatDay(start)
  const m = MONTH_SHORT[D(start).getUTCMonth()]
  return multiYear ? `${m} ’${start.slice(2, 4)}` : m
}

export function bucketLongLabel(start, finish, bucket) {
  if (!isIso(start)) return ''
  if (bucket === 'week') {
    const part = isIso(finish) && daysBetween(start, finish) < 6
    return `Week of ${formatDay(start, { year: true })}${part ? ' (part week)' : ''}`
  }
  const d = D(start)
  const month = `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  const part = isIso(finish) && (Number(start.slice(8, 10)) !== 1 || Number(finish.slice(8, 10)) !== lastDay)
  return `${month}${part ? ' (part month)' : ''}`
}

// ─────────────────────────────────────────────────────────── model

const TOTAL_KEYS = [
  'sessions_delivered', 'sessions_planned', 'hours', 'attendances', 'marked', 'attendance_rate',
  'reached', 'new_people', 'volunteer_hours', 'volunteers', 'locations', 'concerns_raised',
]
const SERIES_KEYS = ['sessions', 'hours', 'attendances', 'marked', 'rate', 'reached', 'volunteer_hours', 'concerns']

function totals(t) {
  const out = {}
  TOTAL_KEYS.forEach(k => { out[k] = num(t?.[k]) })
  return out
}

function seriesPoints(rows, bucket) {
  const list = (rows || []).filter(p => isIso(p?.start))
  const multiYear = list.length > 0 && list[0].start.slice(0, 4) !== list[list.length - 1].start.slice(0, 4)
  return list.map(p => {
    const point = { start: p.start, finish: p.finish || p.start }
    SERIES_KEYS.forEach(k => { point[k] = num(p[k]) })
    point.label = bucketLabel(p.start, bucket, { multiYear })
    point.longLabel = bucketLongLabel(p.start, p.finish, bucket)
    return point
  })
}

const rowsOf = (list, map) => (list || []).map(map).filter(r => r.label)

/**
 * The shape every screen draws from, whichever aggregate produced it.
 *
 * `capabilities` says what this data can support, so a screen hides a chart it
 * has nothing honest to draw with rather than drawing a line of zeroes.
 */
export function normalizeInsights(raw) {
  if (!raw) return null
  const bucket = raw.bucket === 'week' ? 'week' : 'month'
  return {
    source: 'insights',
    generatedAt: raw.generated_at || null,
    from: raw.from, to: raw.to, prevFrom: raw.prev_from, prevTo: raw.prev_to,
    bucket,
    current: totals(raw.current),
    previous: totals(raw.previous),
    series: seriesPoints(raw.series, bucket),
    byProject: rowsOf(raw.by_project, r => ({ id: r.id || null, label: r.label, sessions: num(r.sessions), hours: num(r.hours), reached: num(r.reached), rate: num(r.rate) })),
    byGroup: rowsOf(raw.by_group, r => ({ label: r.label, reached: num(r.reached), attendances: num(r.attendances) })),
    byLocation: rowsOf(raw.by_location, r => ({ label: r.label, sessions: num(r.sessions), hours: num(r.hours) })),
    byType: rowsOf(raw.by_type, r => ({ label: r.label, sessions: num(r.sessions) })),
    byAge: AGE_BANDS.map(b => ({ key: b.key, label: b.label, reached: num(raw.by_age?.[b.key]) || 0 })),
    canSeeSafeguarding: raw.can_see_safeguarding === true,
    safeguarding: raw.safeguarding ? {
      openNow: num(raw.safeguarding.open_now),
      resolvedInPeriod: num(raw.safeguarding.resolved_in_period),
      followUpOverdue: num(raw.safeguarding.follow_up_overdue),
    } : null,
    filtered: { projects: num(raw.filtered?.projects) || 0, groups: num(raw.filtered?.groups) || 0 },
    options: {
      projects: (raw.options?.projects || []).filter(p => p?.id && p?.name).map(p => ({ id: p.id, name: p.name, archived: !!p.archived })),
      groups: (raw.options?.groups || []).filter(g => typeof g === 'string' && g.trim()),
    },
    capabilities: { filters: true, reachSeries: true, volunteerHours: true, newPeople: true, previousAttendances: true },
  }
}

// "Nov 2026" as Postgres to_char(..., 'Mon YYYY') writes it.
function monthKeyFromLabel(label) {
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(label || '').trim())
  if (!m) return null
  const i = MONTH_SHORT.indexOf(m[1].slice(0, 1).toUpperCase() + m[1].slice(1).toLowerCase())
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`
}

function monthBuckets(from, to) {
  const out = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  for (let guard = 0; guard < 80; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key > to.slice(0, 7)) break
    const first = `${key}-01`
    const last = ISO(new Date(Date.UTC(y, m, 0)))
    out.push({ key, start: first < from ? from : first, finish: last > to ? to : last })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

/**
 * The same model built from the per-report aggregates that are already live.
 *
 * Used until report_insights_metrics is applied to the database. Those
 * functions take no filters and count by calendar month, and none of them
 * counts volunteer time by the register, so the capabilities say so and the
 * screens leave out what this source cannot support.
 */
export function fromLegacy({ from, to, cur = {}, prev = {} }) {
  const d = cur.delivery || {}
  const a = cur.attendance || {}
  const y = cur.young || {}
  const sg = cur.safeguarding || null
  const pd = prev.delivery || null
  const py = prev.young || null
  const psg = prev.safeguarding || null
  const byMonth = (list, field) => {
    const map = {}
    ;(list || []).forEach(r => { const k = monthKeyFromLabel(r.label); if (k) map[k] = num(r[field]) })
    return map
  }
  const sessions = byMonth(d.by_month, 'n')
  const hours = byMonth(d.by_month, 'hours')
  const rate = byMonth(a.by_month, 'rate')
  const marked = byMonth(a.by_month, 'n')
  const concerns = sg ? byMonth(sg.by_month, 'n') : null
  const pr = previousPeriod({ from, to })
  const series = monthBuckets(from, to).map(b => ({
    start: b.start, finish: b.finish,
    sessions: sessions[b.key] || 0, hours: hours[b.key] || 0,
    attendances: null, marked: marked[b.key] || 0, rate: rate[b.key] ?? null,
    reached: null, volunteer_hours: null,
    concerns: concerns ? (concerns[b.key] || 0) : null,
  }))
  return {
    ...normalizeInsights({
      from, to, prev_from: pr.from, prev_to: pr.to, bucket: 'month',
      current: {
        sessions_delivered: d.delivered, sessions_planned: d.planned, hours: d.hours,
        attendances: a.attended, marked: a.marked, attendance_rate: a.rate,
        reached: y.reached, new_people: y.new_to_us, locations: d.locations,
        concerns_raised: sg ? sg.raised : null,
      },
      previous: {
        sessions_delivered: pd?.delivered, hours: pd?.hours, attendance_rate: a.prev_rate,
        reached: py?.reached, new_people: py?.new_to_us, locations: pd?.locations,
        concerns_raised: psg ? psg.raised : null,
      },
      series,
      by_project: (cur.projects?.rows || []).filter(r => num(r.sessions) > 0)
        .map(r => ({ label: r.name, sessions: r.sessions, hours: r.hours, reached: r.participants, rate: r.rate })),
      by_group: (y.by_group || []).map(r => ({ label: r.label, reached: r.n })),
      by_location: (d.by_location || []).map(r => ({ label: r.label, sessions: r.n })),
      by_type: (d.by_type || []).map(r => ({ label: r.label, sessions: r.n })),
      by_age: y.age_bands || {},
      can_see_safeguarding: !!sg,
      safeguarding: sg ? { open_now: sg.open_all_time, resolved_in_period: null, follow_up_overdue: sg.follow_up_overdue } : null,
    }),
    source: 'legacy',
    capabilities: { filters: false, reachSeries: false, volunteerHours: false, newPeople: true, previousAttendances: false },
  }
}

// ─────────────────────────────────────────────────────────── KPIs

export const KPI_DEFS = [
  { key: 'reached', label: t => `${t.People} reached`, field: 'reached', kind: 'count', good: 'up', series: 'reached',
    hint: () => 'Marked present at least once' },
  { key: 'sessions', label: t => `${t.Sessions} delivered`, field: 'sessions_delivered', kind: 'count', good: 'up', series: 'sessions',
    hint: () => 'Cancelled ones not counted' },
  { key: 'attendance', label: () => 'Attendance rate', field: 'attendance_rate', kind: 'rate', good: 'up', series: 'rate',
    hint: () => 'Present out of places marked' },
  { key: 'hours', label: () => 'Hours of provision', field: 'hours', kind: 'hours', good: 'up', series: 'hours',
    hint: () => 'From scheduled start and end times' },
  { key: 'new_people', label: t => `New ${t.people}`, field: 'new_people', kind: 'count', good: 'up',
    hint: () => 'First time they were marked present' },
  { key: 'attendances', label: () => 'Attendances', field: 'attendances', kind: 'count', good: 'up', series: 'attendances',
    hint: () => 'Every time someone was marked present' },
  { key: 'volunteer_hours', label: () => 'Volunteer hours', field: 'volunteer_hours', kind: 'hours', good: 'up', series: 'volunteer_hours',
    hint: () => 'Signed in and out on the register' },
  // A rise in concerns raised can mean better reporting as easily as more
  // harm, so it is shown as a change and never coloured as good or bad.
  { key: 'concerns', label: () => 'Concerns raised', field: 'concerns_raised', kind: 'count', good: 'neutral', series: 'concerns',
    restricted: true, hint: () => 'Safeguarding, counts only' },
  { key: 'open_concerns', label: () => 'Concerns open now', safeguarding: 'openNow', kind: 'count', good: 'neutral',
    restricted: true, hint: () => 'Across the whole organisation' },
  { key: 'follow_up_overdue', label: () => 'Follow-ups overdue', safeguarding: 'followUpOverdue', kind: 'count', good: 'neutral',
    restricted: true, hint: () => 'Open concerns past their follow-up date' },
]

export const HOME_KPIS = ['reached', 'sessions', 'attendance', 'hours', 'new_people', 'volunteer_hours', 'concerns']

/**
 * Stat tiles for a set of KPI keys.
 *
 * A tile whose value this data cannot supply is left out rather than shown as
 * a dash: a funder reading "Volunteer hours —" learns nothing and wonders why.
 */
export function buildKpis(model, keys = HOME_KPIS, terms) {
  if (!model) return []
  return keys.map(k => KPI_DEFS.find(d => d.key === k)).filter(Boolean).map(def => {
    let value
    let previous = null
    if (def.safeguarding) {
      value = model.safeguarding ? model.safeguarding[def.safeguarding] : null
    } else {
      value = model.current[def.field]
      previous = model.previous[def.field]
    }
    if (value == null) return null
    if (def.key === 'volunteer_hours' && !model.capabilities.volunteerHours) return null
    const change = def.safeguarding ? null : compare(value, previous, def.kind)
    const spark = def.series && model.series.length >= 3 ? model.series.map(p => p[def.series]) : null
    return {
      key: def.key,
      label: def.label(terms),
      hint: def.hint ? def.hint(terms) : '',
      kind: def.kind,
      value,
      display: fmtValue(value, def.kind),
      previous,
      previousDisplay: previous == null ? null : fmtValue(previous, def.kind),
      change,
      tone: changeTone(change, def.good),
      restricted: !!def.restricted,
      spark: spark && spark.some(v => v != null) ? spark : null,
    }
  }).filter(Boolean)
}

// ─────────────────────────────────────────────────────────── facts

const plural = (n, one, many) => `${fmtCount(n)} ${n === 1 ? one : many}`
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * The plain-language findings, most important first.
 *
 * Deterministic: each sentence is arithmetic on figures shown elsewhere on the
 * page, so a reader who checks a fact against a chart finds they agree. A
 * finding is left out when the data is too thin to support it rather than
 * stated with false confidence.
 */
export function buildFacts(model, terms, { max = 6, skip = [] } = {}) {
  if (!model) return []
  const c = model.current
  const p = model.previous
  const before = comparisonPhrase({ from: model.from, to: model.to })
  const out = []
  const push = (key, tone, text, rank) => { if (!skip.includes(key)) out.push({ key, tone, text, rank }) }

  if (!c.sessions_delivered) {
    push('empty', 'info', `No ${terms.sessions} were delivered in this period${p.sessions_delivered ? `, against ${plural(p.sessions_delivered, terms.session, terms.sessions)} in ${before}` : ''}.`, 0)
    return out
  }

  if (c.attendance_rate != null && p.attendance_rate != null && (c.marked || 0) >= 10) {
    const d = Math.round(c.attendance_rate - p.attendance_rate)
    if (Math.abs(d) >= 3) {
      push('attendance', d > 0 ? 'good' : 'bad', `Attendance ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} points on ${before} (${fmtRate(p.attendance_rate)} → ${fmtRate(c.attendance_rate)}).`, 1)
    } else {
      push('attendance', 'neutral', `Attendance held steady at ${fmtRate(c.attendance_rate)}, against ${fmtRate(p.attendance_rate)} in ${before}.`, 6)
    }
  } else if (c.attendance_rate != null && (c.marked || 0) >= 10) {
    push('attendance', 'neutral', `Attendance ran at ${fmtRate(c.attendance_rate)} of places marked.`, 6)
  }

  if (c.reached != null) {
    const ch = compare(c.reached, p.reached, 'count')
    if (ch && ch.pct != null && (p.reached || 0) >= 10 && Math.abs(ch.pct) >= 10) {
      push('reach', ch.direction === 'up' ? 'good' : 'bad',
        `${cap(plural(c.reached, terms.person, terms.people))} reached, ${Math.abs(ch.pct)}% ${ch.direction === 'up' ? 'more' : 'fewer'} than in ${before}.`, 2)
    } else if (c.reached > 0) {
      push('reach', 'neutral', `${cap(plural(c.reached, terms.person, terms.people))} reached${p.reached != null ? ` (${fmtCount(p.reached)} in ${before})` : ''}.`, 7)
    }
  }

  if (c.new_people > 0 && c.reached > 0) {
    const share = Math.round((c.new_people / c.reached) * 100)
    push('new', 'good', `${cap(plural(c.new_people, terms.person, terms.people))} came for the first time — ${share}% of everyone reached.`, 3)
  }

  const s = compare(c.sessions_delivered, p.sessions_delivered, 'count')
  if (s && s.pct != null && (p.sessions_delivered || 0) >= 10 && Math.abs(s.pct) >= 15) {
    push('sessions', s.direction === 'up' ? 'good' : 'bad',
      `${cap(plural(c.sessions_delivered, terms.session, terms.sessions))} delivered, ${Math.abs(s.pct)}% ${s.direction === 'up' ? 'more' : 'fewer'} than in ${before}${c.hours ? ` — ${hoursInWords(c.hours)} of provision` : ''}.`, 4)
  } else {
    push('sessions', 'neutral', `${cap(plural(c.sessions_delivered, terms.session, terms.sessions))} delivered${c.hours ? `, ${hoursInWords(c.hours)} of provision` : ''}${c.locations > 1 ? ` across ${plural(c.locations, 'location', 'locations')}` : ''}.`, 8)
  }

  if (model.series.length >= 3) {
    const busiest = model.series.reduce((b, x) => ((x.sessions || 0) > (b?.sessions || 0) ? x : b), null)
    const total = model.series.reduce((t, x) => t + (x.sessions || 0), 0)
    if (busiest && busiest.sessions >= 2 && busiest.sessions / total < 0.9) {
      push('busiest', 'neutral', `Busiest ${model.bucket}: ${busiest.longLabel.replace(/^Week of /, 'the week of ')}, with ${plural(busiest.sessions, terms.session, terms.sessions)}.`, 9)
    }
  }

  const projects = model.byProject.filter(r => r.id)
  if (projects.length > 1 && projects[0].sessions > 0) {
    push('project', 'neutral', `${projects[0].label} delivered the most ${terms.sessions} (${fmtCount(projects[0].sessions)} of ${fmtCount(c.sessions_delivered)}).`, 10)
  }

  const ageTotal = model.byAge.reduce((t, b) => t + b.reached, 0)
  const known = model.byAge.filter(b => b.key !== 'unknown' && b.reached > 0).sort((a, b) => b.reached - a.reached)
  if (ageTotal >= 5 && known.length > 0) {
    push('age', 'neutral', `Most ${terms.people} reached were aged ${known[0].label} (${fmtCount(known[0].reached)} of ${fmtCount(ageTotal)}).`, 11)
  }

  if (model.capabilities.volunteerHours && c.volunteer_hours > 0) {
    push('volunteers', 'good', `${cap(plural(c.volunteers || 0, 'volunteer', 'volunteers'))} gave ${hoursInWords(c.volunteer_hours)} of their time.`, 5)
  }

  if (c.concerns_raised != null) {
    if (c.concerns_raised > 0) {
      push('concerns', 'neutral', `${cap(plural(c.concerns_raised, 'safeguarding concern was', 'safeguarding concerns were'))} raised${p.concerns_raised != null ? ` (${fmtCount(p.concerns_raised)} in ${before})` : ''}.`, 5)
    } else if (p.concerns_raised > 0) {
      push('concerns', 'neutral', `No safeguarding concerns were raised, against ${fmtCount(p.concerns_raised)} in ${before}.`, 12)
    }
  }

  if (c.sessions_delivered < 4) {
    // Ranked first: a caveat that gets trimmed off the end is no caveat.
    push('thin', 'info', `Based on ${plural(c.sessions_delivered, terms.session, terms.sessions)}, so read any change with care.`, 0)
  }

  return out.sort((a, b) => a.rank - b.rank).slice(0, max)
}

/**
 * The model with every safeguarding figure removed, for anyone who is not an
 * owner or admin. The database already withholds them from such a login;
 * this is the second lock, so a model built or cached for one viewer can
 * never show concerns to another.
 */
export function redactForViewer(model, isAdmin) {
  if (!model || isAdmin) return model
  return {
    ...model,
    current: { ...model.current, concerns_raised: null },
    previous: { ...model.previous, concerns_raised: null },
    series: model.series.map(p => ({ ...p, concerns: null })),
    safeguarding: null,
    canSeeSafeguarding: false,
  }
}

/** True when the period has nothing in it to chart. */
export const isEmptyPeriod = (model) => !model || (!model.current.sessions_delivered && !model.current.reached && !model.current.marked)

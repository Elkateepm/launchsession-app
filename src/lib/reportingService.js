import { supabase } from './supabase'

// Central reporting data layer. Everything here is org-scoped -- either
// implicitly (the RPC resolves org_id from auth.uid() server-side) or
// explicitly via .eq('org_id', orgId). No component should query report data
// directly; that's how the old page ended up pulling every attendance row into
// the browser to compute a percentage.

export const DATE_RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', days: 365 },
  { key: 'custom', label: 'Custom range', days: null },
]

export function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Local dates throughout -- toISOString() is UTC and silently shifts the window
// by a day for UK users in the small hours of BST.
export function rangeFor(key, custom) {
  if (key === 'custom' && custom?.from && custom?.to) return { from: custom.from, to: custom.to }
  const def = DATE_RANGES.find(r => r.key === key) || DATE_RANGES[1]
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (def.days || 30) + 1)
  return { from: toLocalISO(from), to: toLocalISO(to) }
}

// ── Overview ────────────────────────────────────────────────────────────
// Single aggregate call; Postgres does the counting.
export async function getOverviewMetrics({ from, to }) {
  const { data, error } = await supabase.rpc('report_overview_metrics', { p_from: from, p_to: to })
  if (error) throw error
  return data
}

// Deterministic insights only -- each one is a plain calculation over the
// metrics above. Nothing here is AI-generated and nothing restates a number
// that's already on screen; an insight only appears when it implies an action.
export function deriveInsights(m, extras = {}) {
  if (!m) return []
  const out = []

  const rate = m.attendance_rate
  const prev = m.prev_attendance_rate
  if (rate !== null && prev !== null && prev > 0) {
    const delta = rate - prev
    if (delta <= -5) {
      out.push({
        key: 'attendance_down', tone: 'warn',
        title: 'Attendance has fallen',
        body: `${rate}% attendance, down ${Math.abs(delta)} points on the previous period.`,
        action: 'Explore attendance', target: 'attendance',
      })
    } else if (delta >= 8) {
      out.push({
        key: 'attendance_up', tone: 'good',
        title: 'Attendance is improving',
        body: `${rate}% attendance, up ${delta} points on the previous period.`,
        action: 'Explore attendance', target: 'attendance',
      })
    }
  }

  if (extras.frequentAbsentees > 0) {
    out.push({
      key: 'absentees', tone: 'warn',
      title: 'Young people needing follow-up',
      body: `${extras.frequentAbsentees} young ${extras.frequentAbsentees === 1 ? 'person has' : 'people have'} missed 3 or more recent sessions.`,
      action: 'Review engagement', target: 'attendance',
    })
  }

  if (m.open_concerns > 0) {
    out.push({
      key: 'concerns', tone: 'urgent',
      title: 'Open safeguarding concerns',
      body: `${m.open_concerns} concern${m.open_concerns === 1 ? '' : 's'} still unresolved.`,
      action: 'Review safeguarding', target: 'safeguarding',
    })
  }

  if (extras.unfinalisedRegisters > 0) {
    out.push({
      key: 'registers', tone: 'warn',
      title: 'Registers not finalised',
      body: `${extras.unfinalisedRegisters} past session${extras.unfinalisedRegisters === 1 ? ' has' : 's have'} attendance still unmarked, which affects every figure on this page.`,
      action: 'Review sessions', target: 'sessions',
    })
  }

  if (m.outcomes > 0) {
    out.push({
      key: 'outcomes', tone: 'good',
      title: 'Outcomes recorded',
      body: `${m.outcomes} outcome${m.outcomes === 1 ? '' : 's'} recorded in this period.`,
      action: 'View outcomes', target: 'impact',
    })
  }

  return out
}

// Signals that need a row-level look but stay bounded (ids only, capped).
export async function getInsightExtras(orgId, { from, to }) {
  const today = toLocalISO(new Date())
  const [{ data: pastSessions }, { data: absentRows }] = await Promise.all([
    supabase.from('sessions').select('id').eq('org_id', orgId)
      .gte('session_date', from).lte('session_date', to).lt('session_date', today),
    supabase.from('attendance').select('child_id, status, session_id')
      .eq('org_id', orgId).eq('status', 'absent').limit(2000),
  ])

  const pastIds = new Set((pastSessions || []).map(s => s.id))
  let unfinalised = 0
  if (pastIds.size) {
    const { data: expectedRows } = await supabase.from('attendance')
      .select('session_id').eq('org_id', orgId).eq('status', 'expected')
    unfinalised = new Set((expectedRows || []).filter(r => pastIds.has(r.session_id)).map(r => r.session_id)).size
  }

  const perChild = {}
  ;(absentRows || []).forEach(r => { perChild[r.child_id] = (perChild[r.child_id] || 0) + 1 })
  const frequentAbsentees = Object.values(perChild).filter(n => n >= 3).length

  return { frequentAbsentees, unfinalisedRegisters: unfinalised }
}

// ── Saved reports ───────────────────────────────────────────────────────
export async function listSavedReports(orgId) {
  const { data, error } = await supabase.from('reports').select('*')
    .eq('org_id', orgId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveReport(orgId, userId, { name, report_type, date_from, date_to, filters, configuration }) {
  const { data, error } = await supabase.from('reports').insert({
    org_id: orgId, name, report_type, date_from, date_to,
    filters: filters || {}, configuration: configuration || {},
    created_by: userId,
  }).select().single()
  if (error) throw error
  return data
}

export async function renameReport(id, name) {
  const { error } = await supabase.from('reports').update({ name, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteReport(id) {
  const { error } = await supabase.from('reports').delete().eq('id', id)
  if (error) throw error
}

// Rerunning re-queries live data against a new window rather than replaying a
// stored snapshot, so a "Quarterly Trustee Report" stays reusable each quarter.
export async function rerunReport(report, newRange) {
  const range = newRange || { from: report.date_from, to: report.date_to }
  const metrics = await getOverviewMetrics(range)
  await supabase.from('reports').update({ last_run_at: new Date().toISOString() }).eq('id', report.id)
  return { report, range, metrics }
}

export async function duplicateReport(orgId, userId, report) {
  return saveReport(orgId, userId, {
    name: `${report.name} (Copy)`,
    report_type: report.report_type,
    date_from: report.date_from,
    date_to: report.date_to,
    filters: report.filters,
    configuration: report.configuration,
  })
}

// ── Report catalogue ────────────────────────────────────────────────────
// `restricted` reports are additionally gated by RLS, not just hidden here.
export const REPORT_LIBRARY = [
  { key: 'delivery', category: 'Delivery', icon: '📅', name: 'Session Delivery Report',
    desc: 'Sessions delivered, hours, locations, session types and staff involved.' },
  { key: 'programme', category: 'Delivery', icon: '🎯', name: 'Programme Report',
    desc: 'Delivery, participants, attendance and outcomes broken down by programme.' },
  { key: 'attendance', category: 'Attendance', icon: '✅', name: 'Attendance Report',
    desc: 'Expected vs actual attendance, absences, trends and repeat absence.' },
  { key: 'young_people', category: 'Young People', icon: '🧒', name: 'Young People Engagement Report',
    desc: 'Unique young people reached, new and returning participants, engagement.' },
  { key: 'impact', category: 'Impact', icon: '⭐', name: 'Impact Report',
    desc: 'Outcomes recorded, goals created and achieved, progression and reach.' },
  { key: 'team', category: 'Team', icon: '👥', name: 'Workforce Delivery Report',
    desc: 'Staff and volunteers involved, sessions worked and delivery hours.' },
  { key: 'project', category: 'Delivery', icon: '🚀', name: 'Project Report',
    desc: 'Full summary of a multi-day project, ready for funders.' },
  // Not built from getOverviewMetrics like the rest of this list. It has its own
  // aggregate (report_funder_metrics) and its own document, because the
  // questions a grant report answers -- who did you reach, how much did they
  // actually get, did anything change -- are not answerable from the overview.
  { key: 'funding', category: 'Funding', icon: '💷', name: 'Funder / Grant Report',
    desc: 'Reach and age profile, how often people came, delivery volume, distance travelled and goals met. Printable.' },
  { key: 'safeguarding', category: 'Safeguarding', icon: '🛡️', name: 'Safeguarding Report',
    desc: 'Aggregate concern volumes, status and response times. Restricted access.',
    restricted: true },
]

export const REPORT_CATEGORIES = ['All', 'Delivery', 'Attendance', 'Young People', 'Impact', 'Team', 'Safeguarding', 'Funding']

export function canAccessReport(report, role) {
  if (!report.restricted) return true
  return ['admin', 'owner'].includes(role)
}

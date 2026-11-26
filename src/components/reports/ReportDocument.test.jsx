import React from 'react'
import { render, waitFor } from '@testing-library/react'
import ReportDocument from './ReportDocument'
import { getReportMetrics, buildSpec, hasDocument } from '../../lib/reportDocs'
import { loadInsights } from '../../lib/insightsService'
import { normalizeInsights } from '../../lib/insights'

jest.mock('../../lib/reportDocs', () => ({
  ...jest.requireActual('../../lib/reportDocs'),
  getReportMetrics: jest.fn(),
}))
jest.mock('../../lib/insightsService', () => ({ loadInsights: jest.fn(() => Promise.resolve(null)) }))

const org = { id: 'o1', name: 'Solidarity Sports' }
const range = { from: '2026-01-01', to: '2026-08-30' }
const terms = { person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People' }

// Captured verbatim from the live aggregates, so these are the shapes the
// documents will really be handed -- numeric strings from Postgres included.
export const LIVE = {
  delivery: {
    planned: 55, delivered: 55, cancelled: 2, hours: 188, avg_duration: 3.4,
    locations: 22, unstaffed: 15,
    by_type: [{ label: 'activity', n: 39, hours: 147 }, { label: 'trip', n: 9, hours: 31 },
      { label: 'workshop', n: 3, hours: 6 }, { label: 'community', n: 2, hours: 2 }],
    by_month: [{ label: 'Jul 2026', n: 10, hours: 48 }, { label: 'Aug 2026', n: 45, hours: 140 }],
    by_location: [{ label: 'Community Centre', n: 14 }, { label: 'Watford Leisure Centre', n: 7 }],
    reflections: { completed: 13, avg_rating: 4.7, would_repeat: 1 },
  },
  attendance: {
    rate: 86, prev_rate: null, attended: 307, absent: 52, marked: 359, unmarked: 316,
    by_month: [{ label: 'Jul 2026', n: 75, rate: 88 }, { label: 'Aug 2026', n: 284, rate: 85 }],
    absence_reasons: [{ label: 'No reason provided', n: 14 }, { label: 'Ill', n: 3 }],
    repeat_absentees: [{ label: 'Tyler Brown', n: 7 }, { label: 'Temi Adebayo', n: 7 }],
    lowest_sessions: [{ label: 'Test Session - Youth Club Drop-in', n: 12, rate: 0 }],
  },
  young_people: {
    reached: 47, on_roll: 54, new_to_us: 47, returning: 0, lapsed: 0, with_sen: 1,
    schools: 2, walk_ins: 1, total_attendances: 307, median_sessions: 6,
    attended_once: 6, attended_2_4: 15, attended_5_9: 11, attended_10_plus: 15,
    retained: 0, retention_base: 0,
    age_bands: { unknown: 1, age_8_11: 25, age_12_15: 19, age_16_18: 2 },
    by_group: [{ label: 'Scouts', n: 21 }, { label: 'No group', n: 8 }],
    most_engaged: [{ label: 'Aaliyah Baptiste', n: 18 }],
  },
  impact: {
    readings: 5, tracked: 3, measured: 1, improved: 0, held: 0, declined: 1, avg_delta: -9,
    by_area: [{ area: 'education', people: 1, baseline: 10, latest: 1, delta: -9 }],
    most_improved: [], needs_attention: [{ label: 'Aaliyah Baptiste', delta: -9, areas: 1 }],
    goals: { completed: 0, created: 0, active: 0, overdue: 0, by_area: [] },
  },
  team: {
    people: 3, staff: 2, volunteers: 1, assignments: 42, hours: 121,
    sessions_covered: 40, sessions_total: 55, avg_per_session: 1.1,
    by_person: [{ label: 'Mohammed Elkateep', kind: 'Staff', n: 38, hours: 110 }],
    by_role: [{ label: 'lead', n: 39 }, { label: 'volunteer', n: 2 }],
    volunteer_slots: { required: 2, filled: 0 },
    dbs: { volunteers_expired: 1, volunteers_expiring_90d: 1, volunteers_missing: 2 },
  },
  project: {
    projects: 2, sessions: 15, hours: 115, participants: 5, active_now: 0,
    rows: [{ name: 'Summer Project 2026', type: 'holiday_project', status: 'upcoming',
      start: '2026-08-10', end: '2026-08-21', sessions: 10, hours: 65, participants: 5, enrolled: 5, rate: 88 }],
  },
  safeguarding: {
    raised: 6, resolved: 0, open: 6, open_all_time: 6, dsl_notified: 3,
    parents_notified: 2, police_notified: 0, follow_up_overdue: 0,
    median_days_to_resolve: null, median_hours_to_dsl: 48.2,
    by_type: [{ label: 'general', n: 5 }, { label: 'other', n: 1 }],
    by_priority: [{ label: 'medium', n: 6 }],
    by_status: [{ label: 'closed', n: 5 }, { label: 'open', n: 1 }],
    by_month: [{ label: 'Jul 2026', n: 5 }, { label: 'Aug 2026', n: 1 }],
  },
}
LIVE.programme = LIVE.young_people

const KEYS = ['delivery', 'attendance', 'young_people', 'programme', 'impact', 'team', 'project', 'safeguarding']

describe('every library report has a document', () => {
  it.each(KEYS)('%s is backed by an aggregate', (key) => {
    expect(hasDocument(key)).toBe(true)
  })

  it.each(KEYS)('%s renders against the live payload shape', async (key) => {
    getReportMetrics.mockResolvedValue(LIVE[key])
    render(
      <ReportDocument reportKey={key} title="Report" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(document.body.querySelector('h1')).toBeTruthy())
    // A document, not an empty shell: a title, the org, the period, and content.
    expect(document.body.textContent).toContain('Solidarity Sports')
    expect(document.body.textContent).toContain('1 January 2026 to 30 August 2026')
    expect(document.body.querySelectorAll('.ls-doc-section').length).toBeGreaterThanOrEqual(3)
  })

  // The print rules hide every child of <body> except the document root.
  // Rendered inside the app's #root it printed as a blank page.
  it('mounts its printable root directly under <body>', async () => {
    getReportMetrics.mockResolvedValue(LIVE.delivery)
    render(<div id="app-root"><ReportDocument reportKey="delivery" title="Report" org={org} range={range} onClose={() => {}} /></div>)
    await waitFor(() => expect(document.body.querySelector('h1')).toBeTruthy())
    const root = document.getElementById('ls-doc-print-root')
    expect(root.parentElement).toBe(document.body)
    expect(document.getElementById('app-root').contains(root)).toBe(false)
  })

  it.each(KEYS)('%s states what it does not cover', (key) => {
    const spec = buildSpec(key, LIVE[key], terms)
    const caveats = spec.sections.find(s => /does not cover/i.test(s.title))
    expect(caveats).toBeTruthy()
    expect(caveats.caveats.filter(Boolean).length).toBeGreaterThan(0)
  })
})

describe('sections earn their place', () => {
  it('drops sections with nothing in them rather than printing zeroes', () => {
    const bare = { planned: 0, delivered: 0, cancelled: 0, hours: 0, locations: 0, unstaffed: 0,
      by_type: [], by_month: [], by_location: [], reflections: {} }
    const spec = buildSpec('delivery', bare, terms)
    expect(spec.sections.some(s => s.title === 'Where it happened')).toBe(false)
    expect(spec.sections.some(s => s.title === 'By session type')).toBe(false)
    // The summary and the caveats always survive: they are the honest minimum.
    expect(spec.sections.some(s => s.title === 'The period at a glance')).toBe(true)
  })
})

describe('reports say the awkward thing', () => {
  it('attendance calls out places that were never marked', () => {
    const spec = buildSpec('attendance', LIVE.attendance, terms)
    const text = JSON.stringify(spec)
    // 316 unmarked against 359 marked is most of the register.
    expect(text).toContain('never marked either way')
  })

  it('delivery flags sessions with nobody on the rota', () => {
    const spec = buildSpec('delivery', LIVE.delivery, terms)
    expect(JSON.stringify(spec)).toContain('nobody recorded on the staff rota')
  })

  it('safeguarding explains status disagreeing with the resolution date', () => {
    // by_status says 5 closed; resolved_at says 0 resolved. A reader comparing
    // the two deserves an explanation rather than a puzzle.
    const spec = buildSpec('safeguarding', LIVE.safeguarding, terms)
    const caveats = spec.sections.find(s => /does not cover/i.test(s.title)).caveats.join(' ')
    expect(caveats).toContain('marked "closed" by status')
  })

  it('safeguarding never leaks an identifying detail', () => {
    const spec = buildSpec('safeguarding', LIVE.safeguarding, terms)
    // Everything except the caveats, which legitimately use the word
    // "description" to promise that no description appears.
    const body = JSON.stringify(spec.sections.filter(s => !/does not cover/i.test(s.title))).toLowerCase()
    for (const forbidden of ['child_name', 'description', 'submitter', 'witness', 'incident']) {
      expect(body).not.toContain(forbidden)
    }
    // And nothing anywhere carries a free-text field off the concern record.
    const caveats = spec.sections.find(s => /does not cover/i.test(s.title)).caveats.join(' ')
    expect(caveats).toContain('No name, description or identifying detail')
  })

  it('impact refuses to claim improvement when scores fell', () => {
    const spec = buildSpec('impact', LIVE.impact, terms)
    const text = JSON.stringify(spec)
    expect(text).toContain('Scores fell by an average of 9.0 points')
  })

  it('workforce reports uncovered sessions', () => {
    const spec = buildSpec('team', LIVE.team, terms)
    expect(JSON.stringify(spec)).toContain('15 sessions with no one recorded')
  })
})

describe('permission', () => {
  it('reads a database refusal as a refusal, not a crash', async () => {
    getReportMetrics.mockRejectedValue(new Error('Not authorised'))
    render(
      <ReportDocument reportKey="safeguarding" title="Safeguarding" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(document.body.textContent).toContain('do not have permission'))
  })
})

// report_delivery_metrics after 20261126_report_delivery_snapshot.sql, and the
// Insights model for the same period, as the delivery report receives them.
const SNAPSHOT_DELIVERY = {
  ...LIVE.delivery,
  delivered: 22, hours: 95, avg_duration: 4.3, locations: 4, cancelled: 2, unstaffed: 11,
  by_month: [{ label: 'Oct 2026', n: 9, hours: 44 }, { label: 'Nov 2026', n: 3, hours: 10 }],
  by_weekday: [{ label: 'Monday', n: 6, hours: 20 }, { label: 'Sunday', n: 5, hours: 30 }],
  by_time_of_day: [{ label: 'Morning', n: 14 }, { label: 'Afternoon', n: 6 }, { label: 'Evening', n: 2 }],
  best_attended: [{ label: 'Lake District trip', date: '2026-10-12', present: 9, marked: 10, rate: 90 }],
  registers: { completed: 7, present: 32, marked: 62 },
  team: { avg_size: 1.0, with_volunteers: 0 },
  in_projects: 11, multi_day: 5,
  cancellation_reasons: [{ label: 'Weather', n: 2 }],
}
const SNAPSHOT = normalizeInsights({
  from: '2026-08-28', to: '2026-11-25', prev_from: '2026-05-31', prev_to: '2026-08-27', bucket: 'week',
  current: { sessions_delivered: 22, hours: 95, attendances: 32, marked: 62, attendance_rate: 52, reached: 17, new_people: 4, volunteer_hours: 0, volunteers: 0, locations: 4 },
  previous: { sessions_delivered: 51, hours: 195, attendances: 271, marked: 314, attendance_rate: 86, reached: 46, new_people: 46, volunteer_hours: 0 },
  series: [
    { start: '2026-08-28', finish: '2026-08-30', sessions: 3, hours: 10, marked: 20, rate: 70, reached: 9 },
    { start: '2026-08-31', finish: '2026-09-06', sessions: 4, hours: 12, marked: 18, rate: 50, reached: 8 },
    { start: '2026-09-07', finish: '2026-09-13', sessions: 2, hours: 6, marked: 0, rate: null, reached: 0 },
  ],
  by_project: [{ id: 'p1', label: 'Summer Camp', sessions: 11, reached: 10, rate: 60 }, { id: null, label: 'Not part of a project', sessions: 11, reached: 9, rate: 40 }],
  by_group: [{ label: 'Juniors', reached: 9 }],
  by_age: { age_8_11: 9, age_12_15: 7, age_16_18: 1 },
})

describe('the delivery report is a snapshot of the period', () => {
  const spec = buildSpec('delivery', { ...SNAPSHOT_DELIVERY, snapshot: SNAPSHOT }, terms)
  const section = (t) => spec.sections.find(s => s.title === t)

  it('opens with the period against the one before', () => {
    const glance = section('The period at a glance')
    expect(glance.figures.filter(Boolean).map(f => f.label)).toEqual([
      'sessions delivered', 'hours of provision', 'young people reached', 'attendance rate', 'attendances', 'new young people', 'average session length',
    ])
    expect(glance.figures[3]).toMatchObject({ value: '52%', note: '▼ −34 pts (was 86%)' })
    expect(glance.figures[1]).toMatchObject({ value: '95h', note: '▼ −51% (was 195h)' })
    expect(glance.prose.join(' ')).toContain('17 young people came at least once, 32 attendances in all, and 4 of them had never come before.')
    expect(glance.prose.join(' ')).toContain('Changes are measured against the 90 days before, 30 May – 27 Aug 2026.')
  })

  it('says what stands out, without safeguarding numbers', () => {
    const bullets = section('What stands out').bullets
    expect(bullets[0]).toBe('Attendance down 34 points on the 90 days before (86% → 52%).')
    expect(bullets.join(' ')).not.toMatch(/concern/i)
  })

  it('shows the shape of the period week by week, as a chart and a table', () => {
    const week = section('Week by week')
    expect(week.chart.points.map(p => p.value)).toEqual([3, 4, 2])
    expect(week.table.rows[0]).toMatchObject({ label: '28 Aug', sessions: 3, hours: '10h', reached: 9, rate: '70%' })
    expect(section('Attendance through the period').chart.points.map(p => p.value)).toEqual([70, 50, null])
  })

  it('covers when, which sessions, registers, projects, who came, the team and cancellations', () => {
    expect(section('When sessions ran').distribution.rows.map(r => r.label)).toEqual(['Monday', 'Sunday'])
    expect(section('When sessions ran').figures.map(f => f.label)).toEqual(['morning', 'afternoon', 'evening'])
    expect(section('Best attended sessions').table.rows[0]).toMatchObject({ label: 'Lake District trip', present: 9, rate: '90%' })
    expect(section('Registers').prose.join(' ')).toContain('Registers were marked for 7 of the 22 delivered sessions (32%).')
    expect(section('By project').table.rows.map(r => r.label)).toEqual(['Summer Camp', 'Not part of a project'])
    expect(section('Who came').distribution.rows.find(r => r.label === '8–11').n).toBe(9)
    expect(section('The team').figures.filter(Boolean).map(f => f.label)).toContain('sessions with nobody on the rota')
    expect(section('Cancelled').distribution.rows).toEqual([{ label: 'Weather', n: 2 }])
    expect(section('What this report does not cover').caveats.join(' ')).toContain('5 sessions ran over more than one day')
  })

  it('names no young person', () => {
    expect(spec.sections.some(s => s.named)).toBe(false)
    expect(JSON.stringify(spec)).not.toMatch(/Ann Example|Example Person/)
  })

  it('is still whole, only shorter, without the snapshot or the new fields', () => {
    const plain = buildSpec('delivery', LIVE.delivery, terms)
    const titles = plain.sections.map(s => s.title)
    expect(titles).toContain('The period at a glance')
    expect(titles).toContain('Month by month')
    expect(titles).not.toContain('Week by week')
    expect(titles).not.toContain('Registers')
  })

  it('never prints a negative number of hours', () => {
    const old = buildSpec('delivery', { ...LIVE.delivery, by_month: [{ label: 'Nov 2026', n: 3, hours: -14 }] }, terms)
    const month = old.sections.find(s => s.title === 'Month by month')
    expect(month.table.rows[0].hours).toBe('—')
    expect(JSON.stringify(old)).not.toContain('-14h')
  })

  it('draws its charts in the document', async () => {
    getReportMetrics.mockResolvedValue(SNAPSHOT_DELIVERY)
    loadInsights.mockResolvedValueOnce(SNAPSHOT)
    render(<ReportDocument reportKey="delivery" title="Session Delivery Report" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(document.body.textContent).toContain('Week by week'))
    expect(loadInsights).toHaveBeenCalledWith({ from: range.from, to: range.to })
    expect(document.querySelectorAll('#ls-doc-paper [role="img"]').length).toBe(2)
    expect(document.body.textContent).toContain('▼ −34 pts (was 86%)')
  })

  it('only the delivery report asks for the snapshot', async () => {
    loadInsights.mockClear()
    getReportMetrics.mockResolvedValue(LIVE.attendance)
    render(<ReportDocument reportKey="attendance" title="Attendance" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(document.body.querySelector('h1')).toBeTruthy())
    expect(loadInsights).not.toHaveBeenCalled()
  })
})

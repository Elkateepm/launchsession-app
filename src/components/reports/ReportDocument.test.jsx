import React from 'react'
import { render, waitFor } from '@testing-library/react'
import ReportDocument from './ReportDocument'
import { getReportMetrics, buildSpec, hasDocument } from '../../lib/reportDocs'

jest.mock('../../lib/reportDocs', () => ({
  ...jest.requireActual('../../lib/reportDocs'),
  getReportMetrics: jest.fn(),
}))

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
    const { container } = render(
      <ReportDocument reportKey={key} title="Report" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy())
    // A document, not an empty shell: a title, the org, the period, and content.
    expect(container.textContent).toContain('Solidarity Sports')
    expect(container.textContent).toContain('1 January 2026 to 30 August 2026')
    expect(container.querySelectorAll('.ls-doc-section').length).toBeGreaterThanOrEqual(3)
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
    expect(spec.sections.some(s => s.title === 'Summary')).toBe(true)
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
    const { container } = render(
      <ReportDocument reportKey="safeguarding" title="Safeguarding" org={org} range={range} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('do not have permission'))
  })
})

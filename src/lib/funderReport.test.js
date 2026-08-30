import { buildNarrative, buildCaveats, formatPeriod } from './funderReport'

const terms = { person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People' }
const ORG = 'Solidarity Sports'

// Shaped exactly like report_funder_metrics returns, including the numeric
// strings Postgres sends for rounded numerics.
const base = {
  from: '2026-01-01', to: '2026-08-30',
  reach: { people: 47, new_to_us: 47, returning: 0, on_roll: 54, schools: 2, with_sen: 1,
    age_bands: { age_8_11: 25, age_12_15: 19, age_16_18: 2, unknown: 1 } },
  engagement: { attended_once: 6, attended_2_4: 15, attended_5_9: 11, attended_10_plus: 15,
    median_sessions: 6, total_attendances: 307, retained: 0, retention_base: 0 },
  delivery: { sessions_planned: 55, sessions_delivered: 55, contact_hours: 188,
    participant_hours: 555, locations: 22, projects: 2 },
  attendance: { rate: 86, prev_rate: null, absences: 52 },
  outcomes: { measured: 1, tracked: 3, improved: 0, held: 0, declined: 1, avg_delta: '-9.00', by_area: [] },
  goals: { completed: 0, active: 0 },
  safeguarding: { open_concerns: 6 },
}
const with_ = (patch) => ({ ...base, ...patch })

describe('narrative', () => {
  it('opens with reach, delivery and hours', () => {
    const [first] = buildNarrative(base, terms, ORG)
    expect(first).toContain('47 young people')
    expect(first).toContain('55 sessions')
    expect(first).toContain('188 hours')
  })

  it('never claims improvement when scores fell', () => {
    // The regression: a negative average once rendered as
    // "improved, by an average of -9.0 points".
    const text = buildNarrative(base, terms, ORG).join(' ')
    expect(text).not.toMatch(/improved,? by an average of −?-?9/)
    expect(text).toContain('Scores fell by an average of 9.0 points')
  })

  it('says scores rose when they rose', () => {
    const text = buildNarrative(with_({
      outcomes: { measured: 10, tracked: 12, improved: 7, held: 2, declined: 1, avg_delta: '2.30', by_area: [] },
    }), terms, ORG).join(' ')
    expect(text).toContain('7 of the 10 young people')
    expect(text).toContain('Scores rose by an average of 2.3 points')
  })

  it('explains the gap rather than going quiet when nobody has a second score', () => {
    const text = buildNarrative(with_({
      outcomes: { measured: 0, tracked: 4, improved: 0, held: 0, declined: 0, avg_delta: null, by_area: [] },
    }), terms, ORG).join(' ')
    expect(text).toContain('no change can be evidenced')
  })

  it('claims nothing at all when there was no delivery', () => {
    const text = buildNarrative(with_({
      reach: { ...base.reach, people: 0 },
    }), terms, ORG).join(' ')
    expect(text).toContain('No attendance was recorded')
    expect(text).not.toContain('sessions')
  })

  it('reports retention only when there is a group to measure', () => {
    const quiet = buildNarrative(base, terms, ORG).join(' ')
    expect(quiet).not.toContain('still attending')
    const real = buildNarrative(with_({
      engagement: { ...base.engagement, retained: 18, retention_base: 24 },
    }), terms, ORG).join(' ')
    expect(real).toContain('18 (75%) were still attending')
  })
})

describe('caveats', () => {
  it('accounts for people missing a date of birth', () => {
    expect(buildCaveats(base, terms).join(' ')).toContain('no date of birth recorded')
  })

  it('accounts for people excluded from the outcome figures', () => {
    // 3 tracked, 1 measured -> 2 have a single score only.
    expect(buildCaveats(base, terms).join(' ')).toContain('2 young people have only one outcome score')
  })

  it('explains a zero retention base rather than silently omitting it', () => {
    expect(buildCaveats(base, terms).join(' ')).toContain('Nobody attended during the first half')
  })

  it('says the window was too short when retention could not be computed', () => {
    const c = buildCaveats(with_({ engagement: { ...base.engagement, retained: null, retention_base: null } }), terms)
    expect(c.join(' ')).toContain('too short to report retention')
  })

  it('always names the demographics the system does not hold', () => {
    // A funder who spots an unstated gap distrusts the whole document.
    expect(buildCaveats(base, terms).join(' ')).toContain('Ethnicity, gender, postcode')
  })

  it('always states that scores are staff judgements', () => {
    expect(buildCaveats(base, terms).join(' ')).toContain('not validated instruments')
  })
})

describe('period formatting', () => {
  it('reads as a date range a funder would recognise', () => {
    expect(formatPeriod('2026-01-01', '2026-08-30')).toBe('1 January 2026 to 30 August 2026')
  })
})

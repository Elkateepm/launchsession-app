import {
  addDays, daysBetween, formatRange, termFor, previousTerm, resolvePeriod, previousPeriod, comparisonPhrase,
  fmtCount, fmtHours, fmtRate, compare, changeTone, bucketLabel, bucketLongLabel,
  normalizeInsights, fromLegacy, buildKpis, buildFacts, isEmptyPeriod, redactForViewer, hoursInWords,
} from './insights'

const terms = {
  person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People',
  session: 'session', sessions: 'sessions', Session: 'Session', Sessions: 'Sessions', group: 'group', Group: 'Group',
}

// Shaped as report_insights_metrics returns it, numerics as strings included.
const raw = {
  generated_at: '2026-11-25T10:00:00Z',
  from: '2026-09-01', to: '2026-11-24', prev_from: '2026-06-08', prev_to: '2026-08-31',
  bucket: 'week',
  current: { sessions_delivered: 22, sessions_planned: 22, hours: 95, attendances: 32, marked: 62, attendance_rate: '52',
    reached: 17, new_people: 4, volunteer_hours: '12.5', volunteers: 2, locations: 4, concerns_raised: 0 },
  previous: { sessions_delivered: 51, hours: 195, attendances: 271, marked: 314, attendance_rate: '86',
    reached: 46, new_people: 46, volunteer_hours: '0.0', volunteers: 1, locations: 17, concerns_raised: 6 },
  series: [
    { start: '2026-09-01', finish: '2026-09-06', sessions: 2, hours: 6, attendances: 4, marked: 6, rate: '67', reached: 4, volunteer_hours: '2.5', concerns: 0 },
    { start: '2026-09-07', finish: '2026-09-13', sessions: 9, hours: 40, attendances: 14, marked: 30, rate: '47', reached: 9, volunteer_hours: '6', concerns: 0 },
    { start: '2026-09-14', finish: '2026-09-20', sessions: 11, hours: 49, attendances: 14, marked: 26, rate: '54', reached: 8, volunteer_hours: '4', concerns: 0 },
  ],
  by_project: [{ id: 'p1', label: 'Summer Camp', sessions: 12, hours: 50, reached: 10, rate: 60 }, { id: null, label: 'Not part of a project', sessions: 10, reached: 9, rate: 40 }],
  by_group: [{ label: 'Juniors', reached: 9, attendances: 20 }],
  by_location: [{ label: 'Hall', sessions: 15, hours: 60 }],
  by_type: [{ label: 'regular', sessions: 22 }],
  by_age: { age_8_11: 9, age_12_15: 7, age_16_18: 1 },
  can_see_safeguarding: true,
  safeguarding: { open_now: 6, resolved_in_period: 0, follow_up_overdue: 1 },
  filtered: { projects: 0, groups: 0 },
  options: { projects: [{ id: 'p1', name: 'Summer Camp', archived: false }, { id: null, name: 'bad' }], groups: ['Juniors', '', null] },
}

describe('dates and periods', () => {
  test('adds days across month and BST boundaries without drifting', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-01', '2026-11-24')).toBe(84)
  })

  test('terms follow the UK school year, with summer running to August', () => {
    expect(termFor('2026-11-25')).toMatchObject({ name: 'Autumn term 2026', from: '2026-09-01', to: '2026-12-31' })
    expect(termFor('2026-02-10')).toMatchObject({ name: 'Spring term 2026' })
    expect(termFor('2026-08-31')).toMatchObject({ name: 'Summer term 2026', from: '2026-04-01' })
    expect(previousTerm(termFor('2026-01-15')).name).toBe('Autumn term 2025')
  })

  test('resolves presets against a given London today', () => {
    const today = '2026-11-25'
    expect(resolvePeriod('30d', { today })).toMatchObject({ from: '2026-10-27', to: today, valid: true })
    expect(resolvePeriod('90d', { today })).toMatchObject({ from: '2026-08-28', to: today })
    expect(resolvePeriod('term', { today })).toMatchObject({ from: '2026-09-01', to: today, label: 'Autumn term 2026 so far' })
    expect(resolvePeriod('last_term', { today })).toMatchObject({ from: '2026-04-01', to: '2026-08-31', label: 'Summer term 2026' })
    expect(resolvePeriod('year', { today })).toMatchObject({ from: '2026-09-01', label: '2026/27 academic year so far' })
    expect(resolvePeriod('year', { today: '2026-05-01' }).from).toBe('2025-09-01')
    expect(resolvePeriod('nonsense', { today }).key).toBe('90d')
  })

  test('a custom range says what is wrong instead of substituting another period', () => {
    expect(resolvePeriod('custom', { from: '2026-09-01', to: '' })).toMatchObject({ valid: false, problem: 'Choose a start and an end date.' })
    expect(resolvePeriod('custom', { from: '2026-09-10', to: '2026-09-01' })).toMatchObject({ valid: false, problem: 'The end date is before the start date.' })
    expect(resolvePeriod('custom', { from: '2019-01-01', to: '2026-01-01' }).valid).toBe(false)
    expect(resolvePeriod('custom', { from: '2026-09-01', to: '2026-09-30' })).toMatchObject({ valid: true, label: '1 Sep – 30 Sep 2026' })
  })

  test('the previous period matches the SQL window exactly', () => {
    expect(previousPeriod({ from: '2026-09-01', to: '2026-11-24' })).toEqual({ from: '2026-06-08', to: '2026-08-31' })
    expect(previousPeriod({ from: '2026-09-10', to: '2026-09-10' })).toEqual({ from: '2026-09-09', to: '2026-09-09' })
  })

  test('describes the comparison window in words', () => {
    expect(comparisonPhrase({ from: '2026-10-27', to: '2026-11-25' })).toBe('the 30 days before')
    expect(comparisonPhrase({ from: '2025-11-26', to: '2026-11-25' })).toBe('the year before')
    expect(comparisonPhrase({ from: '2026-11-19', to: '2026-11-25' })).toBe('the week before')
  })

  test('formats ranges with the year once, or twice across a new year', () => {
    expect(formatRange('2026-09-01', '2026-11-24')).toBe('1 Sep – 24 Nov 2026')
    expect(formatRange('2025-12-01', '2026-01-31')).toBe('1 Dec 2025 – 31 Jan 2026')
    expect(formatRange('', '2026-01-31')).toBe('—')
  })
})

describe('numbers and comparisons', () => {
  test('writes hours out in sentences', () => {
    expect(hoursInWords(162)).toBe('162 hours')
    expect(hoursInWords('8.5')).toBe('8.5 hours')
    expect(hoursInWords(1)).toBe('1 hour')
  })

  test('formats counts, hours and rates', () => {
    expect(fmtCount(1284)).toBe('1,284')
    expect(fmtCount(12900)).toBe('12.9K')
    expect(fmtCount(null)).toBe('—')
    expect(fmtHours('8.5')).toBe('8.5h')
    expect(fmtHours(95)).toBe('95h')
    expect(fmtRate('52')).toBe('52%')
  })

  test('rates move in points, not percent of themselves', () => {
    expect(compare(60, 52, 'rate')).toMatchObject({ delta: 8, direction: 'up', text: '+8 pts' })
    expect(compare(52, 86, 'rate')).toMatchObject({ delta: -34, direction: 'down', text: '−34 pts' })
  })

  test('small bases change by absolute amounts so one person is not a trend', () => {
    expect(compare(3, 2)).toMatchObject({ text: '+1', pct: 50 })
    expect(compare(5, 0)).toMatchObject({ text: '+5 from none', pct: null })
    expect(compare(0, 0)).toMatchObject({ direction: 'flat', text: 'No change' })
    expect(compare(46, 40)).toMatchObject({ text: '+15%' })
    expect(compare(17, 46)).toMatchObject({ text: '−63%', direction: 'down' })
    expect(compare(null, 4)).toBeNull()
  })

  test('tone depends on whether up is good, and concerns are never coloured', () => {
    expect(changeTone(compare(60, 52, 'rate'), 'up')).toBe('good')
    expect(changeTone(compare(40, 52, 'rate'), 'up')).toBe('bad')
    expect(changeTone(compare(6, 2), 'neutral')).toBe('neutral')
    expect(changeTone(null, 'up')).toBe('neutral')
  })

  test('labels weekly and monthly points, marking partial ones', () => {
    expect(bucketLabel('2026-09-07', 'week')).toBe('7 Sep')
    expect(bucketLabel('2026-01-01', 'month', { multiYear: true })).toBe('Jan ’26')
    expect(bucketLongLabel('2026-09-01', '2026-09-06', 'week')).toBe('Week of 1 Sep 2026 (part week)')
    expect(bucketLongLabel('2026-09-07', '2026-09-13', 'week')).toBe('Week of 7 Sep 2026')
    expect(bucketLongLabel('2026-11-01', '2026-11-24', 'month')).toBe('November 2026 (part month)')
    expect(bucketLongLabel('2026-10-01', '2026-10-31', 'month')).toBe('October 2026')
  })
})

describe('normalizeInsights', () => {
  const m = normalizeInsights(raw)

  test('turns numeric strings into numbers and labels the series', () => {
    expect(m.current.attendance_rate).toBe(52)
    expect(m.current.volunteer_hours).toBe(12.5)
    expect(m.series[1]).toMatchObject({ label: '7 Sep', rate: 47, volunteer_hours: 6 })
    expect(m.bucket).toBe('week')
  })

  test('fills every age band and drops malformed filter options', () => {
    expect(m.byAge.map(b => b.reached)).toEqual([0, 9, 7, 1, 0, 0])
    expect(m.options.projects).toEqual([{ id: 'p1', name: 'Summer Camp', archived: false }])
    expect(m.options.groups).toEqual(['Juniors'])
  })

  test('carries safeguarding only when the database sent it', () => {
    expect(m.safeguarding).toEqual({ openNow: 6, resolvedInPeriod: 0, followUpOverdue: 1 })
    expect(normalizeInsights({ ...raw, safeguarding: null, can_see_safeguarding: false }).safeguarding).toBeNull()
    expect(normalizeInsights(null)).toBeNull()
  })
})

describe('fromLegacy', () => {
  const legacy = fromLegacy({
    from: '2026-09-15', to: '2026-11-24',
    cur: {
      delivery: { delivered: 22, planned: 23, hours: 95, locations: 4, by_month: [{ label: 'Sep 2026', n: 5, hours: 20 }, { label: 'Nov 2026', n: 9, hours: 40 }], by_location: [{ label: 'Hall', n: 15 }], by_type: [] },
      attendance: { rate: 52, prev_rate: 86, attended: 32, marked: 62, by_month: [{ label: 'Sep 2026', rate: 50, n: 20 }] },
      young: { reached: 17, new_to_us: 3, age_bands: { age_8_11: 9 }, by_group: [{ label: 'Juniors', n: 9 }] },
      projects: { rows: [{ name: 'Camp', sessions: 12, participants: 10, rate: 60 }, { name: 'Empty', sessions: 0 }] },
      safeguarding: null,
    },
    prev: { delivery: { delivered: 30, hours: 100 }, young: { reached: 40, new_to_us: 10 } },
  })

  test('fills every month in the range, including empty ones', () => {
    expect(legacy.bucket).toBe('month')
    expect(legacy.series.map(p => p.start)).toEqual(['2026-09-15', '2026-10-01', '2026-11-01'])
    expect(legacy.series.map(p => p.sessions)).toEqual([5, 0, 9])
    expect(legacy.series[0].finish).toBe('2026-09-30')
    expect(legacy.series[2].finish).toBe('2026-11-24')
    expect(legacy.series[1].rate).toBeNull()
  })

  test('maps totals, the previous period and breakdowns', () => {
    expect(legacy.current).toMatchObject({ sessions_delivered: 22, attendance_rate: 52, reached: 17, new_people: 3 })
    expect(legacy.previous).toMatchObject({ sessions_delivered: 30, attendance_rate: 86, reached: 40 })
    expect(legacy.byProject).toEqual([{ id: null, label: 'Camp', sessions: 12, hours: null, reached: 10, rate: 60 }])
    expect(legacy.byGroup[0]).toMatchObject({ label: 'Juniors', reached: 9 })
  })

  test('says what it cannot do, and hides safeguarding from those without it', () => {
    expect(legacy.source).toBe('legacy')
    expect(legacy.capabilities).toMatchObject({ filters: false, reachSeries: false, volunteerHours: false })
    expect(legacy.current.concerns_raised).toBeNull()
    expect(legacy.series[0].concerns).toBeNull()
  })
})

describe('buildKpis', () => {
  const m = normalizeInsights(raw)

  test('builds tiles with comparison, tone and sparkline', () => {
    const tiles = buildKpis(m, ['reached', 'attendance', 'concerns', 'open_concerns'], terms)
    expect(tiles.map(t => t.key)).toEqual(['reached', 'attendance', 'concerns', 'open_concerns'])
    expect(tiles[0]).toMatchObject({ label: 'Young People reached', display: '17', previousDisplay: '46', tone: 'bad' })
    expect(tiles[1]).toMatchObject({ display: '52%', tone: 'bad' })
    expect(tiles[1].change.text).toBe('−34 pts')
    expect(tiles[1].spark).toEqual([67, 47, 54])
    expect(tiles[2].tone).toBe('neutral')
    expect(tiles[3]).toMatchObject({ display: '6', change: null })
  })

  test('leaves out what this data cannot supply instead of showing a dash', () => {
    const noSg = normalizeInsights({ ...raw, safeguarding: null, current: { ...raw.current, concerns_raised: null } })
    expect(buildKpis(noSg, ['concerns', 'open_concerns', 'reached'], terms).map(t => t.key)).toEqual(['reached'])
    const legacyish = { ...m, capabilities: { ...m.capabilities, volunteerHours: false } }
    expect(buildKpis(legacyish, ['volunteer_hours'], terms)).toEqual([])
  })

  test('uses the organisation’s own words', () => {
    const club = { ...terms, People: 'Players', Sessions: 'Training' }
    expect(buildKpis(m, ['reached', 'sessions'], club).map(t => t.label)).toEqual(['Players reached', 'Training delivered'])
  })
})

describe('buildFacts', () => {
  test('leads with the biggest changes, in plain words', () => {
    const facts = buildFacts(normalizeInsights(raw), terms)
    expect(facts[0].text).toBe('Attendance down 34 points on the 85 days before (86% → 52%).')
    expect(facts.find(f => f.key === 'reach').text).toBe('17 young people reached, 63% fewer than in the 85 days before.')
    expect(facts.find(f => f.key === 'new').text).toBe('4 young people came for the first time — 24% of everyone reached.')
    expect(facts.length).toBeLessThanOrEqual(6)
  })

  test('says so plainly when nothing was delivered', () => {
    const empty = normalizeInsights({ ...raw, current: { sessions_delivered: 0, reached: 0 }, series: [] })
    const facts = buildFacts(empty, terms)
    expect(facts).toHaveLength(1)
    expect(facts[0].text).toBe('No sessions were delivered in this period, against 51 sessions in the 85 days before.')
    expect(isEmptyPeriod(empty)).toBe(true)
  })

  test('puts a caveat first when there is very little to go on', () => {
    const thin = normalizeInsights({ ...raw, current: { ...raw.current, sessions_delivered: 2, marked: 6 } })
    const facts = buildFacts(thin, terms)
    expect(facts[0]).toMatchObject({ key: 'thin', text: 'Based on 2 sessions, so read any change with care.' })
    expect(facts.find(f => f.key === 'attendance')).toBeUndefined()
  })

  test('reports concerns as a neutral count, never as good or bad news', () => {
    const withConcerns = normalizeInsights({ ...raw, current: { ...raw.current, concerns_raised: 3 }, previous: { ...raw.previous, concerns_raised: 1 } })
    const f = buildFacts(withConcerns, terms, { max: 20 }).find(x => x.key === 'concerns')
    expect(f).toMatchObject({ tone: 'neutral', text: '3 safeguarding concerns were raised (1 in the 85 days before).' })
  })

  test('names a busiest week and a leading project only when it means something', () => {
    const facts = buildFacts(normalizeInsights(raw), terms, { max: 20 })
    expect(facts.find(f => f.key === 'busiest').text).toBe('Busiest week: the week of 14 Sep 2026, with 11 sessions.')
    expect(facts.find(f => f.key === 'project')).toBeUndefined() // only one real project
    expect(facts.find(f => f.key === 'age').text).toBe('Most young people reached were aged 8–11 (9 of 17).')
  })
})

describe('redactForViewer', () => {
  test('strips every safeguarding figure for a non-admin and leaves admins alone', () => {
    const m = normalizeInsights(raw)
    const r = redactForViewer(m, false)
    expect(r.current.concerns_raised).toBeNull()
    expect(r.previous.concerns_raised).toBeNull()
    expect(r.series.every(p => p.concerns === null)).toBe(true)
    expect(r.safeguarding).toBeNull()
    expect(buildKpis(r, ['concerns', 'open_concerns', 'follow_up_overdue'], terms)).toEqual([])
    expect(buildFacts(r, terms, { max: 20 }).some(f => f.key === 'concerns')).toBe(false)
    expect(redactForViewer(m, true)).toBe(m)
  })
})

describe('buildFacts options', () => {
  test('can leave a finding out, and uses words for hours', () => {
    const m = normalizeInsights({ ...raw, current: { ...raw.current, concerns_raised: 3 } })
    const all = buildFacts(m, terms, { max: 20 })
    expect(all.some(f => f.key === 'concerns')).toBe(true)
    expect(buildFacts(m, terms, { max: 20, skip: ['concerns'] }).some(f => f.key === 'concerns')).toBe(false)
    expect(all.find(f => f.key === 'volunteers').text).toBe('2 volunteers gave 13 hours of their time.')
    expect(all.find(f => f.key === 'sessions').text).toMatch(/95 hours of provision/)
  })
})

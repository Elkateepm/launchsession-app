import { projectPhase, buildProjectStats, statsFor, progressOf, relativeDays, arrangeProjects, togetherSoFar, unplannedHoliday } from './projectsModel'

const today = '2026-11-26'
const P = (id, start, end, extra = {}) => ({ id, name: id, start_date: start, end_date: end, ...extra })

test('a project is live, upcoming, finished, undated or cancelled', () => {
  expect(projectPhase(P('a', '2026-11-20', '2026-11-30'), today)).toBe('live')
  expect(projectPhase(P('b', '2026-12-21', '2027-01-01'), today)).toBe('upcoming')
  expect(projectPhase(P('c', '2026-10-26', '2026-10-30'), today)).toBe('finished')
  expect(projectPhase(P('d', null, null), today)).toBe('unscheduled')
  expect(projectPhase(P('e', '2026-12-21', '2027-01-01', { status: 'cancelled' }), today)).toBe('cancelled')
})

test('counts days, people, check-ins and trips from sessions and registers, skipping cancelled days', () => {
  const sessions = [
    { id: 's1', project_id: 'a', session_date: '2026-11-24', title: 'Day 1' },
    { id: 's2', project_id: 'a', session_date: '2026-11-25', title: 'Trip', session_type: 'trip' },
    { id: 's3', project_id: 'a', session_date: '2026-11-26', title: 'Day 3' },
    { id: 's4', project_id: 'a', session_date: '2026-11-27', title: 'Off', cancelled_at: '2026-11-20T10:00:00Z' },
  ]
  const attendance = [
    { session_id: 's1', child_id: 'k1', status: 'signed_out' },
    { session_id: 's1', child_id: 'k2', status: 'absent' },
    { session_id: 's2', child_id: 'k1', status: 'signed_in' },
    { session_id: 's2', child_id: 'k3', status: 'signed_out' },
  ]
  const st = statsFor(buildProjectStats(sessions, attendance), 'a')
  expect(st.dates).toEqual(['2026-11-24', '2026-11-25', '2026-11-26'])
  expect(st.attended.size).toBe(2)
  expect(st.checkIns).toBe(3)
  expect(st.trips).toBe(1)
  expect(progressOf(st, today)).toEqual({ done: 2, isToday: true, total: 3, dayNumber: 3 })
  expect(statsFor(new Map(), 'nope').dates).toEqual([])
})

test('spotlights what is on now, then what is next, then what just finished', () => {
  const live = P('live', '2026-11-20', '2026-11-30')
  const soon = P('soon', '2026-12-21', '2027-01-01')
  const later = P('later', '2027-02-15', '2027-02-19')
  const done = P('done', '2026-10-26', '2026-10-30')
  const older = P('older', '2026-07-22', '2026-08-28')
  const r = arrangeProjects([older, later, done, soon, live], today)
  expect(r.spotlight).toBe(live)
  expect(r.sections.map(s => [s.key, s.list.map(p => p.id)])).toEqual([
    ['upcoming', ['soon', 'later']],
    ['finished', ['done', 'older']],
  ])
  expect(arrangeProjects([later, soon], today).spotlight).toBe(soon)
  expect(arrangeProjects([older, done], today).spotlight).toBe(done)
  expect(arrangeProjects([], today)).toEqual({ spotlight: null, sections: [] })
})

test('adds up what has been delivered, not what is still to come', () => {
  const stats = buildProjectStats(
    [{ id: 's1', project_id: 'a', session_date: '2026-11-24', session_type: 'trip' }, { id: 's2', project_id: 'a', session_date: '2026-12-01', session_type: 'trip' }],
    [{ session_id: 's1', child_id: 'k1', status: 'signed_out' }],
  )
  expect(togetherSoFar([P('a', '2026-11-24', '2026-12-01')], stats, today)).toEqual({ children: 1, checkIns: 1, days: 1, trips: 1, delivered: 1 })
})

test('offers the first school holiday no project covers yet', () => {
  const hols = [{ key: 'x', start_date: '2026-12-21', end_date: '2027-01-01' }, { key: 'y', start_date: '2027-02-15', end_date: '2027-02-19' }]
  expect(unplannedHoliday(hols, [])).toBe(hols[0])
  expect(unplannedHoliday(hols, [P('a', '2026-12-22', '2026-12-24')])).toBe(hols[1])
  expect(unplannedHoliday(hols, [P('a', '2026-12-22', '2026-12-24', { status: 'cancelled' })])).toBe(hols[0])
})

test('says when in words', () => {
  expect(relativeDays(0)).toBe('today')
  expect(relativeDays(1)).toBe('tomorrow')
  expect(relativeDays(5)).toBe('in 5 days')
  expect(relativeDays(25)).toBe('in 4 weeks')
  expect(relativeDays(-3)).toBe('3 days ago')
})

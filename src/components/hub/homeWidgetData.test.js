import { weekStrip, nextSession, countdownParts, birthdaysSoon, comingUp, weeklyArrivals } from './homeWidgetData'

const s = (over) => ({ id: Math.random().toString(36).slice(2), session_type: 'activity', status: 'scheduled', ...over })

test('this week runs Monday to Sunday and counts what is on, multi-day trips included', () => {
  const week = weekStrip([
    s({ session_date: '2026-11-18', start_time: '16:00:00' }),
    s({ session_date: '2026-11-18', start_time: '18:00:00', status: 'draft' }),
    s({ session_date: '2026-11-21', end_date: '2026-11-23', session_type: 'residential' }),
  ], '2026-11-20')
  expect(week.map(d => d.dow)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  expect(week[0].iso).toBe('2026-11-16')
  expect(week[2].count).toBe(1) // the draft is not counted
  expect(week[4].isToday).toBe(true)
  expect(week[5].count).toBe(1)
  expect(week[6].count).toBe(1) // day 2 of the residential
  expect(week[5].kinds).toEqual(['trip'])
})

test('the next session is the next one still to start, with minutes to go', () => {
  const sessions = [
    s({ id: 'running', session_date: '2026-11-20', start_time: '17:00:00' }),
    s({ id: 'later', session_date: '2026-11-20', start_time: '19:30:00' }),
    s({ id: 'tomorrow', session_date: '2026-11-21', start_time: '10:00:00' }),
    s({ id: 'cancelled', session_date: '2026-11-20', start_time: '18:30:00', cancelled_at: '2026-11-19T00:00:00Z' }),
  ]
  expect(nextSession(sessions, '2026-11-20T18:00')).toEqual({ session: sessions[1], minutes: 90 })
  // Skipping today, for when today's sessions already have their own cards.
  expect(nextSession(sessions, '2026-11-20T18:00', { after: '2026-11-20' }).session.id).toBe('tomorrow')
  expect(nextSession([], '2026-11-20T18:00')).toBeNull()
})

test('the countdown uses the units that matter', () => {
  expect(countdownParts(45)).toEqual([[45, 'min']])
  expect(countdownParts(200)).toEqual([[3, 'hours'], [20, 'min']])
  expect(countdownParts(1440 + 60)).toEqual([[1, 'day'], [1, 'hour']])
})

test('birthdays in the next week, soonest first, with the age they turn', () => {
  const people = [
    { first_name: 'Amara', date_of_birth: '2014-11-22' },
    { first_name: 'Kai', date_of_birth: '2012-11-20' },
    { first_name: 'Mia', date_of_birth: '2013-12-25' },
    { first_name: 'Leap', date_of_birth: '2012-02-29' },
    { first_name: 'Nobody' },
  ]
  const soon = birthdaysSoon(people, '2026-11-20')
  expect(soon.map(b => [b.person.first_name, b.date, b.age, b.isToday])).toEqual([
    ['Kai', '2026-11-20', 14, true],
    ['Amara', '2026-11-22', 12, false],
  ])
  // Across the new year, and a leap-day birthday in a non-leap year.
  expect(birthdaysSoon(people, '2026-12-28', 7)).toEqual([])
  expect(birthdaysSoon(people, '2027-02-25', 7).map(b => [b.person.first_name, b.date])).toEqual([['Leap', '2027-02-28']])
})

test('coming up: the next school holiday and idea day', () => {
  const next = comingUp('2026-11-20')
  expect(next.holiday.label).toBe('Christmas holidays')
  expect(next.holiday.inDays).toBe(31)
  expect(next.holiday.now).toBe(false)
  expect(next.idea).toEqual({ date: '2026-12-25', name: 'Christmas Day', inDays: 35 })
  expect(comingUp('2026-12-23').holiday.now).toBe(true)
})

test('arrivals per week, oldest first, only people who actually came', () => {
  const sessions = [{ id: 'a', session_date: '2026-11-18' }, { id: 'b', session_date: '2026-11-10' }, { id: 'c', session_date: '2026-11-25' }]
  const weeks = weeklyArrivals([
    { session_id: 'a', status: 'signed_in' }, { session_id: 'a', status: 'signed_out' }, { session_id: 'a', status: 'absent' },
    { session_id: 'b', status: 'signed_out' }, { session_id: 'c', status: 'signed_in' },
  ], sessions, '2026-11-20', 3)
  expect(weeks).toEqual([
    { weekStart: '2026-11-02', count: 0 },
    { weekStart: '2026-11-09', count: 1 },
    { weekStart: '2026-11-16', count: 2 },
  ])
})

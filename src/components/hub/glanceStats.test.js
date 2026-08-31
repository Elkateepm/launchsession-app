import { monthAttendance, reachedThisMonth } from './glanceStats'

const TODAY = '2026-08-31'

// Shaped like Solidarity Sports in August: sessions inside the month, one from
// July that must not be counted, and a register with unmarked places on it.
const sessions = [
  { id: 's1', session_date: '2026-08-05' },
  { id: 's2', session_date: '2026-08-20' },
  { id: 's3', session_date: '2026-07-28' },   // last month
  { id: 's4', session_date: '2026-09-10' },   // not yet
]
const att = (session_id, child_id, status) => ({ session_id, child_id, status })

describe('attendance for the month', () => {
  it('is present out of the places somebody marked', () => {
    const rows = [
      att('s1', 'a', 'signed_in'), att('s1', 'b', 'signed_out'), att('s1', 'c', 'absent'),
    ]
    // 2 present of 3 marked.
    expect(monthAttendance(sessions, rows, TODAY).rate).toBe(67)
  })

  it('does not count an unmarked place as an absence', () => {
    // The regression in the sparkline: dividing by every row dragged the rate
    // down by however many registers nobody finished.
    const rows = [
      att('s1', 'a', 'signed_in'), att('s1', 'b', 'signed_in'),
      att('s1', 'c', 'expected'), att('s1', 'd', null),
    ]
    expect(monthAttendance(sessions, rows, TODAY).rate).toBe(100)
  })

  it('ignores sessions outside the month', () => {
    const rows = [
      att('s1', 'a', 'signed_in'),
      att('s3', 'b', 'absent'),   // July
      att('s4', 'c', 'absent'),   // September
    ]
    const m = monthAttendance(sessions, rows, TODAY)
    expect(m.marked).toBe(1)
    expect(m.rate).toBe(100)
  })

  it('has no rate at all when nothing was marked, rather than zero', () => {
    // Zero per cent is a verdict on a month; no marked register is the absence
    // of one, and the card shows a dash for it.
    expect(monthAttendance(sessions, [att('s1', 'a', 'expected')], TODAY).rate).toBeNull()
    expect(monthAttendance(sessions, [], TODAY).rate).toBeNull()
  })

  it('is not divided by the size of the register', () => {
    // The bug this replaced: today's sign-ins over everyone on the roll, so an
    // organisation with 54 on the register and 12 in today could not score
    // above 22% however well the session went. Here everyone marked was
    // present, so the rate is 100 regardless of how many people exist.
    const rows = [att('s1', 'a', 'signed_in'), att('s1', 'b', 'signed_in')]
    expect(monthAttendance(sessions, rows, TODAY).rate).toBe(100)
  })
})

describe('people reached this month', () => {
  it('counts a person once however often they came', () => {
    const rows = [
      att('s1', 'a', 'signed_in'), att('s2', 'a', 'signed_in'), att('s2', 'b', 'signed_out'),
    ]
    expect(reachedThisMonth(sessions, rows, TODAY)).toBe(2)
  })

  it('does not count somebody who was marked absent', () => {
    const rows = [att('s1', 'a', 'signed_in'), att('s1', 'b', 'absent')]
    expect(reachedThisMonth(sessions, rows, TODAY)).toBe(1)
  })

  it('does not count somebody who only came last month', () => {
    const rows = [att('s3', 'a', 'signed_in')]
    expect(reachedThisMonth(sessions, rows, TODAY)).toBe(0)
  })

  it('is nobody when nobody came', () => {
    expect(reachedThisMonth(sessions, [], TODAY)).toBe(0)
  })
})

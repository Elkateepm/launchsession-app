import { registerPhase, sessionEndAt, staffOnSite, ratioCheck, requiredRatio } from './registerState'

const base = { session_date: '2026-10-11', start_time: '09:00', end_time: '16:00', opened_at: null, register_opened_at: null, closed_at: null }

describe('sessionEndAt', () => {
  it('ignores a stray end_date before the session date (Thrope park, 11 Oct)', () => {
    expect(sessionEndAt({ ...base, end_date: '2026-09-29' })).toBe('2026-10-11T16:00')
  })
  it('uses a later end_date for a trip', () => {
    expect(sessionEndAt({ ...base, end_date: '2026-10-13' })).toBe('2026-10-13T16:00')
  })
  it('rolls an evening past midnight onto the next day', () => {
    expect(sessionEndAt({ ...base, start_time: '20:00', end_time: '01:00' })).toBe('2026-10-12T01:00')
  })
})

describe('registerPhase', () => {
  it('is register open, not ending, at 12:43 on a 09:00-16:00 session with a stray end_date and nobody pressed Start', () => {
    expect(registerPhase({ ...base, end_date: '2026-09-29' }, '2026-10-11T12:43')).toBe('register_open')
  })
  it('opens the register 30 minutes before the start', () => {
    expect(registerPhase(base, '2026-10-11T08:29')).toBe('upcoming')
    expect(registerPhase(base, '2026-10-11T08:30')).toBe('register_open')
  })
  it('is live once started, ending in the last 15 minutes and after', () => {
    const started = { ...base, opened_at: '2026-10-11T08:55:00Z' }
    expect(registerPhase(started, '2026-10-11T12:43')).toBe('live')
    expect(registerPhase(started, '2026-10-11T15:45')).toBe('ending')
    expect(registerPhase(started, '2026-10-11T17:00')).toBe('ending')
  })
  it('is closed once closed', () => {
    expect(registerPhase({ ...base, opened_at: 'x', closed_at: 'y' }, '2026-10-11T12:00')).toBe('closed')
  })
})

describe('team and ratio', () => {
  const lead = { signed_in_at: null, signed_out_at: null }
  it('does not count someone who is only on the rota', () => {
    expect(staffOnSite([lead])).toBe(0)
    expect(ratioCheck({ childrenOnSite: 12, staffRows: [lead], session: base, org: {} })).toMatchObject({ kind: 'no_staff' })
  })
  it('does not count someone who has signed out', () => {
    expect(staffOnSite([{ signed_in_at: 'a', signed_out_at: 'b' }])).toBe(0)
  })
  it('warns over the ratio and is quiet within it', () => {
    const inn = { signed_in_at: 'a', signed_out_at: null }
    expect(ratioCheck({ childrenOnSite: 12, staffRows: [inn], session: base, org: {} })).toMatchObject({ kind: 'over', current: 12, required: 8 })
    expect(ratioCheck({ childrenOnSite: 8, staffRows: [inn], session: base, org: {} })).toBeNull()
    expect(ratioCheck({ childrenOnSite: 0, staffRows: [], session: base, org: {} })).toBeNull()
  })
  it('reads a session ratio like 1:6', () => {
    expect(requiredRatio({ staff_ratio: '1:6' }, {})).toBe(6)
  })
})

import { absenceOnDate, checkCount, filterPeople, needsOnboarding, readAll } from './hrWorkspaceData'

jest.mock('../../lib/supabase', () => ({ supabase: {} }))

test('cancelled leave is never counted and an ongoing absence continues without an end date', () => {
  const row = { start_date: '2026-09-10', end_date: null, status: 'ongoing' }
  expect(absenceOnDate(row, '2026-09-15')).toBe(true)
  expect(absenceOnDate({ ...row, status: 'recorded' }, '2026-09-15')).toBe(false)
  expect(absenceOnDate({ ...row, status: 'cancelled' }, '2026-09-10')).toBe(false)
  expect(absenceOnDate({ ...row, end_date: '2026-09-14' }, '2026-09-15')).toBe(false)
})

test('a missing checklist is unfinished onboarding, not a completed induction', () => {
  const person = { is_active: true, employment_status: 'active' }
  expect(needsOnboarding(person, null)).toBe(true)
  expect(needsOnboarding(person, { total: 0, required_outstanding: 0 })).toBe(true)
  expect(needsOnboarding(person, { total: 4, required_outstanding: 0 })).toBe(false)
  expect(needsOnboarding({ ...person, employment_status: 'left' }, null)).toBe(false)
})

test('due-soon checks need review and missing summaries remain unknown', () => {
  expect(checkCount(null)).toBeNull()
  expect(checkCount({ overdue: 1, missing: 2, due_soon: 3 })).toBe(6)
  const people = [{ id: 'v', full_name: 'Jamie River', employment_type: 'volunteer', employment_status: 'active' }, { id: 'left', full_name: 'Former Person', employment_status: 'left' }]
  expect(filterPeople(people, 'checks', '', { v: { due_soon: 1 } }).map(p => p.id)).toEqual(['v'])
  expect(filterPeople(people, 'volunteer', 'jamie').map(p => p.id)).toEqual(['v'])
  expect(filterPeople(people, 'all', '').map(p => p.id)).toEqual(['v'])
  expect(filterPeople(people, 'former', '').map(p => p.id)).toEqual(['left'])
})

test('directories continue beyond a full API page without losing rows', async () => {
  const all = Array.from({ length: 501 }, (_, id) => ({ id }))
  const range = jest.fn(async (start, end) => ({ data: all.slice(start, end + 1), error: null }))
  await expect(readAll(() => ({ range }))).resolves.toHaveLength(501)
  expect(range.mock.calls).toEqual([[0, 499], [500, 999]])
})

test('a later failed page does not masquerade as a complete directory', async () => {
  const range = jest.fn().mockResolvedValueOnce({ data: Array(500).fill({ id: 'x' }) }).mockResolvedValueOnce({ error: new Error('Offline') })
  await expect(readAll(() => ({ range }))).rejects.toThrow('Offline')
})

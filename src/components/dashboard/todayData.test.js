import { loadTodayData } from './todayData'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../lib/today', () => ({ todayInLondon: () => '2026-10-09', londonDayOffset: () => '2026-10-16' }))

let queries
function mockTables(results) {
  queries = []
  supabase.from.mockImplementation(table => {
    const q = { table, then: (resolve, reject) => Promise.resolve(results[table] || { data: [] }).then(resolve, reject) }
    for (const method of ['select', 'eq', 'in', 'lte', 'or', 'order']) q[method] = jest.fn(() => q)
    queries.push(q)
    return q
  })
}

beforeEach(() => mockTables({ sessions: { data: [{ id: 's1', session_date: '2026-10-09' }] } }))

test('every request is scoped and attendance only loads for today’s delivery IDs', async () => {
  await loadTodayData('org-1', { schedule: true, registers: true, planner: true, hr: true })
  for (const q of queries) expect(q.eq).toHaveBeenCalledWith('org_id', 'org-1')
  expect(queries.find(q => q.table === 'sessions').or).toHaveBeenCalledWith('session_date.gte.2026-10-09,end_date.gte.2026-10-09')
  for (const table of ['attendance', 'session_staff']) expect(queries.find(q => q.table === table).in).toHaveBeenCalledWith('session_id', ['s1'])
  expect(queries.some(q => q.table === 'children')).toBe(false)
})

test('does not query modules the viewer cannot use', async () => {
  await loadTodayData('org-1', { schedule: true })
  expect(queries.map(q => q.table)).toEqual(['sessions'])
})

test('partial query failures are not presented as zero people or no staff', async () => {
  mockTables({ sessions: { data: [{ id: 's1', session_date: '2026-10-09' }] }, attendance: { error: { message: 'Offline' } }, session_staff: { error: { message: 'Offline' } } })
  const result = await loadTodayData('org-1', { schedule: true, registers: true, planner: true })
  expect(result.sessions).toHaveLength(1)
  expect(result.attendance).toBeNull()
  expect(result.staff).toBeNull()
  expect(result.errors).toEqual(['attendance', 'staffing'])
})

test('a failed schedule does not produce an empty day or trigger dependent reads', async () => {
  mockTables({ sessions: { error: { message: 'Offline' } } })
  const result = await loadTodayData('org-1', { schedule: true, registers: true, planner: true })
  expect(result.sessions).toBeNull()
  expect(result.errors).toEqual(['schedule'])
  expect(queries.map(q => q.table)).toEqual(['sessions'])
})

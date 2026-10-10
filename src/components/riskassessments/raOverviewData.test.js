import { loadRiskOperational } from './raOverviewData'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
const queries = {}
const results = {}
beforeEach(() => {
  jest.clearAllMocks()
  Object.keys(results).forEach(k => delete results[k])
  supabase.from.mockImplementation(table => {
    const q = {}
    ;['select', 'eq', 'gte', 'is', 'or', 'order', 'limit'].forEach(method => { q[method] = jest.fn(() => q) })
    q.then = (resolve, reject) => Promise.resolve(results[table] || { data: [] }).then(resolve, reject)
    queries[table] = q
    return q
  })
})

test('scopes every read and checks exactly forty eligible upcoming activities', async () => {
  results.sessions = { data: Array.from({ length: 41 }, (_, i) => ({ id: i })) }
  results.risk_controls = { data: [{ hazard_id: 'h1', risk_assessment_hazards: { assessment_id: 'a' } }, { hazard_id: 'h1', risk_assessment_hazards: { assessment_id: 'a' } }] }
  const data = await loadRiskOperational('org1')
  Object.values(queries).forEach(q => expect(q.eq).toHaveBeenCalledWith('org_id', 'org1'))
  expect(queries.sessions.is).toHaveBeenCalledWith('cancelled_at', null)
  expect(queries.sessions.is).toHaveBeenCalledWith('closed_at', null)
  expect(queries.sessions.or).toHaveBeenCalledWith('status.is.null,status.not.in.(cancelled,draft,completed)')
  expect(queries.sessions.limit).toHaveBeenCalledWith(41)
  expect(data.sessions).toHaveLength(40)
  expect(data.truncated).toBe(true)
  expect(data.outstanding).toEqual({ a: 2 })
})

test('failed checks are explicitly reported, and exactly forty rows is not truncated', async () => {
  results.sessions = { data: Array.from({ length: 40 }, (_, i) => ({ id: i })) }
  results.risk_assessment_sessions = { error: { message: 'Denied' } }
  results.risk_controls = { error: { message: 'Unavailable' } }
  const data = await loadRiskOperational('org1')
  expect(data.errors).toEqual(['assessment links', 'controls'])
  expect(data.truncated).toBe(false)
  expect(data.links).toEqual([])
})

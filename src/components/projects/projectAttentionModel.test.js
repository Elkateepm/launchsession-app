import { buildProjectAttention, attentionDestination } from './projectAttentionModel'

const now = new Date('2026-10-10T12:00:00Z')
const day = (id, extra = {}) => ({ id, session_date: '2026-10-26', title: `Project — Day ${id}`, risk_assessment_required: true, ...extra })

test('keeps every action, orders safety first and ignores cancelled days', () => {
  const days = Array.from({ length: 10 }, (_, i) => day(String(i)))
  days.push(day('cancelled', { status: 'cancelled' }), day('cancelled-at', { cancelled_at: '2026-10-01' }))
  days.push(day('finished', { closed_at: '2026-10-09', session_date: '2026-10-09' }))
  const items = buildProjectAttention(days, [{ session_id: 'finished', status: null }], {}, {}, now)
  expect(items).toHaveLength(12)
  expect(items.slice(0, 10).every(i => i.kind === 'safety')).toBe(true)
  expect(items[10]).toMatchObject({ kind: 'register', reason: 'unmarked', count: 1 })
  expect(items[11].kind).toBe('reflection')
})

test('missing query results do not invent missing risk links, reflections or attendance', () => {
  expect(buildProjectAttention([day('next'), day('done', { closed_at: '2026-10-09' })], null, null, null, now)).toEqual([])
  expect(buildProjectAttention([day('next')], [], {}, { next: true }, now)).toEqual([])
})

test('London date and multi-day delivery determine which registers need closing', () => {
  const days = [day('yesterday', { session_date: '2026-10-09' }), day('residential', { session_date: '2026-10-09', end_date: '2026-10-12', session_type: 'residential' }), day('draft', { session_date: '2026-10-09', status: 'draft' })]
  const items = buildProjectAttention(days, [], {}, null, new Date('2026-10-09T23:30:00Z'))
  expect(items.map(i => i.day.id)).toEqual(['yesterday'])
})

test('each check opens its actual workflow with project return context for registers', () => {
  expect(attentionDestination({ kind: 'register', day: { id: 'd1' } }, 'p1')).toEqual(['registers', { sessionId: 'd1', returnTo: 'projects', projectId: 'p1' }])
  expect(attentionDestination({ kind: 'safety', day: { id: 'd1' } }, 'p1')).toEqual(['planner', { editSessionId: 'd1' }])
  expect(attentionDestination({ kind: 'reflection', day: { id: 'd1' } }, 'p1')).toEqual(['planner', { reflectSessionId: 'd1' }])
})

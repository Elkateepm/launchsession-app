import { buildNeeds, monthTiles, recentActivity, money } from './officeHub'

const all = ['forms', 'newsletter', 'payments', 'resource_booking', 'hr'].map(tab => ({ tab }))
const today = '2026-11-26'
const now = new Date('2026-11-26T12:00:00Z')

test('money', () => {
  expect(money(12)).toBe('£12')
  expect(money(12.5)).toBe('£12.50')
  expect(money(1234)).toBe('£1,234')
})

test('needs: real jobs from every tool, most urgent first', () => {
  const needs = buildNeeds({
    unread: [{ created_at: '2026-11-26T11:00:00Z', org_forms: { name: 'Trip consent' } }, { created_at: '2026-11-25T10:00:00Z', org_forms: { name: 'Feedback' } }],
    forms: [{ name: 'Christmas sign-up', closing_date: '2026-11-28' }, { name: 'Old', closing_date: '2026-11-01' }],
    charges: [
      { computed_status: 'unpaid', remaining: 20, due_date: '2026-11-20' },
      { computed_status: 'part_paid', remaining: 5.5, due_date: '2026-11-30' },
      { computed_status: 'unpaid', remaining: 0, due_date: '2026-11-01' },
    ],
    checkouts: [{ expected_return_at: '2026-11-25T12:00:00Z', returned_at: null }],
    bookings: [{ status: 'pending' }],
    hr: { count: 3, urgent: 0 },
    newsletters: [{ status: 'draft', subject: 'December news' }],
  }, { tabs: all, today, now })
  expect(needs.map(n => n.key)).toEqual(['replies', 'overdue', 'returns', 'closing', 'due', 'approve', 'hr', 'drafts'])
  expect(needs[0]).toMatchObject({ title: '2 new form replies', tab: 'forms' })
  expect(needs[0].detail).toMatch(/Trip consent, Feedback. Newest 1 hour ago/)
  expect(needs.find(n => n.key === 'overdue').title).toBe('£20 overdue')
  expect(needs.find(n => n.key === 'due').title).toBe('£5.50 due this week')
  expect(needs.find(n => n.key === 'closing').title).toBe('"Christmas sign-up" closes in 2 days')
  expect(needs.find(n => n.key === 'drafts').detail).toBe('"December news"')
})

test('needs: hidden tools and missing data say nothing', () => {
  expect(buildNeeds({ charges: [{ computed_status: 'unpaid', remaining: 9, due_date: '2026-01-01' }] }, { tabs: [{ tab: 'forms' }], today, now })).toEqual([])
  expect(buildNeeds({}, { tabs: all, today, now })).toEqual([])
})

test('this month: tiles only for tools with data', () => {
  const tiles = monthTiles({
    repliesThisMonth: 7,
    newsletters: [{ status: 'sent', sent_at: '2026-11-10T09:00:00Z', sent_count: 120 }, { status: 'sent', sent_at: '2026-10-10T09:00:00Z', sent_count: 99 }],
    transactions: [{ amount: 10, payment_date: '2026-11-02' }, { amount: 2.5, created_at: '2026-11-20T10:00:00Z' }],
    bookings: [{ status: 'confirmed', start_time: '2026-11-27T10:00:00Z' }, { status: 'cancelled', start_time: '2026-11-27T10:00:00Z' }, { status: 'confirmed', start_time: '2026-12-10T10:00:00Z' }],
  }, { tabs: all, monthStart: '2026-11-01T00:00:00Z', today })
  expect(tiles.map(t => [t.key, t.value])).toEqual([['replies', '7'], ['sent', '1'], ['money', '£12.50'], ['bookings', '1']])
  expect(tiles[1].hint).toBe('120 emails delivered')
  expect(monthTiles({}, { tabs: all, monthStart: '2026-11-01T00:00:00Z', today })).toEqual([])
})

test('recent: newest first across tools, names for bookings', () => {
  const items = recentActivity({
    recentReplies: [{ created_at: '2026-11-26T10:00:00Z', submitted_name: 'Amina', org_forms: { name: 'Trip consent' } }],
    newsletters: [{ status: 'sent', sent_at: '2026-11-25T09:00:00Z', subject: 'News', sent_count: 1 }],
    transactions: [{ amount: 15, created_at: '2026-11-26T11:00:00Z' }],
    recentBookings: [{ resource_id: 'r1', created_at: '2026-11-24T09:00:00Z' }],
  }, { tabs: all, resourceNames: { r1: 'Minibus' } })
  expect(items.map(i => i.text)).toEqual(['£15 payment recorded', 'Amina replied to Trip consent', '"News" sent to 1 person', 'Minibus booked'])
})

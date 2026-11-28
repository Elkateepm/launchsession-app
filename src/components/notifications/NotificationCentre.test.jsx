import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationCentre from './NotificationCentre'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
jest.mock('../settings/Settings', () => ({ NotificationsSection: () => <div>Alert settings panel</div> }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))

const now = new Date().toISOString()
const rows = [
  { id: 'n1', user_id: 'u1', category: 'safeguarding', priority: 'critical', title: 'Action required', body: 'A concern needs review', target_url: '/?tab=safeguarding', created_at: now, read_at: null },
  { id: 'n2', user_id: 'u1', category: 'sessions', priority: 'normal', title: 'Session updated', body: '"Football" has been updated.', target_url: '/?tab=registers&session=s1', created_at: now, read_at: null },
  { id: 'n3', user_id: 'u1', category: 'messaging', priority: 'normal', title: 'New message', body: 'Hi', target_url: '/?tab=messaging', created_at: now, read_at: now },
]
let updates
beforeEach(() => {
  updates = []
  supabase.from.mockImplementation(() => {
    const q = {}
    let isCount = false
    let patch = null
    const filters = []
    q.select = (_c, opts) => { if (opts?.head) isCount = true; return q }
    for (const m of ['eq', 'order', 'range', 'in']) q[m] = (...a) => { filters.push([m, ...a]); return q }
    q.is = (...a) => { filters.push(['is', ...a]); return q }
    q.update = p => { patch = p; return q }
    q.then = resolve => {
      if (patch) { updates.push({ patch, filters }); return Promise.resolve({ error: null }).then(resolve) }
      if (isCount) return Promise.resolve({ count: rows.filter(r => !r.read_at).length, error: null }).then(resolve)
      return Promise.resolve({ data: rows, error: null }).then(resolve)
    }
    return q
  })
})

const render_ = (props = {}) => render(<NotificationCentre org={{ id: 'o1', primary_color: '#123456' }} session={{ user: { id: 'u1' } }} onNavigate={() => {}} {...props} />)

test('shows the unread total and filters to urgent', async () => {
  render_()
  expect(await screen.findByText('2 unread · 1 urgent')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Urgent' }))
  expect(screen.getByText('Action required')).toBeInTheDocument()
  expect(screen.queryByText('Session updated')).not.toBeInTheDocument()
})

test('mark all read clears every unread on the server, not just the rows loaded', async () => {
  render_()
  fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }))
  await waitFor(() => expect(updates).toHaveLength(1))
  expect(updates[0].filters).toEqual(expect.arrayContaining([['eq', 'user_id', 'u1'], ['is', 'read_at', null]]))
  expect(await screen.findByText('You are all caught up.')).toBeInTheDocument()
})

test('tapping a notification marks it read and opens what it is about', async () => {
  const onNavigate = jest.fn()
  render_({ onNavigate })
  fireEvent.click(await screen.findByRole('button', { name: /Session updated/ }))
  expect(onNavigate).toHaveBeenCalledWith('registers', { sessionId: 's1' })
  await waitFor(() => expect(updates[0].filters).toEqual([['in', 'id', ['n2']]]))
})

test('alert and device settings are available to every member', async () => {
  render_()
  fireEvent.click(await screen.findByRole('tab', { name: 'Alerts & devices' }))
  expect(screen.getByText('Alert settings panel')).toBeInTheDocument()
})

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { VolunteerDashboard } from './VolunteerPortal'
import VPHours from './VPHours'
import VPQuickActionMenu from './VPQuickActionMenu'
import { supabase } from '../../lib/supabase'
import { todayInLondon } from '../../lib/today'

jest.mock('../../lib/supabase', () => ({ supabase: {
  from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(),
  auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) },
} }))
jest.mock('../../lib/useRealtimeTable', () => ({ useRealtimeTable: () => {} }))
jest.mock('./VPMessages', () => () => <p>Messages</p>)
jest.mock('../registers/LiveRegister', () => ({ userRole }) => <p>Live register as {userRole}</p>)

const org = { id: 'o1', slug: 'riverside', name: 'Riverside Youth Club', primary_color: '#0E7C86', secondary_color: '#F6B44B', branding_enabled: true }
const user = { id: 'v1', email: 'priya@example.org' }
const profile = { id: 'v1', full_name: 'Priya Shah', first_name: 'Priya', role: 'volunteer' }
const today = todayInLondon()

let tables
let writes
beforeEach(() => {
  writes = []
  window.location.hash = ''
  tables = {
    sessions: [{ id: 's1', org_id: 'o1', title: 'Saturday multi-sports', session_date: '2099-01-03', start_time: '10:00:00', end_time: '13:00:00', location: 'Sports Hall', volunteer_limit: 4, status: 'scheduled' }],
    session_staff: [],
    announcements: [],
  }
  supabase.from.mockImplementation(table => {
    const q = { then: (res, rej) => Promise.resolve({ data: tables[table] || [], error: null }).then(res, rej) }
    for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit', 'is']) q[m] = () => q
    for (const m of ['insert', 'delete', 'update']) q[m] = payload => { writes.push({ table, op: m, payload }); return q }
    return q
  })
})

test('the portal opens on Today, in the organisation’s name, with five tabs within reach', async () => {
  render(<VolunteerDashboard user={user} profile={profile} org={org} onSignOut={() => {}} />)
  expect(await screen.findByRole('heading', { name: /Priya/ })).toBeInTheDocument()
  expect(screen.getAllByText('Riverside Youth Club')[0]).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Volunteer portal' })
  expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Today', 'Sessions', 'Hours', 'Messages', 'Me'])
  expect(within(nav).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(within(nav).getByRole('button', { name: 'Hours' }))
  expect(await screen.findByRole('heading', { name: 'Your hours' })).toBeInTheDocument()
  expect(window.location.hash).toBe('#hours')
})

test('booking puts the volunteer on the session’s team, without the column that used to break it', async () => {
  render(<VolunteerDashboard user={user} profile={profile} org={org} onSignOut={() => {}} />)
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button', { name: 'Sessions' }))
  expect(await screen.findByText('4 of 4 volunteer places left')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Book' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0]).toEqual({ table: 'session_staff', op: 'insert', payload: { session_id: 's1', user_id: 'v1', org_id: 'o1', role: 'volunteer' } })
  expect(await screen.findByText(/You are down to help at Saturday multi-sports/)).toBeInTheDocument()
})

test('the Hours tab counts register time, ticks while signed in, and explains where it comes from', () => {
  const signedIn = new Date(Date.now() - 95 * 60000).toISOString()
  const sessionsById = {
    past: { id: 'past', title: 'Holiday camp', session_date: '2026-08-04', start_time: '10:00', end_time: '15:00' },
    now: { id: 'now', title: 'Thursday youth club', session_date: today, start_time: '00:00', end_time: '23:59' },
  }
  const teamRows = [
    { id: 'r1', session_id: 'past', signed_in_at: '2026-08-04T09:00:00Z', signed_out_at: '2026-08-04T14:00:00Z' },
    { id: 'r2', session_id: 'now', signed_in_at: signedIn },
  ]
  render(<VPHours org={org} profile={profile} teamRows={teamRows} sessionsById={sessionsById} />)
  expect(screen.getByRole('status')).toHaveTextContent('Signed in at Thursday youth club')
  expect(screen.getByRole('status')).toHaveTextContent('1h 35m')
  expect(screen.getByText('Holiday camp')).toBeInTheDocument()
  // August's total and the session itself.
  expect(screen.getAllByText('5h')).toHaveLength(2)
  expect(screen.getByText(/signs you in on the register until they sign you out/)).toBeInTheDocument()
  expect(screen.getByText(/Priya Shah has volunteered 6.6 hours with Riverside Youth Club across 2 sessions/)).toBeInTheDocument()
})

test('with no register time yet, the Hours tab says how to start', () => {
  const onNavigate = jest.fn()
  render(<VPHours org={org} profile={profile} teamRows={[{ id: 'r1', session_id: 's1' }]} sessionsById={{}} onNavigate={onNavigate} />)
  expect(screen.getByText('No hours yet')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Find a session' }))
  expect(onNavigate).toHaveBeenCalledWith('sessions')
})

test('a concern goes to the safeguarding lead’s log, not into case management', async () => {
  render(<VPQuickActionMenu open forceModal="concern" onClose={() => {}} org={org} user={user} profile={profile} todaySession={{ id: 's1', location: 'Sports Hall' }} />)
  expect(screen.getByText('If a child is in immediate danger, call 999 now.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('What did you see or hear?'), { target: { value: 'Said something worrying at pick-up.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to the safeguarding lead' }))
  expect(await screen.findByText('Sent to your safeguarding lead')).toBeInTheDocument()
  expect(writes).toHaveLength(1)
  expect(writes[0].table).toBe('cause_for_concern')
  expect(writes[0].payload).toMatchObject({ org_id: 'o1', submitted_by: 'v1', submitter_name: 'Priya Shah', submitter_role: 'Volunteer', child_name: 'Not named', description: 'Said something worrying at pick-up.', location: 'Sports Hall', session_id: 's1', status: 'open' })
})

test('the quick actions no longer let a volunteer type in their own hours', () => {
  render(<VPQuickActionMenu open onClose={() => {}} org={org} user={user} profile={profile} todaySession={null} />)
  const dialog = screen.getByRole('dialog', { name: 'Quick actions' })
  expect(within(dialog).queryByText(/Log hours/i)).not.toBeInTheDocument()
  // Register actions need a session today.
  expect(within(dialog).queryByText('Open today’s register')).not.toBeInTheDocument()
  expect(within(dialog).getByText('Raise a concern')).toBeInTheDocument()
})

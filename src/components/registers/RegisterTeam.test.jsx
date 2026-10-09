import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RegisterTeam from './RegisterTeam'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

let updates
beforeEach(() => {
  updates = []
  supabase.from.mockImplementation(table => {
    const q = { then: (res, rej) => Promise.resolve({ data: null, error: null }).then(res, rej) }
    q.eq = () => q
    q.update = patch => { updates.push({ table, patch }); return q }
    return q
  })
})

// Closed in summer: London times are an hour ahead of UTC.
const session = { id: 's1', session_date: '2026-07-01', start_time: '18:00:00', end_time: '20:00:00', closed_at: '2026-07-01T19:30:00Z' }
const people = { v1: { full_name: 'Priya Shah', role: 'volunteer' }, u1: { full_name: 'Sam Taylor', role: 'staff' } }

test('a closed register shows what each person counted, and the volunteer time', () => {
  const rows = [
    { id: 'a', session_id: 's1', user_id: 'v1', role: 'volunteer', signed_in_at: '2026-07-01T16:50:00Z', signed_out_at: '2026-07-01T19:05:00Z' },
    { id: 'b', session_id: 's1', user_id: 'u1', role: 'lead' },
  ]
  render(<RegisterTeam session={session} staffRows={rows} people={people} closed canManage />)
  expect(screen.getByRole('region', { name: /Team/ })).toHaveTextContent('1 of 2 came')
  expect(screen.getByText('Volunteer time 2h 15m')).toBeInTheDocument()
  expect(screen.getByText('17:50 to 20:05')).toBeInTheDocument()
  expect(screen.getByText('Did not sign in')).toBeInTheDocument()
  // No "sign in now" once closed: that would stamp today over the real time.
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
})

test('fixing the times after the session saves London times on the session’s date', async () => {
  const onChanged = jest.fn()
  render(<RegisterTeam session={session} staffRows={[{ id: 'b', session_id: 's1', user_id: 'u1', role: 'lead' }]} people={people} closed canManage onChanged={onChanged} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit times' }))
  fireEvent.change(screen.getByLabelText('Arrived'), { target: { value: '17:45' } })
  fireEvent.change(screen.getByLabelText('Left'), { target: { value: '17:30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save times' }))
  expect(screen.getByRole('alert')).toHaveTextContent('They have to leave after they arrive.')
  fireEvent.change(screen.getByLabelText('Left'), { target: { value: '20:10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save times' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(updates[0]).toEqual({ table: 'session_staff', patch: { signed_in_at: '2026-07-01T16:45:00.000Z', signed_out_at: '2026-07-01T19:10:00.000Z' } })
})

test('back from a break keeps the first sign-in time', async () => {
  const live = { ...session, closed_at: null, session_date: '2099-07-01' }
  const rows = [{ id: 'a', session_id: 's1', user_id: 'v1', role: 'volunteer', signed_in_at: '2099-07-01T16:50:00Z', signed_out_at: '2099-07-01T17:30:00Z' }]
  render(<RegisterTeam session={live} staffRows={rows} people={people} canManage onChanged={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign back in' }))
  await waitFor(() => expect(updates).toHaveLength(1))
  expect(updates[0].patch).toEqual({ signed_out_at: null })
})

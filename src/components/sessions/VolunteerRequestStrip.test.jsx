import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VolunteerRequestStrip, { readableAcceptError } from './VolunteerRequestStrip'

const mockCalls = []
let mockInsertError = null
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: t => {
      const q = {
        insert: v => { mockCalls.push([t, 'insert', v]); return Promise.resolve({ error: mockInsertError }) },
        update: v => { mockCalls.push([t, 'update', v]); return q },
        delete: () => { mockCalls.push([t, 'delete']); return q },
        eq: (k, v) => { mockCalls.push([t, 'eq', k, v]); return Promise.resolve({ error: null }) },
      }
      return q
    },
  },
}))

const session = { id: 's1', org_id: 'o1', title: 'Swimming Session' }
const requests = [{ id: 'r1', session_id: 's1', user_id: 'v1', created_at: new Date(Date.now() - 2 * 3600000).toISOString() }]
const names = { v1: 'Moe Volunteer' }

beforeEach(() => { mockCalls.length = 0; mockInsertError = null })

test('nothing when nobody has asked', () => {
  const { container } = render(<VolunteerRequestStrip session={session} requests={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('accept puts them on the team and clears the request', async () => {
  const onChanged = jest.fn()
  render(<VolunteerRequestStrip session={session} requests={requests} names={names} userId="u1" onChanged={onChanged} />)
  expect(screen.getByText('1 volunteer wants to help')).toBeInTheDocument()
  expect(screen.getByText('Asked 2 hours ago')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Accept Moe Volunteer' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(mockCalls[0]).toEqual(['session_staff', 'insert', { session_id: 's1', user_id: 'v1', org_id: 'o1', role: 'volunteer' }])
  expect(mockCalls).toContainEqual(['session_volunteer_requests', 'delete'])
})

test('decline marks it declined and says who', async () => {
  const onChanged = jest.fn()
  render(<VolunteerRequestStrip session={session} requests={requests} names={names} userId="u1" onChanged={onChanged} />)
  fireEvent.click(screen.getByRole('button', { name: 'Decline Moe Volunteer' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(mockCalls[0][0]).toBe('session_volunteer_requests')
  expect(mockCalls[0][2]).toMatchObject({ status: 'declined', decided_by: 'u1' })
})

test('expired checks stop the accept with a plain message', async () => {
  mockInsertError = { message: 'VOLUNTEER_NOT_READY: checks missing' }
  render(<VolunteerRequestStrip session={session} requests={requests} names={names} />)
  fireEvent.click(screen.getByRole('button', { name: 'Accept Moe Volunteer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('checks are not up to date')
  expect(mockCalls.find(c => c[1] === 'delete')).toBeUndefined()
  expect(readableAcceptError({ message: 'duplicate key value' })).toBe('They are already on the team.')
})

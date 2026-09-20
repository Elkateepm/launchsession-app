import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import SessionRegisterRoute from './SessionRegisterRoute'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./LiveRegister', () => props => <div>Register for {props.session.title}</div>)

test('opens the selected register with an organisation-scoped query', async () => {
  const eq = jest.fn(() => query)
  const query = { select: () => query, eq, single: () => Promise.resolve({ data: { id: 's1', title: 'Selected activity' } }) }
  supabase.from.mockReturnValue(query)
  render(<SessionRegisterRoute sessionId="s1" org={{ id: 'o1' }} />)
  await screen.findByText('Register for Selected activity')
  expect(eq).toHaveBeenCalledWith('org_id', 'o1')
  expect(eq).toHaveBeenCalledWith('id', 's1')
})

test('changing organisation cannot display a late response from the previous organisation', async () => {
  let resolveFirst
  const first = new Promise(resolve => { resolveFirst = resolve })
  const second = Promise.resolve({ error: { message: 'not found' } })
  let count = 0
  supabase.from.mockImplementation(() => {
    const response = count++ === 0 ? first : second
    const query = { select: () => query, eq: () => query, single: () => response }
    return query
  })
  const view = render(<SessionRegisterRoute sessionId="s1" org={{ id: 'o1' }} />)
  view.rerender(<SessionRegisterRoute sessionId="s1" org={{ id: 'o2' }} />)
  await screen.findByRole('alert')
  resolveFirst({ data: { id: 's1', title: 'Previous organisation' } })
  await waitFor(() => expect(screen.queryByText(/Previous organisation/)).not.toBeInTheDocument())
})

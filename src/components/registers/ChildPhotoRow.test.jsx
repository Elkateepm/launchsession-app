import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Registers from './Registers'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance } from '../../lib/hooks'
import { uploadChildPhoto } from '../../lib/childPhoto'

jest.mock('../../lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn() },
  from: jest.fn(), storage: { from: jest.fn() }, rpc: jest.fn(),
} }))
// A real piece of state, so the test sees what the page does with it.
jest.mock('../../lib/hooks', () => ({
  useTodaySession: jest.fn(), useAttendance: jest.fn(), useOnlineStatus: () => true,
  useChildren: () => { const React = require('react'); const [children, setChildren] = React.useState([{ id: 'p1', first_name: 'Alex', last_name: 'Example', group_name: 'Tigers' }]); return { children, setChildren, loading: false } },
}))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [{ label: 'Tigers', color: '#6745db' }], refetch: jest.fn() }) }))
jest.mock('../shared/SignedImg', () => props => <img alt="" data-src={props.src} />)
jest.mock('../../lib/storageUrl', () => ({ signOne: jest.fn(async () => 'https://signed/photo'), signRows: jest.fn(async (b, rows) => rows), storagePath: (b, v) => v, forgetSignedUrl: jest.fn() }))
jest.mock('../../lib/childPhoto', () => ({ uploadChildPhoto: jest.fn() }))

const org = { id: 'org1', name: 'Tye Dye Drama', primary_color: '#4714ff' }
beforeEach(() => {
  useTodaySession.mockReturnValue({ sessions: [], session: null, loading: false })
  useAttendance.mockReturnValue({ attendance: [], loading: false })
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  const query = { then: resolve => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve) }
  for (const m of ['select', 'update', 'insert', 'eq', 'in', 'order', 'limit', 'not', 'is', 'gte', 'lte', 'or']) query[m] = jest.fn(() => query)
  query.single = query.maybeSingle = jest.fn(async () => ({ data: null, error: null }))
  supabase.from.mockReturnValue(query)
})

test('a photo added from the child\'s profile shows on their register row straight away', async () => {
  uploadChildPhoto.mockResolvedValue('org1/children/p1/photo-1.jpg')
  render(<Registers org={org} onNavigate={() => {}} />)
  const row = screen.getByRole('button', { name: 'Open Alex Example' })
  expect(row.querySelector('img')).toBeNull()

  fireEvent.click(row)
  const input = await waitFor(() => { const el = document.querySelector('input[type="file"][accept="image/*"]'); if (!el) throw new Error('no photo input'); return el })
  fireEvent.change(input, { target: { files: [new File(['x'], 'alex.jpg', { type: 'image/jpeg' })] } })

  await waitFor(() => expect(screen.getByRole('button', { name: 'Open Alex Example' }).querySelector('img')).toHaveAttribute('data-src', 'org1/children/p1/photo-1.jpg'))
  expect(uploadChildPhoto).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org1', childId: 'p1' }))
  expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeInTheDocument()
})

test('a failed upload says why instead of doing nothing', async () => {
  uploadChildPhoto.mockRejectedValue(new Error('The photo could not be uploaded. Check your connection and try again.'))
  render(<Registers org={org} onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Alex Example' }))
  const input = await waitFor(() => { const el = document.querySelector('input[type="file"][accept="image/*"]'); if (!el) throw new Error('no photo input'); return el })
  fireEvent.change(input, { target: { files: [new File(['x'], 'alex.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be uploaded')
})

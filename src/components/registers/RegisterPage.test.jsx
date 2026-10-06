import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Registers from './Registers'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useChildren, useAttendance } from '../../lib/hooks'

jest.mock('../../lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn() },
  from: jest.fn(), storage: { from: jest.fn() }, rpc: jest.fn(),
} }))
jest.mock('../../lib/hooks', () => ({ useTodaySession: jest.fn(), useChildren: jest.fn(), useAttendance: jest.fn(), useOnlineStatus: () => true }))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [{ label: 'Tigers', color: '#6745db' }, { label: 'Teens', color: '#137d68' }], refetch: jest.fn() }) }))

const org = { id: 'o1', name: 'Example organisation', primary_color: '#6745db' }
const selectedSession = { id: 's1', title: 'Afternoon club', start_time: '15:30', opened_at: '2026-10-05T14:30:00Z' }
const people = [{ id: 'p1', first_name: 'Alex', last_name: 'Example', group_name: 'Tigers' }]
let query
beforeEach(() => {
  useTodaySession.mockReturnValue({ sessions: [selectedSession], session: selectedSession, loading: false })
  useChildren.mockReturnValue({ children: people, setChildren: jest.fn(), loading: false })
  useAttendance.mockReturnValue({ attendance: [{ session_id: 's1', child_id: 'p1', status: 'expected' }], loading: false })
  query = { then: resolve => Promise.resolve({ data: [], error: null }).then(resolve) }
  for (const method of ['select', 'update', 'eq', 'in', 'order', 'limit', 'not', 'is']) query[method] = jest.fn(() => query)
  supabase.from.mockReturnValue(query)
})

test('the page opens the chosen live register and exposes import review', () => {
  const onNavigate = jest.fn()
  render(<Registers org={org} onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole('button', { name: /Take attendance/ }))
  expect(onNavigate).toHaveBeenCalledWith('registers', { sessionId: 's1' })
  fireEvent.click(screen.getByRole('button', { name: 'Import register' }))
  expect(screen.getByRole('dialog', { name: 'Import register' })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Spreadsheet rows' }), { target: { value: 'Name,Class\nTaylor Example,Tigers' } })
  fireEvent.click(screen.getByRole('button', { name: /Check/ }))
  expect(screen.getByRole('dialog', { name: 'Review register import' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Import 1 young person' })).toBeEnabled()
})

test('bulk assignment scopes the write to the organisation and selected IDs', async () => {
  render(<Registers org={org} onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alex Example' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Assign selected to group' }), { target: { value: 'Teens' } })
  await waitFor(() => expect(query.update).toHaveBeenCalledWith({ group_name: 'Teens' }))
  expect(query.eq).toHaveBeenCalledWith('org_id', 'o1')
  expect(query.in).toHaveBeenCalledWith('id', ['p1'])
})

test('archive access queries only this organisation', async () => {
  render(<Registers org={org} onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archived registers' }))
  await waitFor(() => expect(query.eq).toHaveBeenCalledWith('org_id', 'o1'))
  expect(query.not).toHaveBeenCalledWith('archived_at', 'is', null)
})

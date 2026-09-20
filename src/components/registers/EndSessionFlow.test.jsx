import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EndSessionFlow from './EndSessionFlow'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ session: 'activity', Session: 'Activity', people: 'members' }) }))

const session = { id: 'session-1', title: 'After-school sport' }
let attendance, attendanceError, closeError, filters, updates, readCount, freshAttendance
let props

beforeEach(() => {
  attendance = [{ id: 'a1', status: 'signed_out' }]
  attendanceError = null
  closeError = null
  freshAttendance = null
  readCount = 0
  filters = []
  updates = []
  props = { session, org: { id: 'org-1' }, authUserId: 'staff-1', canCloseRegister: true,
    onClose: jest.fn(), onReview: jest.fn(), onClosed: jest.fn(), onReflect: jest.fn() }
  supabase.from.mockImplementation(table => {
    let patch
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([table, key, value]); return query },
      is: (key, value) => { filters.push([table, key, value]); return query },
      in: () => query,
      or: () => query,
      update: value => { patch = value; updates.push([table, value]); return query },
      single: () => query,
      then: (resolve, reject) => {
        let result
        if (table === 'attendance') {
          if (patch) attendance = attendance.map(row => row.status === 'expected' ? { ...row, ...patch } : row)
          if (!patch) readCount++
          result = { data: freshAttendance && readCount > 1 ? freshAttendance : attendance, error: attendanceError }
        } else result = { data: closeError ? null : { ...session, ...patch }, error: closeError }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return query
  })
})

test('on-site and unmarked attendees block closing and link to the right list', async () => {
  attendance = [{ id: 'a1', status: 'signed_in' }, { id: 'a2', status: 'expected' }]
  render(<EndSessionFlow {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /1 still on site/ }))
  expect(props.onReview).toHaveBeenCalledWith('signed_in')
  expect(screen.getByRole('button', { name: 'Close register' })).toBeDisabled()
  expect(updates).toHaveLength(0)
})

test('bulk absence requires an explicit check and leaves signed-out records alone', async () => {
  attendance.push({ id: 'a2', status: 'expected' })
  render(<EndSessionFlow {...props} />)
  const mark = await screen.findByRole('button', { name: 'Mark remaining absent' })
  expect(mark).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(mark)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close register' })).toBeEnabled())
  expect(attendance[0].status).toBe('signed_out')
  expect(attendance[1].status).toBe('absent')
  expect(filters).toContainEqual(['attendance', 'org_id', 'org-1'])
})

test('closing rechecks attendance and catches someone signed in on another device', async () => {
  freshAttendance = [{ id: 'a1', status: 'signed_in' }]
  render(<EndSessionFlow {...props} />)
  await screen.findByText('✓ All attendance accounted for')
  fireEvent.click(screen.getByRole('button', { name: 'Close register' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Attendance needs attention')
  expect(updates).toHaveLength(0)
  expect(props.onClosed).not.toHaveBeenCalled()
})

test('a failed read cannot be treated as an empty register', async () => {
  attendanceError = { message: 'offline' }
  render(<EndSessionFlow {...props} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check attendance')
  expect(screen.getByRole('button', { name: 'Close register' })).toBeDisabled()
})

test('a failed close stays open and does not claim success', async () => {
  closeError = { message: 'denied' }
  render(<EndSessionFlow {...props} />)
  await screen.findByText('✓ All attendance accounted for')
  fireEvent.click(screen.getByRole('button', { name: 'Close register' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be closed')
  expect(props.onClosed).not.toHaveBeenCalled()
  expect(screen.queryByText('Activity closed')).not.toBeInTheDocument()
})

test('successful close saves once, remains on confirmation, and carries the session into reflection', async () => {
  render(<EndSessionFlow {...props} />)
  await screen.findByText('✓ All attendance accounted for')
  const finish = screen.getByRole('button', { name: 'Close register' })
  fireEvent.click(finish)
  fireEvent.click(finish)
  await screen.findByText('Activity closed')
  expect(updates.filter(([table]) => table === 'sessions')).toHaveLength(1)
  expect(filters).toContainEqual(['sessions', 'org_id', 'org-1'])
  expect(filters).toContainEqual(['sessions', 'closed_at', null])
  expect(props.onClosed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Continue to reflection/ }))
  expect(props.onClosed).toHaveBeenCalledWith(expect.objectContaining({ id: session.id, register_status: 'closed' }))
  expect(props.onReflect).toHaveBeenCalledWith(session.id)
})

test('view-only roles cannot close a register', async () => {
  render(<EndSessionFlow {...props} canCloseRegister={false} />)
  await screen.findByText('✓ All attendance accounted for')
  expect(screen.getByRole('button', { name: 'Close register' })).toBeDisabled()
  expect(updates).toHaveLength(0)
})

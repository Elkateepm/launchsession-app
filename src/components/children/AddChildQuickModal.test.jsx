import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddChildQuickModal } from './ChildrenDirectory'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [{ label: 'Under 12s' }, { label: 'Under 16s' }] }) }))
jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ person: 'young person' }) }))

let inserted
let fail
beforeEach(() => {
  inserted = []
  fail = null
  supabase.from.mockImplementation(() => ({
    insert: row => { inserted.push(row); return Promise.resolve({ error: fail }) },
  }))
})

const org = { id: 'o1', primary_color: '#123456' }

test('offers the organisation’s own groups instead of free text', () => {
  render(<AddChildQuickModal org={org} onClose={() => {}} onAdded={() => {}} />)
  const group = screen.getByLabelText('Group')
  expect(group.tagName).toBe('SELECT')
  expect([...group.options].map(o => o.textContent)).toEqual(['No group yet', 'Under 12s', 'Under 16s'])
})

test('says why a save was refused rather than doing nothing', async () => {
  fail = { message: 'CHILD_LIMIT_REACHED: Your plan includes 30 young people.' }
  const onAdded = jest.fn()
  render(<AddChildQuickModal org={org} onClose={() => {}} onAdded={onAdded} />)
  fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Alex' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(onAdded).not.toHaveBeenCalled()
})

test('stays open to add another, keeping the group, and Done reports the additions', async () => {
  const onSaved = jest.fn()
  const onAdded = jest.fn()
  render(<AddChildQuickModal org={org} onClose={() => {}} onSaved={onSaved} onAdded={onAdded} />)
  fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Alex' } })
  fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'Under 12s' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Alex added.')
  expect(onSaved).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('First name *')).toHaveValue('')
  expect(screen.getByLabelText('Group')).toHaveValue('Under 12s')
  expect(inserted[0]).toMatchObject({ org_id: 'o1', first_name: 'Alex', group_name: 'Under 12s' })

  fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Sam' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add another' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 added: Alex, Sam.'))
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(onAdded).toHaveBeenCalled()
})

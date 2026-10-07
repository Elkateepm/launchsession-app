import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { InlineChildImport } from './Registers'
import { rowsForImport } from './FillInRegister'
import { AVAILABLE_FIELDS } from './TemplateCreator'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) },
    from: jest.fn(), storage: { from: jest.fn() }, channel: jest.fn(), removeChannel: jest.fn(), rpc: jest.fn(),
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'org-1', name: 'Tye Dye Drama', primary_color: '#4714ff' }
const groups = [{ label: 'Tigers' }, { label: 'Bears' }]
const field = key => AVAILABLE_FIELDS.find(f => f.key === key)

beforeEach(() => { supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }) })

test('only filled-in cards become rows, under the labels of the columns actually used', () => {
  const fields = ['first_name', 'last_name', 'date_of_birth', 'allergies'].map(field)
  const rows = [
    { id: 'a', values: { first_name: ' Ada ', last_name: 'Lovelace', date_of_birth: '2015-06-14' } },
    { id: 'b', values: {} },
    { id: 'c', values: { first_name: '', last_name: '  ' } },
  ]
  expect(rowsForImport(rows, fields)).toEqual([
    ['First Name', 'Last Name', 'Date of Birth'],
    ['Ada', 'Lovelace', '2015-06-14'],
  ])
})

test('filling in on screen goes through the same check-and-review step as a spreadsheet', async () => {
  render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Fill in on screen/ }))

  const first = screen.getByRole('group', { name: 'Young Person 1' })
  fireEvent.change(within(first).getByLabelText('First Name, young person 1'), { target: { value: 'Ada' } })
  fireEvent.change(within(first).getByLabelText('Last Name, young person 1'), { target: { value: 'Lovelace' } })
  fireEvent.change(within(first).getByLabelText('Group, young person 1'), { target: { value: 'Bears' } })
  fireEvent.change(within(first).getByLabelText('Parent / Carer Phone, young person 1'), { target: { value: '07700 900123' } })
  fireEvent.click(screen.getByRole('button', { name: /Check 1 young person/ }))

  await screen.findByText(/Check the columns/i)
  expect(screen.getAllByRole('combobox').map(s => s.value)).toEqual(['first_name', 'last_name', 'group_name', 'parent_phone'])
  expect(screen.getByText('1 ready to import')).toBeInTheDocument()
})

test('a card with no name is called out before checking, and more cards can be added and removed', () => {
  render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Fill in on screen/ }))
  expect(screen.getAllByRole('group')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: /Add another young person/ }))
  expect(screen.getAllByRole('group')).toHaveLength(4)
  expect(screen.getByLabelText('First Name, young person 4')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Remove young person 4' }))
  expect(screen.getAllByRole('group')).toHaveLength(3)

  fireEvent.change(screen.getByLabelText('Allergies, young person 2'), { target: { value: 'Nuts' } })
  expect(screen.getByRole('status')).toHaveTextContent('1 young person has no first or last name yet')
})

test('the short form can show every field, and Back returns to the upload options', () => {
  render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Fill in on screen/ }))
  expect(screen.queryByLabelText('Carries an EpiPen, young person 1')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: `All ${AVAILABLE_FIELDS.length} fields` }))
  expect(screen.getByLabelText('Carries an EpiPen, young person 1').tagName).toBe('SELECT')
  fireEvent.click(screen.getByRole('button', { name: /Back/ }))
  expect(screen.getByRole('button', { name: /Download Excel template/ })).toBeInTheDocument()
})

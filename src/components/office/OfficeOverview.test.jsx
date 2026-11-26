import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import OfficeOverview from './OfficeOverview'
import { supabase } from '../../lib/supabase'
import { OFFICE_TABS } from '../dashboard/sidebar/navConfig'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const org = { id: 'org-a', name: 'Community Club', branding_enabled: true }
const values = { org_forms: 2, newsletters: 1, payment_transactions: 0, resource_bookings: 3, templates: 4 }
// The hub's detail queries read rows as well as counts.
const rows = {
  newsletters: [{ id: 'n1', status: 'draft', subject: 'December news' }],
  payment_charge_balances: [{ id: 'c1', computed_status: 'unpaid', remaining: 20, due_date: '2020-01-01' }],
  resource_bookings: [{ id: 'b1', status: 'pending', start_time: '2099-01-01T10:00:00Z' }],
}

function countsFrom(results) {
  supabase.from.mockImplementation(table => {
    const query = {
      select: jest.fn(() => query), eq: jest.fn(() => query),
      gte: jest.fn(() => query), neq: jest.fn(() => query),
      in: jest.fn(() => query), is: jest.fn(() => query), order: jest.fn(() => query), limit: jest.fn(() => query),
      then: (resolve, reject) => Promise.resolve(results[table]).then(resolve, reject),
    }
    return query
  })
}

beforeEach(() => countsFrom(Object.fromEntries(Object.keys({ ...values, ...rows }).map(key => [key, { count: values[key], data: rows[key] || [] }]))))
afterEach(() => jest.clearAllMocks())

test('Needs you lists real jobs from each tool, urgent first, and opens the tool', async () => {
  const onSelect = jest.fn()
  render(<OfficeOverview org={org} tabs={OFFICE_TABS} onSelect={onSelect} newResponses={2} />)
  const needs = screen.getByRole('region', { name: 'Needs you' })
  fireEvent.click(within(needs).getByRole('button', { name: /2 new form replies/i }))
  expect(onSelect).toHaveBeenLastCalledWith('forms')
  fireEvent.click(await within(needs).findByRole('button', { name: /£20 overdue/i }))
  expect(onSelect).toHaveBeenLastCalledWith('payments')
  expect(within(needs).getByRole('button', { name: /1 booking to approve/i })).toBeInTheDocument()
  fireEvent.click(within(needs).getByRole('button', { name: /1 newsletter draft. Continue writing/i }))
  expect(onSelect).toHaveBeenLastCalledWith('newsletter')
  const order = within(needs).getAllByRole('button').map(b => b.getAttribute('aria-label'))
  expect(order[0]).toMatch(/form replies/)
  expect(order[order.length - 1]).toMatch(/newsletter draft/)
  fireEvent.click(screen.getByRole('button', { name: /Parent Portal/i }))
  expect(onSelect).toHaveBeenLastCalledWith('parent_portal')
})

test('hidden modules are neither queried nor offered as shortcuts', async () => {
  render(<OfficeOverview org={org} tabs={OFFICE_TABS.filter(t => t.tab === 'templates')} onSelect={() => {}} newResponses={5} />)
  await screen.findByText('4 ready to use')
  expect(supabase.from).toHaveBeenCalledTimes(1)
  expect(supabase.from).toHaveBeenCalledWith('templates')
  expect(screen.queryByRole('button', { name: /Forms|replies|Newsletter|HR|Parent Portal/i })).not.toBeInTheDocument()
})

test('replaces counts when permitted tabs change without changing their number', async () => {
  const { rerender } = render(<OfficeOverview org={org} tabs={OFFICE_TABS.filter(t => t.tab === 'templates')} onSelect={() => {}} />)
  await screen.findByText('4 ready to use')
  rerender(<OfficeOverview org={org} tabs={OFFICE_TABS.filter(t => t.tab === 'newsletter')} onSelect={() => {}} />)
  await screen.findByText('1 draft')
  expect(screen.queryByText('4 ready to use')).not.toBeInTheDocument()
})

test('clears previous org counts immediately and ignores late responses', async () => {
  let finishOld
  const pending = new Promise(resolve => { finishOld = resolve })
  countsFrom({ newsletters: pending })
  const tabs = OFFICE_TABS.filter(t => t.tab === 'newsletter')
  const { rerender } = render(<OfficeOverview org={org} tabs={tabs} onSelect={() => {}} />)
  countsFrom({ newsletters: { count: 0 } })
  rerender(<OfficeOverview org={{ ...org, id: 'org-b' }} tabs={tabs} onSelect={() => {}} />)
  await screen.findByText('Nothing in draft')
  await act(async () => { finishOld({ count: 17 }) })
  expect(screen.queryByText('17 drafts')).not.toBeInTheDocument()
  expect(screen.queryByText(/17 newsletter drafts/)).not.toBeInTheDocument()
})

test('unavailable counts do not invent zero activity or hide known replies', async () => {
  countsFrom({ org_forms: { error: { message: 'Unavailable' } }, newsletters: { error: { message: 'Unavailable' } } })
  render(<OfficeOverview org={org} tabs={OFFICE_TABS.filter(t => ['forms', 'newsletter'].includes(t.tab))} onSelect={() => {}} newResponses={1} />)
  expect(screen.getByRole('button', { name: /1 new form reply/i })).toBeInTheDocument()
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  expect(screen.queryByText('Nothing in draft')).not.toBeInTheDocument()
  expect(screen.queryByText('No live forms')).not.toBeInTheDocument()
})

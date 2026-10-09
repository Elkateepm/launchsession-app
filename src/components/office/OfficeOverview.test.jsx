import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import OfficeOverview from './OfficeOverview'
import { supabase } from '../../lib/supabase'
import { OFFICE_TABS } from '../dashboard/sidebar/navConfig'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./OfficeIllustration', () => () => null)

const org = { id: 'org-a', name: 'Community Club', branding_enabled: true }
const values = { org_forms: 2, newsletters: 1, payment_transactions: 0, resource_bookings: 3, templates: 4 }

function countsFrom(results) {
  supabase.from.mockImplementation(table => {
    const query = {
      select: jest.fn(() => query), eq: jest.fn(() => query),
      gte: jest.fn(() => query), neq: jest.fn(() => query),
      then: (resolve, reject) => Promise.resolve(results[table]).then(resolve, reject),
    }
    return query
  })
}

beforeEach(() => countsFrom(Object.fromEntries(Object.entries(values).map(([key, count]) => [key, { count }]))))
afterEach(() => jest.clearAllMocks())

test('desk shortcuts reflect real work and navigate to the existing module', async () => {
  const onSelect = jest.fn()
  render(<OfficeOverview org={org} tabs={OFFICE_TABS} onSelect={onSelect} newResponses={2} />)
  const desk = screen.getByRole('region', { name: 'On your desk' })
  fireEvent.click(within(desk).getByRole('button', { name: /Review replies/i }))
  expect(onSelect).toHaveBeenLastCalledWith('forms')
  fireEvent.click(await within(desk).findByRole('button', { name: /Continue writing/i }))
  expect(onSelect).toHaveBeenLastCalledWith('newsletter')
  expect(within(desk).getByRole('button', { name: /View bookings/i })).toHaveTextContent('3')
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
  expect(screen.queryByRole('button', { name: /Continue writing/i })).not.toBeInTheDocument()
})

test('unavailable counts do not invent zero activity or hide known replies', async () => {
  countsFrom({ org_forms: { error: { message: 'Unavailable' } }, newsletters: { error: { message: 'Unavailable' } } })
  render(<OfficeOverview org={org} tabs={OFFICE_TABS.filter(t => ['forms', 'newsletter'].includes(t.tab))} onSelect={() => {}} newResponses={1} />)
  expect(screen.getByRole('button', { name: /Review replies/i })).toBeInTheDocument()
  await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(2))
  expect(screen.queryByText('Nothing in draft')).not.toBeInTheDocument()
  expect(screen.queryByText('No live forms')).not.toBeInTheDocument()
})

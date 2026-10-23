import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Settings from './Settings'
import { supabase } from '../../lib/supabase'

jest.mock('../../context/OrgContext', () => ({
  useOrg: () => ({ refreshOrg: jest.fn() }),
  useTerms: () => ({ People: 'Young People', Person: 'Young Person', Sessions: 'Sessions', Staff: 'Staff', Groups: 'Groups' }),
}))
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), auth: { onAuthStateChange: jest.fn(), getSession: jest.fn() } } }))
jest.mock('./branding/BrandingCentre', () => () => <div>Branding editor</div>)

const all = ['calendar', 'registers', 'safeguarding', 'messaging', 'reports']
// The catalogue as migration 20261008_office_add_on.sql leaves it.
const catalogue = [
  { plan: 'trial', label: 'Free trial', modules: [...all, 'hr'], self_serve: false, includes_branding: true, sort: 0 },
  { plan: 'platform', label: 'Complete Platform', blurb: '', modules: all, price_monthly_pence: 4999, price_annual_pence: 3999, self_serve: true, includes_branding: false, sort: 1 },
  { plan: 'platform_office', label: 'Platform + Office', blurb: '', modules: [...all, 'hr', 'resource_booking', 'payments'], price_monthly_pence: 5999, price_annual_pence: 4799, self_serve: true, includes_branding: false, sort: 2 },
  { plan: 'platform_office_branding', label: 'Platform + Office + Branding', blurb: '', modules: [...all, 'hr', 'resource_booking', 'payments'], price_monthly_pence: 6999, price_annual_pence: 5599, self_serve: true, includes_branding: true, sort: 3 },
  { plan: 'pro_plus', label: 'Pro+', modules: [...all, 'hr'], price_monthly_pence: 9900, self_serve: false, includes_branding: false, sort: 23 },
]

beforeEach(() => {
  supabase.from.mockImplementation(table => {
    const result = { data: table === 'plan_entitlements' ? catalogue : table === 'organisations' ? { custom_groups: [] } : [], error: null }
    const query = { select: () => query, eq: () => query, order: () => query, single: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej) }
    return query
  })
  supabase.rpc.mockResolvedValue({ data: [{ used: 3, child_limit: null }], error: null })
})

test('billing sells the three plans and says which include Office and Branding', async () => {
  render(<Settings org={{ id: 'o1', name: 'Tye Dye Drama', plan: 'trial', branding_enabled: true }} userProfile={{ role: 'admin' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Billing', exact: true }))

  const card = async label => (await screen.findByText(label, { selector: 'div' })).parentElement
  const platform = await card('Complete Platform')
  const office = await card('Platform + Office')
  const everything = await card('Platform + Office + Branding')

  expect(within(platform).getByText('£49.99')).toBeInTheDocument()
  expect(within(office).getByText('£59.99')).toBeInTheDocument()
  expect(within(everything).getByText('£69.99')).toBeInTheDocument()

  const adds = el => within(el).getByRole('list').textContent
  expect(adds(platform)).toMatch(/Office: HR, resource booking & payments not included/)
  expect(adds(platform)).toMatch(/Branding Centre & branded emails not included/)
  expect(adds(office)).toMatch(/Office: HR, resource booking & payments included/)
  expect(adds(office)).toMatch(/Branding Centre & branded emails not included/)
  expect(adds(everything)).toMatch(/Office: HR, resource booking & payments included.*Branding Centre & branded emails included/)

  // Retired plans are no longer offered.
  expect(screen.queryByText('Pro+')).toBeNull()
  expect(screen.queryByText(/Need more than Pro\+/)).toBeNull()
})

test('a registered charity sees every plan at 20% off, and what it claimed with', async () => {
  render(<Settings org={{ id: 'o1', name: 'Riverside Youth Club', plan: 'trial', branding_enabled: true, charity_number: '1123456', charity_regulator: 'ccew', charity_status: 'claimed' }} userProfile={{ role: 'owner' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Billing', exact: true }))

  const card = async label => (await screen.findByText(label, { selector: 'div' })).parentElement
  expect(within(await card('Complete Platform')).getByText('£39.99')).toBeInTheDocument()
  expect(within(await card('Platform + Office')).getByText('£47.99')).toBeInTheDocument()
  expect(within(await card('Platform + Office + Branding')).getByText('£55.99')).toBeInTheDocument()
  expect(screen.getAllByText('20% charity discount')).toHaveLength(3)
  expect(screen.getByText(/20% off is applied at checkout/)).toBeInTheDocument()
  expect(screen.getByText('1123456')).toBeInTheDocument()
})

test('an organisation without a claim can make one, and a bad number is explained', async () => {
  const update = jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
  supabase.from.mockImplementation(table => {
    const result = { data: table === 'plan_entitlements' ? catalogue : [], error: null }
    const query = { select: () => query, eq: () => query, order: () => query, update, single: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej) }
    return query
  })
  render(<Settings org={{ id: 'o1', name: 'Riverside Youth Club', plan: 'trial', branding_enabled: true }} userProfile={{ role: 'admin' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Billing', exact: true }))

  expect(within(await screen.findByText('Complete Platform', { selector: 'div' }).then(el => el.parentElement)).getByText('£49.99')).toBeInTheDocument()
  const number = screen.getByLabelText('Charity number')
  fireEvent.change(number, { target: { value: '12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Claim 20% off' }))
  expect(await screen.findByText(/look like 1123456/)).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()

  // Typing a Scottish number moves the regulator to match.
  fireEvent.change(number, { target: { value: 'sc 012345' } })
  expect(screen.getByLabelText('Registered with')).toHaveValue('oscr')
  fireEvent.click(screen.getByRole('button', { name: 'Claim 20% off' }))
  await screen.findByRole('button', { name: 'Claim 20% off' })
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ charity_number: 'SC012345', charity_regulator: 'oscr', charity_status: 'claimed' }))
})

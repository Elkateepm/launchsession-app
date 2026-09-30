import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from './Settings'
import { supabase } from '../../lib/supabase'

const mockRefreshOrg = jest.fn()
jest.mock('../../context/OrgContext', () => ({
  useOrg: () => ({ refreshOrg: mockRefreshOrg }),
  useTerms: () => ({ People: 'Members', Person: 'Member', Sessions: 'Activities', Staff: 'Team', Groups: 'Groups' }),
}))
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { onAuthStateChange: jest.fn() } } }))
jest.mock('./branding/BrandingCentre', () => () => <div>Branding editor</div>)
const org = { id: 'org-a', name: 'Community Club', type: 'charity', plan: 'trial', primary_color: '#6542CE', branding_enabled: true }
const admin = { role: 'admin' }
let update, eq, savedRow
beforeEach(() => {
  jest.clearAllMocks()
  mockRefreshOrg.mockResolvedValue()
  savedRow = jest.fn().mockResolvedValue({ data: { id: org.id }, error: null })
  eq = jest.fn().mockReturnValue({ select: () => ({ single: savedRow }) })
  update = jest.fn().mockReturnValue({ eq })
  supabase.from.mockImplementation(table => {
    const result = { data: table === 'organisations' ? { custom_groups: [] } : [], error: null }
    const query = { select: () => query, eq: () => query, single: () => Promise.resolve(result), then: (resolve, reject) => Promise.resolve(result).then(resolve, reject), update }
    return query
  })
  jest.spyOn(window, 'confirm').mockReturnValue(false)
})
afterEach(() => jest.restoreAllMocks())
const open = props => render(<Settings org={org} userProfile={admin} {...props} />)
const edit = () => fireEvent.change(screen.getByRole('textbox', { name: 'Organisation name' }), { target: { value: 'New Club' } })

test('overview searches descriptions and keywords and recovers from empty results', () => {
  open()
  expect(screen.getByRole('heading', { name: 'Settings', exact: true })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  invoice  ' } })
  expect(screen.getByRole('button', { name: 'Billing', exact: true })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Organisation', exact: true })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unmatched' } })
  expect(screen.getByText('No matching settings')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show all settings' }))
  expect(screen.getByRole('button', { name: 'Organisation', exact: true })).toBeInTheDocument()
})
test('non-admin users cannot open admin-only sections through initialSection', () => {
  open({ userProfile: { role: 'staff' }, initialSection: 'organisation' })
  expect(screen.queryByRole('textbox', { name: 'Organisation name' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Role access', exact: true })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Appearance', exact: true })).toBeInTheDocument()
})
test('branding entry point still opens the standalone editor', () => {
  open({ initialSection: 'branding' })
  expect(screen.getByText('Branding editor')).toBeInTheDocument()
})
test('saving the organisation is scoped, confirmed and refreshes the workspace', async () => {
  open({ initialSection: 'organisation' }); edit()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }))
  await screen.findByText('Your organisation details are saved.')
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Club' }))
  expect(eq).toHaveBeenCalledWith('id', 'org-a')
  expect(mockRefreshOrg).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
})
test.each([
  [{ data: null, error: { message: 'Permission denied' } }, /Permission denied/],
  [{ data: null, error: null }, /not saved/],
])('failed and empty writes preserve the draft and allow a retry', async (result, message) => {
  savedRow.mockResolvedValueOnce(result)
  open({ initialSection: 'organisation' }); edit()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('textbox', { name: 'Organisation name' })).toHaveValue('New Club')
  expect(mockRefreshOrg).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }))
  await screen.findByText('Your organisation details are saved.')
})
test('network failure exits saving and keeps inputs editable', async () => {
  savedRow.mockRejectedValueOnce(new Error('Offline'))
  open({ initialSection: 'organisation' }); edit()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  expect(screen.getByRole('textbox', { name: 'Organisation name' })).toBeEnabled()
})
test('a failed header refresh does not turn a saved update into a failed write', async () => {
  mockRefreshOrg.mockRejectedValueOnce(new Error('Offline'))
  open({ initialSection: 'organisation' }); edit()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }))
  await screen.findByText(/Refresh the app to update/)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
test('section navigation protects unsaved profile edits and discard restores saved values', async () => {
  open({ initialSection: 'organisation' }); edit()
  fireEvent.click(screen.getByRole('button', { name: 'All settings' }))
  expect(window.confirm).toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Organisation name' })).toHaveValue('New Club')
  fireEvent.click(screen.getByRole('button', { name: 'Discard', exact: true }))
  expect(screen.getByRole('textbox', { name: 'Organisation name' })).toHaveValue('Community Club')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled())
  fireEvent.click(screen.getByRole('button', { name: 'All settings' }))
  expect(screen.getByRole('heading', { name: 'Settings', exact: true })).toBeInTheDocument()
})

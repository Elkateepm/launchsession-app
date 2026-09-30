import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OrgLookup from './OrgLookup'
import { supabase } from '../../lib/supabase'
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: false }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
const orgs = [{ id: 'one', name: 'Community Youth Project', slug: 'community-youth' }, { id: 'two', name: 'Community Sports Club', slug: 'community-sport' }]
const location = window.location
let select
beforeAll(() => { delete window.location; window.location = { origin: 'https://app.launchsession.co.uk', href: '', assign: jest.fn() } })
afterAll(() => { window.location = location })
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); window.location.href = ''
  select = jest.fn().mockResolvedValue({ data: orgs, error: null })
  supabase.from.mockReturnValue({ select })
})
const search = async text => {
  const input = screen.getByRole('combobox', { name: 'Organisation name' })
  await waitFor(() => expect(select).toHaveBeenCalled())
  fireEvent.focus(input); fireEvent.change(input, { target: { value: text } })
  return input
}
test('organisation search clears both saved selections and only reads the public directory', async () => {
  localStorage.setItem('launchsession_org_slug', 'old'); localStorage.setItem('launchsession_remembered_org_slug', 'old')
  render(<OrgLookup />)
  await search('Community')
  expect(localStorage.getItem('launchsession_org_slug')).toBeNull()
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
  expect(supabase.from).toHaveBeenCalledWith('organisations_public')
  expect(window.location.href).toBe('')
})
test('keyboard suggestions require organisation confirmation before navigating to sign-in', async () => {
  render(<OrgLookup />); const input = await search('Community Youth')
  await screen.findByRole('listbox')
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByRole('heading', { name: 'Is this your organisation?' })).toBeInTheDocument()
  expect(screen.queryByText('Verified Organisation')).not.toBeInTheDocument()
  expect(window.location.href).toBe('')
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sign in' }))
  expect(localStorage.getItem('launchsession_org_slug')).toBe('community-youth')
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
  expect(window.location.href).toBe('https://app.launchsession.co.uk/login?org=community-youth')
})
test('multiple results use the same confirmation and explicit remembering choice', async () => {
  render(<OrgLookup />); await search('Community')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('heading', { name: 'Choose your organisation' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Select Community Sports Club' }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sign in' }))
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBe('community-sport')
  expect(window.location.href).toContain('/login?org=community-sport')
})
test('failed directory requests show an error and can be retried', async () => {
  select.mockRejectedValue(new Error('Offline'))
  render(<OrgLookup />); await search('Community Youth')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load organisations')
  select.mockResolvedValue({ data: orgs, error: null })
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('heading', { name: 'Is this your organisation?' })).toBeInTheDocument()
})
test('no match stays on search and never selects a default organisation', async () => {
  render(<OrgLookup />); await search('Missing organisation')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No organisation found')
  expect(window.location.href).toBe('')
  expect(localStorage.getItem('launchsession_org_slug')).toBeNull()
})

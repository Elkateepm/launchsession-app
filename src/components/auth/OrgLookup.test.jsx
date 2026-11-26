import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OrgLookup from './OrgLookup'
import { supabase } from '../../lib/supabase'
import { AUTH_DIRECTORY_COLUMNS } from './authBranding'
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: false }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false, isInstalledWebApp: () => false, runsAsApp: () => false }))
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
test('organisation search clears both saved selections and only reads public branding columns from the safe view', async () => {
  localStorage.setItem('launchsession_org_slug', 'old'); localStorage.setItem('launchsession_remembered_org_slug', 'old')
  render(<OrgLookup />)
  await search('Community')
  expect(localStorage.getItem('launchsession_org_slug')).toBeNull()
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
  expect(supabase.from).toHaveBeenCalledWith('organisations_safe')
  expect(select).toHaveBeenCalledWith(AUTH_DIRECTORY_COLUMNS)
  expect(window.location.href).toBe('')
})
test('choosing a suggestion goes straight to that organisation\'s sign-in, without remembering it', async () => {
  render(<OrgLookup />); const input = await search('Community Youth')
  await screen.findByRole('listbox')
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  expect(localStorage.getItem('launchsession_org_slug')).toBe('community-youth')
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
  expect(window.location.href).toBe('https://app.launchsession.co.uk/login?org=community-youth')
})
test('several matches: choosing one goes straight to its sign-in', async () => {
  render(<OrgLookup />); await search('Community')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('heading', { name: 'Choose your organisation' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Select Community Sports Club' }))
  expect(window.location.href).toBe('https://app.launchsession.co.uk/login?org=community-sport')
})
test('failed directory requests show an error and can be retried', async () => {
  select.mockRejectedValue(new Error('Offline'))
  render(<OrgLookup />); await search('Community Youth')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load organisations')
  select.mockResolvedValue({ data: orgs, error: null })
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  await waitFor(() => expect(window.location.href).toBe('https://app.launchsession.co.uk/login?org=community-youth'))
})
test('no match stays on search and never selects a default organisation', async () => {
  render(<OrgLookup />); await search('Missing organisation')
  fireEvent.click(screen.getByRole('button', { name: 'Find my workspace' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No organisation found')
  expect(window.location.href).toBe('')
  expect(localStorage.getItem('launchsession_org_slug')).toBeNull()
})

test('the members page says who it is for and answers the usual sign-in questions', async () => {
  render(<OrgLookup />)
  expect(screen.getByRole('heading', { name: "Members' sign in" })).toBeInTheDocument()
  const help = screen.getByRole('list', { name: 'Help signing in' })
  expect(help).toHaveTextContent('Got an invite email?')
  expect(help).toHaveTextContent('Forgotten your password?')
  expect(screen.getByRole('link', { name: 'Start a free 14-day trial' })).toHaveAttribute('href', '/signup')

})

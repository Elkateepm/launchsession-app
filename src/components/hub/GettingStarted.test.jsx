import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import GettingStarted, { gettingStartedSteps } from './GettingStarted'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

let counts
beforeEach(() => {
  localStorage.clear()
  counts = { sessions: 0, children: 3, user_profiles: 1 }
  supabase.from.mockImplementation(table => ({ select: () => ({ eq: () => Promise.resolve({ count: counts[table] }) }) }))
})

const org = { id: 'o1', branding_enabled: true, logo_url: null }

test('a new organisation sees its next steps, with real progress ticked off', async () => {
  const onNavigate = jest.fn()
  render(<GettingStarted org={org} userRole="admin" onNavigate={onNavigate} />)
  expect(await screen.findByRole('heading', { name: 'Getting started' })).toBeInTheDocument()
  expect(screen.getByText(/1 of 4 done/)).toBeInTheDocument()
  expect(screen.getByText(/Add your young people/)).toHaveTextContent('done')
  fireEvent.click(screen.getByRole('button', { name: /Plan your first session/ }))
  expect(onNavigate).toHaveBeenCalledWith('planner', { autoOpenWizard: true })
})

test('it goes away once everything is done, or when hidden', async () => {
  counts = { sessions: 2, children: 3, user_profiles: 4 }
  const { container, unmount } = render(<GettingStarted org={{ ...org, logo_url: 'logo.png' }} userRole="owner" onNavigate={jest.fn()} />)
  await Promise.resolve()
  expect(container).toBeEmptyDOMElement()
  unmount()

  counts = { sessions: 0, children: 0, user_profiles: 1 }
  render(<GettingStarted org={org} userRole="owner" onNavigate={jest.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Hide' }))
  expect(screen.queryByRole('heading', { name: 'Getting started' })).not.toBeInTheDocument()
  expect(localStorage.getItem('ls_getting_started_hidden_o1')).toBe('1')
})

test('only the people who set the organisation up see it', async () => {
  const { container } = render(<GettingStarted org={org} userRole="staff" onNavigate={jest.fn()} />)
  await Promise.resolve()
  expect(container).toBeEmptyDOMElement()
  expect(supabase.from).not.toHaveBeenCalled()
})

test('branding is a step only on plans that include it', () => {
  const keys = gettingStartedSteps({ branding_enabled: false }, { sessions: 0, children: 0, people: 1 }).map(s => s.key)
  expect(keys).toEqual(['session', 'people', 'team'])
})

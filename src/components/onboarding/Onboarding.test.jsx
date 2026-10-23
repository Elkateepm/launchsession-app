import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Onboarding from './Onboarding'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

beforeEach(() => {
  // jsdom has no matchMedia; the layout asks it about reduced motion.
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  supabase.from.mockImplementation(() => {
    const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data: { full_name: 'Olivia Hughes' }, error: null }) }
    return query
  })
})

const session = { user: { id: 'u1', email: 'olivia@riversideyouth.org' } }

test('the type chosen at sign-up is not asked again', async () => {
  await act(async () => { render(<Onboarding session={session} org={{ id: 'o1', name: 'Riverside Youth Club', type: 'sports_club' }} onComplete={() => {}} />) })
  fireEvent.click(screen.getByRole('button', { name: /Let's go/ }))
  expect(screen.getByText('Step 2 of 6')).toBeInTheDocument()
  // A sports club's own word for the people it serves.
  expect(screen.getByText(/how many players do you support/i)).toBeInTheDocument()
  expect(screen.queryByText(/What type of organisation/)).toBeNull()
  // Nothing on this screen promises an invite step that isn't next.
  expect(screen.queryByText(/in the next step/)).toBeNull()
})

test('a workspace with no type yet still gets the question', async () => {
  await act(async () => { render(<Onboarding session={session} org={{ id: 'o1', name: 'Riverside Youth Club' }} onComplete={() => {}} />) })
  fireEvent.click(screen.getByRole('button', { name: /Let's go/ }))
  expect(screen.getByText('Step 2 of 7')).toBeInTheDocument()
  expect(screen.getByText(/What type of organisation is Riverside Youth Club/)).toBeInTheDocument()
})

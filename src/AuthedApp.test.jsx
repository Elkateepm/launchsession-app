import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthedApp } from './App'
import { supabase } from './lib/supabase'

jest.mock('./lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { signOut: jest.fn(), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe() {} } } })), getSession: jest.fn() } } }))
jest.mock('./lib/authRedirect', () => ({ redirectToSignIn: jest.fn() }))
jest.mock('./components/dashboard/Dashboard', () => () => <div>Dashboard for members</div>)
jest.mock('./components/onboarding/Onboarding', () => () => <div>Onboarding</div>)
jest.mock('./context/ModuleAccessContext', () => ({ ModuleAccessProvider: ({ children }) => children }))
jest.mock('./components/common/SplashScreen', () => () => null)

const solidarity = { id: 'org-ss', name: 'Solidarity Sports', slug: 'solidarity-sports', onboarding_complete: true }
const session = { user: { id: 'u1', email: 'info@launchnexus.co.uk' } }
let profile, upsert

beforeEach(() => {
  upsert = jest.fn()
  supabase.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, upsert,
      maybeSingle: () => Promise.resolve(table === 'organisations_safe'
        ? { data: { name: 'Tye Dye Drama', slug: 'tye-dye-drama' }, error: null }
        : { data: profile, error: null }) }
    return q
  })
})

const show = () => render(<React.Suspense fallback={null}><AuthedApp session={session} org={solidarity} onReady={() => {}} /></React.Suspense>)

test("an account from another organisation is told so, and sent to its own, instead of an empty copy of this one", async () => {
  profile = { org_id: 'org-tdd', role: 'admin', approval_status: 'approved', onboarding_complete: true }
  delete window.location
  window.location = { origin: 'https://app.test', replace: jest.fn() }
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('This account belongs to Tye Dye Drama')
  expect(screen.getByRole('alert')).toHaveTextContent('info@launchnexus.co.uk')
  expect(screen.queryByText('Dashboard for members')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Go to Tye Dye Drama' }))
  expect(window.location.replace).toHaveBeenCalledWith('https://app.test/dashboard?org=tye-dye-drama')
})

test('an account with no profile is not made an admin of the organisation on screen', async () => {
  profile = null
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent("This account isn't part of Solidarity Sports")
  expect(upsert).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Go to/ })).toBeNull()
})

test('a member of the organisation gets the app', async () => {
  profile = { org_id: 'org-ss', role: 'admin', approval_status: 'approved', onboarding_complete: true }
  show()
  expect(await screen.findByText('Dashboard for members')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
})

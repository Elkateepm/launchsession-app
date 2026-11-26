import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ProfilePage from './ProfilePage'
import { supabase } from '../../lib/supabase'

const update = jest.fn()
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { updateUser: jest.fn(), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
jest.mock('../../lib/staffPhoto', () => ({ uploadStaffPhoto: jest.fn() }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true, useBreakpoint: () => ({ isMobile: true, isTablet: false, isDesktop: false }) }))
jest.mock('../shared/SignedImg', () => () => null)

const profile = { id: 'u1', full_name: 'Sam Taylor', role: 'staff', phone: null, location: 'Watford', emergency_contact_name: null, emergency_contact_phone: null, dbs_number: '001234567890', dbs_expiry: null, photo_url: null }
const org = { id: 'o1', name: 'Riverside Youth Club', primary_color: '#0E7C86', plan: 'trial' }

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  update.mockImplementation(() => ({ eq: () => Promise.resolve({ error: null }) }))
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile }) }) }),
    update,
  }))
})

function renderProfile(props = {}) {
  return render(<ProfilePage session={{ user: { id: 'u1', email: 'sam@example.org' } }} org={org} onClose={jest.fn()} onSignOut={jest.fn()} {...props} />)
}

test('greets you by name and says what to add next', async () => {
  renderProfile()
  expect(await screen.findByRole('heading', { name: 'Hi, Sam' })).toBeInTheDocument()
  expect(screen.getByText('Your profile is 1 of 4 done')).toBeInTheDocument()
  // The photo itself and the next-step prompt both add one.
  expect(screen.getAllByRole('button', { name: 'Add a photo' })).toHaveLength(2)
  expect(screen.getByText('Staff member')).toBeInTheDocument()
})

test('tapping a row opens a sheet that saves the field', async () => {
  renderProfile()
  fireEvent.click(await screen.findByRole('button', { name: 'Phone number: not set' }))
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: ' 07700 900123 ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(update).toHaveBeenCalledWith({ phone: '07700 900123' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Saved')
})

test('makes no promises it cannot keep', async () => {
  renderProfile()
  await screen.findByRole('heading', { name: 'Hi, Sam' })
  expect(screen.queryByText(/two-factor/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/account is secure/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/changed recently/i)).not.toBeInTheDocument()
})

test('offers the tour only when there is one to take', async () => {
  const onStartTour = jest.fn()
  const { unmount } = renderProfile({ onStartTour })
  fireEvent.click(await screen.findByRole('button', { name: /Take the tour/ }))
  expect(onStartTour).toHaveBeenCalled()
  unmount()
  renderProfile()
  await screen.findByRole('heading', { name: 'Hi, Sam' })
  expect(screen.queryByRole('button', { name: /Take the tour/ })).not.toBeInTheDocument()
})

test('a tap outside an edit sheet closes the sheet, not your whole profile', async () => {
  const onClose = jest.fn()
  renderProfile({ onClose })
  fireEvent.click(await screen.findByRole('button', { name: 'Phone number: not set' }))
  const sheet = screen.getByRole('dialog', { name: 'Add phone number' })
  fireEvent.click(sheet.parentElement)
  expect(screen.queryByRole('dialog', { name: 'Add phone number' })).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('lets you pick light, dark or your device, and keeps it on this device', async () => {
  renderProfile()
  const appearance = await screen.findByRole('radiogroup', { name: 'Appearance' })
  expect(within(appearance).getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(within(appearance).getByRole('radio', { name: 'Dark' }))
  expect(within(appearance).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  expect(localStorage.getItem('ls_theme')).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  fireEvent.click(within(appearance).getByRole('radio', { name: 'Match device' }))
  expect(localStorage.getItem('ls_theme')).toBe('system')
  expect(screen.getByText(/Following your device, which is (light|dark) right now/)).toBeInTheDocument()
})

test('says how long this device keeps you signed in', async () => {
  const { unmount } = renderProfile()
  expect(await screen.findByText('Until you sign out')).toBeInTheDocument()
  expect(screen.getByText('Or after 30 days without opening the app here.')).toBeInTheDocument()
  unmount()
  localStorage.setItem('ls_remember_me', 'false')
  renderProfile()
  expect(await screen.findByText('Until you close the browser')).toBeInTheDocument()
})

test('keeps its last rows clear of the phone dock', async () => {
  const { container } = renderProfile({ dockClearance: '90px' })
  await screen.findByRole('heading', { name: 'Hi, Sam' })
  expect(container.querySelector('.ls-scroll').style.paddingBottom).toBe('90px')
})

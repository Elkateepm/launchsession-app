import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import WelcomeTour, { ownerTour } from './WelcomeTour'
import { startTour, pendingTour, clearTour } from './tourStorage'

jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'o1', name: 'Riverside Youth Club', primary_color: '#0E7C86', secondary_color: '#F6B44B', accent_color: '#F08A24', branding_enabled: true }

function renderTour(props = {}) {
  const onClose = jest.fn()
  const onNavigate = jest.fn()
  render(<WelcomeTour role="owner" org={org} firstName="Sam" onClose={onClose} onNavigate={onNavigate} {...props} />)
  return { onClose, onNavigate }
}

test('greets the owner by name and walks the stops with buttons and arrow keys', async () => {
  renderTour()
  expect(screen.getByRole('dialog', { name: "You're in, Sam!" })).toBeInTheDocument()
  expect(screen.getByText(/Riverside Youth Club is all set up/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Show me around/ }))
  expect(await screen.findByRole('heading', { name: 'Your day at a glance' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Home: today's sessions/ })).toHaveAttribute('src', '/tour/home.webp')

  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(await screen.findByRole('heading', { name: 'Plan it once, reuse it all term' })).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  expect(await screen.findByRole('heading', { name: 'Your day at a glance' })).toBeInTheDocument()
})

test('skip and Escape both close the tour', () => {
  const { onClose } = renderTour()
  fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('the last stop offers first moves that open the right screens', async () => {
  const { onNavigate, onClose } = renderTour()
  for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(await screen.findByRole('heading', { name: 'Ready, set, launch' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Invite your team/ }))
  expect(onNavigate).toHaveBeenCalledWith('team')
  fireEvent.click(screen.getByRole('button', { name: /Add your logo and colours/ }))
  expect(onNavigate).toHaveBeenCalledWith('branding')
  fireEvent.click(screen.getByRole('button', { name: 'Explore on my own' }))
  expect(onClose).toHaveBeenCalled()
})

test('branding is only suggested to organisations that have it', () => {
  const moves = ownerTour({ org: { ...org, branding_enabled: false }, firstName: 'Sam' }).at(-1).moves
  expect(moves.map(m => m.tab)).toEqual(['planner', 'registers', 'team'])
})

test('the tour waits in session storage until it is closed', () => {
  clearTour()
  expect(pendingTour()).toBeNull()
  startTour('owner')
  expect(pendingTour()).toBe('owner')
  clearTour()
  expect(pendingTour()).toBeNull()
})

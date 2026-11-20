import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import InstallAppPrompt, { StatusBarStrip } from './InstallAppPrompt'
import { __setDeferredForTests, DISMISS_KEY } from '../../lib/installPrompt'

const org = { name: 'Riverside Youth Club' }
const phone = (ua, extra = {}) => ({ navigator: { userAgent: ua, maxTouchPoints: 5 }, innerWidth: 390, matchMedia: () => ({ matches: false }), ...extra })
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

beforeEach(() => { localStorage.clear(); __setDeferredForTests(null) })

test('an iPhone in Safari is shown the two Share steps', () => {
  render(<InstallAppPrompt org={org} delayMs={0} win={phone(IPHONE)} />)
  expect(screen.getByRole('dialog', { name: 'Open Riverside Youth Club full screen' })).toBeInTheDocument()
  expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
})

test('Android gets a real Install button once the browser offers it', async () => {
  const event = { prompt: jest.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' }) }
  render(<InstallAppPrompt org={org} delayMs={0} win={phone(ANDROID)} />)
  // No browser offer yet: nothing to show.
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => __setDeferredForTests(event))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install' })) })
  expect(event.prompt).toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('"Not now" is remembered', () => {
  const { unmount } = render(<InstallAppPrompt org={org} delayMs={0} win={phone(IPHONE)} />)
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
  expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy()
  unmount()
  render(<InstallAppPrompt org={org} delayMs={0} win={phone(IPHONE)} />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('nothing is offered once installed, and the status bar gets its strip', () => {
  const installed = phone(IPHONE, { navigator: { userAgent: IPHONE, standalone: true } })
  const { container } = render(<><InstallAppPrompt org={org} delayMs={0} win={installed} /><StatusBarStrip color="#0B3B40" win={installed} /></>)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(container.querySelector('[data-status-strip]')).not.toBeNull()
})

test('in the browser there is no strip', () => {
  const { container } = render(<StatusBarStrip color="#0B3B40" win={phone(IPHONE)} />)
  expect(container.querySelector('[data-status-strip]')).toBeNull()
})

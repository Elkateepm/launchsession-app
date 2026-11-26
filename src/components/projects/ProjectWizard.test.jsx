import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ProjectWizard from './ProjectWizard'

jest.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) }), rpc: jest.fn() } }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
jest.mock('../../lib/today', () => ({ todayInLondon: () => '2026-11-26' }))

const org = { id: 'o1', name: 'Riverside', primary_color: '#0E7C86' }

test('a school holiday fills in the name and dates in one tap', () => {
  render(<ProjectWizard org={org} session={{ user: { id: 'u1' } }} onClose={jest.fn()} />)
  const continueBtn = screen.getByRole('button', { name: 'Continue' })
  expect(continueBtn).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Christmas holidays 2026/ }))
  expect(screen.getByLabelText(/Project name/)).toHaveValue('Christmas holiday club 2026')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-12-21')
  expect(screen.getByLabelText('End date')).toHaveValue('2027-01-01')
  expect(screen.getByText(/7 days so far, 3 bank holidays left out/)).toBeInTheDocument()
  expect(continueBtn).toBeEnabled()
})

test('keeps a name you typed when you pick a holiday', () => {
  render(<ProjectWizard org={org} session={{ user: { id: 'u1' } }} onClose={jest.fn()} />)
  fireEvent.change(screen.getByLabelText(/Project name/), { target: { value: 'Winter Wonderland' } })
  fireEvent.click(screen.getByRole('button', { name: /Christmas holidays 2026/ }))
  expect(screen.getByLabelText(/Project name/)).toHaveValue('Winter Wonderland')
})

test('says when the end date is before the start', () => {
  render(<ProjectWizard org={org} session={{ user: { id: 'u1' } }} onClose={jest.fn()} />)
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-02-19' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-02-15' } })
  expect(screen.getByText('The end date is before the start date.')).toBeInTheDocument()
})

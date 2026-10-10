import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ProjectAttention from './ProjectAttention'
import { brandPalette } from '../../lib/brandColors'

jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ Session: 'Activity' }) }))
const org = { name: 'Our Club', branding_enabled: true, primary_color: '#6138CF' }
const items = Array.from({ length: 8 }, (_, i) => ({ id: `risk-${i}`, kind: 'safety', reason: 'risk', day: { id: `d${i}`, title: `Autumn — Day ${i + 1}`, session_date: `2026-10-${20 + i}` } }))

test('shows the full total and reveals checks beyond the five-row preview', () => {
  const onNavigate = jest.fn()
  render(<ProjectAttention org={org} projectId="p1" projectName="Autumn" items={items} onNavigate={onNavigate} />)
  expect(screen.getByText('8 actions to move things forward.')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Review day:/ })).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: 'Show all 8 actions' }))
  expect(screen.getAllByRole('button', { name: /^Review day:/ })).toHaveLength(8)
  fireEvent.click(screen.getByRole('button', { name: /Review day: Autumn — Day 8/ }))
  expect(onNavigate).toHaveBeenCalledWith('planner', { editSessionId: 'd7' })
  expect(screen.getByText('Day 8')).toBeInTheDocument()
})

test('filters follow-ups without losing the overall total', () => {
  const onNavigate = jest.fn()
  render(<ProjectAttention org={org} projectId="p1" items={[...items, { id: 'close', kind: 'register', reason: 'close', day: { id: 'old', title: 'Finished activity', session_date: '2026-09-01' } }]} onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Registers 1' }))
  expect(screen.queryByRole('button', { name: /^Review day:/ })).not.toBeInTheDocument()
  expect(screen.getByText('9 actions to move things forward.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Open register:/ }))
  expect(onNavigate).toHaveBeenCalledWith('registers', { sessionId: 'old', returnTo: 'projects', projectId: 'p1' })
})

test('partial failures show an incomplete state and a working retry', () => {
  const retry = jest.fn()
  render(<ProjectAttention org={org} items={[]} unavailable={['risk links']} onRetry={retry} />)
  expect(screen.queryByText('A little breathing room.')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('The list may be incomplete')
  fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
  expect(retry).toHaveBeenCalled()
})

test('uses the entitled palette and falls back when branding is disabled', () => {
  const { rerender } = render(<ProjectAttention org={org} items={[]} />)
  expect(screen.getByRole('region', { name: 'Needs attention' }).style.getPropertyValue('--attention-ink')).toBe(brandPalette(org.primary_color, false).ink)
  rerender(<ProjectAttention org={{ ...org, branding_enabled: false }} items={[]} />)
  expect(screen.getByRole('region', { name: 'Needs attention' }).style.getPropertyValue('--attention-ink')).toBe(brandPalette('#3B82F6', false).ink)
  expect(screen.getByText('No missing risk links, register follow-ups or reflections found.')).toBeInTheDocument()
})

import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import AttentionList, { sortAttention, attentionSummary } from './AttentionList'

const items = () => [
  { key: 'reflections', icon: 'edit', urgency: 'soon', title: '61 reflections to write', detail: 'Start with Football from Tuesday.', action: 'Write this one', onAction: jest.fn(), secondary: { label: 'See all', onClick: jest.fn() } },
  { key: 'safeguarding', icon: '🛡️', urgency: 'urgent', title: '1 safeguarding concern to review', detail: 'Open and waiting for next steps.', action: 'Review now', onAction: jest.fn(), snoozable: false },
  { key: 'hr', icon: 'hr', urgency: 'later', title: '90 HR tasks', detail: 'Compliance and supervisions.', action: 'Open HR', onAction: jest.fn() },
]

beforeEach(() => localStorage.clear())

test('the most urgent comes first, and the summary says how much is urgent', () => {
  expect(sortAttention(items()).map(i => i.key)).toEqual(['safeguarding', 'reflections', 'hr'])
  expect(attentionSummary(items())).toBe('1 urgent thing first, then 2 more when you can.')
  expect(attentionSummary(items().filter(i => i.urgency !== 'urgent'))).toBe('Nothing urgent. 2 things when you have a moment.')
})

test('each item has one button that does the next step', () => {
  const list = items()
  render(<AttentionList items={list} today="2026-11-20" storageKey="k" />)
  const reflections = screen.getByRole('article', { name: '61 reflections to write' })
  fireEvent.click(within(reflections).getByRole('button', { name: /Write this one/ }))
  expect(list[0].onAction).toHaveBeenCalled()
  fireEvent.click(within(reflections).getByRole('button', { name: 'See all' }))
  expect(list[0].secondary.onClick).toHaveBeenCalled()
  expect(within(reflections).getByText('This week')).toBeInTheDocument()
})

test('items can be hidden until tomorrow, but never a safeguarding concern', () => {
  const { unmount } = render(<AttentionList items={items()} today="2026-11-20" storageKey="k" />)
  expect(screen.queryByRole('button', { name: /Hide "1 safeguarding concern/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Hide "90 HR tasks" until tomorrow/ }))
  expect(screen.queryByRole('article', { name: '90 HR tasks' })).toBeNull()
  expect(screen.getByText('1 hidden until tomorrow.')).toBeInTheDocument()
  unmount()
  // Still hidden later today, back tomorrow.
  const again = render(<AttentionList items={items()} today="2026-11-20" storageKey="k" />)
  expect(screen.queryByRole('article', { name: '90 HR tasks' })).toBeNull()
  again.unmount()
  render(<AttentionList items={items()} today="2026-11-21" storageKey="k" />)
  expect(screen.getByRole('article', { name: '90 HR tasks' })).toBeInTheDocument()
})

test('nothing to do reads as all caught up', () => {
  render(<AttentionList items={[]} today="2026-11-20" storageKey="k" />)
  expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument()
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ActivityLibrary from './ActivityLibrary'

const mockWrites = []
const mockRows = [{ id: 'a1', org_id: 'o1', kind: 'game', title: 'Dodgeball', minutes: 15, equipment: ['Soft balls'], use_count: 2 }]
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: t => {
      const q = {
        select: () => q, eq: () => q, order: () => q,
        insert: v => { mockWrites.push(['insert', v]); const r = { select: () => ({ single: () => Promise.resolve({ data: { id: 'n' }, error: null }) }), then: (a, b) => Promise.resolve({ error: null }).then(a, b) }; return r },
        update: v => { mockWrites.push(['update', v]); return { eq: () => ({ eq: () => Promise.resolve({ error: null }), then: (a, b) => Promise.resolve({ error: null }).then(a, b) }) } },
        then: (a, b) => Promise.resolve({ data: mockRows, error: null }).then(a, b),
      }
      return q
    },
  },
}))
jest.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'o1' }
beforeEach(() => { mockWrites.length = 0 })

test('pick: your activities and built-in ideas, searchable, added as a fresh block', async () => {
  const onPick = jest.fn()
  render(<ActivityLibrary org={org} mode="pick" canWrite onPick={onPick} onClose={jest.fn()} />)
  expect(await screen.findByText('Dodgeball')).toBeInTheDocument()
  expect(screen.getByText('Capture the flag')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: 'soft balls' } })
  expect(screen.queryByText('Capture the flag')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '+ Add to plan' }))
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dodgeball', kind: 'game', minutes: 15, equipment: ['Soft balls'] }))
  expect(onPick.mock.calls[0][0].id).not.toBe('a1')
  expect(mockWrites).toContainEqual(['update', { use_count: 3 }])
})

test('manage: staff add a new activity', async () => {
  render(<ActivityLibrary org={org} mode="manage" canWrite onClose={jest.fn()} />)
  await screen.findByText('Dodgeball')
  fireEvent.click(screen.getByRole('button', { name: '+ New' }))
  fireEvent.change(screen.getByPlaceholderText('e.g. Small-sided game'), { target: { value: 'Rounders' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))
  await waitFor(() => expect(mockWrites.some(w => w[0] === 'insert')).toBe(true))
  expect(mockWrites.find(w => w[0] === 'insert')[1]).toMatchObject({ org_id: 'o1', title: 'Rounders', kind: 'activity', minutes: 15 })
})

test('without write access, browse only', async () => {
  render(<ActivityLibrary org={org} mode="manage" canWrite={false} onClose={jest.fn()} />)
  await screen.findByText('Dodgeball')
  expect(screen.queryByRole('button', { name: '+ New' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
})

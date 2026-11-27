import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import SessionBuilder from './SessionBuilder'

const mockWrites = []
const mockRows = {
  templates: [{ id: 't1', title: 'Standard Football Session', is_global: true, content: { body: '<h2>Warm Up (15 mins)</h2><ul><li>Jog</li></ul><h2>Small-sided Games (30 mins)</h2>' } }],
  activity_library: [],
}
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: t => {
      const q = {
        select: () => q, eq: () => q, order: () => q, single: () => Promise.resolve({ data: { id: 'x' }, error: null }),
        update: v => { mockWrites.push([t, 'update', v]); return { eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 's1' }], error: null }) }) }) } },
        insert: v => { mockWrites.push([t, 'insert', v]); return { select: () => ({ single: () => Promise.resolve({ data: { id: 'n' }, error: null }) }), then: (r, j) => Promise.resolve({ error: null }).then(r, j) } },
        then: (r, j) => Promise.resolve({ data: mockRows[t] || [], error: null }).then(r, j),
      }
      return q
    },
  },
}))
jest.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'o1', name: 'Riverside' }
const session = { id: 's1', title: 'Saturday multi-sports', session_date: '2026-11-28', start_time: '10:00', end_time: '11:30', bubbles: ['Juniors', 'Seniors'] }
const staff = [{ id: 'u1', full_name: 'Sam Taylor' }]

beforeEach(() => { mockWrites.length = 0 })

test('an empty plan offers a starting shape that fills the session, then saves', async () => {
  const onSaved = jest.fn()
  render(<SessionBuilder org={org} session={session} staff={staff} userRole="admin" onClose={jest.fn()} onSaved={onSaved} />)
  expect(screen.getByText('Plan what happens, minute by minute')).toBeInTheDocument()
  expect(screen.getByText('Nothing planned yet for 90 minutes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start with a shape' }))
  const order = screen.getByRole('list', { name: 'Running order' })
  expect(within(order).getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('All 90 minutes planned')).toBeInTheDocument()
  expect(within(order).getByText('10:00')).toBeInTheDocument()

  // Five minutes more on the warm-up pushes the plan over.
  fireEvent.click(screen.getByRole('button', { name: 'Five minutes more for Warm-up' }))
  expect(screen.getByText('5 min over the session')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  const [, , patch] = mockWrites.find(w => w[0] === 'sessions')
  expect(patch.plan.map(b => b.kind)).toEqual(['welcome', 'warmup', 'activity', 'game', 'reflection'])
  expect(patch.plan[1].minutes).toBe(20)
  expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
})

test('edit a block in place: name, lead, groups, equipment roll up into What to bring', () => {
  render(<SessionBuilder org={org} session={{ ...session, plan: [{ id: 'b1', kind: 'game', title: 'Game', minutes: 20 }] }} staff={staff} userRole="staff" onClose={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /^Game, 20 minutes\. Edit/ }))
  fireEvent.change(screen.getByPlaceholderText('e.g. Small-sided game'), { target: { value: 'Capture the flag' } })
  fireEvent.change(screen.getByLabelText('Who leads it'), { target: { value: 'u1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Juniors' }))
  const kit = screen.getByLabelText('Add equipment')
  fireEvent.change(kit, { target: { value: 'Bibs' } })
  fireEvent.keyDown(kit, { key: 'Enter' })
  expect(screen.getByText('Bibs', { selector: 'b' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled()
})

test('a free-text plan template becomes blocks', async () => {
  render(<SessionBuilder org={org} session={session} staff={staff} userRole="admin" onClose={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use a plan' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use this plan' }))
  const items = within(screen.getByRole('list', { name: 'Running order' })).getAllByRole('listitem')
  expect(items.map(li => li.textContent)).toEqual([expect.stringContaining('Warm Up'), expect.stringContaining('Small-sided Games')])
  expect(screen.getByText('45 of 90 min planned · 45 min spare')).toBeInTheDocument()
})

test('admins can save the plan as a template, with blocks and a readable body', async () => {
  render(<SessionBuilder org={org} session={{ ...session, plan: [{ id: 'b1', kind: 'game', title: 'Game', minutes: 20 }] }} staff={staff} userRole="owner" onClose={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as a plan template' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save template' }))
  await waitFor(() => expect(mockWrites.some(w => w[0] === 'templates')).toBe(true))
  const [, , row] = mockWrites.find(w => w[0] === 'templates')
  expect(row).toMatchObject({ type: 'session_plan', title: 'Saturday multi-sports', is_global: false })
  expect(row.content.blocks[0]).toMatchObject({ kind: 'game', title: 'Game', minutes: 20 })
  expect(row.content.body).toContain('<h2>Game (20 mins)</h2>')
})

test('volunteers cannot save plan templates or write to the library', () => {
  render(<SessionBuilder org={org} session={{ ...session, plan: [{ id: 'b1', kind: 'game', title: 'Game', minutes: 20 }] }} staff={staff} userRole="volunteer" onClose={jest.fn()} />)
  expect(screen.queryByRole('button', { name: 'Save as a plan template' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Game, 20 minutes\. Edit/ }))
  expect(screen.queryByRole('button', { name: 'Save to library' })).not.toBeInTheDocument()
})

test('Run it shows the running order', () => {
  render(<SessionBuilder org={org} session={{ ...session, plan: [{ id: 'b1', kind: 'game', title: 'Game', minutes: 20, safety: 'Agree boundaries' }] }} staff={staff} userRole="admin" onClose={jest.fn()} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Run it' }))
  expect(screen.getByText('Agree boundaries')).toBeInTheDocument()
})

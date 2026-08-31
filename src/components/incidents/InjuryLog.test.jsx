import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InjuryLog from './InjuryLog'

const NOW = new Date('2026-08-31T12:00:00Z')

jest.mock('../../lib/supabase', () => {
  const rows = [
    {
      id: 'i1', reported_by: 'u1', occurred_at: '2026-08-20T15:00:00Z', created_at: '2026-08-20T15:05:00Z',
      what_happened: 'Tripped on the step.', injury_type: 'Cut or graze', body_part: 'Knee',
      sent_to_hospital: false, parent_notified: false, follow_up_needed: false,
      child: { first_name: 'Ada', last_name: 'Lovelace', group_name: 'Tigers' }, session: null,
    },
    {
      id: 'i2', reported_by: 'u2', occurred_at: '2026-08-29T15:00:00Z', created_at: '2026-08-29T15:05:00Z',
      what_happened: 'Fell from the climbing frame.', sent_to_hospital: true,
      parent_notified: true, parent_notified_at: '2026-08-29T16:00:00Z', parent_notified_method: 'Phone call',
      follow_up_needed: true, follow_up_notes: 'Check the frame fixings',
      child: { first_name: 'Blaise', last_name: 'Pascal' }, session: { title: 'Tuesday Club' },
    },
    {
      id: 'i3', reported_by: 'u1', occurred_at: '2026-08-30T15:00:00Z', created_at: '2026-08-30T15:05:00Z',
      what_happened: 'Nosebleed, settled quickly.', sent_to_hospital: false,
      parent_notified: true, follow_up_needed: false,
      child: { first_name: 'Cleo', last_name: 'Nunn' }, session: null,
    },
  ]
  const updates = []
  const chain = {
    select: () => chain, order: () => chain, limit: () => chain, eq: () => chain,
    update: (values) => { updates.push(values); return chain },
    then: (resolve) => Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return {
    supabase: { from: () => chain, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
    __updates: updates,
  }
})

const { __updates } = require('../../lib/supabase')

const org = { id: 'o1', name: 'Solidarity Sports' }
const setup = (props = {}) => render(
  <InjuryLog org={org} session={{ user: { id: 'u1' } }} isAdmin={false} {...props} />)

beforeEach(() => { __updates.length = 0 })

describe('what still needs doing', () => {
  it('opens on the unfinished entries, not the newest', async () => {
    setup()
    // Ada (parent not told) and Blaise (follow-up open). Cleo is finished.
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    expect(screen.getByText('Blaise Pascal')).toBeInTheDocument()
    expect(screen.queryByText('Cleo Nunn')).not.toBeInTheDocument()
  })

  it('says how many are unfinished and why', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/2 entries need finishing/i)).toBeInTheDocument())
  })

  it('puts an untold parent above an open follow-up', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    const names = screen.getAllByText(/Ada Lovelace|Blaise Pascal/).map(n => n.textContent)
    expect(names[0]).toBe('Ada Lovelace')
  })

  it('shows everything when asked', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Everything \(3\)/))
    await waitFor(() => expect(screen.getByText('Cleo Nunn')).toBeInTheDocument())
  })
})

describe('finishing an entry', () => {
  // The gap in the first version: an injury logged with "parent not told yet"
  // could never be updated, because the log was read-only.
  it('records that a parent has since been told, and how', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Parent has been told'))
    fireEvent.click(await screen.findByText('Phone call'))
    await waitFor(() => expect(__updates.length).toBeGreaterThan(0))
    const patch = __updates[0]
    expect(patch.parent_notified).toBe(true)
    expect(patch.parent_notified_method).toBe('Phone call')
    expect(patch.parent_notified_at).toBeTruthy()
    expect(patch.parent_notified_by).toBe('u1')
  })

  it('closes an open follow-up', async () => {
    setup({ isAdmin: true })
    await waitFor(() => expect(screen.getByText('Blaise Pascal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Follow-up done'))
    await waitFor(() => expect(__updates.length).toBeGreaterThan(0))
    expect(__updates[0]).toEqual({ follow_up_needed: false })
  })
})

describe('who may change an entry', () => {
  it('offers no action on somebody else’s entry', async () => {
    // Blaise's was logged by u2; the viewer is u1 and not an admin. The
    // policies would refuse the update, so the button is not offered.
    setup()
    await waitFor(() => expect(screen.getByText('Blaise Pascal')).toBeInTheDocument())
    expect(screen.queryByText('Follow-up done')).not.toBeInTheDocument()
    // Their own entry still offers one.
    expect(screen.getByText('Parent has been told')).toBeInTheDocument()
  })

  it('lets an admin finish anyone’s entry', async () => {
    setup({ isAdmin: true })
    await waitFor(() => expect(screen.getByText('Blaise Pascal')).toBeInTheDocument())
    expect(screen.getByText('Follow-up done')).toBeInTheDocument()
  })
})

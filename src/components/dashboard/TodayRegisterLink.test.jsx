import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Today from './Today'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(() => ({ on() { return this }, subscribe() { return this }, unsubscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
jest.mock('../../lib/hrAccess', () => ({ useHrAttention: () => ({ total: 0, items: [] }) }))

const org = { id: 'org-1', name: 'Solidarity Sports', primary_color: '#4714ff' }

// A session running right now, with nobody marked in — the state in the
// screenshot: "October — Day 2", register not started.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
const SESSION = {
  id: 'sess-42', org_id: 'org-1', title: 'October — Day 2', session_date: today,
  start_time: '00:01', end_time: '23:59', location: 'Fulham Hub', status: 'published',
}

function mockTables({ sessions = [SESSION], attendance = [], staff = [] } = {}) {
  supabase.from.mockImplementation((table) => {
    const data = { sessions, attendance, session_staff: staff }[table] ?? []
    const res = Promise.resolve({ data, error: null })
    const q = {
      select: () => q, eq: () => q, in: () => q, gte: () => q, lte: () => q,
      or: () => q, order: () => q, limit: () => q, maybeSingle: () => Promise.resolve({ data: data[0] || null, error: null }),
      then: (a, b) => res.then(a, b), catch: (a) => res.catch(a), finally: (a) => res.finally(a),
    }
    return q
  })
}

beforeEach(() => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  supabase.rpc.mockResolvedValue({ data: null, error: null })
  mockTables()
})

describe('Today → Open register', () => {
  // With one session affected, both the attention row and the Running now card
  // read "Open register" — and both should open that session.
  it('opens the session the button is about, not the list of every register', async () => {
    const onNavigate = jest.fn()
    render(<Today access={{ schedule: true, registers: true, registerEdit: true }} org={org} session={{ user: { id: 'u1' } }} userProfile={{ role: 'admin' }} onNavigate={onNavigate} />)

    const buttons = await screen.findAllByRole('button', { name: /^Open register$/ })
    expect(buttons).toHaveLength(2)

    buttons.forEach(b => fireEvent.click(b))
    expect(onNavigate).toHaveBeenCalledTimes(2)
    onNavigate.mock.calls.forEach(([tab, payload]) => {
      expect(tab).toBe('registers')
      expect(payload).toMatchObject({ sessionId: 'sess-42' })
    })
  })

  it('comes back to Today rather than dumping you on the register list', async () => {
    const onNavigate = jest.fn()
    render(<Today access={{ schedule: true, registers: true, registerEdit: true }} org={org} session={{ user: { id: 'u1' } }} userProfile={{ role: 'admin' }} onNavigate={onNavigate} />)

    const [first] = await screen.findAllByRole('button', { name: /^Open register$/ })
    fireEvent.click(first)
    expect(onNavigate.mock.calls[0][1]).toMatchObject({ returnTo: 'today' })
  })

  it('names the session in the attention row when only one register is affected', async () => {
    render(<Today access={{ schedule: true, registers: true, registerEdit: true }} org={org} session={{ user: { id: 'u1' } }} userProfile={{ role: 'admin' }} onNavigate={jest.fn()} />)
    expect(await screen.findByText(/October — Day 2 is running with nobody marked in/)).toBeInTheDocument()
  })

  it('stays generic when more than one register needs attention', async () => {
    mockTables({
      sessions: [SESSION, { ...SESSION, id: 'sess-43', title: 'October — Day 3' }],
    })
    const onNavigate = jest.fn()
    render(<Today access={{ schedule: true, registers: true, registerEdit: true }} org={org} session={{ user: { id: 'u1' } }} userProfile={{ role: 'admin' }} onNavigate={onNavigate} />)

    const generic = await screen.findByRole('button', { name: /^Open registers$/ })
    fireEvent.click(generic)
    // No session id: two sessions qualify, so there is no single right answer.
    expect(onNavigate).toHaveBeenCalledWith('registers', undefined)
  })
})

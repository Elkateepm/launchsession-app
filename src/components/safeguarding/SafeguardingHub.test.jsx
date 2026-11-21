import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SafeguardingHub from './SafeguardingHub'

// One open concern nobody has told the lead about, one open case, one injury a
// parent has not heard about, and a worried check-in. Dates are fixed relative
// to now so the "raised yesterday" wording holds whenever this runs.
jest.mock('../../lib/supabase', () => {
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString()
  const rows = {
    cause_for_concern: [
      { id: 'cf1', child_id: 'g1', child_name: 'Jordan Miles', concern_type: 'Neglect', status: 'open', priority: 'high', dsl_notified: false, assigned_to: null, created_at: day(1), description: 'Arrived hungry again.', submitter_name: 'Aisha' },
      { id: 'cf2', child_id: 'g2', child_name: 'Ruby Clarke', concern_type: 'Physical', status: 'closed', dsl_notified: true, assigned_to: 'u1', created_at: day(30), closed_at: day(20) },
    ],
    cases: [{ id: 'cs1', child_id: 'g3', child_name: 'Sami Haddad', category: 'Bullying', status: 'open', risk_level: 'medium', assigned_to_user_id: 'u1', created_at: day(6), archived: false }],
    case_tasks: [],
    child_injuries: [{ id: 'i1', child_id: 'g2', child_name: 'Ruby Clarke', occurred_at: day(2), injury_type: 'Graze', parent_notified: false }],
    wellbeing_checks: [{ id: 'w1', child_id: 'g1', mood: 'worried', created_at: day(1) }],
    children: [
      { id: 'g1', first_name: 'Jordan', last_name: 'Miles', active: true },
      { id: 'g2', first_name: 'Ruby', last_name: 'Clarke', active: true },
      { id: 'g3', first_name: 'Sami', last_name: 'Haddad', active: true },
    ],
    sessions: [],
    user_profiles: [],
    attendance: [],
    safeguarding_audit_log: [],
    case_audit_log: [],
  }
  const make = (table) => {
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain, in: () => chain, order: () => chain, limit: () => chain, ilike: () => chain,
      maybeSingle: () => Promise.resolve({ data: null }),
      single: () => Promise.resolve({ data: null }),
      insert: () => Promise.resolve({ error: null }),
      update: () => chain,
      then: (resolve) => Promise.resolve({ data: rows[table] || [] }).then(resolve),
    }
    return chain
  }
  return {
    supabase: {
      from: make,
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  }
})

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#1B9AAA', dsl_name: 'Aisha Rahman', dsl_phone: '07700 900123' }
const setup = (props = {}) => {
  const onNavigate = jest.fn()
  render(<SafeguardingHub org={org} session={{ user: { id: 'u1' } }} isAdmin onNavigate={onNavigate} access={{ registers: true, medical: true, people: true, risk: true }} {...props} />)
  return { onNavigate }
}

describe('the Safeguarding Hub', () => {
  it('says what needs doing, one item per concern', async () => {
    setup()
    const first = await screen.findByRole('article', { name: /Jordan Miles/ })
    const list = first.closest('section')
    const items = within(list).getAllByRole('article')
    expect(items.map(a => a.getAttribute('aria-label'))).toEqual([
      "Jordan Miles: the safeguarding lead hasn't been told",
      '1 parent not told about an injury',
    ])
    expect(within(list).getByText(/Neglect concern, raised yesterday · Nobody owns it/)).toBeInTheDocument()
    expect(screen.getByText('2 things to sort out now · 1 open concern · 1 open case')).toBeInTheDocument()
  })

  it('opens the concern in place, linked to the child\'s file', async () => {
    setup()
    const item = await screen.findByRole('article', { name: /Jordan Miles/ })
    fireEvent.click(within(item).getByRole('button', { name: /Open concern/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Jordan Miles' })
    expect(within(sheet).getByText(/Still to sort out: the safeguarding lead hasn't been told, nobody owns it/)).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: /Jordan Miles's file/ }))
    const file = await screen.findByRole('dialog', { name: 'Jordan Miles' })
    expect(within(file).getByText('Neglect concern raised')).toBeInTheDocument()
    expect(within(file).getByText('Check-in: worried')).toBeInTheDocument()
  })

  it('opens a child\'s file from a link elsewhere and links on to their profile', async () => {
    const { onNavigate } = setup({ initialOpenChildId: 'g2' })
    const file = await screen.findByRole('dialog', { name: 'Ruby Clarke' })
    expect(within(file).getByText('Injury: Graze')).toBeInTheDocument()
    fireEvent.click(within(file).getByRole('button', { name: /Full profile/ }))
    expect(onNavigate).toHaveBeenCalledWith('children', { openChildId: 'g2' })
  })

  it('shows the lead and lets you call them from the top of the page', async () => {
    setup()
    await screen.findByRole('article', { name: /Jordan Miles/ })
    expect(screen.getByRole('link', { name: /Call Aisha/ })).toHaveAttribute('href', 'tel:07700900123')
  })
})

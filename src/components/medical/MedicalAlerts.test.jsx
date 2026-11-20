import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import MedicalAlerts from './MedicalAlerts'

// Modelled on the real Solidarity Sports data: an anaphylaxis-risk allergy that
// only the text reveals, a boolean condition, and someone with nothing urgent.
// The fixtures live inside the mock factory because jest hoists it above the
// imports, so it cannot close over anything declared out here.
jest.mock('../../lib/supabase', () => {
  const children = [
    { id: 'c1', first_name: 'Ethan', last_name: 'Clarke', active: true, allergies: 'Nut allergy' },
    { id: 'c2', first_name: 'Kezia', last_name: 'Asante', active: true, has_asthma: true, has_diabetes: true },
    { id: 'c3', first_name: 'Aaliyah', last_name: 'Baptiste', active: true, allergies: 'Latex allergy' },
    { id: 'c4', first_name: 'Quiet', last_name: 'Child', active: true, medical_notes: 'Wears glasses' },
    { id: 'c5', first_name: 'Nothing', last_name: 'Recorded', active: true, medical_notes: 'None' },
  ]
  const sessions = [{ id: 's1', title: 'Tuesday Club', start_time: '17:00', end_time: '19:00' }]
  const attendance = [
    { child_id: 'c1', status: 'signed_in', session_id: 's1' },
    { child_id: 'c4', status: 'expected', session_id: 's1' },
  ]
  const rows = { children, sessions, attendance, medical_alert_reviews: [] }
  const make = (table) => {
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain, in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: null }),
      insert: () => Promise.resolve({ error: null }),
      then: (resolve) => Promise.resolve({ data: rows[table] || [] }).then(resolve),
    }
    return chain
  }
  // storageUrl.js subscribes to auth changes at import time, reached from here
  // through vh_shared -> SignedImg.
  return {
    supabase: {
      from: make,
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  }
})

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#1B9AAA' }
const setup = () => render(<MedicalAlerts org={org} session={{ user: { id: 'u1' } }} onNavigate={() => {}} />)

// The page opens on Today, where Ethan is signed in. Waiting for him means the
// data has arrived -- before that every count is zero, and a level with
// nobody in it is deliberately not a button.
const ready = () => screen.findByRole('article', { name: 'Ethan Clarke' })
const level = (name) => screen.getByRole('button', { name: new RegExp(`^${name}:`) })
const card = (name) => screen.queryByRole('article', { name })

describe('the immediate response level', () => {
  it('counts the ones with an emergency protocol behind them', async () => {
    setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^All young people/ }))
    // Ethan (nut allergy, read from the text) and Kezia (asthma, diabetes).
    await waitFor(() => expect(level('Immediate response')).toHaveAccessibleName(/Immediate response: 2/))
  })

  it('narrows the list to exactly those children when tapped', async () => {
    setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^All young people/ }))
    await waitFor(() => expect(card('Aaliyah Baptiste')).toBeInTheDocument())
    fireEvent.click(level('Immediate response'))
    await waitFor(() => expect(card('Aaliyah Baptiste')).not.toBeInTheDocument())
    expect(card('Ethan Clarke')).toBeInTheDocument()
    expect(card('Kezia Asante')).toBeInTheDocument()
    expect(card('Quiet Child')).not.toBeInTheDocument()
    // Tapping it again shows everyone.
    fireEvent.click(level('Immediate response'))
    await waitFor(() => expect(card('Aaliyah Baptiste')).toBeInTheDocument())
  })
})

describe('the page', () => {
  it('opens on today, grouped by urgency', async () => {
    setup()
    await ready()
    expect(screen.getByRole('region', { name: 'Immediate response' })).toContainElement(card('Ethan Clarke'))
    expect(screen.getByRole('region', { name: 'Worth knowing' })).toContainElement(card('Quiet Child'))
    // Not on today's register.
    expect(card('Kezia Asante')).not.toBeInTheDocument()
  })

  it('never lists a child whose only entry was a placeholder', async () => {
    setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^All young people/ }))
    await waitFor(() => expect(card('Aaliyah Baptiste')).toBeInTheDocument())
    expect(card('Nothing Recorded')).not.toBeInTheDocument()
  })

  it('filters by condition', async () => {
    setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^All young people/ }))
    await waitFor(() => expect(card('Aaliyah Baptiste')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Asthma/ }))
    await waitFor(() => expect(card('Ethan Clarke')).not.toBeInTheDocument())
    expect(card('Kezia Asante')).toBeInTheDocument()
  })

  it('signs off from the card and says so', async () => {
    setup()
    await ready()
    fireEvent.click(within(card('Ethan Clarke')).getByRole('button', { name: 'Sign off' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm sign-off' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Signed off: Ethan Clarke')
  })
})

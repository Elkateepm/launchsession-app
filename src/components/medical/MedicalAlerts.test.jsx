import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
// data has arrived -- before that the counts are all zero, and a stat with a
// count of zero is deliberately not a button.
const ready = () => screen.findByText('Ethan Clarke')
const statFor = (label) => screen.getByText(label).closest('button')

describe('following the immediate response number', () => {
  it('counts the ones with an emergency protocol behind them', async () => {
    setup()
    await ready()
    // Ethan (nut allergy, read from the text) and Kezia (asthma, diabetes).
    expect(statFor('Immediate response')).toHaveTextContent('2')
  })

  it('shows exactly those children when the number is clicked', async () => {
    setup()
    await ready()
    fireEvent.click(statFor('Immediate response'))

    await waitFor(() => expect(screen.getByText('Ethan Clarke')).toBeInTheDocument())
    expect(screen.getByText('Kezia Asante')).toBeInTheDocument()
    // And nobody else.
    expect(screen.queryByText('Aaliyah Baptiste')).not.toBeInTheDocument()
    expect(screen.queryByText('Quiet Child')).not.toBeInTheDocument()
  })

  it('never lists a child whose only entry was a placeholder', async () => {
    setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /All young people/i }))
    await waitFor(() => expect(screen.getByText('Aaliyah Baptiste')).toBeInTheDocument())
    expect(screen.queryByText('Nothing Recorded')).not.toBeInTheDocument()
  })

  it('offers a way back to everyone', async () => {
    setup()
    await ready()
    fireEvent.click(statFor('Immediate response'))
    await waitFor(() => expect(screen.queryByText('Aaliyah Baptiste')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /All young people/i }))
    await waitFor(() => expect(screen.getByText('Aaliyah Baptiste')).toBeInTheDocument())
  })

  it('reaches the same list from the banner on Today', async () => {
    setup()
    await ready()
    // Ethan is on today's register and needs an immediate response.
    fireEvent.click(screen.getByText(/immediate response plan/i).closest('button'))
    await waitFor(() => expect(screen.getByText('Kezia Asante')).toBeInTheDocument())
  })
})

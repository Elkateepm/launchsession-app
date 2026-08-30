import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CauseForConcernForm from './CauseForConcernForm'

// The form fires two differently shaped queries on mount -- .eq().order()
// .limit().then() and .eq().eq().order().then() -- so the stub is chainable and
// only resolves at .then().
jest.mock('../../lib/supabase', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve) => Promise.resolve({ data: [] }).then(resolve),
    insert: () => Promise.resolve({ error: null }),
  }
  return { supabase: { from: () => chain } }
})

const org = { id: 'o1', name: 'Solidarity Sports' }
const liveSession = { id: 's1', title: 'Tuesday Club', session_date: '2026-08-31' }

// The form opens on a warning step; the session field is on the one after it.
const openForm = () => fireEvent.click(screen.getByText(/I understand/))

describe('a concern raised from a live session card', () => {
  it('arrives with that session already attached', () => {
    render(<CauseForConcernForm org={org} session={null} initialSession={liveSession} onClose={() => {}} />)
    openForm()
    expect(screen.getByText('Tuesday Club')).toBeInTheDocument()
  })

  it('lets the reporter detach it, because pre-filling is a convenience not a claim', () => {
    render(<CauseForConcernForm org={org} session={null} initialSession={liveSession} onClose={() => {}} />)
    openForm()
    expect(screen.getByText('Tuesday Club')).toBeInTheDocument()
    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByText('Tuesday Club')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search sessions...')).toBeInTheDocument()
  })

  it('attaches nothing when raised from anywhere else', () => {
    render(<CauseForConcernForm org={org} session={null} onClose={() => {}} />)
    openForm()
    expect(screen.getByPlaceholderText('Search sessions...')).toBeInTheDocument()
  })
})

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportChips from './ReportChips'

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#6D5DF6' }
const people = [{ id: 'c1', first_name: 'Ada', last_name: 'Lovelace', group_name: 'Tigers', active: true }]
const liveSession = { id: 's1', title: 'Tuesday Club', session_date: '2026-08-31', location: 'Main hall' }

const setup = (props = {}) => render(
  <ReportChips org={org} people={people} userProfile={{ id: 'u1', role: 'staff' }}
    onRaiseConcern={() => {}} isMobile={false} {...props} />)

describe('who sees which chip', () => {
  // The UI gate has to match the RLS gate. can_edit_risk() is owner, admin,
  // manager and staff; a volunteer offered the button would hit a policy error.
  it.each(['owner', 'admin', 'manager', 'staff'])('%s can log an injury', (role) => {
    setup({ userProfile: { id: 'u1', role } })
    expect(screen.getByText('Log an injury')).toBeInTheDocument()
  })

  it('a volunteer is not offered the injury chip', () => {
    setup({ userProfile: { id: 'u1', role: 'volunteer' } })
    expect(screen.queryByText('Log an injury')).not.toBeInTheDocument()
  })

  it('a role the app does not know is not offered it either', () => {
    setup({ userProfile: { id: 'u1', role: undefined } })
    expect(screen.queryByText('Log an injury')).not.toBeInTheDocument()
  })

  it('hides the concern chip when the org has no safeguarding module', () => {
    setup({ canRaiseConcern: false })
    expect(screen.queryByText('Raise a concern')).not.toBeInTheDocument()
    expect(screen.getByText('Log an injury')).toBeInTheDocument()
  })

  it('renders nothing at all when neither is available', () => {
    const { container } = setup({ canRaiseConcern: false, userProfile: { id: 'u1', role: 'volunteer' } })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('following the session', () => {
  it('hands the session up when a concern is raised from a live card', () => {
    const onRaiseConcern = jest.fn()
    setup({ linkedSession: liveSession, onRaiseConcern, compact: true })
    fireEvent.click(screen.getByText('Concern'))
    expect(onRaiseConcern).toHaveBeenCalledWith(liveSession)
  })

  it('raises an unattached concern when nothing is running', () => {
    const onRaiseConcern = jest.fn()
    setup({ onRaiseConcern })
    fireEvent.click(screen.getByText('Raise a concern'))
    expect(onRaiseConcern).toHaveBeenCalledWith(null)
  })

  it('opens the injury form already attached to the live session', () => {
    setup({ linkedSession: liveSession, compact: true })
    fireEvent.click(screen.getByText('Injury'))
    // The form says what it will file the injury against.
    expect(screen.getByText(/Recorded against Tuesday Club/)).toBeInTheDocument()
  })

  it('opens an unattached injury form when nothing is running', () => {
    setup()
    fireEvent.click(screen.getByText('Log an injury'))
    expect(screen.queryByText(/Recorded against/)).not.toBeInTheDocument()
  })

  it('shortens its labels on a session card, where space is tight', () => {
    setup({ linkedSession: liveSession, compact: true })
    expect(screen.getByText('Concern')).toBeInTheDocument()
    expect(screen.getByText('Injury')).toBeInTheDocument()
    expect(screen.queryByText('Raise a concern')).not.toBeInTheDocument()
  })
})

describe('living inside a card that is itself a button', () => {
  it('does not open the register when a chip is clicked', () => {
    // The session card is role="button" and opens the live register. Without
    // stopPropagation, reporting an injury would open it behind the form.
    const cardClick = jest.fn()
    render(
      <div onClick={cardClick} role="button">
        <ReportChips org={org} people={people} userProfile={{ id: 'u1', role: 'staff' }}
          linkedSession={liveSession} onRaiseConcern={() => {}} isMobile={false} compact />
      </div>)
    fireEvent.click(screen.getByText('Injury'))
    expect(cardClick).not.toHaveBeenCalled()
    expect(screen.getByText('Save to accident book')).toBeInTheDocument()
  })

  it('does not open the register when the concern chip is clicked', () => {
    const cardClick = jest.fn()
    const onRaiseConcern = jest.fn()
    render(
      <div onClick={cardClick} role="button">
        <ReportChips org={org} people={people} userProfile={{ id: 'u1', role: 'staff' }}
          linkedSession={liveSession} onRaiseConcern={onRaiseConcern} isMobile={false} compact />
      </div>)
    fireEvent.click(screen.getByText('Concern'))
    expect(cardClick).not.toHaveBeenCalled()
    expect(onRaiseConcern).toHaveBeenCalledWith(liveSession)
  })

  it('does not open the register when the open form is interacted with', () => {
    const cardClick = jest.fn()
    render(
      <div onClick={cardClick} role="button">
        <ReportChips org={org} people={people} userProfile={{ id: 'u1', role: 'staff' }}
          linkedSession={liveSession} onRaiseConcern={() => {}} isMobile={false} compact />
      </div>)
    fireEvent.click(screen.getByText('Injury'))
    cardClick.mockClear()
    fireEvent.click(screen.getByPlaceholderText(/In your own words/))
    expect(cardClick).not.toHaveBeenCalled()
  })

  it('does not close the half-written form on a backdrop tap', () => {
    const { container } = setup({ linkedSession: liveSession, compact: true })
    fireEvent.click(screen.getByText('Injury'))
    // jsdom drops backdrop-filter from the style attribute, so the backdrop is
    // found by its positioning instead.
    const backdrop = container.querySelector('div[style*="position: fixed"]')
    fireEvent.click(backdrop)
    expect(screen.getByText('Save to accident book')).toBeInTheDocument()
  })
})

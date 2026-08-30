import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportChips from './ReportChips'

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#6D5DF6' }
const people = [{ id: 'c1', first_name: 'Ada', last_name: 'Lovelace', group_name: 'Tigers', active: true }]

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

describe('behaviour', () => {
  it('raising a concern reuses the modal Home already owns', () => {
    const onRaiseConcern = jest.fn()
    setup({ onRaiseConcern })
    fireEvent.click(screen.getByText('Raise a concern'))
    expect(onRaiseConcern).toHaveBeenCalledTimes(1)
    // And does not open an injury form by mistake.
    expect(screen.queryByText('Log an injury', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('opens the injury form in place', () => {
    setup()
    fireEvent.click(screen.getByText('Log an injury'))
    expect(screen.getByText('Save to accident book')).toBeInTheDocument()
  })

  it('does not close the half-written form on a backdrop tap', () => {
    // A stray tap must not lose an account of an incident.
    const { container } = setup()
    fireEvent.click(screen.getByText('Log an injury'))
    const backdrop = container.querySelector('div[style*="position: fixed"]')
    fireEvent.click(backdrop)
    expect(screen.getByText('Save to accident book')).toBeInTheDocument()
  })
})

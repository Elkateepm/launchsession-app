import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Office from './Office'
import { OFFICE_TABS } from '../dashboard/sidebar/navConfig'

const setup = (props = {}) => render(
  <Office tabs={OFFICE_TABS} subTab="payments" onSelect={() => {}} {...props}>
    <div>Payments screen</div>
  </Office>)

describe('the Office shell', () => {
  it('offers the modules it was given', () => {
    setup()
    for (const label of ['Forms', 'Newsletter', 'Payments', 'Resource Booking', 'Templates', 'Parent Portal']) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the open one for a screen reader, not only by eye', () => {
    setup()
    expect(screen.getByRole('tab', { name: /Payments/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Templates/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates by tab name, so the address bar keeps working', () => {
    // Selecting a module sets the app's tab, which is what ?tab=payments reads.
    const onSelect = jest.fn()
    setup({ onSelect })
    fireEvent.click(screen.getByRole('tab', { name: /Templates/i }))
    expect(onSelect).toHaveBeenCalledWith('templates')
  })

  it('shows only what it is handed, plus Overview', () => {
    // A member who may not open Templates is given the rest, and the shell
    // does no filtering of its own. Overview is the single exception: it is
    // the shell's own way back out, so it is always there and is not a module.
    const allowed = OFFICE_TABS.filter(t => !t.adminOnly)
    setup({ tabs: allowed })
    expect(screen.queryByRole('tab', { name: /Templates/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(allowed.length + 1)
  })

  it('always offers a way back to the overview', () => {
    // Without this the only route out of a module was the sidebar, whose
    // Office row was already highlighted -- so nothing looked clickable.
    const onSelect = jest.fn()
    setup({ onSelect })
    fireEvent.click(screen.getByRole('tab', { name: /Overview/i }))
    expect(onSelect).toHaveBeenCalledWith('office')
  })

  it('marks Overview as the open one when Office is on its landing', () => {
    setup({ subTab: 'office' })
    expect(screen.getByRole('tab', { name: /Overview/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Payments/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders the module handed to it', () => {
    setup()
    expect(screen.getByText('Payments screen')).toBeInTheDocument()
  })

  it('shows an unread count on the module it belongs to', () => {
    setup({ badges: { forms: 3 } })
    expect(screen.getByRole('tab', { name: /Forms/i })).toHaveTextContent('3')
  })

  it('shows no badge when nothing is waiting', () => {
    setup({ badges: { forms: 0 } })
    expect(screen.getByRole('tab', { name: /Forms/i })).not.toHaveTextContent('0')
  })

  it('carries its own scroller', () => {
    // The last hub built this way left its children to scroll themselves and
    // none of them did, so the case list was clipped at the fold for months.
    const { container } = setup()
    const scroller = container.querySelector('div[style*="overflow-y: auto"]')
    expect(scroller).toBeTruthy()
    expect(scroller).toHaveTextContent('Payments screen')
  })
})

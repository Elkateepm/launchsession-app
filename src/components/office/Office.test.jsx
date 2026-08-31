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
    for (const label of ['HR', 'Payments', 'Resource Booking', 'Templates', 'Parent Portal']) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the open one for a screen reader, not only by eye', () => {
    setup()
    expect(screen.getByRole('tab', { name: /Payments/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^HR/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates by tab name, so the address bar keeps working', () => {
    // Selecting a module sets the app's tab, which is what ?tab=payments reads.
    const onSelect = jest.fn()
    setup({ onSelect })
    fireEvent.click(screen.getByRole('tab', { name: /Templates/i }))
    expect(onSelect).toHaveBeenCalledWith('templates')
  })

  it('shows only what it is handed', () => {
    // A member who may not open HR or Templates is given three tabs, and the
    // shell does no filtering of its own.
    setup({ tabs: OFFICE_TABS.filter(t => !t.adminOnly) })
    expect(screen.queryByRole('tab', { name: /^HR/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('renders the module handed to it', () => {
    setup()
    expect(screen.getByText('Payments screen')).toBeInTheDocument()
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

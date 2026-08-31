import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PageHeader from './PageHeader'

// PageHeader is used by most module pages, so the clickable stat has to be
// purely additive: a stat without an onClick must behave exactly as it did.

describe('stat cards', () => {
  it('stays inert when no handler is given', () => {
    render(<PageHeader title="Reports" stats={[{ label: 'Sessions', value: 12, icon: '📅' }]} />)
    expect(screen.getByText('Sessions').closest('button')).toBeNull()
  })

  it('becomes a button when a handler is given', () => {
    const onClick = jest.fn()
    render(<PageHeader title="Medical Alerts" stats={[{ label: 'Immediate response', value: 4, onClick }]} />)
    const btn = screen.getByText('Immediate response').closest('button')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('marks the active one for a screen reader as well as by eye', () => {
    render(<PageHeader title="x" stats={[
      { label: 'A', value: 1, onClick: () => {}, active: true },
      { label: 'B', value: 2, onClick: () => {} },
    ]} />)
    expect(screen.getByText('A').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('B').closest('button')).not.toHaveAttribute('aria-pressed')
  })

  it('mixes clickable and inert stats in one row', () => {
    render(<PageHeader title="x" stats={[
      { label: 'Leads somewhere', value: 1, onClick: () => {} },
      { label: 'Just a number', value: 2 },
    ]} />)
    expect(screen.getByText('Leads somewhere').closest('button')).toBeTruthy()
    expect(screen.getByText('Just a number').closest('button')).toBeNull()
  })

  it('still renders a header with no stats at all', () => {
    render(<PageHeader title="Empty" subtitle="Nothing here" />)
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

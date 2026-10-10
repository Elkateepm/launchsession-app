import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import AddPersonChooser from './AddPersonChooser'
import HandoverRegistration from './HandoverRegistration'

jest.mock('./PublicChildRegistration', () => ({ slug, onRegisterAnother }) => (
  <div>
    <span>form for {slug}</span>
    <button onClick={onRegisterAnother}>Register another family</button>
  </div>
))

const terms = { person: 'young person' }

describe('AddPersonChooser', () => {
  it('offers the three ways and reports which was picked', () => {
    const onPick = jest.fn()
    render(<AddPersonChooser terms={terms} onPick={onPick} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Fill it in now'))
    fireEvent.click(screen.getByText('Send a link'))
    fireEvent.click(screen.getByText('Hand the phone over'))
    expect(onPick.mock.calls.map(c => c[0])).toEqual(['form', 'link', 'handover'])
  })
})

describe('HandoverRegistration', () => {
  const org = { name: 'Solidarity Sports', slug: 'solidarity-sports' }
  // Modern fake timers drive requestAnimationFrame and performance.now together.
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  const advance = ms => act(() => { jest.advanceTimersByTime(ms) })

  it('opens the org form outside the page', () => {
    const { container } = render(<HandoverRegistration org={org} onExit={() => {}} />)
    expect(screen.getByText('form for solidarity-sports')).toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('does not let a parent tap their way back into the app', () => {
    const onExit = jest.fn()
    render(<HandoverRegistration org={org} onExit={onExit} />)
    const exit = screen.getByLabelText(/press and hold/)
    fireEvent.click(exit)
    fireEvent.pointerDown(exit); advance(400); fireEvent.pointerUp(exit); advance(2000)
    expect(onExit).not.toHaveBeenCalled()
  })

  it('exits after a full press and hold', () => {
    const onExit = jest.fn()
    render(<HandoverRegistration org={org} onExit={onExit} />)
    fireEvent.pointerDown(screen.getByLabelText(/press and hold/))
    advance(1300)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

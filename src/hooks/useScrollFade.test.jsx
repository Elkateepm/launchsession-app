import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useScrollFade } from './useScrollFade'

// jsdom does no layout, so the row's widths are set by hand.
function Row({ show }) {
  const fade = useScrollFade('a')
  return show ? <div data-testid="row" ref={fade.ref} style={fade.style}><button aria-pressed="true">a</button></div> : null
}

function Later() {
  const [show, setShow] = useState(false)
  return <><button onClick={() => setShow(true)}>Load</button><Row show={show} /></>
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return 600 } })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 300 } })
})

test('a row that mounts after the component still fades on the side with more', () => {
  render(<Later />)
  fireEvent.click(screen.getByText('Load'))
  const row = screen.getByTestId('row')
  expect(row.style.maskImage).toContain('transparent')
  row.scrollLeft = 300
  fireEvent.scroll(row)
  expect(row.style.maskImage).toBe('linear-gradient(90deg, transparent, #000 28px, #000)')
})

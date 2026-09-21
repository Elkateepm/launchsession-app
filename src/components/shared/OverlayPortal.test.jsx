import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import OverlayPortal from './OverlayPortal'

test('dialog escapes a transformed clipped card and does not activate it', () => {
  const openCard = jest.fn()
  const close = jest.fn()
  const { container } = render(<div onClick={openCard} style={{ transform: 'translateY(-2px)', overflow: 'hidden' }}>
    <OverlayPortal><div role="dialog"><button onClick={close}>Close</button></div></OverlayPortal>
  </div>)
  expect(container).not.toContainElement(screen.getByRole('dialog'))
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledTimes(1)
  expect(openCard).not.toHaveBeenCalled()
})

test('dialogs remain visible in fullscreen kiosk mode', () => {
  const fullscreen = document.createElement('div')
  document.body.appendChild(fullscreen)
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: fullscreen })
  const view = render(<OverlayPortal><div role="dialog">Collection details</div></OverlayPortal>)
  expect(fullscreen).toContainElement(screen.getByRole('dialog'))
  view.unmount()
  expect(fullscreen).toBeEmptyDOMElement()
  delete document.fullscreenElement
  fullscreen.remove()
})

import React from 'react'
import { createPortal } from 'react-dom'

// Escape animated/clipped cards. Fullscreen kiosks need their overlays inside
// the fullscreen element; ordinary dialogs belong directly under the body.
export default function OverlayPortal({ children }) {
  return createPortal(
    <div style={{ display: 'contents' }} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>{children}</div>,
    document.fullscreenElement || document.body,
  )
}

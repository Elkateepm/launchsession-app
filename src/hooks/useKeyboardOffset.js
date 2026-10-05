import { useEffect, useState } from 'react'

// How far the on-screen keyboard covers the bottom of the layout viewport, in
// px, or 0 when it is closed.
//
// iOS Safari (and Android Chrome since 108) leave the layout viewport full
// height when the keyboard opens and shrink only the visual viewport, so a
// `position: fixed; bottom: 0` element ends up hidden behind the keys. The gap
// between the bottom of the visual viewport and the bottom of the layout
// viewport is the keyboard. Where a browser or a native shell resizes the
// layout viewport instead, the gap is 0 and `bottom: 0` already sits on top of
// the keyboard, so callers can use the value unconditionally.
export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const gap = document.documentElement.clientHeight - (vv.height + vv.offsetTop)
        // Safari's toolbar collapsing and sub-pixel rounding produce small
        // gaps that are not a keyboard; reacting to them makes the dock jitter.
        setOffset(gap > 80 ? Math.round(gap) : 0)
      })
    }
    measure()
    // iOS also scrolls the visual viewport to keep the focused field in view,
    // which moves its bottom edge without resizing it.
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [])

  return offset
}

import { useEffect, useState } from 'react'

// Whether the dashboard shows the phone layout: the bottom dock rather than
// the side nav. A phone turned sideways gets the side nav, because the dock
// would eat most of a screen that short.
export function computeIsMobileBottomNav(w = window.innerWidth, h = window.innerHeight) {
  const isLandscape = w > h
  if (isLandscape && h < 500) return false
  return w < 768
}

// Re-decided only when the width changes.
//
// On Android an installed app shrinks the page's height when the on-screen
// keyboard opens. On a 360-400px-wide phone that leaves the page wider than it
// is tall, which read as "turned sideways": the dock swapped for the side nav,
// and swapping the layout remounts whatever is open. Tapping into any text box
// threw the session wizard back to step one (or closed it), twice: once as the
// keyboard opened and again as it closed. Turning the phone changes the width;
// the keyboard never does.
export function useMobileBottomNav() {
  const [isMobileBottomNav, setIsMobileBottomNav] = useState(() => computeIsMobileBottomNav())
  useEffect(() => {
    let lastWidth = window.innerWidth
    const handleResize = () => {
      // orientationchange can fire before the new size is in place; the
      // resize that follows carries the new width and is handled then.
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      setIsMobileBottomNav(computeIsMobileBottomNav())
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])
  return isMobileBottomNav
}

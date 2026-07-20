import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}

// Three-way breakpoint for layouts that need to react differently on iPad
// widths (768-1023px) rather than just the binary mobile/desktop split above.
// Does not replace useIsMobile - existing call sites are unaffected.
const TABLET_MIN = 768
const TABLET_MAX = 1024

function getBreakpoint(width) {
  if (width < TABLET_MIN) return { isMobile: true, isTablet: false, isDesktop: false }
  if (width < TABLET_MAX) return { isMobile: false, isTablet: true, isDesktop: false }
  return { isMobile: false, isTablet: false, isDesktop: true }
}

export function useBreakpoint() {
  const [state, setState] = useState(() => getBreakpoint(window.innerWidth))
  useEffect(() => {
    const handler = () => setState(getBreakpoint(window.innerWidth))
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])
  return state
}

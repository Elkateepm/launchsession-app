import { useCallback, useEffect, useState } from 'react'

// A row of tabs that scrolls sideways on a phone.
//
// Cut off bare at the screen edge, the last tab looked like it did not exist:
// the live register showed "Signed" with "out 0" hidden, at the moment a
// session lead needed it at home time. The fade says "more this way" on
// whichever side has more, goes away once the row is scrolled to its end, and
// the active tab is brought into view when it changes. The row is scrolled
// directly rather than with scrollIntoView, which would also scroll the page.
//
// The ref is a callback ref: the live register's tab row only mounts once the
// register has loaded, after the component itself, and an effect keyed on a
// plain ref never saw it.
const FADE = 28

export function useScrollFade(activeKey) {
  const [el, ref] = useState(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    if (!el) return
    const left = el.scrollLeft > 2
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setEdges(e => (e.left === left && e.right === right ? e : { left, right }))
  }, [el])

  useEffect(() => {
    if (!el) return undefined
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    // Counts in the tab labels change width as children are signed in.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [el, measure])

  useEffect(() => {
    if (!el) return
    const active = el.querySelector('[aria-pressed="true"], [aria-selected="true"]')
    if (active && el.scrollWidth > el.clientWidth && typeof el.scrollTo === 'function') {
      const left = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    }
    measure()
  }, [el, activeKey, measure])

  const stops = [
    edges.left ? `transparent, #000 ${FADE}px` : '#000',
    edges.right ? `#000 calc(100% - ${FADE}px), transparent` : '#000',
  ]
  const mask = edges.left || edges.right ? `linear-gradient(90deg, ${stops.join(', ')})` : undefined
  return {
    ref,
    style: { position: 'relative', overflowX: 'auto', scrollbarWidth: 'none', WebkitMaskImage: mask, maskImage: mask },
  }
}

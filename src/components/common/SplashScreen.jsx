import React, { useEffect, useRef, useState } from 'react'

// Splash.
//
// This screen exists to cover load time, not to be looked at. Staff open the app
// several times a day, so anything here is seen hundreds of times and read none
// of them -- which is why there is no tagline, no progress bar and no
// percentage. The old one counted to 92% on a timer and then jumped, which
// measured nothing.
//
// The mark is the same one used for the app icon, so tapping the icon and
// arriving here reads as one movement rather than two logos in a row.
//
// The SVG is referenced from /assets rather than inlined: it is small, and the
// gradient behind it paints instantly, so the frame is never empty.

const KEYFRAMES = `
@keyframes ls-splash-breathe {
  0%, 100% { transform: scale(1); opacity: 0.96; }
  50%      { transform: scale(1.035); opacity: 1; }
}
@keyframes ls-splash-in {
  from { transform: scale(0.94); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes ls-splash-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
`

const EXIT_MS = 420
const REDUCED_EXIT_MS = 140

export default function SplashScreen({ ready, onExited, minDurationMs = 500 }) {
  const [phase, setPhase] = useState('showing')   // showing | exiting | gone
  const [reducedMotion, setReducedMotion] = useState(false)
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply)
    }
  }, [])

  useEffect(() => {
    if (!ready || phase !== 'showing') return
    // A minimum hold, or a fast load makes the screen flash rather than appear.
    const wait = Math.max(0, minDurationMs - (Date.now() - mountedAt.current))
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : EXIT_MS
    const t1 = setTimeout(() => {
      setPhase('exiting')
      const t2 = setTimeout(() => { setPhase('gone'); if (onExited) onExited() }, exitMs)
      return () => clearTimeout(t2)
    }, wait)
    return () => clearTimeout(t1)
  }, [ready, phase, minDurationMs, onExited, reducedMotion])

  if (phase === 'gone') return null

  const exiting = phase === 'exiting'
  const exitMs = reducedMotion ? REDUCED_EXIT_MS : EXIT_MS

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        // Deep enough that the mark's white and pale-blue read as light against it.
        // Mid-purple put the two too close in value and the logo sat flat.
        background: 'radial-gradient(ellipse 120% 90% at 50% 38%, #4832B4 0%, #2C1A79 45%, #150B42 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: exiting ? `ls-splash-out ${exitMs}ms ease forwards` : 'none',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <style>{KEYFRAMES}</style>
      <img
        src="/assets/ls-mark.svg"
        alt=""
        fetchPriority="high"
        decoding="sync"
        style={{
          width: 'clamp(240px, 62vw, 380px)',
          maxWidth: '76vw',
          // The breathe is deliberately slow and shallow. It signals the app is
          // working without becoming something to watch.
          animation: reducedMotion
            ? 'none'
            : 'ls-splash-in 480ms cubic-bezier(.2,.7,.3,1) both, ls-splash-breathe 3.4s ease-in-out 480ms infinite',
        }}
      />
    </div>
  )
}

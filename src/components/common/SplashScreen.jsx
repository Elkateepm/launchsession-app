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
//
// The brand film plays on the first open of a browser session and not after.
// Holding every launch for two and a half seconds would fight the paragraph
// above -- staff open this several times a day -- but never showing it at all
// makes the film pointless. Once per session is the compromise: seen on the
// open that feels like arriving, skipped on the ones that feel like resuming.
//
// Its own background is #000C33 from corner to final frame, so the field
// behind it is that exact colour rather than the purple used for the mark.
// Anything else leaves a visible square.

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

// The film runs 2.5s. The cap is a little over, so a slow decode still reaches
// the end, and a video that never fires 'ended' can never strand the app.
const FILM_CAP_MS = 2900
const FILM_SRC = '/assets/splash.mp4'
const FILM_BG = '#000C33'
const PLAYED_KEY = 'ls_splash_film_played'

// Read at mount rather than in an effect: an effect resolves after the first
// paint, which would start the film and then take it away again.
const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
}

export default function SplashScreen({ ready, onExited, minDurationMs = 500 }) {
  const [phase, setPhase] = useState('showing')   // showing | exiting | gone
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const mountedAt = useRef(Date.now())

  // Decided once, on mount: flipping mid-splash would swap the artwork under
  // the viewer. sessionStorage rather than localStorage so it returns the next
  // time the app is genuinely opened, not once ever.
  const [showFilm, setShowFilm] = useState(() => {
    // Two and a half seconds of animation is the thing reduced motion exists
    // to decline, so that preference skips the film entirely rather than
    // merely stilling it.
    if (prefersReducedMotion()) return false
    try { return sessionStorage.getItem(PLAYED_KEY) !== '1' } catch (e) { return true }
  })
  const [filmDone, setFilmDone] = useState(false)

  useEffect(() => {
    if (!showFilm) return
    try { sessionStorage.setItem(PLAYED_KEY, '1') } catch (e) { /* private mode */ }
  }, [showFilm])

  // A film that cannot play must not hold the app: the cap releases the splash
  // even if 'ended' never fires (autoplay refused, decode stalled, tab hidden).
  useEffect(() => {
    if (!showFilm || filmDone) return undefined
    const t = setTimeout(() => setFilmDone(true), FILM_CAP_MS)
    return () => clearTimeout(t)
  }, [showFilm, filmDone])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReducedMotion(mq.matches)
      if (mq.matches) { setShowFilm(false); setFilmDone(true) }
    }
    apply()
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply)
    }
  }, [])

  useEffect(() => {
    if (!ready || phase !== 'showing') return
    // The film is allowed to finish before the splash leaves; without this a
    // fast load would cut it off a third of the way through, which reads as a
    // glitch rather than as speed.
    if (showFilm && !filmDone) return
    // A minimum hold, or a fast load makes the screen flash rather than appear.
    const hold = showFilm ? 0 : minDurationMs
    const wait = Math.max(0, hold - (Date.now() - mountedAt.current))
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : EXIT_MS
    const t1 = setTimeout(() => {
      setPhase('exiting')
      const t2 = setTimeout(() => { setPhase('gone'); if (onExited) onExited() }, exitMs)
      return () => clearTimeout(t2)
    }, wait)
    return () => clearTimeout(t1)
  }, [ready, phase, minDurationMs, onExited, reducedMotion, showFilm, filmDone])

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
        background: showFilm
          ? FILM_BG
          : 'radial-gradient(ellipse 120% 90% at 50% 38%, #4832B4 0%, #2C1A79 45%, #150B42 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: exiting ? `ls-splash-out ${exitMs}ms ease forwards` : 'none',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <style>{KEYFRAMES}</style>
      {showFilm ? (
        <video
          src={FILM_SRC}
          autoPlay
          muted
          playsInline
          // Autoplay is refused without muted+playsInline on iOS, and this
          // screen is inside a Capacitor WebView as well as a browser.
          preload="auto"
          onEnded={() => setFilmDone(true)}
          // Any failure falls back to the mark rather than to a blank field.
          onError={() => { setShowFilm(false); setFilmDone(true) }}
          style={{
            width: 'clamp(260px, 82vw, 460px)',
            maxWidth: '86vw',
            aspectRatio: '1 / 1',
            objectFit: 'contain',
            display: 'block',
            // The film's own background is a gradient -- near-black in the
            // corners, a blue glow toward the middle -- so a flat field behind
            // it matches only the corners and the square's edge shows as a
            // seam. Feathering the outer fifth dissolves that edge into the
            // page. The logo and wordmark sit well inside the fade, and what
            // it eats is the corner darkness that already matches FILM_BG.
            WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent 97%)',
            maskImage: 'radial-gradient(closest-side, #000 62%, transparent 97%)',
          }}
        />
      ) : (
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
      )}
    </div>
  )
}

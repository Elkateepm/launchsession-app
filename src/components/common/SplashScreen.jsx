import React, { useEffect, useRef, useState } from 'react'

const EXIT_MS = 300
const MAX_PLAYBACK_WAIT_MS = 8000
const POSTER = '/assets/launchsession-splash.jpg'

export default function SplashScreen({ ready, onExited, minDurationMs = 500 }) {
  const [phase, setPhase] = useState('showing')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const mountedAt = useRef(Date.now())
  const video = useRef(null)
  const exited = useRef(onExited)
  exited.current = onExited

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply)
    }
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const playback = video.current?.play()
    playback?.catch(() => setFailed(true))
    // An unavailable or stalled clip must never block a ready app.
    const timeout = setTimeout(() => setFailed(true), MAX_PLAYBACK_WAIT_MS)
    return () => clearTimeout(timeout)
  }, [reducedMotion])

  useEffect(() => {
    if (!ready || phase !== 'showing' || !(finished || failed || reducedMotion)) return
    const timeout = setTimeout(() => setPhase('exiting'), Math.max(0, minDurationMs - (Date.now() - mountedAt.current)))
    return () => clearTimeout(timeout)
  }, [ready, phase, finished, failed, reducedMotion, minDurationMs])

  useEffect(() => {
    if (phase !== 'exiting') return
    const timeout = setTimeout(() => {
      setPhase('gone')
      exited.current?.()
    }, reducedMotion ? 0 : EXIT_MS)
    return () => clearTimeout(timeout)
  }, [phase, reducedMotion])

  if (phase === 'gone') return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Launching LaunchSession" style={{
      position: 'fixed', inset: 0, zIndex: 999999, background: '#000925',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: phase === 'exiting' ? 0 : 1,
      transition: reducedMotion ? 'none' : `opacity ${EXIT_MS}ms ease`,
    }}>
      {reducedMotion || failed ? (
        <img src={POSTER} alt="LaunchSession — Every session starts here" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <video ref={video} autoPlay muted playsInline preload="auto" poster={POSTER}
          aria-label="LaunchSession animated logo" onEnded={() => setFinished(true)} onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}>
          <source src="/assets/launchsession-splash.mp4" type="video/mp4" />
        </video>
      )}
      <div style={{ position: 'absolute', bottom: 'max(24px, env(safe-area-inset-bottom))', left: 16, right: 16, textAlign: 'center' }}>
        {ready ? <button onClick={() => setFinished(true)} style={{ minHeight: 44, padding: '10px 22px', borderRadius: 24, border: '1px solid rgba(255,255,255,.35)', color: '#fff', background: 'rgba(0,9,37,.8)', fontSize: 14, cursor: 'pointer' }}>Continue →</button>
          : <span role="status" style={{ color: '#fff', fontSize: 13 }}>Opening LaunchSession…</span>}
      </div>
    </div>
  )
}

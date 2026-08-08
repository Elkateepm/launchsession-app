import React, { useEffect, useState, useRef, useMemo } from 'react'

const MESSAGES = [
  'Checking session...',
  'Loading organisation...',
  'Preparing dashboard...',
  'Checking permissions...',
  'Almost ready...',
]

const KEYFRAMES = `
@keyframes ls-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes ls-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}
@keyframes ls-glow-drift-1 {
  0%, 100% { transform: translate(0px, 0px); }
  50% { transform: translate(30px, -20px); }
}
@keyframes ls-glow-drift-2 {
  0%, 100% { transform: translate(0px, 0px); }
  50% { transform: translate(-25px, 25px); }
}
@keyframes ls-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ls-twinkle {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.9; }
}
@keyframes ls-shoot {
  0% { transform: translate(0, 0) rotate(-35deg); opacity: 0; }
  5% { opacity: 1; }
  25% { opacity: 0; }
  100% { transform: translate(-260px, 180px) rotate(-35deg); opacity: 0; }
}
@keyframes ls-fade-msg {
  0%, 100% { opacity: 0; transform: translateY(4px); }
  15%, 85% { opacity: 1; transform: translateY(0); }
}
@keyframes ls-exit-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes ls-logo-pop {
  0% { transform: scale(1); }
  100% { transform: scale(1.02); }
}
@keyframes ls-rocket-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-5px) rotate(-1.5deg); }
}
@keyframes ls-flame {
  0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.85; }
  50% { transform: scaleY(1.22) scaleX(0.9); opacity: 1; }
}
@keyframes ls-flame-inner {
  0%, 100% { transform: scaleY(1); opacity: 0.9; }
  50% { transform: scaleY(1.3); opacity: 1; }
}
@keyframes ls-orbit-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes ls-trail-rise {
  0% { transform: translateY(0) scale(1); opacity: 0.5; }
  100% { transform: translateY(14px) scale(0.4); opacity: 0; }
}
`

function useStars(count, seedOffset = 0) {
  return useMemo(() => {
    const stars = []
    for (let i = 0; i < count; i++) {
      const seed = i + seedOffset
      const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1
      const y = (Math.sin(seed * 78.233) * 12345.678) % 1
      stars.push({
        left: `${Math.abs(x) * 100}%`,
        top: `${Math.abs(y) * 100}%`,
        size: 1 + (Math.abs(x * y) * 2),
        delay: (Math.abs(x) * 6).toFixed(2),
        duration: (2.5 + Math.abs(y) * 3).toFixed(2),
      })
    }
    return stars
  }, [count, seedOffset])
}

export default function SplashScreen({ ready, onExited, minDurationMs = 900 }) {
  const [progress, setProgress] = useState(8)
  const [msgIndex, setMsgIndex] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | complete | exiting | gone
  const [reducedMotion, setReducedMotion] = useState(false)
  const mountedAt = useRef(Date.now())
  const stars = useStars(70, 0)
  const [shootKey, setShootKey] = useState(0)

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler)
    }
  }, [])

  // Rotate loading messages every 2s while still loading
  useEffect(() => {
    if (phase !== 'loading') return
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [phase])

  // Progress creeps forward while waiting (never reaches 100% until ready)
  useEffect(() => {
    if (phase !== 'loading') return
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 92) return p
        const step = p < 50 ? 3.5 : p < 80 ? 1.4 : 0.4
        return Math.min(92, p + step)
      })
    }, 220)
    return () => clearInterval(interval)
  }, [phase])

  // Occasional shooting star, only when motion isn't reduced
  useEffect(() => {
    if (reducedMotion) return
    const trigger = () => setShootKey(k => k + 1)
    const delay = 10000 + Math.random() * 5000
    const t = setTimeout(trigger, delay)
    return () => clearTimeout(t)
  }, [shootKey, reducedMotion])

  // When `ready` flips true, finish the progress bar and begin exit sequence
  useEffect(() => {
    if (!ready || phase !== 'loading') return

    const elapsed = Date.now() - mountedAt.current
    const wait = Math.max(0, minDurationMs - elapsed)

    const t1 = setTimeout(() => {
      setProgress(100)
      setPhase('complete')

      const t2 = setTimeout(() => {
        setPhase('exiting')
        const t3 = setTimeout(() => {
          setPhase('gone')
          if (onExited) onExited()
        }, reducedMotion ? 150 : 600)
        return () => clearTimeout(t3)
      }, 280)
      return () => clearTimeout(t2)
    }, wait)

    return () => clearTimeout(t1)
  }, [ready, phase, minDurationMs, onExited, reducedMotion])

  if (phase === 'gone') return null

  const exiting = phase === 'exiting'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'linear-gradient(160deg, #050816 0%, #0B1023 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        animation: exiting ? `ls-exit-fade ${reducedMotion ? 150 : 600}ms ease forwards` : 'none',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Noise texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.035,
          mixBlendMode: 'overlay',
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
          pointerEvents: 'none',
        }}
      />

      {/* Floating glows */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: '30%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 70%)',
          filter: 'blur(10px)',
          animation: reducedMotion ? 'none' : 'ls-glow-drift-1 14s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '28%',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(155,89,182,0.14) 0%, transparent 70%)',
          filter: 'blur(10px)',
          animation: reducedMotion ? 'none' : 'ls-glow-drift-2 17s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Radial light behind logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Stars */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {stars.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: '#fff',
              opacity: reducedMotion ? 0.3 : 0.15,
              animation: reducedMotion ? 'none' : `ls-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* Shooting star */}
        {!reducedMotion && (
          <div
            key={shootKey}
            style={{
              position: 'absolute',
              top: '22%',
              right: '18%',
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: 'linear-gradient(90deg, #fff, transparent)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.4), -60px 12px 20px -8px rgba(255,255,255,0.5)',
              animation: shootKey > 0 ? 'ls-shoot 1.1s ease-out forwards' : 'none',
            }}
          />
        )}
      </div>

      {/* Center content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: phase === 'complete' || exiting ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Logo block */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Soft pulse behind rocket */}
          <div
            style={{
              position: 'absolute',
              top: '38%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)',
              filter: 'blur(6px)',
              animation: reducedMotion ? 'none' : 'ls-pulse 3.2s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

          {/* Slowly rotating orbit ring, premium sci-fi accent */}
          <svg
            width="150" height="150" viewBox="0 0 150 150"
            style={{
              position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
              animation: reducedMotion ? 'none' : 'ls-orbit-spin 22s linear infinite',
              pointerEvents: 'none',
            }}
          >
            <ellipse cx="75" cy="75" rx="70" ry="26" fill="none" stroke="url(#orbitGrad)" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />
            <defs>
              <linearGradient id="orbitGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#9B59B6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Animated vector rocket — flat, no gloss/bevel, real motion */}
          <div style={{ position: 'relative', width: 92, animation: reducedMotion ? 'none' : 'ls-rocket-bob 4.2s ease-in-out infinite', transformOrigin: 'center bottom' }}>
            <svg width="92" height="128" viewBox="0 0 92 128" fill="none">
              <defs>
                <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#E8E6F7" />
                </linearGradient>
                <linearGradient id="windowGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#9B59B6" />
                </linearGradient>
                <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
                <linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="60%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="rgba(155,89,182,0)" />
                </linearGradient>
              </defs>

              {/* Fins */}
              <path d="M 30 78 L 12 106 L 30 100 Z" fill="url(#finGrad)" />
              <path d="M 62 78 L 80 106 L 62 100 Z" fill="url(#finGrad)" />

              {/* Body */}
              <path
                d="M 46 4 C 62 20 68 46 66 78 C 66 86 60 92 46 94 C 32 92 26 86 26 78 C 24 46 30 20 46 4 Z"
                fill="url(#bodyGrad)" stroke="#8B5CF6" strokeOpacity="0.35" strokeWidth="1.5"
              />

              {/* Window */}
              <circle cx="46" cy="42" r="11" fill="url(#windowGrad)" />
              <circle cx="46" cy="42" r="11" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />

              {/* Flame — animated */}
              <g style={{ transformOrigin: '46px 94px', animation: reducedMotion ? 'none' : 'ls-flame 0.85s ease-in-out infinite' }}>
                <path d="M 46 94 C 54 102 56 114 46 124 C 36 114 38 102 46 94 Z" fill="url(#flameGrad)" opacity="0.85" />
              </g>
              <g style={{ transformOrigin: '46px 94px', animation: reducedMotion ? 'none' : 'ls-flame-inner 0.85s ease-in-out infinite 0.1s' }}>
                <path d="M 46 94 C 50 100 51 108 46 116 C 41 108 42 100 46 94 Z" fill="#C4B5FD" opacity="0.9" />
              </g>

              {/* Rising thrust particles */}
              {!reducedMotion && [0, 1, 2].map(i => (
                <circle key={i} cx={40 + i * 6} cy={112} r="2" fill="#A78BFA"
                  style={{ animation: `ls-trail-rise 1.4s ease-in ${i * 0.35}s infinite` }} />
              ))}
            </svg>
          </div>

          {/* Wordmark — flat typography, no emboss/bevel */}
          <div style={{ marginTop: 14, fontSize: 34, fontWeight: 700, letterSpacing: -0.5, color: '#fff', lineHeight: 1 }}>
            Launch<span style={{ fontWeight: 300, color: 'rgba(255,255,255,0.72)' }}>Session</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: 2.2, color: 'rgba(199,191,255,0.6)', textTransform: 'uppercase' }}>
            Empowering Youth. Every Session.
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 24,
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: 0.2,
          }}
        >
          Powering every session, person and outcome.
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 40,
            width: 220,
            height: 3,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 99,
              background: 'linear-gradient(90deg, #3B82F6, #9B59B6)',
              transition: 'width 300ms ease-out',
            }}
          />
        </div>

        {/* Rotating status message */}
        <div
          style={{
            marginTop: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            key={msgIndex}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 0.2,
              animation: reducedMotion ? 'none' : 'ls-fade-msg 2s ease',
            }}
          >
            {phase === 'loading' ? MESSAGES[msgIndex] : 'Ready.'}
          </span>
        </div>
      </div>
    </div>
  )
}

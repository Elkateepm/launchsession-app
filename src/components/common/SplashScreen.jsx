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
@keyframes ls-badge-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-5px) rotate(-1.5deg); }
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

      {/* Crescent moon, top-left, partially off-screen */}
      <div
        style={{
          position: 'absolute',
          top: -70,
          left: -90,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 65% 35%, #6D28D9 0%, #2E1065 55%, transparent 75%)',
          opacity: 0.55,
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
        }}
      >
        {/* LS mark — faint ring accent behind it, no ring text */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Soft pulse glow */}
          <div
            style={{
              position: 'absolute',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.38) 0%, transparent 70%)',
              filter: 'blur(10px)',
              animation: reducedMotion ? 'none' : 'ls-pulse 3.2s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          {/* Faint circle guide, no text on it */}
          <div
            style={{
              position: 'absolute',
              width: 210,
              height: 210,
              borderRadius: '50%',
              border: '1px solid rgba(139,124,246,0.22)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              animation: reducedMotion || phase !== 'loading' ? 'none' : 'ls-badge-bob 4.5s ease-in-out infinite',
              transform: phase === 'complete' || exiting ? 'scale(1.18)' : 'scale(1)',
              transition: 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <svg width="168" height="168" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="splash-lGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#B8A6FF" />
                  <stop offset="100%" stopColor="#6D5AE0" />
                </linearGradient>
                <linearGradient id="splash-sGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8B7CF6" />
                  <stop offset="100%" stopColor="#5B6EF5" />
                </linearGradient>
                <linearGradient id="splash-rocketGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7C6EF6" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
                <linearGradient id="splash-swooshGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5B6EF5" stopOpacity="0" />
                  <stop offset="50%" stopColor="#8B7CF6" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#5B6EF5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 32 150 C 56 174, 134 174, 158 146" fill="none" stroke="url(#splash-swooshGrad)" strokeWidth="7" strokeLinecap="round" />
              <text x="30" y="150" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="130" fill="url(#splash-lGrad)">L</text>
              <text x="90" y="150" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="130" fill="url(#splash-sGrad)">S</text>
              <g transform="translate(146,72) rotate(35)">
                <path d="M 0 -30 C 11 -21 15 -5 14 12 C 14 19 9 23 0 25 C -9 23 -14 19 -14 12 C -15 -5 -11 -21 0 -30 Z" fill="url(#splash-rocketGrad)" />
                <circle cx="0" cy="-3" r="5" fill="#1a1730" opacity="0.6" />
                <circle cx="0" cy="-3" r="5" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" />
              </g>
              <g transform="translate(158,46)">
                <path d="M0,-10 C1.2,-2.2 2.2,-1.2 10,0 C2.2,1.2 1.2,2.2 0,10 C-1.2,2.2 -2.2,1.2 -10,0 C-2.2,-1.2 -1.2,-2.2 0,-10 Z" fill="#fff" />
              </g>
            </svg>
          </div>
        </div>

        {/* Wordmark — Session in brand gradient, bold */}
        <div style={{ marginTop: 14, fontSize: 32, fontWeight: 800, letterSpacing: -0.5, color: '#fff', lineHeight: 1 }}>
          Launch<span style={{ background: 'linear-gradient(90deg, #8B7CF6, #5B6EF5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Session</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, letterSpacing: 2, color: 'rgba(203,213,225,0.55)', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.7 }}>
          Empowering Youth.<br />Every Session.
        </div>

        {/* Launch scene — rocket, beam, clouds, horizon */}
        <svg width="300" height="195" viewBox="0 0 400 260" style={{ marginTop: 22, overflow: 'visible' }}>
          <defs>
            <radialGradient id="splash-baseGlow" cx="50%" cy="100%" r="65%">
              <stop offset="0%" stopColor="#C084FC" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#7C3AED" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="splash-beamGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#C084FC" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="splash-horizonGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B2E63" />
              <stop offset="100%" stopColor="#160F2E" />
            </linearGradient>
            <radialGradient id="splash-cloudGrad" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#4C3B82" />
              <stop offset="100%" stopColor="#241A44" />
            </radialGradient>
            <linearGradient id="splash-rocketBody" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#DCD6FF" />
              <stop offset="100%" stopColor="#fff" />
            </linearGradient>
          </defs>

          <ellipse cx="200" cy="222" rx="150" ry="70" fill="url(#splash-baseGlow)" />
          <path d="M 193 60 L 207 60 L 224 220 L 176 220 Z" fill="url(#splash-beamGrad)" />

          <ellipse cx="90" cy="215" rx="70" ry="34" fill="url(#splash-cloudGrad)" />
          <ellipse cx="140" cy="228" rx="55" ry="30" fill="url(#splash-cloudGrad)" />
          <ellipse cx="50" cy="232" rx="48" ry="26" fill="url(#splash-cloudGrad)" />
          <ellipse cx="310" cy="215" rx="70" ry="34" fill="url(#splash-cloudGrad)" />
          <ellipse cx="260" cy="228" rx="55" ry="30" fill="url(#splash-cloudGrad)" />
          <ellipse cx="350" cy="232" rx="48" ry="26" fill="url(#splash-cloudGrad)" />

          <ellipse cx="200" cy="290" rx="230" ry="70" fill="url(#splash-horizonGrad)" />

          <circle cx="60" cy="90" r="1.4" fill="#fff" opacity="0.7" />
          <circle cx="330" cy="70" r="1.6" fill="#fff" opacity="0.6" />
          <circle cx="350" cy="150" r="1.2" fill="#fff" opacity="0.5" />
          <circle cx="40" cy="160" r="1.2" fill="#fff" opacity="0.5" />

          <g
            transform="translate(200,70)"
            style={{
              transformOrigin: '200px 70px',
              animation: reducedMotion || phase !== 'loading' ? 'none' : 'ls-badge-bob 3.6s ease-in-out infinite',
            }}
          >
            <path d="M 0 -38 C 14 -24 18 -4 16 16 C 16 24 9 30 0 32 C -9 30 -16 24 -16 16 C -18 -4 -14 -24 0 -38 Z"
              fill="url(#splash-rocketBody)" stroke="#8B7CF6" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="0" cy="-6" r="6.5" fill="#2A2350" />
            <circle cx="0" cy="-6" r="6.5" fill="none" stroke="#fff" strokeWidth="1" strokeOpacity="0.5" />
            <path d="M -16 10 L -30 26 L -14 22 Z" fill="#7C6EF6" />
            <path d="M 16 10 L 30 26 L 14 22 Z" fill="#7C6EF6" />
          </g>
        </svg>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 26,
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

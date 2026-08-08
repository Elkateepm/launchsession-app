import React, { useEffect, useState, useRef, useMemo } from 'react'

const KEYFRAMES = `
@keyframes ls-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.06); }
}
@keyframes ls-twinkle {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.9; }
}
@keyframes ls-exit-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes ls-badge-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes ls-rocket-rise {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-9px); }
}
@keyframes ls-ring-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes ls-beam-flicker {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
@keyframes ls-icon-orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
        top: `${Math.abs(y) * 72}%`,
        size: 1 + (Math.abs(x * y) * 2.2),
        delay: (Math.abs(x) * 6).toFixed(2),
        duration: (2.5 + Math.abs(y) * 3).toFixed(2),
      })
    }
    return stars
  }, [count, seedOffset])
}

export default function SplashScreen({ ready, onExited, minDurationMs = 900 }) {
  const [progress, setProgress] = useState(8)
  const [phase, setPhase] = useState('loading') // loading | complete | exiting | gone
  const [reducedMotion, setReducedMotion] = useState(false)
  const mountedAt = useRef(Date.now())
  const stars = useStars(90, 0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler)
    }
  }, [])

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
        background: 'radial-gradient(ellipse 110% 75% at 50% 8%, #100C2E 0%, #08061B 48%, #04030D 100%)',
        overflow: 'hidden',
        animation: exiting ? `ls-exit-fade ${reducedMotion ? 150 : 600}ms ease forwards` : 'none',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* ── Nebula / milky way, right side ── */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          right: '-4%',
          width: '46%',
          height: '78%',
          background:
            'radial-gradient(ellipse 38% 58% at 58% 42%, rgba(167,139,250,0.30) 0%, transparent 62%), radial-gradient(ellipse 28% 48% at 70% 62%, rgba(139,92,246,0.24) 0%, transparent 60%), radial-gradient(ellipse 20% 32% at 50% 30%, rgba(226,214,255,0.22) 0%, transparent 65%)',
          filter: 'blur(26px)',
          transform: 'rotate(-24deg)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Stars ── */}
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
              opacity: reducedMotion ? 0.55 : 0.45,
              animation: reducedMotion ? 'none' : `ls-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Bright accent stars (4-point sparkles) ── */}
      {[
        { top: '9%', right: '15%', size: 16, opacity: 0.9 },
        { top: '34%', right: '9%', size: 9, opacity: 0.5 },
        { top: '62%', left: '9%', size: 7, opacity: 0.4 },
      ].map((s, i) => (
        <svg
          key={i}
          width={s.size}
          height={s.size}
          viewBox="0 0 24 24"
          style={{ position: 'absolute', top: s.top, left: s.left, right: s.right, opacity: s.opacity, pointerEvents: 'none' }}
        >
          <path d="M12 0 L13.6 10.4 L24 12 L13.6 13.6 L12 24 L10.4 13.6 L0 12 L10.4 10.4 Z" fill="#fff" />
        </svg>
      ))}

      {/* ── Large moon, top-left, partially off-screen ── */}
      <div
        style={{
          position: 'absolute',
          top: '-9vh',
          left: '-7vw',
          width: 'clamp(220px, 19vw, 340px)',
          height: 'clamp(220px, 19vw, 340px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 74% 64%, #8E78D8 0%, #6B54B4 22%, #402E7C 52%, #221843 78%, #0F0A24 100%)',
          boxShadow: 'inset -16px -12px 46px rgba(0,0,0,0.6), 0 0 70px rgba(124,79,224,0.14)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Small moon, right side ── */}
      <div
        style={{
          position: 'absolute',
          top: '60%',
          right: '-1.5vw',
          width: 'clamp(78px, 7vw, 130px)',
          height: 'clamp(78px, 7vw, 130px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 32% 32%, #8874D0 0%, #5C48A8 30%, #33255F 65%, #150E32 100%)',
          boxShadow: 'inset 9px 7px 26px rgba(0,0,0,0.55), 0 0 36px rgba(124,79,224,0.12)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Faint orbital arcs behind the badge ── */}
      <div
        style={{
          position: 'absolute',
          top: '46%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(74vh, 62vw)',
          height: 'min(74vh, 62vw)',
          borderRadius: '50%',
          border: '1px solid rgba(167,139,250,0.10)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(18deg)',
          width: 'min(96vh, 82vw)',
          height: 'min(96vh, 82vw)',
          borderRadius: '50%',
          border: '1px solid rgba(167,139,250,0.07)',
          pointerEvents: 'none',
        }}
      />

      {/* ══ PLANET HORIZON (bottom) ══ */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(22vh - 320vw)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320vw',
          height: '320vw',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 3%, #5B44A8 0%, #3A2A78 1.6%, #241A55 3.4%, #17103C 7%, #0E0A28 16%, #08061A 100%)',
          boxShadow: '0 -14px 70px rgba(139,92,246,0.20)',
          pointerEvents: 'none',
        }}
      />
      {/* Atmospheric rim light along the horizon */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(22vh - 320vw)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320vw',
          height: '320vw',
          borderRadius: '50%',
          border: '1px solid rgba(200,185,255,0.6)',
          boxShadow: '0 0 22px rgba(167,139,250,0.5), 0 0 70px rgba(139,92,246,0.22), inset 0 0 26px rgba(167,139,250,0.10)',
          pointerEvents: 'none',
        }}
      />

      {/* ══ ROCKET + LAUNCH BEAM ══ */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 'calc(22vh + 6px)',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            animation: reducedMotion || phase !== 'loading' ? 'none' : 'ls-rocket-rise 3.4s ease-in-out infinite',
          }}
        >
          <svg width="34" height="52" viewBox="0 0 34 52" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="ls-rk-body" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#CFC7F5" />
                <stop offset="55%" stopColor="#F4F2FF" />
                <stop offset="100%" stopColor="#fff" />
              </linearGradient>
            </defs>
            {/* body */}
            <path
              d="M 17 2 C 25 11 28 24 26 36 L 8 36 C 6 24 9 11 17 2 Z"
              fill="url(#ls-rk-body)"
            />
            {/* fins */}
            <path d="M 8 28 L 2 40 L 8 37 Z" fill="#9F8AE8" />
            <path d="M 26 28 L 32 40 L 26 37 Z" fill="#9F8AE8" />
            {/* window */}
            <circle cx="17" cy="17" r="3.6" fill="#3B2E70" />
            {/* nozzle */}
            <path d="M 11 36 L 23 36 L 21 41 L 13 41 Z" fill="#B7A9EC" />
          </svg>
        </div>

        {/* Exhaust beam widening down to the horizon */}
        <div
          style={{
            width: 3,
            height: 'clamp(70px, 11vh, 120px)',
            marginTop: -2,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E9E2FF 18%, rgba(196,181,253,0.55) 55%, rgba(167,139,250,0) 100%)',
            filter: 'blur(0.5px)',
            animation: reducedMotion ? 'none' : 'ls-beam-flicker 1.6s ease-in-out infinite',
          }}
        />
      </div>

      {/* Bright bloom where the beam meets the planet surface */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 'calc(22vh - 30px)',
          transform: 'translateX(-50%)',
          width: 260,
          height: 90,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(196,181,253,0.5) 22%, rgba(139,92,246,0.22) 48%, transparent 72%)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />

      {/* ══ CENTER CONTENT ══ */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 'clamp(40px, 8vh, 90px)',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Badge with concentric rings ── */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer soft pulse glow */}
          <div
            style={{
              position: 'absolute',
              width: 'clamp(230px, 26vh, 300px)',
              height: 'clamp(230px, 26vh, 300px)',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.40) 0%, transparent 68%)',
              filter: 'blur(14px)',
              animation: reducedMotion ? 'none' : 'ls-pulse 3.4s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          {/* Outer thin ring */}
          <div
            style={{
              position: 'absolute',
              width: 'clamp(206px, 23.5vh, 272px)',
              height: 'clamp(206px, 23.5vh, 272px)',
              borderRadius: '50%',
              border: '1px solid rgba(167,139,250,0.28)',
              pointerEvents: 'none',
            }}
          />
          {/* Inner glow ring hugging the badge */}
          <div
            style={{
              position: 'absolute',
              width: 'clamp(182px, 21vh, 240px)',
              height: 'clamp(182px, 21vh, 240px)',
              borderRadius: '50%',
              border: '1.5px solid rgba(196,181,253,0.55)',
              boxShadow: '0 0 26px rgba(167,139,250,0.45), inset 0 0 22px rgba(167,139,250,0.22)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              animation: reducedMotion || phase !== 'loading' ? 'none' : 'ls-badge-bob 4.5s ease-in-out infinite',
              transform: phase === 'complete' || exiting ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <img
              src="/assets/badge-logo-centered.png"
              alt="LaunchSession"
              style={{
                width: 'clamp(168px, 19.5vh, 224px)',
                height: 'clamp(168px, 19.5vh, 224px)',
                objectFit: 'contain',
                filter: 'drop-shadow(0 12px 30px rgba(139,92,246,0.45))',
              }}
            />
          </div>
        </div>

        {/* ── Wordmark ── */}
        <div
          style={{
            marginTop: 'clamp(20px, 3.2vh, 34px)',
            fontSize: 'clamp(38px, 5.6vh, 62px)',
            fontWeight: 800,
            letterSpacing: -1.2,
            color: '#fff',
            lineHeight: 1,
            fontFamily: 'var(--font-display, sans-serif)',
          }}
        >
          Launch
          <span
            style={{
              background: 'linear-gradient(90deg, #8B7CF6 0%, #6D5AF0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Session
          </span>
        </div>

        {/* ── Tagline ── */}
        <div
          style={{
            marginTop: 'clamp(10px, 1.6vh, 18px)',
            fontSize: 'clamp(14px, 1.9vh, 20px)',
            fontWeight: 500,
            color: 'rgba(226,232,240,0.72)',
            letterSpacing: 0.1,
          }}
        >
          Empowering youth.{' '}
          <span style={{ color: '#8B7CF6', fontWeight: 600 }}>Every session.</span>
        </div>
      </div>

      {/* ══ PROGRESS CARD ══ */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 'clamp(28px, 6vh, 62px)',
          transform: 'translateX(-50%)',
          zIndex: 3,
          width: 'min(660px, 88vw)',
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(14px, 2.4vw, 26px)',
          padding: 'clamp(16px, 2.4vh, 24px) clamp(18px, 2.6vw, 30px)',
          borderRadius: 22,
          background: 'rgba(18,14,45,0.55)',
          border: '1px solid rgba(167,139,250,0.22)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -24px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxSizing: 'border-box',
        }}
      >
        {/* Rocket icon in dotted orbit circle */}
        <div style={{ position: 'relative', flexShrink: 0, width: 62, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1.5px dashed rgba(167,139,250,0.45)',
              animation: reducedMotion ? 'none' : 'ls-icon-orbit 14s linear infinite',
            }}
          />
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 30%, rgba(139,92,246,0.35), rgba(76,46,143,0.35))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="26" viewBox="0 0 34 52">
              <path d="M 17 2 C 25 11 28 24 26 36 L 8 36 C 6 24 9 11 17 2 Z" fill="#C4B5FD" />
              <path d="M 8 28 L 2 40 L 8 37 Z" fill="#8B7CF6" />
              <path d="M 26 28 L 32 40 L 26 37 Z" fill="#8B7CF6" />
              <circle cx="17" cy="17" r="3.6" fill="#2A1F55" />
              <path d="M 11 36 L 23 36 L 21 41 L 13 41 Z" fill="#A78BFA" />
            </svg>
          </div>
        </div>

        {/* Text + progress */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(15px, 1.9vh, 19px)', fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
            {phase === 'loading' ? 'Preparing your session...' : 'Ready for lift off.'}
          </div>
          <div style={{ marginTop: 4, fontSize: 'clamp(12px, 1.5vh, 15px)', fontWeight: 400, color: 'rgba(203,213,225,0.62)' }}>
            Setting everything up for lift off.
          </div>

          <div style={{ marginTop: 'clamp(10px, 1.6vh, 16px)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                flex: 1,
                height: 7,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.10)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, #6D8BF5 0%, #8B7CF6 55%, #A855F7 100%)',
                  boxShadow: '0 0 12px rgba(139,124,246,0.6)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 'clamp(13px, 1.7vh, 16px)',
                fontWeight: 700,
                color: '#8B7CF6',
                minWidth: 44,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

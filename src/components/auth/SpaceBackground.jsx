import React, { useMemo } from 'react'

// Deterministic pseudo-random so the star field is stable across renders
// without needing a hand-authored list of coordinates.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function SpaceBackground({ height = 620 }) {
  const stars = useMemo(() => {
    const rand = mulberry32(42)
    return Array.from({ length: 55 }).map((_, i) => ({
      id: i,
      top: rand() * 100,
      left: rand() * 100,
      size: rand() * 2 + 0.6,
      opacity: rand() * 0.7 + 0.25,
      twinkle: rand() > 0.85,
      delay: rand() * 4,
    }))
  }, [])

  const sparkles = useMemo(() => {
    const rand = mulberry32(7)
    return Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      top: 8 + rand() * 30,
      left: 55 + rand() * 40,
      size: rand() * 8 + 8,
      opacity: rand() * 0.5 + 0.4,
    }))
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <style>{`
        @keyframes ls-twinkle { 0%,100%{opacity:0.25} 50%{opacity:0.9} }
      `}</style>

      {/* Planet, cropped in the top-left corner */}
      <div style={{
        position: 'absolute', top: -170, left: -140, width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle at 62% 38%, #7C6BF5 0%, #4C3FA6 32%, #241E5C 60%, #0D0B2A 82%)',
        boxShadow: '0 0 90px 10px rgba(124,107,245,0.18)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 35%)',
        }} />
        <div style={{
          position: 'absolute', top: '48%', left: '-6%', width: '112%', height: 3,
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.55) 40%, rgba(167,139,250,0.55) 60%, transparent)',
          transform: 'rotate(-8deg)', borderRadius: 3,
        }} />
      </div>

      {/* Comet arc, upper right */}
      <svg viewBox="0 0 400 480" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id="cometFade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0" />
            <stop offset="55%" stopColor="#93C5FD" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M 250 10 C 320 60, 355 120, 380 210" stroke="url(#cometFade)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="380" cy="210" r="2.6" fill="#EFF6FF" />
      </svg>

      {/* Small sparkle accents */}
      {sparkles.map(s => (
        <svg key={s.id} style={{ position: 'absolute', top: `${s.top}%`, left: `${s.left}%`, opacity: s.opacity }}
          width={s.size} height={s.size} viewBox="0 0 24 24">
          <path d="M12 0 C12.8 8, 16 11.2, 24 12 C16 12.8, 12.8 16, 12 24 C11.2 16, 8 12.8, 0 12 C8 11.2, 11.2 8, 12 0Z" fill="#C4B5FD" />
        </svg>
      ))}

      {/* Star field */}
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', top: `${s.top}%`, left: `${s.left}%`,
          width: s.size, height: s.size, borderRadius: '50%', background: '#fff',
          opacity: s.opacity,
          animation: s.twinkle ? `ls-twinkle ${3 + s.delay}s ease-in-out infinite` : 'none',
        }} />
      ))}

      {/* Fade to solid navy at the bottom so content below sits on a clean background */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
        background: 'linear-gradient(180deg, transparent 0%, #060B18 100%)',
      }} />
    </div>
  )
}

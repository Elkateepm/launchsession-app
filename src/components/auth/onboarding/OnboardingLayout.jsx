import React from 'react'
import { useIsMobile } from '../../../hooks/useIsMobile'

export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange) }
  }, [])
  return reduced
}

export default function OnboardingLayout({ children, wide = true, panelStyle, onBackHome }) {
  const isMobile = useIsMobile()

  return (
    <div style={page}>
      {/* Ambient glow — kept subtle per spec, not neon */}
      <div style={{ position: 'absolute', top: -160, left: '8%', width: 560, height: 560, background: 'radial-gradient(circle, rgba(139,92,246,0.16), transparent 68%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, right: '5%', width: 640, height: 640, background: 'radial-gradient(circle, rgba(37,99,235,0.18), transparent 68%)', pointerEvents: 'none' }} />
      {/* Faint orbit lines — mission-control feel, not distracting */}
      {!isMobile && (
        <>
          <div style={{ position: 'absolute', width: 1000, height: 1000, border: '1px solid rgba(255,255,255,0.035)', borderRadius: '50%', top: '4%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 720, height: 720, border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%', top: '12%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
        </>
      )}

      <div style={{ width: '100%', maxWidth: wide ? 1120 : 520, position: 'relative', zIndex: 2, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
          <img src="/logo.png" alt="LaunchSession" style={{ height: 34, width: 'auto', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
          <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.4 }}>LaunchSession</span>
        </div>

        <div style={{ ...glassPanel, ...panelStyle }}>
          {children}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap', textAlign: 'center' }}>
          <button onClick={onBackHome || (() => { window.location.href = '/landing.html' })} style={footLink}>← Back to LaunchSession</button>
          <Dot />
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)' }}>🔒 Secure &amp; never shared</span>
          <Dot />
          <a href="/privacy.html" style={footLink}>Privacy Policy</a>
          <Dot />
          <a href="/terms.html" style={footLink}>Terms</a>
          <Dot />
          <a href="/login.html" style={footLink}>Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
}

const page = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top left, #1a0b3b 0%, #07111f 42%, #020711 100%)',
  color: '#fff',
  padding: '32px 16px 48px',
  position: 'relative',
  overflowX: 'hidden',
  overflowY: 'auto',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  boxSizing: 'border-box',
}

const glassPanel = {
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.11)',
  borderRadius: 28,
  padding: '36px 40px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 40px 100px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxSizing: 'border-box',
}

const footLink = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', textDecoration: 'none' }

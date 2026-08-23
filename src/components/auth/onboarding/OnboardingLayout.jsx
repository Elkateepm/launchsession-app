import React from 'react'
import { useIsMobile } from '../../../hooks/useIsMobile'
import OnboardingStyles from './OnboardingStyles'
import { STAGGER, DURATION } from './animations'
import Icon from '../../../lib/icons'

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

// Fixed, deterministic star positions/sizes -- random per-render would
// reshuffle on every re-render, which reads as flickering rather than a
// calm background.
const STARS = [
  { top: '14%', left: '22%', size: 2, delay: 0 },
  { top: '28%', left: '78%', size: 1.5, delay: 1.2 },
  { top: '62%', left: '12%', size: 1.5, delay: 2.4 },
  { top: '75%', left: '85%', size: 2, delay: 0.6 },
  { top: '45%', left: '92%', size: 1.5, delay: 3.1 },
]

export default function OnboardingLayout({ children, wide = true, panelStyle, onBackHome }) {
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()

  const enterStyle = (delayMs, animName = 'ls-stagger-up') => reducedMotion
    ? { opacity: 1 }
    : { opacity: 0, animation: `${animName} ${DURATION.panel}ms ${delayMs}ms cubic-bezier(0.16,1,0.3,1) forwards` }

  return (
    <div style={page}>
      <OnboardingStyles />

      {/* Ambient glow -- subtle drift, not neon; disabled entirely under reduced motion */}
      <div className={reducedMotion ? '' : 'ls-glow-drift'} style={{ position: 'absolute', top: -160, left: '8%', width: 560, height: 560, background: 'radial-gradient(circle, rgba(139,92,246,0.16), transparent 68%)', pointerEvents: 'none', ...enterStyle(STAGGER.glow, 'ls-fade-in') }} />
      <div style={{ position: 'absolute', bottom: -220, right: '5%', width: 640, height: 640, background: 'radial-gradient(circle, rgba(37,99,235,0.18), transparent 68%)', pointerEvents: 'none', ...enterStyle(STAGGER.glow, 'ls-fade-in') }} />

      {/* Faint counter-rotating orbit rings -- desktop/tablet only, off entirely on mobile and under reduced motion */}
      {!isMobile && !reducedMotion && (
        <>
          <div className="ls-orbit-ring-1" style={{ position: 'absolute', width: 1000, height: 1000, border: '1px solid rgba(255,255,255,0.035)', borderRadius: '50%', top: '4%', left: '50%', pointerEvents: 'none' }} />
          <div className="ls-orbit-ring-2" style={{ position: 'absolute', width: 720, height: 720, border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%', top: '12%', left: '50%', pointerEvents: 'none' }} />
        </>
      )}
      {!isMobile && reducedMotion && (
        <>
          <div style={{ position: 'absolute', width: 1000, height: 1000, border: '1px solid rgba(255,255,255,0.035)', borderRadius: '50%', top: '4%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 720, height: 720, border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%', top: '12%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
        </>
      )}

      {/* Extremely subtle star particles -- desktop/tablet only */}
      {!isMobile && !reducedMotion && STARS.map((s, i) => (
        <div key={i} className="ls-star" style={{ position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: '50%', background: '#fff', animationDelay: `${s.delay}s`, pointerEvents: 'none' }} />
      ))}

      <div style={{ width: '100%', maxWidth: wide ? 1120 : 520, position: 'relative', zIndex: 2, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22, ...enterStyle(STAGGER.logo, 'ls-logo-launch') }}>
          <span className={reducedMotion ? '' : 'ls-logo-pulse'} style={{ display: 'inline-flex', animation: reducedMotion ? 'none' : 'ls-logo-icon-launch 700ms 80ms cubic-bezier(0.16,1,0.3,1) both' }}>
            <img src="/logo.png" alt="LaunchSession" style={{ height: 34, width: 'auto', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
          </span>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.4 }}>LaunchSession</span>
        </div>

        <div style={{ ...glassPanel(isMobile), ...panelStyle, ...enterStyle(STAGGER.panel, 'ls-panel-enter') }}>
          {children}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap', textAlign: 'center', ...enterStyle(STAGGER.footer, 'ls-fade-in') }}>
          <button onClick={onBackHome || (() => { window.location.href = '/landing.html' })} className="ls-footlink" style={footLink}><Icon name="←" /> Back to LaunchSession</button>
          <Dot />
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)' }}><Icon name="🔒" /> Secure &amp; never shared</span>
          <Dot />
          <a href="/privacy.html" className="ls-footlink" style={footLink}>Privacy Policy</a>
          <Dot />
          <a href="/terms.html" className="ls-footlink" style={footLink}>Terms</a>
          <Dot />
          <a href="/login.html" className="ls-footlink" style={footLink}>Already have an account? Sign in</a>
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
  animation: 'ls-fade-in 600ms ease',
}

const glassPanel = (isMobile) => ({
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.11)',
  borderRadius: isMobile ? 20 : 28,
  padding: isMobile ? '22px 18px' : '36px 40px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 40px 100px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxSizing: 'border-box',
})

const footLink = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', textDecoration: 'none' }

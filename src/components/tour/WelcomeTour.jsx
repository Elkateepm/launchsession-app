import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { orgBrand, OrgLogo } from '../shared/OrgPageHero'
import { useIsMobile } from '../../hooks/useIsMobile'
import { withAlpha } from '../../lib/withAlpha'
import Icon from '../../lib/icons'

// A short welcome tour, one per role. Owners come first: whoever signs the
// organisation up sees it the moment they finish setting it up. Admin and
// staff tours sit beside it in TOURS as they are written.
//
// The screenshots in public/tour are of a made-up club ("Riverside Youth
// Club") with made-up children, so no real organisation's data or logo is
// shown to another. Retake them when the screens they show change.
//
// Every claim here is something the app does today. Sessions do not repeat on
// their own, for example, so the tour says "duplicate" and "template".
export function ownerTour({ org, firstName }) {
  const name = org?.name || 'your organisation'
  const moves = [
    org?.branding_enabled && { tab: 'branding', icon: '🎨', label: 'Add your logo and colours', hint: 'The whole app, and your emails, follow' },
    { tab: 'planner', icon: '📅', label: 'Plan your first session', hint: 'Its register is ready the moment you save' },
    { tab: 'registers', icon: '🧒', label: 'Add your young people', hint: 'One at a time, or import a spreadsheet' },
    { tab: 'team', icon: '👋', label: 'Invite your team', hint: 'Staff and volunteers, each with the right access' },
  ].filter(Boolean)
  return [
    {
      key: 'welcome', icon: '🎉', eyebrow: 'Welcome to LaunchSession',
      title: firstName ? `You're in, ${firstName}!` : "You're in!",
      body: `${name} is all set up. Here's the whole app in about a minute: five quick stops, no quiz at the end.`,
      visual: 'brand',
    },
    {
      key: 'home', icon: '🏠', eyebrow: 'Stop 1 of 5 · Home', title: 'Your day at a glance',
      body: "Today's sessions, who's arrived and anything that needs you, the moment you log in.",
      shot: { src: '/tour/home.webp', alt: "Home: today's sessions, who has arrived and what needs attention", kind: 'desktop' },
    },
    {
      key: 'sessions', icon: '📅', eyebrow: 'Stop 2 of 5 · Sessions', title: 'Plan it once, reuse it all term',
      body: "Choose when, where, who's coming and who's leading. Duplicate it, or save it as a template for next time.",
      shot: { src: '/tour/sessions.webp', alt: 'Sessions: upcoming sessions, each with its register', kind: 'desktop' },
    },
    {
      key: 'registers', icon: '✅', eyebrow: 'Stop 3 of 5 · Registers', title: 'Clipboards, retired',
      body: 'Sign young people in and out from any phone. Allergy and medical flags sit right on their name.',
      shot: { src: '/tour/register.webp', alt: 'A register on a phone, with an allergy flag on a child', kind: 'phone' },
    },
    {
      key: 'people', icon: '🧒', eyebrow: 'Stop 4 of 5 · Young people', title: 'Everyone, safely in one place',
      body: 'Profiles, medical details and safeguarding concerns live together, and each role only sees what it should.',
      shot: { src: '/tour/people.webp', alt: 'The young people directory with groups, ages and care alerts', kind: 'desktop' },
    },
    {
      key: 'team', icon: '🤝', eyebrow: 'Stop 5 of 5 · Team & Office', title: 'Bring your crew',
      body: 'Invite your staff and volunteers, then let the Office take the paperwork off your plate.',
      points: [
        { icon: '👋', label: 'Team', hint: 'Invites, and what each role can see' },
        { icon: '📝', label: 'Forms & newsletters', hint: 'Consent forms and updates for parents' },
        { icon: '💼', label: 'Office', hint: 'HR, resource bookings and payments' },
      ],
    },
    {
      key: 'go', icon: '🚀', eyebrow: "You're ready", title: 'Ready, set, launch',
      body: 'Pick a first move. You can replay this tour any time from your profile.',
      moves,
    },
  ]
}

export const TOURS = { owner: ownerTour }

export default function WelcomeTour({ role = 'owner', org, firstName, onClose, onNavigate }) {
  const slides = useMemo(() => (TOURS[role] || ownerTour)({ org, firstName }), [role, org, firstName])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  // Full screen on a phone; picture above words on a tablet or narrow
  // window, where side by side squeezed the screenshot to a thumbnail.
  const isMobile = useIsMobile()
  const stacked = useIsMobile(1024)
  const reducedMotion = useReducedMotion()
  const brand = orgBrand(org)
  const primaryRef = useRef(null)
  const touchX = useRef(null)
  const slide = slides[index]
  const last = index === slides.length - 1

  const goTo = next => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next))
    if (clamped === index) return
    setDirection(clamped > index ? 1 : -1)
    setIndex(clamped)
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Focus follows the slide so keyboard and screen-reader users land on the
  // way forward, and the next screenshot is fetched while this one is read.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
    const upcoming = slides[index + 1]?.shot
    if (upcoming) { const img = new Image(); img.src = upcoming.src }
  }, [index, slides])

  const slideMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, x: 26 * direction }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 * direction }, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }

  const primaryLabel = index === 0 ? 'Show me around' : last ? 'Explore on my own' : 'Next'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ls-tour-title" style={{
      position: 'fixed', inset: 0, zIndex: 10600, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 24, background: 'rgba(8,12,24,0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    }}
      onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null }}
      onTouchEnd={e => {
        const start = touchX.current
        touchX.current = null
        const end = e.changedTouches[0]?.clientX
        if (start == null || end == null || Math.abs(end - start) < 60) return
        goTo(index + (end < start ? 1 : -1))
      }}>
      <style>{tourKeyframes}</style>
      <div style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : stacked ? 620 : 940,
        height: isMobile ? '100%' : stacked ? 'min(780px, calc(100dvh - 48px))' : 560,
        background: 'var(--surface)', color: 'var(--text)', borderRadius: isMobile ? 0 : 26, overflow: 'hidden',
        display: 'flex', flexDirection: stacked ? 'column' : 'row',
        boxShadow: `0 40px 90px -30px rgba(0,0,0,0.55), 0 0 0 1px ${withAlpha(brand.primary, '26')}`,
      }}>

        {/* The picture side: the organisation's own banner, a screenshot, or
            the Office at a glance. On a phone it sits on top. */}
        <div style={{
          position: 'relative', overflow: 'hidden', order: stacked ? 0 : 1,
          flex: stacked ? '0 0 auto' : '1 1 auto',
          // The last stop's first moves need the room more than the rocket.
          height: stacked && slide.moves ? (isMobile ? 'min(22dvh, 170px)' : 190) : isMobile ? 'min(42dvh, 340px)' : stacked ? 360 : '100%',
          transition: reducedMotion ? 'none' : 'height 0.3s ease',
          background: slide.visual === 'brand' || slide.moves ? brand.hero : `linear-gradient(150deg, ${withAlpha(brand.primary, '1F')}, ${withAlpha(brand.secondary, '24')})`,
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : 0, boxSizing: 'border-box',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', width: 340, height: 340, right: -120, top: -170, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, '8C')}` }} />
          <div aria-hidden="true" style={{ position: 'absolute', width: 260, height: 260, left: -110, bottom: -150, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, '99')}` }} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={slide.key} {...slideMotion} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '18px 18px 0' : stacked ? '26px 26px 0' : 34, boxSizing: 'border-box' }}>
              <TourVisual slide={slide} org={org} brand={brand} isMobile={isMobile} stacked={stacked} reducedMotion={reducedMotion} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* The words side */}
        <div style={{ flex: stacked ? '1 1 auto' : '0 0 400px', display: 'flex', flexDirection: 'column', minHeight: 0, padding: isMobile ? '16px 20px 0' : stacked ? '20px 28px 0' : '26px 30px 0', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 14 : 22 }}>
            <div aria-hidden="true" style={{ display: 'flex', gap: 5, flex: 1 }}>
              {slides.map((s, i) => (
                <span key={s.key} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= index ? brand.ink : 'var(--border)', opacity: i < index ? 0.45 : 1, transition: 'background 0.25s, opacity 0.25s' }} />
              ))}
            </div>
            {!last && <button onClick={onClose} style={{ ...quietButton, color: 'var(--text3)' }}>Skip tour</button>}
          </div>

          <div className="ls-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={slide.key} {...slideMotion}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 19, background: withAlpha(brand.primary, '1A'), color: brand.ink }}><Icon name={slide.icon} /></span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: brand.ink }}>{slide.eyebrow}</span>
                </div>
                <h2 id="ls-tour-title" style={{ margin: '0 0 10px', fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 25 : 31, lineHeight: 1.12, fontWeight: 800, letterSpacing: -0.6, color: 'var(--text)' }}>{slide.title}</h2>
                <p style={{ margin: 0, fontSize: isMobile ? 14.5 : 15.5, lineHeight: 1.6, color: 'var(--text2, var(--text))' }}>{slide.body}</p>
                {slide.moves && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                    {slide.moves.map(move => (
                      <button key={move.tab} onClick={() => onNavigate(move.tab)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, padding: '9px 12px', textAlign: 'left',
                        borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 16, background: withAlpha(brand.primary, '1A'), color: brand.ink, flexShrink: 0 }}><Icon name={move.icon} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{move.label}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{move.hint}</span>
                        </span>
                        <span aria-hidden="true" style={{ color: brand.ink, fontWeight: 800 }}>→</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: isMobile ? '14px 0 calc(14px + env(safe-area-inset-bottom, 0px))' : stacked ? '16px 0 22px' : '18px 0 26px', borderTop: stacked ? '1px solid var(--border-soft, var(--border))' : 'none', marginTop: 12 }}>
            {index > 0 && <button onClick={() => goTo(index - 1)} style={{ ...quietButton, minHeight: 48, padding: '0 16px', border: '1.5px solid var(--border)', color: 'var(--text2, var(--text))' }}>Back</button>}
            <button ref={primaryRef} onClick={() => (last ? onClose() : goTo(index + 1))} style={{
              flex: 1, minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
              background: last ? 'var(--surface2)' : brand.ink, color: last ? 'var(--text)' : '#fff',
              boxShadow: last ? 'inset 0 0 0 1.5px var(--border)' : `0 12px 26px -12px ${withAlpha(brand.primary, 'CC')}`,
            }}>
              {primaryLabel}{!last && <span aria-hidden="true"> →</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TourVisual({ slide, org, brand, isMobile, stacked, reducedMotion }) {
  if (slide.visual === 'brand') {
    return (
      <div style={{ textAlign: 'center', color: '#fff', position: 'relative' }}>
        <div style={{ display: 'inline-flex', marginBottom: 18, animation: reducedMotion ? 'none' : 'ls-tour-float 4s ease-in-out infinite' }}>
          <OrgLogo org={org} height={isMobile ? 64 : 84} maxWidth={isMobile ? 220 : 280} />
        </div>
        <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -0.5 }}>{org?.name}</div>
        {org?.slogan && <div style={{ marginTop: 6, fontSize: 14, color: '#ffffffcc' }}>{org.slogan}</div>}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '7px 14px', borderRadius: 99, background: '#ffffff24', border: '1px solid #ffffff38', fontSize: 12.5, fontWeight: 700 }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: brand.accent }} /> Your space, in your colours
        </div>
      </div>
    )
  }

  if (slide.shot?.kind === 'phone') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: stacked ? 'flex-start' : 'center' }}>
        <div style={{
          width: isMobile ? 170 : stacked ? 190 : 250, borderRadius: isMobile || stacked ? 26 : 34, border: `${isMobile || stacked ? 6 : 8}px solid #0F172A`, background: '#0F172A', overflow: 'hidden',
          boxShadow: '0 30px 60px -20px rgba(15,23,42,0.55)', transform: reducedMotion ? 'none' : 'rotate(-2deg)',
        }}>
          <img src={slide.shot.src} alt={slide.shot.alt} style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>
      </div>
    )
  }

  if (slide.shot) {
    return (
      <div style={{
        width: '100%', maxWidth: 560, alignSelf: stacked ? 'flex-start' : 'center', borderRadius: 14, overflow: 'hidden', background: '#fff',
        boxShadow: '0 30px 60px -24px rgba(15,23,42,0.5), 0 0 0 1px rgba(15,23,42,0.08)', transform: reducedMotion || isMobile ? 'none' : 'rotate(-1deg)',
      }}>
        <div aria-hidden="true" style={{ display: 'flex', gap: 6, padding: '9px 12px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
          {['#F87171', '#FBBF24', '#34D399'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 99, background: c }} />)}
        </div>
        <img src={slide.shot.src} alt={slide.shot.alt} style={{ display: 'block', width: '100%', height: 'auto' }} />
      </div>
    )
  }

  if (slide.points) {
    return (
      <div style={{ display: 'grid', gap: isMobile ? 8 : 12, width: '100%', maxWidth: 380 }}>
        {slide.points.map((point, i) => (
          <div key={point.label} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '10px 12px' : '14px 16px', borderRadius: 16,
            background: 'var(--surface)', boxShadow: '0 14px 30px -18px rgba(15,23,42,0.45)', border: `1px solid ${withAlpha(brand.primary, '24')}`,
            transform: reducedMotion || isMobile ? 'none' : `translateX(${[0, 18, 6][i] || 0}px)`,
          }}>
            <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 18, background: withAlpha(brand.primary, '1A'), color: brand.ink, flexShrink: 0 }}><Icon name={point.icon} /></span>
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{point.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>{point.hint}</span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  // The last slide: a small burst of the organisation's colours.
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      {!reducedMotion && CONFETTI.map((piece, i) => (
        <span key={i} aria-hidden="true" style={{
          position: 'absolute', top: '-8%', left: `${piece.left}%`, width: piece.size, height: piece.size * 0.45, borderRadius: 2,
          background: [brand.accent, '#fff', brand.secondary][i % 3],
          animation: `ls-tour-confetti ${piece.duration}s ${piece.delay}s ease-in both`,
          '--drift': `${piece.drift}px`, '--spin': `${piece.spin}deg`, '--fall': isMobile ? '300px' : '560px',
        }} />
      ))}
      <span aria-hidden="true" style={{ fontSize: stacked ? 58 : 96, color: '#fff', animation: reducedMotion ? 'none' : 'ls-tour-launch 1.4s cubic-bezier(0.16,1,0.3,1) both' }}><Icon name="🚀" /></span>
    </div>
  )
}

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 8 + (i % 4) * 2,
  duration: 1.6 + (i % 5) * 0.25,
  delay: (i % 7) * 0.08,
  drift: ((i % 2 ? 1 : -1) * (20 + (i % 5) * 12)),
  spin: 220 + (i % 6) * 70,
}))

const tourKeyframes = `
@keyframes ls-tour-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes ls-tour-launch { 0% { transform: translateY(40px) scale(.7); opacity: 0 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
@keyframes ls-tour-confetti {
  0% { transform: translate(0, 0) rotate(0); opacity: 1 }
  100% { transform: translate(var(--drift), var(--fall)) rotate(var(--spin)); opacity: 0 }
}`

const quietButton = { background: 'none', border: 'none', borderRadius: 12, padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

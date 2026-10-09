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
// The detailed version of each stop, for anyone who presses "Show me step by
// step". Every step names the button as it appears on screen. Checked against
// the app on 9 Oct 2026; when a screen changes, change its guide.
export const GUIDES = {
  home: {
    title: 'Getting around Home',
    open: { tab: 'home', label: 'Go to Home' },
    steps: [
      { title: 'Start with the banner', body: "It shows today's sessions, young people booked, arrivals and the team on duty, with today's timeline underneath. Tap a session on the timeline to open its register." },
      { title: 'Open the register from the top', body: "The button at the top right of the banner opens the register for what's on now. When nothing is planned it offers Plan a session instead." },
      { title: 'Report something straight away', body: 'Raise a concern and Log an injury sit in the banner. While a session is running they move onto that session’s card, so the report is filed against it. Share gives a link and QR code for people without an account.' },
      { title: 'Clear what needs you', body: 'Needs attention lists the jobs waiting for you, such as medical records to review or reflections to write up. Tap one to go straight to it.' },
      { title: 'Use quick actions and search', body: 'Quick actions start a register, a session, a young person, a form or a message. Search at the top finds young people and sessions by name.' },
    ],
    tip: 'While you are new, a Getting started card on Home lists your first four jobs and ticks them off as you go.',
  },
  sessions: {
    title: 'Plan a session, step by step',
    open: { tab: 'planner', label: 'Open Sessions' },
    steps: [
      { title: 'Press + New session', body: 'Start from a template to fill everything in, or pick the kind of session: a regular session, a trip, a workshop and more.' },
      { title: 'Details', body: 'Set the date and times, where it happens and how many it holds, who leads it, and its purpose and plan.' },
      { title: 'People', body: 'Choose the groups or young people it is for, the staff running it, and any volunteer places you want to fill.' },
      { title: 'Requirements', body: 'Say whether it needs a risk assessment, parental consent or a medical information check, attach any forms parents should fill in, and choose the outcomes you hope to see.' },
      { title: 'Review and save', body: 'Check the readiness list, then publish it, schedule it, or save it as a draft to finish later. Once it is published you can open its register straight away.' },
      { title: 'Reuse it next time', body: 'On a session card, ••• gives you Duplicate and Save as template. Templates, at the top of Sessions, starts a new session from one.' },
    ],
    tip: 'Sessions saves your draft on this device as you go, so closing the planner halfway loses nothing.',
  },
  registers: {
    title: 'Run a register at the door',
    open: { tab: 'registers', label: 'Open Registers' },
    steps: [
      { title: 'Open the register', body: 'Press Open register on the session’s card, on Home or in Sessions. Before anyone arrives, press Start session.' },
      { title: 'Sign people in', body: 'Press Sign in beside each name. Or type part of a name in the search box and press Enter: when only one person matches, they are signed in. Undo appears for a few seconds if you tap the wrong one.' },
      { title: 'Record absences', body: 'Press Absent and pick a reason, such as Ill, Cancelled or Parent notified.' },
      { title: 'Walk-ins and notes', body: '+ Walk-in adds someone who was not expected. Notes records anything that happened, and can raise a safeguarding concern from the register.' },
      { title: 'Sign people out', body: 'Press Sign out. If your organisation records collections, choose who they are leaving with, or Leaving independently. Allergy and medical flags stay on every name.' },
      { title: 'Put mistakes right', body: '✎ Correct changes a record after the fact. Every correction is logged with who made it and why.' },
      { title: 'Finish the session', body: 'Press Finish session, check departures and absences (Mark remaining absent does the rest in one go), then close the register. A short reflection comes next.' },
    ],
    tip: 'On a tablet, Kiosk on the session’s card on Home turns it into a self sign-in screen. It needs a PIN to leave.',
  },
  people: {
    title: 'Add and look after your young people',
    open: { tab: 'registers', label: 'Open Registers' },
    steps: [
      { title: 'Add everyone at once', body: 'In Registers press Import register. Drop in an Excel or CSV file of up to 2,000 rows, paste rows from a spreadsheet, or fill in the template on screen or in Excel.' },
      { title: 'Or one at a time', body: 'Press Add young person, or invite a parent to register their own child by email or with a QR code.' },
      { title: 'Keep it all in their profile', body: 'Open a young person to see their medical needs, allergies, emergency contacts, consents (photo, trip, medical and data sharing) and any support plan.' },
      { title: 'Keep an eye on care alerts', body: 'Care alerts on Registers shows everyone with a medical or allergy flag. Home reminds you when medical records have not been confirmed for six months.' },
      { title: 'Raise a concern', body: 'If you are worried about a young person, press Raise a concern on Home. It goes to the Safeguarding Hub, where your safeguarding lead records what happens next.' },
    ],
    tip: 'Each role only sees what it should. Admins set what each person can reach from Team.',
  },
  team: {
    title: 'Bring your team in',
    open: { tab: 'team', label: 'Open Team' },
    steps: [
      { title: 'Invite people', body: 'On Team press Invite someone, add their name and email, and choose Admin, Manager or Staff. They get an email to set their password.' },
      { title: 'Approve and set access', body: 'Open someone on Team to approve them, set their role, and choose what they can reach under Module access.' },
      { title: 'Volunteers', body: 'Volunteers can apply through your sign-up link or QR code, or you can invite them. Add them to a session with + Add volunteers on its card.' },
      { title: 'Forms and newsletters', body: 'In the Office, Forms has ready-made consent, registration and feedback forms with a link to share. Newsletter sends the round-up to parents and volunteers.' },
      { title: 'The rest of the Office', body: 'With Platform + Office: HR keeps staff records, DBS and training checks, onboarding and leave; Payments covers fees and invoices; Resource booking manages rooms, kit and vehicles.' },
    ],
    tip: 'Team also has Internal mail, for messages to your staff that stay inside LaunchSession.',
  },
}

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
      guide: GUIDES.home,
    },
    {
      key: 'sessions', icon: '📅', eyebrow: 'Stop 2 of 5 · Sessions', title: 'Plan it once, reuse it all term',
      body: "Choose when, where, who's coming and who's leading. Duplicate it, or save it as a template for next time.",
      shot: { src: '/tour/sessions.webp', alt: 'Sessions: upcoming sessions, each with its register', kind: 'desktop' },
      guide: GUIDES.sessions,
    },
    {
      key: 'registers', icon: '✅', eyebrow: 'Stop 3 of 5 · Registers', title: 'Clipboards, retired',
      body: 'Sign young people in and out from any phone. Allergy and medical flags sit right on their name.',
      shot: { src: '/tour/register.webp', alt: 'A register on a phone, with an allergy flag on a child', kind: 'phone' },
      guide: GUIDES.registers,
    },
    {
      key: 'people', icon: '🧒', eyebrow: 'Stop 4 of 5 · Young people', title: 'Everyone, safely in one place',
      body: 'Profiles, medical details and safeguarding concerns live together, and each role only sees what it should.',
      shot: { src: '/tour/people.webp', alt: 'The young people directory with groups, ages and care alerts', kind: 'desktop' },
      guide: GUIDES.people,
    },
    {
      key: 'team', icon: '🤝', eyebrow: 'Stop 5 of 5 · Team & Office', title: 'Bring your crew',
      body: 'Invite your staff and volunteers, then let the Office take the paperwork off your plate.',
      points: [
        { icon: '👋', label: 'Team', hint: 'Invites, and what each role can see' },
        { icon: '📝', label: 'Forms & newsletters', hint: 'Consent forms and updates for parents' },
        { icon: '💼', label: 'Office', hint: 'HR, resource bookings and payments' },
      ],
      guide: GUIDES.team,
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
  // The step-by-step guide for the current stop, for anyone who wants more
  // than the one-line summary. Moving to another stop closes it.
  const [guideOpen, setGuideOpen] = useState(false)
  // The stop's text scrolls in its own box on a laptop. It takes keyboard
  // focus (the tour's arrow keys are off while a guide is open, so this is how
  // a keyboard reaches steps 4 to 6), and fades at the bottom while there is
  // more below, rather than cutting off mid-sentence.
  const scrollRef = useRef(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const checkMore = () => {
    const el = scrollRef.current
    setMoreBelow(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 8)
  }
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
    setGuideOpen(false)
    setIndex(clamped)
  }
  const guide = slide.guide

  // Re-measure once the new stop has animated in, and when the window resizes.
  useEffect(() => {
    const timer = setTimeout(checkMore, 360)
    window.addEventListener('resize', checkMore)
    return () => { clearTimeout(timer); window.removeEventListener('resize', checkMore) }
  }, [index, guideOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => {
      // Inside a guide, Escape goes back to the tour, and the arrows stay put
      // so nobody skips a stop halfway through reading its steps.
      if (guideOpen) { if (e.key === 'Escape') setGuideOpen(false); return }
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
  }, [index, slides, guideOpen])

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
          height: stacked && (slide.moves || guideOpen) ? (isMobile ? 'min(22dvh, 170px)' : 190) : isMobile ? 'min(42dvh, 340px)' : stacked ? 360 : '100%',
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

          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} onScroll={checkMore} className="ls-scroll" tabIndex={0} role="region"
            aria-label={guideOpen && guide ? guide.title : slide.title}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', outlineOffset: 2 }}>
            <AnimatePresence mode="wait" initial={false} onExitComplete={checkMore}>
              {guideOpen && guide ? (
                <motion.div key={`${slide.key}-guide`} {...slideMotion}>
                  <GuideSteps guide={guide} icon={slide.icon} brand={brand} isMobile={isMobile} />
                </motion.div>
              ) : (
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
                {guide && (
                  <button onClick={() => setGuideOpen(true)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 18, padding: '0 14px',
                    borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
                    fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <span aria-hidden="true" style={{ color: brand.ink, display: 'inline-flex' }}><Icon name="📋" /></span>
                    Show me step by step <span aria-hidden="true" style={{ color: brand.ink }}>→</span>
                  </button>
                )}
              </motion.div>
              )}
            </AnimatePresence>
          </div>
          {moreBelow && <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, pointerEvents: 'none', background: 'linear-gradient(to bottom, transparent, var(--surface))' }} />}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: isMobile ? '14px 0 calc(14px + env(safe-area-inset-bottom, 0px))' : stacked ? '16px 0 22px' : '18px 0 26px', borderTop: stacked ? '1px solid var(--border-soft, var(--border))' : 'none', marginTop: 12 }}>
            {guideOpen && guide ? (
              <>
                <button onClick={() => setGuideOpen(false)} style={{ ...quietButton, minHeight: 48, padding: '0 14px', border: '1.5px solid var(--border)', color: 'var(--text2, var(--text))' }}>← Back to the tour</button>
                <button ref={primaryRef} onClick={() => onNavigate(guide.open.tab)} style={{
                  flex: 1, minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
                  background: brand.ink, color: '#fff', boxShadow: `0 12px 26px -12px ${withAlpha(brand.primary, 'CC')}`,
                }}>{guide.open.label} <span aria-hidden="true">→</span></button>
              </>
            ) : (<>
            {index > 0 && <button onClick={() => goTo(index - 1)} style={{ ...quietButton, minHeight: 48, padding: '0 16px', border: '1.5px solid var(--border)', color: 'var(--text2, var(--text))' }}>Back</button>}
            <button ref={primaryRef} onClick={() => (last ? onClose() : goTo(index + 1))} style={{
              flex: 1, minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
              background: last ? 'var(--surface2)' : brand.ink, color: last ? 'var(--text)' : '#fff',
              boxShadow: last ? 'inset 0 0 0 1.5px var(--border)' : `0 12px 26px -12px ${withAlpha(brand.primary, 'CC')}`,
            }}>
              {primaryLabel}{!last && <span aria-hidden="true"> →</span>}
            </button>
            </>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// One stop's step-by-step guide: numbered steps, each naming the button as it
// appears on screen, and a tip.
function GuideSteps({ guide, icon, brand, isMobile }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 19, background: withAlpha(brand.primary, '1A'), color: brand.ink }}><Icon name={icon} /></span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: brand.ink }}>Step-by-step guide</span>
      </div>
      <h2 id="ls-tour-title" style={{ margin: '0 0 14px', fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 22 : 26, lineHeight: 1.15, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text)' }}>{guide.title}</h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {guide.steps.map((step, i) => (
          <li key={step.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff', background: brand.ink, marginTop: 1 }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{step.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text2, var(--text))', marginTop: 2 }}>{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
      {guide.tip && (
        <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 12, background: withAlpha(brand.primary, '12'), border: `1px solid ${withAlpha(brand.primary, '2E')}`, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
          <strong style={{ color: 'var(--org-ink, inherit)' }}>Tip: </strong>{guide.tip}
        </div>
      )}
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

const quietButton = { minHeight: 44, background: 'none', border: 'none', borderRadius: 12, padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

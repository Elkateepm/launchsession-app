import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import OnboardingLayout, { useReducedMotion } from './onboarding/OnboardingLayout'
import ProgressHeader from './onboarding/ProgressHeader'
import SelectionCard from './onboarding/SelectionCard'
import AnimatedInput from './onboarding/AnimatedInput'
import { Icon } from './onboarding/icons'
// Aliased: this file already imports an Icon from ./onboarding/icons,
// and that one takes a `name` prop too, so the names genuinely collide.
import LSIcon from '../../lib/icons'

const DRAFT_KEY = 'ls_signup_draft_v2'

// create_trial_signup does the insert, the approval and the email trigger in
// one round trip, so there are only two moments the client can honestly
// report: the call going out, and it coming back with the mail on its way.
// A third "Setting up your organisation..." label used to sit between these
// and was never once displayed.
const SUBMIT_LABEL = {
  creating: 'Creating your workspace...',
  sending:  'Sending your login link...',
}

// Expanded organisation-type list. Values stay as free text on the backend
// (trial_requests.org_type has no check constraint), so adding options here
// needs no migration -- see handleSubmit for how "Other" gets resolved.
const ORG_TYPES = [
  { key: 'charity',           label: 'Charity',                    icon: 'heart',     description: 'Registered charities and non-profits' },
  { key: 'sports_club',       label: 'Sports Club',                icon: 'ball',      description: 'Clubs, academies and sports coaching' },
  { key: 'community_centre',  label: 'Community Centre',           icon: 'building',  description: 'Multi-purpose community spaces' },
  { key: 'after_school',      label: 'After-School Club',          icon: 'backpack',  description: 'Wraparound and after-school care' },
  { key: 'youth_club',        label: 'Youth Club',                 icon: 'users',     description: 'Open-access youth provision' },
  { key: 'faith_community',   label: 'Faith or Community Group',   icon: 'handshake', description: 'Faith groups and grassroots organisations' },
  { key: 'holiday_club',      label: 'Holiday Club',               icon: 'sun',       description: 'School holiday activity camps' },
  { key: 'mentoring',         label: 'Mentoring Programme',        icon: 'compass',   description: '1:1 and group mentoring schemes' },
  { key: 'education',         label: 'Education Provider',         icon: 'cap',       description: 'Schools, tutors and training providers' },
  { key: 'local_authority',   label: 'Local Authority',            icon: 'columns',   description: 'Councils and public-sector youth services' },
  { key: 'social_enterprise', label: 'Social Enterprise',          icon: 'leaf',      description: 'Mission-driven, trading for impact' },
  { key: 'other',             label: 'Other',                      icon: 'sparkle',   description: 'Tell us what you run' },
]

const ORG_TYPE_TIP = "Whatever you run, LaunchSession adapts — enable only the modules your team actually needs. This never locks you in; change it anytime in Settings."

const WHAT_YOU_GET_GROUPS = [
  { title: 'Run your sessions', color: '#60A5FA', items: [
    { icon: 'calendar', label: 'Sessions & Planning' }, { icon: 'clipboard', label: 'Live Registers' },
    { icon: 'calendar', label: 'Calendar' }, { icon: 'document', label: 'Forms' },
  ]},
  { title: 'Keep everyone safe', color: '#F87171', items: [
    { icon: 'shield', label: 'Safeguarding' }, { icon: 'alertTriangle', label: 'Risk Assessments' },
    { icon: 'bell', label: 'Alerts & Reminders' }, { icon: 'archive', label: 'Data Retention' },
  ]},
  { title: 'Your people', color: '#4ADE80', items: [
    { icon: 'child', label: 'Children & Groups' }, { icon: 'heart', label: 'Volunteers' },
    { icon: 'handshake', label: 'Mentoring' }, { icon: 'chat', label: 'Messaging' },
  ]},
  // Only things the product actually does. Fundraising is hibernated and Events
  // & Trips is no longer a destination of its own, so advertising either here
  // would promise a signup something it cannot then find.
  { title: 'Grow & report', color: '#FBBF24', items: [
    { icon: 'chartBar', label: 'Reports & Impact' }, { icon: 'palette', label: 'Branding' },
  ]},
]

const EMAIL_RE = /\S+@\S+\.\S+/

const STEP_KEYS = ['org', 'type', 'you', 'review']

// The last step a saved draft is allowed to resume on, given what it actually
// contains. Used to clamp the restored step index -- see the restore effect.
function furthestAllowedStep(d) {
  if (!(d.organisationName || '').trim()) return 0
  if (!d.orgType) return 1
  if (!((d.fullName || '').trim().length > 1 && EMAIL_RE.test((d.email || '').trim()))) return 2
  return 3
}
const STEP_TITLES = { org: 'Organisation name', type: 'Organisation type', you: 'Your details', review: 'Review & confirm' }

// Step content enter/exit -- separate transitions per direction so the
// exit is quick (180-220ms) and the entrance settles in a touch slower
// (280-350ms), per spec. Reduced motion drops the slide entirely.
const stepVariants = {
  initial: { opacity: 0, x: 14 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
}
const stepVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

export default function Signup() {
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [stepIndex, setStepIndex]                = useState(0)
  const [organisationName, setOrganisationName]  = useState('')
  const [orgType, setOrgType]                    = useState('')
  const [orgTypeOther, setOrgTypeOther]          = useState('')
  const [fullName, setFullName]                  = useState('')
  const [email, setEmail]                        = useState('')
  const [loading, setLoading]                    = useState(false)
  const [submitStep, setSubmitStep]              = useState(null)
  const [done, setDone]                          = useState(false)
  const [launching, setLaunching]                = useState(false)
  const [error, setError]                        = useState('')
  const [agreedToTerms, setAgreedToTerms]        = useState(false)
  const [legalModal, setLegalModal]              = useState(null) // null | 'terms' | 'privacy'
  const [restored, setRestored]                  = useState(false)
  const [navLocked, setNavLocked]                = useState(false)
  const [touchedOrg, setTouchedOrg]              = useState(false)
  const [touchedName, setTouchedName]            = useState(false)
  const [touchedEmail, setTouchedEmail]          = useState(false)
  const [resendState, setResendState]            = useState('idle') // idle | sending | sent
  const [resendNote, setResendNote]              = useState('')
  // Bumped on every failed submit so an identical repeat error still scrolls
  // itself back into view rather than silently doing nothing.
  const [errorNonce, setErrorNonce]              = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const d = JSON.parse(saved)
        if (d.organisationName) setOrganisationName(d.organisationName)
        if (d.orgType) setOrgType(d.orgType)
        if (d.orgTypeOther) setOrgTypeOther(d.orgTypeOther)
        if (d.fullName) setFullName(d.fullName)
        if (d.email) setEmail(d.email)
        if (typeof d.stepIndex === 'number') {
          // Clamped to the furthest step whose prerequisites the draft
          // actually satisfies. A draft written by an older version of this
          // form, or edited by hand, would otherwise drop someone straight
          // onto Review with empty fields and a button they cannot press.
          const allowed = furthestAllowedStep(d)
          setStepIndex(Math.min(Math.max(d.stepIndex, 0), STEP_KEYS.length - 1, allowed))
        }
      }
    } catch (e) {}
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveTimer = useRef(null)
  useEffect(() => {
    if (!restored || done) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ stepIndex, organisationName, orgType, orgTypeOther, fullName, email })) } catch (e) {}
    }, 400)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, done, stepIndex, organisationName, orgType, orgTypeOther, fullName, email])

  // The submit button sits in a fixed bar at the bottom on mobile while errors
  // render at the top of the panel, so without this a failed submit looked
  // like nothing happened at all.
  const errorRef = useRef(null)
  useEffect(() => {
    if (!error || !errorRef.current) return
    errorRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  }, [error, errorNonce, reducedMotion])

  const emailRef = useRef(null)

  const currentKey = STEP_KEYS[stepIndex]
  const canContinue = {
    org: organisationName.trim().length > 1,
    type: !!orgType,
    you: fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(email.trim()),
    review: agreedToTerms,
  }[currentKey]

  const disabledReason = {
    org: 'Enter your organisation\'s name to continue.',
    type: 'Select an organisation type to continue.',
    you: 'Add your name and a valid email to continue.',
    review: 'Agree to the Terms of Service and Privacy Policy to continue.',
  }[currentKey]

  // Locks nav briefly around a step change so rapid double-clicks can't
  // fire the exit/enter animation twice mid-flight.
  const withNavLock = (fn) => () => {
    if (navLocked) return
    setNavLocked(true)
    fn()
    setTimeout(() => setNavLocked(false), reducedMotion ? 60 : 380)
  }

  const goNext = withNavLock(() => { if (canContinue && stepIndex < STEP_KEYS.length - 1) setStepIndex(i => i + 1) })
  const goBack = withNavLock(() => { if (stepIndex > 0) setStepIndex(i => i - 1) })
  const saveAndExit = () => { window.location.href = '/landing.html' }

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)
    setError('')

    const resolvedOrgType = (orgType === 'other' && orgTypeOther.trim()) ? orgTypeOther.trim() : orgType

    setSubmitStep(SUBMIT_LABEL.creating)
    // One call: the row insert, the approval, and the values needed to send the
    // invite email all happen server-side under SECURITY DEFINER. The client
    // used to insert, approve, then re-read trial_requests -- which required
    // anon to hold SELECT on that table, and the only workable policy there
    // (recent rows) let anyone read anyone else's admin_invite_token.
    const { error: signupError } = await supabase.rpc('create_trial_signup', {
      p_organisation_name: organisationName.trim(),
      p_full_name: fullName.trim(),
      p_email: email.trim().toLowerCase(),
      p_org_type: resolvedOrgType,
      p_terms_agreed: agreedToTerms,
    })

    if (signupError) {
      const raw = signupError.message || ''
      if (raw.includes('ORG_NAME_TAKEN')) {
        setError(`An organisation called "${organisationName.trim()}" is already active on LaunchSession. If this is you, check your email for the original login link, or use a different name.`)
      } else if (raw.includes('SIGNUP_RATE_LIMIT')) {
        // The RPC's rate-limit messages are already written for the person
        // reading them, and say the one thing the generic copy below gets
        // actively wrong: trying again right now is what will not work.
        setError(raw.split('SIGNUP_RATE_LIMIT:').pop().trim())
      } else {
        setError('Could not create your workspace. Please try again, or contact support@launchsession.co.uk if it keeps happening.')
        console.warn('Signup failed:', raw)
      }
      setLoading(false)
      setSubmitStep(null)
      setErrorNonce(n => n + 1)
      return
    }

    // Deliberately nothing read from the response beyond success. The RPC no
    // longer returns admin_invite_token, and must not: the invite email is what
    // proves whoever filled this in owns the address they typed. The send is
    // triggered server-side once the row commits, so the token never reaches
    // the browser.
    setSubmitStep(SUBMIT_LABEL.sending)

    try { localStorage.removeItem(DRAFT_KEY) } catch (e) {}

    setLoading(false)
    setSubmitStep(null)

    // Brief "launch" beat -- rocket accent + glow brighten -- before the
    // success screen replaces the panel. Kept well under 900ms and never
    // gates access; it plays while state is already fully settled.
    if (reducedMotion) {
      setDone(true)
    } else {
      setLaunching(true)
      setTimeout(() => { setLaunching(false); setDone(true) }, 700)
    }
  }

  // Re-triggers the invite email server-side. The RPC is deliberately silent
  // about whether an address matched anything, so this can only ever report
  // "sent" -- claiming otherwise would turn the button into a way of testing
  // which addresses have workspaces.
  const handleResend = async () => {
    if (resendState !== 'idle') return
    setResendState('sending')
    setResendNote('')
    const { error: resendErr } = await supabase.rpc('resend_signup_invite', {
      p_email: email.trim().toLowerCase(),
    })
    if (resendErr) {
      const raw = resendErr.message || ''
      setResendNote(raw.includes('RESEND_RATE_LIMIT')
        ? raw.split('RESEND_RATE_LIMIT:').pop().trim()
        : 'We could not resend it just now. Please email support@launchsession.co.uk and we will get you in.')
      setResendState('idle')
      return
    }
    setResendState('sent')
    setResendNote('')
    // Back to idle after a beat so a genuinely undelivered second attempt is
    // still possible; the RPC's own rate limit is what actually bounds this.
    setTimeout(() => setResendState('idle'), 30000)
  }

  // ── SUCCESS SCREEN ──
  if (done) return (
    <OnboardingLayout wide={false}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}><LSIcon name="🎉" /></div>
        <h2 style={{ ...cardTitle, textAlign: 'center', marginBottom: 12 }}>You're all set!</h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>We've sent a login link to</p>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#60A5FA', marginBottom: 20, wordBreak: 'break-all' }}>{email}</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          Click the link to set your password and access your <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{organisationName}</strong> workspace — with full access to everything for your first 14 days. It usually arrives within a minute; check your spam folder if it doesn't.
        </p>

        {/* That email is the only way into the new workspace, so this screen
            used to be a dead end: nothing to press, and no way back to a
            mistyped address. */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 12 }}>
            Didn't get it?
          </div>
          {/* primaryBtn carries no background of its own -- the gradient lives
              on .ls-primary-btn -- so the class has to stay on while sending,
              or the button renders transparent mid-request. Only the settled
              "sent" state drops it, for the green fill. */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState !== 'idle'}
            className={resendState === 'sent' ? undefined : 'ls-primary-btn'}
            style={{
              ...primaryBtn, width: '100%', padding: '12px', fontSize: 14,
              boxShadow: 'none',
              background: resendState === 'sent' ? 'rgba(74,222,128,0.16)' : undefined,
              color: resendState === 'sent' ? '#4ADE80' : '#fff',
              opacity: resendState === 'sending' ? 0.7 : 1,
              cursor: resendState === 'idle' ? 'pointer' : 'default',
            }}
          >
            {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? '✓ Sent again — check your inbox' : 'Resend the email'}
          </button>
          {resendNote && (
            <div role="status" style={{ fontSize: 12, color: '#FCD34D', lineHeight: 1.6, marginTop: 10 }}>{resendNote}</div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginTop: 12 }}>
            Typed the wrong address? Email <a href="mailto:support@launchsession.co.uk" style={{ color: '#60A5FA' }}>support@launchsession.co.uk</a> and we'll point <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{organisationName}</strong> at the right one.
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, textAlign: 'left' }}>
          💡 Once you've set your password, you can sign in anytime at{' '}
          <a href="https://app.launchsession.co.uk" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 700 }}>app.launchsession.co.uk</a>
        </div>
      </div>
    </OnboardingLayout>
  )

  const stepNumber = stepIndex + 1
  const isTypeStep = currentKey === 'type'
  const isReviewStep = currentKey === 'review'
  const stepWide = isTypeStep || isReviewStep

  return (
    <OnboardingLayout wide onBackHome={saveAndExit} panelStyle={launching ? { transition: 'opacity 0.5s ease', opacity: 0.3 } : undefined}>
      {/* Rocket-accent launch beat on final completion */}
      {launching && !reducedMotion && (
        <div aria-hidden="true" style={{ position: 'fixed', left: '50%', bottom: '30%', fontSize: 28, animation: 'ls-rocket-up 700ms ease-out forwards', pointerEvents: 'none', zIndex: 300 }}><LSIcon name="🚀" /></div>
      )}

      <ProgressHeader
        stepNumber={stepNumber}
        totalSteps={STEP_KEYS.length}
        title={STEP_TITLES[currentKey]}
        showBack={stepIndex > 0}
        onBack={goBack}
        onSaveExit={saveAndExit}
      />

      {error && (
        <div role="alert" ref={errorRef} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, lineHeight: 1.5, animation: reducedMotion ? 'ls-fade-in 150ms ease' : 'ls-label-in 260ms cubic-bezier(0.16,1,0.3,1)' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ maxWidth: stepWide ? 'none' : 460, margin: stepWide ? 0 : '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentKey}
            variants={reducedMotion ? stepVariantsReduced : stepVariants}
            initial="initial" animate="animate" exit="exit"
            style={{ display: 'flex', flexDirection: 'column' }}
          >

            {currentKey === 'org' && (
              <div>
                <p style={cardSub}>What's your organisation called? This becomes your dedicated, private workspace name.</p>
                <AnimatedInput
                  autoFocus
                  valid={organisationName.trim().length > 1}
                  error={touchedOrg && organisationName.trim().length === 1 ? 'That name looks a little short — add a bit more.' : ''}
                  inputProps={{
                    disabled: loading,
                    placeholder: 'e.g. Acme Youth Club',
                    value: organisationName,
                    onChange: e => setOrganisationName(e.target.value),
                    onBlur: () => setTouchedOrg(true),
                    onKeyDown: e => e.key === 'Enter' && canContinue && goNext(),
                  }}
                />
                <Teach security>Every organisation gets its own secure, fully separate workspace — your data is never shared with anyone else on LaunchSession.</Teach>
              </div>
            )}

            {currentKey === 'type' && (
              <div>
                <h2 style={cardTitle}>What type of organisation is {organisationName || 'it'}?</h2>
                <p style={cardSub}>This helps us personalise your workspace. You can change it later.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 4 }}>
                  {ORG_TYPES.map(t => (
                    <SelectionCard
                      key={t.key}
                      icon={t.icon}
                      title={t.label}
                      description={t.description}
                      selected={orgType === t.key}
                      onClick={() => setOrgType(t.key)}
                    />
                  ))}
                </div>

                {orgType === 'other' && (
                  <div style={{ marginTop: 14 }}>
                    <AnimatedInput
                      label="Tell us what type of organisation you run"
                      autoFocus
                      valid={orgTypeOther.trim().length > 1}
                      inputProps={{
                        disabled: loading,
                        placeholder: 'e.g. Scout group, arts collective, food bank...',
                        value: orgTypeOther,
                        onChange: e => setOrgTypeOther(e.target.value),
                      }}
                    />
                  </div>
                )}

                {orgType && <Teach>{ORG_TYPE_TIP}</Teach>}
              </div>
            )}

            {currentKey === 'you' && (
              <div>
                <p style={cardSub}>Now, a bit about you — you'll be the first admin. Invite your whole team once you're in.</p>
                <div style={{ marginBottom: 14 }}>
                  <AnimatedInput
                    label="Your full name"
                    autoFocus
                    valid={fullName.trim().length > 1}
                    error={touchedName && fullName.trim().length === 1 ? 'Add your full name.' : ''}
                    inputProps={{
                      disabled: loading,
                      placeholder: 'e.g. Jane Smith',
                      value: fullName,
                      onChange: e => setFullName(e.target.value),
                      onBlur: () => setTouchedName(true),
                      // Enter here can't advance the step -- the email below is
                      // still empty -- so send it to that field instead of
                      // letting the key do nothing.
                      onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); emailRef.current?.focus() } },
                    }}
                  />
                </div>
                <AnimatedInput
                  label="Work email"
                  valid={/\S+@\S+\.\S+/.test(email.trim())}
                  error={touchedEmail && email.trim().length > 2 && !/\S+@\S+\.\S+/.test(email.trim()) ? 'That doesn\'t look like a valid email yet.' : ''}
                  inputProps={{
                    ref: emailRef,
                    type: 'email',
                    disabled: loading,
                    placeholder: 'jane@organisation.org',
                    value: email,
                    onChange: e => setEmail(e.target.value),
                    onBlur: () => setTouchedEmail(true),
                    onKeyDown: e => e.key === 'Enter' && canContinue && goNext(),
                  }}
                />
                <Teach><LSIcon name="⚡" /> Your login link arrives within seconds — no waiting on manual approval, no card required.</Teach>
              </div>
            )}

            {currentKey === 'review' && (
              <div>
                <h2 style={cardTitle}>Here's what {organisationName} gets</h2>
                <p style={cardSub}>Full access to everything below, free for 14 days.</p>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 14 }}>
                  {WHAT_YOU_GET_GROUPS.map((g, gi) => (
                    <div key={g.title} style={{
                      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14,
                      opacity: reducedMotion ? 1 : 0,
                      animation: reducedMotion ? 'none' : `ls-stagger-up 420ms ${120 + gi * 70}ms cubic-bezier(0.16,1,0.3,1) forwards`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0, boxShadow: `0 0 8px ${g.color}88` }} />
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{g.title}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                        {g.items.map(m => (
                          <div key={m.label} className="ls-feature-item" style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 11, padding: '9px 10px', minWidth: 0 }}>
                            <span style={{ width: 26, height: 26, borderRadius: 8, background: `${g.color}22`, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon name={m.icon} width={14} height={14} strokeWidth={2} />
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '2px 0 18px' }}>...and everything else, unlocked from day one — nothing to upgrade into.</p>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 0 18px' }} />

                <div style={{ maxWidth: 460, margin: '0 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA', flexShrink: 0, boxShadow: '0 0 8px #A78BFA88' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Your details</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', marginBottom: 6 }}>
                    <Row k="Organisation" v={organisationName} />
                    <Row k="Type" v={ORG_TYPES.find(t => t.key === orgType)?.label || orgTypeOther || '—'} />
                    <Row k="Admin" v={fullName} />
                    <Row k="Email" v={email} last />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={e => setAgreedToTerms(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: '#3B82F6', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                      I agree to LaunchSession's{' '}
                      <a href="/terms.html" onClick={e => { e.preventDefault(); setLegalModal('terms') }} style={{ color: '#60A5FA', fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</a>
                      {' '}and{' '}
                      <a href="/privacy.html" onClick={e => { e.preventDefault(); setLegalModal('privacy') }} style={{ color: '#60A5FA', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</a>.
                    </span>
                  </label>

                  {loading && submitStep && (
                    <div role="status" style={{ margin: '16px 0 0', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, border: '2px solid #3B82F6', borderTop: '2px solid transparent', borderRadius: '50%', animation: reducedMotion ? 'none' : 'ls-spin 0.8s linear infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{submitStep}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {legalModal && <LegalModal doc={legalModal} onClose={() => setLegalModal(null)} onAgree={() => { setAgreedToTerms(true); setLegalModal(null) }} />}

      <div style={isMobile ? mobileStickyNav : { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, maxWidth: stepWide ? 460 : 'none', margin: !isMobile && stepWide ? '24px auto 0' : '24px 0 0' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} disabled={loading || navLocked} style={ghostBtn}><LSIcon name="←" /> Back</button>
          )}
          {currentKey === 'review' ? (
            <button type="button" onClick={handleSubmit} disabled={loading || !canContinue} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1, opacity: loading || !canContinue ? 0.6 : 1 }}>
              {loading ? 'Saving…' : <>Create My Workspace <span className="ls-btn-arrow"><LSIcon name="→" /></span></>}
            </button>
          ) : (
            <button type="button" onClick={goNext} disabled={!canContinue || navLocked} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'default' }}>
              Continue <span className="ls-btn-arrow"><LSIcon name="→" /></span>
            </button>
          )}
        </div>
        {!canContinue && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{disabledReason}</div>}
      </div>
      {isMobile && <div style={{ height: 84 }} />}
    </OnboardingLayout>
  )
}

const LEGAL_DOCS = {
  terms:   { title: 'Terms of Service', src: '/terms.html' },
  privacy: { title: 'Privacy Policy',   src: '/privacy.html' },
}

function LegalModal({ doc, onClose, onAgree }) {
  const { title, src } = LEGAL_DOCS[doc]
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,7,17,0.75)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 640, height: '85vh', maxHeight: 720, background: '#06091A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}><LSIcon name="✕" /></button>
        </div>
        <iframe title={title} src={src} style={{ flex: 1, width: '100%', border: 'none', background: '#06091A' }} />
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ ...ghostBtn, flex: 1, padding: '12px' }}>Close</button>
          <button type="button" onClick={onAgree} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1, padding: '12px' }}>I agree <LSIcon name="→" /></button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{k}</span>
      <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, wordBreak: 'break-word', textAlign: 'right', maxWidth: '65%' }}>{v}</span>
    </div>
  )
}

function Teach({ children, security }) {
  const reducedMotion = useReducedMotion()
  return (
    <div style={{
      marginTop: 18, borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
      background: 'rgba(139,92,246,0.08)',
      border: '1px solid rgba(139,92,246,0.25)',
      backgroundImage: (security && !reducedMotion) ? 'linear-gradient(100deg, transparent 30%, rgba(139,92,246,0.25) 50%, transparent 70%)' : 'none',
      backgroundSize: '250% 100%',
      backgroundRepeat: 'no-repeat',
      animation: reducedMotion ? 'ls-fade-in 200ms ease' : (security ? 'ls-fade-in 300ms ease, ls-border-sweep 1.1s 250ms ease-out 1' : 'ls-fade-in 300ms ease'),
    }}>
      {security && <span aria-hidden="true" style={{ display: 'inline-block', marginRight: 2, animation: reducedMotion ? 'none' : 'ls-lock-pulse 500ms 350ms ease' }}><LSIcon name="🔒" /></span>}
      {children}
    </div>
  )
}

const cardTitle = { fontSize: 22, margin: '0 0 8px', fontWeight: 900, color: '#fff', lineHeight: 1.3 }
const cardSub   = { color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }
const primaryBtn = { padding: '15px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 40px rgba(59,130,246,0.35)', fontFamily: 'inherit' }
const ghostBtn  = { padding: '15px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
const mobileStickyNav = { position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(7,11,22,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 50 }

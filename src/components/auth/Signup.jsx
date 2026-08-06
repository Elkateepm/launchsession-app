import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import OnboardingLayout, { useReducedMotion } from './onboarding/OnboardingLayout'
import ProgressHeader from './onboarding/ProgressHeader'
import SelectionCard from './onboarding/SelectionCard'

const DRAFT_KEY = 'ls_signup_draft_v2'

const SUBMIT_STEPS = [
  { id: 'insert',  label: 'Creating your workspace...' },
  { id: 'approve', label: 'Setting up your organisation...' },
  { id: 'email',   label: 'Sending your login link...' },
]

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
  {
    title: 'Run your sessions',
    color: '#60A5FA',
    items: [
      { icon: '📅', label: 'Sessions & Planning' },
      { icon: '📋', label: 'Live Registers' },
      { icon: '🗓️', label: 'Calendar' },
      { icon: '📝', label: 'Forms' },
    ],
  },
  {
    title: 'Keep everyone safe',
    color: '#F87171',
    items: [
      { icon: '🛡️', label: 'Safeguarding' },
      { icon: '⚠️', label: 'Risk Assessments' },
      { icon: '🔔', label: 'Alerts & Reminders' },
      { icon: '🗄️', label: 'Data Retention' },
    ],
  },
  {
    title: 'Your people',
    color: '#4ADE80',
    items: [
      { icon: '🧒', label: 'Children & Groups' },
      { icon: '❤️', label: 'Volunteers' },
      { icon: '🤝', label: 'Mentoring' },
      { icon: '💬', label: 'Messaging' },
    ],
  },
  {
    title: 'Grow & report',
    color: '#FBBF24',
    items: [
      { icon: '📊', label: 'Reports & Impact' },
      { icon: '💰', label: 'Fundraising' },
      { icon: '🎨', label: 'Branding' },
      { icon: '✈️', label: 'Events & Trips' },
    ],
  },
]

const STEP_KEYS = ['org', 'type', 'you', 'review']
const STEP_TITLES = { org: 'Organisation name', type: 'Organisation type', you: 'Your details', review: 'Review & confirm' }

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
  const [emailFailed, setEmailFailed]            = useState(false)
  const [error, setError]                        = useState('')
  const [agreedToTerms, setAgreedToTerms]        = useState(false)
  const [legalModal, setLegalModal]              = useState(null) // null | 'terms' | 'privacy'
  const [restored, setRestored]                  = useState(false)

  // Restore progress from a previous visit (e.g. accidental refresh or tab
  // close) -- draft is local-only, since there's no authenticated user yet
  // at this stage for a Supabase-backed save.
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
        if (typeof d.stepIndex === 'number') setStepIndex(Math.min(Math.max(d.stepIndex, 0), STEP_KEYS.length - 1))
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
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ stepIndex, organisationName, orgType, orgTypeOther, fullName, email }))
      } catch (e) {}
    }, 400)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, done, stepIndex, organisationName, orgType, orgTypeOther, fullName, email])

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

  const goNext = () => { if (canContinue && stepIndex < STEP_KEYS.length - 1) setStepIndex(i => i + 1) }
  const goBack = () => { if (stepIndex > 0) setStepIndex(i => i - 1) }
  const saveAndExit = () => { window.location.href = '/landing.html' }

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)
    setError('')

    const resolvedOrgType = (orgType === 'other' && orgTypeOther.trim()) ? orgTypeOther.trim() : orgType

    setSubmitStep(SUBMIT_STEPS[0].label)
    const { data: trial, error: insertError } = await supabase
      .from('trial_requests')
      .insert([{
        organisation_name: organisationName.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        org_type: resolvedOrgType,
        status: 'new',
        terms_agreed: agreedToTerms,
        terms_agreed_at: agreedToTerms ? new Date().toISOString() : null,
      }])
      .select()
      .single()

    if (insertError || !trial) {
      setError(insertError?.message || 'Could not create your workspace. Please try again.')
      setLoading(false)
      setSubmitStep(null)
      return
    }

    setSubmitStep(SUBMIT_STEPS[1].label)
    const { error: approveError } = await supabase.rpc('approve_trial_request', { trial_id: trial.id })

    if (approveError) {
      const raw = approveError.message || ''
      if (raw.includes('ORG_NAME_TAKEN')) {
        setError(`An organisation called "${organisationName.trim()}" is already active on LaunchSession. If this is you, check your email for the original login link, or use a different name.`)
      } else {
        setError('Workspace setup failed: ' + raw)
      }
      setLoading(false)
      setSubmitStep(null)
      return
    }

    const { data: approved, error: fetchError } = await supabase
      .from('trial_requests')
      .select('*')
      .eq('id', trial.id)
      .single()

    if (fetchError || !approved) {
      console.warn('Could not fetch approved trial:', fetchError?.message)
    }

    setSubmitStep(SUBMIT_STEPS[2].label)
    let sendFailed = false
    if (approved?.admin_invite_token) {
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: approved.email,
          full_name: approved.full_name,
          org_name: approved.organisation_name,
          org_slug: approved.generated_slug,
          org_color: approved.primary_color || '#3B82F6',
          org_logo: approved.logo_url || null,
          token: approved.admin_invite_token,
          role: 'admin',
        }
      })
      if (emailError) {
        console.warn('Email send failed:', emailError.message)
        sendFailed = true
      }
    } else {
      sendFailed = true
    }

    try { localStorage.removeItem(DRAFT_KEY) } catch (e) {}

    setLoading(false)
    setSubmitStep(null)
    setEmailFailed(sendFailed)
    setDone(true)
  }

  // ── SUCCESS SCREEN ──
  if (done) return (
    <OnboardingLayout wide={false}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}>{emailFailed ? '⚠️' : '🎉'}</div>
        <h2 style={{ ...cardTitle, textAlign: 'center', marginBottom: 12 }}>{emailFailed ? 'Workspace created — one thing to check' : "You're all set!"}</h2>
        {emailFailed ? (
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
            Your <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{organisationName}</strong> workspace is ready, but we couldn't confirm the login link email actually sent to <strong style={{ color: '#60A5FA' }}>{email}</strong>. If it doesn't arrive shortly, contact <a href="mailto:support@launchsession.co.uk" style={{ color: '#60A5FA' }}>support@launchsession.co.uk</a> and we'll get you a fresh link right away.
          </p>
        ) : (
          <>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>We've sent a login link to</p>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60A5FA', marginBottom: 20, wordBreak: 'break-all' }}>{email}</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Click the link to set your password and access your <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{organisationName}</strong> workspace — with full access to everything for your first 14 days. Check your spam folder if it doesn't arrive within a couple of minutes.
            </p>
          </>
        )}
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
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.22 }
  const motionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1, x: 0 } }
    : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 } }

  // ── WIZARD ──
  return (
    <OnboardingLayout wide onBackHome={saveAndExit}>
      <ProgressHeader
        stepNumber={stepNumber}
        totalSteps={STEP_KEYS.length}
        title={STEP_TITLES[currentKey]}
        showBack={stepIndex > 0}
        onBack={goBack}
        onSaveExit={saveAndExit}
      />

      {error && (
        <div role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ maxWidth: stepWide ? 'none' : 460, margin: stepWide ? 0 : '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={currentKey} {...motionProps} transition={transition} style={{ display: 'flex', flexDirection: 'column' }}>

            {currentKey === 'org' && (
              <div>
                <p style={cardSub}>What's your organisation called? This becomes your dedicated, private workspace name.</p>
                <input
                  autoFocus
                  disabled={loading}
                  placeholder="e.g. Acme Youth Club"
                  value={organisationName}
                  onChange={e => setOrganisationName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canContinue && goNext()}
                  style={inp}
                />
                <Teach>🔒 Every organisation gets its own secure, fully separate workspace — your data is never shared with anyone else on LaunchSession.</Teach>
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
                    <label style={label}>Tell us what type of organisation you run</label>
                    <input
                      autoFocus
                      disabled={loading}
                      placeholder="e.g. Scout group, arts collective, food bank..."
                      value={orgTypeOther}
                      onChange={e => setOrgTypeOther(e.target.value)}
                      style={inp}
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
                  <label style={label}>Your full name</label>
                  <input autoFocus disabled={loading} placeholder="e.g. Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={label}>Work email</label>
                  <input type="email" disabled={loading} placeholder="jane@organisation.org" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && canContinue && goNext()} style={inp} />
                </div>
                <Teach>⚡ Your login link arrives within seconds — no waiting on manual approval, no card required.</Teach>
              </div>
            )}

            {currentKey === 'review' && (
              <div>
                <h2 style={cardTitle}>Here's what {organisationName} gets</h2>
                <p style={cardSub}>Full access to everything below, free for 14 days.</p>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: '4px 20px' }}>
                  {WHAT_YOU_GET_GROUPS.map(g => (
                    <div key={g.title} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{g.title}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {g.items.map(m => (
                          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
                            <span style={{ fontSize: 15, flexShrink: 0 }}>{m.icon}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.82)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '2px 0 18px' }}>...and everything else, unlocked from day one — nothing to upgrade into.</p>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 0 18px' }} />

                <div style={{ maxWidth: 460 }}>
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
                        <div style={{ width: 18, height: 18, border: '2px solid #3B82F6', borderTop: '2px solid transparent', borderRadius: '50%', animation: reducedMotion ? 'none' : 'spin 0.8s linear infinite', flexShrink: 0 }} />
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

      {/* Nav buttons — sticky to the viewport bottom on mobile so they're
          never hidden below the fold; inline within the panel on desktop. */}
      <div style={isMobile ? mobileStickyNav : { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, maxWidth: stepWide ? 460 : 'none' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} disabled={loading} style={ghostBtn}>← Back</button>
          )}
          {currentKey === 'review' ? (
            <button type="button" onClick={handleSubmit} disabled={loading || !canContinue} style={{ ...primaryBtn, flex: 1, opacity: loading || !canContinue ? 0.6 : 1 }}>
              {loading ? 'Setting up...' : 'Create My Workspace →'}
            </button>
          ) : (
            <button type="button" onClick={goNext} disabled={!canContinue} style={{ ...primaryBtn, flex: 1, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'default' }}>
              Continue →
            </button>
          )}
        </div>
        {!canContinue && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{disabledReason}</div>}
      </div>
      {isMobile && <div style={{ height: 84 }} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
        <iframe title={title} src={src} style={{ flex: 1, width: '100%', border: 'none', background: '#06091A' }} />
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ ...ghostBtn, flex: 1, padding: '12px' }}>Close</button>
          <button type="button" onClick={onAgree} style={{ ...primaryBtn, flex: 1, padding: '12px' }}>I agree →</button>
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

function Teach({ children }) {
  return (
    <div style={{ marginTop: 18, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

const cardTitle = { fontSize: 22, margin: '0 0 8px', fontWeight: 900, color: '#fff', lineHeight: 1.3 }
const cardSub   = { color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }
const label     = { display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }
const inp       = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'inherit' }
const primaryBtn = { padding: '15px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#4f46e5)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 40px rgba(59,130,246,0.35)', fontFamily: 'inherit' }
const ghostBtn  = { padding: '15px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
const mobileStickyNav = { position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(7,11,22,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 50 }

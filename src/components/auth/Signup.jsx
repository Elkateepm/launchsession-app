import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

const SUBMIT_STEPS = [
  { id: 'insert',  label: 'Creating your workspace...' },
  { id: 'approve', label: 'Setting up your organisation...' },
  { id: 'email',   label: 'Sending your login link...' },
]

const ORG_TYPES = [
  { key: 'charity',            label: 'Charity',           icon: '❤️', tip: "Perfect fit — track outcomes, prove impact to funders, and keep safeguarding airtight, all in one place." },
  { key: 'sports club',        label: 'Sports Club',        icon: '⚽', tip: "Great match — manage training sessions, track attendance, and coordinate volunteer coaches without spreadsheets." },
  { key: 'community centre',   label: 'Community Centre',   icon: '🏢', tip: "LaunchSession keeps every programme, session and volunteer shift in one connected place." },
  { key: 'after-school',       label: 'After-School',       icon: '🎒', tip: "Built for exactly this — fast daily registers, parent messaging, and safeguarding, all connected." },
  { key: 'youth club',         label: 'Youth Club',         icon: '🏃', tip: "This is what LaunchSession was built for — sessions, safeguarding and volunteers, all in sync." },
  { key: 'other',              label: 'Something Else',     icon: '✨', tip: "Whatever you run, LaunchSession adapts — enable only the modules your team actually needs." },
]

const WHAT_YOU_GET = [
  { icon: '📅', label: 'Sessions & Planning' },
  { icon: '📋', label: 'Live Registers' },
  { icon: '🛡️', label: 'Safeguarding' },
  { icon: '❤️', label: 'Volunteers' },
  { icon: '💬', label: 'Messaging' },
  { icon: '📊', label: 'Reports & Impact' },
  { icon: '🤝', label: 'Mentoring' },
  { icon: '✈️', label: 'Events & Trips' },
]

const STEP_KEYS = ['org', 'type', 'you', 'review']

export default function Signup() {
  const isMobile = useIsMobile()
  const [stepIndex, setStepIndex]                = useState(0)
  const [organisationName, setOrganisationName]  = useState('')
  const [orgType, setOrgType]                    = useState('')
  const [fullName, setFullName]                  = useState('')
  const [email, setEmail]                        = useState('')
  const [loading, setLoading]                    = useState(false)
  const [submitStep, setSubmitStep]              = useState(null)
  const [done, setDone]                          = useState(false)
  const [emailFailed, setEmailFailed]            = useState(false)
  const [error, setError]                        = useState('')
  const [agreedToTerms, setAgreedToTerms]        = useState(false)
  const [legalModal, setLegalModal]              = useState(null) // null | 'terms' | 'privacy'

  const currentKey = STEP_KEYS[stepIndex]
  const canContinue = {
    org: organisationName.trim().length > 1,
    type: !!orgType,
    you: fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(email.trim()),
    review: agreedToTerms,
  }[currentKey]

  const goNext = () => { if (canContinue && stepIndex < STEP_KEYS.length - 1) setStepIndex(i => i + 1) }
  const goBack = () => { if (stepIndex > 0) setStepIndex(i => i - 1) }

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)
    setError('')

    setSubmitStep(SUBMIT_STEPS[0].label)
    const { data: trial, error: insertError } = await supabase
      .from('trial_requests')
      .insert([{
        organisation_name: organisationName.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        org_type: orgType,
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

    setLoading(false)
    setSubmitStep(null)
    setEmailFailed(sendFailed)
    setDone(true)
  }

  // ── SUCCESS SCREEN ──
  if (done) return (
    <div style={page}>
      <Glow />
      <div style={wrap}>
        <Logo />
        <div style={card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{emailFailed ? '⚠️' : '🎉'}</div>
            <h2 style={{ ...cardTitle, marginBottom: 12 }}>{emailFailed ? 'Workspace created — one thing to check' : "You're all set!"}</h2>
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
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              💡 Once you've set your password, you can sign in anytime at{' '}
              <a href="https://app.launchsession.co.uk" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 700 }}>app.launchsession.co.uk</a>
            </div>
          </div>
        </div>
        <button onClick={() => window.location.href = '/landing.html'} style={backBtn}>← Back to LaunchSession</button>
      </div>
    </div>
  )

  // ── WIZARD ──
  return (
    <div style={page}>
      <Glow />
      <div style={{ position: 'absolute', width: 900, height: 900, border: '1px solid rgba(255,255,255,0.04)', borderRadius: '50%', top: '8%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

      <div style={wrap}>
        <Logo />

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
          {STEP_KEYS.map((k, i) => (
            <div key={k} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= stepIndex ? 'linear-gradient(90deg,#3B82F6,#8B5CF6)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ ...card, minHeight: isMobile ? 'auto' : 420, display: 'flex', flexDirection: 'column' }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              ⚠️ {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentKey}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {currentKey === 'org' && (
                <div>
                  <div style={stepEmoji}>🏢</div>
                  <h2 style={cardTitle}>What's your organisation called?</h2>
                  <p style={cardSub}>This becomes your dedicated, private workspace name.</p>
                  <input
                    autoFocus
                    disabled={loading}
                    placeholder="e.g. Acme Youth Club"
                    value={organisationName}
                    onChange={e => setOrganisationName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && canContinue.org !== false && goNext()}
                    style={inp}
                  />
                  <Teach>🔒 Every organisation gets its own secure, fully separate workspace — your data is never shared with anyone else on LaunchSession.</Teach>
                </div>
              )}

              {currentKey === 'type' && (
                <div>
                  <div style={stepEmoji}>🧭</div>
                  <h2 style={cardTitle}>What kind of organisation is {organisationName || 'it'}?</h2>
                  <p style={cardSub}>This helps us tailor a few things — nothing is locked in.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {ORG_TYPES.map(t => (
                      <button key={t.key} type="button" onClick={() => setOrgType(t.key)} style={{
                        padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                        border: orgType === t.key ? '2px solid #60A5FA' : '1.5px solid rgba(255,255,255,0.12)',
                        background: orgType === t.key ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)',
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{t.label}</div>
                      </button>
                    ))}
                  </div>
                  {orgType && <Teach>{ORG_TYPES.find(t => t.key === orgType)?.icon} {ORG_TYPES.find(t => t.key === orgType)?.tip}</Teach>}
                </div>
              )}

              {currentKey === 'you' && (
                <div>
                  <div style={stepEmoji}>👤</div>
                  <h2 style={cardTitle}>Now, a bit about you</h2>
                  <p style={cardSub}>You'll be the first admin — invite your whole team once you're in.</p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={label}>Your full name</label>
                    <input autoFocus disabled={loading} placeholder="e.g. Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={label}>Work email</label>
                    <input type="email" disabled={loading} placeholder="jane@organisation.org" value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && canContinue.you && goNext()} style={inp} />
                  </div>
                  <Teach>⚡ Your login link arrives within seconds — no waiting on manual approval, no card required.</Teach>
                </div>
              )}

              {currentKey === 'review' && (
                <div>
                  <div style={stepEmoji}>🚀</div>
                  <h2 style={cardTitle}>Here's what {organisationName} gets</h2>
                  <p style={cardSub}>Full access to everything below, free for 14 days.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
                    {WHAT_YOU_GET.map(m => (
                      <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 17, marginBottom: 3 }}>{m.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', marginBottom: 6 }}>
                    <Row k="Organisation" v={organisationName} />
                    <Row k="Type" v={ORG_TYPES.find(t => t.key === orgType)?.label || '—'} />
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
                    <div style={{ margin: '16px 0 0', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, border: '2px solid #3B82F6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{submitStep}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {legalModal && <LegalModal doc={legalModal} onClose={() => setLegalModal(null)} onAgree={() => { setAgreedToTerms(true); setLegalModal(null) }} />}

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} disabled={loading} style={ghostBtn}>← Back</button>
            )}
            {currentKey === 'review' ? (
              <button type="button" onClick={handleSubmit} disabled={loading} style={{ ...primaryBtn, flex: 1, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Setting up...' : 'Create My Workspace →'}
              </button>
            ) : (
              <button type="button" onClick={goNext} disabled={!canContinue} style={{ ...primaryBtn, flex: 1, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'default' }}>
                Continue →
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={() => window.location.href = '/landing.html'} style={backBtn}>← Back to LaunchSession</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>🔒 Secure & never shared</span>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
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

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
      <img src="/logo.png" alt="LaunchSession" style={{ height: 36, width: 'auto', objectFit: 'contain' }}
        onError={e => { e.target.style.display = 'none' }} />
      <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>LaunchSession</span>
    </div>
  )
}

function Glow() {
  return (
    <>
      <div style={{ position: 'absolute', top: -180, left: -140, width: 520, height: 520, background: 'radial-gradient(circle, rgba(168,85,247,0.22), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, right: -160, width: 620, height: 620, background: 'radial-gradient(circle, rgba(37,99,235,0.28), transparent 65%)', pointerEvents: 'none' }} />
    </>
  )
}

const page      = { minHeight: '100vh', background: 'radial-gradient(circle at top left, #1a0b3b 0%, #07111f 42%, #020711 100%)', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', position: 'relative', overflowX: 'hidden', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const wrap      = { width: '100%', maxWidth: 460, position: 'relative', zIndex: 2, textAlign: 'center' }
const card      = { textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '28px 24px', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }
const cardTitle = { textAlign: 'left', fontSize: 20, margin: '0 0 6px', fontWeight: 900, color: '#fff', lineHeight: 1.3 }
const cardSub   = { textAlign: 'left', color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.6 }
const label     = { display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }
const inp       = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'inherit' }
const backBtn   = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
const stepEmoji = { width: 52, height: 52, borderRadius: 16, background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }
const primaryBtn = { padding: '15px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#4f46e5)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 40px rgba(59,130,246,0.35)', fontFamily: 'inherit' }
const ghostBtn  = { padding: '15px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }

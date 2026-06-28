import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STEPS = [
  { id: 'insert',  label: 'Creating your workspace...' },
  { id: 'approve', label: 'Setting up your organisation...' },
  { id: 'email',   label: 'Sending your login link...' },
]

export default function Signup() {
  const [organisationName, setOrganisationName] = useState('')
  const [fullName, setFullName]                 = useState('')
  const [email, setEmail]                       = useState('')
  const [loading, setLoading]                   = useState(false)
  const [step, setStep]                         = useState(null) // current step label
  const [done, setDone]                         = useState(false)
  const [error, setError]                       = useState('')

  const handleSignup = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // ── Step 1: insert trial request ──
    setStep(STEPS[0].label)
    const { data: trial, error: insertError } = await supabase
      .from('trial_requests')
      .insert([{
        organisation_name: organisationName.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        status: 'new',
      }])
      .select()
      .single()

    if (insertError || !trial) {
      setError(insertError?.message || 'Could not create your workspace. Please try again.')
      setLoading(false)
      setStep(null)
      return
    }

    // ── Step 2: auto-approve (creates org + slug + invite token) ──
    setStep(STEPS[1].label)
    const { error: approveError } = await supabase.rpc('approve_trial_request', { trial_id: trial.id })

    if (approveError) {
      setError('Workspace setup failed: ' + approveError.message)
      setLoading(false)
      setStep(null)
      return
    }

    // ── Step 3: fetch approved trial ──
    const { data: approved, error: fetchError } = await supabase
      .from('trial_requests')
      .select('*')
      .eq('id', trial.id)
      .single()

    if (fetchError || !approved) {
      // non-fatal — workspace was created, email might still send
      console.warn('Could not fetch approved trial:', fetchError?.message)
    }

    // ── Step 4: send invite email ──
    setStep(STEPS[2].label)
    if (approved?.admin_invite_token) {
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: approved.email,
          full_name: approved.full_name,
          org_name: approved.organisation_name,
          org_slug: approved.generated_slug,
          token: approved.admin_invite_token,
        }
      })
      if (emailError) {
        // Workspace is ready, email failed — not fatal, show success anyway
        console.warn('Email send failed:', emailError.message)
      }
    }

    setLoading(false)
    setStep(null)
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
            <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>🎉</div>
            <h2 style={{ ...cardTitle, marginBottom: 12 }}>You're all set!</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>
              We've sent a login link to
            </p>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60A5FA', marginBottom: 20, wordBreak: 'break-all' }}>
              {email}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Click the link to set your password and access your <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{organisationName}</strong> workspace. Check your spam folder if it doesn't arrive within a couple of minutes.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              💡 Once you've set your password, you can sign in anytime at{' '}
              <a href="https://app.launchsession.co.uk" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 700 }}>
                app.launchsession.co.uk
              </a>
            </div>
          </div>
        </div>
        <button onClick={() => window.location.href = '/landing.html'} style={backBtn}>← Back to LaunchSession</button>
      </div>
    </div>
  )

  // ── FORM ──
  return (
    <div style={page}>
      <Glow />
      <div style={{ position: 'absolute', width: 900, height: 900, border: '1px solid rgba(255,255,255,0.04)', borderRadius: '50%', top: '8%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

      <div style={wrap}>
        <Logo />
        <h1 style={title}>Start your free 7-day trial</h1>
        <p style={subtitle}>Your workspace is ready in seconds — no waiting, no card required.</p>

        <form onSubmit={handleSignup} style={card}>
          <div style={{ width: 70, height: 70, borderRadius: 999, background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 22px' }}>🚀</div>
          <h2 style={cardTitle}>Create your workspace</h2>
          <p style={cardSub}>Tell us about your organisation and we'll have everything ready instantly.</p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Organisation name</label>
            <input
              required
              disabled={loading}
              placeholder="e.g. Acme Youth Club"
              value={organisationName}
              onChange={e => setOrganisationName(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Your full name</label>
            <input
              required
              disabled={loading}
              placeholder="e.g. Jane Smith"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={label}>Work email</label>
            <input
              required
              type="email"
              disabled={loading}
              placeholder="jane@organisation.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inp}
            />
          </div>

          {/* Loading progress */}
          {loading && step && (
            <div style={{ margin: '20px 0', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, border: '2px solid #3B82F6', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{step}</span>
              </div>
              {STEPS.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, opacity: s.label === step ? 1 : 0.35 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.label === step ? '#3B82F6' : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !organisationName.trim() || !fullName.trim() || !email.trim()}
            style={{
              width: '100%', marginTop: 20, padding: '16px', borderRadius: 14, border: 'none',
              background: loading || !organisationName.trim() || !fullName.trim() || !email.trim()
                ? 'rgba(59,130,246,0.4)'
                : 'linear-gradient(135deg,#3b82f6,#4f46e5)',
              color: '#fff', fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 12px 40px rgba(59,130,246,0.35)',
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
          >
            {loading ? 'Setting up...' : 'Create My Workspace →'}
          </button>

          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 18px', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span>What happens next?</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { n: '1', title: 'Instant setup', desc: 'Workspace created in seconds' },
              { n: '2', title: 'Check email', desc: 'Login link sent immediately' },
              { n: '3', title: 'Start building', desc: 'Manage sessions & young people' },
            ].map(s => (
              <div key={s.n} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#60A5FA', margin: '0 auto 8px' }}>{s.n}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
          <button onClick={() => window.location.href = '/landing.html'} style={backBtn}>← Back to LaunchSession</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>🔒 Secure & never shared</span>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
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

const page     = { minHeight: '100vh', background: 'radial-gradient(circle at top left, #1a0b3b 0%, #07111f 42%, #020711 100%)', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', position: 'relative', overflowX: 'hidden', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const wrap     = { width: '100%', maxWidth: 520, position: 'relative', zIndex: 2, textAlign: 'center' }
const title    = { fontSize: 'clamp(28px,5vw,46px)', lineHeight: 1.08, margin: '0 0 12px', fontWeight: 900, letterSpacing: -1.5 }
const subtitle = { margin: '0 0 32px', color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.6 }
const card     = { textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '32px 28px', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }
const cardTitle= { textAlign: 'center', fontSize: 22, margin: '0 0 8px', fontWeight: 900, color: '#fff' }
const cardSub  = { textAlign: 'center', color: 'rgba(255,255,255,0.55)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }
const label    = { display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }
const inp      = { width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }
const backBtn  = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }

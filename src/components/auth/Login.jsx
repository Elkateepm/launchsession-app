import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STEPS = { EMAIL: 'email', PICK_ORG: 'pick_org', PASSWORD: 'password', FORGOT: 'forgot', NOT_FOUND: 'not_found' }

const inp = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.07)', color: '#fff',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

export default function Login({ org: urlOrg }) {
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [matchedOrgs, setMatchedOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(urlOrg || null)

  const primary = selectedOrg?.primary_color || urlOrg?.primary_color || '#3B82F6'
  const orgName = selectedOrg?.name || urlOrg?.name || 'LaunchSession'

  // ── STEP 1: Email entry → look up which org(s) this email belongs to ──
  const handleEmailContinue = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/find-orgs-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const json = await res.json()
      const orgs = json.orgs || []

      if (orgs.length === 0) {
        setStep(STEPS.NOT_FOUND)
      } else if (orgs.length === 1) {
        setSelectedOrg(orgs[0])
        setStep(STEPS.PASSWORD)
      } else {
        setMatchedOrgs(orgs)
        setStep(STEPS.PICK_ORG)
      }
    } catch (err) {
      setError('Something went wrong looking up your account. Please try again.')
    }
    setLoading(false)
  }

  const handlePickOrg = (chosenOrg) => {
    setSelectedOrg(chosenOrg)
    setStep(STEPS.PASSWORD)
  }

  // ── STEP 3: Password / Magic Link ──
  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : error.message
      )
      setLoading(false)
      return
    }

    // Persist the chosen org so OrgContext picks it up on the next render —
    // the App.js role router takes over from here (Admin/Staff → Dashboard,
    // Volunteer → Volunteer Portal, Parent → Parent Portal).
    if (selectedOrg?.slug) {
      try { localStorage.setItem('launchsession_org_slug', selectedOrg.slug) } catch (e) {}
      if (window.location.search.indexOf('org=') === -1) {
        window.location.href = window.location.origin + '/dashboard?org=' + selectedOrg.slug
        return
      }
    }
    // Auth state change is picked up by App.js — no redirect needed otherwise
  }

  const handleMagicLink = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    if (error) { setError(error.message); setLoading(false); return }
    setMagicSent(true)
    setLoading(false)
  }

  const handleForgot = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href })
    if (error) { setError(error.message); setLoading(false); return }
    setForgotSent(true)
    setLoading(false)
  }

  const resetToEmail = () => {
    setStep(STEPS.EMAIL)
    setError('')
    setPassword('')
    setSelectedOrg(urlOrg || null)
    setMatchedOrgs([])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: `radial-gradient(ellipse, ${primary}22 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {selectedOrg?.logo_url ? (
            <img src={selectedOrg.logo_url} alt={orgName} style={{ height: 56, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <img src='/logo.png' alt='LaunchSession' style={{ width: 240, height: 240, objectFit: 'contain', margin: '0 auto 0px', display: 'block' }} />
          )}
          {selectedOrg && <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>{orgName}</div>}
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(12px)', position: 'relative' }}>

          {/* STEP: EMAIL */}
          {step === STEPS.EMAIL && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Sign in to LaunchSession</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Enter your email to find your workspace</div>
              </div>
              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleEmailContinue}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@organisation.com" style={inp} />
                </div>
                <button type="submit" disabled={loading || !email.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !email.trim() ? 'default' : 'pointer', opacity: loading || !email.trim() ? 0.6 : 1, transition: 'all 0.2s' }}>
                  {loading ? 'Looking up your account...' : 'Continue →'}
                </button>
              </form>
            </div>
          )}

          {/* STEP: NOT FOUND */}
          {step === STEPS.NOT_FOUND && (
            <div>
              <button onClick={resetToEmail} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>← Back</button>
              <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginBottom: 10 }}>No account found</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>
                  We couldn't find a LaunchSession account for <strong style={{ color: '#fff' }}>{email}</strong>. Check the spelling, or start a free trial to create a new workspace.
                </div>
                <a href="/signup" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                  Start Free Trial →
                </a>
              </div>
            </div>
          )}

          {/* STEP: PICK ORG (multi-org accounts) */}
          {step === STEPS.PICK_ORG && (
            <div>
              <button onClick={resetToEmail} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>← Back</button>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Choose your workspace</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>{email} belongs to {matchedOrgs.length} organisations</div>
              </div>
              {matchedOrgs.map(o => (
                <button key={o.id} onClick={() => handlePickOrg(o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', marginBottom: 10, textAlign: 'left', transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = (o.primary_color || primary) + '55' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
                  {o.logo_url ? (
                    <img src={o.logo_url} alt={o.name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 4, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: (o.primary_color || primary) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: o.primary_color || primary, flexShrink: 0 }}>{o.name?.[0]}</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{o.role}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>›</div>
                </button>
              ))}
            </div>
          )}

          {/* STEP: PASSWORD */}
          {step === STEPS.PASSWORD && (
            <div>
              <button onClick={resetToEmail} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                ← Back
              </button>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Welcome back</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${primary}, #8B5CF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                    {selectedOrg?.logo_url ? <img src={selectedOrg.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : orgName[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{orgName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{email}</div>
                  </div>
                </div>
              </div>
              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Password</label>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoFocus placeholder="••••••••" style={{ ...inp, paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 14, top: 38, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button type="submit" disabled={loading || !password.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !password.trim() ? 'default' : 'pointer', opacity: loading || !password.trim() ? 0.6 : 1 }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button onClick={() => { setStep(STEPS.FORGOT); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', padding: 0 }}>Forgot password?</button>
                <button onClick={handleMagicLink} style={{ background: 'none', border: 'none', color: primary, fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Email magic link</button>
              </div>
            </div>
          )}

          {/* MAGIC LINK SENT OVERLAY */}
          {magicSent && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,11,24,0.97)', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>We sent a magic link to <strong style={{ color: '#fff' }}>{email}</strong>. Click it to sign in instantly.</div>
              <button onClick={() => setMagicSent(false)} style={{ marginTop: 24, padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Back</button>
            </div>
          )}

          {/* STEP: FORGOT PASSWORD */}
          {step === STEPS.FORGOT && (
            <div>
              <button onClick={() => { setStep(STEPS.PASSWORD); setError(''); setForgotSent(false) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                ← Back
              </button>
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Reset link sent</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Check your email at <strong style={{ color: '#fff' }}>{email}</strong> for a password reset link.</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Reset password</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>We'll send a reset link to {email}</div>
                  {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
                  <form onSubmit={handleForgot}>
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => window.location.href = 'https://www.launchsession.co.uk/landing.html'} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← Back to launchsession.co.uk
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>
          Powered by <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>LaunchSession</span>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { isNativeApp } from '../../lib/nativeEnv'
import { isPasskeyCapable, hasPlatformAuthenticator, passkeyUsedHere, signInWithPasskey, supportsAutofill } from '../../lib/passkey'
import Icon from '../../lib/icons'

const STEPS = { ROLE: 'role', EMAIL: 'email', PASSWORD: 'password', MAGIC: 'magic', FORGOT: 'forgot' }

const font = "'Plus Jakarta Sans', sans-serif"

// Leaving an organisation has to clear BOTH keys. 'launchsession_org_slug' is
// the working selection, but 'launchsession_remembered_org_slug' is an opt-in
// sticky fallback that OrgContext re-applies on /login and the bare root — so
// clearing only the first sends the user straight back into the same org.
function leaveOrg(target) {
  try {
    localStorage.removeItem('launchsession_org_slug')
    localStorage.removeItem('launchsession_remembered_org_slug')
  } catch (e) {}
  window.location.href = target || '/org-search'
}

const inp = {
  width: '100%', padding: '14px 16px 14px 46px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: 16, outline: 'none', boxSizing: 'border-box',
  fontFamily: font, transition: 'border-color 0.2s',
}

const label = {
  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
  display: 'block', marginBottom: 8,
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.7"
      style={{ position: 'absolute', left: 15, bottom: 15, width: 20, height: 20, pointerEvents: 'none' }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 6L2 7" />
    </svg>
  )
}

// Fixed star positions — a stable list keeps the field from reshuffling on
// every re-render, which a Math.random() field would do on each keystroke.
const STARS = [
  { t: 4, l: 12, s: 2, o: 0.55, tw: true }, { t: 7, l: 78, s: 1.6, o: 0.4, tw: false },
  { t: 11, l: 34, s: 1.2, o: 0.35, tw: false }, { t: 9, l: 91, s: 2.2, o: 0.6, tw: true },
  { t: 15, l: 62, s: 1.4, o: 0.3, tw: false }, { t: 18, l: 8, s: 1.8, o: 0.45, tw: true },
  { t: 21, l: 48, s: 1.1, o: 0.25, tw: false }, { t: 24, l: 86, s: 1.5, o: 0.4, tw: false },
  { t: 13, l: 21, s: 1.3, o: 0.3, tw: false }, { t: 28, l: 70, s: 2, o: 0.5, tw: true },
  { t: 31, l: 15, s: 1.2, o: 0.28, tw: false }, { t: 34, l: 94, s: 1.7, o: 0.42, tw: false },
  { t: 3, l: 55, s: 1.5, o: 0.38, tw: false }, { t: 38, l: 41, s: 1.1, o: 0.22, tw: false },
  { t: 6, l: 44, s: 1.3, o: 0.32, tw: true }, { t: 42, l: 82, s: 1.4, o: 0.3, tw: false },
  { t: 17, l: 96, s: 1.2, o: 0.28, tw: false }, { t: 26, l: 4, s: 1.6, o: 0.36, tw: false },
  { t: 46, l: 27, s: 1.3, o: 0.26, tw: false }, { t: 52, l: 89, s: 1.5, o: 0.3, tw: true },
  { t: 58, l: 6, s: 1.2, o: 0.24, tw: false }, { t: 64, l: 74, s: 1.4, o: 0.28, tw: false },
  { t: 71, l: 18, s: 1.3, o: 0.22, tw: false }, { t: 78, l: 92, s: 1.5, o: 0.26, tw: true },
  { t: 85, l: 37, s: 1.2, o: 0.2, tw: false }, { t: 91, l: 66, s: 1.4, o: 0.24, tw: false },
  { t: 88, l: 11, s: 1.3, o: 0.22, tw: false }, { t: 95, l: 83, s: 1.2, o: 0.2, tw: false },
]

export default function Login({ org }) {
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [passkeyReady, setPasskeyReady] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const { isDesktop } = useBreakpoint()
  // Mobile/tablet is a personal device — same reasoning as the idle-logout
  // carve-out (App.js), so there's no shared-computer risk to opt out of.
  // Desktop keeps the explicit choice since it's more likely to be shared.
  const effectiveRememberMe = isDesktop ? rememberMe : true

  const primary = org?.primary_color || '#3B82F6'
  const orgName = org?.name || 'LaunchSession'
  const hasOrg = !!org

  // Only offer the passkey route where it can actually work: a secure context
  // with a real platform authenticator. Offering it on a desktop Chrome with
  // no Touch ID would put a button there that always fails.
  // Holds the in-flight conditional (autofill) request so the explicit passkey
  // button can abort it before starting its own.
  const conditionalRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!isPasskeyCapable()) return
    hasPlatformAuthenticator().then(ok => { if (!cancelled) setPasskeyReady(ok) })
    return () => { cancelled = true }
  }, [])

  // Passkey autofill: the browser offers a saved passkey from the email field
  // itself, so the common case is one tap and no typing at all. Aborted on
  // unmount so it doesn't outlive the screen.
  useEffect(() => {
    if (!passkeyReady || step !== STEPS.EMAIL) return
    const controller = new AbortController()
    conditionalRef.current = controller
    let cancelled = false
    supportsAutofill().then(async ok => {
      if (!ok || cancelled) return
      const result = await signInWithPasskey({ conditional: true, signal: controller.signal })
      // Success is picked up by App.js via the auth state change. A cancelled
      // or failed autofill attempt is silent by design — the user never asked
      // for it, so an error here would be noise.
      if (!cancelled && result.ok === false && result.error && !result.cancelled) setError(result.error)
    })
    return () => {
      cancelled = true
      controller.abort()
      if (conditionalRef.current === controller) conditionalRef.current = null
    }
  }, [passkeyReady, step])

  const handlePasskey = async () => {
    setError('')
    // A conditional (autofill) request may still be pending. The WebAuthn spec
    // allows only one outstanding get() at a time, so starting the modal flow
    // without aborting it first makes the browser reject the new request.
    if (conditionalRef.current) {
      conditionalRef.current.abort()
      conditionalRef.current = null
    }
    setPasskeyBusy(true)
    const result = await signInWithPasskey()
    if (result.ok) return // App.js picks up the session
    if (result.error) setError(result.error)
    setPasskeyBusy(false)
  }

  const handleEmailContinue = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setStep(STEPS.PASSWORD)
  }

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try { localStorage.setItem('ls_remember_me', effectiveRememberMe ? 'true' : 'false') } catch (e) {}

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      let message
      if (error.message === 'Invalid login credentials') {
        message = 'Incorrect email or password. Please try again.'
      } else if (error.message === 'Email not confirmed') {
        message = "Your email address hasn't been confirmed yet. Check your inbox (and spam folder) for a confirmation link. If you're not sure how you were invited, contact your organisation admin or support@launchsession.co.uk."
      } else {
        message = error.message
      }
      setError(message)
      setLoading(false)
      return
    }
    // Auth state change is picked up by App.js — no redirect needed
  }

  const handleForgot = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.functions.invoke('send-password-reset-email', {
      body: {
        email,
        org_name: orgName,
        org_slug: org?.slug,
        org_logo: org?.logo_url,
        org_color: org?.primary_color,
        redirect_to: window.location.origin + '/reset-password' + (org?.slug ? '?org=' + org.slug : ''),
      },
    })
    if (error) { setError('Something went wrong sending the reset email. Please try again.'); setLoading(false); return }
    setForgotSent(true)
    setLoading(false)
  }

  const gradientBtn = disabled => ({
    width: '100%', padding: 16, borderRadius: 12, border: 'none',
    background: 'linear-gradient(90deg, ' + primary + ', #7C3AED)',
    color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: font,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
    boxShadow: disabled ? 'none' : '0 12px 32px -12px ' + primary,
    transition: 'all 0.2s',
  })

  const ghostBtn = {
    width: '100%', padding: 15, borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)',
    color: '#A78BFA', fontSize: 15, fontWeight: 600, fontFamily: font, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.2s',
  }

  const backLink = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13.5,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22,
    padding: 0, fontFamily: font,
  }

  const errBox = error ? (
    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, marginBottom: 16, lineHeight: 1.5 }}>{error}</div>
  ) : null

  return (
    <div style={{
      minHeight: '100dvh', background: '#050914', fontFamily: font,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 20px calc(28px + env(safe-area-inset-bottom, 0px))',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{'@keyframes ls-tw { 0%,100%{opacity:.2} 50%{opacity:.85} } .ls-star{position:absolute;border-radius:50%;background:#fff} .ls-in:focus{border-color:' + primary + ' !important;background:rgba(255,255,255,0.07) !important}'}</style>

      {/* Starfield */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {STARS.map((s, i) => (
          <span key={i} className="ls-star" style={{
            top: s.t + '%', left: s.l + '%', width: s.s, height: s.s, opacity: s.o,
            animation: s.tw ? 'ls-tw ' + (2.5 + (i % 4)) + 's ease-in-out ' + (i % 5) + 's infinite' : 'none',
          }} />
        ))}
      </div>

      {/* Planet horizon crests just above the card */}
      <img src="/assets/planet-horizon.png" alt="" aria-hidden="true" style={{
        position: 'absolute', top: 200, left: '50%', transform: 'translateX(-50%)',
        width: 'min(780px, 172%)', pointerEvents: 'none', userSelect: 'none', zIndex: 0, opacity: 0.95,
      }} />

      <div style={{
        width: '100%', maxWidth: 430, position: 'relative', zIndex: 1,
        paddingTop: 'calc(36px + env(safe-area-inset-top, 0px))',
      }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={orgName} style={{ height: 92, objectFit: 'contain', marginBottom: 12 }} />
          ) : (
            <img src="/logo.png" alt="LaunchSession" style={{ width: 146, height: 146, objectFit: 'contain', margin: '0 auto', display: 'block' }} />
          )}
          {hasOrg ? (
            <div style={{ fontSize: 25, fontWeight: 800, color: '#fff', letterSpacing: -0.5, marginTop: 6 }}>{orgName}</div>
          ) : (
            <div style={{ fontSize: 33, fontWeight: 900, color: '#fff', letterSpacing: -1, marginTop: 2 }}>
              Launch<span style={{ background: 'linear-gradient(100deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Session</span>
            </div>
          )}
          <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.45)', marginTop: 5 }}>
            {hasOrg ? 'Powered by LaunchSession' : 'Run. Engage. Inspire.'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 26, padding: '30px 24px', backdropFilter: 'blur(16px)',
          boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)',
        }}>

          {step === STEPS.EMAIL && (
            <div>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 20px',
                border: '1px solid ' + primary + '66', background: primary + '14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 26px -6px ' + primary,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 27, height: 27 }}>
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 26 }}>
                <div style={{ fontSize: 27, fontWeight: 800, color: '#fff', letterSpacing: -0.6, marginBottom: 7 }}>Welcome back</div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
                  {hasOrg ? 'Sign in to ' + orgName : 'Sign in to your organisation workspace'}
                </div>
              </div>

              {errBox}

              <form onSubmit={handleEmailContinue}>
                <div style={{ marginBottom: 18 }}>
                  <label style={label}>Work email</label>
                  <div style={{ position: 'relative' }}>
                    <MailIcon />
                    <input className="ls-in" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required autoFocus autoComplete="username webauthn" placeholder="you@organisation.com" style={inp} />
                  </div>
                </div>
                <button type="submit" disabled={loading || !email.trim()} style={gradientBtn(loading || !email.trim())}>
                  {loading ? 'Checking…' : 'Continue  →'}
                </button>
              </form>

              {passkeyReady && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 }}>or</span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
                  </div>

                  <button
                    type="button"
                    onClick={handlePasskey}
                    disabled={passkeyBusy}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '15px 18px', borderRadius: 14, cursor: passkeyBusy ? 'default' : 'pointer',
                      border: '1px solid rgba(255,255,255,0.16)',
                      background: passkeyUsedHere() ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
                      color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                      transition: 'background 0.18s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19, flexShrink: 0 }}>
                      <circle cx="10" cy="8" r="4" />
                      <path d="M10 12c-3.3 0-6 2.2-6 5v3" />
                      <path d="M15.5 13.5a3.5 3.5 0 1 1 5 3.1V21l-1.5-1.2L17.5 21v-4.4a3.5 3.5 0 0 1-2-3.1z" />
                    </svg>
                    {passkeyBusy ? 'Waiting for your device…' : 'Sign in with a passkey'}
                  </button>

                  <div style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 10, lineHeight: 1.45 }}>
                    Uses Face ID, Touch ID or your screen lock. No password to type.
                  </div>
                </>
              )}

              <div style={{ margin: '20px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <button onClick={() => { setError(''); setStep(STEPS.FORGOT) }} style={ghostBtn}>
                Forgot password? <span style={{ opacity: 0.7 }}>›</span>
              </button>
            </div>
          )}

          {step === STEPS.PASSWORD && (
            <div>
              <button onClick={() => { setStep(STEPS.EMAIL); setError('') }} style={backLink}><Icon name="←" /> Back</button>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: -0.5 }}>Enter your password</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, ' + primary + ', #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{orgName[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{orgName}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.42)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                  </div>
                </div>
              </div>
              {errBox}
              <form onSubmit={handleLogin}>
                {/* Password managers pair a saved credential with a username
                    field inside the same form. The email was collected on the
                    previous step, so without this the manager can neither
                    offer the saved password nor save a new one -- every
                    returning user had to type it by hand. Visually hidden
                    rather than display:none, which some managers skip. */}
                <input
                  type="email" value={email} readOnly tabIndex={-1} aria-hidden="true"
                  autoComplete="username"
                  style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}
                />
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <label style={label}>Password</label>
                  <input className="ls-in" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} required autoFocus autoComplete="current-password"
                    placeholder="••••••••" style={{ ...inp, paddingLeft: 16, paddingRight: 62 }} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 14, bottom: 15, background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: font }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button type="submit" disabled={loading || !password.trim()} style={gradientBtn(loading || !password.trim())}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              {isDesktop ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, cursor: 'pointer', userSelect: 'none' }}>
                  <span onClick={() => setRememberMe(r => !r)} style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid ' + (rememberMe ? primary : 'rgba(255,255,255,0.25)'), background: rememberMe ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {rememberMe ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 900, lineHeight: 1 }}><Icon name="✓" /></span> : null}
                  </span>
                  <span onClick={() => setRememberMe(r => !r)} style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Keep me logged in</span>
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><Icon name="🔒" /></span>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>You'll stay signed in on this device</span>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <button onClick={() => { setStep(STEPS.FORGOT); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13.5, cursor: 'pointer', padding: 0, fontFamily: font }}>Forgot password?</button>
              </div>
            </div>
          )}

          {step === STEPS.FORGOT && (
            <div>
              <button onClick={() => { setStep(STEPS.EMAIL); setError(''); setForgotSent(false) }} style={backLink}><Icon name="←" /> Back</button>
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 16, color: primary }}><Icon name="📬" /></div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Reset link sent</div>
                  <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Check your email at <strong style={{ color: '#fff' }}>{email}</strong> for a password reset link.</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 7, letterSpacing: -0.5 }}>Reset password</div>
                  <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.5)', marginBottom: 22 }}>
                    {email ? 'We\u2019ll send a reset link to ' + email : 'Enter the email you sign in with.'}
                  </div>
                  {errBox}
                  <form onSubmit={handleForgot}>
                    {!email && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={label}>Work email</label>
                        <div style={{ position: 'relative' }}>
                          <MailIcon />
                          <input className="ls-in" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@organisation.com" style={inp} />
                        </div>
                      </div>
                    )}
                    <button type="submit" disabled={loading || !email.trim()} style={gradientBtn(loading || !email.trim())}>
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wrong organisation? This is the escape hatch. It clears the sticky
            "remembered org" too, otherwise the user lands right back here. */}
        {hasOrg && (
          <button onClick={() => leaveOrg('/org-search')} style={{
            width: '100%', marginTop: 14, padding: '13px 16px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            cursor: 'pointer', fontFamily: font, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12, textAlign: 'left',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19, flexShrink: 0 }}>
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="17 11 20 8 17 5" />
                <line x1="20" y1="8" x2="14" y2="8" />
              </svg>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Not {orgName}?
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  Search for a different organisation
                </span>
              </span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, flexShrink: 0 }}>›</span>
          </button>
        )}

        {/* Security reassurance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" style={{ width: 15, height: 15, flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.42)' }}>Your data is secure with LaunchSession</span>
        </div>

        {!isNativeApp() && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button onClick={() => leaveOrg('https://www.launchsession.co.uk/landing.html')} style={{ background: 'none', border: 'none', color: '#8B7BF7', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: font, padding: 8 }}>
            ← Back to launchsession.co.uk
          </button>
        </div>
        )}
      </div>
    </div>
  )
}

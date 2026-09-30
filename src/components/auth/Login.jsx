import React, { useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import AuthLayout, { AUTH, AuthError, OrganisationIdentity, authInput, authLabel, authLink, authButton } from './AuthLayout'
import Icon from '../../lib/icons'

const STEPS = { EMAIL: 'email', PASSWORD: 'password', FORGOT: 'forgot' }

// Both selections must be cleared: the remembered organisation is also a
// fallback on /login, so clearing only the current one takes people back here.
function leaveOrg(target = '/org-search') {
  try {
    localStorage.removeItem('launchsession_org_slug')
    localStorage.removeItem('launchsession_remembered_org_slug')
  } catch (e) {}
  window.location.href = target
}

export default function Login({ org }) {
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // A phone or tablet can also be shared. Persistence is an explicit choice
  // on every viewport, using the existing Supabase storage adapter.
  const [rememberMe, setRememberMe] = useState(false)
  const { isDesktop } = useBreakpoint()
  const id = useId()
  const terms = useTerms()
  const primary = org?.primary_color || AUTH.blue
  const orgName = org?.name || 'your organisation'
  const changeStep = next => { setStep(next); setError(''); setForgotSent(false); setShowPassword(false) }
  const heading = { margin: '0 0 10px', color: AUTH.ink, fontSize: isDesktop ? 28 : 25, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.8 }
  const description = { fontSize: 13, color: AUTH.muted, lineHeight: 1.7, margin: '0 0 22px' }

  const handleEmailContinue = event => {
    event.preventDefault()
    if (!email.trim() || loading) return
    setEmail(email.trim())
    changeStep(STEPS.PASSWORD)
  }

  const handleLogin = async event => {
    event.preventDefault()
    if (loading || !org || !email.trim() || !password) return
    setLoading(true); setError('')
    try {
      try { localStorage.setItem('ls_remember_me', rememberMe ? 'true' : 'false') } catch (e) {}
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) {
        const message = authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : authError.message === 'Email not confirmed'
            ? 'Please confirm your email address using the link in your inbox. If you need a new invitation, contact your organisation administrator.'
            : 'We could not sign you in. Please try again or contact your organisation administrator.'
        setError(message); setLoading(false)
      }
      // App.js owns the successful auth transition and organisation access.
    } catch (e) {
      setError('We could not connect. Check your connection and try again.')
      setLoading(false)
    }
  }

  const handleForgot = async event => {
    event.preventDefault()
    if (loading || !email.trim()) return
    setLoading(true); setError(''); setEmail(email.trim())
    try {
      const { error: resetError } = await supabase.functions.invoke('send-password-reset-email', {
        body: {
          email: email.trim(), org_name: orgName, org_slug: org?.slug,
          org_logo: org?.logo_url, org_color: primary,
          redirect_to: window.location.origin + '/reset-password' + (org?.slug ? '?org=' + encodeURIComponent(org.slug) : ''),
        },
      })
      if (resetError) throw resetError
      setForgotSent(true)
    } catch (e) { setError('We could not send the reset link. Check your connection and try again.') }
    finally { setLoading(false) }
  }

  if (!org) return <AuthLayout stage="organisation"><h1 style={heading}>Choose your organisation</h1><p style={description}>Find your organisation before signing in to your account.</p><button type="button" onClick={() => leaveOrg()} style={authButton()}>Find my organisation</button></AuthLayout>

  return (
    <AuthLayout org={org} onHome={() => leaveOrg('https://www.launchsession.co.uk/landing.html')}>
      <div style={{ marginBottom: 22 }}>
        <OrganisationIdentity org={org} compact />
        <button type="button" disabled={loading} onClick={() => leaveOrg()} style={{ ...authLink, marginTop: 2, fontSize: 12 }}>Change organisation</button>
      </div>

      {step === STEPS.EMAIL && <>
        <h1 style={heading}>Sign in to your workspace</h1>
        <p style={description}>For authorised {terms.Staff.toLowerCase()} and volunteers. Use the email address linked to your organisation account.</p>
        <AuthError>{error}</AuthError>
        <form onSubmit={handleEmailContinue}>
          <label htmlFor={`${id}-email`} style={authLabel}>Email address</label>
          <input id={`${id}-email`} name="email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus={isDesktop} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@organisation.com" style={{ ...authInput, marginBottom: 18 }} />
          <button type="submit" disabled={loading || !email.trim()} style={authButton(loading || !email.trim())}>Continue <span aria-hidden="true">→</span></button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => changeStep(STEPS.FORGOT)} style={authLink}>Forgot password?</button>
          <span style={{ color: AUTH.muted, fontSize: 11 }}>Access is provided by your organisation.</span>
        </div>
      </>}

      {step === STEPS.PASSWORD && <>
        <h1 style={heading}>Welcome back</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 10px', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ flex: '1 1 160px', minWidth: 0, color: AUTH.muted, fontSize: 13, overflowWrap: 'anywhere' }}>{email}</span>
          <button type="button" disabled={loading} onClick={() => { setPassword(''); changeStep(STEPS.EMAIL) }} style={authLink}>Change email</button>
        </div>
        <AuthError>{error}</AuthError>
        <form onSubmit={handleLogin} aria-busy={loading}>
          {/* Keep the username in this form so password managers can pair it
              with the password collected in the second step. */}
          <input name="email" type="email" value={email} readOnly tabIndex={-1} aria-hidden="true" autoComplete="username" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }} />
          <label htmlFor={`${id}-password`} style={authLabel}>Password</label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required autoFocus autoComplete="current-password" placeholder="••••••••" style={{ ...authInput, paddingRight: 70 }} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} style={{ ...authLink, position: 'absolute', right: 6, top: 4, minWidth: 54, textDecoration: 'none', fontSize: 12 }}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          <div style={{ textAlign: 'right', marginBottom: 8 }}><button type="button" disabled={loading} onClick={() => changeStep(STEPS.FORGOT)} style={authLink}>Forgot password?</button></div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, cursor: 'pointer', margin: '0 0 20px' }}>
            <input type="checkbox" checked={rememberMe} disabled={loading} onChange={e => setRememberMe(e.target.checked)} aria-describedby={`${id}-remember-hint`} style={{ width: 19, height: 19, margin: '2px 0 0', flexShrink: 0, accentColor: primary }} />
            <span><span style={{ fontSize: 13, fontWeight: 650, color: AUTH.ink }}>Keep me signed in on this device</span><span id={`${id}-remember-hint`} style={{ display: 'block', color: AUTH.muted, fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>Only choose this on a device you control. Leave it off on shared devices.</span></span>
          </label>
          <button type="submit" disabled={loading || !password} style={authButton(loading || !password)}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </>}

      {step === STEPS.FORGOT && <>
        <button type="button" disabled={loading} onClick={() => changeStep(STEPS.EMAIL)} style={{ ...authLink, marginBottom: 10 }}><Icon name="←" /> Back to sign in</button>
        {forgotSent ? <div role="status">
          <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 12, color: AUTH.mint, background: '#102D2E', marginBottom: 18 }}><Icon name="newsletter" /></span>
          <h1 style={heading}>Reset link sent</h1>
          <p style={{ ...description, overflowWrap: 'anywhere' }}>If an account exists for <strong>{email}</strong>, you will receive a password reset link. Check your inbox and spam folder.</p>
          <p style={{ ...description, marginBottom: 0 }}>Still need help? Contact your organisation administrator. Do not send passwords or information about {terms.people} to support.</p>
        </div> : <>
          <h1 style={heading}>Reset your password</h1>
          <p style={description}>Enter the email address you use for this organisation. We will send instructions if it matches an account.</p>
          <AuthError>{error}</AuthError>
          <form onSubmit={handleForgot} aria-busy={loading}>
            <label htmlFor={`${id}-reset-email`} style={authLabel}>Email address</label>
            <input id={`${id}-reset-email`} name="email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@organisation.com" style={{ ...authInput, marginBottom: 18 }} />
            <button type="submit" disabled={loading || !email.trim()} style={authButton(loading || !email.trim())}>{loading ? 'Sending…' : 'Send reset link'}</button>
          </form>
        </>}
      </>}
    </AuthLayout>
  )
}

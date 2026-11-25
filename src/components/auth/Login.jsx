import React, { useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { requestPasswordReset } from '../../lib/passwordReset'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import AuthLayout, { AUTH, AuthError, OrganisationIdentity, authInput, authLabel, authLink, authButton } from './AuthLayout'
import Icon from '../../lib/icons'
import { getAuthBranding } from './authBranding'
import { SUSPENDED_MESSAGE, isSuspendedSignInError, hasSuspensionNotice, clearSuspensionNotice } from '../../lib/accessBlock'

// Email and password are one form: nothing is looked up between them, and
// one screen is quicker and what password managers expect.
const STEPS = { SIGN_IN: 'sign-in', FORGOT: 'forgot' }

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
  const [step, setStep] = useState(STEPS.SIGN_IN)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // A session ended because the account or organisation was suspended
  // arrives here with the reason, so say it rather than show a blank form.
  const [error, setError] = useState(() => hasSuspensionNotice() ? SUSPENDED_MESSAGE : '')
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // On a phone or tablet "Keep me signed in" starts ticked: the person signing
  // in is almost always on their own device, and unticked the session lives in
  // sessionStorage, which a phone throws away whenever it closes the app, so
  // staff were signed out several times a week. It can still be unticked on a
  // shared device. On a desktop, which may be a shared office machine, it
  // starts unticked as before.
  const { isDesktop } = useBreakpoint()
  const [rememberMe, setRememberMe] = useState(() => !isDesktop)
  const id = useId()
  const terms = useTerms()
  const brand = getAuthBranding(org)
  const primary = brand.primary
  const changeStep = next => { setStep(next); setError(''); setForgotSent(false); setShowPassword(false) }
  const heading = { margin: '0 0 10px', color: AUTH.ink, fontSize: isDesktop ? 28 : 25, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.8 }
  const description = { fontSize: 13, color: AUTH.muted, lineHeight: 1.7, margin: '0 0 22px' }
  React.useEffect(() => { clearSuspensionNotice() }, [])

  const handleLogin = async event => {
    event.preventDefault()
    if (loading || !org || !email.trim() || !password) return
    setLoading(true); setError('')
    try {
      try {
        localStorage.setItem('ls_remember_me', rememberMe ? 'true' : 'false')
        // The same choice remembers the organisation, so the next visit skips
        // the search. Left off on a shared device, nothing is remembered.
        if (rememberMe) localStorage.setItem('launchsession_remembered_org_slug', org.slug)
        else localStorage.removeItem('launchsession_remembered_org_slug')
      } catch (e) {}
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) {
        const message = isSuspendedSignInError(authError)
          ? SUSPENDED_MESSAGE
          : authError.message === 'Invalid login credentials'
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
      await requestPasswordReset(email, org)
      setForgotSent(true)
    } catch (e) { setError('We could not send the reset link. Check your connection and try again.') }
    finally { setLoading(false) }
  }

  if (!org) return <AuthLayout stage="organisation"><h1 style={heading}>Choose your organisation</h1><p style={description}>Find your organisation before signing in to your account.</p><button type="button" onClick={() => leaveOrg()} style={authButton()}>Find my organisation</button></AuthLayout>

  return (
    <AuthLayout org={org} onHome={() => leaveOrg('https://www.launchsession.co.uk/landing.html')}>
      <div style={{ marginBottom: 22 }}>
        {!brand.enabled && <OrganisationIdentity org={org} compact />}
        <button type="button" disabled={loading} onClick={() => leaveOrg()} style={{ ...authLink, marginTop: 2, fontSize: 12 }}>Change organisation</button>
      </div>

      {step === STEPS.SIGN_IN && <>
        <h1 style={heading}>Sign in to your workspace</h1>
        <p style={description}>For {terms.Staff.toLowerCase()} and volunteers. Use the email address your organisation added you with.</p>
        <AuthError>{error}</AuthError>
        <form onSubmit={handleLogin} aria-busy={loading}>
          <label htmlFor={`${id}-email`} style={authLabel}>Email address</label>
          <input id={`${id}-email`} name="email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} autoFocus={isDesktop} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@organisation.com" style={{ ...authInput, marginBottom: 16 }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <label htmlFor={`${id}-password`} style={authLabel}>Password</label>
            <button type="button" disabled={loading} onClick={() => changeStep(STEPS.FORGOT)} style={{ ...authLink, fontSize: 12 }}>Forgot password?</button>
          </div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required autoComplete="current-password" placeholder="••••••••" style={{ ...authInput, paddingRight: 70 }} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} style={{ ...authLink, position: 'absolute', right: 6, top: 4, minWidth: 54, textDecoration: 'none', fontSize: 12 }}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, cursor: 'pointer', margin: '0 0 18px' }}>
            <input type="checkbox" checked={rememberMe} disabled={loading} onChange={e => setRememberMe(e.target.checked)} aria-describedby={`${id}-remember-hint`} style={{ width: 19, height: 19, margin: '2px 0 0', flexShrink: 0, accentColor: primary }} />
            <span><span style={{ fontSize: 13, fontWeight: 650, color: AUTH.ink }}>Keep me signed in on this device</span><span id={`${id}-remember-hint`} style={{ display: 'block', color: AUTH.muted, fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>Also remembers {org.name}. Only on a device you control; leave it off on shared devices.</span></span>
          </label>
          <button type="submit" disabled={loading || !email.trim() || !password} style={authButton(loading || !email.trim() || !password)}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p style={{ margin: '16px 0 0', fontSize: 12, color: AUTH.muted, lineHeight: 1.6 }}>
          Volunteer? <a href={'/volunteer/' + encodeURIComponent(org.slug)} style={{ color: 'var(--auth-link)', fontWeight: 700 }}>Open the volunteer portal</a>
        </p>
      </>}

      {step === STEPS.FORGOT && <>
        <button type="button" disabled={loading} onClick={() => changeStep(STEPS.SIGN_IN)} style={{ ...authLink, marginBottom: 10 }}><Icon name="←" /> Back to sign in</button>
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

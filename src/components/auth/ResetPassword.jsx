import React, { useEffect, useRef, useState } from 'react'
import { createRecoveryClient, supabase } from '../../lib/supabase'
import { readRecoveryLink, recoverySignInUrl, requestPasswordReset } from '../../lib/passwordReset'

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, fontFamily: font }
const buttonStyle = { width: '100%', minHeight: 48, padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 8 }
const descriptionStyle = { color: '#A6B2C5', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }

async function verifyRecovery(client, link) {
  const result = link.kind === 'token'
    ? await client.auth.verifyOtp({ type: 'recovery', token_hash: link.token_hash })
    : await client.auth.setSession({ access_token: link.access_token, refresh_token: link.refresh_token })
  if (result.error || !result.data?.session) throw result.error || new Error('Invalid link')
  // Validate with Auth rather than trusting a cached or locally decoded session.
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) throw error || new Error('Invalid link')
  return data.user
}

export default function ResetPassword() {
  const [link] = useState(() => readRecoveryLink(window.location.href))
  const [client] = useState(createRecoveryClient)
  const [stage, setStage] = useState(link.kind === 'token' ? 'ready' : link.kind === 'session' ? 'checking' : 'invalid')
  const [account, setAccount] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const verification = useRef(null)

  useEffect(() => {
    let active = true
    // Remove credentials from the address bar/history before any navigation.
    const clean = new URL(window.location.href)
    clean.hash = ''
    ;['token_hash', 'type', 'code', 'error', 'error_code', 'error_description'].forEach(key => clean.searchParams.delete(key))
    window.history.replaceState(null, '', clean.pathname + clean.search)
    if (link.kind === 'session') {
      // Reuse the same exchange through StrictMode's effect replay. A recovery
      // token is single-use; exchanging it twice makes a valid link look expired.
      verification.current ||= verifyRecovery(client, link)
      verification.current.then(user => {
        if (active) { setAccount(user); setStage('password') }
      }).catch(() => { if (active) setStage('invalid') })
    }
    return () => { active = false }
  }, [client, link])

  const continueRecovery = async () => {
    if (stage !== 'ready') return
    setStage('checking'); setError('')
    try {
      // New emails are confirmed only after a click on this page, so email
      // security scanners cannot consume the link by fetching it.
      verification.current ||= verifyRecovery(client, link)
      setAccount(await verification.current)
      setStage('password')
    } catch (e) { setStage('invalid') }
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (saving || stage !== 'password') return
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) {
        if (['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(updateError.code) || updateError.status === 401 || updateError.name === 'AuthSessionMissingError') {
          setStage('invalid')
        } else {
          setError(updateError.message || 'Could not update your password. Please try again.')
        }
        return
      }
      setPassword(''); setConfirm(''); setStage('done')
      // Revoke just this temporary session; other browser sessions are separate.
      try { await client.auth.signOut({ scope: 'local' }) } catch (e) {}
    } catch (e) { setError('Could not connect. Check your connection and try again.') }
    finally { setSaving(false) }
  }

  const requestAgain = async event => {
    event.preventDefault()
    if (saving || !email.trim()) return
    setSaving(true); setError('')
    try {
      await requestPasswordReset(email, { slug: link.org }, link.portal)
      setSent(true)
    } catch (e) { setError('Could not send the reset link. Please try again.') }
    finally { setSaving(false) }
  }

  const signIn = async () => {
    if (saving) return
    setSaving(true); setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      try {
        localStorage.removeItem('launchsession_org_slug')
        localStorage.removeItem('launchsession_remembered_org_slug')
      } catch (e) {}
      window.location.assign(recoverySignInUrl(link))
    } catch (e) { setError('Could not return to sign in. Please try again.'); setSaving(false) }
  }

  return (
    <main style={{ minHeight: '100dvh', boxSizing: 'border-box', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: font }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>LaunchSession</div>
        </div>
        <section aria-busy={saving || stage === 'checking'} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '28px 24px' }}>
          {error && <div role="alert" style={{ color: '#FCA5A5', background: '#381D29', borderRadius: 10, padding: 14, fontSize: 14, marginBottom: 18 }}>{error}</div>}
          {stage === 'checking' && <p role="status" style={descriptionStyle}>Verifying your reset link…</p>}
          {stage === 'ready' && <>
            <h1 style={{ color: '#fff', fontSize: 24 }}>Reset your password</h1>
            <p style={descriptionStyle}>Continue to securely verify your link and choose a new password.</p>
            <button onClick={continueRecovery} style={buttonStyle}>Continue to reset password</button>
          </>}
          {stage === 'invalid' && <>
            <h1 style={{ color: '#fff', fontSize: 23 }}>Link expired or invalid</h1>
            {sent ? <p role="status" style={descriptionStyle}>If an account exists for {email.trim()}, you’ll receive a new link. Check your inbox and spam folder, and use the latest email.</p> : <>
              <p style={descriptionStyle}>This link cannot be used. Enter your account email to request a new one.</p>
              <form onSubmit={requestAgain}>
                <label htmlFor="reset-email" style={labelStyle}>Email address</label>
                <input id="reset-email" type="email" autoComplete="email" required value={email} disabled={saving} onChange={event => setEmail(event.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
                <button disabled={saving || !email.trim()} style={buttonStyle}>{saving ? 'Sending…' : 'Send a new reset link'}</button>
              </form>
            </>}
          </>}
          {stage === 'password' && <>
            <h1 style={{ color: '#fff', fontSize: 24 }}>Set a new password</h1>
            <p style={{ ...descriptionStyle, overflowWrap: 'anywhere' }}>Updating the password for <strong>{account?.email}</strong>.</p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="new-password" style={labelStyle}>New password</label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input id="new-password" name="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" autoFocus minLength={8} required disabled={saving} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="password-hint" style={{ ...inputStyle, paddingRight: 70 }} />
                <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => setShowPw(value => !value)} style={{ position: 'absolute', right: 4, top: 2, minWidth: 60, minHeight: 44, background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer' }}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
              <p id="password-hint" style={{ ...descriptionStyle, fontSize: 12, marginBottom: 20 }}>Use at least 8 characters. A unique passphrase works well.</p>
              <label htmlFor="confirm-password" style={labelStyle}>Confirm password</label>
              <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required disabled={saving} value={confirm} onChange={event => setConfirm(event.target.value)} style={{ ...inputStyle, marginBottom: 22 }} />
              <button type="submit" disabled={saving || !password || !confirm} style={{ ...buttonStyle, opacity: saving ? 0.6 : 1 }}>{saving ? 'Updating…' : 'Update password'}</button>
            </form>
          </>}
          {stage === 'done' && <div role="status">
            <h1 style={{ color: '#fff', fontSize: 24 }}>Password updated</h1>
            <p style={descriptionStyle}>Your new password is ready. Sign in to continue to your organisation.</p>
          </div>}
          {(stage === 'invalid' || stage === 'done') && <button onClick={signIn} disabled={saving} style={{ ...buttonStyle, marginTop: 18, background: stage === 'done' ? buttonStyle.background : 'transparent' }}>Back to sign in</button>}
        </section>
      </div>
    </main>
  )
}

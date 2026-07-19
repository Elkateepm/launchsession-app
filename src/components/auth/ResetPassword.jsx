import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '13px 44px 13px 16px', borderRadius: 12,
  border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 15, outline: 'none', transition: 'border-color 0.15s', fontFamily: font,
}

export default function ResetPassword() {
  // The recovery link Supabase sends lands here with the tokens already
  // parsed into a session by the client (detectSessionInUrl: true). We just
  // need to confirm a session actually exists before letting anyone set a
  // new password — a stale/expired/reused link won't produce one.
  const [checking, setChecking] = useState(true)
  const [validLink, setValidLink] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidLink(true)
        setChecking(false)
      }
    })

    // Fallback in case the event already fired before this component mounted.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) setValidLink(true)
      setChecking(false)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  const strength = pw => {
    if (!pw) return 0
    let s = 0
    if (pw.length >= 8) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return s
  }
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E']
  const pwStrength = strength(password)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) { setError(updateError.message); return }

    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1800)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden', fontFamily: font }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="LaunchSession" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
            Launch<span style={{ background: 'linear-gradient(135deg,#93C5FD,#C4B5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Session</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(12px)' }}>

          {checking && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Verifying your reset link...</div>
            </div>
          )}

          {!checking && !validLink && !done && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Link expired or invalid</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>
                This password reset link is no longer valid. Request a new one from the sign in page.
              </div>
              <button onClick={() => { window.location.href = '/login' }} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                Back to Sign In
              </button>
            </div>
          )}

          {!checking && validLink && done && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Password updated</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Taking you to your workspace...</div>
            </div>
          )}

          {!checking && validLink && !done && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Set a new password</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>Choose a strong password for your account.</div>

              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoFocus placeholder="Min. 8 characters" style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                      {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= pwStrength ? strengthColor[pwStrength] : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: strengthColor[pwStrength], fontWeight: 700 }}>{strengthLabel[pwStrength]}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Confirm password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password"
                    style={{ ...inputStyle, border: `1.5px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}` }} />
                  {confirm && confirm !== password && <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>Passwords don't match</div>}
                  {confirm && confirm === password && <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 6, fontWeight: 600 }}>✓ Passwords match</div>}
                </div>

                <button type="submit" disabled={saving || !password || !confirm} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving || !password || !confirm ? 'default' : 'pointer', opacity: saving || !password || !confirm ? 0.6 : 1, fontFamily: font }}>
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Powered by <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>LaunchSession</span>
        </div>
      </div>
    </div>
  )
}

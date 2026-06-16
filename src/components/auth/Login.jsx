import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STEPS = { EMAIL: 'email', PASSWORD: 'password', MAGIC: 'magic', FORGOT: 'forgot' }

const inp = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.07)', color: '#fff',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

export default function Login({ org }) {
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const primary = org?.primary_color || '#3B82F6'
  const orgName = org?.name || 'LaunchSession'

  const handleEmailContinue = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    // Check if user exists
    await supabase.from('user_profiles').select('id').eq('email', email).maybeSingle()
    setLoading(false)
    setStep(STEPS.PASSWORD)
  }

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
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

  return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: `radial-gradient(ellipse, ${primary}22 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={orgName} style={{ height: 56, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${primary}, #8B5CF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 auto 16px' }}>{orgName[0]}</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>{orgName}</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(12px)' }}>

          {/* STEP: EMAIL */}
          {step === STEPS.EMAIL && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Welcome back</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Sign in to your organisation workspace</div>
              </div>
              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleEmailContinue}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Work email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@organisation.com" style={inp} />
                </div>
                <button type="submit" disabled={loading || !email.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !email.trim() ? 'default' : 'pointer', opacity: loading || !email.trim() ? 0.6 : 1, transition: 'all 0.2s' }}>
                  {loading ? 'Checking...' : 'Continue →'}
                </button>
              </form>
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
              <button onClick={() => { if(email.trim()) handleMagicLink() }} style={{ marginTop: 16, width: '100%', padding: 13, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                ✉️ Email me a magic link
              </button>
            </div>
          )}

          {/* STEP: MAGIC SENT */}
          {step === STEPS.EMAIL && magicSent && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,11,24,0.97)', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>We sent a magic link to <strong style={{ color: '#fff' }}>{email}</strong>. Click it to sign in instantly.</div>
              <button onClick={() => setMagicSent(false)} style={{ marginTop: 24, padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Back</button>
            </div>
          )}

          {/* STEP: PASSWORD */}
          {step === STEPS.PASSWORD && (
            <div>
              <button onClick={() => { setStep(STEPS.EMAIL); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                ← Back
              </button>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Welcome back</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${primary}, #8B5CF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>{orgName[0]}</div>
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
          <button onClick={() => window.location.href = '/'} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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

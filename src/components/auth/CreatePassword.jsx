import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function CreatePassword() {
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const loadInvite = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) { setError('Invite token missing.'); setLoading(false); return }
      const { data, error } = await supabase
        .from('admin_invites')
        .select('*, organisations(name, slug)')
        .eq('token', token)
        .eq('status', 'pending')
        .single()
      if (error || !data) setError('Invite not found or already used.')
      else setInvite(data)
      setLoading(false)
    }
    loadInvite()
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

  const createAccount = async e => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!invite) { setError('Invite not found or already used.'); return }
    setSaving(true)

    let authData = null
    const { data: signUpData, error: authError } = await supabase.auth.signUp({ email: invite.email, password })
    
    if (authError && authError.message.includes('already registered')) {
      // User exists - sign them in with new password by updating it
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (signInError) { setError('Account exists. Try signing in directly.'); setSaving(false); return }
      authData = signInData
    } else if (authError) {
      setError(authError.message); setSaving(false); return
    } else {
      authData = signUpData
    }

    if (authData?.user?.id || authData?.session?.user?.id) {
      await supabase.from('user_profiles').insert([{
        id: authData?.user?.id || authData?.session?.user?.id, org_id: invite.org_id,
        email: invite.email, full_name: invite.full_name, role: invite.role || 'admin'
      }])
      await supabase.from('admin_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id)
    }

    // Sign in immediately after signup
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password
    })

    if (signInError) {
      // Account created but email confirmation required - redirect to login
      setDone(true)
      setTimeout(() => {
        window.location.href = '/dashboard?org=' + invite.organisations.slug
      }, 2000)
      return
    }

    setDone(true)
    setTimeout(() => {
      localStorage.setItem('launchsession_org_slug', invite.organisations.slug)
      window.location.href = '/dashboard?org=' + invite.organisations.slug
    }, 2000)
  }

  const orgName = invite?.organisations?.name

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading your invite...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #2a144f 0%, #07111f 42%, #030711 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -180, left: -140, width: 520, height: 520, background: 'radial-gradient(circle, rgba(168,85,247,0.28), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, right: -160, width: 620, height: 620, background: 'radial-gradient(circle, rgba(37,99,235,0.34), transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 2 }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 8 }}>You're all set!</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>Taking you to your workspace...</div>
            <div style={{ marginTop: 24, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #3B82F6, #6366F1)', borderRadius: 99, animation: 'progress 2s linear', width: '100%' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img src="/logo.png" alt="LaunchSession" style={{ width: 120, objectFit: 'contain', marginBottom: 16 }} />
              {orgName && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 99, padding: '6px 14px', marginBottom: 16 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4ADE80' }}>{orgName} workspace ready</span>
                </div>
              )}
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>Create your password</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                {invite ? `Setting up account for ${invite.email}` : 'Complete your account setup'}
              </p>
            </div>

            <form onSubmit={createAccount} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, backdropFilter: 'blur(18px)' }}>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 characters"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '13px 44px 13px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, outline: 'none' }} />
                  <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
                    {showPw ? '👁' : '👁‍🗨'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= pwStrength ? strengthColor[pwStrength] : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: strengthColor[pwStrength], fontWeight: 700 }}>{strengthLabel[pwStrength]}</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 10, border: `1px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`, background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, outline: 'none' }} />
                {confirm && confirm !== password && <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 4, fontWeight: 600 }}>Passwords don't match</div>}
                {confirm && confirm === password && <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 4, fontWeight: 600 }}>✓ Passwords match</div>}
              </div>

              <button type="submit" disabled={saving || !password || !confirm} style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: saving || !password || !confirm ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#3b82f6,#4f46e5)', color: saving || !password || !confirm ? 'rgba(255,255,255,0.3)' : '#fff', fontWeight: 800, fontSize: 15, cursor: saving || !password || !confirm ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                {saving ? 'Creating your account...' : 'Create Account & Launch Workspace →'}
              </button>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>🔒 Secured by Supabase Auth</span>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

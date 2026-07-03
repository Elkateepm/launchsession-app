import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Reached only via the invite email link. Supabase's invite flow establishes
// a session automatically from the access token in the URL hash before this
// component mounts, so we read org/role/email straight off that session's
// user_metadata rather than any custom token/table lookup.
export default function VolunteerAcceptInvite() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !session?.user) {
        setError('This invite link is invalid or has expired. Please ask your organisation to resend it.')
        setLoading(false)
        return
      }

      const meta = session.user.user_metadata || {}
      if (meta.role !== 'volunteer' || !meta.org_id) {
        setError('This invite link is not valid for volunteer sign-up.')
        setLoading(false)
        return
      }

      setUser(session.user)

      const { data: orgData, error: orgErr } = await supabase
        .from('organisations')
        .select('name, slug, primary_color, logo_url')
        .eq('id', meta.org_id)
        .single()

      if (orgErr || !orgData) {
        setError('Could not load your organisation details. Please contact them directly.')
        setLoading(false)
        return
      }

      setOrg(orgData)
      setLoading(false)
    }
    load()
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

  const primary = org?.primary_color || '#1B9AAA'

  const confirmInvite = async e => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!user || !org) { setError('Invite details missing — please refresh and try again.'); return }
    setSaving(true)

    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setError(pwErr.message); setSaving(false); return }

    const meta = user.user_metadata || {}
    const { error: profileErr } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: meta.full_name || user.email.split('@')[0],
      org_id: meta.org_id,
      role: 'volunteer',
      status: 'pending', // still goes through normal approval, matches existing volunteer flow
    }, { onConflict: 'id' })

    if (profileErr) {
      setError('Password set, but we could not finish setting up your profile: ' + profileErr.message)
      setSaving(false)
      return
    }

    setDone(true)
    setTimeout(() => {
      window.location.href = `/volunteer/${org.slug}`
    }, 1800)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading your invite...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 440, padding: '36px 28px', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Invite link problem</div>
        <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0D1B2A 0%,#1B2A3B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

        {done ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 6 }}>You're all set!</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>Taking you to {org?.name}'s volunteer portal...</div>
          </div>
        ) : (
          <>
            <div style={{ background: primary, padding: '28px 28px 22px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
                {org?.logo_url ? (
                  <img src={org.logo_url} alt={org.name} style={{ height: 40, maxWidth: 160, objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 12px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 }}>
                      {(org?.name || 'L')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>{org?.name}</span>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>You've been invited!</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  Join <strong>{org?.name}</strong> as a volunteer
                </div>
              </div>
            </div>

            <form onSubmit={confirmInvite} style={{ padding: '28px 28px 24px' }}>
              {error && (
                <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C00', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Your email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E5E7EB', fontSize: 15, boxSizing: 'border-box', marginBottom: 14, background: '#F9FAFB', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}
              />

              <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Choose a password</label>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Min. 8 characters"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: 12, border: '1.5px solid #E5E7EB', fontSize: 15, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {password.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= pwStrength ? strengthColor[pwStrength] : '#E5E7EB', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: strengthColor[pwStrength], fontWeight: 700 }}>{strengthLabel[pwStrength]}</div>
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${confirm && confirm !== password ? '#FCA5A5' : '#E5E7EB'}`, fontSize: 15, outline: 'none', marginBottom: 6, fontFamily: 'Inter,sans-serif' }}
              />
              {confirm && confirm !== password && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 14, fontWeight: 600 }}>Passwords don't match</div>}
              {confirm && confirm === password && <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 14, fontWeight: 600 }}>✓ Passwords match</div>}

              <button
                type="submit"
                disabled={saving || !password || !confirm}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving || !password || !confirm ? '#E5E7EB' : primary, color: saving || !password || !confirm ? '#9CA3AF' : '#fff', fontSize: 16, fontWeight: 800, cursor: saving || !password || !confirm ? 'default' : 'pointer', marginTop: 8 }}
              >
                {saving ? 'Setting up your account...' : 'Confirm & Join →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

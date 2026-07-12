import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const ROLE_CONTENT = {
  admin: {
    kicker: 'Thanks for joining as an admin',
    features: [
      { icon: '🏢', title: 'Run the whole show', body: "You'll manage settings, your team and everything in between." },
      { icon: '📊', title: 'See the full picture', body: 'Reports, safeguarding and impact — all in one workspace.' },
      { icon: '🛡️', title: "You're in control", body: 'Full admin access to keep your organisation running smoothly.' },
    ],
  },
  staff: {
    kicker: 'Thanks for joining the team',
    features: [
      { icon: '📅', title: 'Plan sessions', body: 'Create activities, run registers and manage attendance.' },
      { icon: '👥', title: 'Stay connected', body: 'Access your sessions, messages and important updates.' },
      { icon: '🛡️', title: "You're valued", body: "Be part of a team that's making a real difference." },
    ],
  },
  volunteer: {
    kicker: 'Thanks for volunteering',
    features: [
      { icon: '👥', title: 'Make an impact', body: 'Help deliver amazing sessions and support young people.' },
      { icon: '📅', title: 'Stay connected', body: 'Access your sessions, messages and important updates.' },
      { icon: '🛡️', title: "You're valued", body: "Be part of a team that's making a real difference." },
    ],
  },
}

function RocketScene() {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 260, margin: '0 auto', overflow: 'visible' }}>
      {[...Array(18)].map((_, i) => (
        <motion.div key={i}
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.9, 0.15] }}
          transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: (i % 6) * 0.4, ease: 'easeInOut' }}
          style={{
            position: 'absolute', width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2, borderRadius: '50%', background: '#fff',
            top: `${(i * 37) % 90}%`, left: `${(i * 53) % 100}%`,
          }} />
      ))}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '60%', height: 110,
        background: 'radial-gradient(ellipse at 30% center, rgba(168,85,247,0.45), rgba(139,92,246,0.15) 55%, transparent 75%)',
        filter: 'blur(6px)',
      }} />
      <img
        src="https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/hero-illustration.png"
        alt=""
        style={{
          position: 'absolute', bottom: 20, left: -180,
          width: 880, maxWidth: '210%', height: 'auto', filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.55))',
        }} />
    </div>
  )
}

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
        .select('*, organisations(name, slug, logo_url, primary_color)')
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

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })

    if (signInError) {
      setDone(true)
      setTimeout(() => { window.location.href = '/dashboard?org=' + invite.organisations.slug }, 2000)
      return
    }

    setDone(true)
    setTimeout(() => {
      localStorage.setItem('launchsession_org_slug', invite.organisations.slug)
      window.location.href = '/dashboard?org=' + invite.organisations.slug
    }, 2000)
  }

  const orgName = invite?.organisations?.name
  const orgLogo = invite?.organisations?.logo_url
  const primary = invite?.organisations?.primary_color || '#8B5CF6'
  const roleKey = ['admin', 'staff', 'volunteer'].includes(invite?.role) ? invite.role : 'staff'
  const content = ROLE_CONTENT[roleKey]

  const inputStyle = focus => ({
    width: '100%', boxSizing: 'border-box', padding: '13px 44px 13px 44px', borderRadius: 12,
    border: `1.5px solid rgba(255,255,255,${focus ? 0.28 : 0.12})`, background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: 15, outline: 'none', transition: 'border-color 0.15s',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading your invite...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#050510', display: 'flex', position: 'relative', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Ambient stars across whole page */}
      {[...Array(40)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: i % 5 === 0 ? 2.5 : 1.5, height: i % 5 === 0 ? 2.5 : 1.5, borderRadius: '50%',
          background: '#fff', opacity: 0.5, top: `${(i * 23) % 100}%`, left: `${(i * 41) % 100}%`, pointerEvents: 'none',
        }} />
      ))}
      <div style={{ position: 'absolute', top: -180, left: -140, width: 520, height: 520, background: 'radial-gradient(circle, rgba(168,85,247,0.25), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, right: -160, width: 620, height: 620, background: 'radial-gradient(circle, rgba(99,102,241,0.28), transparent 65%)', pointerEvents: 'none' }} />

      {/* Left: brand / marketing panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', position: 'relative', zIndex: 2, minWidth: 0 }} className="cp-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 44 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${primary}, #A855F7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🚀</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>LaunchSession</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: primary, letterSpacing: 1 }}>EMPOWERING YOUTH. EVERY SESSION.</div>
          </div>
        </div>

        <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>Welcome to</div>
        <div style={{ fontSize: 52, fontWeight: 900, background: `linear-gradient(135deg, #fff, ${primary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1, marginBottom: 20 }}>
          LaunchSession
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 36, maxWidth: 440 }}>
          {content.kicker}{orgName ? ` with ${orgName}` : ''}. Your time and commitment help young people grow, connect and thrive.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 48 }}>
          {content.features.map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        <RocketScene />
      </div>

      {/* Right: create password card */}
      <div style={{ flex: '0 0 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', zIndex: 2 }} className="cp-right">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '40px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, backdropFilter: 'blur(18px)' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 8 }}>You're all set!</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Taking you to your workspace...</div>
                <div style={{ marginTop: 22, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2, ease: 'linear' }} style={{ height: '100%', background: `linear-gradient(90deg, ${primary}, #6366F1)`, borderRadius: 99 }} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>

                <div style={{ textAlign: 'center', marginBottom: 26 }}>
                  <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#fff', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 0 3px ${primary}55` }}>
                    {orgLogo ? (
                      <img src={orgLogo} alt={orgName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 30 }}>🏢</span>
                    )}
                  </div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Create Your Password</h1>
                  <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    {invite ? <>Setting up your account for <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{invite.email}</strong></> : 'Complete your account setup'}
                  </p>
                  {orgName && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 99, padding: '5px 13px', marginTop: 14 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#4ADE80' }}>{orgName} workspace ready</span>
                    </div>
                  )}
                </div>

                <form onSubmit={createAccount}>
                  {error && (
                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                      ⚠ {error}
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 8 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.5 }}>🔒</span>
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 characters"
                        style={inputStyle(false)} />
                      <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                        {showPw ? '🙈' : '👁'}
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
                    <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 8 }}>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.5 }}>🔒</span>
                      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password"
                        style={{ ...inputStyle(false), border: `1.5px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`, paddingRight: 16 }} />
                    </div>
                    {confirm && confirm !== password && <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>Passwords don't match</div>}
                    {confirm && confirm === password && <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 6, fontWeight: 600 }}>✓ Passwords match</div>}
                  </div>

                  <motion.button whileHover={{ y: saving || !password || !confirm ? 0 : -2 }} type="submit" disabled={saving || !password || !confirm}
                    style={{
                      width: '100%', padding: 15, borderRadius: 12, border: 'none',
                      background: saving || !password || !confirm ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${primary}, #6366F1)`,
                      color: saving || !password || !confirm ? 'rgba(255,255,255,0.3)' : '#fff', fontWeight: 800, fontSize: 15,
                      cursor: saving || !password || !confirm ? 'default' : 'pointer',
                      boxShadow: saving || !password || !confirm ? 'none' : `0 10px 30px -8px ${primary}80`,
                    }}>
                    {saving ? 'Creating your account...' : 'Create Account & Launch →'}
                  </motion.button>

                  <div style={{ margin: '20px 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Need help?</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: `${primary}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💬</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Problem with your invite?</div>
                      <a href="mailto:support@launchsession.co.uk" style={{ fontSize: 12, color: '#C4B5FD', fontWeight: 700, textDecoration: 'none' }}>Contact support@launchsession.co.uk</a>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            🛡️ Your data is secure and never shared.
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cp-left { display: none !important; }
          .cp-right { flex: 1 !important; }
        }
      `}</style>
    </div>
  )
}

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

const SUPERPOWERS = [
  { icon: '🎨', label: 'Master of Arts & Crafts Chaos' },
  { icon: '⚽', label: 'Undefeated Rock-Paper-Scissors Champion' },
  { icon: '🍪', label: 'Snack Time Diplomat' },
  { icon: '📢', label: 'Can Be Heard From Space' },
  { icon: '🧘', label: 'Zen Master of Chaos' },
  { icon: '🦸', label: 'Secretly a Superhero' },
]

function RocketScene() {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 280, margin: '32px auto 0', overflow: 'visible' }}>
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
      <img
        src="https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/hero-illustration.png"
        alt=""
        style={{
          position: 'absolute', bottom: 10, left: -60,
          height: 260, width: 'auto', maxWidth: 'none',
        }} />
    </div>
  )
}

function StepDots({ step, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 99, background: i <= step ? '#fff' : 'rgba(255,255,255,0.2)', transition: 'all 0.25s' }} />
      ))}
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
  const [showPw, setShowPw] = useState(false)

  // step: 'password' | 'profile' | 'fun' | 'done'
  const [step, setStep] = useState('password')
  const [authedUserId, setAuthedUserId] = useState(null)
  const [preferredName, setPreferredName] = useState('')
  const [phone, setPhone] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [funFact, setFunFact] = useState('')
  const [customFunFact, setCustomFunFact] = useState('')

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
      else { setInvite(data); setPreferredName((data.full_name || '').split(' ')[0] || '') }
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

    const token = new URLSearchParams(window.location.search).get('token')
    let authData = null
    const { data: signUpData, error: authError } = await supabase.auth.signUp({ email: invite.email, password })

    if (authError && authError.message.includes('already registered')) {
      // A stray auth account exists for this email (e.g. left over from an
      // earlier invite attempt) with no real password ever set on it.
      // Set one server-side via the invite token instead of a client-side
      // sign-in attempt, which would only ever fail here.
      try {
        const res = await fetch('/api/complete-invite-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: invite.email, password, invite_token: token }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Could not set up this account. Please contact support.'); setSaving(false); return }
      } catch (fixErr) {
        setError('Could not set up this account. Please contact support.'); setSaving(false); return
      }
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (signInError) { setError('Account exists. Try signing in directly.'); setSaving(false); return }
      authData = signInData
    } else if (authError) {
      setError(authError.message); setSaving(false); return
    } else {
      authData = signUpData
    }

    const uid = authData?.user?.id || authData?.session?.user?.id
    if (uid) {
      await supabase.from('user_profiles').upsert([{
        id: uid, org_id: invite.org_id,
        email: invite.email, full_name: invite.full_name, role: invite.role || 'admin'
      }], { onConflict: 'id' })
      await supabase.from('admin_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id)
    }

    await supabase.auth.signInWithPassword({ email: invite.email, password })

    setAuthedUserId(uid)
    setSaving(false)
    setStep('profile')
  }

  const handlePhotoChange = async e => {
    const file = e.target.files?.[0]
    if (!file || !authedUserId) return
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()
    const filePath = `avatars/${authedUserId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('org-logos').upload(filePath, file, { upsert: true })
    if (!uploadError) {
      const { data } = supabase.storage.from('org-logos').getPublicUrl(filePath)
      setPhotoUrl(`${data.publicUrl}?v=${Date.now()}`)
    }
    setPhotoUploading(false)
  }

  const saveProfileStep = async () => {
    if (authedUserId) {
      await supabase.from('user_profiles').update({
        preferred_name: preferredName || null, phone: phone || null, photo_url: photoUrl || null,
      }).eq('id', authedUserId)
    }
    setStep('fun')
  }

  const finishFunStep = async () => {
    const finalFunFact = funFact === 'custom' ? customFunFact : (SUPERPOWERS.find(s => s.label === funFact)?.label || '')
    if (authedUserId) {
      await supabase.from('user_profiles').update({
        fun_fact: finalFunFact || null, profile_setup_complete: true,
      }).eq('id', authedUserId)
    }
    setStep('done')
    setTimeout(() => {
      localStorage.setItem('launchsession_org_slug', invite.organisations.slug)
      window.location.href = '/dashboard?org=' + invite.organisations.slug
    }, 2200)
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
  const plainInputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
  }

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

      {/* Left: brand / marketing panel (desktop only) */}
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

      {/* Right: the wizard */}
      <div style={{ flex: '0 0 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', zIndex: 2 }} className="cp-right">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnimatePresence mode="wait">

            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '40px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, backdropFilter: 'blur(18px)' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 8 }}>You're officially part of the crew!</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Taking you to your workspace...</div>
                <div style={{ marginTop: 22, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2.2, ease: 'linear' }} style={{ height: '100%', background: `linear-gradient(90deg, ${primary}, #6366F1)`, borderRadius: 99 }} />
                </div>
              </motion.div>
            )}

            {step === 'password' && (
              <motion.div key="password" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>

                <div style={{ textAlign: 'center', marginBottom: 26 }}>
                  <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#fff', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 0 3px ${primary}55` }}>
                    {orgLogo ? (
                      <img src={orgLogo} alt={orgName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src="https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png" alt="LaunchSession" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Let's get you kitted out 🚀</h1>
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
                    {saving ? 'Creating your account...' : 'Create Account →'}
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

            {step === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <StepDots step={1} total={3} />
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
                  <h1 style={{ fontSize: 21, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Say cheese!</h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>A friendly face helps your team recognise you. Totally optional.</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                  <label style={{ cursor: 'pointer' }}>
                    <div style={{ width: 88, height: 88, borderRadius: '50%', background: photoUrl ? `url(${photoUrl}) center/cover` : 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'rgba(255,255,255,0.4)' }}>
                      {photoUploading ? '⏳' : !photoUrl && '➕'}
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 8 }}>What should we call you?</label>
                  <input value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="Preferred name" style={plainInputStyle} />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 8 }}>Phone number <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07..." style={plainInputStyle} />
                </div>

                <button onClick={saveProfileStep} style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 10px 30px -8px ${primary}80` }}>
                  Continue →
                </button>
              </motion.div>
            )}

            {step === 'fun' && (
              <motion.div key="fun" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <StepDots step={2} total={3} />
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🦸</div>
                  <h1 style={{ fontSize: 21, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>One more thing...</h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>What's your session superpower? (Also optional, but come on.)</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {SUPERPOWERS.map(s => (
                    <button key={s.label} onClick={() => setFunFact(s.label)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${funFact === s.label ? primary : 'rgba(255,255,255,0.1)'}`, background: funFact === s.label ? `${primary}20` : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 18 }}>{s.icon}</span> {s.label}
                    </button>
                  ))}
                  <button onClick={() => setFunFact('custom')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${funFact === 'custom' ? primary : 'rgba(255,255,255,0.1)'}`, background: funFact === 'custom' ? `${primary}20` : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 18 }}>✍️</span> Let me write my own
                  </button>
                  {funFact === 'custom' && (
                    <input value={customFunFact} onChange={e => setCustomFunFact(e.target.value)} placeholder="e.g. Professional puddle-jump spotter" style={plainInputStyle} maxLength={80} />
                  )}
                </div>

                <button onClick={finishFunStep} style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 10px 30px -8px ${primary}80`, marginBottom: 10 }}>
                  Finish & Launch 🚀
                </button>
                <button onClick={finishFunStep} style={{ width: '100%', padding: 8, borderRadius: 10, border: 'none', background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  Skip for now
                </button>
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

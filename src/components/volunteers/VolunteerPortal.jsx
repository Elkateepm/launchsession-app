import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function VolunteerPortal() {
  const [authUser, setAuthUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [staffStatus, setStaffStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login') // login | register | dashboard | pending
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirm: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState({})

  const slug = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'Organisation'

  useEffect(() => {
    if (slug) supabase.from('organisations').select('*').eq('slug', slug).single()
      .then(({ data }) => { if (data) setOrg(data) })
  }, [slug])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user || null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setAuthUser(s?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (authUser && org) loadDashboard()
  }, [authUser, org]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDashboard() {
    const { data: p } = await supabase.from('user_profiles').select('*').eq('id', authUser.id).single()
    setProfile(p)
    if (p?.status === 'pending') { setView('pending'); return }
    const today = new Date().toISOString().split('T')[0]
    const { data: s } = await supabase.from('sessions').select('*').eq('org_id', org.id).eq('date', today).order('start_time')
    setSessions(s || [])
    if (s?.length) {
      const { data: ss } = await supabase.from('session_staff').select('*').eq('user_id', authUser.id).in('session_id', s.map(x => x.id))
      const map = {}
      ss?.forEach(r => { map[r.session_id] = r })
      setStaffStatus(map)
    }
    setView('dashboard')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(error.message); setAuthLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setAuthLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { setError(error.message); setAuthLoading(false); return }
    if (data.user) {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        org_id: org.id,
        role: 'volunteer',
        status: 'pending',
        onboarding_complete: true,
      })
    }
    setAuthLoading(false)
    setView('pending')
  }

  async function toggleSession(s) {
    setSigningIn(p => ({ ...p, [s.id]: true }))
    const existing = staffStatus[s.id]
    if (existing) {
      if (existing.signed_in_at && !existing.signed_out_at) {
        await supabase.from('session_staff').update({ signed_out_at: new Date().toISOString() }).eq('id', existing.id)
        setStaffStatus(p => ({ ...p, [s.id]: { ...existing, signed_out_at: new Date().toISOString() } }))
      } else {
        await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString(), signed_out_at: null }).eq('id', existing.id)
        setStaffStatus(p => ({ ...p, [s.id]: { ...existing, signed_in_at: new Date().toISOString(), signed_out_at: null } }))
      }
    } else {
      const { data } = await supabase.from('session_staff').insert({ session_id: s.id, user_id: authUser.id, org_id: org.id, signed_in_at: new Date().toISOString() }).select().single()
      if (data) setStaffStatus(p => ({ ...p, [s.id]: data }))
    }
    setSigningIn(p => ({ ...p, [s.id]: false }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setAuthUser(null); setProfile(null); setSessions([]); setStaffStatus({}); setView('login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `3px solid #1B9AAA`, borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginTop: 6 }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block' }

  const OrgBadge = () => (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 14px' }}>
        {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }} /> : '🚀'}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{orgName}</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Volunteer Portal</p>
    </div>
  )

  if (view === 'pending') return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <OrgBadge />
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Awaiting approval</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Your volunteer request has been sent to {orgName}. You'll be able to sign in once an admin approves your account.</div>
        </div>
        <button onClick={handleSignOut} style={{ marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 24 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if (view === 'register') return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <OrgBadge />
        <form onSubmit={handleRegister} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>Create volunteer account</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>Your request will be reviewed by {orgName} before you can access sessions.</div>
          {[['Full name', 'text', 'full_name', 'Jane Smith'], ['Email', 'email', 'email', 'jane@email.com'], ['Password', 'password', 'password', '••••••••'], ['Confirm password', 'password', 'confirm', '••••••••']].map(([label, type, key, ph]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{label}</label>
              <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required style={inputStyle} />
            </div>
          ))}
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#FCA5A5', marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}bb)`, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}>
            {authLoading ? 'Registering...' : 'Request access →'}
          </button>
          <button type="button" onClick={() => { setView('login'); setError('') }} style={{ width: '100%', marginTop: 10, padding: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>
            Already have an account? Sign in
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if (view === 'dashboard') {
    const firstName = profile?.full_name?.split(' ')[0] || 'Volunteer'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    return (
      <div style={{ minHeight: '100vh', background: '#080D1A', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚀</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{orgName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Volunteer Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}88, #6366f188)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <button onClick={handleSignOut} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>{todayStr}</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: '0 0 28px' }}>Here are today's sessions for {orgName}.</p>
          {sessions.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>No sessions today</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Check back tomorrow or contact your coordinator.</div>
            </div>
          ) : sessions.map(s => {
            const ss = staffStatus[s.id]
            const isIn = ss?.signed_in_at && !ss?.signed_out_at
            const wasIn = ss?.signed_in_at && ss?.signed_out_at
            return (
              <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isIn ? primary + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: 20, padding: '18px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>🕐 {s.start_time} – {s.end_time}</span>
                    {s.location && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>📍 {s.location}</span>}
                  </div>
                  {isIn && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: primary }}>● Signed in at {new Date(ss.signed_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {wasIn && <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Signed out at {new Date(ss.signed_out_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
                <button onClick={() => toggleSession(s)} disabled={signingIn[s.id]}
                  style={{ padding: '10px 18px', borderRadius: 12, border: isIn ? `1px solid ${primary}44` : 'none', flexShrink: 0, background: isIn ? 'transparent' : `linear-gradient(135deg, ${primary}, ${primary}bb)`, color: isIn ? primary : '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: signingIn[s.id] ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {signingIn[s.id] ? '...' : isIn ? 'Sign Out' : wasIn ? 'Sign In Again' : 'Sign In'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // LOGIN VIEW (default)
  return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <OrgBadge />
        <form onSubmit={handleLogin} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>Sign in to your volunteer account</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={inputStyle} />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#FCA5A5', marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}bb)`, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Signing in...' : 'Sign in →'}
          </button>
          <button type="button" onClick={() => { setView('register'); setError('') }} style={{ width: '100%', marginTop: 10, padding: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>
            New volunteer? Register here
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )
}

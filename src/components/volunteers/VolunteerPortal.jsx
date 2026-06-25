import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function VolunteerPortal() {
  const [session, setSession] = useState(null)
  const [org, setOrg] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState({})

  const slug = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (slug) loadOrg()
  }, [slug])

  useEffect(() => {
    if (session && org) {
      loadProfile()
      loadSessions()
    }
  }, [session, org])

  async function loadOrg() {
    const { data } = await supabase.from('organisations').select('*').eq('slug', slug).single()
    if (data) setOrg(data)
  }

  async function loadProfile() {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
  }

  async function loadSessions() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('org_id', org.id)
      .eq('date', today)
      .order('start_time')
    setSessions(data || [])
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setAuthLoading(false) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSessions([])
  }

  async function toggleSessionSignIn(s) {
    setSigningIn(p => ({ ...p, [s.id]: true }))
    const { data: existing } = await supabase
      .from('session_staff')
      .select('*')
      .eq('session_id', s.id)
      .eq('user_id', session.user.id)
      .single()

    if (existing) {
      if (existing.signed_in_at && !existing.signed_out_at) {
        await supabase.from('session_staff').update({ signed_out_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString(), signed_out_at: null }).eq('id', existing.id)
      }
    } else {
      await supabase.from('session_staff').insert({ session_id: s.id, user_id: session.user.id, org_id: org.id, signed_in_at: new Date().toISOString() })
    }
    setSigningIn(p => ({ ...p, [s.id]: false }))
    loadSessions()
  }

  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'Organisation'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${primary}`, borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
            {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }} /> : '🚀'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>{orgName}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Volunteer Portal</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#FCA5A5', marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}bb)`, color: '#fff', fontSize: 15, fontWeight: 800, cursor: authLoading ? 'not-allowed' : 'pointer', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 24 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'Volunteer'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ minHeight: '100vh', background: '#080D1A', fontFamily: 'system-ui, sans-serif', padding: '0 0 40px' }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '🚀'}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{orgName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Volunteer Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}88, #6366f188)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <button onClick={handleSignOut} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* GREETING */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>{todayStr}</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Here are today's sessions for {orgName}.</p>
        </div>

        {/* SESSIONS */}
        {sessions.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>No sessions today</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Check back tomorrow or contact your coordinator.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map(s => (
              <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>🕐 {s.start_time} – {s.end_time}</span>
                    {s.location && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>📍 {s.location}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleSessionSignIn(s)}
                  disabled={signingIn[s.id]}
                  style={{
                    padding: '10px 20px', borderRadius: 12, border: 'none', flexShrink: 0,
                    background: `linear-gradient(135deg, ${primary}, ${primary}bb)`,
                    color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    opacity: signingIn[s.id] ? 0.6 : 1
                  }}
                >
                  {signingIn[s.id] ? '...' : 'Sign In'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

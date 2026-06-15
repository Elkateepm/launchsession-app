import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Login({ org }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const primaryColor = org?.primary_color || '#1B9AAA'
  const orgName      = org?.name || 'LaunchSession'
  const slogan       = org?.slogan || 'Powered by LaunchSession'

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, #0A0A1A 0%, #12122A 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo / Org branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={orgName} style={{ height: 64, objectFit: 'contain', marginBottom: 12 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 18, background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>
              {orgName[0]}
            </div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{orgName}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{slogan}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>Staff & volunteer access</div>

          {error && <div style={{ background: '#FDE8E8', color: '#D0021B', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="you@organisation.com" />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: primaryColor, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          Powered by LaunchSession
        </div>
cat > ~/Desktop/launchsession-app/src/components/dashboard/Dashboard.jsx << 'EOF'
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const PLAN_MODULES = {
  starter:    ['registers', 'sessions', 'reports'],
  pro:        ['registers', 'sessions', 'reports', 'volunteers', 'parents', 'calendar', 'messaging'],
  enterprise: ['registers', 'sessions', 'reports', 'volunteers', 'parents', 'calendar', 'messaging', 'mentoring', 'safeguarding', 'gallery'],
}

const ALL_MODULES = [
  { key: 'registers',   label: 'Registers',     icon: '📋' },
  { key: 'sessions',    label: 'Sessions',      icon: '📅' },
  { key: 'volunteers',  label: 'Volunteers',    icon: '❤️' },
  { key: 'parents',     label: 'Parents',       icon: '👨‍👧' },
  { key: 'calendar',    label: 'Calendar',      icon: '🗓' },
  { key: 'mentoring',   label: 'Mentoring',     icon: '🤝' },
  { key: 'safeguarding',label: 'Safeguarding',  icon: '🛡' },
  { key: 'messaging',   label: 'Messaging',     icon: '💬' },
  { key: 'reports',     label: 'Reports',       icon: '📊' },
  { key: 'gallery',     label: 'Gallery',       icon: '🖼' },
]

export default function Dashboard({ session, org }) {
  const [tab, setTab] = useState('home')

  const plan    = org?.plan || 'starter'
  const allowed = PLAN_MODULES[plan] || PLAN_MODULES.starter
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'

  const availableModules = ALL_MODULES.filter(m => allowed.includes(m.key))

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#0A0A1A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Org branding */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={orgName} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {orgName[0]}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{orgName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{plan} plan</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <button onClick={() => setTab('home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: tab === 'home' ? `${primary}20` : 'transparent', color: tab === 'home' ? primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: tab === 'home' ? 600 : 400, marginBottom: 4, cursor: 'pointer', textAlign: 'left', borderLeft: `3px solid ${tab === 'home' ? primary : 'transparent'}` }}>
            <span>🏠</span> Home
          </button>
          {availableModules.map(m => (
            <button key={m.key} onClick={() => setTab(m.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: tab === m.key ? `${primary}20` : 'transparent', color: tab === m.key ? primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: tab === m.key ? 600 : 400, marginBottom: 2, cursor: 'pointer', textAlign: 'left', borderLeft: `3px solid ${tab === m.key ? primary : 'transparent'}` }}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
          <button onClick={handleSignOut} style={{ fontSize: 11, color: primary, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{ALL_MODULES.find(m => m.key === tab)?.label || 'Home'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{orgName}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'home' && (
            <div className="fade-up">
              {/* Welcome */}
              <div style={{ background: `linear-gradient(135deg, #0A0A1A, #12122A)`, borderRadius: 20, padding: '28px 32px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: `${primary}15` }} />
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                  Welcome back 👋
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
                  {orgName} · {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                </div>
                {org?.slogan && <div style={{ fontSize: 13, color: primary, fontStyle: 'italic' }}>"{org.slogan}"</div>}
              </div>

              {/* Module grid */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Your Modules</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {availableModules.map(m => (
                  <button key={m.key} onClick={() => setTab(m.key)} className="card" style={{ padding: '20px 16px', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                  </button>
                ))}
              </div>

              {/* Locked modules */}
              {ALL_MODULES.filter(m => !allowed.includes(m.key)).length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>🔒 Upgrade to unlock</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    {ALL_MODULES.filter(m => !allowed.includes(m.key)).map(m => (
                      <div key={m.key} className="card" style={{ padding: '20px 16px', textAlign: 'center', opacity: 0.4, filter: 'grayscale(1)' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab !== 'home' && (
            <div className="card fade-up" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>{ALL_MODULES.find(m => m.key === tab)?.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{ALL_MODULES.find(m => m.key === tab)?.label}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>This module is being built for LaunchSession</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

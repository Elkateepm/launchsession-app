import SessionPlanner from '../sessions/SessionPlanner'
import Hub from '../hub/Hub'
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Registers from '../registers/Registers'

const PLAN_MODULES = {
  starter:    ['registers', 'planner', 'reports'],
  pro:        ['registers', 'planner', 'reports', 'volunteers', 'parent_portal', 'messaging'],
  enterprise: ['registers', 'planner', 'reports', 'volunteers', 'parent_portal', 'messaging', 'mentoring', 'safeguarding', 'gallery'],
}

const ALL_MODULES = [
  { key: 'registers',     label: 'Registers',    icon: '📋' },
  { key: 'planner',       label: 'Sessions',     icon: '📅' },
  { key: 'volunteers',    label: 'Volunteers',   icon: '❤️' },
  { key: 'parent_portal', label: 'Parents',      icon: '👨‍👧' },
  { key: 'mentoring',     label: 'Mentoring',    icon: '🤝' },
  { key: 'safeguarding',  label: 'Safeguarding', icon: '🛡' },
  { key: 'messaging',     label: 'Messaging',    icon: '💬' },
  { key: 'reports',       label: 'Reports',      icon: '📊' },
  { key: 'gallery',       label: 'Gallery',      icon: '🖼' },
]

export default function Dashboard({ session, org }) {
  const [tab, setTab] = useState('home')
  const plan    = org?.plan || 'starter'
  const allowed = org?.modules || PLAN_MODULES[plan] || PLAN_MODULES.starter
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'
  const availableModules = ALL_MODULES.filter(m => allowed.includes(m.key))
  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg, #f9fafb)', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <div style={{ width: 220, background: '#0A0A1A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{orgName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{plan} plan</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <button onClick={() => setTab('home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: tab === 'home' ? primary + '20' : 'transparent', color: tab === 'home' ? primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: tab === 'home' ? 600 : 400, marginBottom: 4, cursor: 'pointer', textAlign: 'left', borderLeft: '3px solid ' + (tab === 'home' ? primary : 'transparent') }}>
            <span>🏠</span> Home
          </button>
          {availableModules.map(m => (
            <button key={m.key} onClick={() => setTab(m.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: tab === m.key ? primary + '20' : 'transparent', color: tab === m.key ? primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: tab === m.key ? 600 : 400, marginBottom: 2, cursor: 'pointer', textAlign: 'left', borderLeft: '3px solid ' + (tab === m.key ? primary : 'transparent') }}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
          <button onClick={handleSignOut} style={{ fontSize: 11, color: primary, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOPBAR — hidden when in registers (it has its own header) */}
        {tab !== 'registers' && (
          <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ALL_MODULES.find(m => m.key === tab)?.label || 'Home'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{orgName}</div>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* HOME — Hub */}
          {tab === 'home' && <Hub org={org} session={session} onNavigate={setTab} />}
          {tab === 'home_old' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ background: 'linear-gradient(135deg, #0A0A1A, #12122A)', borderRadius: 20, padding: '28px 32px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: primary + '15' }} />
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Welcome back 👋</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{orgName} · {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</div>
                {org?.slogan && <div style={{ fontSize: 13, color: primary, fontStyle: 'italic', marginTop: 8 }}>"{org.slogan}"</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Your Modules</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                {availableModules.map(m => (
                  <button key={m.key} onClick={() => setTab(m.key)} style={{ padding: '20px 16px', textAlign: 'center', border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', borderRadius: 12 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  </button>
                ))}
              </div>
              {ALL_MODULES.filter(m => !allowed.includes(m.key)).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>🔒 Upgrade to unlock</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                    {ALL_MODULES.filter(m => !allowed.includes(m.key)).map(m => (
                      <div key={m.key} style={{ padding: '20px 16px', textAlign: 'center', opacity: 0.4, filter: 'grayscale(1)', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REGISTERS — real component */}
          {tab === 'registers' && <Registers org={org} session={session} />}

          {/* HUB */}
          {tab === 'home' && false && null}

          {tab === 'planner' && <SessionPlanner org={org} />}

          {/* OTHER MODULES — coming soon */}
          {tab !== 'home' && tab !== 'registers' && tab !== 'planner' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>{ALL_MODULES.find(m => m.key === tab)?.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{ALL_MODULES.find(m => m.key === tab)?.label}</div>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>This module is being built</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

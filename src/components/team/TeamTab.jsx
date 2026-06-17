import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['admin', 'staff', 'volunteer']

export default function TeamTab({ org, session }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!org?.id) return
    supabase.from('user_profiles').select('*').eq('org_id', org.id).order('created_at')
      .then(({ data }) => { setMembers(data || []); setLoading(false) })
  }, [org?.id])

  const handleInvite = async e => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    setInviteSuccess('')

    // Check if already exists
    const { data: existing } = await supabase.from('user_profiles').select('id').eq('email', inviteEmail.trim().toLowerCase()).eq('org_id', org.id).maybeSingle()
    if (existing) { setError('This person is already in your team.'); setInviting(false); return }

    // Send magic link invite via Supabase auth
    const { error: inviteErr } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim().toLowerCase(),
      options: {
        emailRedirectTo: `https://app.launchsession.co.uk/?org=${org.slug}`,
        data: { org_id: org.id, org_name: org.name, role: inviteRole }
      }
    })

    if (inviteErr) { setError(inviteErr.message); setInviting(false); return }

    // Add to user_profiles
    await supabase.from('user_profiles').upsert([{
      email: inviteEmail.trim().toLowerCase(),
      org_id: org.id,
      role: inviteRole,
      full_name: inviteEmail.split('@')[0]
    }], { onConflict: 'email' })

    const { data: updated } = await supabase.from('user_profiles').select('*').eq('org_id', org.id).order('created_at')
    setMembers(updated || [])
    setInviteSuccess(`Invite sent to ${inviteEmail}!`)
    setInviteEmail('')
    setInviting(false)
  }

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this person from your team?')) return
    await supabase.from('user_profiles').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const primary = org?.primary_color || '#1B9AAA'
  const roleColors = { admin: '#8B5CF6', staff: '#1B9AAA', volunteer: '#417505' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Invite card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Invite Staff</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Send a magic link invite — they'll be added to {org?.name} automatically.</div>

          {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C00', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</div>}
          {inviteSuccess && <div style={{ background: '#F0FFF4', border: '1px solid #B0E8C0', color: '#1A5C1A', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>✓ {inviteSuccess}</div>}

          <form onSubmit={handleInvite}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email address</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="staff@organisation.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <button type="submit" disabled={inviting || !inviteEmail.trim()}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: inviting || !inviteEmail.trim() ? 'default' : 'pointer', opacity: inviting || !inviteEmail.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>

        {/* Team list */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Team Members</div>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{members.length} {members.length === 1 ? 'person' : 'people'}</div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No team members yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Invite your first staff member above</div>
            </div>
          ) : members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < members.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: roleColors[m.role] || primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(m.full_name || m.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{m.full_name || m.email}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{m.email}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: roleColors[m.role] + '18' || '#f3f4f6', color: roleColors[m.role] || '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {m.role || 'staff'}
                </span>
              </div>
              {m.email !== session?.user?.email && (
                <button onClick={() => handleRemove(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e5e7eb', fontSize: 18, padding: '0 4px', transition: 'color 0.2s' }}
                  onMouseOver={e => e.target.style.color = '#C00'}
                  onMouseOut={e => e.target.style.color = '#e5e7eb'}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import PageHeader from '../shared/PageHeader'
import { supabase } from '../../lib/supabase'

const ROLES = ['admin', 'staff', 'volunteer']

function RoleToggle({ member, roleColors, primary, onChange, disabled, updating }) {
  const color = roleColors[member.role] || primary
  // Only staff/admin are toggleable here — volunteers keep a plain badge.
  if (!['staff', 'admin'].includes(member.role) || disabled) {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 99, background: color + '18', color, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {member.role || 'staff'}
      </span>
    )
  }
  return (
    <select
      value={member.role}
      disabled={updating}
      onChange={e => onChange(member, e.target.value)}
      title="Change role"
      style={{
        padding: '3px 8px 3px 10px', borderRadius: 99, background: color + '18', color, fontSize: 11, fontWeight: 900,
        textTransform: 'uppercase', letterSpacing: 0.5, border: `1.5px solid ${color}40`, cursor: updating ? 'default' : 'pointer',
        outline: 'none', opacity: updating ? 0.6 : 1, appearance: 'none', WebkitAppearance: 'none',
      }}>
      <option value="staff">Staff</option>
      <option value="admin">Admin</option>
    </select>
  )
}

export default function TeamTab({ org, session }) {
  const isMobile = useIsMobile()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [error, setError] = useState('')

  const loadMembers = React.useCallback(() => {
    if (!org?.id) return
    supabase.rpc('get_org_members_with_auth', { org_uuid: org.id }).then(({ data }) => {
      setMembers(data || [])
      setLoading(false)
    })
  }, [org?.id])

  useEffect(() => { loadMembers() }, [loadMembers])

  const handleInvite = async e => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    setInviteSuccess('')

    const email = inviteEmail.trim().toLowerCase()
    const fullName = `${inviteFirstName.trim()} ${inviteLastName.trim()}`.trim()

    const { data: existingMember } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .eq('org_id', org.id)
      .maybeSingle()

    if (existingMember) {
      setError('This person is already in your team.')
      setInviting(false)
      return
    }

    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ email, name: fullName, org_id: org.id, org_slug: org.slug, role: inviteRole }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setInviteSuccess(
        json.existing_user
          ? `${email} already had an account — added to ${org?.name} and notified by email.`
          : `Invite sent to ${email}. They'll get a branded email to set up their account.`
      )
      setInviteEmail('')
      setInviteFirstName('')
      setInviteLastName('')
      setInviteRole('staff')
      loadMembers()
    } catch (err) {
      setError(err.message || 'Failed to send invite')
    }
    setInviting(false)
  }

  const handleRemove = async (id) => {
    if (!window.confirm('Permanently remove this person? This cannot be undone.')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: id, org_id: org.id })
      })
      const json = await res.json()
      const error = json.error ? { message: json.error } : null
      if (error) throw error
    } catch (err) {
      alert('Failed to remove user: ' + err.message)
      return
    }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const primary = org?.primary_color || '#1B9AAA'
  const roleColors = { owner: '#111827', admin: '#8B5CF6', manager: '#F59E0B', staff: '#1B9AAA', volunteer: '#417505' }
  const admins = members.filter(m => ['owner', 'admin'].includes(m.role)).length
  const staff = members.filter(m => m.role === 'staff' || m.role === 'manager').length
  const volunteers = members.filter(m => m.role === 'volunteer').length
  const pendingMembers = members.filter(m => m.status === 'pending_invite')
  const activeMembers = members.filter(m => m.status !== 'pending_invite')
  const pendingInvites = pendingMembers.length

  const resendInvite = async (member) => {
    setError(''); setInviteSuccess('')
    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ email: member.email, name: member.full_name, org_id: org.id, org_slug: org.slug, role: member.role }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setInviteSuccess(`Invite re-sent to ${member.email}.`)
    } catch (err) {
      setError(err.message || 'Failed to resend invite')
    }
  }

  const [cancellingId, setCancellingId] = useState(null)
  const cancelInvite = async (member) => {
    if (!window.confirm(`Cancel the invite to ${member.email}? They'll no longer be able to use that invite link.`)) return
    setCancellingId(member.id)
    setError(''); setInviteSuccess('')
    const { error: deleteError } = await supabase.from('admin_invites').delete().eq('id', member.id)
    setCancellingId(null)
    if (deleteError) {
      setError(`Couldn't cancel the invite for ${member.email}: ${deleteError.message}`)
      return
    }
    setMembers(prev => prev.filter(m => m.id !== member.id))
    setInviteSuccess(`Invite to ${member.email} was cancelled.`)
  }

  const [updatingRoleId, setUpdatingRoleId] = useState(null)
  const updateMemberRole = async (member, newRole) => {
    if (newRole === member.role) return
    setUpdatingRoleId(member.id)
    setError('')
    setInviteSuccess('')
    const table = member.status === 'pending_invite' ? 'admin_invites' : 'user_profiles'
    const { error: updateError } = await supabase.from(table).update({ role: newRole }).eq('id', member.id)
    setUpdatingRoleId(null)
    if (updateError) {
      setError(`Couldn't update role for ${member.email}: ${updateError.message}`)
      return
    }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
    setInviteSuccess(`${member.full_name || member.email} is now ${newRole === 'admin' ? 'an admin' : 'a staff member'}.`)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        icon="👥"
        title="Team & Staff"
        orgName={org?.name}
        subtitle="Invite staff, manage volunteers and build your team"
        primary={primary}
        stats={[
          { label: 'Members', value: members.length, icon: '👥' },
          { label: 'Admins', value: admins, icon: '🛡️', color: '#8B5CF6' },
          { label: 'Staff', value: staff, icon: '💼', color: '#1B9AAA' },
          { label: 'Volunteers', value: volunteers, icon: '❤️', color: '#417505' },
          { label: 'Pending', value: pendingInvites, icon: '✉️', color: '#F59E0B' },
        ]}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* Invite card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24, borderTop: `3px solid ${primary}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>✉️</span>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Invite Staff</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Send a branded email invite — they'll set their own password and be added to {org?.name} automatically.</div>

          {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C00', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</div>}
          {inviteSuccess && <div style={{ background: '#F0FFF4', border: '1px solid #B0E8C0', color: '#1A5C1A', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>✓ {inviteSuccess}</div>}

          <form onSubmit={handleInvite}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1.5fr auto auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>First name</label>
                <input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} placeholder="First name"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last name</label>
                <input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} placeholder="Last name"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email address</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="staff@organisation.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
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


        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⏳</span>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Pending Invites</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{pendingInvites} pending</div>
          </div>

          {pendingMembers.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>✉️</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>No invites yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Invite staff and volunteers using the form above.</div>
            </div>
          ) : pendingMembers.map((member, index) => (
            <div key={member.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: index < pendingMembers.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: roleColors[member.role] || primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(member.full_name || member.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{member.full_name || member.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{member.email}</div>
              </div>
              <RoleToggle member={member} roleColors={roleColors} primary={primary} onChange={updateMemberRole} updating={updatingRoleId === member.id} />
              <span style={{ padding: '3px 10px', borderRadius: 99, background: '#FEF3C7', color: '#B45309', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                pending
              </span>
              <button onClick={() => resendInvite(member)} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Resend
              </button>
              <button onClick={() => cancelInvite(member)} disabled={cancellingId === member.id}
                title="Cancel invite"
                style={{ border: '1px solid #FCA5A5', background: 'var(--surface)', color: '#DC2626', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 800, cursor: cancellingId === member.id ? 'default' : 'pointer', opacity: cancellingId === member.id ? 0.6 : 1 }}>
                {cancellingId === member.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          ))}
        </div>

        {/* Team list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>👥</span>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Team Members</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{activeMembers.length} {activeMembers.length === 1 ? 'person' : 'people'}</div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
          ) : activeMembers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No team members yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Invite your first staff member above</div>
            </div>
          ) : activeMembers.map((m, i) => (
            <div key={m.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: i < activeMembers.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: roleColors[m.role] || primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(m.full_name || m.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{m.full_name || m.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m.email}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <RoleToggle member={m} roleColors={roleColors} primary={primary} onChange={updateMemberRole}
                  disabled={m.email === session?.user?.email} updating={updatingRoleId === m.id} />
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Joined {m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last seen {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'Never'}</div>
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
    </div>
  )
}



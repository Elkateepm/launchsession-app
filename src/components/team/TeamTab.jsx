import React, { useState, useEffect } from 'react'
import PageHeader from '../shared/PageHeader'
import { supabase } from '../../lib/supabase'

const ROLES = ['owner', 'admin', 'manager', 'staff', 'volunteer']

export default function TeamTab({ org, session }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [invites, setInvites] = useState([])
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [error, setError] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualRole, setManualRole] = useState('staff')
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    if (!org?.id) return
    Promise.all([
      supabase.rpc('get_org_members_with_auth', { org_uuid: org.id }),
      supabase.from('staff_invites').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    ]).then(([membersResult, invitesResult]) => {
      setMembers(membersResult.data || [])
      setInvites(invitesResult.data || [])
      setLoading(false)
    })
  }, [org?.id])

  const handleInvite = async e => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    setInviteSuccess('')

    const email = inviteEmail.trim().toLowerCase()

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

    const { data: existingInvite } = await supabase
      .from('staff_invites')
      .select('id')
      .eq('email', email)
      .eq('org_id', org.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      setError('This person already has a pending invite.')
      setInviting(false)
      return
    }

    const { data: newInvite, error: inviteError } = await supabase
      .from('staff_invites')
      .insert([{
        org_id: org.id,
        first_name: inviteFirstName.trim(),
        last_name: inviteLastName.trim(),
        email,
        role: inviteRole,
        status: 'pending',
        invited_by: session?.user?.id || null
      }])
      .select()
      .single()

    if (inviteError) {
      setError(inviteError.message)
      setInviting(false)
      return
    }

    setInvites(prev => [newInvite, ...prev])
    setInviteSuccess(`Invite created for ${email}. Copy their invite link below.`)
    setInviteEmail('')
    setInviteFirstName('')
    setInviteLastName('')
    setInviteRole('staff')
    setInviting(false)
  }

  const handleRemove = async (id) => {
    if (!window.confirm('Permanently remove this person? This cannot be undone.')) return
    try {
      const { supabaseAdmin } = await import('../../lib/supabase')
      const { error } = await supabaseAdmin.rpc('delete_user', { user_id: id })
      if (error) throw error
    } catch (err) {
      alert('Failed to remove user: ' + err.message)
      return
    }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const handleManualAdd = async e => {
    e.preventDefault()
    if (!manualEmail.trim()) return

    setManualSaving(true)
    setError('')
    setInviteSuccess('')

    const email = manualEmail.trim().toLowerCase()

    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .eq('org_id', org.id)
      .maybeSingle()

    if (existing) {
      setError('This person is already in your team.')
      setManualSaving(false)
      return
    }

    const { data, error: addError } = await supabase
      .rpc('manual_add_user_profile', {
        p_email: email,
        p_full_name: manualName.trim() || email.split('@')[0],
        p_role: manualRole,
        p_org_id: org.id
      })

    if (addError) {
      setError(addError.message)
      setManualSaving(false)
      return
    }

    setMembers(prev => [...prev, data])
    setManualEmail('')
    setManualName('')
    setManualRole('staff')
    setInviteSuccess(`${data.full_name || data.email} added to the team.`)
    setManualSaving(false)
  }

  const primary = org?.primary_color || '#1B9AAA'
  const roleColors = { owner: '#111827', admin: '#8B5CF6', manager: '#F59E0B', staff: '#1B9AAA', volunteer: '#417505' }
  const admins = members.filter(m => ['owner', 'admin'].includes(m.role)).length
  const staff = members.filter(m => m.role === 'staff' || m.role === 'manager').length
  const volunteers = members.filter(m => m.role === 'volunteer').length
  const pendingInvites = invites.filter(i => i.status === 'pending').length

  const inviteLink = (invite) => `${window.location.origin}/?org=${org?.slug || ''}&invite=${invite.invite_token}`

  const copyInvite = async (invite) => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite))
      setInviteSuccess('Invite link copied')
    } catch (err) {
      setError('Could not copy invite link')
    }
  }

  const cancelInvite = async (id) => {
    if (!window.confirm('Cancel this invite?')) return
    await supabase.from('staff_invites').update({ status: 'cancelled' }).eq('id', id).eq('org_id', org.id)
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' } : i))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        icon="👥"
        title="Team & Staff"
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Invite Staff</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Send a magic link invite — they'll be added to {org?.name} automatically.</div>

          {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C00', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</div>}
          {inviteSuccess && <div style={{ background: '#F0FFF4', border: '1px solid #B0E8C0', color: '#1A5C1A', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>✓ {inviteSuccess}</div>}

          <form onSubmit={handleInvite}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto auto', gap: 10, alignItems: 'flex-end' }}>
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
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pending Invites</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{pendingInvites} pending</div>
          </div>

          {invites.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>✉️</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>No invites yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Invite staff and volunteers using the form above.</div>
            </div>
          ) : invites.map((invite, index) => {
            const fullName = `${invite.first_name || ''} ${invite.last_name || ''}`.trim() || invite.email
            const active = invite.status === 'pending'
            return (
              <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: index < invites.length - 1 ? '1px solid #f3f4f6' : 'none', opacity: active ? 1 : 0.55 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: roleColors[invite.role] || primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {fullName[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{invite.email}</div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: (roleColors[invite.role] || primary) + '18', color: roleColors[invite.role] || primary, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  {invite.role || 'staff'}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: active ? '#FEF3C7' : '#F3F4F6', color: active ? '#B45309' : '#6b7280', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  {invite.status}
                </span>
                {active && (
                  <>
                    <button onClick={() => copyInvite(invite)} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      Copy Link
                    </button>
                    <button onClick={() => cancelInvite(invite.id)} style={{ border: '1px solid #FECACA', background: '#FFF7F7', color: '#DC2626', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>


        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Manual Add</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            Add someone directly to this organisation without sending an invite.
          </div>

          <form onSubmit={handleManualAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Full name</label>
                <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Full name"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email address</label>
                <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} required placeholder="staff@organisation.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</label>
                <select value={manualRole} onChange={e => setManualRole(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <button type="submit" disabled={manualSaving || !manualEmail.trim()}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontSize: 14, fontWeight: 800, cursor: manualSaving || !manualEmail.trim() ? 'default' : 'pointer', opacity: manualSaving || !manualEmail.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {manualSaving ? 'Adding...' : 'Add Manually'}
              </button>
            </div>
          </form>
        </div>

        {/* Team list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Team Members</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{members.length} {members.length === 1 ? 'person' : 'people'}</div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
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
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m.email}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: roleColors[m.role] + '18' || '#f3f4f6', color: roleColors[m.role] || '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {m.role || 'staff'}
                </span>
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



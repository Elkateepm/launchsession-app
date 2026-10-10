import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { INVITABLE, ROLE_NAMES, sendTeamInvite } from './teamJoin'

// Requests that came in through the join link. Approving one sends the
// ordinary email invite with the role picked here, so the person still has to
// own that inbox to get in; declining just closes it.
export default function JoinRequests({ org, requests, memberEmails, myRole, myId, primary, onChanged, onFlash }) {
  if (!requests.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
        {requests.length} {requests.length === 1 ? 'person wants' : 'people want'} to join
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>From your join link. Approving sends them an email invite.</div>
      {requests.map(r => (
        <JoinRequestRow key={r.id} org={org} request={r} onTeam={memberEmails.has(r.email.toLowerCase())}
          myRole={myRole} myId={myId} primary={primary} onChanged={onChanged} onFlash={onFlash} />
      ))}
    </div>
  )
}

function JoinRequestRow({ org, request, onTeam, myRole, myId, primary, onChanged, onFlash }) {
  const roles = INVITABLE[myRole] || []
  const [role, setRole] = useState(roles.includes('staff') ? 'staff' : roles[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = async (status) => {
    const { error: err } = await supabase.from('team_join_requests')
      .update({ status, decided_by: myId, decided_at: new Date().toISOString() })
      .eq('id', request.id)
    if (err) throw err
  }

  const approve = async () => {
    setBusy(true); setError(null)
    try {
      await sendTeamInvite({ org, email: request.email, name: request.full_name, role })
      await close('approved')
      onFlash(`Invite sent to ${request.full_name}`)
      onChanged()
    } catch (err) {
      setError(err.message || 'Could not send the invite.')
    }
    setBusy(false)
  }
  const decline = async () => {
    setBusy(true); setError(null)
    try { await close('declined'); onChanged() } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const btn = { minHeight: 40, padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ borderTop: '1px solid var(--border-soft, var(--border))', padding: '12px 0 4px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{request.full_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', overflowWrap: 'anywhere' }}>
            {[request.email, request.phone].filter(Boolean).join(' · ')}
          </div>
          {request.message && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.45 }}>“{request.message}”</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onTeam ? (
            // Approving would re-invite an existing member and reset their role.
            <>
              <span style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>Already on the team</span>
              <button onClick={decline} disabled={busy} style={{ ...btn, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }}>Dismiss</button>
            </>
          ) : (
            <>
              <select aria-label={`Role for ${request.full_name}`} value={role} onChange={e => setRole(e.target.value)} disabled={busy}
                style={{ minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
                {roles.map(r => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}
              </select>
              <button onClick={decline} disabled={busy} style={{ ...btn, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }}>Decline</button>
              <button onClick={approve} disabled={busy} style={{ ...btn, border: 'none', background: primary, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending…' : 'Approve'}</button>
            </>
          )}
        </div>
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger-text)', fontWeight: 700, marginTop: 6 }}>{error}</div>}
    </div>
  )
}

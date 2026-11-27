import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

// On a session's card: volunteers who asked to help from the volunteer
// portal, waiting for someone to say yes. Accept puts them on the session's
// team (session_staff), exactly as assigning them by hand does, so the same
// compliance check runs; Decline lets them know they are not needed.

const ago = iso => {
  const h = Math.round((Date.now() - new Date(iso)) / 3600000)
  if (!(h >= 0)) return ''
  if (h < 1) return 'just now'
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function readableAcceptError(error) {
  const m = error?.message || ''
  if (/COMPLIANCE_EXPIRED|VOLUNTEER_NOT_READY/.test(m)) return 'Their checks are not up to date, so they cannot go on the team yet. Update them in Volunteers first.'
  if (/duplicate key|already/i.test(m)) return 'They are already on the team.'
  if (/ORG_BILLING_LOCKED/.test(m)) return 'Your plan has ended, so changes cannot be saved.'
  return 'That did not save. Check your connection and try again.'
}

export default function VolunteerRequestStrip({ session, requests, names = {}, userId, onChanged, full = false }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  if (!requests?.length) return null

  const accept = async r => {
    setBusy(r.id); setError('')
    const { error: e1 } = await supabase.from('session_staff').insert({ session_id: session.id, user_id: r.user_id, org_id: session.org_id, role: 'volunteer' })
    if (e1 && !/duplicate key/i.test(e1.message || '')) { setBusy(''); setError(readableAcceptError(e1)); return }
    // The request has done its job. If this delete fails the volunteer is
    // still on the team, and the next load hides a request they already hold.
    await supabase.from('session_volunteer_requests').delete().eq('id', r.id)
    setBusy(''); onChanged?.()
  }
  const decline = async r => {
    setBusy(r.id); setError('')
    const { error: e } = await supabase.from('session_volunteer_requests')
      .update({ status: 'declined', decided_by: userId || null, decided_at: new Date().toISOString() }).eq('id', r.id)
    setBusy('')
    if (e) { setError(readableAcceptError(e)); return }
    onChanged?.()
  }

  const btn = { minHeight: 40, padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
  return (
    <section aria-label="Volunteers asking to help" style={{ border: '1px solid var(--warn-border)', background: 'var(--warn-bg)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--warn-text)', marginBottom: 8 }}>
        {requests.length === 1 ? '1 volunteer wants to help' : `${requests.length} volunteers want to help`}
        {full && <span style={{ fontWeight: 600 }}> · volunteer places are full</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {requests.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--org-solid)', color: 'var(--org-on-solid)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {(names[r.user_id] || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <span style={{ flex: '1 1 140px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[r.user_id] || 'A volunteer'}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)' }}>Asked {ago(r.created_at)}</span>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => accept(r)} disabled={!!busy} aria-label={`Accept ${names[r.user_id] || 'volunteer'}`}
                style={{ ...btn, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', opacity: busy ? 0.6 : 1 }}>{busy === r.id ? 'Saving…' : 'Accept'}</button>
              <button type="button" onClick={() => decline(r)} disabled={!!busy} aria-label={`Decline ${names[r.user_id] || 'volunteer'}`}
                style={{ ...btn, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', opacity: busy ? 0.6 : 1 }}>Decline</button>
            </span>
          </div>
        ))}
      </div>
      {error && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--danger-text)' }}>{error}</div>}
    </section>
  )
}

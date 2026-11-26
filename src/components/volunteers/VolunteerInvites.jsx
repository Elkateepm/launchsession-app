import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Avatar } from './vh_shared'

// Volunteers who have been invited but have not set a password yet, with
// Resend and Cancel. Before this, an invite vanished into the applicants list
// and there was no way to send it again.

async function callInviteApi(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/invite-volunteer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error || 'Something went wrong. Try again.')
  return json
}

export const resendVolunteerInvite = (org, v) =>
  callInviteApi({ email: v.email, name: v.full_name, org_id: org.id, org_slug: org.slug, role: 'volunteer' })

export const cancelVolunteerInvite = (org, v) =>
  callInviteApi({ action: 'cancel_volunteer_invite', org_id: org.id, user_id: v.id })

const sentOn = v => {
  const d = v.created_at && new Date(v.created_at)
  return d && !isNaN(d) ? `Invited ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}` : 'Invited'
}

export default function VolunteerInvites({ org, invited, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState(null)
  if (!invited.length) return null

  const run = async (v, kind) => {
    if (kind === 'cancel' && !window.confirm(`Cancel ${v.full_name || v.email}'s invite? The link in their email will stop working.`)) return
    setBusy(`${kind}-${v.id}`); setNote(null)
    try {
      if (kind === 'resend') await resendVolunteerInvite(org, v)
      else await cancelVolunteerInvite(org, v)
      setNote({ ok: true, text: kind === 'resend' ? `Sent again to ${v.email}.` : `Invite to ${v.email} cancelled.` })
      if (kind === 'cancel') onChanged?.()
    } catch (err) {
      setNote({ ok: false, text: err.message })
    }
    setBusy(null)
  }

  const btn = { minHeight: 40, padding: '0 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }

  return (
    <Card>
      <SectionTitle icon="✉️" title="Invited, not joined yet" subtitle="They join once they open the email and choose a password." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {invited.map(v => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Avatar name={v.full_name || v.email} size={32} />
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.full_name || v.email}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sentOn(v)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => run(v, 'resend')} disabled={!!busy}
                style={{ ...btn, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', opacity: busy ? 0.6 : 1 }}>
                {busy === `resend-${v.id}` ? 'Sending…' : 'Resend'}
              </button>
              <button type="button" onClick={() => run(v, 'cancel')} disabled={!!busy}
                style={{ ...btn, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', opacity: busy ? 0.6 : 1 }}>
                {busy === `cancel-${v.id}` ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {note && (
        <div role="status" style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, borderRadius: 10, padding: '8px 12px',
          color: note.ok ? 'var(--ok-text)' : 'var(--danger-text)', background: note.ok ? 'var(--ok-bg)' : 'var(--danger-bg)' }}>{note.text}</div>
      )}
    </Card>
  )
}

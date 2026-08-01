import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Add volunteers to a specific session, straight from the live session card.
// Lists every volunteer in the org, lets staff pick who's joining this
// session, writes the session_staff rows directly (same table/RLS the rest
// of the app already uses for staffing), then optionally fires a push
// notification (STAFF_ADDED_TO_SESSION) and a branded email
// (send-volunteer-broadcast) to just the people who were added.
export default function AddVolunteersToSessionModal({ session, orgId, primary, secondary, alreadyAssignedIds, isMobile, onClose, onDone }) {
  const [loading, setLoading] = useState(true)
  const [volunteers, setVolunteers] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendPush, setSendPush] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const alreadyIn = new Set(alreadyAssignedIds || [])

  useEffect(() => {
    let alive = true
    supabase.from('user_profiles')
      .select('id, full_name, first_name, email, photo_url, status')
      .eq('org_id', orgId).eq('role', 'volunteer').order('full_name')
      .then(({ data }) => { if (alive) { setVolunteers(data || []); setLoading(false) } })
    return () => { alive = false }
  }, [orgId])

  const toggle = (id) => {
    if (alreadyIn.has(id)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const q = search.trim().toLowerCase()
  const filtered = volunteers.filter(v => !q || (v.full_name || '').toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q))

  const dateLabel = session.session_date ? new Date(`${session.session_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const timeLabel = session.start_time ? ` at ${session.start_time.slice(0, 5)}` : ''

  const handleInvite = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const rows = ids.map(vid => ({ org_id: orgId, session_id: session.id, volunteer_id: vid, role: 'volunteer' }))
      const { error: insertErr } = await supabase.from('session_staff').insert(rows)
      if (insertErr) throw insertErr

      const { data: { session: authSession } } = await supabase.auth.getSession()
      const accessToken = authSession?.access_token

      if (sendPush && accessToken) {
        fetch('/api/send-form-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ type: 'push', event_type: 'STAFF_ADDED_TO_SESSION', target_user_ids: ids, session_id: session.id }),
        }).catch(() => {})
      }

      if (sendEmail && accessToken) {
        fetch('/api/send-volunteer-broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            org_id: orgId,
            channel: 'email',
            subject: `You've been added to ${session.title}`,
            body_html: `<p>Hi {{FirstName}},</p><p>You've been added as a volunteer for <strong>${session.title}</strong>${dateLabel ? ` on ${dateLabel}${timeLabel}` : ''}.</p><p>See you there!</p>`,
            audience: { volunteer_ids: ids },
            audience_label: `${session.title} volunteers`,
          }),
        }).catch(() => {})
      }

      setDone(true)
      setTimeout(() => { onDone && onDone() }, 900)
    } catch (e) {
      setError(e.message || 'Could not add those volunteers — please try again.')
      setSubmitting(false)
    }
  }

  const toggleRow = (checked, onChange, label, hint) => (
    <button onClick={() => onChange(!checked)} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
      padding: '10px 12px', cursor: 'pointer',
    }}>
      <span style={{
        width: 36, height: 20, borderRadius: 99, flexShrink: 0, position: 'relative',
        background: checked ? `linear-gradient(90deg, ${primary}, ${secondary})` : 'rgba(255,255,255,0.14)',
        transition: 'background 0.15s ease',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s ease',
        }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{hint}</div>
      </span>
    </button>
  )

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100, display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      background: 'rgba(5,7,15,0.68)', backdropFilter: 'blur(3px)', padding: isMobile ? 0 : 20, boxSizing: 'border-box',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: isMobile ? 'none' : 460, maxHeight: isMobile ? '86vh' : '82vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: isMobile ? '20px 20px 0 0' : 22,
        background: 'linear-gradient(160deg, #0C1226 0%, #141D3B 60%, #0F1729 100%)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Add volunteers</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}{dateLabel ? ` · ${dateLabel}${timeLabel}` : ''}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>✕</button>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search volunteers…"
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '9px 12px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px' }}>
          {loading ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading volunteers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {volunteers.length === 0 ? "No volunteers in your org yet — invite some from the Volunteers tab first." : 'No volunteers match that search.'}
            </div>
          ) : filtered.map(v => {
            const isIn = alreadyIn.has(v.id)
            const isChecked = isIn || selected.has(v.id)
            return (
              <button key={v.id} onClick={() => toggle(v.id)} disabled={isIn} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                background: isChecked ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', borderRadius: 12,
                padding: '9px 8px', cursor: isIn ? 'default' : 'pointer', marginBottom: 2,
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 900, color: '#fff',
                }}>{getInitials(v.full_name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.full_name || 'Unnamed volunteer'}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</div>
                </span>
                {isIn ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>Added</span>
                ) : (
                  <span style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${isChecked ? secondary : 'rgba(255,255,255,0.25)'}`,
                    background: isChecked ? secondary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: '#0B1023',
                  }}>{isChecked ? '✓' : ''}</span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toggleRow(sendEmail, setSendEmail, 'Send email', 'Branded invite email to each person added')}
          {toggleRow(sendPush, setSendPush, 'Send push notification', "Instant alert, if they've enabled push")}

          {error && <div style={{ fontSize: 12, fontWeight: 700, color: '#FCA5A5' }}>{error}</div>}
          {done && <div style={{ fontSize: 12, fontWeight: 700, color: '#86EFAC' }}>✓ Added — closing…</div>}

          <button
            onClick={handleInvite}
            disabled={selected.size === 0 || submitting || done}
            style={{
              marginTop: 4, width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              background: selected.size === 0 ? 'rgba(255,255,255,0.1)' : `linear-gradient(90deg, ${primary}, ${secondary})`,
              color: '#fff', fontSize: 13.5, fontWeight: 900, cursor: selected.size === 0 || submitting || done ? 'default' : 'pointer',
              opacity: submitting || done ? 0.75 : 1,
            }}>
            {submitting ? 'Adding…' : done ? 'Added' : selected.size === 0 ? 'Select volunteers to add' : `Add ${selected.size} volunteer${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

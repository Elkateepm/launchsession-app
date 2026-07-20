import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDate, fmtTime, findConflict, suggestNextSlot } from '../../lib/resourceHelpers'
import ResourceEmptyState from './ResourceEmptyState'

export default function BookingRequests({ org, bookings, resources, sessions, staff, authUserId, onChanged }) {
  const [messagingId, setMessagingId] = useState(null)

  const requests = bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const handleApprove = async (b) => {
    const conflict = findConflict(bookings, b.resource_id, b.start_time, b.end_time, b.id)
    if (conflict) { window.alert('This would conflict with another confirmed booking — decline or suggest a different time instead.'); return }
    await supabase.from('resource_bookings').update({ status: 'confirmed', approved_by: authUserId, approved_at: new Date().toISOString() }).eq('id', b.id)
    onChanged()
  }

  const handleDecline = async (b) => {
    if (!window.confirm('Decline this booking request?')) return
    await supabase.from('resource_bookings').update({ status: 'declined', approved_by: authUserId, approved_at: new Date().toISOString() }).eq('id', b.id)
    onChanged()
  }

  const handleSuggestTime = async (b) => {
    const durationMs = new Date(b.end_time) - new Date(b.start_time)
    const suggestion = suggestNextSlot(bookings, b.resource_id, durationMs, b.start_time)
    if (!window.confirm(`Suggest ${suggestion.toLocaleString('en-GB')} instead? This will mark the request as "changes requested".`)) return
    await supabase.from('resource_bookings').update({ status: 'changes_requested', notes: `${b.notes || ''}\n[Suggested alternative: ${suggestion.toLocaleString('en-GB')}]`.trim() }).eq('id', b.id)
    onChanged()
  }

  if (requests.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
        <ResourceEmptyState icon="✅" title="No pending requests" description="Bookings for resources that require approval will show up here." />
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 14 }}>Booking Requests <span style={{ fontWeight: 500, color: '#9CA3AF', fontSize: 12 }}>({requests.length} pending)</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map(b => {
          const resource = resources.find(r => r.id === b.resource_id)
          const session = sessions.find(s => s.id === b.session_id)
          const requester = staff.find(s => s.id === b.requested_by)
          const conflict = findConflict(bookings, b.resource_id, b.start_time, b.end_time, b.id)
          return (
            <div key={b.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{resource?.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {fmtDate(b.start_time)} · {fmtTime(b.start_time)}–{fmtTime(b.end_time)}
                    {session && ` · ${session.title}`}
                  </div>
                  {requester && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>Requested by {requester.full_name}</div>}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#D97706', background: '#FFFBEB', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>Pending</span>
              </div>
              {b.purpose && <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 8 }}>{b.purpose}</div>}
              {conflict && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: '#B91C1C', fontWeight: 700, marginBottom: 10 }}>
                  ⚠ Conflicts with another confirmed booking
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => handleApprove(b)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                <button onClick={() => handleDecline(b)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                <button onClick={() => handleSuggestTime(b)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Suggest Different Time</button>
                <button onClick={() => setMessagingId(messagingId === b.id ? null : b.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Message Requester</button>
              </div>
              {messagingId === b.id && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: '#6B7280' }}>
                  Use Messaging to reach {requester?.full_name || 'the requester'} directly about this booking.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

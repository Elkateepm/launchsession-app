import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDate, fmtTime, BOOKING_STATUS_CONFIG } from '../../lib/resourceHelpers'
import ResourceEmptyState from './ResourceEmptyState'

export default function UpcomingBookings({ bookings, resources, sessions, staff, onChanged, onViewCalendar, onViewAll }) {
  const [menuOpenId, setMenuOpenId] = useState(null)

  const upcoming = bookings
    .filter(b => new Date(b.end_time) >= new Date() && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 8)

  const handleAction = async (action, booking) => {
    setMenuOpenId(null)
    if (action === 'Cancel') {
      if (!window.confirm('Cancel this booking?')) return
      await supabase.from('resource_bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    } else if (action === 'Duplicate') {
      const { id, created_at, updated_at, ...rest } = booking
      await supabase.from('resource_bookings').insert(rest)
    } else if (action === 'Check Out') {
      await supabase.from('resource_checkouts').insert({
        org_id: booking.org_id, resource_id: booking.resource_id, booking_id: booking.id,
        checked_out_to: booking.assigned_to, quantity: booking.quantity,
        expected_return_at: booking.end_time,
      })
    } else if (action === 'Mark Returned') {
      const { data: co } = await supabase.from('resource_checkouts').select('id').eq('booking_id', booking.id).eq('status', 'checked_out').limit(1).single()
      if (co) await supabase.from('resource_checkouts').update({ status: 'returned', returned_at: new Date().toISOString() }).eq('id', co.id)
    }
    onChanged()
  }

  if (upcoming.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
        <ResourceEmptyState icon="📅" title="No upcoming bookings" description="Book a resource above and it'll show up here." />
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Upcoming Bookings <span style={{ fontWeight: 500, color: '#9CA3AF', fontSize: 12 }}>(This Week)</span></div>
        <button onClick={onViewCalendar} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>📅 View calendar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming.map(b => {
          const resource = resources.find(r => r.id === b.resource_id)
          const session = sessions.find(s => s.id === b.session_id)
          const assigned = staff.find(s => s.id === b.assigned_to)
          const bs = BOOKING_STATUS_CONFIG[b.status] || BOOKING_STATUS_CONFIG.confirmed
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', flexWrap: 'wrap' }}>
              <div style={{ width: 64, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{fmtDate(b.start_time).split(' ')[0]}</div>
                <div style={{ fontSize: 10.5, color: '#6B7280' }}>{fmtDate(b.start_time).split(' ').slice(1).join(' ')}</div>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{resource?.name || 'Unknown resource'}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{session?.title || b.purpose || '—'}{assigned ? ` · ${assigned.full_name}` : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, flexShrink: 0 }}>{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: bs.color, background: bs.bg, borderRadius: 99, padding: '3px 9px', flexShrink: 0 }}>{bs.label}</span>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setMenuOpenId(menuOpenId === b.id ? null : b.id)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#9CA3AF', cursor: 'pointer' }}>⋯</button>
                {menuOpenId === b.id && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 20, minWidth: 150 }}>
                    {['Edit', 'Duplicate', 'Check Out', 'Mark Returned', 'Cancel'].map(a => (
                      <button key={a} onClick={() => handleAction(a, b)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 600, color: a === 'Cancel' ? '#DC2626' : '#374151', cursor: 'pointer' }}>{a}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onViewAll} style={{ width: '100%', marginTop: 14, background: 'none', border: 'none', color: '#7C3AED', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View all bookings →</button>
    </div>
  )
}

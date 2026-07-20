import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { categoryMeta, statusMeta, fmtDate, fmtTime, BOOKING_STATUS_CONFIG } from '../../lib/resourceHelpers'

export default function ResourceDetailsDrawer({ resource, staff, org, onClose, onBook, onEdit, onChanged }) {
  const [bookingHistory, setBookingHistory] = useState([])
  const [checkoutHistory, setCheckoutHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: bookings }, { data: checkouts }] = await Promise.all([
        supabase.from('resource_bookings').select('*').eq('resource_id', resource.id).order('start_time', { ascending: false }).limit(20),
        supabase.from('resource_checkouts').select('*').eq('resource_id', resource.id).order('checked_out_at', { ascending: false }).limit(20),
      ])
      if (cancelled) return
      setBookingHistory(bookings || [])
      setCheckoutHistory(checkouts || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [resource.id])

  const cat = categoryMeta(resource.category)
  const st = statusMeta(resource.status)
  const responsible = staff.find(s => s.id === resource.responsible_user_id)
  const upcoming = bookingHistory.filter(b => new Date(b.start_time) > new Date() && ['pending', 'confirmed'].includes(b.status))
  const past = bookingHistory.filter(b => !(new Date(b.start_time) > new Date() && ['pending', 'confirmed'].includes(b.status)))

  const handleMarkUnavailable = async () => {
    await supabase.from('resources').update({ status: resource.status === 'unavailable' ? 'available' : 'unavailable' }).eq('id', resource.id)
    onChanged()
  }

  const handleDelete = async () => {
    await supabase.from('resources').update({ archived_at: new Date().toISOString() }).eq('id', resource.id)
    onChanged()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 460, maxWidth: '100%', height: '100%', background: '#fff', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
        </div>

        <div style={{ width: '100%', height: 120, borderRadius: 14, background: resource.image_url ? `url(${resource.image_url}) center/cover` : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 16 }}>
          {!resource.image_url && cat.icon}
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{resource.name}</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 10 }}>{cat.icon} {cat.label}{resource.location ? ` · 📍 ${resource.location}` : ''}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 99, padding: '4px 11px', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>{st.icon} {st.label}</span>

        {resource.description && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 16 }}>{resource.description}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {resource.capacity && <Stat label="Capacity" value={resource.capacity} />}
          <Stat label="Total quantity" value={resource.quantity_total} />
          <Stat label="Available" value={resource.quantity_available} />
          {responsible && <Stat label="Responsible" value={responsible.full_name} />}
          {resource.reference_number && <Stat label="Reference" value={resource.reference_number} />}
          {resource.booking_limit_minutes && <Stat label="Booking limit" value={`${resource.booking_limit_minutes} min`} />}
        </div>

        {resource.notes && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', marginBottom: 4 }}>Maintenance / notes</div>
            <div style={{ fontSize: 12.5, color: '#78350F' }}>{resource.notes}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          <button onClick={() => onBook(resource)} style={{ flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Book Resource</button>
          <button onClick={() => onEdit(resource)} style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
          <button onClick={handleMarkUnavailable} style={{ flex: 1, minWidth: 130, padding: '10px 14px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {resource.status === 'unavailable' ? 'Mark Available' : 'Mark Unavailable'}
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Upcoming bookings ({upcoming.length})</div>
        {loading ? <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div> : upcoming.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>Nothing scheduled.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {upcoming.map(b => (
              <div key={b.id} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <span style={{ fontWeight: 700 }}>{fmtDate(b.start_time)}</span> · {fmtTime(b.start_time)}–{fmtTime(b.end_time)}
                <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: BOOKING_STATUS_CONFIG[b.status]?.color }}>{BOOKING_STATUS_CONFIG[b.status]?.label}</span>
              </div>
            ))}
          </div>
        )}

        {checkoutHistory.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Check-out history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {checkoutHistory.slice(0, 5).map(c => (
                <div key={c.id} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                  {fmtDate(c.checked_out_at)} · qty {c.quantity} · {c.status}
                </div>
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Past bookings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {past.slice(0, 5).map(b => (
                <div key={b.id} style={{ fontSize: 12, color: '#6B7280' }}>{fmtDate(b.start_time)} · {fmtTime(b.start_time)}–{fmtTime(b.end_time)}</div>
              ))}
            </div>
          </>
        )}

        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDelete} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Confirm Delete</button>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '10px', borderRadius: 9, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Delete Resource</button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  )
}

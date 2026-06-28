import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, isSameDay, startOfWeek, addDays, isToday } from 'date-fns'

const RESOURCE_TYPES = [
  { key: 'room',       label: 'Room',          icon: '🚪' },
  { key: 'minibus',    label: 'Minibus',        icon: '🚌' },
  { key: 'hall',       label: 'Sports Hall',    icon: '🏟️' },
  { key: 'equipment',  label: 'Equipment',      icon: '⚽' },
  { key: 'laptop',     label: 'Laptop/Device',  icon: '💻' },
  { key: 'camera',     label: 'Camera/AV',      icon: '📷' },
  { key: 'other',      label: 'Other',          icon: '📦' },
]

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4']

function WeekView({ date, bookings, resources, org, onBook, onDelete }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am–9pm
  const primary = org?.primary_color || '#1B9AAA'

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        {/* Day header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', gap: 1, marginBottom: 4 }}>
          <div />
          {days.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: isToday(d) ? primary + '15' : 'transparent' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{format(d, 'EEE')}</div>
              <div style={{ fontSize: 16, fontWeight: isToday(d) ? 900 : 700, color: isToday(d) ? primary : '#111' }}>{format(d, 'd')}</div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        {HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', gap: 1, minHeight: 44, alignItems: 'stretch' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', paddingTop: 4, textAlign: 'right', paddingRight: 8, fontWeight: 600 }}>{hour}:00</div>
            {days.map(day => {
              const dayBookings = bookings.filter(b => b.date && isSameDay(parseISO(b.date), day) && b.start_time && parseInt(b.start_time) === hour)
              return (
                <div key={day} onClick={() => onBook(day, hour)} style={{ background: '#F9FAFB', borderRadius: 4, cursor: 'pointer', position: 'relative', minHeight: 44, border: '1px solid #F3F4F6', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = primary + '08'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}>
                  {dayBookings.map(b => {
                    const resource = resources.find(r => r.id === b.resource_id)
                    const colorIndex = resources.indexOf(resource) % COLORS.length
                    return (
                      <div key={b.id} onClick={e => { e.stopPropagation(); onDelete(b) }} title={`${b.purpose || 'Booking'} — click to remove`}
                        style={{ position: 'absolute', inset: 2, background: COLORS[colorIndex] + '20', border: `1.5px solid ${COLORS[colorIndex]}`, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontWeight: 700, color: COLORS[colorIndex], overflow: 'hidden', cursor: 'pointer' }}>
                        {resource?.icon} {b.purpose || resource?.name}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResourceBooking({ org, session: authSession }) {
  const [resources, setResources] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showAddResource, setShowAddResource] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [bookingForm, setBookingForm] = useState({ resource_id: '', date: '', start_time: '09', end_time: '10', purpose: '' })
  const [newResource, setNewResource] = useState({ name: '', type: 'room', description: '', capacity: '', icon: '🚪' })
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('week') // 'week' | 'list'
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 6)
    const [{ data: res }, { data: book }] = await Promise.all([
      supabase.from('resources').select('*').eq('org_id', org.id).order('name'),
      supabase.from('resource_bookings').select('*').eq('org_id', org.id).gte('date', weekStart.toISOString().slice(0,10)).lte('date', weekEnd.toISOString().slice(0,10)),
    ])
    setResources(res || [])
    setBookings(book || [])
    setLoading(false)
  }, [org.id, currentWeek])

  useEffect(() => { load() }, [load])

  const addResource = async () => {
    if (!newResource.name) return
    setSaving(true)
    const icon = RESOURCE_TYPES.find(t => t.key === newResource.type)?.icon || '📦'
    const { data } = await supabase.from('resources').insert({ ...newResource, icon, org_id: org.id }).select().single()
    setSaving(false)
    if (data) { setResources(r => [...r, data]); setShowAddResource(false); setNewResource({ name: '', type: 'room', description: '', capacity: '', icon: '🚪' }) }
  }

  const createBooking = async () => {
    if (!bookingForm.resource_id || !bookingForm.date) return
    setSaving(true)
    const { data } = await supabase.from('resource_bookings').insert({ ...bookingForm, org_id: org.id, booked_by: authSession?.user?.id, start_time: `${bookingForm.start_time}:00`, end_time: `${bookingForm.end_time}:00` }).select().single()
    setSaving(false)
    if (data) { setBookings(b => [...b, data]); setShowBook(false); setBookingForm({ resource_id: '', date: '', start_time: '09', end_time: '10', purpose: '' }) }
  }

  const deleteBooking = async (booking) => {
    if (!window.confirm('Remove this booking?')) return
    await supabase.from('resource_bookings').delete().eq('id', booking.id)
    setBookings(b => b.filter(x => x.id !== booking.id))
  }

  const openBookForm = (day, hour) => {
    setBookingForm(f => ({ ...f, date: format(day, 'yyyy-MM-dd'), start_time: String(hour).padStart(2, '0'), end_time: String(hour + 1).padStart(2, '0'), resource_id: resources[0]?.id || '' }))
    setShowBook(true)
  }

  const totalBookingsThisWeek = bookings.length
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>🗓️ Resource Booking</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{resources.length} resource{resources.length !== 1 ? 's' : ''} · {totalBookingsThisWeek} booking{totalBookingsThisWeek !== 1 ? 's' : ''} this week</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAddResource(true)} style={{ padding: '10px 18px', borderRadius: 12, border: `1.5px solid ${primary}`, background: '#fff', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Resource</button>
            <button onClick={() => setShowBook(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Book</button>
          </div>
        </div>
        {/* Resource legend */}
        {resources.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resources.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1.5px solid ${COLORS[i % COLORS.length]}40`, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                {r.icon} {r.name}
                {r.capacity && <span style={{ color: '#9CA3AF', fontWeight: 500 }}>({r.capacity})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add resource */}
      {showAddResource && (
        <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 16, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📦 Add Resource</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>NAME *</label><input value={newResource.name} onChange={e => setNewResource(n => ({ ...n, name: e.target.value }))} placeholder="e.g. Main Hall, Blue Minibus" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TYPE</label>
              <select value={newResource.type} onChange={e => setNewResource(n => ({ ...n, type: e.target.value }))} style={inp}>
                {RESOURCE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CAPACITY</label><input type="number" value={newResource.capacity} onChange={e => setNewResource(n => ({ ...n, capacity: e.target.value }))} placeholder="e.g. 30" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DESCRIPTION</label><input value={newResource.description} onChange={e => setNewResource(n => ({ ...n, description: e.target.value }))} placeholder="Optional notes..." style={inp} /></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button onClick={addResource} disabled={saving || !newResource.name} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving || !newResource.name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Adding...' : '+ Add Resource'}</button>
            <button onClick={() => setShowAddResource(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Book modal */}
      {showBook && (
        <div onClick={() => setShowBook(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>📅 Make a Booking</div>
              <button onClick={() => setShowBook(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>RESOURCE</label>
                <select value={bookingForm.resource_id} onChange={e => setBookingForm(f => ({ ...f, resource_id: e.target.value }))} style={inp}>
                  <option value="">Select a resource...</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DATE</label><input type="date" value={bookingForm.date} onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))} style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>START</label>
                  <select value={bookingForm.start_time} onChange={e => setBookingForm(f => ({ ...f, start_time: e.target.value }))} style={inp}>
                    {Array.from({ length: 14 }, (_, i) => i + 8).map(h => <option key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>END</label>
                  <select value={bookingForm.end_time} onChange={e => setBookingForm(f => ({ ...f, end_time: e.target.value }))} style={inp}>
                    {Array.from({ length: 14 }, (_, i) => i + 9).map(h => <option key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
              </div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>PURPOSE</label><input value={bookingForm.purpose} onChange={e => setBookingForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. U14 Football Training" style={inp} /></div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button onClick={createBooking} disabled={saving || !bookingForm.resource_id || !bookingForm.date} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: saving || !bookingForm.resource_id || !bookingForm.date ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Booking...' : '✓ Confirm Booking'}
              </button>
              <button onClick={() => setShowBook(false)} style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setCurrentWeek(d => addDays(d, -7))} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>← Prev</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>
          {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMM')} – {format(addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), 6), 'd MMM yyyy')}
        </div>
        <button onClick={() => setCurrentWeek(new Date())} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${primary}`, background: primary + '10', color: primary, fontWeight: 700, cursor: 'pointer' }}>Today</button>
        <button onClick={() => setCurrentWeek(d => addDays(d, 7))} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Next →</button>
      </div>

      {resources.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗓️</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No resources yet</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Add rooms, vehicles, equipment and more to start booking</div>
          <button onClick={() => setShowAddResource(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add First Resource</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading schedule...</div>
      ) : (
        <WeekView date={currentWeek} bookings={bookings} resources={resources} org={org} onBook={openBookForm} onDelete={deleteBooking} />
      )}
    </div>
  )
}

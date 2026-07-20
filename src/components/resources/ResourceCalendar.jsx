import React, { useState, useMemo } from 'react'
import { categoryMeta, fmtTime, BOOKING_STATUS_CONFIG, CATEGORIES } from '../../lib/resourceHelpers'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am - 8pm

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export default function ResourceCalendar({ resources, bookings, onSlotClick, onBookingClick }) {
  const [view, setView] = useState('week')
  const [cursor, setCursor] = useState(new Date())
  const [filterResource, setFilterResource] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false
      if (filterResource !== 'all' && b.resource_id !== filterResource) return false
      if (filterCategory !== 'all') {
        const r = resources.find(x => x.id === b.resource_id)
        if (!r || r.category !== filterCategory) return false
      }
      return true
    })
  }, [bookings, filterResource, filterCategory, resources])

  const weekStart = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })

  const bookingsForDay = (day) => filteredBookings.filter(b => new Date(b.start_time).toDateString() === day.toDateString())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const navigate = (dir) => {
    const d = new Date(cursor)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCursor(d)
  }

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = startOfWeek(first)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  }, [cursor])

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['day', 'week', 'month', 'agenda'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: view === v ? '#7C3AED' : '#F1F5F9', color: view === v ? '#fff' : '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={navBtn}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', minWidth: 140, textAlign: 'center' }}>
            {view === 'month' ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          </div>
          <button onClick={() => navigate(1)} style={navBtn}>›</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filterResource} onChange={e => setFilterResource(e.target.value)} style={selStyle}>
            <option value="all">All resources</option>
            {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selStyle}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
        </div>
      </div>

      {view === 'agenda' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredBookings.filter(b => new Date(b.end_time) >= new Date()).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).slice(0, 30).map(b => {
            const r = resources.find(x => x.id === b.resource_id)
            const bs = BOOKING_STATUS_CONFIG[b.status]
            return (
              <div key={b.id} onClick={() => onBookingClick(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 700, width: 100 }}>{new Date(b.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{categoryMeta(r?.category).icon} {r?.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: bs?.color, background: bs?.bg, borderRadius: 99, padding: '3px 9px' }}>{bs?.label}</span>
              </div>
            )
          })}
          {filteredBookings.filter(b => new Date(b.end_time) >= new Date()).length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontSize: 13 }}>No upcoming bookings match these filters.</div>}
        </div>
      )}

      {(view === 'day' || view === 'week') && (
        <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(${view === 'day' ? 1 : 7}, 1fr)`, gap: 2, overflowX: 'auto' }}>
          <div />
          {(view === 'day' ? [cursor] : days).map(d => (
            <div key={d.toDateString()} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#374151', padding: '6px 0', borderBottom: '2px solid #E5E7EB' }}>
              {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
            </div>
          ))}
          {HOURS.map(h => (
            <React.Fragment key={h}>
              <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', paddingRight: 6, paddingTop: 2 }}>{h}:00</div>
              {(view === 'day' ? [cursor] : days).map(d => {
                const dayBookings = bookingsForDay(d).filter(b => new Date(b.start_time).getHours() === h)
                return (
                  <div key={d.toDateString() + h} onClick={() => onSlotClick(d, h)} style={{ minHeight: 34, border: '1px solid #F1F5F9', borderRadius: 4, cursor: 'pointer', padding: 2, position: 'relative' }}>
                    {dayBookings.map(b => {
                      const r = resources.find(x => x.id === b.resource_id)
                      const bs = BOOKING_STATUS_CONFIG[b.status]
                      return (
                        <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} title={`${r?.name} · ${fmtTime(b.start_time)}-${fmtTime(b.end_time)}`}
                          style={{ fontSize: 9.5, fontWeight: 700, color: bs?.color, background: bs?.bg, borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                          {categoryMeta(r?.category).icon} {r?.name}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      )}

      {view === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textAlign: 'center', padding: 4 }}>{d}</div>)}
          {monthDays.map(d => {
            const dayBookings = bookingsForDay(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            return (
              <div key={d.toISOString()} onClick={() => onSlotClick(d, 9)} style={{ minHeight: 64, border: '1px solid #F1F5F9', borderRadius: 8, padding: 6, cursor: 'pointer', opacity: inMonth ? 1 : 0.35, background: d.toDateString() === new Date().toDateString() ? '#F5F3FF' : '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 3 }}>{d.getDate()}</div>
                {dayBookings.slice(0, 2).map(b => {
                  const r = resources.find(x => x.id === b.resource_id)
                  return <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} style={{ fontSize: 9, background: '#EEF2FF', color: '#4338CA', borderRadius: 3, padding: '1px 4px', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r?.name}</div>
                })}
                {dayBookings.length > 2 && <div style={{ fontSize: 9, color: '#9CA3AF' }}>+{dayBookings.length - 2} more</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const navBtn = { width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 15, color: '#374151' }
const selStyle = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12, background: '#fff', color: '#374151' }

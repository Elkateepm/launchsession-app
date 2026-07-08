import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { activityTheme } from './vp_shared'

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'completed', label: 'Completed' },
]

export default function VPSessions({ sessions, myBookings, todayStr, onOpenSession, onBook, saving, primary }) {
  const [filter, setFilter] = useState('upcoming')

  const filtered = sessions.filter(s => {
    if (filter === 'today') return s.session_date === todayStr
    if (filter === 'completed') return s.session_date < todayStr
    return s.session_date >= todayStr
  }).sort((a, b) => (a.session_date + (a.start_time || '')).localeCompare(b.session_date + (b.start_time || '')))

  const grouped = []
  let lastDate = null
  filtered.forEach(s => {
    if (s.session_date !== lastDate) { grouped.push({ date: s.session_date, items: [] }); lastDate = s.session_date }
    grouped[grouped.length - 1].items.push(s)
  })

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Sessions</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16 }}>Your upcoming and past sessions</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '8px 16px', borderRadius: 99, border: 'none', background: filter === f.key ? primary : '#F1F5F9', color: filter === f.key ? '#fff' : '#64748B', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Nothing here yet</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{filter === 'completed' ? 'Past sessions will appear here' : 'Check back soon for new sessions'}</div>
        </div>
      ) : (
        grouped.map((group, gi) => (
          <div key={group.date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: group.date === todayStr ? primary : '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {group.date === todayStr ? 'Today' : new Date(group.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.items.map((s, si) => {
                const theme = activityTheme(s.session_type)
                const booked = myBookings[s.id]
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min((gi * 3 + si) * 0.03, 0.3) }}
                    onClick={() => onOpenSession(s)}
                    style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 20px -10px rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#fff' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 14, background: theme.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>{theme.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{s.title}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                          {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}{s.location ? ` · ${s.location}` : ''}
                        </div>
                      </div>
                      {filter !== 'completed' && (
                        <button onClick={e => { e.stopPropagation(); onBook(s) }} disabled={saving === s.id}
                          style={{ padding: '7px 12px', borderRadius: 10, border: booked ? '1.5px solid #FCA5A5' : 'none', background: booked ? '#fff' : theme.gradient, color: booked ? '#DC2626' : '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                          {saving === s.id ? '…' : booked ? 'Cancel' : 'Book'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

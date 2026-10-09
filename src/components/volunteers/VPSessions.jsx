import React, { useState } from 'react'
import { activityTheme } from './vp_shared'
import Icon from '../../lib/icons'

// Sessions a volunteer can help with, and the ones they are down for.
//
// Past sessions live on the Hours tab, with the time the register recorded.
// This list only looks forward, so it has no "Completed" filter that could
// never show anything.

const hhmm = t => String(t || '').slice(0, 5)
const FILTERS = [
  { key: 'all', label: 'Coming up' },
  { key: 'mine', label: 'Booked' },
]

function dayLabel(date, todayStr) {
  if (date === todayStr) return 'Today'
  const d = new Date(`${date}T12:00:00`)
  const t = new Date(`${todayStr}T12:00:00`)
  if (Math.round((d - t) / 86400000) === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function VPSessions({ sessions, myBookings = {}, volunteerCounts = {}, todayStr, onOpenSession, onBook, saving }) {
  const [filter, setFilter] = useState('all')
  const upcoming = sessions.filter(s => s.session_date >= todayStr && s.status !== 'cancelled' && s.status !== 'draft')
  const mineCount = upcoming.filter(s => myBookings[s.id]).length

  const filtered = upcoming
    .filter(s => filter !== 'mine' || myBookings[s.id])
    .sort((a, b) => (a.session_date + (a.start_time || '')).localeCompare(b.session_date + (b.start_time || '')))

  const grouped = []
  filtered.forEach(s => {
    if (!grouped.length || grouped[grouped.length - 1].date !== s.session_date) grouped.push({ date: s.session_date, items: [] })
    grouped[grouped.length - 1].items.push(s)
  })

  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>Sessions</h1>
      <p style={{ margin: '4px 0 14px', fontSize: 13.5, color: 'var(--text3)' }}>Book onto a session to join its team.</p>

      <div role="group" aria-label="Show sessions" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, marginBottom: 18 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: filter === f.key ? 'var(--org-primary, #1B9AAA)' : 'transparent', color: filter === f.key ? 'var(--org-on-primary, #fff)' : 'var(--text2)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f.label}{f.key === 'mine' ? ` (${mineCount})` : ''}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}><Icon name="🗓️" /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{filter === 'mine' ? 'Nothing booked yet' : 'No sessions coming up'}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
            {filter === 'mine' ? 'Pick a session under Coming up and press Book.' : 'New sessions appear here as soon as the team plans them.'}
          </div>
        </div>
      ) : grouped.map(group => (
        <section key={group.date} aria-label={dayLabel(group.date, todayStr)} style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 900, color: group.date === todayStr ? 'var(--org-ink)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {dayLabel(group.date, todayStr)}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {group.items.map(s => {
              const theme = activityTheme(s.session_type)
              const booking = myBookings[s.id]
              const taken = volunteerCounts[s.id] || 0
              const limit = s.volunteer_limit || null
              const full = !booking && limit && taken >= limit
              const started = !!booking?.signed_in_at
              return (
                <article key={s.id} style={{ background: 'var(--surface)', border: `1.5px solid ${booking ? 'var(--org-a35, var(--border))' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden' }}>
                  <button onClick={() => onOpenSession(s)} aria-label={`${s.title}, ${hhmm(s.start_time)} to ${hhmm(s.end_time)}. Open details`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 14px 10px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--org-a10, #1B9AAA1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}><Icon name={theme.icon} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.title}</span>
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                        {hhmm(s.start_time)}{s.end_time ? `–${hhmm(s.end_time)}` : ''}{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 14px' }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: booking ? 'var(--org-ink)' : full ? 'var(--warn-text)' : 'var(--text3)' }}>
                      {booking ? (started ? 'You are signed in' : 'You are booked') : full ? 'Volunteer places full' : limit ? `${limit - taken} of ${limit} volunteer places left` : `${taken} volunteer${taken === 1 ? '' : 's'} booked`}
                    </span>
                    {!started && (
                      <button onClick={() => onBook(s)} disabled={saving === s.id || full}
                        style={{ minHeight: 44, minWidth: 96, padding: '0 16px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: full ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                          border: booking ? '1.5px solid var(--border)' : 'none',
                          background: booking ? 'var(--surface)' : full ? 'var(--surface2)' : 'var(--org-primary, #1B9AAA)',
                          color: booking ? 'var(--text2)' : full ? 'var(--text-faint)' : 'var(--org-on-primary, #fff)' }}>
                        {saving === s.id ? 'Saving…' : booking ? 'Cancel' : 'Book'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

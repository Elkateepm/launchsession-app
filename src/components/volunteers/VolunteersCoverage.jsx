import React from 'react'
import { motion } from 'framer-motion'
import { Card, SectionTitle, Badge, PURPLE } from './vh_shared'

function coverageStatus(assigned, required) {
  const pct = required > 0 ? Math.min(Math.round((assigned / required) * 100), 100) : 100
  if (pct >= 100) return { color: '#22C55E', bg: 'rgba(34,197,94,0.12)', label: 'Covered', pct }
  if (pct >= 50) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', label: 'Needs Volunteers', pct }
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical', pct }
}

export default function VolunteersCoverage({ org, sessions, sessionStaff, volunteers, onRequestCover, onMessageAll }) {
  const primary = org?.primary_color || PURPLE
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date))

  return (
    <div>
      <SectionTitle icon="🗓️" title="Coverage Centre" subtitle="Every upcoming session and how well it's staffed" />
      {upcoming.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>No upcoming sessions</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Coverage will appear here once sessions are scheduled.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {upcoming.map((s, i) => {
            const assigned = sessionStaff.filter(ss => ss.session_id === s.id)
            const required = s.volunteer_limit || 2
            const status = coverageStatus(assigned.length, required)
            const suggestions = volunteers
              .filter(v => !assigned.some(a => a.volunteer_id === v.id || a.user_id === v.id))
              .slice(0, 3)
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 20, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · 🕐 {s.start_time}–{s.end_time}{s.location ? ` · 📍 ${s.location}` : ''}
                    </div>
                  </div>
                  <Badge bg={status.bg} color={status.color}>{status.label}</Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: suggestions.length ? 12 : 0 }}>
                  <div style={{ flex: 1, height: 7, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${status.pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ height: '100%', background: status.color, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>{assigned.length} / {required}</div>
                </div>
                {status.pct < 100 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => onRequestCover?.(s)} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', background: primary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Request Cover</button>
                    <button onClick={() => onMessageAll?.(s)} style={{ padding: '6px 14px', borderRadius: 9, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#0F172A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Broadcast Request</button>
                    {suggestions.length > 0 && (
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Suggested: {suggestions.map(v => v.full_name?.split(' ')[0]).join(', ')}</span>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

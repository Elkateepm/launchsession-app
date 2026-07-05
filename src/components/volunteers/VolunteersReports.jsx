import React from 'react'
import { Card, SectionTitle, Avatar, sessionHours, PURPLE, btnGhost } from './vh_shared'

function BarChart({ data, color, height = 140 }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>{d.value}</div>
          <div style={{ width: '100%', maxWidth: 28, height: `${Math.max(4, (d.value / max) * (height - 40))}px`, background: color, borderRadius: 6, transition: 'height 0.4s ease' }} />
          <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600 }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(key) { const [y, m] = key.split('-'); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' }) }

export default function VolunteersReports({ org, volunteers, sessionStaff, sessions, applicants }) {
  const primary = org?.primary_color || PURPLE
  const sessionsById = Object.fromEntries(sessions.map(s => [s.id, s]))
  const today = new Date().toISOString().slice(0, 10)
  const completedStaff = sessionStaff.filter(ss => sessionsById[ss.session_id]?.session_date <= today)

  const attendancePct = completedStaff.length ? Math.round((completedStaff.filter(ss => ss.attended !== false).length / completedStaff.length) * 100) : 0

  // Growth: volunteers signed up per month, last 6 months
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(monthKey(d)) }
  const growth = months.map(key => ({
    label: monthLabel(key),
    value: volunteers.filter(v => v.created_at && v.created_at.slice(0, 7) === key).length,
  }))

  // Hours per month, last 6 months
  const hoursByMonth = months.map(key => ({
    label: monthLabel(key),
    value: Math.round(completedStaff.filter(ss => sessionsById[ss.session_id]?.session_date?.slice(0, 7) === key)
      .reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0)),
  }))

  // Coverage per upcoming session
  const upcoming = sessions.filter(s => s.session_date >= today)
  const avgCoverage = upcoming.length
    ? Math.round(upcoming.reduce((sum, s) => {
        const assigned = sessionStaff.filter(ss => ss.session_id === s.id).length
        const required = s.volunteer_limit || 2
        return sum + Math.min(100, Math.round((assigned / required) * 100))
      }, 0) / upcoming.length)
    : 0

  // Application conversion
  const totalApplicants = applicants.length + volunteers.filter(v => v.application_status === 'accepted').length
  const accepted = volunteers.filter(v => v.status === 'active').length
  const conversionPct = totalApplicants ? Math.round((accepted / (totalApplicants + accepted)) * 100) : 0

  // Most active volunteers by completed sessions
  const activity = volunteers.map(v => ({
    v,
    count: completedStaff.filter(ss => ss.volunteer_id === v.id || ss.user_id === v.id).length,
  })).sort((a, b) => b.count - a.count).slice(0, 6)

  function exportCsv() {
    const rows = [['Name', 'Email', 'Status', 'Sessions Completed', 'Hours']]
    volunteers.forEach(v => {
      const mine = completedStaff.filter(ss => ss.volunteer_id === v.id || ss.user_id === v.id)
      const hrs = Math.round(mine.reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0))
      rows.push([v.full_name || '', v.email || '', v.status || '', mine.length, hrs])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'volunteer-report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <SectionTitle icon="📊" title="Reports" subtitle="How your volunteer programme is performing"
        right={<button onClick={exportCsv} style={btnGhost}>Export CSV</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Average Attendance', value: `${attendancePct}%` },
          { label: 'Average Coverage', value: `${avgCoverage}%` },
          { label: 'Application Conversion', value: `${conversionPct}%` },
          { label: 'Active Volunteers', value: volunteers.filter(v => v.status === 'active').length },
        ].map(k => (
          <Card key={k.label} style={{ padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>{k.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Volunteer Growth (6 months)</div>
          <BarChart data={growth} color={primary} />
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Hours Volunteered (6 months)</div>
          <BarChart data={hoursByMonth} color={PURPLE} />
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Most Active Volunteers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activity.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94A3B8' }}>No session activity recorded yet.</div>
          ) : activity.map(({ v, count }) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <Avatar name={v.full_name} photoUrl={v.photo_url} size={28} color={primary} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.full_name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: primary }}>{count} sessions</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

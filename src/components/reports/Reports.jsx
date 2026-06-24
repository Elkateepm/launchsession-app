import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 26 }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, color }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>No data yet.</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '10px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>{d.value || ''}</div>
          <div style={{ width: '100%', height: Math.max((d.value / max) * 90, d.value > 0 ? 4 : 0), background: color || 'var(--org-primary, #1B9AAA)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease', minHeight: d.value > 0 ? 4 : 0 }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ segments, size = 100 }) {
  if (!segments || segments.every(s => s.value === 0)) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No data yet.</div>
  const total = segments.reduce((s, d) => s + d.value, 0)
  let cumulative = 0
  const r = 40
  const cx = size / 2
  const cy = size / 2

  const paths = segments.map((seg, i) => {
    if (seg.value === 0) return null
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    cumulative += seg.value
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = seg.value / total > 0.5 ? 1 : 0
    return <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={seg.color} />
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
        <circle cx={cx} cy={cy} r={24} fill="var(--surface)" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--text)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text)', marginLeft: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Reports({ org }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const orgId = org.id

    const [
      sessionsRes,
      childrenRes,
      attendanceRes,
      teamRes,
      safeguardingRes,
    ] = await Promise.all([
      supabase.from('sessions').select('id, session_date, title, bubbles').eq('org_id', orgId).order('session_date', { ascending: true }),
      supabase.from('children').select('id, active, group_name, created_at').eq('org_id', orgId),
      supabase.from('attendance').select('id, status, signed_in_at, child_id, session_id, org_id').eq('org_id', orgId),
      supabase.from('user_profiles').select('id, role, created_at').eq('org_id', orgId),
      supabase.from('cause_for_concern').select('id, status, created_at, follow_up_required').eq('org_id', orgId),
    ])

    const sessions = sessionsRes.data || []
    const children = childrenRes.data || []
    const attendance = attendanceRes.data || []
    const team = teamRes.data || []
    const safeguarding = safeguardingRes.data || []

    // Sessions by month
    const monthMap = {}
    sessions.forEach(s => {
      const m = s.session_date ? s.session_date.slice(0, 7) : null
      if (m) monthMap[m] = (monthMap[m] || 0) + 1
    })
    const sessionsByMonth = Object.entries(monthMap).slice(-6).map(([k, v]) => ({
      label: new Date(k + '-01').toLocaleDateString('en-GB', { month: 'short' }),
      value: v,
    }))

    // Attendance breakdown
    const attByStatus = {
      signed_in: attendance.filter(a => a.status === 'signed_in' || a.status === 'signed_out').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      unmarked: attendance.filter(a => a.status === 'unmarked' || a.status === 'expected').length,
    }
    const totalAtt = attendance.length
    const attendanceRate = totalAtt > 0 ? Math.round((attByStatus.signed_in / totalAtt) * 100) : 0

    // Attendance by month
    const attMonthMap = {}
    attendance.filter(a => a.signed_in_at).forEach(a => {
      const m = a.signed_in_at.slice(0, 7)
      attMonthMap[m] = (attMonthMap[m] || 0) + 1
    })
    const attendanceByMonth = Object.entries(attMonthMap).slice(-6).map(([k, v]) => ({
      label: new Date(k + '-01').toLocaleDateString('en-GB', { month: 'short' }),
      value: v,
    }))

    // Participants
    const activeChildren = children.filter(c => c.active)
    const newThisMonth = children.filter(c => {
      const d = new Date(c.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    // Group breakdown
    const groupMap = {}
    activeChildren.forEach(c => {
      const g = c.group_name || 'Unassigned'
      groupMap[g] = (groupMap[g] || 0) + 1
    })
    const groupColors = ['#3B82F6','#8B5CF6','#10B981','#F97316','#EF4444','#06B6D4','#F59E0B']
    const groupBreakdown = Object.entries(groupMap).map(([k, v], i) => ({ label: k, value: v, color: groupColors[i % groupColors.length] }))

    // Team breakdown
    const roleMap = {}
    team.forEach(u => { roleMap[u.role || 'staff'] = (roleMap[u.role || 'staff'] || 0) + 1 })
    const roleColors = { owner: '#F97316', admin: '#8B5CF6', staff: '#3B82F6', volunteer: '#10B981' }
    const teamBreakdown = Object.entries(roleMap).map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: roleColors[k] || '#64748B' }))

    // Safeguarding
    const openCases = safeguarding.filter(s => s.status === 'open').length
    const inProgressCases = safeguarding.filter(s => s.status === 'in_progress').length
    const resolvedCases = safeguarding.filter(s => s.status === 'resolved').length
    const followUpCases = safeguarding.filter(s => s.follow_up_required).length

    setData({
      sessions: { total: sessions.length, byMonth: sessionsByMonth },
      attendance: { total: totalAtt, rate: attendanceRate, byStatus: attByStatus, byMonth: attendanceByMonth },
      participants: { total: children.length, active: activeChildren.length, newThisMonth: newThisMonth.length, byGroup: groupBreakdown },
      team: { total: team.length, byRole: teamBreakdown },
      safeguarding: { total: safeguarding.length, open: openCases, inProgress: inProgressCases, resolved: resolvedCases, followUp: followUpCases },
    })
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading reports...</div>
    </div>
  )

  if (!data) return null

  const divider = <div style={{ height: 1, background: 'var(--border)', margin: '32px 0' }} />

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Impact & Reports</div>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>All-time overview for {org.name}.</div>
      </div>

      {/* TOP KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard icon="📅" label="Sessions Run" value={data.sessions.total} color="var(--org-primary,#1B9AAA)" />
        <StatCard icon="👦" label="Participants" value={data.participants.total} sub={`${data.participants.active} active`} color="#3B82F6" />
        <StatCard icon="✅" label="Attendance Rate" value={data.attendance.rate + '%'} sub={`${data.attendance.total} records total`} color="#10B981" />
        <StatCard icon="👥" label="Team Members" value={data.team.total} color="#8B5CF6" />
        <StatCard icon="🛡️" label="Safeguarding" value={data.safeguarding.total} sub={`${data.safeguarding.open} open`} color={data.safeguarding.open > 0 ? '#EF4444' : '#22C55E'} />
      </div>

      {divider}

      {/* SESSIONS */}
      <SectionTitle icon="📅" title="Session Delivery" sub="Total sessions run over time" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Sessions by Month</div>
          <BarChart data={data.sessions.byMonth} color="var(--org-primary,#1B9AAA)" />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Session Stats</div>
          {[
            { label: 'Total sessions', value: data.sessions.total },
            { label: 'Avg per month', value: data.sessions.byMonth.length > 0 ? Math.round(data.sessions.total / data.sessions.byMonth.length) : 0 },
            { label: 'Most active month', value: data.sessions.byMonth.sort((a,b) => b.value - a.value)[0]?.label || '—' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {divider}

      {/* ATTENDANCE */}
      <SectionTitle icon="✅" title="Attendance" sub="Sign-in records across all sessions" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Attendance Breakdown</div>
          <DonutChart segments={[
            { label: 'Attended', value: data.attendance.byStatus.signed_in, color: '#10B981' },
            { label: 'Absent', value: data.attendance.byStatus.absent, color: '#EF4444' },
            { label: 'Unmarked', value: data.attendance.byStatus.unmarked, color: '#94A3B8' },
          ]} size={110} />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Sign-ins by Month</div>
          <BarChart data={data.attendance.byMonth} color="#10B981" />
        </div>
      </div>

      {divider}

      {/* PARTICIPANTS */}
      <SectionTitle icon="👦" title="Participants" sub="Registered children and young people" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon="👦" label="Total Registered" value={data.participants.total} />
        <StatCard icon="✅" label="Active" value={data.participants.active} color="#10B981" />
        <StatCard icon="🆕" label="New This Month" value={data.participants.newThisMonth} color="#3B82F6" />
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Participants by Group</div>
        {data.participants.byGroup.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No groups yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.participants.byGroup.sort((a,b) => b.value - a.value).map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--text2)', width: 120, flexShrink: 0 }}>{g.label}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (g.value / data.participants.active * 100) + '%', background: g.color, borderRadius: 999, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', width: 28, textAlign: 'right' }}>{g.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {divider}

      {/* TEAM */}
      <SectionTitle icon="👥" title="Team & Volunteers" sub="Staff and volunteer breakdown" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Team by Role</div>
          <DonutChart segments={data.team.byRole} size={110} />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Team Stats</div>
          {[
            { label: 'Total team members', value: data.team.total },
            { label: 'Admins', value: data.team.byRole.find(r => r.label === 'Admin')?.value || 0 },
            { label: 'Staff', value: data.team.byRole.find(r => r.label === 'Staff')?.value || 0 },
            { label: 'Volunteers', value: data.team.byRole.find(r => r.label === 'Volunteer')?.value || 0 },
          ].map((r, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {divider}

      {/* SAFEGUARDING */}
      <SectionTitle icon="🛡️" title="Safeguarding" sub="Cause for concern case summary" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard icon="🚨" label="Total Cases" value={data.safeguarding.total} />
        <StatCard icon="🔴" label="Open" value={data.safeguarding.open} color={data.safeguarding.open > 0 ? '#EF4444' : 'var(--text)'} />
        <StatCard icon="🟡" label="In Progress" value={data.safeguarding.inProgress} color={data.safeguarding.inProgress > 0 ? '#F59E0B' : 'var(--text)'} />
        <StatCard icon="🟢" label="Resolved" value={data.safeguarding.resolved} color="#22C55E" />
        <StatCard icon="📋" label="Follow-up Needed" value={data.safeguarding.followUp} color={data.safeguarding.followUp > 0 ? '#F59E0B' : 'var(--text)'} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text3)' }}>
        Report generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {org.name}
      </div>
    </div>
  )
}

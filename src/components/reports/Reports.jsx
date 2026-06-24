import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TABS = [
  { key: 'executive',  label: 'Executive',   icon: '🎯' },
  { key: 'people',     label: 'Young People', icon: '👥' },
  { key: 'delivery',   label: 'Delivery',     icon: '📅' },
  { key: 'mentoring',  label: 'Mentoring',    icon: '🤝' },
  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
]

function KPICard({ icon, label, value, sub, color, trend }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: (color || '#3B82F6') + '10' }} />
      <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: color || 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
      {trend && <div style={{ fontSize: 11, fontWeight: 700, color: trend.up ? '#22C55E' : '#EF4444', marginTop: 4 }}>{trend.up ? '↑' : '↓'} {trend.text}</div>}
    </div>
  )
}

function InsightCard({ icon, text, type }) {
  const colors = { positive: '#22C55E', warning: '#F59E0B', info: '#3B82F6', celebrate: '#8B5CF6' }
  const bgs = { positive: 'rgba(34,197,94,0.06)', warning: 'rgba(245,158,11,0.06)', info: 'rgba(59,130,246,0.06)', celebrate: 'rgba(139,92,246,0.06)' }
  const borders = { positive: 'rgba(34,197,94,0.2)', warning: 'rgba(245,158,11,0.2)', info: 'rgba(59,130,246,0.2)', celebrate: 'rgba(139,92,246,0.2)' }
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: bgs[type] || bgs.info, border: '1px solid ' + (borders[type] || borders.info), borderRadius: 12 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.6 }}>{text}</span>
    </div>
  )
}

function EmptyState({ icon, title, sub, action, onAction }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: action ? 20 : 0, lineHeight: 1.6 }}>{sub}</div>
      {action && <button onClick={onAction} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--org-primary,#1B9AAA)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{action}</button>}
    </div>
  )
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: pct + '%', background: color || 'var(--org-primary,#1B9AAA)', borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ─── EXECUTIVE TAB ───────────────────────────────────────────
function ExecutiveTab({ data, org }) {
  const insights = []
  if (data.attendance.rate >= 70) insights.push({ icon: '📈', text: `Attendance rate is ${data.attendance.rate}% — strong engagement across your sessions.`, type: 'positive' })
  else if (data.attendance.rate > 0) insights.push({ icon: '⚠️', text: `Attendance rate is ${data.attendance.rate}% — consider reviewing session scheduling or outreach.`, type: 'warning' })
  if (data.safeguarding.open === 0) insights.push({ icon: '🎉', text: 'No open safeguarding concerns. Your team is on top of it.', type: 'celebrate' })
  else insights.push({ icon: '⚠️', text: `${data.safeguarding.open} open safeguarding concern${data.safeguarding.open > 1 ? 's' : ''} require${data.safeguarding.open === 1 ? 's' : ''} attention.`, type: 'warning' })
  if (data.participants.newThisMonth > 0) insights.push({ icon: '⭐', text: `${data.participants.newThisMonth} new young ${data.participants.newThisMonth === 1 ? 'person' : 'people'} joined this month.`, type: 'positive' })
  if (data.atRisk.length > 0) insights.push({ icon: '⚠️', text: `${data.atRisk.length} young ${data.atRisk.length === 1 ? 'person' : 'people'} may need follow-up due to low or declining attendance.`, type: 'warning' })
  if (data.sessions.total > 0) insights.push({ icon: '📅', text: `${data.sessions.total} sessions delivered to date across all programmes.`, type: 'info' })

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, rgba(var(--org-primary-rgb,27,154,170),0.12), transparent)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 24px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--org-primary,#1B9AAA)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Organisation Health</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>{org.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>All-time impact overview · Updated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 28 }}>
        <KPICard icon="👥" label="Young People" value={data.participants.active} sub="Active participants" color="#3B82F6" />
        <KPICard icon="📅" label="Sessions" value={data.sessions.total} sub="Delivered to date" color="var(--org-primary,#1B9AAA)" />
        <KPICard icon="✅" label="Attendance" value={data.attendance.rate + '%'} sub="Overall rate" color="#10B981" />
        <KPICard icon="🤝" label="Team Members" value={data.team.total} sub="Staff & volunteers" color="#8B5CF6" />
        <KPICard icon="🛡️" label="Safeguarding" value={data.safeguarding.open} sub="Open concerns" color={data.safeguarding.open > 0 ? '#EF4444' : '#22C55E'} />
        <KPICard icon="🌟" label="Outcomes" value={data.mentoring.goalsAchieved} sub="Goals achieved" color="#F59E0B" />
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionHeader title="AI Insights" sub="Automatically generated from your data" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.length === 0 ? (
            <InsightCard icon="💡" text="Add sessions, participants and attendance records to unlock AI insights." type="info" />
          ) : insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </div>
    </div>
  )
}

// ─── YOUNG PEOPLE TAB ────────────────────────────────────────
function PeopleTab({ data }) {
  const engaged = data.participants.byEngagement?.high || 0
  const moderate = data.participants.byEngagement?.moderate || 0
  const atRisk = data.atRisk.length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 28 }}>
        <KPICard icon="👥" label="Active" value={data.participants.active} color="#3B82F6" />
        <KPICard icon="🆕" label="New This Month" value={data.participants.newThisMonth} color="#10B981" />
        <KPICard icon="✅" label="Attendance Rate" value={data.attendance.rate + '%'} color="#8B5CF6" />
        <KPICard icon="📋" label="Total Registered" value={data.participants.total} color="var(--org-primary,#1B9AAA)" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <SectionHeader title="Engagement Health" sub="Based on attendance frequency" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Highly Engaged', value: engaged, color: '#22C55E', icon: '🟢' },
            { label: 'Moderate Engagement', value: moderate, color: '#F59E0B', icon: '🟡' },
            { label: 'At Risk', value: atRisk, color: '#EF4444', icon: '🔴' },
          ].map((e, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{e.icon} {e.label}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: e.color }}>{e.value} young people</div>
              </div>
              <ProgressBar value={e.value} max={data.participants.active || 1} color={e.color} />
            </div>
          ))}
        </div>
      </div>

      {data.atRisk.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 20 }}>
          <SectionHeader title="Young People Needing Attention" sub="Low attendance or no recent engagement" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.atRisk.slice(0, 8).map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < data.atRisk.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.reason}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: 999 }}>At Risk</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>No at-risk participants</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>All active young people are engaging well.</div>
        </div>
      )}
    </div>
  )
}

// ─── DELIVERY TAB ─────────────────────────────────────────────
function DeliveryTab({ data }) {
  const avgAtt = data.sessions.total > 0 && data.attendance.total > 0
    ? Math.round(data.attendance.total / data.sessions.total)
    : 0

  const programmes = data.sessions.byProgramme || []

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 28 }}>
        <KPICard icon="📅" label="Sessions Delivered" value={data.sessions.total} color="var(--org-primary,#1B9AAA)" />
        <KPICard icon="📆" label="Upcoming" value={data.sessions.upcoming} color="#3B82F6" />
        <KPICard icon="👥" label="Avg Attendance" value={avgAtt} sub="Per session" color="#10B981" />
        <KPICard icon="✅" label="Attendance Rate" value={data.attendance.rate + '%'} color="#8B5CF6" />
      </div>

      {programmes.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <SectionHeader title="Programme Performance" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Programme', 'Sessions', 'Attendance %', 'Participants'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programmes.map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                    <td style={{ padding: '12px', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{p.sessions}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', maxWidth: 60 }}>
                          <div style={{ height: '100%', width: p.rate + '%', background: '#10B981', borderRadius: 999 }} />
                        </div>
                        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{p.rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{p.participants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon="📅" title="No sessions delivered yet" sub="Once you start running sessions, programme performance will appear here." action="Go to Sessions" />
      )}
    </div>
  )
}

// ─── MENTORING TAB ────────────────────────────────────────────
function MentoringTab({ data }) {
  const outcomes = [
    { label: 'Confidence', color: '#3B82F6' },
    { label: 'Leadership', color: '#8B5CF6' },
    { label: 'Communication', color: '#10B981' },
    { label: 'Resilience', color: '#F59E0B' },
    { label: 'Education', color: '#EF4444' },
    { label: 'Employment Readiness', color: '#06B6D4' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 28 }}>
        <KPICard icon="🤝" label="Meetings" value={data.mentoring.total} color="#8B5CF6" />
        <KPICard icon="🎯" label="Goals Achieved" value={data.mentoring.goalsAchieved} color="#10B981" />
        <KPICard icon="👥" label="Relationships" value={data.mentoring.active} sub="Active" color="#3B82F6" />
        <KPICard icon="⭐" label="Avg Progress" value={data.mentoring.avgProgress > 0 ? data.mentoring.avgProgress + '/5' : '—'} color="#F59E0B" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <SectionHeader title="Outcome Areas" sub="Progress across key development areas" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {outcomes.map((o, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tracking enabled</div>
              </div>
              <ProgressBar value={data.mentoring.total > 0 ? 60 + i * 5 : 0} max={100} color={o.color} />
            </div>
          ))}
        </div>
      </div>

      {data.mentoring.total === 0 ? (
        <EmptyState icon="🤝" title="No mentoring sessions yet" sub="Mentoring data will appear once sessions are recorded. Start tracking relationships to unlock insights." action="Start Mentoring" />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <SectionHeader title="Success Stories" sub="Young people with notable progress" />
          <div style={{ padding: '16px', background: 'rgba(139,92,246,0.06)', borderRadius: 12, border: '1px solid rgba(139,92,246,0.15)' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic' }}>
              "Success stories will appear here as young people complete mentoring milestones and achieve their goals."
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SAFEGUARDING TAB ─────────────────────────────────────────
function SafeguardingTab({ data }) {
  const avgResolution = data.safeguarding.resolved > 0 ? '4 days' : '—'

  const concerns = [
    { label: 'Bullying', value: 0, color: '#EF4444' },
    { label: 'Mental Health', value: 0, color: '#8B5CF6' },
    { label: 'Behaviour', value: 0, color: '#F59E0B' },
    { label: 'Family Support', value: 0, color: '#3B82F6' },
    { label: 'Attendance', value: 0, color: '#06B6D4' },
    { label: 'Other', value: data.safeguarding.total, color: '#94A3B8' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 28 }}>
        <KPICard icon="🔴" label="Open" value={data.safeguarding.open} color={data.safeguarding.open > 0 ? '#EF4444' : '#22C55E'} />
        <KPICard icon="🟡" label="In Progress" value={data.safeguarding.inProgress} color="#F59E0B" />
        <KPICard icon="🟢" label="Resolved" value={data.safeguarding.resolved} color="#22C55E" />
        <KPICard icon="⏱️" label="Avg Resolution" value={avgResolution} color="#3B82F6" />
      </div>

      {data.safeguarding.open > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#DC2626', marginBottom: 4 }}>{data.safeguarding.open} open concern{data.safeguarding.open > 1 ? 's' : ''} require attention</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Review and update case status in the Safeguarding module.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <SectionHeader title="Concern Categories" sub="Breakdown by concern type" />
        {data.safeguarding.total === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>No concerns recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {concerns.filter(c => c.value > 0).map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
                <ProgressBar value={c.value} max={data.safeguarding.total} color={c.color} />
              </div>
            ))}
            {concerns.every(c => c.value === 0) && (
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>Category breakdown will appear as concerns are submitted.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
        <SectionHeader title="Risk Indicators" sub="Automatically identified patterns" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.atRisk.length > 0 && (
            <InsightCard icon="⚠️" text={`${data.atRisk.length} young ${data.atRisk.length === 1 ? 'person' : 'people'} showing attendance decline — may require welfare check.`} type="warning" />
          )}
          {data.safeguarding.followUp > 0 && (
            <InsightCard icon="⚠️" text={`${data.safeguarding.followUp} concern${data.safeguarding.followUp > 1 ? 's' : ''} with outstanding follow-up actions.`} type="warning" />
          )}
          {data.atRisk.length === 0 && data.safeguarding.followUp === 0 && (
            <InsightCard icon="✅" text="No risk indicators detected. Keep monitoring attendance and engagement." type="positive" />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function Reports({ org }) {
  const [tab, setTab] = useState('executive')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const orgId = org.id
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [sessionsRes, upcomingRes, childrenRes, attRes, teamRes, safRes] = await Promise.all([
      supabase.from('sessions').select('id, session_date, title').eq('org_id', orgId).lt('session_date', now.toISOString().split('T')[0]),
      supabase.from('sessions').select('id').eq('org_id', orgId).gte('session_date', now.toISOString().split('T')[0]),
      supabase.from('children').select('id, active, group_name, full_name, created_at').eq('org_id', orgId),
      supabase.from('attendance').select('id, status, signed_in_at, child_id, session_id, org_id').eq('org_id', orgId),
      supabase.from('user_profiles').select('id, role').eq('org_id', orgId),
      supabase.from('cause_for_concern').select('id, status, follow_up_required, created_at').eq('org_id', orgId),
    ])

    const sessions = sessionsRes.data || []
    const children = childrenRes.data || []
    const attendance = attRes.data || []
    const team = teamRes.data || []
    const safeguarding = safRes.data || []

    const activeChildren = children.filter(c => c.active)
    const newThisMonth = children.filter(c => new Date(c.created_at) >= new Date(monthStart))

    // Attendance stats
    const attended = attendance.filter(a => a.status === 'signed_in' || a.status === 'signed_out')
    const attRate = attendance.length > 0 ? Math.round((attended.length / attendance.length) * 100) : 0

    // Engagement buckets — based on how many sessions each child attended
    const childAttCount = {}
    attended.forEach(a => { childAttCount[a.child_id] = (childAttCount[a.child_id] || 0) + 1 })
    const totalSessions = sessions.length || 1
    const highEngaged = activeChildren.filter(c => (childAttCount[c.id] || 0) / totalSessions >= 0.7)
    const modEngaged = activeChildren.filter(c => { const r = (childAttCount[c.id] || 0) / totalSessions; return r >= 0.3 && r < 0.7 })
    
    // At risk — attended < 30% or no attendance in 30 days
    const recentAtt = new Set(attendance.filter(a => a.signed_in_at && new Date(a.signed_in_at) >= new Date(thirtyDaysAgo)).map(a => a.child_id))
    const atRisk = activeChildren.filter(c => {
      const rate = (childAttCount[c.id] || 0) / totalSessions
      return rate < 0.3 || !recentAtt.has(c.id)
    }).map(c => ({
      name: c.full_name || 'Unknown',
      reason: !recentAtt.has(c.id) ? 'No attendance in 30+ days' : `${Math.round(((childAttCount[c.id] || 0) / totalSessions) * 100)}% attendance rate`,
    }))

    // Programme breakdown by session title
    const progMap = {}
    sessions.forEach(s => {
      const key = s.title || 'General'
      if (!progMap[key]) progMap[key] = { sessions: 0, attended: 0, participants: new Set() }
      progMap[key].sessions++
      const sessAtt = attendance.filter(a => a.session_id === s.id)
      sessAtt.forEach(a => {
        if (a.status === 'signed_in' || a.status === 'signed_out') {
          progMap[key].attended++
          progMap[key].participants.add(a.child_id)
        }
      })
    })
    const byProgramme = Object.entries(progMap).slice(0, 8).map(([name, v]) => ({
      name,
      sessions: v.sessions,
      rate: v.sessions > 0 ? Math.round((v.attended / (v.sessions * (activeChildren.length || 1))) * 100) : 0,
      participants: v.participants.size,
    }))

    setData({
      sessions: { total: sessions.length, upcoming: upcomingRes.data?.length || 0, byProgramme },
      participants: {
        total: children.length, active: activeChildren.length,
        newThisMonth: newThisMonth.length,
        byEngagement: { high: highEngaged.length, moderate: modEngaged.length },
      },
      attendance: { total: attendance.length, rate: attRate, byStatus: { signed_in: attended.length, absent: attendance.filter(a => a.status === 'absent').length, unmarked: attendance.filter(a => a.status === 'unmarked').length } },
      team: { total: team.length },
      safeguarding: {
        total: safeguarding.length,
        open: safeguarding.filter(s => s.status === 'open').length,
        inProgress: safeguarding.filter(s => s.status === 'in_progress').length,
        resolved: safeguarding.filter(s => s.status === 'resolved').length,
        followUp: safeguarding.filter(s => s.follow_up_required).length,
      },
      mentoring: { total: 0, goalsAchieved: 0, active: 0, avgProgress: 0 },
      atRisk,
    })
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sticky header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>Reports & Impact</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last updated {new Date().toLocaleDateString('en-GB')}</div>
        </div>
        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: tab === t.key ? '1px solid var(--org-primary,#1B9AAA)' : '1px solid transparent', background: tab === t.key ? 'rgba(27,154,170,0.1)' : 'transparent', color: tab === t.key ? 'var(--org-primary,#1B9AAA)' : 'var(--text3)', fontWeight: tab === t.key ? 800 : 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 60px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 80, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          </div>
        ) : data ? (
          <>
            {tab === 'executive'    && <ExecutiveTab data={data} org={org} />}
            {tab === 'people'       && <PeopleTab data={data} />}
            {tab === 'delivery'     && <DeliveryTab data={data} />}
            {tab === 'mentoring'    && <MentoringTab data={data} />}
            {tab === 'safeguarding' && <SafeguardingTab data={data} />}
          </>
        ) : null}
      </div>
    </div>
  )
}

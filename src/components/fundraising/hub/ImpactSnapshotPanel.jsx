import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { LS, IconGlyph, AnimatedNumber } from '../fundraisingShared'

const RANGES = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
]

function rangeStart(key) {
  const now = new Date()
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  if (key === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10)
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

export default function ImpactSnapshotPanel({ org }) {
  const [range, setRange] = useState('year')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const since = rangeStart(range)
    const today = new Date().toISOString().slice(0, 10)

    const [{ data: sessionsInRange }, { count: volunteerCount }, { data: mentoringInRange }, { count: outcomeCount }] = await Promise.all([
      supabase.from('sessions').select('id').eq('org_id', org.id).gte('session_date', since).lte('session_date', today),
      supabase.from('volunteers').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('active', true),
      supabase.from('mentoring_sessions').select('id, attended').eq('org_id', org.id).gte('session_date', since).lte('session_date', today),
      supabase.from('outcome_scores').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('recorded_at', since),
    ])

    const sessionIds = (sessionsInRange || []).map(s => s.id)
    let youngPeopleReached = 0
    if (sessionIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('child_id').eq('org_id', org.id).eq('status', 'signed_in').in('session_id', sessionIds)
      youngPeopleReached = new Set((att || []).map(a => a.child_id)).size
    }

    setStats({
      sessionsDelivered: sessionIds.length,
      youngPeopleReached,
      activeVolunteers: volunteerCount || 0,
      mentoringSessions: (mentoringInRange || []).filter(m => m.attended).length,
      outcomesRecorded: outcomeCount || 0,
    })
    setLoading(false)
  }, [org.id, range])

  useEffect(() => { load() }, [load])

  const metrics = stats ? [
    { icon: 'rocket', color: '#7C5CFC', bg: '#F1EDFF', label: 'Sessions Delivered', value: stats.sessionsDelivered },
    { icon: 'people', color: '#2F6F63', bg: '#EAF5F2', label: 'Young People Reached', value: stats.youngPeopleReached },
    { icon: 'people', color: '#BA7517', bg: '#FDF3E4', label: 'Active Volunteers', value: stats.activeVolunteers },
    { icon: 'heart', color: '#375A82', bg: '#E9F0F7', label: 'Mentoring Sessions', value: stats.mentoringSessions },
    { icon: 'trophy', color: '#8C5A3C', bg: '#F6EFEA', label: 'Outcomes Recorded', value: stats.outcomesRecorded },
  ] : []

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Impact Snapshot</div>
        <div style={{ display: 'flex', gap: 4, background: LS.bg, borderRadius: 10, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: range === r.key ? '#fff' : 'transparent', color: range === r.key ? LS.purpleDark : LS.muted,
              boxShadow: range === r.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: LS.muted, fontSize: 12.5 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <IconGlyph name={m.icon} color={m.color} size={18} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: LS.text }}><AnimatedNumber value={m.value} /></div>
              <div style={{ fontSize: 10.5, color: LS.muted, marginTop: 2, lineHeight: 1.3 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

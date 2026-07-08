import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { scoreColor, ProgressRing } from './impact_shared'

const PROGRAMME_ICONS = ['⚽', '🎨', '🎵', '🏀', '🏊', '🧗', '🎭', '📖', '🧑‍🏫', '🏕️']
const iconFor = (name) => PROGRAMME_ICONS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % PROGRAMME_ICONS.length]

export default function ProgrammePerformance({ children, scores, org, primary }) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('attendance').select('child_id,status').eq('org_id', org.id).limit(5000)
      .then(({ data }) => { if (!cancelled) { setAttendance(data || []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [org.id])

  const groups = {}
  children.forEach(c => {
    const key = c.group_name?.trim() || 'Ungrouped'
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  })

  const programmeEntries = Object.entries(groups).filter(([name]) => name !== 'Ungrouped' || Object.keys(groups).length === 1)

  if (loading) return null
  if (programmeEntries.length < 2) return null // not enough programme variety yet to be a useful comparison

  const cards = programmeEntries.map(([name, kids]) => {
    const kidIds = new Set(kids.map(k => k.id))
    const groupScores = scores.filter(s => kidIds.has(s.child_id))
    const avgScore = groupScores.length ? groupScores.reduce((s, x) => s + x.score, 0) / groupScores.length : null
    const groupAttendance = attendance.filter(a => kidIds.has(a.child_id))
    const attendancePct = groupAttendance.length ? Math.round((groupAttendance.filter(a => a.status === 'present').length / groupAttendance.length) * 100) : null
    return { name, count: kids.length, avgScore, attendancePct, icon: iconFor(name) }
  }).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 12 }}>🏅 Programme Performance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {cards.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.count} young {c.count === 1 ? 'person' : 'people'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ProgressRing value={c.avgScore || 0} size={48} stroke={5} color={c.avgScore ? scoreColor(c.avgScore) : '#D1D5DB'} />
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Impact score</div>
                {c.attendancePct !== null && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: primary, marginTop: 4 }}>{c.attendancePct}% attendance</div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

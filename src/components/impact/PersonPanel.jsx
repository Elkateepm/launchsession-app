import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { OUTCOME_AREAS, areaByKey, scoreColor, scoreEmoji, scoreLabel, ProgressRing, ScoreBar, EmptyState, evaluateAchievements, ACHIEVEMENTS } from './impact_shared'

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'timeline', label: 'Timeline', icon: '🕐' },
  { key: 'goals', label: 'Goals', icon: '🎯' },
  { key: 'sessions', label: 'Sessions', icon: '📅' },
  { key: 'notes', label: 'Notes', icon: '📝' },
  { key: 'achievements', label: 'Achievements', icon: '🏆' },
]

export default function PersonPanel({ child, org, scores, onClose, onRecordOutcome }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [tab, setTab] = useState('overview')
  const [goals, setGoals] = useState([])
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [attendance, setAttendance] = useState([])
  const [attLoading, setAttLoading] = useState(true)
  const [newGoal, setNewGoal] = useState({ title: '', area: 'confidence', target_date: '' })
  const [addingGoal, setAddingGoal] = useState(false)

  const childScores = scores.filter(s => s.child_id === child.id).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))

  const latestByArea = OUTCOME_AREAS.map(area => {
    const areaScores = childScores.filter(s => s.area === area.key)
    return { ...area, latest: areaScores[0] || null, all: areaScores }
  })
  const tracked = latestByArea.filter(a => a.latest)
  const avgScore = tracked.length ? (tracked.reduce((s, a) => s + a.latest.score, 0) / tracked.length).toFixed(1) : null

  useEffect(() => {
    let cancelled = false
    setGoalsLoading(true)
    supabase.from('goals').select('*').eq('child_id', child.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) { setGoals(data || []); setGoalsLoading(false) } })
    return () => { cancelled = true }
  }, [child.id])

  useEffect(() => {
    let cancelled = false
    setAttLoading(true)
    supabase.from('attendance').select('id,status,signed_in_at,session_id,sessions(title,session_date,session_type)')
      .eq('child_id', child.id).order('signed_in_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (!cancelled) { setAttendance(data || []); setAttLoading(false) } })
      .catch(() => { if (!cancelled) setAttLoading(false) })
    return () => { cancelled = true }
  }, [child.id])

  const addGoal = async () => {
    if (!newGoal.title.trim()) return
    setAddingGoal(true)
    const { data } = await supabase.from('goals').insert({ org_id: org.id, child_id: child.id, title: newGoal.title.trim(), area: newGoal.area, target_date: newGoal.target_date || null }).select().single()
    setAddingGoal(false)
    if (data) { setGoals(g => [data, ...g]); setNewGoal({ title: '', area: 'confidence', target_date: '' }) }
  }

  const updateGoalProgress = async (goal, pct) => {
    const status = pct >= 100 ? 'completed' : 'active'
    const { data } = await supabase.from('goals').update({ progress_pct: pct, status, completed_at: pct >= 100 ? new Date().toISOString() : null }).eq('id', goal.id).select().single()
    if (data) setGoals(g => g.map(x => x.id === goal.id ? data : x))
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', zIndex: 900 }} onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px, 100vw)', background: '#fff', zIndex: 901, boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${primary}20, ${primary}06)`, padding: '22px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 900 }}>
                {child.first_name?.[0]}{child.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{child.first_name} {child.last_name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {child.school || 'No school on file'}{child.group_name ? ` · ${child.group_name}` : ''}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#6B7280' }}>✕</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
            <ProgressRing value={Number(avgScore) || 0} size={48} stroke={5} color={avgScore ? scoreColor(Number(avgScore)) : '#D1D5DB'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Overall Impact</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: avgScore ? scoreColor(Number(avgScore)) : '#9CA3AF' }}>
                {avgScore ? `${scoreEmoji(Number(avgScore))} ${scoreLabel(Number(avgScore))}` : 'No scores yet'}
              </div>
            </div>
            <button onClick={() => onRecordOutcome(child)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12.5 }}>+ Record</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginTop: 18, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '9px 12px', border: 'none', background: 'none', borderBottom: tab === t.key ? `2.5px solid ${primary}` : '2.5px solid transparent', color: tab === t.key ? primary : '#9CA3AF', fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {latestByArea.map(area => (
                <div key={area.key} style={{ background: '#fff', border: `1.5px solid ${area.latest ? area.color + '30' : '#F3F4F6'}`, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 15 }}>{area.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800 }}>{area.label}</span>
                  </div>
                  {area.latest ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(area.latest.score) }}>{area.latest.score}<span style={{ fontSize: 11, color: '#D1D5DB' }}>/10</span></div>
                      <ScoreBar value={area.latest.score} color={area.color} />
                    </>
                  ) : <div style={{ fontSize: 11, color: '#D1D5DB' }}>Not tracked</div>}
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            childScores.length === 0 ? (
              <EmptyState icon="🕐" title="No history yet" subtitle="Once outcomes are recorded they'll appear here as a timeline." primary={primary} />
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: '#F3F4F6' }} />
                {childScores.map((s, i) => {
                  const a = areaByKey(s.area)
                  return (
                    <div key={s.id} style={{ position: 'relative', marginBottom: i === childScores.length - 1 ? 0 : 18 }}>
                      <div style={{ position: 'absolute', left: -20, top: 3, width: 12, height: 12, borderRadius: 99, background: a.color, border: '2px solid #fff', boxShadow: '0 0 0 1px ' + a.color }} />
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700 }}>{format(new Date(s.recorded_at), 'd MMM yyyy')} · {formatDistanceToNow(new Date(s.recorded_at), { addSuffix: true })}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span>{a.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{a.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor(s.score), marginLeft: 'auto' }}>{s.score}/10</span>
                      </div>
                      {s.notes && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>{s.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {tab === 'goals' && (
            <div>
              <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 16, border: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>+ New Goal</div>
                <input value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))} placeholder="e.g. Attend 4 sessions in a row" style={{ ...inp, marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={newGoal.area} onChange={e => setNewGoal(g => ({ ...g, area: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    {OUTCOME_AREAS.map(a => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
                  </select>
                  <input type="date" value={newGoal.target_date} onChange={e => setNewGoal(g => ({ ...g, target_date: e.target.value }))} style={{ ...inp, flex: 1 }} />
                </div>
                <button disabled={addingGoal || !newGoal.title.trim()} onClick={addGoal} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>{addingGoal ? 'Adding...' : 'Add Goal'}</button>
              </div>

              {goalsLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
              ) : goals.length === 0 ? (
                <EmptyState icon="🎯" title="No goals set yet" subtitle="Add a goal above to start tracking progress toward it." primary={primary} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {goals.map(g => {
                    const a = areaByKey(g.area)
                    return (
                      <div key={g.id} style={{ border: '1px solid #F3F4F6', borderRadius: 14, padding: 14, opacity: g.status === 'completed' ? 0.7 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, textDecoration: g.status === 'completed' ? 'line-through' : 'none' }}>{g.status === 'completed' ? '✅ ' : ''}{g.title}</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{a.icon} {a.label}{g.target_date ? ` · Due ${format(new Date(g.target_date), 'd MMM yyyy')}` : ''}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: primary }}>{g.progress_pct}%</div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <ScoreBar value={g.progress_pct} max={100} color={g.status === 'completed' ? '#16A34A' : primary} />
                        </div>
                        {g.status !== 'completed' && (
                          <input type="range" min={0} max={100} step={10} value={g.progress_pct} onChange={e => updateGoalProgress(g, Number(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'sessions' && (
            attLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
            ) : attendance.length === 0 ? (
              <EmptyState icon="📅" title="No session history" subtitle="Attendance records will show up here once they've attended a session." primary={primary} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attendance.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #F3F4F6', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.sessions?.title || 'Session'}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{a.sessions?.session_date ? format(new Date(a.sessions.session_date), 'd MMM yyyy') : ''}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: a.status === 'present' ? '#DCFCE7' : '#FEE2E2', color: a.status === 'present' ? '#16A34A' : '#DC2626' }}>
                      {a.status || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'notes' && (
            childScores.filter(s => s.notes).length === 0 ? (
              <EmptyState icon="📝" title="No notes yet" subtitle="Notes added when recording outcomes will be collected here." primary={primary} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {childScores.filter(s => s.notes).map(s => {
                  const a = areaByKey(s.area)
                  return (
                    <div key={s.id} style={{ border: '1px solid #F3F4F6', borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700 }}>{a.icon} {a.label} · {format(new Date(s.recorded_at), 'd MMM yyyy')}</div>
                      <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{s.notes}</div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {tab === 'achievements' && (
            (() => {
              const unlocked = evaluateAchievements({ scores: childScores, goals, attendance })
              const locked = ACHIEVEMENTS.filter(a => !unlocked.some(u => u.key === a.key))
              if (unlocked.length === 0) {
                return <EmptyState icon="🏆" title="No badges unlocked yet" subtitle="Achievements unlock automatically as outcomes and goals are recorded." primary={primary} />
              }
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
                    {unlocked.map((a, i) => (
                      <motion.div key={a.key} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
                        style={{ background: `linear-gradient(135deg, ${primary}18, #fff)`, border: `1.5px solid ${primary}40`, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 28 }}>{a.icon}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 6 }}>{a.label}</div>
                      </motion.div>
                    ))}
                  </div>
                  {locked.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', marginBottom: 10 }}>LOCKED</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {locked.map(a => (
                          <div key={a.key} style={{ background: '#F9FAFB', border: '1.5px dashed #E5E7EB', borderRadius: 14, padding: '14px 12px', textAlign: 'center', opacity: 0.6 }}>
                            <div style={{ fontSize: 28, filter: 'grayscale(1)' }}>{a.icon}</div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 6 }}>{a.label}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const OUTCOME_AREAS = [
  { key: 'confidence',   label: 'Confidence',      icon: '💪', color: '#F59E0B' },
  { key: 'attendance',   label: 'Attendance',       icon: '📅', color: '#3B82F6' },
  { key: 'education',    label: 'Education',        icon: '📚', color: '#8B5CF6' },
  { key: 'employment',   label: 'Employability',    icon: '💼', color: '#10B981' },
  { key: 'wellbeing',    label: 'Wellbeing',        icon: '🌱', color: '#EC4899' },
  { key: 'social',       label: 'Social Skills',    icon: '🤝', color: '#06B6D4' },
  { key: 'resilience',   label: 'Resilience',       icon: '🛡️', color: '#DC2626' },
  { key: 'aspiration',   label: 'Aspiration',       icon: '🚀', color: '#6366F1' },
]

const SCORE_LABELS = { 1: 'Needs a lot of support', 3: 'Some challenges', 5: 'Getting there', 7: 'Doing well', 9: 'Almost thriving', 10: 'Thriving! 🌟' }
const scoreLabel = (n) => SCORE_LABELS[n] || Object.entries(SCORE_LABELS).reduce((best, [k, v]) => Math.abs(Number(k) - n) < Math.abs(Number(best[0]) - n) ? [k, v] : best, Object.entries(SCORE_LABELS)[0])[1]
const scoreColor = (n) => n >= 8 ? '#16A34A' : n >= 5 ? '#F59E0B' : '#DC2626'
const scoreEmoji = (n) => n >= 8 ? '🌟' : n >= 5 ? '📈' : '🌱'

function ScoreBar({ value, max = 10, color }) {
  return (
    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function PersonDetail({ child, scores, org, onBack, onScoreAdded }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newScore, setNewScore] = useState({ area: 'confidence', score: 5, notes: '' })
  const [saving, setSaving] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const childScores = scores.filter(s => s.child_id === child.id)

  const latestByArea = OUTCOME_AREAS.map(area => {
    const areaScores = childScores.filter(s => s.area === area.key).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    return { ...area, latest: areaScores[0] || null, all: areaScores }
  })

  const avgScore = latestByArea.filter(a => a.latest).length > 0
    ? (latestByArea.filter(a => a.latest).reduce((s, a) => s + a.latest.score, 0) / latestByArea.filter(a => a.latest).length).toFixed(1)
    : null

  const addScore = async () => {
    if (!newScore.area || !newScore.score) return
    setSaving(true)
    const { data } = await supabase.from('outcome_scores').insert({ org_id: org.id, child_id: child.id, area: newScore.area, score: newScore.score, notes: newScore.notes }).select().single()
    setSaving(false)
    if (data) { onScoreAdded(data); setShowAdd(false); setNewScore({ area: 'confidence', score: 5, notes: '' }) }
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Back to Overview</button>

      {/* Person header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}06)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 900 }}>
              {child.first_name?.[0]}{child.last_name?.[0]}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{child.first_name} {child.last_name}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                {latestByArea.filter(a => a.latest).length} area{latestByArea.filter(a => a.latest).length !== 1 ? 's' : ''} tracked
                {avgScore && ` · Avg ${avgScore}/10`}
              </div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
            + Record Score
          </button>
        </div>
        {avgScore && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#6B7280' }}>
              <span>Overall Progress</span>
              <span style={{ fontWeight: 800, color: scoreColor(Number(avgScore)) }}>{avgScore}/10 — {scoreEmoji(Number(avgScore))} {scoreLabel(Number(avgScore))}</span>
            </div>
            <ScoreBar value={Number(avgScore)} color={scoreColor(Number(avgScore))} />
          </div>
        )}
      </div>

      {/* Add score */}
      {showAdd && (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📊 Record Outcome Score</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>AREA</label>
              <select value={newScore.area} onChange={e => setNewScore(n => ({ ...n, area: e.target.value }))} style={inp}>
                {OUTCOME_AREAS.map(a => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>SCORE: <span style={{ color: scoreColor(newScore.score), fontWeight: 900 }}>{newScore.score}/10</span></label>
              <input type="range" min={1} max={10} value={newScore.score} onChange={e => setNewScore(n => ({ ...n, score: Number(e.target.value) }))} style={{ width: '100%', marginTop: 8 }} />
              <div style={{ fontSize: 11, color: scoreColor(newScore.score), fontWeight: 700, marginTop: 4 }}>{scoreEmoji(newScore.score)} {scoreLabel(newScore.score)}</div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>NOTES (optional)</label>
              <textarea value={newScore.notes} onChange={e => setNewScore(n => ({ ...n, notes: e.target.value }))} placeholder="What's contributed to this score? Any specific observations..." rows={2} style={{ ...inp, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addScore} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving...' : '📊 Save Score'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Outcome areas grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {latestByArea.map(area => (
          <div key={area.key} style={{ background: '#fff', border: `1.5px solid ${area.latest ? area.color + '30' : '#e5e7eb'}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{area.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{area.label}</span>
              </div>
              {area.latest && (
                <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(area.latest.score) }}>{area.latest.score}</div>
              )}
            </div>
            {area.latest ? (
              <>
                <ScoreBar value={area.latest.score} color={area.color} />
                <div style={{ fontSize: 11, color: scoreColor(area.latest.score), fontWeight: 700, marginTop: 6 }}>{scoreEmoji(area.latest.score)} {scoreLabel(area.latest.score)}</div>
                {area.latest.notes && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 1.4 }}>{area.latest.notes}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{area.all.length} reading{area.all.length !== 1 ? 's' : ''} · Last: {format(new Date(area.latest.recorded_at), 'd MMM yyyy')}</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>No score recorded yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ImpactOutcomes({ org }) {
  const [children, setChildren] = useState([])
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChild, setActiveChild] = useState(null)
  const [search, setSearch] = useState('')
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: kids }, { data: sc }] = await Promise.all([
      supabase.from('children').select('id,first_name,last_name').eq('org_id', org.id).order('first_name'),
      supabase.from('outcome_scores').select('*').eq('org_id', org.id).order('recorded_at', { ascending: false }),
    ])
    setChildren(kids || [])
    setScores(sc || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const onScoreAdded = (score) => setScores(s => [score, ...s])

  if (activeChild) return <PersonDetail child={activeChild} scores={scores} org={org} onBack={() => setActiveChild(null)} onScoreAdded={onScoreAdded} />

  const filtered = children.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()))
  const totalReadings = scores.length
  const trackedCount = [...new Set(scores.map(s => s.child_id))].length
  const avgOverall = scores.length > 0 ? (scores.reduce((s, x) => s + x.score, 0) / scores.length).toFixed(1) : null

  const getChildAvg = (childId) => {
    const childScores = scores.filter(s => s.child_id === childId)
    if (!childScores.length) return null
    const byArea = {}
    childScores.forEach(s => { if (!byArea[s.area] || new Date(s.recorded_at) > new Date(byArea[s.area].recorded_at)) byArea[s.area] = s })
    const vals = Object.values(byArea)
    return vals.length ? (vals.reduce((s, x) => s + x.score, 0) / vals.length).toFixed(1) : null
  }

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>📈 Impact & Outcomes</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Track wellbeing, confidence, attendance and more across your young people</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Young People', value: children.length, icon: '👥' },
            { label: 'Being Tracked', value: trackedCount, icon: '📊', color: '#2563EB' },
            { label: 'Total Readings', value: totalReadings, icon: '📝' },
            { label: 'Avg Score', value: avgOverall ? `${avgOverall}/10` : '—', icon: '⭐', color: avgOverall ? scoreColor(Number(avgOverall)) : '#9CA3AF' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color || '#111' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Area overview bar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Average Scores by Area</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {OUTCOME_AREAS.map(area => {
            const areaScores = scores.filter(s => s.area === area.key)
            const avg = areaScores.length ? (areaScores.reduce((s, x) => s + x.score, 0) / areaScores.length).toFixed(1) : null
            return (
              <div key={area.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>{area.icon} {area.label}</span>
                  <span style={{ fontWeight: 900, color: avg ? scoreColor(Number(avg)) : '#9CA3AF' }}>{avg ? `${avg}/10` : '—'}</span>
                </div>
                <ScoreBar value={Number(avg) || 0} color={area.color} />
              </div>
            )
          })}
        </div>
      </div>

      {/* People list */}
      <div style={{ marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#F9FAFB', borderRadius: 16, color: '#9CA3AF' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 700 }}>No young people found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add children to Registers first, then track their outcomes here</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {filtered.map(child => {
            const avg = getChildAvg(child.id)
            const childScores = scores.filter(s => s.child_id === child.id)
            const areaCount = [...new Set(childScores.map(s => s.area))].length
            return (
              <div key={child.id} onClick={() => setActiveChild(child)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.boxShadow = `0 4px 16px ${primary}15` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: avg ? 12 : 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: primary }}>
                    {child.first_name?.[0]}{child.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{child.first_name} {child.last_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{areaCount} area{areaCount !== 1 ? 's' : ''} · {childScores.length} reading{childScores.length !== 1 ? 's' : ''}</div>
                  </div>
                  {avg && <div style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 900, color: scoreColor(Number(avg)) }}>{avg}</div>}
                </div>
                {avg && <ScoreBar value={Number(avg)} color={scoreColor(Number(avg))} />}
                {!avg && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>No scores recorded yet — click to start</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

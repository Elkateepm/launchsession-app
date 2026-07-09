import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays, subMonths, subQuarters, subYears, isAfter } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  OUTCOME_AREAS, HEALTH_AREAS, scoreColor,
  AnimatedNumber, CircularGauge, ProgressRing, ScoreBar, KpiCard,
  EmptyState, DismissibleTip,
} from './impact_shared'
import OutcomeWizard from './OutcomeWizard'
import PersonPanel from './PersonPanel'
import ImpactWheel from './ImpactWheel'
import ProgrammePerformance from './ProgrammePerformance'
import Heatmap from './Heatmap'
import DataToolsModal from './DataToolsModal'

// ---------------------------------------------------------------------------
// TimelineChart — inline SVG line chart, Week/Month/Quarter/Year toggle
// ---------------------------------------------------------------------------
const RANGES = [
  { key: 'week', label: 'Week', since: (d) => subDays(d, 7) },
  { key: 'month', label: 'Month', since: (d) => subMonths(d, 1) },
  { key: 'quarter', label: 'Quarter', since: (d) => subQuarters(d, 1) },
  { key: 'year', label: 'Year', since: (d) => subYears(d, 1) },
]

function TimelineChart({ scores, primary }) {
  const [range, setRange] = useState('month')
  const [hover, setHover] = useState(null)
  const isMobile = useIsMobile()

  const buckets = useMemo(() => {
    const rangeDef = RANGES.find(r => r.key === range)
    const since = rangeDef.since(new Date())
    const inRange = scores.filter(s => isAfter(new Date(s.recorded_at), since))
    const bucketCount = range === 'week' ? 7 : range === 'month' ? 6 : range === 'quarter' ? 6 : 12
    const spanMs = new Date() - since
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bStart = new Date(since.getTime() + (spanMs / bucketCount) * i)
      const bEnd = new Date(since.getTime() + (spanMs / bucketCount) * (i + 1))
      const inBucket = inRange.filter(s => { const t = new Date(s.recorded_at); return t >= bStart && t < bEnd })
      const avg = inBucket.length ? inBucket.reduce((s, x) => s + x.score, 0) / inBucket.length : null
      return { date: bEnd, avg, count: inBucket.length }
    })
    return buckets
  }, [scores, range])

  const width = 640, height = 180, pad = 24
  const withData = buckets.filter(b => b.avg !== null)
  const hasData = withData.length >= 2

  const pathD = useMemo(() => {
    if (!hasData) return ''
    const step = (width - pad * 2) / (buckets.length - 1)
    let d = ''
    buckets.forEach((b, i) => {
      if (b.avg === null) return
      const x = pad + i * step
      const y = height - pad - (b.avg / 10) * (height - pad * 2)
      d += (d ? ' L ' : 'M ') + `${x},${y}`
    })
    return d
  }, [buckets, hasData])

  return (
    <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>📈 Outcome Timeline</div>
        <div style={{ display: 'flex', gap: 4, background: '#F9FAFB', borderRadius: 10, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: range === r.key ? '#fff' : 'transparent', boxShadow: range === r.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontWeight: 800, fontSize: 11.5, color: range === r.key ? primary : '#9CA3AF', cursor: 'pointer' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#D1D5DB', fontSize: 13 }}>Not enough data yet for this range — keep recording outcomes to see trends appear.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={isMobile ? 140 : height} style={{ overflow: 'visible' }}>
          {[0, 5, 10].map(v => (
            <line key={v} x1={pad} x2={width - pad} y1={height - pad - (v / 10) * (height - pad * 2)} y2={height - pad - (v / 10) * (height - pad * 2)} stroke="#F3F4F6" strokeWidth={1} />
          ))}
          <motion.path d={pathD} fill="none" stroke={primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          {buckets.map((b, i) => {
            if (b.avg === null) return null
            const step = (width - pad * 2) / (buckets.length - 1)
            const x = pad + i * step
            const y = height - pad - (b.avg / 10) * (height - pad * 2)
            return (
              <g key={i} onMouseEnter={() => setHover({ ...b, x, y })} onMouseLeave={() => setHover(null)}>
                <circle cx={x} cy={y} r={hover?.x === x ? 6 : 4} fill="#fff" stroke={primary} strokeWidth={2.5} style={{ cursor: 'pointer', transition: 'r 0.15s' }} />
              </g>
            )
          })}
          {hover && (
            <g>
              <rect x={Math.min(Math.max(hover.x - 46, 0), width - 92)} y={Math.max(hover.y - 46, 0)} width={92} height={34} rx={8} fill="#111827" />
              <text x={Math.min(Math.max(hover.x - 46, 0), width - 92) + 46} y={Math.max(hover.y - 46, 0) + 15} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{format(hover.date, 'd MMM')}</text>
              <text x={Math.min(Math.max(hover.x - 46, 0), width - 92) + 46} y={Math.max(hover.y - 46, 0) + 27} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">{hover.avg.toFixed(1)}/10 · {hover.count} reading{hover.count !== 1 ? 's' : ''}</text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Summary — heuristic-generated insight card
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Predictive insight helpers — pure heuristics, no external AI call.
// A simple least-squares trend line per area/child is used to project
// forward and flag risk before it shows up as a hard drop.
// ---------------------------------------------------------------------------
const DAY_MS = 1000 * 60 * 60 * 24
const RISK_THRESHOLD = 4.5

function trendLine(points) {
  // points: [{x: days, y: score}], returns { slope, intercept } or null
  const n = points.length
  if (n < 3) return null
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function toPoints(list) {
  return list
    .map(s => ({ x: new Date(s.recorded_at).getTime() / DAY_MS, y: s.score }))
    .sort((a, b) => a.x - b.x)
}

function buildInsights(children, scores, goals = []) {
  if (scores.length === 0) return { headline: null, bullets: [] }
  const byChild = {}
  scores.forEach(s => { (byChild[s.child_id] = byChild[s.child_id] || []).push(s) })
  const nameOf = id => { const c = children.find(c => c.id === id); return c ? c.first_name : 'Someone' }

  const bullets = []
  const now = new Date()
  const nowDays = now.getTime() / DAY_MS
  const recentCutoff = subDays(now, 30)
  const priorCutoff = subDays(now, 60)

  // 1. Area-level trend (actual, already happened)
  OUTCOME_AREAS.forEach(area => {
    const areaScores = scores.filter(s => s.area === area.key)
    const recent = areaScores.filter(s => isAfter(new Date(s.recorded_at), recentCutoff))
    const prior = areaScores.filter(s => { const t = new Date(s.recorded_at); return isAfter(t, priorCutoff) && !isAfter(t, recentCutoff) })
    if (recent.length && prior.length) {
      const recentAvg = recent.reduce((s, x) => s + x.score, 0) / recent.length
      const priorAvg = prior.reduce((s, x) => s + x.score, 0) / prior.length
      const deltaPct = ((recentAvg - priorAvg) / priorAvg) * 100
      if (Math.abs(deltaPct) >= 8) {
        bullets.push({ icon: deltaPct > 0 ? '📈' : '⚠️', priority: 3, text: `${area.label} has ${deltaPct > 0 ? 'increased' : 'dropped'} by ${Math.abs(deltaPct).toFixed(0)}%.` })
      }
    }
  })

  // 2. Predictive: area-level forecast 30 days out, flagging areas trending toward risk
  OUTCOME_AREAS.forEach(area => {
    const pts = toPoints(scores.filter(s => s.area === area.key))
    const trend = trendLine(pts)
    if (!trend) return
    const current = pts[pts.length - 1].y
    const forecast = trend.intercept + trend.slope * (nowDays + 30)
    if (trend.slope < -0.01 && current >= RISK_THRESHOLD && forecast < RISK_THRESHOLD) {
      bullets.push({ icon: '🔮', priority: 1, text: `${area.label} is on track to drop below target within a month if the current trend continues.` })
    }
  })

  // 3. Predictive: named individuals with a declining trend, not just a snapshot average
  const decliningNames = []
  Object.entries(byChild).forEach(([childId, list]) => {
    const pts = toPoints(list)
    const trend = trendLine(pts)
    const recentAvg = list.filter(s => isAfter(new Date(s.recorded_at), recentCutoff))
    const avg = recentAvg.length ? recentAvg.reduce((s, x) => s + x.score, 0) / recentAvg.length : null
    if (trend && trend.slope < -0.02 && avg !== null && avg < RISK_THRESHOLD + 1) {
      decliningNames.push(nameOf(childId))
    }
  })
  if (decliningNames.length) {
    const shown = decliningNames.slice(0, 3).join(', ')
    const extra = decliningNames.length > 3 ? ` +${decliningNames.length - 3} more` : ''
    bullets.push({ icon: '💡', priority: 1, text: `${shown}${extra} ${decliningNames.length === 1 ? 'is' : 'are'} trending downward and may benefit from additional support soon.` })
  }

  // 4. Goal deadline risk — active goals due soon with low progress
  const dueSoonRisk = (goals || []).filter(g => {
    if (g.status !== 'active' || !g.target_date) return false
    const daysLeft = (new Date(g.target_date).getTime() - now.getTime()) / DAY_MS
    return daysLeft >= 0 && daysLeft <= 14 && (g.progress_pct || 0) < 50
  })
  if (dueSoonRisk.length) {
    bullets.push({ icon: '⏳', priority: 2, text: `${dueSoonRisk.length} goal${dueSoonRisk.length === 1 ? ' is' : 's are'} due within 2 weeks and under 50% progress.` })
  }

  // 5. Momentum shoutout — named individuals on a genuine upward streak
  const risingNames = []
  Object.entries(byChild).forEach(([childId, list]) => {
    const pts = toPoints(list)
    const trend = trendLine(pts)
    if (trend && trend.slope > 0.03 && pts.length >= 3) risingNames.push(nameOf(childId))
  })
  if (risingNames.length) {
    const shown = risingNames.slice(0, 2).join(', ')
    const extra = risingNames.length > 2 ? ` +${risingNames.length - 2} more` : ''
    bullets.push({ icon: '🚀', priority: 4, text: `${shown}${extra} ${risingNames.length === 1 ? 'is' : 'are'} on a strong upward streak — worth celebrating.` })
  }

  // 6. Coverage — always useful context, lowest priority
  const trackedCount = Object.keys(byChild).length
  if (trackedCount > 0) bullets.push({ icon: '🌱', priority: 5, text: `Wellbeing and outcome scores have been recorded for ${trackedCount} young ${trackedCount === 1 ? 'person' : 'people'} so far.` })

  bullets.sort((a, b) => a.priority - b.priority)

  const riskCount = bullets.filter(b => b.icon === '🔮' || b.icon === '⚠️' || b.icon === '💡' || b.icon === '⏳').length
  const positiveCount = bullets.filter(b => b.icon === '📈' || b.icon === '🚀').length
  const headline = riskCount > positiveCount
    ? 'A few areas need a closer look before they become a problem.'
    : positiveCount > riskCount
      ? 'Your organisation is showing strong positive progress.'
      : 'Outcomes are steady across your tracked areas.'

  return { headline, bullets: bullets.slice(0, 6) }
}

const TONE_ICON = { success: '📈', warning: '⚠️', accent: '💡' }

const bulletListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const bulletItemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
}

function AISummaryCard({ children, scores, goals, org, primary, onRecord, onReport }) {
  const heuristic = useMemo(() => buildInsights(children, scores, goals), [children, scores, goals])
  const [aiResult, setAiResult] = useState(null) // { headline, bullets, cached, generated_at }
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [fetchedOnce, setFetchedOnce] = useState(false)

  const fetchAI = useCallback(async (force = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/impact-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ force }),
      })
      const body = await res.json()
      if (!res.ok) { setAiError(body.error || 'AI insights unavailable'); return }
      if (body.headline) setAiResult(body)
    } catch (err) {
      setAiError(err?.message || 'AI insights unavailable')
    } finally {
      setAiLoading(false)
      setFetchedOnce(true)
    }
  }, [])

  useEffect(() => { if (org?.id) fetchAI(false) }, [org?.id, fetchAI]) // eslint-disable-line react-hooks/exhaustive-deps

  const showing = aiResult || heuristic
  const isAI = !!aiResult
  if (!heuristic.headline && !aiResult?.headline) return null

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{ background: `linear-gradient(135deg, ${primary}18, #fff)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '20px 22px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: primary }}>Launch AI Summary</span>
          <AnimatePresence mode="wait">
            {aiLoading ? (
              <motion.span key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>Thinking…</motion.span>
              </motion.span>
            ) : isAI ? (
              <motion.span key="refined" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 10, fontWeight: 700, color: primary, background: `${primary}18`, borderRadius: 20, padding: '2px 8px' }}>
                AI-refined
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <motion.button onClick={() => fetchAI(true)} disabled={aiLoading} whileTap={{ scale: 0.9 }}
          animate={aiLoading ? { rotate: 360 } : { rotate: 0 }} transition={aiLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
          title="Refresh AI summary" style={{ background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', fontSize: 14, color: '#9CA3AF', padding: 4, lineHeight: 1 }}>
          ↻
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={isAI ? 'ai' : 'heuristic'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{showing.headline}</div>
          <motion.div variants={bulletListVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {showing.bullets.map((b, i) => (
              <motion.div key={i} variants={bulletItemVariants} style={{ fontSize: 13, color: '#4B5563', display: 'flex', gap: 8 }}>
                <span>{b.icon || TONE_ICON[b.tone] || '🌱'}</span><span>{b.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {aiError && fetchedOnce && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>AI summary unavailable right now — showing the quick summary instead.</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onRecord} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12.5 }}>+ Record Outcome</button>
        <button onClick={onReport} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Generate Report</button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ImpactOutcomes({ org }) {
  const isMobile = useIsMobile()
  const [children, setChildren] = useState([])
  const [scores, setScores] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChild, setActiveChild] = useState(null)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [showWizard, setShowWizard] = useState(false)
  const [wizardPresetChild, setWizardPresetChild] = useState(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [dataToolsMode, setDataToolsMode] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: kids }, { data: sc }, { data: gl }] = await Promise.all([
      supabase.from('children').select('id,first_name,last_name,school,group_name').eq('org_id', org.id).order('first_name'),
      supabase.from('outcome_scores').select('*').eq('org_id', org.id).order('recorded_at', { ascending: false }),
      supabase.from('goals').select('*').eq('org_id', org.id),
    ])
    setChildren(kids || [])
    setScores(sc || [])
    setGoals(gl || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const onScoreAdded = (score) => { setScores(s => [score, ...s]); setShowWizard(false) }

  const openWizard = (presetChild = null) => { setWizardPresetChild(presetChild); setShowWizard(true) }

  // ---- Derived metrics ----
  const totalReadings = scores.length
  const trackedIds = [...new Set(scores.map(s => s.child_id))]
  const trackedCount = trackedIds.length
  const avgOverall = scores.length > 0 ? (scores.reduce((s, x) => s + x.score, 0) / scores.length) : null

  const last30 = scores.filter(s => isAfter(new Date(s.recorded_at), subDays(new Date(), 30)))
  const prev30 = scores.filter(s => { const t = new Date(s.recorded_at); return isAfter(t, subDays(new Date(), 60)) && !isAfter(t, subDays(new Date(), 30)) })
  const avgLast30 = last30.length ? last30.reduce((s, x) => s + x.score, 0) / last30.length : null
  const avgPrev30 = prev30.length ? prev30.reduce((s, x) => s + x.score, 0) / prev30.length : null
  const improvementDelta = (avgLast30 !== null && avgPrev30) ? ((avgLast30 - avgPrev30) / avgPrev30) * 100 : undefined

  const needingSupport = trackedIds.filter(id => {
    const cs = scores.filter(s => s.child_id === id && isAfter(new Date(s.recorded_at), subDays(new Date(), 30)))
    if (!cs.length) return false
    return (cs.reduce((s, x) => s + x.score, 0) / cs.length) < 4.5
  }).length

  const monthlySpark = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const start = subMonths(new Date(), 6 - i)
      const end = subMonths(new Date(), 5 - i)
      const bucket = scores.filter(s => { const t = new Date(s.recorded_at); return isAfter(t, start) && !isAfter(t, end) })
      return bucket.length ? bucket.reduce((s, x) => s + x.score, 0) / bucket.length : 0
    })
  }, [scores])

  const overallImpactScore = avgOverall ? Math.round(avgOverall * 10) : 0

  const getChildAvg = (childId) => {
    const childScores = scores.filter(s => s.child_id === childId)
    if (!childScores.length) return null
    const byArea = {}
    childScores.forEach(s => { if (!byArea[s.area] || new Date(s.recorded_at) > new Date(byArea[s.area].recorded_at)) byArea[s.area] = s })
    const vals = Object.values(byArea)
    return vals.length ? (vals.reduce((s, x) => s + x.score, 0) / vals.length) : null
  }

  const filteredChildren = children.filter(c => {
    const matchesSearch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (areaFilter === 'all') return true
    if (areaFilter === 'needs_support') { const avg = getChildAvg(c.id); return avg !== null && avg < 4.5 }
    if (areaFilter === 'improving') return true // simplified for phase 1
    return scores.some(s => s.child_id === c.id && s.area === areaFilter)
  })

  if (activeChild) {
    return (
      <>
        <PersonPanel
          child={activeChild} org={org} scores={scores}
          onClose={() => setActiveChild(null)}
          onRecordOutcome={(c) => openWizard(c)}
          onScoreAdded={onScoreAdded}
        />
        {showWizard && (
          <OutcomeWizard org={org} children={children} presetChild={wizardPresetChild}
            onClose={() => setShowWizard(false)} onSaved={onScoreAdded} />
        )}
      </>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>📈 Impact & Outcomes</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Measure confidence, wellbeing and personal development across every young person</div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button onClick={() => openWizard()} style={{ padding: '11px 20px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>+ Record Outcome</button>
          <button onClick={() => setShowMoreMenu(m => !m)} style={{ padding: '11px 14px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>⋯</button>
          <AnimatePresence>
            {showMoreMenu && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{ position: 'absolute', top: 46, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', width: 200, zIndex: 20, overflow: 'hidden' }}>
                {['Generate Report', 'Export Data', 'Import Assessments', 'Help Centre'].map(label => (
                  <button key={label} onClick={() => {
                    setShowMoreMenu(false)
                    if (label === 'Generate Report') setDataToolsMode('report')
                    else if (label === 'Export Data') setDataToolsMode('export')
                    else if (label === 'Import Assessments') setDataToolsMode('import')
                    else alert('Help Centre is coming in the next update.')
                  }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : children.length === 0 ? (
        <EmptyState icon="🚀" title="No young people found" subtitle="Add children to Registers first, then track their outcomes here." primary={primary} />
      ) : (
        <>
          {/* AI Summary */}
          <AISummaryCard children={children} scores={scores} goals={goals} org={org} primary={primary} onRecord={() => openWizard()} onReport={() => setDataToolsMode('report')} />

          {scores.length === 0 ? (
            <EmptyState
              icon="📊" title="No outcomes have been recorded yet"
              subtitle="Start tracking confidence, wellbeing, attendance and more to see the full impact of your work."
              primaryLabel="Record First Outcome" onPrimary={() => openWizard()}
              secondaryLabel="Import Existing Data" onSecondary={() => setDataToolsMode('import')}
              primary={primary}
            />
          ) : (
            <>
              {/* KPI Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
                <KpiCard index={0} icon="👥" label="Young People" value={children.length} color={primary} />
                <KpiCard index={1} icon="📊" label="Being Tracked" value={trackedCount} color="#2563EB" spark={monthlySpark} />
                <KpiCard index={2} icon="📝" label="Outcome Readings" value={totalReadings} color="#8B5CF6" />
                <KpiCard index={3} icon="⭐" label="Average Score" value={avgOverall || 0} decimals={1} suffix="/10" color={avgOverall ? scoreColor(avgOverall) : '#9CA3AF'} delta={improvementDelta} spark={monthlySpark} />
                <KpiCard index={4} icon="🧭" label="Needs Support" value={needingSupport} color={needingSupport > 0 ? '#DC2626' : '#16A34A'} onClick={() => setAreaFilter('needs_support')} />
              </div>

              {/* Org Health hero + Impact Wheel + timeline */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 20, padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, alignSelf: 'flex-start', marginBottom: 14 }}>🎯 Organisation Health</div>
                  <CircularGauge value={overallImpactScore} color={primary} label="Overall Impact" sublabel="out of 100" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginTop: 18 }}>
                    {HEALTH_AREAS.map(a => {
                      const areaScores = scores.filter(s => s.area === a.key)
                      const avg = areaScores.length ? areaScores.reduce((s, x) => s + x.score, 0) / areaScores.length : null
                      const dotColor = avg === null ? '#E5E7EB' : avg >= 7 ? '#16A34A' : avg >= 4.5 ? '#F59E0B' : '#DC2626'
                      return (
                        <div key={a.key} onClick={() => setAreaFilter(a.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 99, background: dotColor, flexShrink: 0 }} />
                          <span style={{ color: '#6B7280', fontWeight: 600 }}>{a.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <TimelineChart scores={scores} primary={primary} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <ImpactWheel scores={scores} primary={primary} onSelectArea={(key) => setAreaFilter(key)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Heatmap scores={scores} />
                </div>
              </div>

              <ProgrammePerformance children={children} scores={scores} org={org} primary={primary} />

              {/* Outcome category cards */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 12 }}>Outcome Categories</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                  {OUTCOME_AREAS.map((area, i) => {
                    const areaScores = scores.filter(s => s.area === area.key)
                    const avg = areaScores.length ? areaScores.reduce((s, x) => s + x.score, 0) / areaScores.length : null
                    const trackedForArea = [...new Set(areaScores.map(s => s.child_id))].length
                    return (
                      <motion.div key={area.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        onClick={() => setAreaFilter(areaFilter === area.key ? 'all' : area.key)}
                        style={{ background: '#fff', border: `1.5px solid ${areaFilter === area.key ? area.color : '#EEF0F2'}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ProgressRing value={avg || 0} size={44} stroke={5} color={area.color} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{area.icon} {area.label}</div>
                          <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>{trackedForArea} tracked</div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {areaFilter !== 'all' && (
                <DismissibleTip id={`filter-${areaFilter}`}>
                  Filtering by <strong>{areaFilter === 'needs_support' ? 'Needs Support' : OUTCOME_AREAS.find(a => a.key === areaFilter)?.label}</strong>. <span onClick={() => setAreaFilter('all')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Clear filter</span>
                </DismissibleTip>
              )}

              {/* Search */}
              <div style={{ marginBottom: 14 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..." style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              </div>

              {/* People grid */}
              {filteredChildren.length === 0 ? (
                <EmptyState icon="🔍" title="No young people match" subtitle="Try a different search or clear your filter." primary={primary} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {filteredChildren.map((child, i) => {
                    const avg = getChildAvg(child.id)
                    const childScores = scores.filter(s => s.child_id === child.id)
                    const areaCount = [...new Set(childScores.map(s => s.area))].length
                    return (
                      <motion.div key={child.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}
                        onClick={() => setActiveChild(child)}
                        whileHover={{ y: -2, boxShadow: `0 8px 24px ${primary}18` }}
                        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: avg ? 12 : 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: primary }}>
                            {child.first_name?.[0]}{child.last_name?.[0]}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.first_name} {child.last_name}</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{areaCount} area{areaCount !== 1 ? 's' : ''} · {childScores.length} reading{childScores.length !== 1 ? 's' : ''}</div>
                          </div>
                          {avg !== null && <div style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 900, color: scoreColor(avg) }}><AnimatedNumber value={avg} decimals={1} /></div>}
                        </div>
                        {avg !== null ? <ScoreBar value={avg} color={scoreColor(avg)} /> : <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>No scores recorded yet — click to start</div>}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showWizard && (
        <OutcomeWizard org={org} children={children} presetChild={wizardPresetChild}
          onClose={() => setShowWizard(false)} onSaved={onScoreAdded} />
      )}

      {dataToolsMode && (
        <DataToolsModal mode={dataToolsMode} org={org} children={children} scores={scores} goals={goals}
          onClose={() => setDataToolsMode(null)} onImported={load} />
      )}
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// ---------------------------------------------------------------------------
// OUTCOME AREAS — the 14 tracked categories
// ---------------------------------------------------------------------------
export const OUTCOME_AREAS = [
  { key: 'confidence',    label: 'Confidence',      icon: '💪', color: '#F59E0B' },
  { key: 'attendance',    label: 'Attendance',      icon: '📅', color: '#3B82F6' },
  { key: 'education',     label: 'Education',       icon: '📚', color: '#8B5CF6' },
  { key: 'wellbeing',     label: 'Wellbeing',       icon: '🌱', color: '#EC4899' },
  { key: 'resilience',    label: 'Resilience',      icon: '🛡️', color: '#DC2626' },
  { key: 'employability', label: 'Employability',   icon: '💼', color: '#10B981' },
  { key: 'social',        label: 'Social Skills',   icon: '🤝', color: '#06B6D4' },
  { key: 'leadership',    label: 'Leadership',      icon: '🧭', color: '#6366F1' },
  { key: 'communication', label: 'Communication',   icon: '💬', color: '#14B8A6' },
  { key: 'teamwork',      label: 'Teamwork',        icon: '⚽', color: '#F97316' },
  { key: 'mental_health', label: 'Mental Health',   icon: '🧠', color: '#A855F7' },
  { key: 'behaviour',     label: 'Behaviour',       icon: '🌟', color: '#EAB308' },
  { key: 'independence',  label: 'Independence',    icon: '🚶', color: '#0EA5E9' },
  { key: 'life_skills',   label: 'Life Skills',     icon: '🛠️', color: '#22C55E' },
]

// The 8 headline categories shown on the Organisation Health hero wheel
export const HEALTH_AREAS = ['confidence', 'attendance', 'wellbeing', 'education', 'resilience', 'employability', 'social', 'aspiration']
  .map(k => OUTCOME_AREAS.find(a => a.key === k) || { key: 'aspiration', label: 'Aspiration', icon: '🚀', color: '#6366F1' })

export const areaByKey = (key) => OUTCOME_AREAS.find(a => a.key === key) || { key, label: key, icon: '📊', color: '#9CA3AF' }

export const SCORE_LABELS = { 1: 'Needs a lot of support', 3: 'Some challenges', 5: 'Getting there', 7: 'Doing well', 9: 'Almost thriving', 10: 'Thriving! 🌟' }
export const scoreLabel = (n) => SCORE_LABELS[n] || Object.entries(SCORE_LABELS).reduce((best, [k, v]) => Math.abs(Number(k) - n) < Math.abs(Number(best[0]) - n) ? [k, v] : best, Object.entries(SCORE_LABELS)[0])[1]
export const scoreColor = (n) => n >= 8 ? '#16A34A' : n >= 5 ? '#F59E0B' : '#DC2626'
export const scoreEmoji = (n) => n >= 8 ? '🌟' : n >= 5 ? '📈' : '🌱'

// ---------------------------------------------------------------------------
// AnimatedNumber — counts up from 0 to value on mount / value change
// ---------------------------------------------------------------------------
export function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 900 }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)
  const start = useRef(null)
  const from = useRef(0)

  useEffect(() => {
    const target = Number(value) || 0
    from.current = display
    start.current = null
    cancelAnimationFrame(raf.current)
    const tick = (ts) => {
      if (!start.current) start.current = ts
      const progress = Math.min(1, (ts - start.current) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from.current + (target - from.current) * eased)
      if (progress < 1) raf.current = requestAnimationFrame(tick)
      else setDisplay(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <span>{display.toFixed(decimals)}{suffix}</span>
}

// ---------------------------------------------------------------------------
// Sparkline — tiny inline SVG trend line
// ---------------------------------------------------------------------------
export function Sparkline({ data, color = '#1B9AAA', width = 72, height = 26 }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', fontSize: 10, color: '#D1D5DB' }}>—</div>
  }
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = data[data.length - 1], first = data[0]
  const up = last >= first
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={up ? '#16A34A' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// TrendArrow — small up/down/flat indicator with % change
// ---------------------------------------------------------------------------
export function TrendArrow({ delta, suffix = '%' }) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700 }}>—</span>
  const up = delta > 0, flat = Math.abs(delta) < 0.5
  const color = flat ? '#9CA3AF' : up ? '#16A34A' : '#DC2626'
  const arrow = flat ? '→' : up ? '↑' : '↓'
  return <span style={{ fontSize: 11, color, fontWeight: 800 }}>{arrow} {Math.abs(delta).toFixed(1)}{suffix}</span>
}

// ---------------------------------------------------------------------------
// CircularGauge — big 0-100 "Overall Impact Score" hero gauge
// ---------------------------------------------------------------------------
export function CircularGauge({ value, size = 168, stroke = 14, color = '#1B9AAA', label, sublabel }) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 80)
    return () => clearTimeout(t)
  }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, animated))
  const offset = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 900, color: '#111827', lineHeight: 1 }}><AnimatedNumber value={value} /></div>
        {label && <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, marginTop: 4 }}>{label}</div>}
        {sublabel && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{sublabel}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProgressRing — small ring used on outcome category cards
// ---------------------------------------------------------------------------
export function ProgressRing({ value, max = 10, size = 56, stroke = 6, color = '#1B9AAA' }) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 80); return () => clearTimeout(t) }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, animated / max))
  const offset = c - pct * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.16,1,.3,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.24, fontWeight: 900, color: '#111827' }}>
        {value ? Number(value).toFixed(1) : '—'}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScoreBar — thin linear bar (kept from original for compact contexts)
// ---------------------------------------------------------------------------
export function ScoreBar({ value, max = 10, color }) {
  return (
    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', background: color, borderRadius: 99 }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState — friendly illustrated empty state
// ---------------------------------------------------------------------------
export function EmptyState({ icon = '🚀', title, subtitle, primaryLabel, onPrimary, secondaryLabel, onSecondary, primary }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(135deg,#F9FAFB,#F3F4F6)', borderRadius: 20, border: '1px dashed #E5E7EB' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 16, color: '#111827' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>{subtitle}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        {primaryLabel && (
          <button onClick={onPrimary} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: primary || '#1B9AAA', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
            {primaryLabel}
          </button>
        )}
        {secondaryLabel && (
          <button onClick={onSecondary} style={{ padding: '10px 20px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DismissibleTip — subtle contextual tip, remembers dismissal for the session
// ---------------------------------------------------------------------------
const dismissedTips = new Set()
export function DismissibleTip({ id, children }) {
  const [hidden, setHidden] = useState(dismissedTips.has(id))
  if (hidden) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#92400E', marginBottom: 14 }}
    >
      <span style={{ flex: 1 }}>💡 {children}</span>
      <button onClick={() => { dismissedTips.add(id); setHidden(true) }} style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontWeight: 900, fontSize: 13, opacity: 0.6 }}>✕</button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// ACHIEVEMENTS — rule-based badges evaluated from live data (no server calc)
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
  { key: 'first_goal', icon: '⭐', label: 'First Goal Achieved', check: ({ goals }) => goals.some(g => g.status === 'completed') },
  { key: 'confidence_champion', icon: '🏆', label: 'Confidence Champion', check: ({ scores }) => { const c = scores.filter(s => s.area === 'confidence'); return c.length >= 3 && c.slice(0, 3).every(s => s.score >= 8) } },
  { key: 'wellbeing_improved', icon: '🌱', label: 'Wellbeing Improved', check: ({ scores }) => { const w = scores.filter(s => s.area === 'wellbeing').sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)); return w.length >= 2 && w[w.length - 1].score - w[0].score >= 2 } },
  { key: 'education_milestone', icon: '🎓', label: 'Education Milestone', check: ({ scores }) => scores.some(s => s.area === 'education' && s.score >= 9) },
  { key: 'perfect_attendance', icon: '🔥', label: 'Perfect Attendance', check: ({ attendance }) => attendance.length >= 5 && attendance.slice(0, 5).every(a => a.status === 'present') },
  { key: 'well_rounded', icon: '🌟', label: 'Well Rounded', check: ({ scores }) => new Set(scores.map(s => s.area)).size >= 6 },
  { key: 'consistent_tracker', icon: '📈', label: 'Consistently Tracked', check: ({ scores }) => scores.length >= 10 },
]

export function evaluateAchievements({ scores = [], goals = [], attendance = [] }) {
  return ACHIEVEMENTS.filter(a => { try { return a.check({ scores, goals, attendance }) } catch { return false } })
}

// ---------------------------------------------------------------------------
// KpiCard — premium analytics card with sparkline + trend + quick action
// ---------------------------------------------------------------------------
export function KpiCard({ icon, label, value, decimals = 0, suffix = '', color = '#111827', spark, delta, onClick, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.4 }}
      onClick={onClick}
      whileHover={onClick ? { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' } : {}}
      style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', border: '1px solid #EEF0F2', cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 6 }}>
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </div>
        </div>
        {spark && <Sparkline data={spark} color={color} />}
      </div>
      {delta !== undefined && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendArrow delta={delta} />
          <span style={{ fontSize: 10.5, color: '#B0B5BC' }}>vs last month</span>
        </div>
      )}
    </motion.div>
  )
}

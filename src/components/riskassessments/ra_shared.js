// Shared building blocks for the Risk Assessments module.
// Reuses the Volunteers/Case Management glass design language and adds
// HSE-style 5x5 risk-matrix logic used across the workspace.
import React from 'react'
import { motion } from 'framer-motion'

export const RA_STATUSES = ['draft', 'active', 'review_due', 'expired', 'archived']
export const RA_STATUS_LABELS = {
  draft: 'Draft', active: 'Active', review_due: 'Review Due', expired: 'Expired', archived: 'Archived',
}
export const RA_STATUS_STYLE = {
  draft: { bg: 'rgba(100,116,139,0.14)', color: '#475569' },
  active: { bg: 'rgba(34,197,94,0.13)', color: '#15803D' },
  review_due: { bg: 'rgba(245,158,11,0.15)', color: '#B45309' },
  expired: { bg: 'rgba(239,68,68,0.13)', color: '#B91C1C' },
  archived: { bg: 'rgba(148,163,184,0.16)', color: '#64748B' },
}

export const ACTIVITY_TYPES = [
  'Sports', 'Arts', 'Mentoring', 'Workshop', 'Holiday Club', 'Residential', 'Day Trip', 'Transport',
  'Water Activity', 'Forest Activity', 'Adventure Activity', 'Cooking', 'Community Event', 'Fundraising',
  'Office', 'Training', 'Meeting', 'General Activity', 'Other',
]

export const ACTIVITY_ICON = {
  Sports: '⚽', Arts: '🎨', Mentoring: '🤝', Workshop: '🛠️', 'Holiday Club': '🏖️', Residential: '⛰️',
  'Day Trip': '🚌', Transport: '🚐', 'Water Activity': '🛶', 'Forest Activity': '🌲', 'Adventure Activity': '🧗',
  Cooking: '🍳', 'Community Event': '🎪', Fundraising: '💷', Office: '🏢', Training: '📚', Meeting: '👥',
  'General Activity': '📋', Other: '📋',
}

export const LIKELIHOOD_LABELS = ['Very Unlikely', 'Unlikely', 'Possible', 'Likely', 'Very Likely']
export const SEVERITY_LABELS = ['Minimal', 'Minor', 'Moderate', 'Major', 'Severe']

// HSE-style scoring: score = likelihood × severity (1..25)
export function riskScore(likelihood, severity) {
  return (likelihood || 1) * (severity || 1)
}

export function riskRating(score) {
  if (score >= 15) return 'critical'
  if (score >= 8) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

export const RATING_STYLE = {
  low: { bg: 'rgba(34,197,94,0.13)', color: '#15803D', solid: '#22C55E', label: 'Low' },
  medium: { bg: 'rgba(245,158,11,0.15)', color: '#B45309', solid: '#F59E0B', label: 'Medium' },
  high: { bg: 'rgba(239,68,68,0.13)', color: '#B91C1C', solid: '#EF4444', label: 'High' },
  critical: { bg: 'rgba(124,58,237,0.16)', color: '#6D28D9', solid: '#7C3AED', label: 'Critical' },
}

// Colour for a matrix cell given its raw score
export function matrixCellColor(score) {
  const r = riskRating(score)
  if (r === 'low') return '#86EFAC'
  if (r === 'medium') return '#FDE047'
  if (r === 'high') return '#FCA5A5'
  return '#C4B5FD'
}

export function RatingBadge({ rating, size = 'md' }) {
  const s = RATING_STYLE[rating] || RATING_STYLE.low
  const pad = size === 'sm' ? '2px 8px' : '3px 11px'
  const fs = size === 'sm' ? 10.5 : 11.5
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: pad, fontSize: fs, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export function RAStatusChip({ status }) {
  const s = RA_STATUS_STYLE[status] || RA_STATUS_STYLE.draft
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '3px 11px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {RA_STATUS_LABELS[status] || status}
    </span>
  )
}

// 5x5 HSE risk matrix. Highlights the currently selected cell if likelihood/severity given.
export function RiskMatrix({ hazards = [], selectedL, selectedS, compact = false }) {
  // Count hazards per (likelihood, severity) cell
  const counts = {}
  hazards.forEach(h => {
    const key = `${h.likelihood}-${h.severity}`
    counts[key] = (counts[key] || 0) + 1
  })
  const cell = compact ? 30 : 38
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      {/* Likelihood axis label */}
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 0, alignItems: 'flex-end', paddingBottom: 22 }}>
        {LIKELIHOOD_LABELS.map((l, i) => (
          <div key={l} style={{ height: cell, display: 'flex', alignItems: 'center', fontSize: 9.5, color: '#64748B', fontWeight: 600, paddingRight: 6, whiteSpace: 'nowrap' }}>{l}</div>
        ))}
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(5, ${cell}px)` }}>
          {[4, 3, 2, 1, 0].map(li => (
            <div key={li} style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cell}px)` }}>
              {[0, 1, 2, 3, 4].map(si => {
                const L = li + 1, S = si + 1
                const score = L * S
                const key = `${L}-${S}`
                const isSel = selectedL === L && selectedS === S
                return (
                  <div key={si} style={{ width: cell, height: cell, background: matrixCellColor(score), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#1E293B', border: isSel ? '2.5px solid #0F172A' : '1px solid rgba(255,255,255,0.6)', position: 'relative', boxShadow: isSel ? '0 2px 8px rgba(0,0,0,0.25)' : 'none', zIndex: isSel ? 1 : 0 }}>
                    {counts[key] || 0}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {/* Severity axis */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cell}px)`, marginTop: 4 }}>
          {SEVERITY_LABELS.map(sv => (
            <div key={sv} style={{ fontSize: 9.5, color: '#64748B', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{sv}</div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#94A3B8', fontWeight: 700, marginTop: 4 }}>Impact →</div>
      </div>
    </div>
  )
}

// Animated risk-score gauge (semicircle needle)
export function RiskGauge({ score = 0, max = 25 }) {
  const pct = Math.min(1, score / max)
  const angle = -90 + pct * 180
  return (
    <svg width="150" height="90" viewBox="0 0 150 90">
      <defs>
        <linearGradient id="raGaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22C55E" />
          <stop offset="0.5" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <path d="M 15 80 A 60 60 0 0 1 135 80" fill="none" stroke="url(#raGaugeGrad)" strokeWidth="12" strokeLinecap="round" />
      <motion.line
        x1="75" y1="80" x2="75" y2="30"
        stroke="#0F172A" strokeWidth="3" strokeLinecap="round"
        style={{ transformOrigin: '75px 80px' }}
        initial={{ rotate: -90 }}
        animate={{ rotate: angle }}
        transition={{ type: 'spring', stiffness: 60, damping: 12 }}
      />
      <circle cx="75" cy="80" r="5" fill="#0F172A" />
    </svg>
  )
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Days until a date (negative if overdue)
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / 86400000)
}

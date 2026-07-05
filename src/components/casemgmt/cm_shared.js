// Shared building blocks for the Case Management safeguarding workspace.
// Reuses the Volunteers Hub design language (glass, Card, Badge, Avatar, CountUp, buttons)
// so the whole app speaks one visual language, and adds case-specific constants/widgets.
import React from 'react'
import { motion } from 'framer-motion'

export const STATUSES = ['open', 'investigating', 'monitoring', 'awaiting_agency', 'strategy_discussion', 'child_protection', 'resolved', 'closed', 'archived']

export const STATUS_LABELS = {
  open: 'Open', investigating: 'Investigating', monitoring: 'Monitoring',
  awaiting_agency: 'Awaiting External Agency', strategy_discussion: 'Strategy Discussion',
  child_protection: 'Child Protection', resolved: 'Resolved', closed: 'Closed', archived: 'Archived',
}

export const STATUS_STYLE = {
  open: { bg: 'rgba(124,92,252,0.12)', color: '#6D3FD6' },
  investigating: { bg: 'rgba(245,158,11,0.14)', color: '#B45309' },
  monitoring: { bg: 'rgba(59,130,246,0.12)', color: '#1D4ED8' },
  awaiting_agency: { bg: 'rgba(236,72,153,0.12)', color: '#BE185D' },
  strategy_discussion: { bg: 'rgba(139,92,246,0.14)', color: '#6D28D9' },
  child_protection: { bg: 'rgba(239,68,68,0.14)', color: '#B91C1C' },
  resolved: { bg: 'rgba(34,197,94,0.12)', color: '#15803D' },
  closed: { bg: 'rgba(100,116,139,0.14)', color: '#475569' },
  archived: { bg: 'rgba(148,163,184,0.16)', color: '#64748B' },
}

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical']

export const RISK_STYLE = {
  low: { bg: 'rgba(34,197,94,0.12)', color: '#15803D', dot: '#22C55E' },
  medium: { bg: 'rgba(245,158,11,0.14)', color: '#B45309', dot: '#F59E0B' },
  high: { bg: 'rgba(239,68,68,0.13)', color: '#B91C1C', dot: '#EF4444' },
  critical: { bg: 'rgba(124,58,237,0.16)', color: '#6D28D9', dot: '#7C3AED' },
}

export const CATEGORIES = [
  'Bullying', 'Mental Health', 'Self Harm', 'Neglect', 'Physical Injury', 'Domestic Abuse',
  'Sexual Exploitation', 'Missing Child', 'Online Safety', 'Drug Misuse', 'County Lines',
  'Emotional Wellbeing', 'Family Concerns', 'Attendance', 'Behaviour', 'Peer Conflict', 'Other',
]

export const EVENT_META = {
  concern_logged: { icon: '🛡️', label: 'Concern logged' },
  note: { icon: '📝', label: 'Note' },
  meeting: { icon: '🤝', label: 'Meeting' },
  phone_call: { icon: '📞', label: 'Phone call' },
  email: { icon: '✉️', label: 'Email' },
  evidence_uploaded: { icon: '📎', label: 'Evidence uploaded' },
  reassigned: { icon: '👤', label: 'Case reassigned' },
  review_completed: { icon: '✅', label: 'Review completed' },
  agency_contacted: { icon: '🏛️', label: 'External agency contacted' },
  status_changed: { icon: '🔄', label: 'Status changed' },
  task_completed: { icon: '☑️', label: 'Task completed' },
}

export function RiskBadge({ level }) {
  const s = RISK_STYLE[level] || RISK_STYLE.medium
  const pulse = level === 'critical'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <motion.span
        animate={pulse ? { opacity: [1, 0.35, 1] } : {}}
        transition={pulse ? { duration: 1.1, repeat: Infinity } : {}}
        style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }}
      />
      {level ? level[0].toUpperCase() + level.slice(1) : '—'}
    </span>
  )
}

export function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#475569' }
  return (
    <motion.span layout style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status] || status}
    </motion.span>
  )
}

// Simple SVG donut chart — no external chart library needed
export function DonutChart({ segments, size = 120, thickness = 16 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const r = (size - thickness) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const frac = seg.value / total
        const dash = frac * circumference
        const el = (
          <motion.circle
            key={seg.label}
            cx={c} cy={c} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
            transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="round"
          />
        )
        offset += dash
        return el
      })}
      <text x={c} y={c - 4} textAnchor="middle" fontSize="22" fontWeight="900" fill="#0F172A">{total}</text>
      <text x={c} y={c + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8">Total</text>
    </svg>
  )
}

export function Sparkline({ points, color = '#7C5CFC', width = 60, height = 24 }) {
  if (!points || points.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - ((p - min) / range) * height}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

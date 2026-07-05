// Shared building blocks for the Volunteers Hub (Dashboard, Directory, Applications,
// Coverage, Training, Recognition, Reports). Kept in one file so every module speaks
// the same visual language without re-declaring the same style objects everywhere.
import React from 'react'
import { motion } from 'framer-motion'

export const PURPLE = '#7C5CFC'
export const PAGE_BG = '#F6F8FC'

export function glass(extra = {}) {
  return {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(15,23,42,0.06)',
    borderRadius: 24,
    boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
    ...extra,
  }
}

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.045, duration: 0.35, ease: 'easeOut' } }),
}

export function Card({ children, style, ...rest }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={fadeUp}
      style={{ ...glass(), padding: 20, ...style }} {...rest}>
      {children}
    </motion.div>
  )
}

export function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span>{icon}</span>}{title}
        </div>
        {subtitle && <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function Badge({ children, color = '#475569', bg = '#F1F5F9' }) {
  return (
    <span style={{ background: bg, color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export function Avatar({ name, photoUrl, size = 40, color = PURPLE }) {
  return photoUrl ? (
    <img src={photoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, #6366F1)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 900, color: '#fff',
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

export function CountUp({ value, style }) {
  const [display, setDisplay] = React.useState(0)
  React.useEffect(() => {
    let frame
    const start = performance.now()
    const duration = 700
    const from = 0
    const to = Number(value) || 0
    function tick(now) {
      const t = Math.min((now - start) / duration, 1)
      setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span style={style}>{display}</span>
}

export function statusStyle(status) {
  const map = {
    active: { bg: 'rgba(34,197,94,0.12)', color: '#15803D', label: '● Active' },
    available: { bg: 'rgba(34,197,94,0.12)', color: '#15803D', label: 'Available' },
    pending: { bg: 'rgba(245,158,11,0.14)', color: '#B45309', label: 'Pending' },
    unavailable: { bg: 'rgba(148,163,184,0.16)', color: '#475569', label: 'Unavailable' },
    rejected: { bg: 'rgba(239,68,68,0.12)', color: '#B91C1C', label: 'Rejected' },
    expiring: { bg: 'rgba(245,158,11,0.14)', color: '#B45309', label: 'Expiring' },
    expired: { bg: 'rgba(239,68,68,0.12)', color: '#B91C1C', label: 'Expired' },
    complete: { bg: 'rgba(34,197,94,0.12)', color: '#15803D', label: 'Complete' },
  }
  return map[status] || { bg: '#F1F5F9', color: '#475569', label: status || '—' }
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = (new Date(dateStr) - new Date())
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function sessionHours(s) {
  if (!s?.start_time || !s?.end_time) return 0
  const [sh, sm] = s.start_time.split(':').map(Number)
  const [eh, em] = s.end_time.split(':').map(Number)
  const start = sh + (sm || 0) / 60
  const end = eh + (em || 0) / 60
  return Math.max(0, end - start)
}

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(15,23,42,0.1)',
  fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0F172A',
}

export const btnPrimary = (color) => ({
  padding: '9px 18px', borderRadius: 10, border: 'none', background: color, color: '#fff',
  fontSize: 13, fontWeight: 800, cursor: 'pointer',
})

export const btnGhost = {
  padding: '9px 18px', borderRadius: 10, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff',
  color: '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

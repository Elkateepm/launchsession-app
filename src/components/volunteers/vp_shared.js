// Shared building blocks for the redesigned Volunteer Portal.
import React from 'react'
import { motion } from 'framer-motion'

// Every activity type gets its own colour theme + icon so session cards feel unique at a glance.
export const ACTIVITY_THEMES = {
  football: { icon: '⚽', gradient: 'linear-gradient(135deg,#16A34A,#15803D)', label: 'Football' },
  sport: { icon: '⚽', gradient: 'linear-gradient(135deg,#16A34A,#15803D)', label: 'Sport' },
  swimming: { icon: '🏊', gradient: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: 'Swimming' },
  water: { icon: '🌊', gradient: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: 'Water Activity' },
  forest: { icon: '🌲', gradient: 'linear-gradient(135deg,#4D7C0F,#365314)', label: 'Forest School' },
  camping: { icon: '🏕️', gradient: 'linear-gradient(135deg,#EA580C,#7C2D12)', label: 'Camping' },
  residential: { icon: '🌅', gradient: 'linear-gradient(135deg,#F97316,#BE185D)', label: 'Residential' },
  trip: { icon: '🚌', gradient: 'linear-gradient(135deg,#F59E0B,#B45309)', label: 'Trip' },
  arts: { icon: '🎨', gradient: 'linear-gradient(135deg,#EC4899,#9D174D)', label: 'Arts' },
  cooking: { icon: '🍳', gradient: 'linear-gradient(135deg,#F97316,#C2410C)', label: 'Cooking' },
  youth_club: { icon: '🎉', gradient: 'linear-gradient(135deg,#8B5CF6,#5B21B6)', label: 'Youth Club' },
  activity: { icon: '🎉', gradient: 'linear-gradient(135deg,#8B5CF6,#5B21B6)', label: 'Activity' },
  mentoring: { icon: '🤝', gradient: 'linear-gradient(135deg,#64748B,#334155)', label: 'Mentoring' },
  workshop: { icon: '🛠️', gradient: 'linear-gradient(135deg,#7C5CFC,#4C1D95)', label: 'Workshop' },
  training: { icon: '📚', gradient: 'linear-gradient(135deg,#6366F1,#3730A3)', label: 'Training' },
  meeting: { icon: '👥', gradient: 'linear-gradient(135deg,#64748B,#334155)', label: 'Meeting' },
}
export function activityTheme(sessionType) {
  const key = (sessionType || '').toLowerCase().replace(/\s+/g, '_')
  return ACTIVITY_THEMES[key] || { icon: '🎉', gradient: 'linear-gradient(135deg,#7C5CFC,#4C1D95)', label: sessionType || 'Session' }
}

// Tier / rank progression from cumulative hours
export function tierFor(hours) {
  if (hours >= 100) return { name: 'Champion', color: '#F5D000', next: null, prevThreshold: 100 }
  if (hours >= 50) return { name: 'Gold', color: '#F0A500', next: 'Champion', nextThreshold: 100, prevThreshold: 50 }
  if (hours >= 25) return { name: 'Silver', color: '#94A3B8', next: 'Gold', nextThreshold: 50, prevThreshold: 25 }
  return { name: 'Green', color: '#4ADE80', next: 'Silver', nextThreshold: 25, prevThreshold: 0 }
}

// Achievement definitions — all computed client-side from data that already exists
// (attendance, training, recognition), so no new gamification schema is required.
export const ACHIEVEMENT_DEFS = [
  { key: 'first_session', icon: '🌟', label: 'First Session', desc: 'Completed your first session', check: (d) => d.sessionsCompleted >= 1 },
  { key: 'ten_sessions', icon: '🚀', label: '10 Sessions', desc: 'Delivered 10 sessions', check: (d) => d.sessionsCompleted >= 10 },
  { key: 'fifty_sessions', icon: '🏆', label: '50 Sessions', desc: 'Delivered 50 sessions', check: (d) => d.sessionsCompleted >= 50 },
  { key: 'fifty_hours', icon: '🏅', label: '50 Hours', desc: 'Volunteered 50 hours', check: (d) => d.totalHours >= 50 },
  { key: 'hundred_young_people', icon: '❤️', label: '100 Young People', desc: 'Supported 100+ young people', check: (d) => d.youngPeopleSupported >= 100 },
  { key: 'streak_7', icon: '🔥', label: '7 Week Streak', desc: 'Active 7 weeks running', check: (d) => d.streakWeeks >= 7 },
  { key: 'dbs_complete', icon: '🎓', label: 'DBS Complete', desc: 'DBS check verified', check: (d) => d.dbsVerified },
  { key: 'safeguarding_trained', icon: '🛡️', label: 'Safeguarding Trained', desc: 'Completed safeguarding training', check: (d) => d.safeguardingTrained },
]

export function computeAchievements(data) {
  return ACHIEVEMENT_DEFS.map(a => ({ ...a, earned: a.check(data) }))
}

// Glass card style shared across the portal
export function glassCard(extra = {}) {
  return {
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 22, border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 8px 32px -14px rgba(30,41,59,0.15)',
    ...extra,
  }
}

export function CountUp({ value, decimals = 0, duration = 0.8 }) {
  const [display, setDisplay] = React.useState(0)
  React.useEffect(() => {
    const start = performance.now()
    const from = display
    const to = Number(value) || 0
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{display.toFixed(decimals)}</>
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

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SLOTS = [['morning', '☀️ Morning'], ['afternoon', '🌤️ Afternoon'], ['evening', '🌙 Evening']]

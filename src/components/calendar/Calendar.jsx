import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays, subDays, isSameMonth, parseISO, isToday, addWeeks, subWeeks } from 'date-fns'
import { useRealtimeTable } from '../../lib/useRealtimeTable'

const TYPE_CONFIG = {
  activity:  { label: 'Activity',  icon: '🏃', color: '#1B9AAA', bg: 'rgba(27,154,170,0.12)',  border: 'rgba(27,154,170,0.35)'  },
  workshop:  { label: 'Workshop',  icon: '🛠️', color: '#417505', bg: 'rgba(65,117,5,0.12)',   border: 'rgba(65,117,5,0.35)'   },
  trip:      { label: 'Day Trip',  icon: '🚌', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   border: 'rgba(217,119,6,0.35)'   },
  holiday:   { label: 'Holiday',   icon: '🏖️', color: '#9B59B6', bg: 'rgba(155,89,182,0.12)',  border: 'rgba(155,89,182,0.35)'  },
  sports:    { label: 'Sport',     icon: '⚽', color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.35)'   },
  arts:      { label: 'Arts',      icon: '🎨', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)',  border: 'rgba(124,58,237,0.35)'  },
  mentoring: { label: 'Mentoring', icon: '🤝', color: '#2563eb', bg: 'rgba(37,99,235,0.12)',   border: 'rgba(37,99,235,0.35)'   },
}
const getCfg = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.activity
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Approximate England-wide school holiday windows (varies by local authority — shown as a general reference layer)
const SCHOOL_HOLIDAYS = [
  { start: '2025-10-27', end: '2025-10-31', label: 'Half Term' },
  { start: '2025-12-22', end: '2026-01-02', label: 'Christmas Holidays' },
  { start: '2026-02-16', end: '2026-02-20', label: 'Half Term' },
  { start: '2026-04-06', end: '2026-04-17', label: 'Easter Holidays' },
  { start: '2026-05-25', end: '2026-05-29', label: 'Half Term' },
  { start: '2026-07-22', end: '2026-09-01', label: 'Summer Holidays' },
  { start: '2026-10-26', end: '2026-10-30', label: 'Half Term' },
  { start: '2026-12-21', end: '2027-01-01', label: 'Christmas Holidays' },
]

// A curated set of fun / novelty / awareness days worth celebrating with young people
const NOVELTY_DAYS = {
  '01-01': { title: "New Year's Day", icon: '🎉' },
  '01-21': { title: 'National Hug Day', icon: '🤗' },
  '02-09': { title: 'National Pizza Day', icon: '🍕' },
  '03-14': { title: 'Pi Day', icon: '🥧' },
  '03-20': { title: 'International Day of Happiness', icon: '😊' },
  '04-01': { title: "April Fools' Day", icon: '🤪' },
  '04-22': { title: 'Earth Day', icon: '🌍' },
  '05-04': { title: 'Star Wars Day', icon: '⭐' },
  '05-20': { title: 'World Bee Day', icon: '🐝' },
  '06-08': { title: 'World Oceans Day', icon: '🌊' },
  '06-21': { title: 'International Yoga Day', icon: '🧘' },
  '07-17': { title: 'World Emoji Day', icon: '😄' },
  '07-30': { title: 'International Day of Friendship', icon: '🤝' },
  '08-08': { title: 'International Cat Day', icon: '🐱' },
  '08-13': { title: 'International Left Handers Day', icon: '✋' },
  '09-19': { title: 'Talk Like a Pirate Day', icon: '🏴‍☠️' },
  '09-21': { title: 'International Day of Peace', icon: '🕊️' },
  '10-04': { title: 'World Animal Day', icon: '🐾' },
  '10-16': { title: 'World Food Day', icon: '🍎' },
  '10-31': { title: 'Halloween', icon: '🎃' },
  '11-05': { title: 'Bonfire Night', icon: '🎆' },
  '11-14': { title: 'World Kindness Day', icon: '💛' },
  '12-25': { title: 'Christmas Day', icon: '🎄' },
}


const KEYFRAMES = `
@keyframes cal-pop-in {
  0% { opacity: 0; transform: translateY(4px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cal-slide-in-right {
  0% { opacity: 0; transform: translateX(14px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes cal-slide-in-left {
  0% { opacity: 0; transform: translateX(-14px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes cal-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes cal-today-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
  50% { box-shadow: 0 0 0 6px var(--pulse-color, rgba(27,154,170,0.15)); }
}
@keyframes cal-sparkle-burst {
  0% { transform: translate(0, 0) scale(0); opacity: 0; }
  15% { transform: translate(calc(var(--tx) * 0.3), calc(var(--ty) * 0.3)) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
}
@keyframes cal-sparkle-glow {
  0% { transform: scale(0); opacity: 0; }
  25% { transform: scale(1.4); opacity: 0.9; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes cal-bounce-in {
  0% { opacity: 0; transform: scale(0.7); }
  60% { opacity: 1; transform: scale(1.08); }
  100% { transform: scale(1); }
}
`

function ConfettiBurst({ color, secondary }) {
  const tones = useMemo(() => [color, secondary || color, '#fff'], [color, secondary])
  const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 10 + (Math.random() * 0.4 - 0.2)
    const distance = 34 + Math.random() * 26
    return {
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 8, // slight upward bias
      delay: (Math.random() * 0.12).toFixed(2),
      duration: (0.9 + Math.random() * 0.35).toFixed(2),
      size: 3 + Math.random() * 3,
      tone: tones[i % tones.length],
    }
  }), [tones])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft central glow flash */}
      <div style={{ position: 'absolute', width: 26, height: 26, borderRadius: '50%', background: `radial-gradient(circle, ${color}55, transparent 70%)`, animation: 'cal-sparkle-glow 0.7s ease-out forwards' }} />
      {/* Sparkle particles drifting outward */}
      {particles.map((p, i) => (
        <div key={i}
          style={{
            position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
            background: p.tone, boxShadow: `0 0 4px ${p.tone}80`,
            animation: `cal-sparkle-burst ${p.duration}s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}s forwards`,
            '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
          }}
        />
      ))}
    </div>
  )
}

function PlanPickerModal({ date, org, onClose, onNavigate }) {
  const primary = org?.primary_color || '#1B9AAA'
  const activeModules = org?.modules || []
  const hasModule = (key) => activeModules.includes(key)
  const dateLabel = date ? format(parseISO(date), 'EEEE, d MMMM yyyy') : ''

  const options = [
    { key: 'planner', icon: '📅', title: 'Session', desc: 'Plan a regular activity, workshop or club session', colour: '#8B5CF6', always: true },
    { key: 'events_trips', icon: '✈️', title: 'Event or Trip', desc: 'Day trip, holiday, or one-off special event', colour: '#D97706', always: true },
    { key: 'resource_booking', icon: '🗓️', title: 'Resource Booking', desc: 'Reserve a room, vehicle or piece of equipment', colour: '#2563EB', module: 'resource_booking' },
  ].filter(o => o.always || hasModule(o.module))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'cal-fade-in 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'cal-bounce-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div style={{ padding: '22px 24px 16px', borderBottom: `1px solid ${primary}15`, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>×</button>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#111' }}>What would you like to plan?</div>
          {dateLabel && <div style={{ fontSize: 12.5, color: '#9CA3AF', fontWeight: 600, marginTop: 4 }}>{dateLabel}</div>}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((o, i) => (
            <button key={o.key} onClick={() => { onClose(); if (onNavigate) onNavigate(o.key) }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${o.colour}25`, background: o.colour + '08', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', animation: `cal-pop-in 0.25s ease ${i * 0.05}s both` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = o.colour + '60'; e.currentTarget.style.background = o.colour + '14'; e.currentTarget.style.transform = 'translateX(2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = o.colour + '25'; e.currentTarget.style.background = o.colour + '08'; e.currentTarget.style.transform = 'none' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: o.colour + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{o.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{o.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1, lineHeight: 1.3 }}>{o.desc}</div>
              </div>
              <div style={{ color: o.colour, fontSize: 16 }}>›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionModal({ session, org, onClose, onDelete }) {
  const cfg = getCfg(session.session_type)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${session.title}"?`)) return
    setDeleting(true)
    await supabase.from('sessions').delete().eq('id', session.id)
    onDelete(session.id)
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'cal-fade-in 0.2s ease' }}>
      <style>{KEYFRAMES}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'cal-bounce-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div style={{ background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}08)`, borderBottom: `3px solid ${cfg.color}`, padding: '24px 24px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{cfg.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 4 }}>{session.title}</div>
          <span style={{ background: cfg.color, color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 800 }}>{cfg.label}</span>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { icon: '📅', label: 'Date', value: session.session_date ? format(parseISO(session.session_date), 'EEEE, d MMMM yyyy') : '—' },
              { icon: '⏰', label: 'Time', value: session.start_time ? `${session.start_time}${session.end_time ? ` – ${session.end_time}` : ''}` : '—' },
              { icon: '📍', label: 'Location', value: session.location || '—' },
              { icon: '👥', label: 'Capacity', value: session.max_capacity ? `${session.max_capacity} max` : '—' },
            ].map(d => (
              <div key={d.label} style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{d.icon} {d.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{d.value}</div>
              </div>
            ))}
          </div>
          {session.description && (
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {session.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            <button onClick={handleDelete} disabled={deleting} style={{ padding: '11px 18px', borderRadius: 12, border: '1.5px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {deleting ? 'Deleting...' : '🗑️ Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Calendar({ org, onSessionChanged, onNavigate }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month')
  const [selectedSession, setSelectedSession] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [navDirection, setNavDirection] = useState('right')
  const [showConfettiFor, setShowConfettiFor] = useState(null)
  const [bankHolidays, setBankHolidays] = useState({})
  const primary = org?.primary_color || '#1B9AAA'
  const gridKey = useRef(0)

  useEffect(() => {
    fetch('https://www.gov.uk/bank-holidays.json')
      .then(res => res.json())
      .then(data => {
        const events = data?.['england-and-wales']?.events || []
        const map = {}
        events.forEach(e => { map[e.date] = e.title })
        setBankHolidays(map)
      })
      .catch(() => {})
  }, [])

  const getSchoolHoliday = useCallback((dateStr) => {
    return SCHOOL_HOLIDAYS.find(h => dateStr >= h.start && dateStr <= h.end)
  }, [])

  const getNoveltyDay = useCallback((dateStr) => {
    return NOVELTY_DAYS[dateStr.slice(5)] || null
  }, [])

  const load = useCallback(async (isBackground) => {
    if (!org?.id) return
    if (!isBackground) setLoading(true)
    const { data } = await supabase.from('sessions').select('*').eq('org_id', org.id).order('session_date', { ascending: true })
    setSessions(data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load(false) }, [load])
  useRealtimeTable('sessions', () => load(true), { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 5000 })

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  const navigate = (dir) => {
    setNavDirection(dir > 0 ? 'right' : 'left')
    gridKey.current += 1
    setCurrentDate(d => {
      if (viewMode === 'month') return dir > 0 ? addMonths(d, 1) : subMonths(d, 1)
      if (viewMode === 'week') return dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1)
      return dir > 0 ? addDays(d, 1) : subDays(d, 1)
    })
  }

  const jumpToday = () => {
    setNavDirection('right')
    gridKey.current += 1
    setCurrentDate(new Date())
  }

  const filtered = filterType === 'all' ? sessions : sessions.filter(s => s.session_type === filterType)

  const sessionsByDate = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      if (!s.session_date) return
      if (!map[s.session_date]) map[s.session_date] = []
      map[s.session_date].push(s)
    })
    return map
  }, [filtered])

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const startPad = (start.getDay() + 6) % 7
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d))
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  const upcomingSessions = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return sessions.filter(s => s.session_date >= today).slice(0, 5)
  }, [sessions])

  const thisMonthCount = useMemo(() => {
    const m = format(currentDate, 'yyyy-MM')
    return sessions.filter(s => s.session_date?.startsWith(m)).length
  }, [sessions, currentDate])

  const deleteSession = (id) => {
    setSessions(s => s.filter(x => x.id !== id))
    if (onSessionChanged) onSessionChanged()
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const slideAnim = navDirection === 'right' ? 'cal-slide-in-right' : 'cal-slide-in-left'

  const dayKey = format(currentDate, 'yyyy-MM-dd')
  const daySessionsForDayView = sessionsByDate[dayKey] || []

  const [planPickerDate, setPlanPickerDate] = useState(null)

  const handlePlanForDate = (dateStr) => {
    setShowConfettiFor(dateStr)
    setTimeout(() => setShowConfettiFor(null), 1400)
    setPlanPickerDate(dateStr)
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      <style>{KEYFRAMES}</style>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '20px 24px', marginBottom: 16, boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 -1px 0 ${primary}14 inset, 0 18px 40px -18px ${primary}35` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>📅 Calendar</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{thisMonthCount} session{thisMonthCount !== 1 ? 's' : ''} this month · {sessions.length} total</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                {['month','week','day'].map(v => (
                  <button key={v} onClick={() => { setNavDirection('right'); gridKey.current += 1; setViewMode(v) }} style={{ padding: '7px 12px', border: 'none', background: viewMode === v ? primary : 'transparent', color: viewMode === v ? '#fff' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                    {v === 'month' ? '📅 Month' : v === 'week' ? '📋 Week' : '☀️ Day'}
                  </button>
                ))}
              </div>
              <button onClick={jumpToday} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${primary}`, background: '#fff', color: primary, fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: 'transform 0.1s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>Today</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterType('all')} style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${filterType === 'all' ? primary : '#e5e7eb'}`, background: filterType === 'all' ? primary + '15' : '#fff', color: filterType === 'all' ? primary : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
              All
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setFilterType(key)} style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${filterType === key ? cfg.color : '#e5e7eb'}`, background: filterType === key ? cfg.color + '15' : '#fff', color: filterType === key ? cfg.color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <button onClick={() => navigate(-1)}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#F9FAFB', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = primary + '12'; e.currentTarget.style.borderColor = primary + '40' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#e5e7eb' }}>‹</button>
            <div key={gridKey.current + '-label'} style={{ textAlign: 'center', animation: `${slideAnim} 0.25s ease` }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                {viewMode === 'month'
                  ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : viewMode === 'week'
                  ? `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM yyyy')}`
                  : format(currentDate, 'EEEE, d MMMM yyyy')
                }
              </div>
            </div>
            <button onClick={() => navigate(1)}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#F9FAFB', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = primary + '12'; e.currentTarget.style.borderColor = primary + '40' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#e5e7eb' }}>›</button>
          </div>

          {viewMode !== 'day' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F8FAFC', borderBottom: '1px solid #F3F4F6' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${primary}30`, borderTopColor: primary, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.7s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Loading sessions...
            </div>
          ) : viewMode === 'month' ? (
            <div key={gridKey.current} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid #F3F4F6', animation: `${slideAnim} 0.28s ease` }}>
              {monthDays.map((day, i) => {
                if (!day) return <div key={`e${i}`} style={{ minHeight: 110, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }} />
                const key = format(day, 'yyyy-MM-dd')
                const daySessions = sessionsByDate[key] || []
                const today = isToday(day)
                const inMonth = isSameMonth(day, currentDate)
                const isPastEmpty = !today && day < new Date() && daySessions.length === 0 && inMonth
                const bankHoliday = bankHolidays[key]
                const schoolHoliday = getSchoolHoliday(key)
                const novelty = getNoveltyDay(key)
                const specialBg = bankHoliday ? '#FEF3C799' : schoolHoliday ? `${primary}08` : 'transparent'
                return (
                  <div key={key} onClick={() => daySessions.length === 0 && inMonth && !isPastEmpty ? handlePlanForDate(key) : null}
                    style={{ minHeight: 110, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', padding: '8px 6px', background: today ? `${primary}0A` : inMonth ? '#fff' : '#FAFAFA', position: 'relative', transition: 'background 0.15s', cursor: inMonth && daySessions.length === 0 && !isPastEmpty ? 'pointer' : 'default', '--pulse-color': primary + '26', animation: today ? 'cal-today-pulse 2.5s ease-in-out infinite' : 'none' }}
                    onMouseEnter={e => { if (inMonth) e.currentTarget.style.background = today ? `${primary}14` : '#FAFBFC' }}
                    onMouseLeave={e => { e.currentTarget.style.background = today ? `${primary}0A` : inMonth ? '#fff' : '#FAFAFA' }}>
                    {inMonth && specialBg !== 'transparent' && (
                      <div style={{ position: 'absolute', inset: 0, background: specialBg, pointerEvents: 'none' }} />
                    )}
                    {showConfettiFor === key && <ConfettiBurst color={primary} secondary={org?.secondary_color} />}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, alignItems: 'center' }}>
                        {inMonth && bankHoliday && (
                          <span title={bankHoliday} style={{ fontSize: 9, background: '#F59E0B26', color: '#B45309', borderRadius: 4, padding: '1px 4px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>🏵️ {bankHoliday}</span>
                        )}
                        {inMonth && !bankHoliday && novelty && (
                          <span title={novelty.title} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{novelty.title}</span>
                        )}
                      </div>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: today ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: today ? 900 : 600, color: today ? '#fff' : inMonth ? '#374151' : '#D1D5DB', boxShadow: today ? `0 2px 8px ${primary}50` : 'none', flexShrink: 0 }}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
                      {daySessions.slice(0, 3).map((s, si) => {
                        const cfg = getCfg(s.session_type)
                        return (
                          <button key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedSession(s) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: `1px solid ${cfg.border}`, background: cfg.bg, cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 11, fontWeight: 700, color: cfg.color, transition: 'all 0.1s', lineHeight: 1.3, animation: `cal-pop-in 0.25s ease ${si * 0.04}s both` }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)'; e.currentTarget.style.transform = 'translateX(1px)' }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}>
                            <span style={{ flexShrink: 0 }}>{cfg.icon}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                          </button>
                        )
                      })}
                      {daySessions.length > 3 && (
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, paddingLeft: 4 }}>+{daySessions.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : viewMode === 'week' ? (
            <div key={gridKey.current} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid #F3F4F6', animation: `${slideAnim} 0.28s ease` }}>
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const daySessions = sessionsByDate[key] || []
                const today = isToday(day)
                return (
                  <div key={key} style={{ minHeight: 300, borderRight: '1px solid #F3F4F6', padding: '10px 8px', background: today ? `${primary}08` : '#fff', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: today ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: today ? 900 : 700, color: today ? '#fff' : '#374151', boxShadow: today ? `0 2px 8px ${primary}50` : 'none' }}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {daySessions.map((s, si) => {
                        const cfg = getCfg(s.session_type)
                        return (
                          <button key={s.id} onClick={() => setSelectedSession(s)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 9px', borderRadius: 9, border: `1.5px solid ${cfg.border}`, background: cfg.bg, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.1s', animation: `cal-pop-in 0.25s ease ${si * 0.05}s both` }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'scale(1)' }}>
                            <div style={{ fontSize: 13 }}>{cfg.icon}</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.title}</div>
                            {s.start_time && <div style={{ fontSize: 10, color: cfg.color, opacity: 0.8, fontWeight: 600 }}>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</div>}
                          </button>
                        )
                      })}
                      {daySessions.length === 0 && (
                        <div onClick={() => handlePlanForDate(key)} style={{ fontSize: 20, color: '#E5E7EB', textAlign: 'center', marginTop: 20, cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = primary + '80'; e.currentTarget.style.transform = 'scale(1.15)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#E5E7EB'; e.currentTarget.style.transform = 'scale(1)' }}>+</div>
                      )}
                    </div>
                    {showConfettiFor === key && <ConfettiBurst color={primary} secondary={org?.secondary_color} />}
                  </div>
                )
              })}
            </div>
          ) : (
            <div key={gridKey.current} style={{ padding: '24px 28px', flex: 1, animation: `${slideAnim} 0.28s ease`, position: 'relative' }}>
              {isToday(currentDate) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: primary, background: primary + '12', borderRadius: 99, padding: '4px 12px', marginBottom: 16 }}>
                  🔴 TODAY
                </div>
              )}
              {daySessionsForDayView.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12, animation: 'cal-bounce-in 0.4s ease' }}>🌤️</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Nothing planned for this day</div>
                  <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>A free day — or the perfect time to plan something new.</div>
                  <button onClick={() => handlePlanForDate(dayKey)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: `0 8px 20px ${primary}40` }}>
                    + Plan a Session
                  </button>
                  {showConfettiFor === dayKey && <ConfettiBurst color={primary} secondary={org?.secondary_color} />}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {daySessionsForDayView
                    .slice()
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                    .map((s, si) => {
                      const cfg = getCfg(s.session_type)
                      return (
                        <button key={s.id} onClick={() => setSelectedSession(s)}
                          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 16, border: `1.5px solid ${cfg.border}`, background: cfg.bg, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', animation: `cal-pop-in 0.3s ease ${si * 0.06}s both` }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${cfg.color}25` }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 14, background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{cfg.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{s.title}</div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: cfg.color, fontWeight: 700 }}>
                              {s.start_time && <span>⏰ {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</span>}
                              {s.location && <span>📍 {s.location}</span>}
                              {s.max_capacity && <span>👥 {s.max_capacity} max</span>}
                            </div>
                          </div>
                          <span style={{ background: cfg.color, color: '#fff', borderRadius: 99, padding: '4px 12px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{cfg.label}</span>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #EEF0F3', borderRadius: 16, padding: 16, boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 10px 20px -14px rgba(15,23,42,0.18)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 12 }}>This Month</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Sessions', value: thisMonthCount, color: primary },
              { label: 'Types', value: [...new Set(sessions.filter(s => s.session_date?.startsWith(format(currentDate, 'yyyy-MM'))).map(s => s.session_type))].length, color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #EEF0F3', borderRadius: 16, padding: 16, flex: 1, boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 10px 20px -14px rgba(15,23,42,0.18)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 12 }}>⏭ Upcoming</div>
          {upcomingSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📅</div>
              No upcoming sessions.<br />Plan one in the Session Planner.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingSessions.map(s => {
                const cfg = getCfg(s.session_type)
                const dateStr = s.session_date ? format(parseISO(s.session_date), 'EEE d MMM') : '—'
                const isSessionToday = s.session_date === todayStr
                return (
                  <button key={s.id} onClick={() => setSelectedSession(s)}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${isSessionToday ? cfg.color + '50' : '#F3F4F6'}`, background: isSessionToday ? cfg.bg : '#FAFAFA', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.background = cfg.bg }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isSessionToday ? cfg.color + '50' : '#F3F4F6'; e.currentTarget.style.background = isSessionToday ? cfg.bg : '#FAFAFA' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, marginTop: 2 }}>{dateStr}</div>
                      {s.start_time && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</div>}
                      {isSessionToday && <div style={{ fontSize: 10, fontWeight: 800, color: cfg.color, marginTop: 2 }}>🔴 TODAY</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #EEF0F3', borderRadius: 16, padding: 16, boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 10px 20px -14px rgba(15,23,42,0.18)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 10 }}>Legend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const count = sessions.filter(s => s.session_type === key).length
              if (count === 0) return null
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#374151', fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
                  <span style={{ color: '#9CA3AF', fontWeight: 700 }}>{count}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#FEF3C7', border: '1px solid #FDE68A', flexShrink: 0 }} />
              <span style={{ color: '#9CA3AF' }}>🏵️ UK Bank Holiday</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: primary + '10', border: `1px solid ${primary}30`, flexShrink: 0 }} />
              <span style={{ color: '#9CA3AF' }}>School Holiday (approx.)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', opacity: 0.65 }}>Aa</span>
              <span style={{ color: '#9CA3AF' }}>Fun / awareness day</span>
            </div>
          </div>
        </div>
      </div>

      {selectedSession && (
        <SessionModal session={selectedSession} org={org} onClose={() => setSelectedSession(null)} onDelete={deleteSession} />
      )}

      {planPickerDate && (
        <PlanPickerModal date={planPickerDate} org={org} onClose={() => setPlanPickerDate(null)} onNavigate={onNavigate} />
      )}
    </div>
  )
}

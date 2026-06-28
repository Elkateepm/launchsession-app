import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, parseISO, isToday, addWeeks, subWeeks } from 'date-fns'

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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        {/* Coloured header */}
        <div style={{ background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}08)`, borderBottom: `3px solid ${cfg.color}`, padding: '24px 24px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{cfg.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 4 }}>{session.title}</div>
          <span style={{ background: cfg.color, color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 800 }}>{cfg.label}</span>
        </div>
        {/* Details */}
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

export default function Calendar({ org }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // 'month' | 'week'
  const [selectedSession, setSelectedSession] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data } = await supabase.from('sessions').select('*').eq('org_id', org.id).order('session_date', { ascending: true })
    setSessions(data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

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

  // ── Month view helpers ──
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const startPad = (start.getDay() + 6) % 7 // Mon=0
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d))
    return days
  }, [currentDate])

  // ── Week view helpers ──
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

  const deleteSession = (id) => setSessions(s => s.filter(x => x.id !== id))

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      {/* ── MAIN CALENDAR ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>📅 Calendar</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{thisMonthCount} session{thisMonthCount !== 1 ? 's' : ''} this month · {sessions.length} total</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* View toggle */}
              <div style={{ display: 'flex', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                {['month','week'].map(v => (
                  <button key={v} onClick={() => setViewMode(v)} style={{ padding: '7px 14px', border: 'none', background: viewMode === v ? primary : 'transparent', color: viewMode === v ? '#fff' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {v === 'month' ? '📅 Month' : '📋 Week'}
                  </button>
                ))}
              </div>
              {/* Today */}
              <button onClick={() => setCurrentDate(new Date())} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${primary}`, background: '#fff', color: primary, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Today</button>
            </div>
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterType('all')} style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${filterType === 'all' ? primary : '#e5e7eb'}`, background: filterType === 'all' ? primary + '15' : '#fff', color: filterType === 'all' ? primary : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              All
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setFilterType(key)} style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${filterType === key ? cfg.color : '#e5e7eb'}`, background: filterType === key ? cfg.color + '15' : '#fff', color: filterType === key ? cfg.color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar shell */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', flex: 1 }}>
          {/* Month/week nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <button onClick={() => setCurrentDate(d => viewMode === 'month' ? subMonths(d, 1) : subWeeks(d, 1))}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#F9FAFB', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                {viewMode === 'month'
                  ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM yyyy')}`
                }
              </div>
            </div>
            <button onClick={() => setCurrentDate(d => viewMode === 'month' ? addMonths(d, 1) : addWeeks(d, 1))}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#F9FAFB', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F8FAFC', borderBottom: '1px solid #F3F4F6' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>Loading sessions...</div>
          ) : viewMode === 'month' ? (
            /* ── MONTH GRID ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid #F3F4F6' }}>
              {monthDays.map((day, i) => {
                if (!day) return <div key={`e${i}`} style={{ minHeight: 110, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }} />
                const key = format(day, 'yyyy-MM-dd')
                const daySessions = sessionsByDate[key] || []
                const today = isToday(day)
                const inMonth = isSameMonth(day, currentDate)
                return (
                  <div key={key} style={{ minHeight: 110, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', padding: '8px 6px', background: today ? `${primary}08` : inMonth ? '#fff' : '#FAFAFA', position: 'relative', transition: 'background 0.1s' }}>
                    {/* Day number */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: today ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: today ? 900 : 600, color: today ? '#fff' : inMonth ? '#374151' : '#D1D5DB' }}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    {/* Sessions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {daySessions.slice(0, 3).map(s => {
                        const cfg = getCfg(s.session_type)
                        return (
                          <button key={s.id} onClick={() => setSelectedSession(s)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: `1px solid ${cfg.border}`, background: cfg.bg, cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 11, fontWeight: 700, color: cfg.color, transition: 'all 0.1s', lineHeight: 1.3 }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
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
          ) : (
            /* ── WEEK VIEW ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid #F3F4F6' }}>
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const daySessions = sessionsByDate[key] || []
                const today = isToday(day)
                return (
                  <div key={key} style={{ minHeight: 300, borderRight: '1px solid #F3F4F6', padding: '10px 8px', background: today ? `${primary}08` : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: today ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: today ? 900 : 700, color: today ? '#fff' : '#374151' }}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {daySessions.map(s => {
                        const cfg = getCfg(s.session_type)
                        return (
                          <button key={s.id} onClick={() => setSelectedSession(s)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 9px', borderRadius: 9, border: `1.5px solid ${cfg.border}`, background: cfg.bg, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                            <div style={{ fontSize: 13 }}>{cfg.icon}</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.title}</div>
                            {s.start_time && <div style={{ fontSize: 10, color: cfg.color, opacity: 0.8, fontWeight: 600 }}>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</div>}
                          </button>
                        )
                      })}
                      {daySessions.length === 0 && (
                        <div style={{ fontSize: 11, color: '#E5E7EB', textAlign: 'center', marginTop: 20 }}>—</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Mini month stats */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
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

        {/* Upcoming sessions */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, flex: 1 }}>
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

        {/* Session type legend */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
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
        </div>
      </div>

      {/* Session detail modal */}
      {selectedSession && (
        <SessionModal session={selectedSession} org={org} onClose={() => setSelectedSession(null)} onDelete={deleteSession} />
      )}
    </div>
  )
}

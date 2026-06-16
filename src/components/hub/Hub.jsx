import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren } from '../../lib/hooks'

// ─── ENCOURAGEMENT BANNER ─────────────────────────────────────
function EncouragementBanner({ session, orgName }) {
  const [stats, setStats] = useState(null)
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    if (!session?.id) return
    supabase.from('attendance').select('status').eq('session_id', session.id)
      .then(({ data }) => {
        if (data) setStats({
          total: data.length,
          signedIn: data.filter(a => a.status === 'signed_in').length,
          absent: data.filter(a => a.status === 'absent').length,
        })
      })
  }, [session?.id])

  const messages = [
    stats?.signedIn > 0
      ? `🌟 ${stats.signedIn} ${stats.signedIn === 1 ? 'child' : 'children'} signed in today — great work team!`
      : '👋 Ready for today? Sign children in when they arrive.',
    stats?.total > 0
      ? `📊 ${stats.total} expected today${stats.absent > 0 ? ` · ${stats.absent} absent` : ' · all accounted for!'}`
      : '✨ Every child deserves happiness — thank you for making it happen.',
    '💪 Your dedication makes a real difference to these children\'s lives.',
    `🏆 ${orgName} — building confidence, one session at a time.`,
  ].filter(Boolean)

  useEffect(() => {
    if (messages.length <= 1) return
    const timer = setInterval(() => {
      setFade(false)
      setTimeout(() => { setIndex(i => (i + 1) % messages.length); setFade(true) }, 400)
    }, 8000)
    return () => clearInterval(timer)
  }, [messages.length])

  return (
    <div style={{ margin: '16px 16px 0', background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B4E 100%)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52 }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>{messages[index]?.split(' ')[0]}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.4, opacity: fade ? 1 : 0, transition: 'opacity 0.4s ease', flex: 1 }}>
        {messages[index]?.slice(messages[index].indexOf(' ') + 1)}
      </div>
      {messages.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {messages.map((_, i) => (
            <div key={i} style={{ width: i === index ? 12 : 4, height: 4, borderRadius: 2, background: i === index ? '#F5D000' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── HERO CARD ────────────────────────────────────────────────
function HeroCard({ session, onViewRegister, primary }) {
  const { attendance } = useAttendance(session?.id)
  const signedIn  = attendance.filter(a => a.status === 'signed_in').length
  const expected  = attendance.filter(a => a.status === 'expected').length
  const absent    = attendance.filter(a => a.status === 'absent').length
  const signedOut = attendance.filter(a => a.status === 'signed_out').length
  const total     = attendance.length

  if (!session) return (
    <div style={{ margin: '16px 16px 0', background: `linear-gradient(135deg, ${primary}CC, ${primary}88)`, borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>TODAY</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>No session scheduled today</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Check the calendar for upcoming activities</div>
    </div>
  )

  const pct = total > 0 ? Math.round((signedIn / total) * 100) : 0

  return (
    <div style={{ margin: '16px 16px 0', background: 'linear-gradient(135deg, #0D1B2A 0%, #1A2E44 100%)', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />Session Live
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{session.title}</div>
        {session.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 12 }}>📍 {session.location.split(',')[0]}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { num: signedIn,  label: 'In',       color: '#4ADE80' },
            { num: expected,  label: 'Expected',  color: '#F5D000' },
            { num: absent,    label: 'Absent',    color: '#FF8080' },
            { num: signedOut, label: 'Left',      color: '#9FE1CB' },
          ].map(({ num, label, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 5, marginBottom: 4 }}>
          <div style={{ background: 'linear-gradient(90deg, #417505, #4ADE80)', width: pct + '%', height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 14 }}>{pct}% checked in · {total} total</div>

        <button onClick={onViewRegister} style={{ width: '100%', background: primary, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          Open Register →
        </button>
      </div>
    </div>
  )
}

// ─── QUICK ACTIONS ────────────────────────────────────────────
function QuickActions({ onNavigate, primary }) {
  const actions = [
    { icon: '📋', label: 'Child Bookings',  key: 'registers' },
    { icon: '❤️', label: 'Vol Bookings',    key: 'volunteers' },
    { icon: '🤝', label: 'Mentoring',       key: 'mentoring' },
    { icon: '💬', label: 'Parent Msgs',     key: 'messaging' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 16px 0' }}>
      {actions.map(a => (
        <button key={a.key} onClick={() => onNavigate(a.key)}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 8px', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280' }}>{a.label}</div>
        </button>
      ))}
    </div>
  )
}

// ─── ATTENDANCE WIDGET ────────────────────────────────────────
function AttendanceWidget({ session, orgId, primary }) {
  const { children } = useChildren(orgId)
  const { attendance } = useAttendance(session?.id)

  const BUBBLES = [
    { key: 'red',    label: 'RED',    color: '#E53935' },
    { key: 'green',  label: 'GREEN',  color: '#417505' },
    { key: 'yellow', label: 'YELLOW', color: '#B8860B' },
    { key: 'blue',   label: 'BLUE',   color: '#1B9AAA' },
    { key: 'purple', label: 'PURPLE', color: '#7B2D8B' },
    { key: 'teens',  label: 'TEENS',  color: '#1A1A1A' },
  ]

  const getStatus = (childId) => attendance.find(a => a.child_id === childId)?.status || 'unmarked'

  const bubbleStats = BUBBLES.map(b => {
    const bubbleKids = children.filter(c => {
      const g = (c.group_name || '').toLowerCase()
      return g === b.key || g === b.label.toLowerCase()
    })
    return { ...b, total: bubbleKids.length, signedIn: bubbleKids.filter(c => getStatus(c.id) === 'signed_in').length }
  }).filter(b => b.total > 0)

  if (!session || bubbleStats.length === 0) return null

  return (
    <div style={{ margin: '16px 16px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        {attendance.filter(a => a.status === 'signed_in').length} signed in · By Bubble
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {bubbleStats.map(b => (
          <div key={b.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: b.color, lineHeight: 1 }}>{b.signedIn}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{b.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── UPCOMING SESSIONS ────────────────────────────────────────
function UpcomingSessions({ orgId }) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!orgId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase.from('sessions').select('*').eq('org_id', orgId).gte('session_date', today).order('session_date').limit(5)
      .then(({ data }) => setSessions(data || []))
  }, [orgId])

  if (sessions.length === 0) return null

  const byMonth = sessions.reduce((acc, s) => {
    const month = format(new Date(s.session_date), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(s)
    return acc
  }, {})

  return (
    <div style={{ margin: '16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>📅 Coming Up</div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Next 30 days · {sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
      </div>
      {Object.entries(byMonth).map(([month, monthSessions]) => (
        <div key={month}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{month}</div>
          {monthSessions.map(s => {
            const date = new Date(s.session_date)
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 40 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>{format(date, 'EEE')}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1 }}>{format(date, 'd')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                    {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
                    {s.location ? ` · ${s.location.split(',')[0]}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── LIVE CLOCK ───────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{format(time, 'EEEE, d MMMM yyyy')}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#111', fontVariantNumeric: 'tabular-nums' }}>
        {format(time, 'HH:mm')}<span style={{ fontSize: 12, color: '#9ca3af' }}>{format(time, ':ss')}</span>
      </div>
    </div>
  )
}

// ─── HUB MAIN ────────────────────────────────────────────────
export default function Hub({ org, session: authSession, onNavigate }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'Organisation'

  const { sessions: todaySessions, session } = useTodaySession(orgId)
  const [nextSession, setNextSession] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!orgId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase.from('sessions').select('*').eq('org_id', orgId).gte('session_date', today).order('session_date').limit(1)
      .then(({ data }) => { if (data?.length > 0) setNextSession(data[0]) })
  }, [orgId])

  useEffect(() => {
    if (!session?.end_time) return
    const calc = () => {
      const [h, m] = session.end_time.split(':').map(Number)
      const end = new Date(); end.setHours(h, m, 0, 0)
      const diff = end - new Date()
      if (diff <= 0) { setTimeLeft(''); return }
      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`)
    }
    calc()
    const t = setInterval(calc, 30000)
    return () => clearInterval(t)
  }, [session])

  const bannerText = session
    ? `${session.title} · ${session.start_time}–${session.end_time}${timeLeft ? ` · ${timeLeft}` : ''}`
    : nextSession ? `Next: ${nextSession.title} · ${format(new Date(nextSession.session_date), 'd MMM')}`
    : orgName

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = authSession?.user?.email?.split('@')[0] || 'there'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BANNER */}
      <div style={{ background: session ? '#417505' : primary, padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }} onClick={() => onNavigate('calendar')}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#F5D000' }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>{bannerText}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#F5D000' }}>→</span>
      </div>

      {/* LOGO + GREETING */}
      <div style={{ background: '#fff', padding: '12px 16px 10px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{orgName}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>{greeting}, {firstName}! 👋</div>
      </div>

      <LiveClock />

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        <EncouragementBanner session={session} orgName={orgName} />

        {todaySessions.length === 0
          ? <HeroCard session={null} onViewRegister={() => onNavigate('registers')} primary={primary} />
          : todaySessions.map(s => (
            <HeroCard key={s.id} session={s} onViewRegister={() => onNavigate('registers')} primary={primary} />
          ))
        }

        <QuickActions onNavigate={onNavigate} primary={primary} />
        <AttendanceWidget session={session} orgId={orgId} primary={primary} />
        <UpcomingSessions orgId={orgId} />

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

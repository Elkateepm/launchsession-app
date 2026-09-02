import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useHrAttention } from '../../lib/hrAccess'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

// "What is happening right now."
//
// Distinct from Home, which introduces the organisation. This is the view a
// supervisor keeps open during a session: who is in the room, who was expected
// and hasn't arrived, which registers were left open, and who is on duty.
//
// Admin only — it aggregates attendance and staffing across every session,
// which is more than a volunteer running one group should see.

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 16 }

const londonToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

const nowMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find(p => p.type === 'hour').value)
  const m = Number(parts.find(p => p.type === 'minute').value)
  return h * 60 + m
}

const toMinutes = t => {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

const hhmm = t => (t ? String(t).slice(0, 5) : '')

/**
 * Where a session is in its day. Derived from the clock rather than stored,
 * because nothing writes a "running" flag and a stale one would be worse than
 * none.
 */
function sessionPhase(session) {
  const start = toMinutes(session.start_time)
  const end = toMinutes(session.end_time)
  const now = nowMinutes()
  if (start === null) return 'scheduled'
  if (end !== null && now > end) return 'finished'
  if (now >= start) return 'running'
  return 'upcoming'
}

const PHASE = {
  running: { label: 'Running now', dot: '#12B76A', bg: '#E7F8ED', text: '#04713C' },
  upcoming: { label: 'Later today', dot: '#7C5CFC', bg: '#F1EDFF', text: '#5B21B6' },
  finished: { label: 'Finished', dot: '#94A3B8', bg: '#F3F2F7', text: '#5A5772' },
  scheduled: { label: 'No time set', dot: '#94A3B8', bg: '#F3F2F7', text: '#5A5772' },
}

export default function Today({ org, session: authSession, userProfile, onNavigate }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#6D5DF6'
  // Renders nothing at all for anyone without HR access, and nothing when
  // there is nothing waiting -- Today is about the session in front of you,
  // and an HR row with a zero on it would just be furniture.
  const hrAttention = useHrAttention(org?.id, userProfile?.role)

  const [sessions, setSessions] = useState([])
  const [attendance, setAttendance] = useState([])
  const [staff, setStaff] = useState([])
  const [expected, setExpected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!org?.id) return
    setError(false)
    const today = londonToday()

    const { data: sess, error: e1 } = await supabase.from('sessions')
      .select('id, title, session_date, start_time, end_time, location, session_type, bubbles')
      .eq('org_id', org.id).eq('session_date', today)
      .order('start_time')

    if (e1) { setError(true); setLoading(false); return }

    const ids = (sess || []).map(s => s.id)

    const [att, sst, kids] = await Promise.all([
      ids.length
        ? supabase.from('attendance')
            .select('id, session_id, child_id, status, signed_in_at, signed_out_at')
            .eq('org_id', org.id).in('session_id', ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from('session_staff')
            .select('id, session_id, user_id, volunteer_id, role, attended, signed_in_at')
            .eq('org_id', org.id).in('session_id', ids)
        : Promise.resolve({ data: [] }),
      supabase.from('children').select('id', { count: 'exact', head: true })
        .eq('org_id', org.id),
    ])

    if (!mounted.current) return
    setSessions(sess || [])
    setAttendance(att.data || [])
    setStaff(sst.data || [])
    setExpected(kids.count || 0)
    setLoading(false)
  }, [org?.id])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  // Phase is clock-derived, so the page has to re-evaluate as time passes --
  // otherwise a session that started five minutes ago still reads "Later
  // today" until someone reloads. Polled rather than subscribed: Supabase
  // Realtime crashes iOS WebKit in this app.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setTick(t => t + 1)
      load()
    }, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const perSession = useMemo(() => {
    void tick
    return sessions.map(s => {
      const rows = attendance.filter(a => a.session_id === s.id)
      const present = rows.filter(a => a.signed_in_at && !a.signed_out_at).length
      const signedOut = rows.filter(a => a.signed_out_at).length
      const absent = rows.filter(a => a.status === 'absent').length
      const marked = rows.filter(a => a.status || a.signed_in_at).length
      const staffRows = staff.filter(x => x.session_id === s.id)
      return {
        ...s,
        phase: sessionPhase(s),
        present, signedOut, absent, marked,
        registerStarted: rows.length > 0,
        staffOnSite: staffRows.filter(x => x.attended || x.signed_in_at).length,
        staffAssigned: staffRows.length,
      }
    })
  }, [sessions, attendance, staff, tick])

  const running = perSession.filter(s => s.phase === 'running')
  const upcoming = perSession.filter(s => s.phase === 'upcoming')
  const finished = perSession.filter(s => s.phase === 'finished' || s.phase === 'scheduled')

  const totals = useMemo(() => ({
    onSite: perSession.reduce((n, s) => n + s.present, 0),
    staffOnSite: perSession.reduce((n, s) => n + s.staffOnSite, 0),
    // A register left open after a session ends is the thing most worth
    // surfacing: it usually means nobody signed the children out.
    openRegisters: perSession.filter(s => s.phase === 'finished' && s.present > 0).length,
    notStarted: perSession.filter(s => s.phase === 'running' && !s.registerStarted).length,
  }), [perSession])

  const attention = []
  if (totals.notStarted > 0) {
    attention.push({
      id: 'not-started', tone: '#E5484D',
      title: `${totals.notStarted} register${totals.notStarted === 1 ? '' : 's'} not started`,
      detail: 'A session is running with nobody marked in',
      cta: 'Open registers',
    })
  }
  if (totals.openRegisters > 0) {
    attention.push({
      id: 'open', tone: '#F79009',
      title: `${totals.openRegisters} register${totals.openRegisters === 1 ? '' : 's'} left open`,
      detail: 'Session has finished but children are still signed in',
      cta: 'Open registers',
    })
  }

  const heading = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  })

  const Stat = ({ value, label }) => (
    <div style={{ ...CARD, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8B87A3', marginTop: 3 }}>{label}</div>
    </div>
  )

  const SessionCard = ({ s }) => {
    const meta = PHASE[s.phase]
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{ ...CARD, padding: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            background: meta.bg, color: meta.text,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 6, background: meta.dot }} />
            {meta.label}
          </span>
          <span style={{ fontSize: 12.5, color: '#8B87A3' }}>
            {hhmm(s.start_time)}{s.end_time ? `–${hhmm(s.end_time)}` : ''}
            {s.location ? ` · ${s.location}` : ''}
          </span>
        </div>

        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
          {s.title || 'Session'}
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.present > 0 ? '#04713C' : '#94A3B8' }}>
              {s.present}
            </div>
            <div style={{ fontSize: 11.5, color: '#8B87A3' }}>signed in</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{s.signedOut}</div>
            <div style={{ fontSize: 11.5, color: '#8B87A3' }}>signed out</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{s.absent}</div>
            <div style={{ fontSize: 11.5, color: '#8B87A3' }}>absent</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
              {s.staffOnSite}<span style={{ fontSize: 13, color: '#94A3B8' }}>/{s.staffAssigned}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#8B87A3' }}>staff on site</div>
          </div>
        </div>

        {!s.registerStarted && s.phase === 'running' && (
          <div style={{
            padding: '9px 12px', borderRadius: 10, marginBottom: 12,
            background: '#FEF2F2', border: '1px solid #FECACA',
            fontSize: 12.5, color: '#B42318',
          }}>Register not started</div>
        )}

        {s.phase === 'finished' && s.present > 0 && (
          <div style={{
            padding: '9px 12px', borderRadius: 10, marginBottom: 12,
            background: '#FEF6E7', border: '1px solid #FDE2B5',
            fontSize: 12.5, color: '#93500A',
          }}>{s.present} still signed in after the session ended</div>
        )}

        <button
          onClick={() => onNavigate?.('registers')}
          style={{
            width: '100%', padding: '11px', borderRadius: 11, border: 'none',
            background: primary, color: '#fff', fontSize: 13.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Open register</button>
      </motion.div>
    )
  }

  return (
    <div style={{ padding: isMobile ? '16px 12px 80px' : '20px 24px', minHeight: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: isMobile ? 22 : 24, fontWeight: 900, color: '#0F172A', letterSpacing: -0.4 }}>
          Today
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 3 }}>{heading}</div>
      </div>

      {loading && (
        <div style={{ ...CARD, padding: 30, textAlign: 'center', color: '#8B87A3', fontSize: 14 }}>
          Loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ ...CARD, padding: '26px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            Couldn't load today
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3', marginBottom: 14 }}>
            This is a connection problem, not an empty day.
          </div>
          <button onClick={load} style={{
            padding: '10px 18px', borderRadius: 11, border: 'none', background: primary,
            color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>Try again</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {hrAttention.show && (
            <button onClick={() => onNavigate && onNavigate('hr')} style={{
              ...CARD, width: '100%', padding: '14px 16px', marginBottom: 16, minHeight: 44,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit',
              border: `1px solid ${hrAttention.urgent > 0 ? '#FCD9A5' : '#E5EAF2'}`,
              background: hrAttention.urgent > 0 ? '#FEF6E7' : '#fff',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🧑‍💼</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                  {hrAttention.count} HR item{hrAttention.count > 1 ? 's' : ''} to deal with
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#8B87A3', marginTop: 1 }}>
                  {hrAttention.urgent > 0
                    ? `${hrAttention.urgent} overdue — compliance, cases or reviews`
                    : 'Compliance, supervisions and case actions'}
                </span>
              </span>
              <span style={{ color: '#CBD5E1', fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          )}

          {sessions.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: 10, marginBottom: 16,
            }}>
              <Stat value={totals.onSite} label="young people signed in" />
              <Stat value={totals.staffOnSite} label="staff on site" />
              <Stat value={running.length} label="sessions running" />
              <Stat value={expected} label="on the register" />
            </div>
          )}

          {attention.length > 0 && (
            <div style={{ ...CARD, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{
                padding: '13px 16px', borderBottom: '1px solid #ECE9F5',
                fontSize: 14.5, fontWeight: 800, color: '#0F172A',
              }}>Needs attention</div>
              {attention.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderBottom: i < attention.length - 1 ? '1px solid #F5F3FA' : 'none',
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: a.tone, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>{a.detail}</div>
                  </div>
                  <button onClick={() => onNavigate?.('registers')} style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none', background: primary,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                    width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0,
                  }}>{a.cta}</button>
                </div>
              ))}
            </div>
          )}

          {sessions.length === 0 && (
            <div style={{ ...CARD, padding: '38px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>☕</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
                Nothing scheduled today
              </div>
              <div style={{ fontSize: 13.5, color: '#8B87A3', maxWidth: 340, margin: '0 auto 16px', lineHeight: 1.5 }}>
                When sessions are running you'll see who's signed in, who's on duty,
                and anything that needs attention.
              </div>
              <button onClick={() => onNavigate?.('calendar')} style={{
                padding: '10px 18px', borderRadius: 11, border: '1px solid #E2E8F0',
                background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Open calendar</button>
            </div>
          )}

          {running.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
                Running now
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 10,
              }}>
                {running.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
                Later today
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 10,
              }}>
                {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {finished.length > 0 && (
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
                Earlier today
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 10,
              }}>
                {finished.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

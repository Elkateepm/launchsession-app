import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { activityTheme, tierFor, computeAchievements, glassCard, CountUp, timeAgo } from './vp_shared'

function useCountdown(target) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  if (!target) return null
  const diff = target - now
  if (diff <= 0) return null
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { h, m, s, total: diff }
}

export default function VPToday({ org, user, profile, sessions, todaySessions, futureSessions, attendance, announcements, volunteerCounts, primary, onOpenSession, onNavigate, onRaiseConcern, onOpenRegister }) {
  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  const totalHours = attendance.reduce((s, a) => s + (a.hours_logged || 0), 0)
  const sessionsCompleted = attendance.filter(a => a.status === 'completed' || a.signed_out_at).length
  const youngPeopleSupported = todaySessions.reduce((s, sess) => s + (volunteerCounts[sess.id] ? 0 : 0), 0) // placeholder; real per-child count not tracked per volunteer
  const tier = tierFor(totalHours)

  // Streak: count consecutive weeks (Mon-Sun) with at least one attendance record
  const streakWeeks = React.useMemo(() => {
    if (!attendance.length) return 0
    const weekKey = (d) => { const dt = new Date(d); const onejan = new Date(dt.getFullYear(), 0, 1); const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay() + 1) / 7); return `${dt.getFullYear()}-${week}` }
    const weeks = new Set(attendance.filter(a => a.created_at).map(a => weekKey(a.created_at)))
    let streak = 0
    let cursor = new Date()
    while (weeks.has(weekKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 7) }
    return streak
  }, [attendance])

  const achievements = computeAchievements({
    sessionsCompleted, totalHours, youngPeopleSupported: sessionsCompleted * 8, streakWeeks,
    dbsVerified: !!profile?.dbs_number, safeguardingTrained: false,
  })
  const earnedAchievements = achievements.filter(a => a.earned)

  const nextSession = todaySessions[0] || futureSessions[0]
  const isLiveNow = nextSession && nextSession.session_date === new Date().toLocaleDateString('en-CA') &&
    (() => { const now = new Date(); const start = nextSession.start_time ? new Date(`${nextSession.session_date}T${nextSession.start_time}`) : null; const end = nextSession.end_time ? new Date(`${nextSession.session_date}T${nextSession.end_time}`) : null; return (!start || start <= now) && (!end || end >= now) })()

  const countdownTarget = nextSession && !isLiveNow && nextSession.session_date && nextSession.start_time
    ? new Date(`${nextSession.session_date}T${nextSession.start_time}`).getTime() : null
  const countdown = useCountdown(countdownTarget)

  const theme = nextSession ? activityTheme(nextSession.session_type) : null

  // Today's dynamic checklist
  const checklist = []
  if (nextSession) {
    checklist.push({ key: 'confirm', label: 'Confirm attendance for today', done: true })
    if (!profile?.dbs_number) checklist.push({ key: 'dbs', label: 'Add your DBS details', done: false })
  }
  if (announcements.some(a => a.pinned)) checklist.push({ key: 'announce', label: 'Read the pinned announcement', done: false })
  const [checked, setChecked] = useState({})

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* HERO */}
      <div style={{ background: `linear-gradient(150deg, ${primary}, ${primary}CC)`, padding: '20px 18px 26px', position: 'relative', overflow: 'hidden' }}>
        <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 8, repeat: Infinity }} style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: profile?.photo_url ? 'transparent' : 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{firstName[0]}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#fff' }}>{greeting}, {firstName} 👋</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{org?.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>LEVEL</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: tier.color }}>{tier.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
          {[
            { label: 'Hours', value: totalHours.toFixed(1) },
            { label: 'Sessions', value: sessionsCompleted },
            { label: 'Streak', value: `${streakWeeks}🔥` },
            { label: 'Badges', value: earnedAchievements.length },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: '9px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', marginTop: -14 }}>
        {/* LIVE / NEXT SESSION CARD */}
        {nextSession ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onClick={() => onOpenSession(nextSession)}
            style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 16px 40px -14px rgba(0,0,0,0.35)', marginBottom: 14, cursor: 'pointer' }}>
            <div style={{ background: theme.gradient, padding: '18px 18px 16px', color: '#fff', position: 'relative' }}>
              {isLiveNow && (
                <motion.div animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.25)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />LIVE NOW
                </motion.div>
              )}
              <div style={{ fontSize: 34, marginBottom: 6 }}>{theme.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{nextSession.title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
                {nextSession.session_date === new Date().toLocaleDateString('en-CA') ? 'Today' : new Date(nextSession.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                {' · '}{nextSession.start_time}{nextSession.end_time ? ` – ${nextSession.end_time}` : ''}
              </div>
              {nextSession.location && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>📍 {nextSession.location}</div>}
              {countdown && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  {[['h', countdown.h], ['m', countdown.m], ['s', countdown.s]].map(([label, val]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '5px 9px', textAlign: 'center', minWidth: 42 }}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{String(val).padStart(2, '0')}</div>
                      <div style={{ fontSize: 8, opacity: 0.8, textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background: '#fff', padding: '12px 16px', display: 'flex', gap: 8 }}>
              {isLiveNow ? (
                <>
                  <button onClick={e => { e.stopPropagation(); onOpenRegister(nextSession) }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: theme.gradient, color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>📖 Open Register</button>
                  <button onClick={e => { e.stopPropagation(); onNavigate('messages') }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#334155', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>💬 Message Staff</button>
                </>
              ) : (
                <>
                  {nextSession.location && <a onClick={e => e.stopPropagation()} href={`https://maps.google.com/?q=${encodeURIComponent(nextSession.location)}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#334155', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>🧭 Navigate</a>}
                  <button onClick={e => { e.stopPropagation(); onOpenSession(nextSession) }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: theme.gradient, color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>View Details</button>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <div style={{ ...glassCard({ padding: 22, textAlign: 'center', marginBottom: 14 }) }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🌤️</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>No sessions scheduled</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Check Sessions to see what's coming up</div>
          </div>
        )}

        {/* SAFEGUARDING BANNER */}
        <motion.button onClick={onRaiseConcern} whileTap={{ scale: 0.98 }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 16, padding: '13px 14px', marginBottom: 14, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>Safeguarding</div>
            <div style={{ fontSize: 11.5, color: '#7F1D1D' }}>Report any concerns to the DSL immediately</div>
          </div>
          <div style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '7px 12px', fontSize: 11.5, fontWeight: 800 }}>Raise</div>
        </motion.button>

        {/* TODAY'S ACTIONS CHECKLIST */}
        {checklist.length > 0 && (
          <div style={{ ...glassCard({ padding: 16, marginBottom: 14 }) }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Today's Actions</div>
            {checklist.map(item => (
              <label key={item.key} onClick={() => setChecked(c => ({ ...c, [item.key]: !c[item.key] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                <motion.div animate={checked[item.key] || item.done ? { scale: [1, 1.3, 1] } : {}}
                  style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${checked[item.key] || item.done ? primary : '#CBD5E1'}`, background: checked[item.key] || item.done ? primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {(checked[item.key] || item.done) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                </motion.div>
                <span style={{ fontSize: 13, color: checked[item.key] || item.done ? '#94A3B8' : '#334155', fontWeight: 600, textDecoration: (checked[item.key] || item.done) ? 'line-through' : 'none' }}>{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* QUICK ACTION CARDS */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { key: 'sessions', icon: '📅', label: 'My Sessions', tab: 'sessions' },
            { key: 'availability', icon: '🗓️', label: 'Availability', tab: 'profile', sub: 'availability' },
            { key: 'training', icon: '📚', label: 'Training', tab: 'profile', sub: 'training' },
            { key: 'documents', icon: '📄', label: 'Documents', tab: 'profile', sub: 'documents' },
            { key: 'messages', icon: '💬', label: 'Messages', tab: 'messages' },
            { key: 'profile', icon: '👤', label: 'Profile', tab: 'profile' },
          ].map(a => (
            <button key={a.key} onClick={() => onNavigate(a.tab, a.sub)}
              style={{ ...glassCard({ padding: '16px 8px' }), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
              <div style={{ fontSize: 22 }}>{a.icon}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textAlign: 'center' }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* ACHIEVEMENTS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>My Badges</div>
          <button onClick={() => onNavigate('profile', 'badges')} style={{ fontSize: 11, fontWeight: 800, color: primary, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}>
          {achievements.map(a => (
            <div key={a.key} style={{ ...glassCard({ padding: '14px 12px' }), flexShrink: 0, width: 84, textAlign: 'center', opacity: a.earned ? 1 : 0.35 }}>
              <div style={{ fontSize: 26, marginBottom: 4, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>{a.label}</div>
            </div>
          ))}
        </div>

        {/* ANNOUNCEMENTS */}
        {announcements.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Announcements</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {announcements.slice(0, 6).map(a => (
                <div key={a.id} style={{ ...glassCard({ padding: 14 }), flexShrink: 0, width: 240 }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{a.emoji || '📣'}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.content}</div>
                  <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 8, fontWeight: 700 }}>{timeAgo(a.created_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

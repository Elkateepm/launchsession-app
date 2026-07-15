import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Badge, Avatar, CountUp, sessionHours, daysUntil, statusStyle, inputStyle, btnPrimary, btnGhost, glass, PURPLE, PAGE_BG } from './vh_shared'
// Shown wherever the org logo would go, whenever the org hasn't set one yet
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'
import VolunteerDirectory from './VolunteerDirectory'
import VolunteersApplications from './VolunteersApplications'
import VolunteersCoverage from './VolunteersCoverage'
import VolunteersTraining from './VolunteersTraining'
import VolunteersRecognition from './VolunteersRecognition'
import VolunteersReports from './VolunteersReports'

const TABS = [
  { key: 'dashboard', label: 'Overview', icon: '❤️' },
  { key: 'directory', label: 'Directory', icon: '👥' },
  { key: 'coverage', label: 'Coverage', icon: '📅' },
  { key: 'training', label: 'Training', icon: '🎓' },
  { key: 'recognition', label: 'Recognition', icon: '🏆' },
  { key: 'reports', label: 'Reports', icon: '📊' },
]

const QUICK_INSERTS = [
  { label: 'Reminder', text: 'Hi {{FirstName}}, just a reminder about your upcoming session — see you there!' },
  { label: 'Thank You', text: 'Hi {{FirstName}}, thank you so much for everything you do for us — it really makes a difference.' },
  { label: 'Cover Needed', text: 'Hi {{FirstName}}, we\'re short a volunteer for an upcoming session — could you help cover it?' },
  { label: 'Training Reminder', text: 'Hi {{FirstName}}, a friendly reminder that your training/certification is due for renewal soon.' },
]

const CHANNELS = [
  { key: 'email', label: 'Email', icon: '📧', wired: true },
  { key: 'portal', label: 'Portal Notification', icon: '🔔', wired: true },
  { key: 'notes', label: 'Internal Notes', icon: '📝', wired: true },
  { key: 'sms', label: 'SMS', icon: '💬', wired: false },
  { key: 'whatsapp', label: 'WhatsApp', icon: '🟢', wired: false },
  { key: 'push', label: 'Push', icon: '📲', wired: false },
]

export default function VolunteersMain({ org }) {
  const [volunteers, setVolunteers] = useState([])
  const [applicants, setApplicants] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionStaff, setSessionStaff] = useState([])
  const [training, setTraining] = useState([])
  const [recognition, setRecognition] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const qrRef = useRef(null)
  const qrGenerated = useRef(false)

  // Communications Centre state
  const [channel, setChannel] = useState('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState('all')
  const [customIds, setCustomIds] = useState([])
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const primary = org?.primary_color || PURPLE
  const portalUrl = `${window.location.origin}/volunteer/${org?.slug}`

  useEffect(() => { if (org?.id) loadAll() }, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (showQR && qrRef.current && !qrGenerated.current) generateQR() }, [showQR]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const from = new Date(); from.setDate(from.getDate() - 60)
    const [{ data: profiles }, { data: allSessions }, { data: staff }, { data: trainingRows }, { data: recognitionRows }, { data: broadcastRows }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('org_id', org.id).eq('role', 'volunteer').order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('org_id', org.id).gte('session_date', from.toISOString().slice(0, 10)).order('session_date'),
      supabase.from('session_staff').select('*').eq('org_id', org.id),
      supabase.from('volunteer_training').select('*').eq('org_id', org.id),
      supabase.from('volunteer_recognition').select('*').eq('org_id', org.id),
      supabase.from('volunteer_broadcasts').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(10),
    ])
    const all = profiles || []
    setVolunteers(all.filter(v => v.status === 'active'))
    setApplicants(all.filter(v => v.status !== 'active'))
    setSessions(allSessions || [])
    setSessionStaff(staff || [])
    setTraining(trainingRows || [])
    setRecognition(recognitionRows || [])
    setBroadcasts(broadcastRows || [])
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const sessionsById = Object.fromEntries(sessions.map(s => [s.id, s]))
  const completedStaff = sessionStaff.filter(ss => sessionsById[ss.session_id]?.session_date <= today)
  const thisMonth = today.slice(0, 7)
  const hoursThisMonth = Math.round(completedStaff
    .filter(ss => sessionsById[ss.session_id]?.session_date?.slice(0, 7) === thisMonth)
    .reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0))
  const upcomingSessionsList = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date)).slice(0, 4)

  const todaySessions = sessions.filter(s => s.session_date === today)
  const todaySessionsWithCoverage = todaySessions.map(s => {
    const assigned = sessionStaff.filter(ss => ss.session_id === s.id).length
    const required = s.volunteer_limit || 2
    return { ...s, assigned, required, covered: assigned >= required }
  })
  const needCoverToday = todaySessionsWithCoverage.filter(s => !s.covered).length
  const trainingDueSoon = training
    .map(t => ({ ...t, daysLeft: daysUntil(t.expiry_date) }))
    .filter(t => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const kpis = [
    { label: 'Total Volunteers', value: volunteers.length + applicants.length, icon: '👥', color: '#16A34A', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Active Volunteers', value: volunteers.length, icon: '🟢', color: '#0891B2', bg: 'rgba(8,145,178,0.12)' },
    { label: 'Sessions Today', value: todaySessions.length, icon: '📅', color: '#B45309', bg: 'rgba(245,158,11,0.14)' },
    { label: 'Need Cover', value: needCoverToday, icon: '⚠️', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
    { label: 'Training Due', value: trainingDueSoon.length, icon: '🎓', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
    { label: 'Volunteer Hours', value: hoursThisMonth, icon: '⭐', color: '#4F46E5', bg: 'rgba(79,70,229,0.12)' },
  ]

  // Activity feed — merged from real signals, not fake data
  const activityFeed = [
    ...volunteers.slice(0, 5).map(v => ({
      id: `join-${v.id}`, ts: v.created_at, icon: '👤', color: '#16A34A',
      title: `${v.full_name} joined your team`, sub: v.role_title || 'Volunteer',
    })),
    ...broadcasts.slice(0, 5).map(b => ({
      id: `bc-${b.id}`, ts: b.created_at, icon: '💬', color: '#0891B2',
      title: `Broadcast sent to ${b.recipient_count} volunteer${b.recipient_count === 1 ? '' : 's'}`, sub: b.subject || b.body?.slice(0, 50) || 'Update',
    })),
    ...recognition.slice(0, 5).map(r => ({
      id: `rec-${r.id}`, ts: r.awarded_at || r.created_at, icon: '🏆', color: '#B45309',
      title: `${volunteers.find(v => v.id === r.volunteer_id)?.full_name || 'A volunteer'} — ${r.title}`, sub: r.note || 'Recognition',
    })),
    ...todaySessionsWithCoverage.filter(s => s.covered).map(s => ({
      id: `cov-${s.id}`, ts: s.updated_at || s.created_at || s.session_date, icon: '✅', color: '#16A34A',
      title: `${s.title} is fully covered`, sub: 'Today',
    })),
  ].filter(a => a.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6)

  // ── Invite / portal ──────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true); setInviteMsg('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), name: inviteName.trim() || inviteEmail.split('@')[0], org_id: org.id, org_slug: org.slug, redirect_to: portalUrl }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setInviteMsg('✓ Invite sent to ' + inviteEmail.trim())
      setInviteEmail(''); setInviteName('')
      loadAll()
    } catch (err) {
      setInviteMsg('Error: ' + err.message)
    }
    setInviting(false)
  }

  function copyLink() { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  function generateQR() {
    qrGenerated.current = true
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => {
      if (qrRef.current) {
        qrRef.current.innerHTML = ''
        new window.QRCode(qrRef.current, { text: portalUrl, width: 180, height: 180, colorDark: '#0f172a', colorLight: '#ffffff' })
      }
    }
    document.head.appendChild(script)
  }

  // ── Communications Centre ────────────────────────────
  function openComposerFor(volunteer) {
    setAudienceMode('custom')
    setCustomIds([volunteer.id])
    setBody(`Hi {{FirstName}}, `)
    setShowBroadcastModal(true)
  }
  function openComposerForSession(s) {
    setAudienceMode('all')
    setSubject(`Cover needed: ${s.title}`)
    setBody(`Hi {{FirstName}}, we're looking for extra cover for ${s.title} on ${new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. Let us know if you're able to help!`)
    setShowBroadcastModal(true)
  }

  const audienceLabel = audienceMode === 'all' ? 'All Volunteers' : audienceMode === 'active' ? 'Only Active' : audienceMode === 'pending' ? 'Only Pending' : `${customIds.length} selected`

  async function sendBroadcast() {
    if (!body.trim()) return
    setSendingMsg(true); setSendResult('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const audience = audienceMode === 'custom' ? { volunteer_ids: customIds } : audienceMode === 'active' ? { status: 'active' } : audienceMode === 'pending' ? { status: 'pending' } : {}
      const res = await fetch('/api/send-volunteer-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ org_id: org.id, channel, subject, body_html: body.replace(/\n/g, '<br/>'), audience, audience_label: audienceLabel }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSendResult(`✓ Sent to ${json.sent}/${json.recipient_count} recipients`)
      setBody(''); setSubject('')
      loadAll()
    } catch (err) {
      setSendResult('Error: ' + err.message)
    }
    setSendingMsg(false)
  }

  const cardStyle = glass({ padding: 20 })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading volunteers...</div>

  return (
    <div style={{ background: PAGE_BG, minHeight: '100%', padding: '20px 24px' }}>
      {/* HERO */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{
        ...glass({ padding: '28px 32px', marginBottom: 20 }),
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, rgba(255,255,255,0.85), ${primary}0a)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>❤️ Volunteers</div>
            <div style={{ fontSize: 14, color: '#334155', marginTop: 6 }}>Manage your volunteer workforce, communication and availability.</div>
            <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>Keep every volunteer informed, engaged and ready for every session.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setShowInviteModal(true)} style={btnPrimary(primary)}>+ Invite Volunteer</button>
              <button onClick={() => setShowBroadcastModal(true)} style={btnGhost}>📢 Send Broadcast</button>
              <button onClick={() => setTab('coverage')} style={btnGhost}>📅 View Coverage</button>
              <button onClick={() => setShowQR(true)} style={btnGhost}>📲 QR Portal</button>
              <button onClick={copyLink} style={btnGhost}>{copied ? '✓ Copied' : '🔗 Copy Portal Link'}</button>
              <a href={portalUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Open Portal ↗</a>
            </div>
          </div>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}
          >
            {/* ambient glow, tinted with the org's own brand colour */}
            <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', background: `radial-gradient(circle, ${primary}30, transparent 70%)`, filter: 'blur(14px)', pointerEvents: 'none' }} />
            {/* the org's own logo — falls back to the LaunchSession badge only if they haven't set one */}
            <div style={{
              position: 'relative', width: 130, height: 130, borderRadius: '50%', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              border: `2px solid ${primary}30`, boxShadow: `0 8px 20px ${primary}30`,
            }}>
              <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={org?.name || 'Organisation'} style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
            </div>
            {/* sparkle accents */}
            <motion.span animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 2, repeat: Infinity }} style={{ position: 'absolute', top: 4, right: 0, fontSize: 13, color: primary }}>✦</motion.span>
            <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 2.6, repeat: Infinity }} style={{ position: 'absolute', bottom: 14, left: -4, fontSize: 10, color: '#6366F1' }}>✦</motion.span>
          </motion.div>
        </div>
      </motion.div>

      {/* TAB NAV */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(241,245,249,0.8)', borderRadius: 14, padding: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: '1 0 auto', padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: tab === t.key ? primary : 'transparent', color: tab === t.key ? '#fff' : '#64748B',
            boxShadow: tab === t.key ? `0 4px 14px -4px ${primary}80` : 'none', whiteSpace: 'nowrap',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === 'dashboard' && (
            <>
              {/* KPI CARDS — colour-coded, each answers a different question at a glance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                {kpis.map((k, i) => (
                  <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3 }} style={{ ...cardStyle, padding: 16, background: `linear-gradient(160deg, ${k.bg}, rgba(255,255,255,0.7))` }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 8 }}>{k.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>
                      {typeof k.value === 'number' ? <CountUp value={k.value} /> : k.value}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{k.label}</div>
                  </motion.div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
                {/* LEFT: Activity Feed + Upcoming Sessions */}
                <div>
                  <Card style={{ marginBottom: 20 }}>
                    <SectionTitle icon="💬" title="Volunteer Feed" />
                    {activityFeed.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Activity will show up here as your team gets going.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {activityFeed.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 4px', borderRadius: 10, transition: 'background 0.15s' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${a.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{a.title}</div>
                              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{a.sub}</div>
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {new Date(a.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <SectionTitle icon="📅" title="Upcoming Sessions" right={<button onClick={() => setTab('coverage')} style={{ background: 'none', border: 'none', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View calendar →</button>} />
                    {upcomingSessionsList.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No upcoming sessions scheduled.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {upcomingSessionsList.map(s => {
                          const assigned = sessionStaff.filter(ss => ss.session_id === s.id).length
                          const required = s.volunteer_limit || 2
                          const pct = Math.min(100, (assigned / Math.max(1, required)) * 100)
                          const covered = assigned >= required
                          const barColor = covered ? '#16A34A' : assigned === 0 ? '#DC2626' : '#D97706'
                          return (
                            <div key={s.id} style={{ padding: '12px 14px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{s.title}</div>
                                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.start_time}–{s.end_time}{s.location ? ` · ${s.location}` : ''}</div>
                                </div>
                                <Badge bg={`${barColor}18`} color={barColor}>{assigned}/{required}</Badge>
                              </div>
                              <div style={{ height: 5, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginBottom: 8 }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} style={{ height: '100%', background: barColor, borderRadius: 99 }} />
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setTab('coverage')} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>Open Register</button>
                                <button onClick={() => openComposerForSession(s)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>Message Volunteers</button>
                                {!covered && <button onClick={() => openComposerForSession(s)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: barColor, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Find Cover</button>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                </div>

                {/* RIGHT: Today's Coverage + Training Due + New Applications */}
                <div>
                  <Card style={{ marginBottom: 20 }}>
                    <SectionTitle icon="📍" title="Today's Coverage" right={<button onClick={() => setTab('coverage')} style={{ background: 'none', border: 'none', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View all →</button>} />
                    {todaySessionsWithCoverage.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No sessions running today.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: needCoverToday > 0 ? 14 : 0 }}>
                        {todaySessionsWithCoverage.map(s => {
                          const pct = Math.min(100, (s.assigned / Math.max(1, s.required)) * 100)
                          const barColor = s.covered ? '#16A34A' : '#D97706'
                          return (
                            <div key={s.id} style={{ padding: 12, borderRadius: 14, background: `${barColor}0c`, border: `1px solid ${barColor}30` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{s.title}</div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: barColor }}>{s.covered ? '🟢 Ready' : `🟡 Need ${s.required - s.assigned}`}</span>
                              </div>
                              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{s.required} needed · {s.assigned} confirmed</div>
                              <div style={{ height: 5, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} style={{ height: '100%', background: barColor, borderRadius: 99 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {needCoverToday > 0 && (
                      <button onClick={() => setTab('coverage')} style={{ ...btnPrimary(primary), width: '100%' }}>Find volunteers for gaps</button>
                    )}
                  </Card>

                  {trainingDueSoon.length > 0 && (
                    <Card style={{ marginBottom: 20 }}>
                      <SectionTitle icon="🎓" title="Training Due Soon" right={<button onClick={() => setTab('training')} style={{ background: 'none', border: 'none', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View all →</button>} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {trainingDueSoon.slice(0, 4).map(t => {
                          const v = volunteers.find(vv => vv.id === t.volunteer_id)
                          const urgent = t.daysLeft <= 14
                          return (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t.training_type}</div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{v?.full_name || 'Volunteer'}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: urgent ? '#DC2626' : '#D97706' }}>{t.daysLeft}d left</span>
                                <button onClick={() => setTab('training')} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: primary, fontSize: 10.5, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Renew</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  )}

                  <Card>
                    <SectionTitle icon="📮" title="New Applications" right={applicants.length > 0 && <Badge bg="rgba(220,38,38,0.1)" color="#DC2626">New</Badge>} />
                    {applicants.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No pending applications.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {applicants.slice(0, 3).map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={a.full_name} photoUrl={a.photo_url} size={32} color={primary} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{a.full_name}</div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Applied {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                            </div>
                            <button onClick={() => setTab('applications')} style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${primary}`, background: '#fff', fontSize: 11, fontWeight: 700, color: primary, cursor: 'pointer', whiteSpace: 'nowrap' }}>Review →</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* RECENT VOLUNTEERS */}
              {volunteers.length > 0 && (
                <Card style={{ marginTop: 20 }}>
                  <SectionTitle icon="👥" title="Recent Volunteers" right={<button onClick={() => setTab('directory')} style={{ background: 'none', border: 'none', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View all →</button>} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    {volunteers.slice(0, 5).map(v => (
                      <div key={v.id} style={{ padding: 14, borderRadius: 16, background: '#F8FAFC', border: '1px solid #F1F5F9', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                          <Avatar name={v.full_name} photoUrl={v.photo_url} size={52} color={primary} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{v.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{v.role_title || 'Volunteer'}</div>
                        <Badge bg={statusStyle(v.status || 'active').bg} color={statusStyle(v.status || 'active').color}>{statusStyle(v.status || 'active').label}</Badge>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
                          <button onClick={() => openComposerFor(v)} title="Message" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 12 }}>💬</button>
                          <button onClick={() => setTab('directory')} title="Availability" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 12 }}>📅</button>
                          <button onClick={() => setTab('directory')} title="Edit" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {tab === 'directory' && (
            <VolunteerDirectory org={org} volunteers={volunteers} sessionStaff={sessionStaff} sessions={sessions}
              training={training} recognition={recognition} onMessageVolunteer={openComposerFor} onDataChange={loadAll} />
          )}
          {tab === 'applications' && (
            <VolunteersApplications org={org} applicants={applicants} onDataChange={loadAll} />
          )}
          {tab === 'coverage' && (
            <VolunteersCoverage org={org} sessions={sessions} sessionStaff={sessionStaff} volunteers={volunteers}
              onRequestCover={openComposerForSession} onMessageAll={openComposerForSession} />
          )}
          {tab === 'training' && (
            <VolunteersTraining org={org} volunteers={volunteers} training={training} onDataChange={loadAll} />
          )}
          {tab === 'recognition' && (
            <VolunteersRecognition org={org} volunteers={volunteers} sessionStaff={sessionStaff} sessions={sessions} recognition={recognition} onDataChange={loadAll} />
          )}
          {tab === 'reports' && (
            <VolunteersReports org={org} volunteers={volunteers} sessionStaff={sessionStaff} sessions={sessions} applicants={applicants} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* INVITE MODAL */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInviteModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Invite a volunteer</div>
                <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>×</button>
              </div>
              <form onSubmit={async e => { await handleInvite(e); if (!inviteMsg.startsWith('Error')) setShowInviteModal(false) }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 5 }}>Full name (optional)</label>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 5 }}>Email address</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@email.com" required style={inputStyle} />
                </div>
                {inviteMsg && <div style={{ fontSize: 13, color: inviteMsg.startsWith('Error') ? '#DC2626' : '#15803D', marginBottom: 14, fontWeight: 600 }}>{inviteMsg}</div>}
                <button type="submit" disabled={inviting} style={{ ...btnPrimary(primary), width: '100%', padding: 12, opacity: inviting ? 0.7 : 1 }}>
                  {inviting ? 'Sending...' : 'Send invite →'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR MODAL */}
      <AnimatePresence>
        {showQR && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQR(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 320, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Volunteer Portal QR</div>
                <button onClick={() => setShowQR(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>×</button>
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Print or display this for volunteers to scan.</div>
              <div ref={qrRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }} />
              <div style={{ fontSize: 11, color: '#94A3B8', wordBreak: 'break-all', marginBottom: 16 }}>{portalUrl}</div>
              <button onClick={copyLink} style={{ ...btnGhost, width: '100%' }}>{copied ? '✓ Copied!' : 'Copy portal link'}</button>
            </motion.div>
          </motion.div>
        )}

        {showBroadcastModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBroadcastModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 22, padding: 26, width: '100%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>💬 Volunteer Communications</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Keep your team informed and engaged</div>
                </div>
                <button onClick={() => setShowBroadcastModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 18, cursor: 'pointer', color: '#64748B' }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {CHANNELS.map(c => (
                  <button key={c.key} onClick={() => c.wired && setChannel(c.key)} disabled={!c.wired}
                    title={!c.wired ? 'Coming soon' : ''}
                    style={{
                      padding: '7px 12px', borderRadius: 10, border: 'none', cursor: c.wired ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700,
                      background: channel === c.key ? primary : '#F1F5F9', color: channel === c.key ? '#fff' : c.wired ? '#475569' : '#CBD5E1',
                    }}>{c.icon} {c.label}</button>
                ))}
              </div>

              {channel === 'email' && (
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject..." style={{ ...inputStyle, marginBottom: 8 }} />
              )}
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Share an update, reminder or important information... Use {{FirstName}} to personalise."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }} />

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {QUICK_INSERTS.map(q => (
                  <button key={q.label} onClick={() => setBody(q.text)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', background: '#fff', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{q.label}</button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>Audience:</span>
                {['all', 'active', 'pending', 'custom'].map(m => (
                  <button key={m} onClick={() => setAudienceMode(m)} style={{
                    padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                    background: audienceMode === m ? primary : '#F1F5F9', color: audienceMode === m ? '#fff' : '#475569',
                  }}>{m === 'all' ? 'All Volunteers' : m === 'active' ? 'Only Active' : m === 'pending' ? 'Only Pending' : 'Custom Selection'}</button>
                ))}
              </div>

              {audienceMode === 'custom' && (
                <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: 10, padding: 8, marginBottom: 12 }}>
                  {volunteers.map(v => (
                    <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 2px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={customIds.includes(v.id)}
                        onChange={e => setCustomIds(prev => e.target.checked ? [...prev, v.id] : prev.filter(id => id !== v.id))} />
                      {v.full_name}
                    </label>
                  ))}
                </div>
              )}

              {sendResult && <div style={{ fontSize: 12.5, fontWeight: 700, color: sendResult.startsWith('Error') ? '#DC2626' : '#15803D', marginBottom: 10 }}>{sendResult}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: broadcasts.length > 0 ? 20 : 0 }}>
                <button onClick={sendBroadcast} disabled={sendingMsg || !body.trim()} style={{ ...btnPrimary(primary), opacity: sendingMsg || !body.trim() ? 0.6 : 1 }}>
                  {sendingMsg ? 'Sending...' : `+ Send ${channel === 'email' ? 'Broadcast' : channel === 'portal' ? 'Notification' : 'Note'}`}
                </button>
              </div>

              {broadcasts.length > 0 && (
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#64748B', marginBottom: 10 }}>RECENT BROADCASTS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {broadcasts.slice(0, 4).map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #F8FAFC' }}>
                        <div style={{ fontSize: 16 }}>{b.channel === 'email' ? '📧' : b.channel === 'portal' ? '🔔' : '📝'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{b.subject || b.body?.slice(0, 60)}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.audience_label} · {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <Badge bg="rgba(34,197,94,0.12)" color="#15803D">{b.sent_count}/{b.recipient_count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

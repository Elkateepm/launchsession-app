import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Badge, Avatar, CountUp, sessionHours, daysUntil, inputStyle, btnPrimary, btnGhost, glass, PURPLE, PAGE_BG } from './vh_shared'
import VolunteerDirectory from './VolunteerDirectory'
import VolunteersApplications from './VolunteersApplications'
import VolunteersCoverage from './VolunteersCoverage'
import VolunteersTraining from './VolunteersTraining'
import VolunteersRecognition from './VolunteersRecognition'
import VolunteersReports from './VolunteersReports'

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: '❤️' },
  { key: 'directory', label: 'Directory', icon: '📇' },
  { key: 'applications', label: 'Applications', icon: '📮' },
  { key: 'coverage', label: 'Coverage', icon: '🗓️' },
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
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const sessionsById = Object.fromEntries(sessions.map(s => [s.id, s]))
  const completedStaff = sessionStaff.filter(ss => sessionsById[ss.session_id]?.session_date <= today)
  const upcomingShifts = sessionStaff.filter(ss => sessionsById[ss.session_id]?.session_date >= today).length
  const thisMonth = today.slice(0, 7)
  const hoursThisMonth = Math.round(completedStaff
    .filter(ss => sessionsById[ss.session_id]?.session_date?.slice(0, 7) === thisMonth)
    .reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0))
  const avgAttendance = completedStaff.length ? Math.round((completedStaff.filter(ss => ss.attended !== false).length / completedStaff.length) * 100) : 0
  const availableThisWeek = volunteers.filter(v => v.availability && Object.values(v.availability).some(Boolean)).length
  const dbsExpiringSoon = volunteers.filter(v => { const d = daysUntil(v.dbs_expiry); return d !== null && d <= 30 }).length
  const upcomingSessionsList = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date)).slice(0, 4)

  const kpis = [
    { label: 'Total Volunteers', value: volunteers.length + applicants.length, icon: '👥' },
    { label: 'Active', value: volunteers.length, icon: '✅' },
    { label: 'Pending Approval', value: applicants.filter(a => (a.application_status || 'new') !== 'rejected' && (a.application_status || 'new') !== 'withdrawn').length, icon: '⏳' },
    { label: 'Available This Week', value: availableThisWeek, icon: '📆' },
    { label: 'Upcoming Shifts', value: upcomingShifts, icon: '🕐' },
    { label: 'Hours This Month', value: hoursThisMonth, icon: '⏱️' },
    { label: 'Average Attendance', value: `${avgAttendance}%`, icon: '📈' },
    { label: 'DBS Expiring Soon', value: dbsExpiringSoon, icon: '🛡️' },
  ]

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
    setTab('dashboard')
  }
  function openComposerForSession(s) {
    setAudienceMode('all')
    setSubject(`Cover needed: ${s.title}`)
    setBody(`Hi {{FirstName}}, we're looking for extra cover for ${s.title} on ${new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. Let us know if you're able to help!`)
    setTab('dashboard')
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
              <button onClick={copyLink} style={btnGhost}>{copied ? '✓ Copied' : '🔗 Copy Portal Link'}</button>
              <button onClick={() => setShowQR(true)} style={btnGhost}>📲 QR Code</button>
              <a href={portalUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Open Portal ↗</a>
            </div>
          </div>
          <motion.img src="/assets/rockets/rocket-hero.png" alt="" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 140, height: 'auto', opacity: 0.9, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
        </div>
      </motion.div>

      {/* TAB NAV */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(241,245,249,0.8)', borderRadius: 14, padding: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: '1 0 auto', padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#0F172A' : '#64748B',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === 'dashboard' && (
            <>
              {/* KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                {kpis.map((k, i) => (
                  <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3 }} style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>
                      {typeof k.value === 'number' ? <CountUp value={k.value} /> : k.value}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{k.label}</div>
                  </motion.div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
                <div>
                  {/* COMMUNICATIONS CENTRE */}
                  <Card style={{ marginBottom: 20 }}>
                    <SectionTitle icon="💬" title="Volunteer Communications Centre" subtitle="Keep your team informed and engaged" />
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

                    {subject !== undefined && channel === 'email' && (
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={sendBroadcast} disabled={sendingMsg || !body.trim()} style={{ ...btnPrimary(primary), opacity: sendingMsg || !body.trim() ? 0.6 : 1 }}>
                        {sendingMsg ? 'Sending...' : `+ Send ${channel === 'email' ? 'Broadcast' : channel === 'portal' ? 'Notification' : 'Note'}`}
                      </button>
                    </div>
                  </Card>

                  {/* RECENT COMMUNICATIONS */}
                  <Card>
                    <SectionTitle icon="🕐" title="Recent Communications" />
                    {broadcasts.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No messages sent yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {broadcasts.map(b => (
                          <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                            <div style={{ fontSize: 18 }}>{b.channel === 'email' ? '📧' : b.channel === 'portal' ? '🔔' : '📝'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{b.subject || b.body.slice(0, 60)}</div>
                              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{b.audience_label} · {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <Badge bg="rgba(34,197,94,0.12)" color="#15803D">{b.sent_count}/{b.recipient_count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div>
                  {/* UPCOMING SESSIONS */}
                  <Card style={{ marginBottom: 20 }}>
                    <SectionTitle icon="📅" title="Upcoming Sessions" right={<button onClick={() => setTab('coverage')} style={{ background: 'none', border: 'none', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View all →</button>} />
                    {upcomingSessionsList.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No upcoming sessions scheduled.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {upcomingSessionsList.map(s => {
                          const assigned = sessionStaff.filter(ss => ss.session_id === s.id).length
                          const required = s.volunteer_limit || 2
                          return (
                            <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{s.title}</div>
                              <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 4 }}>{new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.start_time}–{s.end_time}</div>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: assigned >= required ? '#15803D' : '#B45309' }}>{assigned} / {required} volunteers</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>

                  {/* SPOTLIGHT */}
                  {volunteers.length > 0 && (
                    <Card style={{ marginBottom: 20, background: `linear-gradient(135deg, ${primary}12, ${PURPLE}0c)` }}>
                      <SectionTitle icon="✨" title="Volunteer Spotlight" />
                      {(() => {
                        const spotlight = recognition.filter(r => r.type === 'spotlight').sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at))[0]
                        const v = spotlight ? volunteers.find(x => x.id === spotlight.volunteer_id) : volunteers[0]
                        if (!v) return null
                        const mine = completedStaff.filter(ss => ss.volunteer_id === v.id || ss.user_id === v.id)
                        const hrs = Math.round(mine.reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0))
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={v.full_name} photoUrl={v.photo_url} size={48} color={primary} />
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{v.full_name}</div>
                              <div style={{ fontSize: 12, color: '#64748B' }}>{mine.length} sessions · {hrs} hours</div>
                            </div>
                          </div>
                        )
                      })()}
                    </Card>
                  )}

                  {/* QUICK ACTIONS */}
                  <Card>
                    <SectionTitle icon="⚡" title="Quick Actions" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => setShowInviteModal(true)} style={{ ...btnGhost, textAlign: 'left' }}>👤 Invite Volunteer</button>
                      <button onClick={() => setTab('coverage')} style={{ ...btnGhost, textAlign: 'left' }}>📅 View Coverage</button>
                      <button onClick={() => setTab('training')} style={{ ...btnGhost, textAlign: 'left' }}>🎓 Training Centre</button>
                      <button onClick={() => setShowQR(true)} style={{ ...btnGhost, textAlign: 'left' }}>📲 Generate QR Code</button>
                    </div>
                  </Card>
                </div>
              </div>
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
      </AnimatePresence>
    </div>
  )
}

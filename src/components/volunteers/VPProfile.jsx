import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { activityTheme, tierFor, computeAchievements, glassCard, DAYS, SLOTS } from './vp_shared'

const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'availability', label: 'Availability' },
  { key: 'training', label: 'Training' },
  { key: 'documents', label: 'Documents' },
  { key: 'badges', label: 'Badges' },
  { key: 'settings', label: 'Settings' },
]

export default function VPProfile({ org, user, profile, attendance, primary, initialSub, onSignOut, onProfileUpdated }) {
  const [seg, setSeg] = useState(initialSub || 'overview')
  useEffect(() => { if (initialSub) setSeg(initialSub) }, [initialSub])

  const totalHours = attendance.reduce((s, a) => s + (a.hours_logged || 0), 0)
  const sessionsCompleted = attendance.filter(a => a.status === 'completed' || a.signed_out_at).length
  const tier = tierFor(totalHours)
  const initials = (profile?.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ padding: '0 0 100px' }}>
      <div style={{ background: `linear-gradient(150deg, ${primary}, ${primary}CC)`, padding: '20px 18px 24px', color: '#fff', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: profile?.photo_url ? 'transparent' : 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.35)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, fontWeight: 900 }}>{initials}</span>}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{profile?.full_name}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{org?.name} Volunteer</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '5px 14px', marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: tier.color }}>{tier.name}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>· {totalHours.toFixed(1)}h · {sessionsCompleted} sessions</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '14px 16px 0' }}>
        {SEGMENTS.map(s => (
          <button key={s.key} onClick={() => setSeg(s.key)}
            style={{ padding: '7px 14px', borderRadius: 99, border: 'none', background: seg === s.key ? primary : '#F1F5F9', color: seg === s.key ? '#fff' : '#64748B', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        {seg === 'overview' && <Overview profile={profile} org={org} attendance={attendance} primary={primary} onSignOut={onSignOut} />}
        {seg === 'availability' && <Availability profile={profile} org={org} user={user} primary={primary} onProfileUpdated={onProfileUpdated} />}
        {seg === 'training' && <Training org={org} user={user} primary={primary} />}
        {seg === 'documents' && <Documents org={org} profile={profile} primary={primary} />}
        {seg === 'badges' && <Badges attendance={attendance} profile={profile} primary={primary} />}
        {seg === 'settings' && <Settings profile={profile} onSignOut={onSignOut} />}
      </div>
    </div>
  )
}

function Overview({ profile, org, attendance, primary, onSignOut }) {
  const totalHours = attendance.reduce((s, a) => s + (a.hours_logged || 0), 0)
  return (
    <div>
      <div style={{ ...glassCard({ padding: 16, marginBottom: 12 }) }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>My Impact</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['Hours Volunteered', totalHours.toFixed(1)], ['Sessions Delivered', attendance.length], ['Emergency Contact', profile?.emergency_contact_name || 'Not set'], ['DBS Status', profile?.dbs_number ? 'Verified' : 'Pending']].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{ ...glassCard({ padding: 16, marginBottom: 12 }) }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>Contact</div>
        <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{profile?.email}</div>
        <div style={{ fontSize: 13, color: '#334155' }}>{profile?.phone || 'No phone on file'}</div>
      </div>
      <button onClick={onSignOut} style={{ width: '100%', padding: 13, borderRadius: 14, border: '1.5px solid #FCA5A5', background: '#fff', color: '#DC2626', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Sign Out</button>
    </div>
  )
}

function Availability({ profile, org, user, primary, onProfileUpdated }) {
  const initGrid = profile?.availability?.grid || {}
  const [grid, setGrid] = useState(initGrid)
  const [saving, setSaving] = useState(false)

  const toggle = (day, slot) => {
    setGrid(g => {
      const cur = g[day] || []
      const next = cur.includes(slot) ? cur.filter(s => s !== slot) : [...cur, slot]
      return { ...g, [day]: next }
    })
  }

  const save = async () => {
    setSaving(true)
    const availability = { ...(profile?.availability || {}), grid }
    await supabase.from('user_profiles').update({ availability }).eq('id', user.id)
    setSaving(false)
    onProfileUpdated && onProfileUpdated({ ...profile, availability })
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>Tap the slots you're generally available. This repeats weekly.</div>
      <div style={{ ...glassCard({ padding: 14 }) }}>
        <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          <div />
          {SLOTS.map(([key, label]) => <div key={key} style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textAlign: 'center' }}>{label.split(' ')[1]}</div>)}
        </div>
        {DAYS.map(day => (
          <div key={day} style={{ display: 'grid', gridTemplateColumns: '50px repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center' }}>{day}</div>
            {SLOTS.map(([slotKey]) => {
              const on = (grid[day] || []).includes(slotKey)
              return (
                <button key={slotKey} onClick={() => toggle(day, slotKey)}
                  style={{ height: 36, borderRadius: 10, border: 'none', background: on ? primary : '#F1F5F9', cursor: 'pointer' }} />
              )
            })}
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 14, padding: 13, borderRadius: 14, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save Availability'}</button>
    </div>
  )
}

function Training({ org, user, primary }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('volunteer_training').select('*').eq('org_id', org.id).eq('volunteer_id', user.id).order('created_at', { ascending: false }).then(({ data }) => { setRecords(data || []); setLoading(false) })
  }, [org.id, user.id])

  const mandatory = ['Safeguarding', 'First Aid', 'DBS Check']
  const completedTypes = new Set(records.filter(r => r.status === 'completed').map(r => r.training_type))

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8' }}>Loading…</div>

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>Mandatory Training</div>
      {mandatory.map(m => {
        const done = completedTypes.has(m)
        return (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, background: done ? '#F0FDF4' : '#FFFBEB', marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{done ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{m}</div><div style={{ fontSize: 11, color: done ? '#16A34A' : '#B45309' }}>{done ? 'Completed' : 'Outstanding'}</div></div>
          </div>
        )
      })}
      <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', margin: '16px 0 10px' }}>Certificates</div>
      {records.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: 20 }}>No certificates uploaded yet. Use the + menu to upload one.</div>
      ) : records.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📜</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.training_type}</div>
            <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{r.expiry_date ? `Expires ${new Date(r.expiry_date).toLocaleDateString('en-GB')}` : r.completed_at ? `Completed ${new Date(r.completed_at).toLocaleDateString('en-GB')}` : ''}</div>
          </div>
          {r.certificate_url && <a href={r.certificate_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: primary }}>View</a>}
        </div>
      ))}
    </div>
  )
}

function Documents({ org, profile, primary }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('org_documents').select('*').eq('org_id', org.id).in('visible_to', ['volunteers', 'all']).order('created_at', { ascending: false }).then(({ data }) => { setDocs(data || []); setLoading(false) })
  }, [org.id])

  const CAT_ICON = { policy: '📋', risk_assessment: '🛡️', handbook: '📘', certificate: '📜', insurance: '🧾' }

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8' }}>Loading…</div>

  return docs.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>📄</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>No documents yet</div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Policies, the handbook, and risk assessments will appear here once your organisation adds them.</div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map(d => (
        <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>{CAT_ICON[d.category] || '📄'}</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{d.title}</div>
        </a>
      ))}
    </div>
  )
}

function Badges({ attendance, profile, primary }) {
  const totalHours = attendance.reduce((s, a) => s + (a.hours_logged || 0), 0)
  const sessionsCompleted = attendance.filter(a => a.status === 'completed' || a.signed_out_at).length
  const achievements = computeAchievements({ sessionsCompleted, totalHours, youngPeopleSupported: sessionsCompleted * 8, streakWeeks: 0, dbsVerified: !!profile?.dbs_number, safeguardingTrained: false })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {achievements.map(a => (
        <motion.div key={a.key} whileTap={{ scale: 0.95 }} style={{ ...glassCard({ padding: '16px 8px' }), textAlign: 'center', opacity: a.earned ? 1 : 0.4 }}>
          <div style={{ fontSize: 28, marginBottom: 6, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#334155', lineHeight: 1.2, marginBottom: 3 }}>{a.label}</div>
          <div style={{ fontSize: 9, color: '#94A3B8', lineHeight: 1.2 }}>{a.desc}</div>
        </motion.div>
      ))}
    </div>
  )
}

function Settings({ profile, onSignOut }) {
  const [notifs, setNotifs] = useState(true)
  return (
    <div>
      {[
        ['🔔', 'Notifications', notifs, () => setNotifs(n => !n)],
      ].map(([icon, label, val, toggle]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{label}</div>
          <button onClick={toggle} style={{ width: 42, height: 24, borderRadius: 99, border: 'none', background: val ? '#7C5CFC' : '#E2E8F0', position: 'relative', cursor: 'pointer' }}>
            <motion.div animate={{ x: val ? 20 : 2 }} style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2 }} />
          </button>
        </div>
      ))}
      {['Help & Support', 'Privacy Policy', 'Volunteer Handbook'].map(label => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', marginBottom: 8, cursor: 'pointer' }}>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{label}</div>
          <span style={{ color: '#CBD5E1' }}>›</span>
        </div>
      ))}
      <button onClick={onSignOut} style={{ width: '100%', marginTop: 8, padding: 13, borderRadius: 14, border: '1.5px solid #FCA5A5', background: '#fff', color: '#DC2626', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Sign Out</button>
    </div>
  )
}

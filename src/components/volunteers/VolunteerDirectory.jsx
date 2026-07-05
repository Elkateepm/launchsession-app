import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Badge, Avatar, statusStyle, daysUntil, sessionHours, inputStyle, btnPrimary, btnGhost, PURPLE } from './vh_shared'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'unavailable', label: 'Unavailable' },
  { key: 'pending', label: 'Pending' },
  { key: 'dbs_expiring', label: 'DBS Expiring' },
]

function volunteerStats(v, sessionStaff, sessions) {
  const mine = sessionStaff.filter(ss => ss.volunteer_id === v.id || ss.user_id === v.id)
  const sessionsById = Object.fromEntries(sessions.map(s => [s.id, s]))
  const completed = mine.filter(ss => {
    const s = sessionsById[ss.session_id]
    return s && s.session_date <= new Date().toISOString().slice(0, 10)
  })
  const attended = completed.filter(ss => ss.attended !== false)
  const hours = completed.reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0)
  const attendancePct = completed.length ? Math.round((attended.length / completed.length) * 100) : null
  const upcoming = mine
    .map(ss => sessionsById[ss.session_id])
    .filter(s => s && s.session_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.session_date.localeCompare(b.session_date))[0]
  return { sessionsCompleted: completed.length, hours: Math.round(hours), attendancePct, nextSession: upcoming }
}

export default function VolunteerDirectory({ org, volunteers, sessionStaff, sessions, training, recognition, onMessageVolunteer, onDataChange }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const primary = org?.primary_color || PURPLE

  const filtered = useMemo(() => {
    return volunteers.filter(v => {
      if (search && !(`${v.full_name} ${v.email}`.toLowerCase().includes(search.toLowerCase()))) return false
      if (filter === 'available') return (v.availability && Object.values(v.availability).some(Boolean))
      if (filter === 'unavailable') return !(v.availability && Object.values(v.availability).some(Boolean))
      if (filter === 'pending') return v.status === 'pending'
      if (filter === 'dbs_expiring') { const d = daysUntil(v.dbs_expiry); return d !== null && d <= 30 }
      return true
    })
  }, [volunteers, search, filter])

  return (
    <div>
      <SectionTitle icon="📇" title="Volunteer Directory" subtitle={`${volunteers.length} volunteer${volunteers.length !== 1 ? 's' : ''} in your organisation`} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search volunteers..."
          style={{ ...inputStyle, maxWidth: 280 }} />
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: filter === f.key ? primary : '#fff', color: filter === f.key ? '#fff' : '#475569',
            boxShadow: filter === f.key ? 'none' : '0 1px 3px rgba(15,23,42,0.08)',
          }}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📇</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>No volunteers match this view</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Try a different search or filter.</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map((v, i) => {
            const stats = volunteerStats(v, sessionStaff, sessions)
            const st = v.status === 'pending' ? statusStyle('pending') : statusStyle(stats.attendancePct === null ? 'available' : (stats.attendancePct >= 60 ? 'available' : 'unavailable'))
            const spotlighted = recognition.some(r => r.volunteer_id === v.id && r.type === 'spotlight')
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                whileHover={{ y: -3, boxShadow: '0 12px 30px rgba(15,23,42,0.1)' }}
                onClick={() => setSelected(v)}
                style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 20, padding: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Avatar name={v.full_name} photoUrl={v.photo_url} color={primary} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {v.full_name || '—'} {spotlighted && <span title="Recognised">✨</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>{v.email}</div>
                  </div>
                  <Badge bg={st.bg} color={st.color}>{st.label}</Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                  <MiniStat label="Sessions" value={stats.sessionsCompleted} />
                  <MiniStat label="Hours" value={stats.hours} />
                  <MiniStat label="Attend." value={stats.attendancePct !== null ? `${stats.attendancePct}%` : '—'} />
                </div>
                {(v.skills || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {v.skills.slice(0, 3).map(s => <Badge key={s} bg="rgba(124,92,252,0.1)" color={PURPLE}>{s}</Badge>)}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 10 }}>
                  {stats.nextSession ? `Next: ${stats.nextSession.title} · ${new Date(stats.nextSession.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'No upcoming sessions'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); onMessageVolunteer?.(v) }} style={{ ...btnGhost, flex: 1, padding: '7px 0', fontSize: 12 }}>Message</button>
                  <button onClick={e => { e.stopPropagation(); setSelected(v) }} style={{ ...btnPrimary(primary), flex: 1, padding: '7px 0', fontSize: 12 }}>Profile</button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <ProfileDrawer
            volunteer={selected}
            org={org}
            stats={volunteerStats(selected, sessionStaff, sessions)}
            training={training.filter(t => t.volunteer_id === selected.id)}
            recognition={recognition.filter(r => r.volunteer_id === selected.id)}
            sessions={sessions}
            onClose={() => setSelected(null)}
            onMessage={() => { onMessageVolunteer?.(selected); setSelected(null) }}
            onSaved={onDataChange}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '6px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{value}</div>
      <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

export function ProfileDrawer({ volunteer, org, stats, training, recognition, sessions, onClose, onMessage, onSaved }) {
  const primary = org?.primary_color || PURPLE
  const [notes, setNotes] = useState(volunteer.application_notes || '')
  const [saving, setSaving] = useState(false)
  const [assignSessionId, setAssignSessionId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const upcomingOptions = sessions.filter(s => s.session_date >= new Date().toISOString().slice(0, 10))

  async function saveNotes() {
    setSaving(true)
    await supabase.from('user_profiles').update({ application_notes: notes }).eq('id', volunteer.id)
    setSaving(false)
    onSaved?.()
  }

  async function assignToSession() {
    if (!assignSessionId) return
    setAssigning(true)
    await supabase.from('session_staff').insert({ org_id: org.id, session_id: assignSessionId, volunteer_id: volunteer.id, role: 'volunteer' })
    setAssigning(false)
    setAssignSessionId('')
    onSaved?.()
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 1000 }} />
      <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', background: '#fff', zIndex: 1001, overflowY: 'auto', boxShadow: '-20px 0 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: 24, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar name={volunteer.full_name} photoUrl={volunteer.photo_url} size={56} color={primary} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>{volunteer.full_name}</div>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>{volunteer.email}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            <MiniStat label="Sessions" value={stats.sessionsCompleted} />
            <MiniStat label="Hours" value={stats.hours} />
            <MiniStat label="Attend." value={stats.attendancePct !== null ? `${stats.attendancePct}%` : '—'} />
          </div>

          <DrawerSection title="Contact">
            <Row label="Phone" value={volunteer.phone || '—'} />
            <Row label="Emergency Contact" value={volunteer.emergency_contact_name ? `${volunteer.emergency_contact_name} (${volunteer.emergency_contact_phone || '—'})` : '—'} />
          </DrawerSection>

          <DrawerSection title="Skills & Groups">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(volunteer.skills || []).length ? volunteer.skills.map(s => <Badge key={s} bg="rgba(124,92,252,0.1)" color={PURPLE}>{s}</Badge>) : <span style={{ fontSize: 12.5, color: '#94A3B8' }}>No skills recorded</span>}
            </div>
          </DrawerSection>

          <DrawerSection title="Assign to a Session">
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={assignSessionId} onChange={e => setAssignSessionId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Choose an upcoming session...</option>
                {upcomingOptions.map(s => <option key={s.id} value={s.id}>{s.title} · {new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</option>)}
              </select>
              <button onClick={assignToSession} disabled={!assignSessionId || assigning} style={{ ...btnPrimary(primary), opacity: assignSessionId ? 1 : 0.5 }}>{assigning ? '...' : 'Assign'}</button>
            </div>
          </DrawerSection>

          <DrawerSection title="Training & Compliance">
            <Row label="DBS" value={volunteer.dbs_expiry ? `Expires ${new Date(volunteer.dbs_expiry).toLocaleDateString('en-GB')}` : 'Not on file'} />
            {training.length ? training.map(t => (
              <Row key={t.id} label={t.training_type.replace('_', ' ')} value={t.status} />
            )) : <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No additional training records</div>}
          </DrawerSection>

          {recognition.length > 0 && (
            <DrawerSection title="Recognition">
              {recognition.map(r => <Row key={r.id} label={r.title} value={new Date(r.awarded_at).toLocaleDateString('en-GB')} />)}
            </DrawerSection>
          )}

          <DrawerSection title="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              style={{ ...selectStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Private notes about this volunteer..." />
            <button onClick={saveNotes} disabled={saving} style={{ ...btnGhost, marginTop: 8, fontSize: 12 }}>{saving ? 'Saving...' : 'Save notes'}</button>
          </DrawerSection>

          <button onClick={onMessage} style={{ ...btnPrimary(primary), width: '100%', marginTop: 12 }}>Message {volunteer.full_name?.split(' ')[0]}</button>
        </div>
      </motion.div>
    </>
  )
}

const selectStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0F172A' }

function DrawerSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
      <span style={{ color: '#64748B', textTransform: 'capitalize' }}>{label}</span>
      <span style={{ color: '#0F172A', fontWeight: 600, textTransform: 'capitalize' }}>{value}</span>
    </div>
  )
}

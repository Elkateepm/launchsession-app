import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Avatar, Badge, sessionHours, PURPLE } from './vh_shared'

const MILESTONES = [25, 50, 100, 250, 500]

function totalHours(v, sessionStaff, sessions) {
  const sessionsById = Object.fromEntries(sessions.map(s => [s.id, s]))
  const mine = sessionStaff.filter(ss => (ss.volunteer_id === v.id || ss.user_id === v.id) && ss.attended !== false)
  return Math.round(mine.reduce((sum, ss) => sum + sessionHours(sessionsById[ss.session_id]), 0))
}

export default function VolunteersRecognition({ org, volunteers, sessionStaff, sessions, recognition, onDataChange }) {
  const primary = org?.primary_color || PURPLE
  const [awarding, setAwarding] = useState(null)
  const [saving, setSaving] = useState(false)

  const withHours = volunteers.map(v => ({ ...v, hours: totalHours(v, sessionStaff, sessions) })).sort((a, b) => b.hours - a.hours)
  const spotlight = recognition.filter(r => r.type === 'spotlight').sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at))[0]
  const spotlightVolunteer = spotlight ? volunteers.find(v => v.id === spotlight.volunteer_id) : withHours[0]

  const milestoneHits = withHours.flatMap(v =>
    MILESTONES.filter(m => v.hours >= m && !recognition.some(r => r.volunteer_id === v.id && r.type === 'milestone' && r.title === `${m} Hours`))
      .map(m => ({ volunteer: v, milestone: m }))
  )

  async function award(volunteerId, type, title) {
    setSaving(true)
    await supabase.from('volunteer_recognition').insert({ org_id: org.id, volunteer_id: volunteerId, type, title })
    setSaving(false)
    setAwarding(null)
    onDataChange?.()
  }

  return (
    <div>
      <SectionTitle icon="🏆" title="Recognition" subtitle="Celebrate the people who show up for your organisation" />

      {spotlightVolunteer && (
        <Card style={{ background: `linear-gradient(135deg, ${primary}14, ${PURPLE}0c)`, border: `1px solid ${primary}30`, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>✨ Volunteer Spotlight</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Avatar name={spotlightVolunteer.full_name} photoUrl={spotlightVolunteer.photo_url} size={56} color={primary} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>{spotlightVolunteer.full_name}</div>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>{spotlightVolunteer.hours || totalHours(spotlightVolunteer, sessionStaff, sessions)} hours volunteered</div>
            </div>
            <button onClick={() => award(spotlightVolunteer.id, 'spotlight', 'Volunteer of the Month')} disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
              Celebrate 🎉
            </button>
          </div>
        </Card>
      )}

      {milestoneHits.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Milestones reached</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {milestoneHits.slice(0, 6).map(({ volunteer, milestone }) => (
              <div key={volunteer.id + milestone} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <Avatar name={volunteer.full_name} photoUrl={volunteer.photo_url} size={30} color={primary} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{volunteer.full_name} <span style={{ color: '#94A3B8', fontWeight: 500 }}>hit {milestone} hours</span></div>
                <button onClick={() => award(volunteer.id, 'milestone', `${milestone} Hours`)} disabled={saving}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#0F172A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Send Thank You</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Recognition history</div>
        {recognition.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>No recognitions given yet — celebrate a volunteer above to get started.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recognition.sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at)).slice(0, 12).map(r => {
              const v = volunteers.find(x => x.id === r.volunteer_id)
              return (
                <motion.div key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <Avatar name={v?.full_name} photoUrl={v?.photo_url} size={28} color={primary} />
                  <div style={{ flex: 1, fontSize: 12.5, color: '#334155' }}><strong style={{ color: '#0F172A' }}>{v?.full_name || 'A volunteer'}</strong> — {r.title}</div>
                  <Badge>{new Date(r.awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Badge>
                </motion.div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

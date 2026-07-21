import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const FIELDS = [
  ['emergency_contacts', '📞 Emergency Contacts', 'Names and numbers of key contacts'],
  ['meeting_point', '📍 Meeting Point', 'Where to gather in an emergency'],
  ['nearest_hospital', '🏥 Nearest Hospital / A&E', 'Name and address'],
  ['first_aid_equipment', '🧰 First Aid Equipment', 'What is available and where'],
  ['defibrillator_location', '❤️ Defibrillator Location', 'Nearest AED'],
  ['emergency_procedures', '🚨 Emergency Procedures', 'Step-by-step response'],
  ['evacuation_plan', '🚪 Evacuation Plan', 'Routes and assembly points'],
  ['missing_child_procedure', '🧒 Missing Child Procedure', 'What to do if a child goes missing'],
  ['safeguarding_escalation', '🛡️ Safeguarding Escalation', 'Who to contact and how'],
  ['weather_contingency', '🌧️ Weather Contingency', 'Plan for adverse weather'],
]

export default function RAEmergencyPlan({ assessment, org, venues }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [form, setForm] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  const timers = useRef({})

  const venue = assessment.venue_id ? (venues || []).find(v => v.id === assessment.venue_id) : null
  const VENUE_SOURCE = { meeting_point: 'default_meeting_point', nearest_hospital: 'nearest_hospital', defibrillator_location: 'defibrillator_location' }
  const fillableFromVenue = venue ? Object.entries(VENUE_SOURCE).filter(([localKey, venueKey]) => venue[venueKey] && !form[localKey]) : []

  useEffect(() => {
    const init = {}
    FIELDS.forEach(([k]) => { init[k] = assessment[k] || '' })
    setForm(init)
  }, [assessment.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(async () => {
      setSavingKey(key)
      await supabase.from('risk_assessments').update({ [key]: value, updated_at: new Date().toISOString() }).eq('id', assessment.id)
      setSavingKey(null)
    }, 600)
  }

  const fillFromVenue = () => {
    fillableFromVenue.forEach(([localKey, venueKey]) => save(localKey, venue[venueKey]))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {venue && fillableFromVenue.length > 0 && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#166534', fontWeight: 700, flex: 1 }}>📍 {venue.name} has {fillableFromVenue.length} emergency detail(s) on file</span>
          <button onClick={fillFromVenue} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fill from venue</button>
        </div>
      )}
      {FIELDS.map(([key, label, hint]) => (
        <div key={key}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            <span>{label}</span>
            {savingKey === key && <span style={{ fontSize: 10.5, color: primary, fontWeight: 700 }}>Saving…</span>}
          </label>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{hint}</div>
          <textarea
            value={form[key] || ''} onChange={e => save(key, e.target.value)}
            placeholder="—"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13.5, outline: 'none', resize: 'vertical', minHeight: 56, fontFamily: 'inherit' }}
          />
        </div>
      ))}
    </div>
  )
}

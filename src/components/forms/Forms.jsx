import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'

function CountUp({ value, duration = 0.6 }) {
  const [display, setDisplay] = React.useState(value)
  const prevRef = React.useRef(value)
  React.useEffect(() => {
    const start = prevRef.current
    const end = value
    if (start === end) return
    const startTime = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000))
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else prevRef.current = end
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{display}</>
}

const FIELD_TYPES = [
  { key: 'text',     label: 'Short Text',  icon: '📝' },
  { key: 'textarea', label: 'Long Text',   icon: '📄' },
  { key: 'checkbox', label: 'Checkbox',    icon: '☑️' },
  { key: 'select',   label: 'Dropdown',    icon: '🔽' },
  { key: 'date',     label: 'Date',        icon: '📅' },
  { key: 'number',   label: 'Number',      icon: '🔢' },
  { key: 'email',    label: 'Email',       icon: '📧' },
  { key: 'phone',    label: 'Phone',       icon: '📞' },
]

const CATEGORIES = [
  { key: 'all',          label: 'All',          icon: '✨' },
  { key: 'youth',        label: 'Youth Work',   icon: '🧒' },
  { key: 'parents',      label: 'Parents',      icon: '👪' },
  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
  { key: 'volunteers',   label: 'Volunteers',   icon: '❤️' },
  { key: 'staff',        label: 'Staff',        icon: '🧑‍💼' },
  { key: 'trips',        label: 'Trips',        icon: '🚌' },
  { key: 'organisation', label: 'Organisation', icon: '🏢' },
]

const CATEGORY_COLOR = {
  youth: '#2563EB', parents: '#DB2777', safeguarding: '#DC2626',
  volunteers: '#F16063', staff: '#7C3AED', trips: '#D97706', organisation: '#059669',
}

const TEMPLATES = [
  // ── YOUTH ──
  { name: 'Youth Registration', icon: '📋', category: 'youth', desc: 'Collect participant information for new members', fields: [
    { type: 'text', label: 'Child First Name', required: true },
    { type: 'text', label: 'Child Last Name', required: true },
    { type: 'date', label: 'Date of Birth', required: true },
    { type: 'text', label: 'Parent / Guardian Name', required: true },
    { type: 'email', label: 'Parent Email', required: true },
    { type: 'phone', label: 'Parent Phone', required: true },
    { type: 'textarea', label: 'Medical Info / Allergies' },
    { type: 'checkbox', label: 'I agree to the programme terms and conditions', required: true },
  ]},
  { name: 'Attendance Check-in', icon: '✅', category: 'youth', desc: 'Quick daily sign-in form for sessions', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'select', label: 'Group', options: ['Red', 'Blue', 'Green', 'Yellow'] },
    { type: 'checkbox', label: 'Present today', required: true },
  ]},
  { name: 'Holiday Club Registration', icon: '🏖️', category: 'youth', desc: 'Sign up for holiday programme sessions', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'date', label: 'Date of Birth', required: true },
    { type: 'select', label: 'Weeks Attending', options: ['Week 1', 'Week 2', 'Week 3', 'All weeks'] },
    { type: 'textarea', label: 'Dietary Requirements or Allergies' },
    { type: 'checkbox', label: 'I consent to my child attending', required: true },
  ]},
  { name: 'Youth Voice Survey', icon: '🗣️', category: 'youth', desc: 'Give young people a say in programme decisions', fields: [
    { type: 'text', label: 'Name (optional)' },
    { type: 'textarea', label: 'What do you enjoy most about sessions?' },
    { type: 'textarea', label: 'What would you like to see more of?' },
    { type: 'select', label: 'How do you feel coming here?', options: ['Excited', 'Happy', 'Okay', 'Nervous', 'Unsure'] },
  ]},
  { name: 'Wellbeing Check', icon: '💛', category: 'youth', desc: 'Quick mood and wellbeing check-in', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'select', label: 'How are you feeling today?', options: ['😊 Happy', '🙂 Settled', '😐 Quiet', '😟 Worried', '😢 Upset'] },
    { type: 'textarea', label: 'Anything you want to tell us?' },
  ]},
  { name: 'Session Reflection', icon: '⭐', category: 'youth', desc: 'Gather feedback from participants after a session', fields: [
    { type: 'text', label: 'Name (optional)' },
    { type: 'select', label: 'How would you rate today?', options: ['⭐ Needs Improvement', '⭐⭐ OK', '⭐⭐⭐ Good', '⭐⭐⭐⭐ Great', '⭐⭐⭐⭐⭐ Outstanding!'] },
    { type: 'textarea', label: 'What did you enjoy most?' },
    { type: 'textarea', label: 'What could we do better?' },
  ]},
  { name: 'Goal Setting', icon: '🎯', category: 'youth', desc: 'Record personal development goals with a young person', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'textarea', label: 'What would you like to achieve?', required: true },
    { type: 'date', label: 'Review Date' },
    { type: 'textarea', label: 'Support Needed' },
  ]},

  // ── PARENTS ──
  { name: 'Trip Consent Form', icon: '🚌', category: 'parents', desc: 'Permission slip for events & trips', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'text', label: 'Parent / Guardian Name', required: true },
    { type: 'phone', label: 'Emergency Contact Number', required: true },
    { type: 'textarea', label: 'Medical Information or Allergies' },
    { type: 'checkbox', label: 'I consent to my child attending this trip or event', required: true },
    { type: 'checkbox', label: 'I consent to photos being taken of my child' },
  ]},
  { name: 'Photography Consent', icon: '📷', category: 'parents', desc: 'Permission to use photos/video in marketing', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'text', label: 'Parent / Guardian Name', required: true },
    { type: 'checkbox', label: 'I consent to photos being taken', required: true },
    { type: 'checkbox', label: 'I consent to photos being used on social media' },
    { type: 'checkbox', label: 'I consent to photos being used in printed materials' },
  ]},
  { name: 'Medical Consent', icon: '🏥', category: 'parents', desc: 'Consent for medical treatment and medication', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'textarea', label: 'Known Medical Conditions' },
    { type: 'textarea', label: 'Current Medication' },
    { type: 'checkbox', label: 'I consent to emergency medical treatment if required', required: true },
    { type: 'checkbox', label: 'I consent to staff administering prescribed medication' },
  ]},
  { name: 'Emergency Contacts', icon: '📞', category: 'parents', desc: 'Collect up-to-date emergency contact details', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'text', label: 'Primary Contact Name', required: true },
    { type: 'phone', label: 'Primary Contact Number', required: true },
    { type: 'text', label: 'Secondary Contact Name' },
    { type: 'phone', label: 'Secondary Contact Number' },
  ]},
  { name: 'Late Collection Notice', icon: '⏰', category: 'parents', desc: 'Record who is authorised to collect a child late', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'text', label: 'Name of Person Collecting', required: true },
    { type: 'text', label: 'Relationship to Child', required: true },
    { type: 'date', label: 'Date' },
  ]},
  { name: 'Parent Feedback', icon: '💬', category: 'parents', desc: 'Gather feedback from parents and carers', fields: [
    { type: 'text', label: 'Parent Name (optional)' },
    { type: 'select', label: 'Overall satisfaction', options: ['⭐ Poor', '⭐⭐ Fair', '⭐⭐⭐ Good', '⭐⭐⭐⭐ Very Good', '⭐⭐⭐⭐⭐ Excellent'] },
    { type: 'textarea', label: 'What is going well?' },
    { type: 'textarea', label: 'What could be improved?' },
  ]},

  // ── SAFEGUARDING ──
  { name: 'Cause For Concern', icon: '🚨', category: 'safeguarding', desc: 'Report a safeguarding concern about a child', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'text', label: 'Reported By', required: true },
    { type: 'date', label: 'Date of Concern', required: true },
    { type: 'textarea', label: 'Description of Concern', required: true },
    { type: 'textarea', label: 'Action Taken' },
  ]},
  { name: 'Incident Report', icon: '⚠️', category: 'safeguarding', desc: 'Record accidents and incidents', fields: [
    { type: 'text', label: 'Person Involved', required: true },
    { type: 'date', label: 'Date of Incident', required: true },
    { type: 'text', label: 'Location', required: true },
    { type: 'select', label: 'Severity', required: true, options: ['Minor', 'Moderate', 'Serious', 'Critical'] },
    { type: 'textarea', label: 'Description of What Happened', required: true },
    { type: 'textarea', label: 'Action Taken', required: true },
    { type: 'text', label: 'Staff Member Reporting', required: true },
  ]},
  { name: 'Body Map Record', icon: '🩹', category: 'safeguarding', desc: 'Record and describe visible marks or injuries', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'date', label: 'Date Observed', required: true },
    { type: 'textarea', label: 'Description and Location of Mark/Injury', required: true },
    { type: 'text', label: 'Observed By', required: true },
  ]},
  { name: 'Missing Child Report', icon: '🔍', category: 'safeguarding', desc: 'Record details when a child cannot be located', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'date', label: 'Date' },
    { type: 'text', label: 'Time Last Seen', required: true },
    { type: 'textarea', label: 'Actions Taken', required: true },
    { type: 'checkbox', label: 'Police were contacted' },
  ]},
  { name: 'Risk Assessment', icon: '📐', category: 'safeguarding', desc: 'Document session risk assessments', fields: [
    { type: 'text', label: 'Activity or Session Name', required: true },
    { type: 'date', label: 'Assessment Date', required: true },
    { type: 'text', label: 'Assessor Name', required: true },
    { type: 'textarea', label: 'Identified Hazards', required: true },
    { type: 'textarea', label: 'Control Measures in Place', required: true },
    { type: 'select', label: 'Overall Risk Level', options: ['Low', 'Medium', 'High', 'Very High'] },
  ]},
  { name: 'First Aid Record', icon: '🩺', category: 'safeguarding', desc: 'Log first aid given during a session', fields: [
    { type: 'text', label: 'Child Name', required: true },
    { type: 'date', label: 'Date' },
    { type: 'textarea', label: 'Nature of Injury/Illness', required: true },
    { type: 'textarea', label: 'Treatment Given', required: true },
    { type: 'checkbox', label: 'Parent was notified' },
  ]},

  // ── VOLUNTEERS ──
  { name: 'Volunteer Application', icon: '❤️', category: 'volunteers', desc: 'Onboard new volunteers', fields: [
    { type: 'text', label: 'Full Name', required: true },
    { type: 'email', label: 'Email Address', required: true },
    { type: 'phone', label: 'Phone Number', required: true },
    { type: 'textarea', label: 'Why do you want to volunteer with us?' },
    { type: 'textarea', label: 'Relevant skills or experience' },
    { type: 'select', label: 'Availability', options: ['Weekdays', 'Weekends', 'Both', 'Flexible'] },
    { type: 'checkbox', label: 'I agree to a DBS check if required', required: true },
  ]},
  { name: 'Volunteer Availability', icon: '📅', category: 'volunteers', desc: 'Collect weekly availability from volunteers', fields: [
    { type: 'text', label: 'Volunteer Name', required: true },
    { type: 'checkbox', label: 'Monday' }, { type: 'checkbox', label: 'Tuesday' },
    { type: 'checkbox', label: 'Wednesday' }, { type: 'checkbox', label: 'Thursday' },
    { type: 'checkbox', label: 'Friday' }, { type: 'checkbox', label: 'Weekend' },
  ]},
  { name: 'Reference Request', icon: '📩', category: 'volunteers', desc: 'Request a character reference for a volunteer', fields: [
    { type: 'text', label: 'Referee Name', required: true },
    { type: 'text', label: 'Relationship to Applicant', required: true },
    { type: 'textarea', label: 'How long have you known the applicant?' },
    { type: 'textarea', label: 'Comments on suitability to work with young people', required: true },
  ]},
  { name: 'Volunteer Review', icon: '📊', category: 'volunteers', desc: 'Periodic performance review for volunteers', fields: [
    { type: 'text', label: 'Volunteer Name', required: true },
    { type: 'date', label: 'Review Date', required: true },
    { type: 'textarea', label: 'Strengths' },
    { type: 'textarea', label: 'Areas for Development' },
    { type: 'select', label: 'Overall Rating', options: ['Needs Support', 'Good', 'Excellent'] },
  ]},
  { name: 'Volunteer Exit Form', icon: '👋', category: 'volunteers', desc: 'Capture feedback when a volunteer leaves', fields: [
    { type: 'text', label: 'Volunteer Name', required: true },
    { type: 'date', label: 'Last Day' },
    { type: 'textarea', label: 'Reason for Leaving' },
    { type: 'textarea', label: 'Feedback for the Organisation' },
  ]},

  // ── STAFF ──
  { name: 'Annual Leave Request', icon: '🏖️', category: 'staff', desc: 'Request time off', fields: [
    { type: 'text', label: 'Staff Name', required: true },
    { type: 'date', label: 'Start Date', required: true },
    { type: 'date', label: 'End Date', required: true },
    { type: 'textarea', label: 'Reason (optional)' },
  ]},
  { name: 'Supervision Notes', icon: '🗒️', category: 'staff', desc: 'Record 1:1 supervision meeting notes', fields: [
    { type: 'text', label: 'Staff Member', required: true },
    { type: 'date', label: 'Meeting Date', required: true },
    { type: 'textarea', label: 'Key Discussion Points', required: true },
    { type: 'textarea', label: 'Actions Agreed' },
  ]},
  { name: 'Staff Appraisal', icon: '📈', category: 'staff', desc: 'Annual staff performance appraisal', fields: [
    { type: 'text', label: 'Staff Name', required: true },
    { type: 'date', label: 'Appraisal Date', required: true },
    { type: 'textarea', label: 'Achievements This Year' },
    { type: 'textarea', label: 'Goals for Next Year' },
    { type: 'select', label: 'Overall Performance', options: ['Needs Improvement', 'Good', 'Very Good', 'Outstanding'] },
  ]},
  { name: 'Expenses Claim', icon: '🧾', category: 'staff', desc: 'Submit expenses for reimbursement', fields: [
    { type: 'text', label: 'Name', required: true },
    { type: 'date', label: 'Date of Expense', required: true },
    { type: 'text', label: 'Description', required: true },
    { type: 'number', label: 'Amount (£)', required: true },
  ]},

  // ── TRIPS ──
  { name: 'Trip Risk Assessment', icon: '🗺️', category: 'trips', desc: 'Assess risks for an upcoming trip', fields: [
    { type: 'text', label: 'Trip Destination', required: true },
    { type: 'date', label: 'Trip Date', required: true },
    { type: 'textarea', label: 'Identified Risks', required: true },
    { type: 'textarea', label: 'Control Measures', required: true },
    { type: 'text', label: 'Ratio of Staff to Children' },
  ]},
  { name: 'Trip Head Count', icon: '🔢', category: 'trips', desc: 'Track head counts throughout a trip', fields: [
    { type: 'text', label: 'Trip Name', required: true },
    { type: 'text', label: 'Checkpoint (e.g. Departure, Arrival)', required: true },
    { type: 'number', label: 'Expected Number', required: true },
    { type: 'number', label: 'Actual Count', required: true },
  ]},
  { name: 'Packing Checklist', icon: '🎒', category: 'trips', desc: 'What to bring for a trip or residential', fields: [
    { type: 'checkbox', label: 'Packed lunch' }, { type: 'checkbox', label: 'Water bottle' },
    { type: 'checkbox', label: 'Waterproof coat' }, { type: 'checkbox', label: 'Sun cream' },
    { type: 'checkbox', label: 'Medication (if needed)' },
  ]},
  { name: 'Trip Reflection', icon: '📝', category: 'trips', desc: 'Debrief and reflect after a trip', fields: [
    { type: 'text', label: 'Trip Name', required: true },
    { type: 'textarea', label: 'What went well?' },
    { type: 'textarea', label: 'What would we change next time?' },
    { type: 'checkbox', label: 'Any incidents to log?' },
  ]},

  // ── ORGANISATION ──
  { name: 'Room Booking Request', icon: '🚪', category: 'organisation', desc: 'Request use of a room or facility', fields: [
    { type: 'text', label: 'Requested By', required: true },
    { type: 'date', label: 'Date Needed', required: true },
    { type: 'text', label: 'Room / Facility', required: true },
    { type: 'textarea', label: 'Purpose' },
  ]},
  { name: 'Visitor Sign-in', icon: '🪪', category: 'organisation', desc: 'Log visitors to the building', fields: [
    { type: 'text', label: 'Visitor Name', required: true },
    { type: 'text', label: 'Organisation / Reason for Visit', required: true },
    { type: 'text', label: 'Host / Contact', required: true },
    { type: 'checkbox', label: 'ID checked' },
  ]},
  { name: 'GDPR Data Request', icon: '🔒', category: 'organisation', desc: 'Handle subject access or deletion requests', fields: [
    { type: 'text', label: 'Requester Name', required: true },
    { type: 'email', label: 'Email', required: true },
    { type: 'select', label: 'Request Type', options: ['Access my data', 'Correct my data', 'Delete my data'] },
    { type: 'textarea', label: 'Additional Details' },
  ]},
  { name: 'Donation Form', icon: '💷', category: 'organisation', desc: 'Record a donation to the organisation', fields: [
    { type: 'text', label: 'Donor Name', required: true },
    { type: 'number', label: 'Amount (£)', required: true },
    { type: 'checkbox', label: 'Gift Aid eligible' },
    { type: 'textarea', label: 'Notes' },
  ]},
]

function FormBuilder({ org, initial, onSave, onCancel }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(initial || { name: '', description: '', fields: [] })
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  const addField = (type) => {
    const newField = { id: Date.now(), type, label: FIELD_TYPES.find(f => f.key === type)?.label || type, required: false, options: type === 'select' ? ['Option 1', 'Option 2'] : undefined }
    setForm(f => ({ ...f, fields: [...f.fields, newField] }))
  }

  const updateField = (id, changes) => setForm(f => ({ ...f, fields: f.fields.map(field => field.id === id ? { ...field, ...changes } : field) }))
  const removeField = (id) => setForm(f => ({ ...f, fields: f.fields.filter(field => field.id !== id) }))
  const moveField = (from, to) => {
    const fields = [...form.fields]
    const [moved] = fields.splice(from, 1)
    fields.splice(to, 0, moved)
    setForm(f => ({ ...f, fields }))
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 900 }}>{initial ? 'Edit Form' : 'Build New Form'}</div>
        <button onClick={handleSave} disabled={saving || !form.name} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: saving || !form.name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
          {saving ? 'Saving...' : '💾 Save Form'}
        </button>
      </div>

      {/* Form meta */}
      <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>FORM NAME *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Trip Consent Form" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DESCRIPTION</label>
            <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this form for?" style={inp} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20 }}>
        {/* Add fields panel */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Add Fields</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FIELD_TYPES.map(ft => (
              <button key={ft.key} onClick={() => addField(ft.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${primary}30`, background: primary + '08', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = primary + '15'; e.currentTarget.style.borderColor = primary }}
                onMouseLeave={e => { e.currentTarget.style.background = primary + '08'; e.currentTarget.style.borderColor = primary + '30' }}>
                <span>{ft.icon}</span> {ft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields canvas */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>Form Fields ({form.fields.length})</div>
          </div>
          {form.fields.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', borderRadius: 14, border: '1.5px dashed #e5e7eb', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              Add fields from the left to build your form
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.fields.map((field, idx) => (
                <div key={field.id} draggable onDragOver={e => { e.preventDefault(); setDragOver(idx) }} onDrop={() => { if (dragOver !== null && dragOver !== idx) moveField(dragOver > idx ? dragOver : dragOver, idx); setDragOver(null) }} onDragStart={() => setDragOver(idx)}
                  style={{ background: '#fff', border: `1.5px solid ${dragOver === idx ? primary : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 16, marginTop: 2, cursor: 'grab', opacity: 0.4 }}>⠿</div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} style={{ ...inp, flex: 1, fontSize: 13, fontWeight: 600 }} placeholder="Field label" />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F3F4F6', borderRadius: 8, padding: '0 10px', fontSize: 11, fontWeight: 700, color: '#6B7280', flexShrink: 0 }}>
                            {FIELD_TYPES.find(f => f.key === field.type)?.icon} {field.type}
                          </div>
                        </div>
                        {field.type === 'select' && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>Options (one per line):</div>
                            <textarea value={(field.options || []).join('\n')} onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })} rows={3} style={{ ...inp, resize: 'none', fontSize: 12 }} />
                          </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer', marginTop: 4 }}>
                          <input type="checkbox" checked={field.required || false} onChange={e => updateField(field.id, { required: e.target.checked })} />
                          Required field
                        </label>
                      </div>
                      <button onClick={() => removeField(field.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 18, padding: 0, marginTop: 2 }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SubmissionsView({ form, org, onBack }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    supabase.from('form_submissions').select('*').eq('form_id', form.id).order('created_at', { ascending: false }).then(({ data }) => { setSubmissions(data || []); setLoading(false) })
  }, [form.id])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{form.name}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div>
      ) : submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 16, color: '#9CA3AF', border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 700 }}>No submissions yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Share the form link to start collecting responses</div>
        </div>
      ) : selected ? (
        <div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← All Submissions</button>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Submitted {format(new Date(selected.created_at), 'd MMM yyyy HH:mm')}</div>
            {form.fields.map((field, i) => (
              <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < form.fields.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>{field.label}</div>
                <div style={{ fontSize: 14, color: '#111' }}>
                  {field.type === 'checkbox' ? (selected.data?.[field.label] ? '✅ Yes' : '☐ No') : selected.data?.[field.label] || <span style={{ color: '#9CA3AF' }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {submissions.map((sub, i) => (
            <div key={sub.id} onClick={() => setSelected(sub)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = primary}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Submission #{submissions.length - i}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{format(new Date(sub.created_at), 'd MMM yyyy · HH:mm')}</div>
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>View →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Forms({ org }) {
  const isMobile = useIsMobile()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'builder' | 'submissions'
  const [selectedForm, setSelectedForm] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('org_forms').select('*, form_submissions(count)').eq('org_id', org.id).order('created_at', { ascending: false })
    setForms(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const saveForm = async (formData) => {
    if (selectedForm) {
      await supabase.from('org_forms').update({ name: formData.name, description: formData.description, fields: formData.fields }).eq('id', selectedForm.id)
    } else {
      await supabase.from('org_forms').insert({ org_id: org.id, name: formData.name, description: formData.description, fields: formData.fields })
    }
    load()
    setView('list')
    setSelectedForm(null)
  }

  const deleteForm = async (form) => {
    if (!window.confirm(`Delete "${form.name}"? All submissions will be lost.`)) return
    await supabase.from('org_forms').delete().eq('id', form.id)
    setForms(f => f.filter(x => x.id !== form.id))
  }

  const toggleActive = async (form) => {
    const updated = !form.is_active
    await supabase.from('org_forms').update({ is_active: updated }).eq('id', form.id)
    setForms(f => f.map(x => x.id === form.id ? { ...x, is_active: updated } : x))
  }

  if (view === 'builder') return <FormBuilder org={org} initial={selectedForm} onSave={saveForm} onCancel={() => { setView('list'); setSelectedForm(null) }} />
  if (view === 'submissions' && selectedForm) return <SubmissionsView form={selectedForm} org={org} onBack={() => { setView('list'); setSelectedForm(null); load() }} />

  const totalSubmissions = forms.reduce((s, f) => s + (f.form_submissions?.[0]?.count || 0), 0)
  const activeCount = forms.filter(f => f.is_active).length

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchCategory = category === 'all' || t.category === category
    const matchSearch = !search.trim() || `${t.name} ${t.desc}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchCategory && matchSearch
  })

  const useTemplate = (t) => {
    setSelectedForm({ name: t.name, description: t.desc, fields: t.fields.map((f, i) => ({ ...f, id: Date.now() + i })) })
    setView('builder')
  }

  const statCards = [
    { key: 'total', label: 'Total Forms', value: forms.length, icon: '📝', color: '#6D5DF6' },
    { key: 'active', label: 'Active', value: activeCount, icon: '✅', color: '#30C48D' },
    { key: 'submissions', label: 'Submissions', value: totalSubmissions, icon: '📬', color: '#5B8DEF' },
    { key: 'drafts', label: 'Drafts', value: forms.filter(f => !f.is_active).length, icon: '📄', color: '#FFB648' },
  ]

  return (
    <div style={{ background: 'radial-gradient(circle at 15% 0%, #6D5DF60C, transparent 40%), radial-gradient(circle at 85% 15%, #30C48D0C, transparent 40%), #F6F8FC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>

      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 28, padding: isMobile ? '24px 20px' : '32px 36px',
          background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 20px 60px -20px rgba(30,41,59,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
          marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 16,
        }}
      >
        <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, #6D5DF635, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -70, left: '20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #30C48D28, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 26 }}>📝</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>Forms</span>
          </div>
          <div style={{ fontSize: 14, color: '#475569' }}>Build digital forms, applications and consent packs.</div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10 }}>
          <motion.button
            onClick={() => setShowTemplates(v => !v)}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '13px 22px', borderRadius: 14, border: '1.5px solid #6D5DF6', background: '#fff', color: '#6D5DF6', fontWeight: 800, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📋 Browse Templates
          </motion.button>
          <motion.button
            onClick={() => { setSelectedForm(null); setView('builder') }}
            whileHover={{ y: -3, boxShadow: '0 16px 40px -10px rgba(109,93,246,0.5)' }} whileTap={{ scale: 0.97 }}
            style={{ padding: '13px 22px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 30px -8px rgba(109,93,246,0.4)', whiteSpace: 'nowrap' }}>
            + Create Form
          </motion.button>
        </div>
      </motion.div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {statCards.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            whileHover={{ scale: 1.03, y: -3 }}
            style={{
              background: `linear-gradient(150deg, ${s.color}14, rgba(255,255,255,0.65) 55%)`, backdropFilter: 'blur(14px)',
              borderRadius: 20, border: `1px solid ${s.color}30`, boxShadow: `0 8px 28px -14px ${s.color}50, inset 0 1px 0 rgba(255,255,255,0.85)`,
              padding: '18px 18px',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: -0.5, lineHeight: 1 }}><CountUp value={s.value} /></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: 6 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* TEMPLATE LIBRARY */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 22 }}
          >
            <div style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 24, padding: isMobile ? 16 : 22 }}>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#94A3B8' }}>🔍</span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  style={{ width: '100%', padding: '12px 40px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)', fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', border: 'none', background: '#F1F5F9', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, color: '#64748B' }}>×</button>
                )}
              </div>

              {/* Category pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    style={{ padding: '7px 15px', borderRadius: 99, border: 'none', background: category === c.key ? 'linear-gradient(135deg, #6D5DF6, #5B8DEF)' : 'rgba(0,0,0,0.04)', color: category === c.key ? '#fff' : '#64748B', fontSize: 12.5, fontWeight: category === c.key ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>

              {/* Template grid */}
              {filteredTemplates.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No templates match "{search}"</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {filteredTemplates.map((t, i) => {
                    const color = CATEGORY_COLOR[t.category] || primary
                    return (
                      <motion.button
                        key={t.name}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                        onClick={() => useTemplate(t)}
                        whileHover={{ y: -4, boxShadow: `0 16px 32px -12px ${color}50` }}
                        style={{ padding: 16, borderRadius: 18, border: `1px solid ${color}25`, background: `linear-gradient(150deg, ${color}0C, rgba(255,255,255,0.8))`, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${color}, ${color}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, marginBottom: 10, boxShadow: `0 6px 14px -6px ${color}70` }}>{t.icon}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4, marginBottom: 10 }}>{t.desc}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color, background: color + '14', borderRadius: 99, padding: '3px 9px', display: 'inline-block' }}>{t.fields.length} fields</div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading forms...</div>
      ) : forms.length === 0 ? (
        <div style={{ position: 'relative', padding: '56px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(14px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.7)' }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ fontSize: 44, marginBottom: 14 }}>📝</motion.div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Ready to build something amazing?</div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 22 }}>Choose one of our professionally designed templates or create your own.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.button onClick={() => setShowTemplates(true)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
              style={{ padding: '12px 24px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              📋 Browse Templates
            </motion.button>
            <motion.button onClick={() => { setSelectedForm(null); setView('builder') }} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
              style={{ padding: '12px 24px', borderRadius: 14, border: '1.5px solid #6D5DF6', background: '#fff', color: '#6D5DF6', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Create From Scratch
            </motion.button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forms.map(form => {
            const subCount = form.form_submissions?.[0]?.count || 0
            return (
              <motion.div key={form.id} whileHover={{ y: -2 }}
                style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 4px 16px -10px rgba(30,41,59,0.15)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📝</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{form.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{form.description || 'No description'} · {(form.fields || []).length} fields · {subCount} submission{subCount !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => toggleActive(form)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${form.is_active ? '#16A34A40' : '#e5e7eb'}`, background: form.is_active ? '#F0FDF4' : '#F9FAFB', color: form.is_active ? '#16A34A' : '#9CA3AF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {form.is_active ? '✅ Active' : '⏸ Inactive'}
                  </button>
                  <button onClick={() => { setSelectedForm(form); setView('submissions') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    📬 {subCount}
                  </button>
                  <button onClick={() => { setSelectedForm({ ...form, fields: form.fields || [] }); setView('builder') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => deleteForm(form)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    🗑️
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

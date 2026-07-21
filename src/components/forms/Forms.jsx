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

const FORM_ACCENTS = ['#6D5DF6', '#2563EB', '#059669', '#D97706', '#DB2777', '#0EA5E9', '#7C3AED']

// "Type" tag shown on each form row/card — distinct from the audience CATEGORIES
// above (which classify templates), this is the purpose of the form itself.
const TAG_OPTIONS = ['Registration', 'Consent', 'Application', 'Survey', 'Report', 'Request', 'Other']
const TAG_COLOR = {
  Registration: '#2563EB', Consent: '#0EA5E9', Application: '#D97706',
  Survey: '#7C3AED', Report: '#DC2626', Request: '#059669', Other: '#64748B',
}
const STATUS_STYLE = {
  active:   { label: 'Active',   bg: '#F0FDF4', color: '#16A34A', dot: '#16A34A' },
  draft:    { label: 'Draft',    bg: '#FFF7ED', color: '#D97706', dot: '#D97706' },
  archived: { label: 'Archived', bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
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

function FieldPreview({ field }) {
  const base = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#94A3B8' }
  switch (field.type) {
    case 'textarea':
      return <textarea disabled rows={3} placeholder="Long answer text" style={{ ...base, resize: 'none' }} />
    case 'checkbox':
      return <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'default' }}><input type="checkbox" disabled /> {field.label}</label>
    case 'select':
      return (
        <select disabled style={base}>
          <option>Select an option...</option>
          {(field.options || []).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      )
    case 'date':
      return <input disabled type="date" style={base} />
    case 'number':
      return <input disabled type="number" placeholder="0" style={base} />
    case 'email':
      return <input disabled type="email" placeholder="name@example.com" style={base} />
    case 'phone':
      return <input disabled type="tel" placeholder="07123 456789" style={base} />
    default:
      return <input disabled type="text" placeholder="Short answer text" style={base} />
  }
}

function FormBuilder({ org, initial, onSave, onCancel }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(() => {
    const base = initial || { name: '', description: '', fields: [], tag: 'Other', visibility: 'public' }
    return { ...base, tag: base.tag || 'Other', visibility: base.visibility || 'public', fields: (base.fields || []).map((f, i) => ({ ...f, id: f.id || (Date.now() + i) })) }
  })
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState('edit') // 'edit' | 'preview'
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [triedSave, setTriedSave] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const addField = (type) => {
    const newField = { id: Date.now(), type, label: FIELD_TYPES.find(f => f.key === type)?.label || type, required: false, options: type === 'select' ? ['Option 1', 'Option 2'] : undefined }
    setForm(f => ({ ...f, fields: [...f.fields, newField] }))
  }

  const updateField = (id, changes) => setForm(f => ({ ...f, fields: f.fields.map(field => field.id === id ? { ...field, ...changes } : field) }))
  const removeField = (id) => setForm(f => ({ ...f, fields: f.fields.filter(field => field.id !== id) }))
  const duplicateField = (id) => setForm(f => {
    const idx = f.fields.findIndex(x => x.id === id)
    if (idx === -1) return f
    const copy = { ...f.fields[idx], id: Date.now() }
    const fields = [...f.fields]
    fields.splice(idx + 1, 0, copy)
    return { ...f, fields }
  })
  const moveField = (from, to) => {
    if (to < 0 || to >= form.fields.length) return
    setForm(f => {
      const fields = [...f.fields]
      const [moved] = fields.splice(from, 1)
      fields.splice(to, 0, moved)
      return { ...f, fields }
    })
  }
  const handleDrop = (idx) => {
    if (dragIndex !== null && dragIndex !== idx) moveField(dragIndex, idx)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleSave = async () => {
    if (!form.name) { setTriedSave(true); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }
  const glass = { background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.7)' }

  return (
    <div style={{ background: 'radial-gradient(circle at 15% 0%, #6D5DF60C, transparent 40%), radial-gradient(circle at 85% 15%, #30C48D0C, transparent 40%), #F6F8FC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1, fontSize: 19, fontWeight: 900, color: '#0F172A' }}>{initial ? 'Edit Form' : 'Build New Form'}</div>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setMode('edit')} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: mode === 'edit' ? '#fff' : 'transparent', color: mode === 'edit' ? '#0F172A' : '#64748B', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: mode === 'edit' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>✏️ Edit</button>
          <button onClick={() => setMode('preview')} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: mode === 'preview' ? '#fff' : 'transparent', color: mode === 'preview' ? '#0F172A' : '#64748B', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: mode === 'preview' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>👀 Preview</button>
        </div>

        <motion.button onClick={handleSave} disabled={saving} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 10px 24px -8px rgba(109,93,246,0.45)' }}>
          {saving ? 'Saving...' : '💾 Save Form'}
        </motion.button>
      </div>

      {/* Form meta */}
      <div style={{ ...glass, borderRadius: 20, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>FORM NAME *</label>
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (triedSave) setTriedSave(false) }} placeholder="e.g. Trip Consent Form"
              style={{ ...inp, border: triedSave && !form.name ? '1.5px solid #DC2626' : inp.border }} />
            {triedSave && !form.name && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 600 }}>Give your form a name before saving</div>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>DESCRIPTION</label>
            <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this form for?" style={inp} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '200px 200px', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>TYPE</label>
            <select value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} style={inp}>
              {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>VISIBILITY</label>
            <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} style={inp}>
              <option value="public">🌐 Public — anyone with the link</option>
              <option value="private">🔒 Private — shared internally only</option>
            </select>
          </div>
        </div>
      </div>

      {mode === 'preview' ? (
        <div style={{ ...glass, borderRadius: 24, padding: isMobile ? 20 : 32, maxWidth: 560 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>{form.name || 'Untitled Form'}</div>
          {form.description && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>{form.description}</div>}
          {form.fields.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Add some fields to see a preview</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.fields.map(field => (
                <div key={field.id}>
                  {field.type !== 'checkbox' && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                      {field.label}{field.required && <span style={{ color: '#DC2626' }}> *</span>}
                    </div>
                  )}
                  <FieldPreview field={field} />
                </div>
              ))}
              <button disabled style={{ marginTop: 8, padding: '12px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, opacity: 0.6, cursor: 'default' }}>Submit</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Add fields panel */}
          <div style={{ ...glass, borderRadius: 20, padding: 16, position: isMobile ? 'static' : 'sticky', top: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Add a field</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : '1fr', gap: 8 }}>
              {FIELD_TYPES.map(ft => (
                <motion.button key={ft.key} onClick={() => addField(ft.key)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${primary}25`, background: primary + '0A', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 15 }}>{ft.icon}</span> {ft.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Fields canvas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>Form Fields ({form.fields.length})</div>
              {form.fields.length > 0 && <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Drag ⠿ or use the arrows to reorder</div>}
            </div>
            {form.fields.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', ...glass, borderRadius: 20, border: '1.5px dashed rgba(0,0,0,0.1)', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                Add fields from the left to build your form
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AnimatePresence initial={false}>
                  {form.fields.map((field, idx) => (
                    <motion.div key={field.id} layout
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={e => { e.preventDefault(); setDragOverIndex(idx) }}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                      style={{ background: '#fff', border: `1.5px solid ${dragOverIndex === idx ? primary : '#E5E7EB'}`, borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 4 }}>
                          <div style={{ fontSize: 16, cursor: 'grab', opacity: 0.35 }}>⠿</div>
                          <button onClick={() => moveField(idx, idx - 1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#D1D5DB' : '#64748B', fontSize: 12, padding: 0 }}>▲</button>
                          <button onClick={() => moveField(idx, idx + 1)} disabled={idx === form.fields.length - 1} style={{ background: 'none', border: 'none', cursor: idx === form.fields.length - 1 ? 'default' : 'pointer', color: idx === form.fields.length - 1 ? '#D1D5DB' : '#64748B', fontSize: 12, padding: 0 }}>▼</button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} style={{ ...inp, flex: 1, minWidth: 120, fontSize: 13, fontWeight: 700 }} placeholder="Field label" />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', borderRadius: 8, padding: '0 10px', fontSize: 11, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>
                              {FIELD_TYPES.find(f => f.key === field.type)?.icon} {FIELD_TYPES.find(f => f.key === field.type)?.label}
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 6 }}>OPTIONS</div>
                              {(field.options || []).map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                  <input value={opt} onChange={e => {
                                    const options = [...field.options]; options[oi] = e.target.value
                                    updateField(field.id, { options })
                                  }} style={{ ...inp, flex: 1, fontSize: 12.5 }} />
                                  <button onClick={() => updateField(field.id, { options: field.options.filter((_, i) => i !== oi) })}
                                    style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, padding: '0 6px' }}>×</button>
                                </div>
                              ))}
                              <button onClick={() => updateField(field.id, { options: [...(field.options || []), `Option ${(field.options || []).length + 1}`] })}
                                style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px dashed ${primary}40`, background: 'none', color: primary, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>+ Add option</button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
                              <input type="checkbox" checked={field.required || false} onChange={e => updateField(field.id, { required: e.target.checked })} />
                              Required field
                            </label>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <button onClick={() => duplicateField(field.id)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>⧉ Duplicate</button>
                              <button onClick={() => removeField(field.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>🗑 Remove</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SubmissionsView({ form, org, onBack }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    supabase.from('form_submissions').select('*').eq('form_id', form.id).order('created_at', { ascending: false }).then(({ data }) => {
      setSubmissions(data || [])
      setLoading(false)
      // Clear the unread badge/notification for this form's submissions now that they've been opened
      supabase.from('form_submissions').update({ viewed_at: new Date().toISOString() }).eq('form_id', form.id).is('viewed_at', null).then(() => {})
    })
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

function EmailFormModal({ form, primary, onClose }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { sent, failed } | { error }

  const handleSend = async () => {
    const emails = input.split(/[,\n]/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setSending(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-form-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ form_id: form.id, emails }),
      })
      const data = await res.json()
      if (!res.ok) { setResult({ error: data?.error || 'Failed to send' }); setSending(false); return }
      setResult({ sent: data.sent, failed: data.failed || [] })
    } catch (e) {
      setResult({ error: 'Network error — please try again' })
    }
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 70px -20px rgba(15,23,42,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>✉️ Email this form</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{form.name}</div>

        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6, letterSpacing: 0.4 }}>RECIPIENT EMAIL(S)</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="parent1@example.com, parent2@example.com"
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
        />
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, marginBottom: 16 }}>Separate multiple addresses with commas or new lines.</div>

        {result?.error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{result.error}</div>}
        {result && !result.error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}{result.failed?.length ? ` — failed for: ${result.failed.join(', ')}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Close</button>
          <button onClick={handleSend} disabled={sending || !input.trim()}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: sending || !input.trim() ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, fontSize: 13, cursor: sending || !input.trim() ? 'default' : 'pointer' }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AVATAR_COLORS = ['#6D5DF6', '#2563EB', '#059669', '#D97706', '#DB2777', '#0EA5E9', '#7C3AED', '#DC2626']
function avatarColor(seed) {
  const s = String(seed || '')
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash]
}

// Submissions store answers as { [fieldLabel]: value }, not a fixed schema —
// heuristically pick whatever looks like a name so the recent-submissions
// panel has something more useful to show than "Anonymous" every time.
function extractSubmitterName(data) {
  if (!data || typeof data !== 'object') return 'Anonymous'
  const entries = Object.entries(data)
  const nameEntry = entries.find(([label, value]) => /name/i.test(label) && typeof value === 'string' && value.trim())
  return nameEntry ? nameEntry[1].trim() : 'Anonymous'
}

function timeAgo(dateStr) {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return format(d, 'd MMM')
}

function Sparkline({ points, color }) {
  const w = 64, h = 22
  const max = Math.max(1, ...points)
  const step = w / Math.max(1, points.length - 1)
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * (h - 4) - 2).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ImportFormModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleImport = async () => {
    let parsed
    try { parsed = JSON.parse(text) } catch (e) { setError('That doesn\'t look like valid JSON.'); return }
    if (!parsed?.name || !Array.isArray(parsed.fields)) { setError('Needs at least a "name" and a "fields" array.'); return }
    setError(''); setSaving(true)
    await onImport({ name: parsed.name, description: parsed.description || '', tag: parsed.tag, fields: parsed.fields })
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 24px 70px -20px rgba(15,23,42,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>📥 Import a form</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>Paste form JSON — <code style={{ fontSize: 11, background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{'{ name, description, fields: [{ type, label, required }] }'}</code></div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder='{"name": "Trip Consent", "fields": [{"type":"text","label":"Child Name","required":true}]}'
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 12.5, fontFamily: 'monospace', outline: 'none', resize: 'vertical' }} />
        {error && <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleImport} disabled={saving || !text.trim()}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: saving || !text.trim() ? '#9CA3AF' : 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving || !text.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Importing...' : 'Import as draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DuplicatePickerModal({ forms, onClose, onDuplicate }) {
  const [busyId, setBusyId] = useState(null)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 440, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px -20px rgba(15,23,42,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>📋 Duplicate a form</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {forms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 13 }}>No forms to duplicate yet.</div>
          ) : forms.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{(f.fields || []).length} fields</div>
              </div>
              <button onClick={async () => { setBusyId(f.id); await onDuplicate(f); setBusyId(null) }} disabled={busyId === f.id}
                style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: busyId === f.id ? '#9CA3AF' : 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: busyId === f.id ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {busyId === f.id ? 'Copying…' : 'Duplicate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Forms({ org, session, isAdmin }) {
  const isMobile = useIsMobile()
  const authUserId = session?.user?.id
  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'builder' | 'submissions'
  const [selectedForm, setSelectedForm] = useState(null)
  const [tab, setTab] = useState('all') // 'all' | 'active' | 'draft' | 'archived' | 'templates'
  const [search, setSearch] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [listMode, setListMode] = useState('list') // 'list' | 'grid'
  const [period, setPeriod] = useState('month') // 'month' | 'week' | 'all'
  const [copiedId, setCopiedId] = useState(null)
  const [emailModalFor, setEmailModalFor] = useState(null)
  const [rowMenuFor, setRowMenuFor] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicatePicker, setShowDuplicatePicker] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const copyFormLink = async (form) => {
    const link = `${window.location.origin}/forms/${org?.slug}/${form.id}`
    try {
      await navigator.clipboard.writeText(link)
    } catch (e) {
      window.prompt('Copy this link:', link)
    }
    setCopiedId(form.id)
    setTimeout(() => setCopiedId(id => (id === form.id ? null : id)), 2000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: formRows }, { data: subRows }, { data: staffRows }] = await Promise.all([
      supabase.from('org_forms').select('*').eq('org_id', org.id).order('updated_at', { ascending: false }),
      supabase.from('form_submissions').select('id, form_id, data, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(3000),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id),
    ])
    setForms(formRows || [])
    setSubmissions(subRows || [])
    setStaff(staffRows || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const staffName = (id) => staff.find(s => s.id === id)?.full_name || null

  const saveForm = async (formData) => {
    const isEdit = !!selectedForm?.id
    const status = formData.status || 'draft'
    const payload = {
      name: formData.name, description: formData.description, fields: formData.fields,
      tag: formData.tag || 'Other', visibility: formData.visibility || 'public',
      status, is_active: status === 'active',
      updated_at: new Date().toISOString(), updated_by: authUserId || null,
    }
    const { error } = isEdit
      ? await supabase.from('org_forms').update(payload).eq('id', selectedForm.id)
      : await supabase.from('org_forms').insert({ org_id: org.id, ...payload })
    if (error) { window.alert('Could not save this form: ' + error.message); return }
    load()
    setView('list')
    setSelectedForm(null)
  }

  const deleteForm = async (form) => {
    if (!window.confirm(`Delete "${form.name}"? All submissions will be lost.`)) return
    await supabase.from('org_forms').delete().eq('id', form.id)
    setForms(f => f.filter(x => x.id !== form.id))
  }

  const setFormStatus = async (form, status) => {
    const is_active = status === 'active'
    await supabase.from('org_forms').update({ status, is_active, updated_at: new Date().toISOString(), updated_by: authUserId || null }).eq('id', form.id)
    setForms(f => f.map(x => x.id === form.id ? { ...x, status, is_active, updated_at: new Date().toISOString(), updated_by: authUserId } : x))
    setRowMenuFor(null)
  }

  const duplicateForm = async (form) => {
    const { data } = await supabase.from('org_forms').insert({
      org_id: org.id, name: `${form.name} (Copy)`, description: form.description, fields: form.fields,
      tag: form.tag || 'Other', visibility: form.visibility || 'public', status: 'draft', is_active: false,
      updated_by: authUserId || null,
    }).select().single()
    if (data) setForms(f => [data, ...f])
    setShowDuplicatePicker(false)
  }

  const importForm = async (parsed) => {
    const { data } = await supabase.from('org_forms').insert({
      org_id: org.id, name: parsed.name, description: parsed.description,
      fields: parsed.fields.map((f, i) => ({ ...f, id: Date.now() + i })),
      tag: TAG_OPTIONS.includes(parsed.tag) ? parsed.tag : 'Other', visibility: 'public', status: 'draft', is_active: false,
      updated_by: authUserId || null,
    }).select().single()
    if (data) setForms(f => [data, ...f])
    setShowImport(false)
  }

  // ── derived stats ──
  const now = new Date()
  const inRange = (dateStr, start, end) => { const t = new Date(dateStr).getTime(); return t >= start && t < end }
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const weekMs = 7 * 24 * 60 * 60 * 1000

  const responsesThisPeriod = period === 'all'
    ? submissions.length
    : period === 'week'
      ? submissions.filter(s => inRange(s.created_at, now.getTime() - weekMs, now.getTime() + 1)).length
      : submissions.filter(s => inRange(s.created_at, thisMonthStart, now.getTime() + 1)).length
  const responsesPrevPeriod = period === 'week'
    ? submissions.filter(s => inRange(s.created_at, now.getTime() - weekMs * 2, now.getTime() - weekMs)).length
    : period === 'month'
      ? submissions.filter(s => inRange(s.created_at, lastMonthStart, thisMonthStart)).length
      : null
  const periodChangePct = responsesPrevPeriod === null ? null
    : responsesPrevPeriod === 0 ? (responsesThisPeriod > 0 ? 100 : 0)
    : Math.round(((responsesThisPeriod - responsesPrevPeriod) / responsesPrevPeriod) * 100)

  const totalForms = forms.length
  const liveCount = forms.filter(f => f.status === 'active').length
  const draftCount = forms.filter(f => f.status === 'draft').length
  const livePct = totalForms ? Math.round((liveCount / totalForms) * 100) : 0
  const draftPct = totalForms ? Math.round((draftCount / totalForms) * 100) : 0

  const statCards = [
    { key: 'total', label: 'Total Forms', value: totalForms, icon: '📝', color: '#6D5DF6', sub: 'All time' },
    { key: 'live', label: 'Live Forms', value: liveCount, icon: '✅', color: '#16A34A', sub: `${livePct}% of total` },
    { key: 'responses', label: `Responses ${period === 'all' ? '(All Time)' : period === 'week' ? 'This Week' : 'This Month'}`, value: responsesThisPeriod, icon: '📈', color: '#2563EB',
      sub: periodChangePct === null ? 'All-time total' : `${periodChangePct >= 0 ? '↑' : '↓'} ${Math.abs(periodChangePct)}% vs last ${period}`, subColor: periodChangePct === null ? undefined : (periodChangePct >= 0 ? '#16A34A' : '#DC2626') },
    { key: 'drafts', label: 'Drafts', value: draftCount, icon: '📄', color: '#D97706', sub: `${draftPct}% of total` },
  ]

  // per-form submission lookups
  const submissionsByForm = React.useMemo(() => {
    const map = {}
    submissions.forEach(s => { (map[s.form_id] = map[s.form_id] || []).push(s) })
    return map
  }, [submissions])

  const sparklineFor = (formId) => {
    const rows = submissionsByForm[formId] || []
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i)).getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000
      return rows.filter(r => inRange(r.created_at, dayStart, dayEnd)).length
    })
    return days
  }

  const recentSubmissions = React.useMemo(() => submissions.slice(0, 6).map(s => ({
    ...s, formName: forms.find(f => f.id === s.form_id)?.name || 'Unknown form', submitterName: extractSubmitterName(s.data),
  })), [submissions, forms])

  const availableTypes = React.useMemo(() => [...new Set(forms.map(f => f.tag).filter(Boolean))], [forms])

  const tabCounts = {
    all: forms.length,
    active: forms.filter(f => f.status === 'active').length,
    draft: forms.filter(f => f.status === 'draft').length,
    archived: forms.filter(f => f.status === 'archived').length,
    templates: TEMPLATES.length,
  }

  const filteredForms = React.useMemo(() => {
    let list = forms
    if (tab !== 'all' && tab !== 'templates') list = list.filter(f => f.status === tab)
    if (typeFilter !== 'all') list = list.filter(f => f.tag === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q))
    }
    const sorters = {
      updated: (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at),
      name: (a, b) => a.name.localeCompare(b.name),
      submissions: (a, b) => (submissionsByForm[b.id]?.length || 0) - (submissionsByForm[a.id]?.length || 0),
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    }
    return [...list].sort(sorters[sortBy] || sorters.updated)
  }, [forms, tab, typeFilter, search, sortBy, submissionsByForm])

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchCategory = templateCategory === 'all' || t.category === templateCategory
    const matchSearch = !templateSearch.trim() || `${t.name} ${t.desc}`.toLowerCase().includes(templateSearch.trim().toLowerCase())
    return matchCategory && matchSearch
  })

  const applyTemplate = (t) => {
    setSelectedForm({ name: t.name, description: t.desc, tag: 'Registration', fields: t.fields.map((f, i) => ({ ...f, id: Date.now() + i })) })
    setView('builder')
  }

  const sel = { padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12.5, color: '#374151', fontWeight: 600, outline: 'none' }
  const iconBtn = { width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  const openForSubmissions = (form) => { setSelectedForm(form); setView('submissions') }
  const openForEdit = (form) => { setSelectedForm({ ...form, fields: form.fields || [] }); setView('builder') }

  if (view === 'builder') return <FormBuilder org={org} initial={selectedForm} onSave={saveForm} onCancel={() => { setView('list'); setSelectedForm(null) }} />
  if (view === 'submissions' && selectedForm) return <SubmissionsView form={selectedForm} org={org} onBack={() => { setView('list'); setSelectedForm(null); load() }} />

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: '0 8px 20px -8px rgba(109,93,246,0.5)' }}>📝</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>Forms</span>
              <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...sel, fontWeight: 700 }}>
                <option value="month">This month</option>
                <option value="week">This week</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>Build digital forms, applications and consent packs.</div>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTab('templates')} style={{ padding: '11px 18px', borderRadius: 12, border: '1.5px solid #6D5DF6', background: '#fff', color: '#6D5DF6', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>📋 Browse Templates</button>
            <button onClick={() => { setSelectedForm(null); setView('builder') }} style={{ padding: '11px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 10px 24px -8px rgba(109,93,246,0.4)', whiteSpace: 'nowrap' }}>+ Create Form</button>
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}
            style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '18px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5, lineHeight: 1 }}><CountUp value={s.value} /></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.subColor || '#94A3B8', marginTop: 6 }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* SEARCH + FILTERS */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search forms..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' }} />
            </div>
            <select value={tab === 'templates' ? 'all' : tab} onChange={e => setTab(e.target.value)} style={sel}>
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={sel}>
              <option value="all">Type: All</option>
              {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
              <option value="updated">Sort: Last updated</option>
              <option value="name">Sort: Name</option>
              <option value="submissions">Sort: Most submissions</option>
              <option value="newest">Sort: Newest</option>
            </select>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setListMode('list')} style={{ padding: '8px 12px', border: 'none', background: listMode === 'list' ? '#6D5DF6' : '#fff', color: listMode === 'list' ? '#fff' : '#64748B', cursor: 'pointer' }}>☰</button>
              <button onClick={() => setListMode('grid')} style={{ padding: '8px 12px', border: 'none', background: listMode === 'grid' ? '#6D5DF6' : '#fff', color: listMode === 'grid' ? '#fff' : '#64748B', cursor: 'pointer' }}>▦</button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E2E8F0', overflowX: 'auto' }}>
            {[
              { key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'draft', label: 'Drafts' },
              { key: 'archived', label: 'Archived' }, { key: 'templates', label: 'Templates' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '10px 14px', border: 'none', borderBottom: tab === t.key ? '2.5px solid #6D5DF6' : '2.5px solid transparent', background: 'none', color: tab === t.key ? '#6D5DF6' : '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.label} <span style={{ fontSize: 11, fontWeight: 800, color: tab === t.key ? '#6D5DF6' : '#94A3B8', background: tab === t.key ? '#6D5DF618' : '#F1F5F9', borderRadius: 99, padding: '1px 7px' }}>{tabCounts[t.key]}</span>
              </button>
            ))}
          </div>

          {tab === 'templates' ? (
            <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: isMobile ? 16 : 20 }}>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8' }}>🔍</span>
                <input value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Search templates..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 38px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13.5, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setTemplateCategory(c.key)}
                    style={{ padding: '7px 15px', borderRadius: 99, border: 'none', background: templateCategory === c.key ? 'linear-gradient(135deg, #6D5DF6, #5B8DEF)' : '#F1F5F9', color: templateCategory === c.key ? '#fff' : '#64748B', fontSize: 12.5, fontWeight: templateCategory === c.key ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              {filteredTemplates.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No templates match "{templateSearch}"</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                  {filteredTemplates.map(t => {
                    const color = CATEGORY_COLOR[t.category] || primary
                    return (
                      <button key={t.name} onClick={() => applyTemplate(t)}
                        style={{ padding: 16, borderRadius: 16, border: `1px solid ${color}25`, background: `${color}08`, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${color}, ${color}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{t.icon}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4, marginBottom: 10 }}>{t.desc}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color, background: color + '14', borderRadius: 99, padding: '3px 9px', display: 'inline-block' }}>{t.fields.length} fields</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading forms...</div>
          ) : filteredForms.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #EEF1F6' }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>📝</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{forms.length === 0 ? 'No forms yet' : 'No matching forms'}</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{forms.length === 0 ? (isAdmin ? 'Create your first form or start from a template.' : "An admin hasn't built any forms yet.") : 'Try adjusting your search or filters.'}</div>
            </div>
          ) : listMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filteredForms.map((form, i) => {
                const accent = FORM_ACCENTS[i % FORM_ACCENTS.length]
                const subCount = submissionsByForm[form.id]?.length || 0
                return (
                  <div key={form.id} onClick={() => isAdmin ? openForEdit(form) : openForSubmissions(form)}
                    style={{ cursor: 'pointer', background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${TAG_COLOR[form.tag] || accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📝</div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: STATUS_STYLE[form.status]?.bg, color: STATUS_STYLE[form.status]?.color }}>● {STATUS_STYLE[form.status]?.label}</span>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{form.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{form.description || 'No description'}</div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                      <span>📋 {(form.fields || []).length} fields</span>
                      <span>📬 {subCount} submissions</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredForms.map((form, i) => {
                const accent = TAG_COLOR[form.tag] || FORM_ACCENTS[i % FORM_ACCENTS.length]
                const subCount = submissionsByForm[form.id]?.length || 0
                const subThisMonth = (submissionsByForm[form.id] || []).filter(s => inRange(s.created_at, thisMonthStart, now.getTime() + 1)).length
                const st = STATUS_STYLE[form.status] || STATUS_STYLE.draft
                const updaterName = staffName(form.updated_by)
                return (
                  <div key={form.id} style={{ position: 'relative', background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <div onClick={() => isAdmin ? openForEdit(form) : openForSubmissions(form)} style={{ width: 42, height: 42, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, cursor: 'pointer' }}>📝</div>

                    <div onClick={() => isAdmin ? openForEdit(form) : openForSubmissions(form)} style={{ flex: '1 1 220px', minWidth: 180, cursor: 'pointer' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>{form.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.description || 'No description'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: `${accent}15`, color: accent }}>{form.tag || 'Other'}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: '#F1F5F9', color: '#64748B' }}>{form.visibility === 'private' ? '🔒 Private' : '🌐 Public'}</span>
                      </div>
                    </div>

                    <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>● {st.label}</span>

                    {!isMobile && (
                      <>
                        <div style={{ textAlign: 'center', width: 60, flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>{(form.fields || []).length}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>Fields</div>
                        </div>
                        <div style={{ textAlign: 'center', width: 90, flexShrink: 0 }} title={`${subCount} all time`}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>{subThisMonth}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 3 }}>Submissions{isMobile ? '' : ' this mo.'}</div>
                          <Sparkline points={sparklineFor(form.id)} color={accent} />
                        </div>
                        <div style={{ width: 110, flexShrink: 0, fontSize: 11 }}>
                          <div style={{ fontWeight: 700, color: '#334155' }}>{format(new Date(form.updated_at || form.created_at), 'd MMM yyyy')}</div>
                          <div style={{ color: '#94A3B8' }}>Last updated{updaterName ? ` · by ${updaterName.split(' ')[0]}` : ''}</div>
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: isMobile ? 0 : 'auto' }}>
                      {isAdmin ? (
                        <button onClick={() => openForEdit(form)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>✏️ Edit</button>
                      ) : (
                        <button onClick={() => openForSubmissions(form)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>📬 View</button>
                      )}
                      <button onClick={() => window.open(`/forms/${org?.slug}/${form.id}`, '_blank')} title="Preview" style={iconBtn}>👁</button>
                      <button onClick={() => copyFormLink(form)} disabled={!form.is_active} title={form.is_active ? 'Copy public link' : 'Activate to get a link'}
                        style={{ ...iconBtn, color: !form.is_active ? '#D1D5DB' : copiedId === form.id ? '#16A34A' : '#64748B', borderColor: copiedId === form.id ? '#16A34A40' : '#E2E8F0', cursor: form.is_active ? 'pointer' : 'default' }}>
                        {copiedId === form.id ? '✅' : '🔗'}
                      </button>
                      <button onClick={() => setEmailModalFor(form)} disabled={!form.is_active} title={form.is_active ? 'Email this form' : 'Activate to email it'} style={{ ...iconBtn, color: !form.is_active ? '#D1D5DB' : '#64748B', cursor: form.is_active ? 'pointer' : 'default' }}>✉️</button>
                      {isAdmin && (
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setRowMenuFor(id => id === form.id ? null : form.id)} style={iconBtn}>⋯</button>
                          <AnimatePresence>
                            {rowMenuFor === form.id && (
                              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 12px 32px -12px rgba(0,0,0,0.2)', zIndex: 30, minWidth: 170, overflow: 'hidden' }}>
                                {form.status !== 'active' && <button onClick={() => setFormStatus(form, 'active')} style={menuItemStyle}>● Set Active</button>}
                                {form.status !== 'draft' && <button onClick={() => setFormStatus(form, 'draft')} style={menuItemStyle}>📄 Move to Draft</button>}
                                {form.status !== 'archived' && <button onClick={() => setFormStatus(form, 'archived')} style={menuItemStyle}>🗄 Archive</button>}
                                <button onClick={() => { setRowMenuFor(null); deleteForm(form) }} style={{ ...menuItemStyle, color: '#DC2626' }}>🗑️ Delete</button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>Recent submissions</div>
                {recentSubmissions.length > 0 && (
                  <button onClick={() => openForSubmissions(forms.find(f => f.id === recentSubmissions[0].form_id))} style={{ background: 'none', border: 'none', fontSize: 11.5, fontWeight: 800, color: '#6D5DF6', cursor: 'pointer' }}>View all</button>
                )}
              </div>
              {recentSubmissions.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 0' }}>No submissions yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentSubmissions.map(s => (
                    <div key={s.id} onClick={() => { const f = forms.find(x => x.id === s.form_id); if (f) openForSubmissions(f) }} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(s.submitterName), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{s.submitterName.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>{s.submitterName}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.formName}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{timeAgo(s.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isAdmin && (
              <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick actions</div>
                {[
                  ['📋 Create from template', () => setTab('templates')],
                  ['📥 Import form', () => setShowImport(true)],
                  ['🗂 Duplicate existing form', () => setShowDuplicatePicker(true)],
                  ['📚 View all templates', () => setTab('templates')],
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 2px', border: 'none', borderTop: '1px solid #F1F5F9', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <span style={{ flex: 1 }}>{label}</span><span style={{ color: '#CBD5E1' }}>›</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ background: 'linear-gradient(150deg, #6D5DF6, #5B8DEF)', borderRadius: 16, padding: 20, color: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Need inspiration?</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 14 }}>Browse our template gallery to get started quickly.</div>
              <button onClick={() => setTab('templates')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#fff', color: '#6D5DF6', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Browse Templates</button>
            </div>
          </div>
        )}
      </div>

      {emailModalFor && (
        <EmailFormModal form={emailModalFor} primary={primary} onClose={() => setEmailModalFor(null)} />
      )}
      {showImport && (
        <ImportFormModal onClose={() => setShowImport(false)} onImport={importForm} />
      )}
      {showDuplicatePicker && (
        <DuplicatePickerModal forms={forms} onClose={() => setShowDuplicatePicker(false)} onDuplicate={duplicateForm} />
      )}
    </div>
  )
}

const menuItemStyle = { display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }

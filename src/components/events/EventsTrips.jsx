import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import SessionWizard, { EVENT_TYPE_KEYS, EVENT_TYPE_META } from '../sessions/SessionWizard'

const STATUS_META = {
  planning:  { label: 'Planning',  bg: '#FEF3C7', color: '#B45309', dotColor: '#F59E0B' },
  confirmed: { label: 'Confirmed', bg: '#EDE9FE', color: '#6D28D9', dotColor: '#8B5CF6' },
  live:      { label: 'Live Now',  bg: '#DCFCE7', color: '#15803D', dotColor: '#22C55E' },
  completed: { label: 'Completed', bg: '#E0E7FF', color: '#3730A3', dotColor: '#6366F1' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', color: '#B91C1C', dotColor: '#EF4444' },
}

const CARD_COLORS = {
  purple: { bg: 'linear-gradient(135deg,#EDE9FE,#F5F3FF)', icon: '#7C3AED', ring: '#DDD6FE' },
  blue:   { bg: 'linear-gradient(135deg,#DBEAFE,#EFF6FF)', icon: '#2563EB', ring: '#BFDBFE' },
  green:  { bg: 'linear-gradient(135deg,#DCFCE7,#F0FDF4)', icon: '#16A34A', ring: '#BBF7D0' },
  orange: { bg: 'linear-gradient(135deg,#FFEDD5,#FFF7ED)', icon: '#EA580C', ring: '#FED7AA' },
}

function toLocalDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function deriveStatus(s, now) {
  if (s.status === 'cancelled' || s.cancelled_at) return 'cancelled'
  if (s.status === 'completed') return 'completed'
  const startDT = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
  const endDT = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
  const isToday = s.session_date === toLocalDateStr(now)
  if (isToday && startDT && startDT <= now && (!endDT || endDT > now)) return 'live'
  if (s.status === 'ready') return 'confirmed'
  return 'planning'
}

function computeReadiness(s, staffCount, volSlots, attendanceCount) {
  const checks = [
    !!s.lead_staff_id,
    !s.min_staff || staffCount >= s.min_staff,
    volSlots.length === 0 || volSlots.every(v => (v.spaces_filled || 0) >= (v.spaces_required || 0)),
    attendanceCount > 0 || s.allow_walk_ins,
    !!s.location,
  ]
  const passed = checks.filter(Boolean).length
  return Math.round((passed / checks.length) * 100)
}

// ─── SHARED STYLES ──────────────────────────────────────────────
const cardStyle = { background: '#fff', border: '1px solid #F1F5F9', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.planning
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, background: m.bg, color: m.color, fontSize: 12, fontWeight: 800 }}>
      {status === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dotColor, animation: 'lsPulse 1.4s ease-in-out infinite' }} />}
      {m.label}
    </span>
  )
}

function KpiCard({ label, value, sub, icon, colorKey, active, onClick, delay }) {
  const c = CARD_COLORS[colorKey]
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -3, boxShadow: '0 10px 24px -8px rgba(0,0,0,0.12)' }}
      whileTap={{ scale: 0.98 }}
      style={{
        ...cardStyle, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', flex: 1, minWidth: 180,
        border: active ? `2px solid ${c.icon}` : '1px solid #F1F5F9',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>{label}</div>
      <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{sub}</div>
    </motion.button>
  )
}

// ─── CALENDAR ILLUSTRATION (confetti) ───────────────────────────
function HeroIllustration() {
  const confetti = [
    { x: 70, y: 15, c: '#22C55E', s: 8, shape: 'circle' },
    { x: 40, y: 55, c: '#3B82F6', s: 7, shape: 'circle' },
    { x: 260, y: 20, c: '#F472B6', s: 8, shape: 'circle' },
    { x: 250, y: 100, c: '#F59E0B', s: 9, shape: 'star' },
    { x: 15, y: 110, c: '#8B5CF6', s: 7, shape: 'zigzag' },
  ]
  return (
    <div style={{ position: 'relative', width: 280, height: 160, flexShrink: 0 }}>
      {confetti.map((p, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0.4, 1, 0.4], y: [0, -8, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          style={{ position: 'absolute', left: p.x, top: p.y, fontSize: p.s + 6, color: p.c }}
        >
          {p.shape === 'star' ? '★' : p.shape === 'zigzag' ? '〰️' : '●'}
        </motion.div>
      ))}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: 60, top: 20, width: 160, height: 140 }}
      >
        <div style={{ position: 'absolute', top: 0, left: 30, width: 10, height: 24, borderRadius: 5, background: '#7C3AED' }} />
        <div style={{ position: 'absolute', top: 0, right: 30, width: 10, height: 24, borderRadius: 5, background: '#7C3AED' }} />
        <div style={{ position: 'absolute', top: 16, left: 0, width: 160, height: 120, borderRadius: 18, background: 'linear-gradient(160deg,#A78BFA,#7C3AED)', boxShadow: '0 20px 40px -12px rgba(124,58,237,0.45)' }}>
          <div style={{ height: 30, background: 'rgba(255,255,255,0.15)', borderRadius: '18px 18px 0 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: 14 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: 5, background: i === 5 ? '#FBBF24' : 'rgba(255,255,255,0.55)' }} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── DETAIL DRAWER ──────────────────────────────────────────────
function EventDrawer({ event, org, session, onClose, onNavigate, onChanged }) {
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState(event)
  const [saving, setSaving] = useState(false)
  const primary = org?.primary_color || '#7C3AED'
  const typeMeta = EVENT_TYPE_META[event.session_type] || { label: event.session_type, icon: '🎟️' }

  const save = async () => {
    setSaving(true)
    const { title, description, location, meeting_point, session_date, start_time, end_time, max_capacity, transport_provider, accommodation, internal_notes } = form
    const { error } = await supabase.from('sessions').update({ title, description, location, meeting_point, session_date, start_time, end_time, max_capacity, transport_provider, accommodation, internal_notes }).eq('id', event.id)
    setSaving(false)
    if (!error) onChanged({ ...event, ...form })
  }

  const cancelEvent = async () => {
    const reason = window.prompt('Reason for cancelling this event? (visible in audit history)')
    if (reason === null) return
    const { error } = await supabase.from('sessions').update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString() }).eq('id', event.id)
    if (!error) { onChanged({ ...event, status: 'cancelled', cancellation_reason: reason }); onClose() }
  }

  const duplicateEvent = async () => {
    const { error } = await supabase.rpc('create_session_with_dependencies', {
      p_title: `${event.title} (copy)`, p_session_date: event.session_date, p_end_date: event.end_date,
      p_start_time: event.start_time, p_end_time: event.end_time, p_location: event.location,
      p_session_type: event.session_type, p_description: event.description, p_max_capacity: event.max_capacity,
      p_status: 'draft', p_bubbles: event.bubbles, p_child_ids: null, p_allow_walk_ins: event.allow_walk_ins,
      p_packed_lunch: event.packed_lunch, p_meeting_point: event.meeting_point, p_consent_required: event.consent_required,
      p_rotation_slots: null, p_age_range: event.age_range, p_internal_notes: null, p_colour: event.colour,
      p_lead_staff_id: event.lead_staff_id, p_supporting_staff_ids: null, p_min_staff: event.min_staff, p_staff_ratio: event.staff_ratio,
      p_volunteer_slots: null, p_risk_assessment_required: event.risk_assessment_required, p_medical_check_required: event.medical_check_required,
      p_collection_permissions_required: event.collection_permissions_required, p_sign_out_required: event.sign_out_required,
      p_safeguarding_lead_required: event.safeguarding_lead_required, p_transport_required: event.transport_required,
      p_equipment_required: event.equipment_required, p_medication_support_required: event.medication_support_required,
      p_venue_confirmation_required: event.venue_confirmation_required, p_emergency_contact_sheet_required: event.emergency_contact_sheet_required,
      p_reflection_required: event.reflection_required, p_form_ids: null, p_outcome_areas: null, p_pending_risk_assessment_id: null,
    })
    if (!error) { onClose(); onChanged(null, true) }
  }

  const messageTeam = async () => {
    let { data: thread } = await supabase.from('message_threads').select('id').eq('session_id', event.id).eq('audience', 'event_staff').maybeSingle()
    if (!thread) {
      const { data: created } = await supabase.from('message_threads').insert({
        org_id: org.id, subject: `${event.title} — Staff`, audience: 'event_staff',
        created_by: session?.user?.id || null, session_id: event.id,
      }).select('id').single()
      thread = created
    }
    onNavigate && onNavigate('messaging', { initialThreadId: thread?.id })
  }

  const TABS = [
    { key: 'overview', label: 'Overview', icon: '📋' },
    { key: 'people', label: 'People', icon: '👥' },
    { key: 'safety', label: 'Safety', icon: '🛡️' },
    { key: 'notes', label: 'Notes', icon: '📝' },
  ]

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 199, backdropFilter: 'blur(2px)' }} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 96vw)', background: '#fff', zIndex: 200, boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{typeMeta.icon}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>{event.title}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{typeMeta.label}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: '#F1F5F9', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 15, color: '#64748B' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate && onNavigate('registers')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Open Register</button>
            <button onClick={messageTeam} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Message Team</button>
            {event.risk_assessment_required && (
              <button onClick={() => onNavigate && onNavigate('risk_assessments')} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Risk Assessment</button>
            )}
            <button onClick={duplicateEvent} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Duplicate</button>
            {event.status !== 'cancelled' && (
              <button onClick={cancelEvent} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancel Event</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9', padding: '0 24px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: tab === t.key ? primary : '#94A3B8', borderBottom: tab === t.key ? `2px solid ${primary}` : '2px solid transparent' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Title"><input style={inpStyle} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                <Field label="Date"><input type="date" style={inpStyle} value={form.session_date || ''} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} /></Field>
                <Field label="Location"><input style={inpStyle} value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                <Field label="Start"><input type="time" style={inpStyle} value={form.start_time || ''} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></Field>
                <Field label="End"><input type="time" style={inpStyle} value={form.end_time || ''} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></Field>
              </div>
              <Field label="Description"><textarea style={{ ...inpStyle, minHeight: 70 }} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
              {event.transport_required && <Field label="Transport provider"><input style={inpStyle} value={form.transport_provider || ''} onChange={e => setForm(f => ({ ...f, transport_provider: e.target.value }))} placeholder="e.g. Acme Coaches" /></Field>}
              {event.session_type === 'residential' && <Field label="Accommodation"><input style={inpStyle} value={form.accommodation || ''} onChange={e => setForm(f => ({ ...f, accommodation: e.target.value }))} placeholder="e.g. Lakeside Lodge" /></Field>}
              <button onClick={save} disabled={saving} style={{ marginTop: 4, padding: '11px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          )}
          {tab === 'people' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#334155' }}>
              <InfoRow label="Lead staff" value={event._leadName || (event.lead_staff_id ? 'Assigned' : 'Not assigned')} />
              <InfoRow label="Staff assigned" value={`${event._staffCount || 0}${event.min_staff ? ` / ${event.min_staff} required` : ''}`} />
              <InfoRow label="Participants expected" value={`${event._attendanceCount || 0}${event.max_capacity ? ` / ${event.max_capacity} capacity` : ''}`} />
              <InfoRow label="Volunteers" value={event._volSummary || 'No volunteer roles set'} />
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>Manage staff, volunteers and participants from Sessions, Volunteers and Registers.</div>
            </div>
          )}
          {tab === 'safety' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['risk_assessment_required', 'Risk assessment required'],
                ['consent_required', 'Consent required'],
                ['medical_check_required', 'Medical check required'],
                ['collection_permissions_required', 'Collection permissions required'],
                ['sign_out_required', 'Sign-out required'],
                ['safeguarding_lead_required', 'Safeguarding lead required'],
                ['transport_required', 'Transport required'],
                ['emergency_contact_sheet_required', 'Emergency contact sheet required'],
              ].filter(([k]) => event[k]).map(([k, label]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F8FAFC', fontSize: 13.5, color: '#334155' }}>
                  <span style={{ color: '#22C55E' }}>✓</span> {label}
                </div>
              ))}
            </div>
          )}
          {tab === 'notes' && (
            <Field label="Internal notes (staff only)">
              <textarea style={{ ...inpStyle, minHeight: 140 }} value={form.internal_notes || ''} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} />
            </Field>
          )}
        </div>
      </motion.div>
    </>
  )
}

const inpStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13.5, boxSizing: 'border-box', outline: 'none' }
function Field({ label, children }) { return <div><div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>{children}</div> }
function InfoRow({ label, value }) { return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F8FAFC' }}><span style={{ color: '#94A3B8' }}>{label}</span><span style={{ fontWeight: 700 }}>{value}</span></div> }

// ─── MAIN PAGE ──────────────────────────────────────────────────
export default function EventsTrips({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const orgId = org?.id
  const primary = org?.primary_color || '#7C3AED'
  const [sessions, setSessions] = useState([])
  const [attendance, setAttendance] = useState([])
  const [staffRows, setStaffRows] = useState([])
  const [volSlots, setVolSlots] = useState([])
  const [tasks, setTasks] = useState([])
  const [staffDirectory, setStaffDirectory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [drawerEvent, setDrawerEvent] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 5

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [{ data: sess }, { data: att }, { data: st }, { data: vs }, { data: tk }, { data: staff }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', orgId).in('session_type', EVENT_TYPE_KEYS).order('session_date', { ascending: true }),
      supabase.from('attendance').select('session_id, status').eq('org_id', orgId),
      supabase.from('session_staff').select('session_id, user_id').eq('org_id', orgId),
      supabase.from('session_volunteer_slots').select('*').eq('org_id', orgId),
      supabase.from('session_tasks').select('*').eq('org_id', orgId).eq('status', 'pending'),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', orgId),
    ])
    setSessions(sess || [])
    setAttendance(att || [])
    setStaffRows(st || [])
    setVolSlots(vs || [])
    setTasks(tk || [])
    setStaffDirectory(staff || [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const today = toLocalDateStr(now)

  const enriched = useMemo(() => sessions.map(s => {
    const attCount = attendance.filter(a => a.session_id === s.id).length
    const staffCount = staffRows.filter(r => r.session_id === s.id).length
    const slots = volSlots.filter(v => v.session_id === s.id)
    const volFilled = slots.reduce((sum, v) => sum + (v.spaces_filled || 0), 0)
    const volRequired = slots.reduce((sum, v) => sum + (v.spaces_required || 0), 0)
    const status = deriveStatus(s, now)
    const readiness = computeReadiness(s, staffCount, slots, attCount)
    const lead = staffDirectory.find(u => u.id === s.lead_staff_id)
    return {
      ...s, _status: status, _attendanceCount: attCount, _staffCount: staffCount,
      _volFilled: volFilled, _volRequired: volRequired, _readiness: readiness,
      _leadName: lead?.full_name, _volSummary: volRequired > 0 ? `${volFilled} / ${volRequired} filled` : 'No volunteer roles set',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sessions, attendance, staffRows, volSlots, staffDirectory])

  const counts = {
    all: enriched.length,
    planning: enriched.filter(e => e._status === 'planning').length,
    confirmed: enriched.filter(e => e._status === 'confirmed').length,
    live: enriched.filter(e => e._status === 'live').length,
    completed: enriched.filter(e => e._status === 'completed').length,
    cancelled: enriched.filter(e => e._status === 'cancelled').length,
  }

  const upcomingCount = enriched.filter(e => e.session_date >= today && ['planning', 'confirmed'].includes(e._status)).length
  const totalParticipants = enriched.reduce((s, e) => s + e._attendanceCount, 0)
  const upcomingThisMonth = enriched.filter(e => e.session_date >= today && new Date(e.session_date).getMonth() === now.getMonth()).length

  const filtered = enriched.filter(e => {
    const matchStatus = filterStatus === 'all' || e._status === filterStatus
    const matchSearch = !search.trim() || e.title?.toLowerCase().includes(search.toLowerCase()) || e.location?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const todaysLive = enriched.filter(e => e._status === 'live')
  const todaysUpcoming = enriched.filter(e => e.session_date === today && e._status !== 'live' && e._status !== 'cancelled')
  const tasksDueToday = tasks.length

  const monthName = now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()

  const primaryAction = (e) => {
    if (e._status === 'live') return { label: 'Open Register', action: () => onNavigate && onNavigate('registers') }
    if (e._status === 'planning') return { label: 'Continue Planning', action: () => setDrawerEvent(e) }
    return { label: 'View Event', action: () => setDrawerEvent(e) }
  }

  if (showWizard) {
    return (
      <SessionWizard
        org={org} session={session} bubbleDefs={[]}
        initialType="trip"
        onCancel={() => setShowWizard(false)}
        onNavigate={onNavigate}
        onPublished={async () => { await load() }}
      />
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <style>{`@keyframes lsPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.4; transform: scale(1.4);} }`}</style>

      {/* HERO */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ ...cardStyle, background: 'linear-gradient(135deg,#FAF5FF,#EFF6FF)', padding: isMobile ? 20 : '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: isMobile ? 22 : 27, fontWeight: 900, color: '#1E1B4B', marginBottom: 6 }}>Plan amazing adventures! 🚀</div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 18, lineHeight: 1.5 }}>Create events and trips that inspire, engage and make a difference.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowWizard(true)}
              style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 8px 20px -6px rgba(124,58,237,0.5)' }}>
              + New Event / Trip 🎉
            </motion.button>
            <button onClick={() => alert('Calendar import is coming soon!')} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              📅 Import from Calendar
            </button>
          </div>
        </div>
        {!isMobile && <HeroIllustration />}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 20 }}>
        <div>
          {/* KPI CARDS */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
            <KpiCard label="Total Events" sub={`↑ ${upcomingThisMonth} this month`} value={counts.all} icon="🎫" colorKey="purple" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} delay={0.05} />
            <KpiCard label="Upcoming" sub="Next 30 days" value={upcomingCount} icon="👥" colorKey="blue" active={false} onClick={() => setFilterStatus('planning')} delay={0.1} />
            <KpiCard label="Live Now" sub="Happening today" value={counts.live} icon="⚡" colorKey="green" active={filterStatus === 'live'} onClick={() => setFilterStatus('live')} delay={0.15} />
            <KpiCard label="Participants" sub="Across all events" value={totalParticipants} icon="👤" colorKey="orange" active={false} onClick={() => {}} delay={0.2} />
          </div>

          {/* FILTER TABS + SEARCH */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            {['all', 'planning', 'confirmed', 'live', 'completed', 'cancelled'].map(k => (
              <button key={k} onClick={() => { setFilterStatus(k); setPage(1) }} style={{
                padding: '8px 14px', borderRadius: 10, border: filterStatus === k ? 'none' : '1.5px solid #E2E8F0',
                background: filterStatus === k ? primary : '#fff', color: filterStatus === k ? '#fff' : '#475569',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              }}>
                {k === 'all' ? 'All' : STATUS_META[k]?.label.replace(' Now', '') || k} ({counts[k]})
              </button>
            ))}
            <div style={{ flex: 1, minWidth: 160, display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="🔍 Search events..." style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 12.5, outline: 'none' }} />
            </div>
          </div>

          {/* EVENT LIST */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ ...cardStyle, height: 76, background: 'linear-gradient(90deg,#F8FAFC,#F1F5F9,#F8FAFC)', backgroundSize: '200% 100%', animation: 'lsShimmer 1.4s infinite' }} />)}
              <style>{`@keyframes lsShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            </div>
          ) : pageItems.length === 0 ? (
            <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🎈</div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#334155' }}>No events found</div>
              <div style={{ fontSize: 13 }}>Try adjusting your filters, or create your first event.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pageItems.map((e, i) => {
                const typeMeta = EVENT_TYPE_META[e.session_type] || { label: e.session_type, icon: '🎟️' }
                const act = primaryAction(e)
                const dateObj = e.session_date ? new Date(e.session_date) : null
                return (
                  <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}
                    whileHover={{ boxShadow: '0 8px 22px -8px rgba(0,0,0,0.1)' }}
                    style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap', cursor: 'pointer' }}
                    onClick={() => setDrawerEvent(e)}
                  >
                    <div style={{ textAlign: 'center', width: 46, flexShrink: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94A3B8' }}>{dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : monthName}</div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A' }}>{dateObj ? dateObj.getDate() : '–'}</div>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{typeMeta.icon}</div>
                    <div style={{ minWidth: 160, flex: '1 1 200px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{dateObj?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} • {e.start_time?.slice(0, 5)}–{e.end_time?.slice(0, 5)}</div>
                      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>📍 {e.location || 'No location set'}</div>
                    </div>
                    <div onClick={ev => ev.stopPropagation()}><StatusChip status={e._status} /></div>
                    <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', minWidth: 70 }}>
                      <div>👤 {e._attendanceCount}{e.max_capacity ? ` / ${e.max_capacity}` : ''}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Participants</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', minWidth: 60 }}>
                      <div>🧑‍🏫 {e._staffCount}{e.min_staff ? ` / ${e.min_staff}` : ''}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Staff</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', minWidth: 70 }}>
                      <div>🙋 {e._volFilled} / {e._volRequired}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Volunteers</div>
                    </div>
                    {!isMobile && (
                      <div style={{ width: 90 }}>
                        <div style={{ height: 6, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${e._readiness}%`, background: e._readiness === 100 ? '#22C55E' : e._readiness >= 50 ? primary : '#F59E0B', borderRadius: 99 }} />
                        </div>
                      </div>
                    )}
                    <button onClick={ev => { ev.stopPropagation(); act.action() }} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${primary}`, background: '#fff', color: primary, fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{act.label}</button>
                    <button onClick={ev => { ev.stopPropagation(); setDrawerEvent(e) }} style={{ border: 'none', background: '#F8FAFC', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 14, color: '#94A3B8' }}>⋯</button>
                  </motion.div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} events</span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>←</button>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>→</button>
            </div>
          )}

          {/* FEATURE STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: 12, marginTop: 28 }}>
            {[
              ['🔗', 'Seamless integration', 'Events connect with Registers, Volunteers, Messaging, Reports and more.'],
              ['🔄', 'Auto-population', 'Populate registers, tasks and requirements automatically.'],
              ['📸', 'Real-time updates', 'Changes sync across all modules instantly.'],
              ['📊', 'Impact tracking', 'Measure outcomes and track your impact.'],
            ].map(([icon, title, sub], i) => (
              <div key={i} style={{ ...cardStyle, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 20 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>🧭 Today at a glance</div>
              <button onClick={() => onNavigate && onNavigate('calendar')} style={{ border: 'none', background: 'none', color: primary, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>View Calendar</button>
            </div>
            {[
              { icon: '⚡', bg: '#DCFCE7', title: 'Event live now', sub: todaysLive.map(e => e.title).join(', ') || 'None right now' },
              { icon: '👥', bg: '#DBEAFE', title: 'Upcoming today', sub: todaysUpcoming.map(e => e.title).join(', ') || 'Nothing else today' },
              { icon: '📋', bg: '#FEF3C7', title: 'Tasks due today', sub: `${tasksDueToday} task${tasksDueToday === 1 ? '' : 's'} need attention` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: i < 2 ? '1px solid #F8FAFC' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: row.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{row.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{row.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>⚡ Quick Actions</div>
            {[
              { icon: '🚀', bg: '#F5F3FF', title: 'Create New Event / Trip', sub: 'Start planning something amazing', onClick: () => setShowWizard(true) },
              { icon: '📄', bg: '#EFF6FF', title: 'Copy from Template', sub: 'Coming soon', onClick: () => alert('Templates are coming soon!') },
              { icon: '🗂️', bg: '#FFF7ED', title: 'Event Templates', sub: 'Coming soon', onClick: () => alert('Templates are coming soon!') },
              { icon: '📅', bg: '#FDF2F8', title: 'Import from Calendar', sub: 'Coming soon', onClick: () => alert('Calendar import is coming soon!') },
            ].map((row, i) => (
              <button key={i} onClick={row.onClick} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: row.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{row.icon}</div>
                <div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{row.title}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{row.sub}</div></div>
              </button>
            ))}
          </div>

          <div style={{ ...cardStyle, padding: 18, background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#78350F', marginBottom: 12 }}>🌟 Need help?</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#78350F', marginBottom: 2 }}>Events & Trips Help Centre</div>
            <div style={{ fontSize: 11, color: '#92400E', marginBottom: 10 }}>Step-by-step guides and tips</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#78350F', marginBottom: 2 }}>Contact Support</div>
            <div style={{ fontSize: 11, color: '#92400E' }}>We're here to help</div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawerEvent && (
          <EventDrawer
            event={drawerEvent} org={org} session={session} onNavigate={onNavigate}
            onClose={() => setDrawerEvent(null)}
            onChanged={(updated, shouldReload) => {
              if (shouldReload) { load(); return }
              if (updated) setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

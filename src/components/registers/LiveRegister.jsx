import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import EndSessionFlow from './EndSessionFlow'
import OverlayPortal from '../shared/OverlayPortal'
import PastSessionRegister from './PastSessionRegister'
import RegisterPaymentBadge from '../payments/RegisterPaymentBadge'
import AttendanceCorrectionModal from './AttendanceCorrectionModal'
import { useTerms } from '../../context/OrgContext'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'
import { useIsMobile } from '../../hooks/useIsMobile'

const COLLECTION_TYPES = [
  { key: 'approved_adult', label: 'Approved adult' },
  { key: 'parent_guardian', label: 'Parent or guardian' },
  { key: 'independent', label: 'Leaving independently' },
  { key: 'staff_transport', label: 'Staff transport' },
  { key: 'other', label: 'Other' },
]

const ABSENCE_REASONS = ['Absent', 'Cancelled', 'Ill', 'Parent notified', 'No reason provided']

const NOTE_TYPES = [
  { key: 'general', label: 'General note', icon: '📝' },
  { key: 'late_arrival', label: 'Late arrival', icon: '⏰' },
  { key: 'early_collection', label: 'Early collection', icon: '🚪' },
  { key: 'behaviour', label: 'Behaviour note', icon: '⚠️' },
  { key: 'injury', label: 'Injury / first aid', icon: '🩹' },
  { key: 'incident', label: 'Accident or incident', icon: '🚨' },
]

function getRequiredRatio(session, org) {
  if (session?.staff_ratio) {
    const m = session.staff_ratio.match(/(\d+)\s*:\s*(\d+)/)
    if (m) return Number(m[2]) / Number(m[1])
  }
  return org?.default_staff_ratio || 8
}

function computeRegisterState(session, attendanceRows) {
  if (session.closed_at) return 'closed'
  const started = !!session.opened_at || attendanceRows.some(a => a.status === 'signed_in')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(part => [part.type, part.value]))
  const now = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  const end = session.end_time ? `${session.end_date || session.session_date}T${session.end_time.slice(0, 5)}` : null
  if (started) return end && now >= end ? 'ending' : 'live'
  const start = session.start_time ? `${session.session_date}T${session.start_time.slice(0, 5)}` : null
  return session.register_opened_at || (start && now >= start) ? 'register_open' : 'upcoming'
}

const STATE_LABEL = { upcoming: 'Upcoming', register_open: 'Register open', live: 'Live', ending: 'Ending', closed: 'Closed' }
const STATE_COLOR = { upcoming: '#6B7280', register_open: '#2563EB', live: '#16A34A', ending: '#D97706', closed: '#6B7280' }

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' })
}

export default function LiveRegister({ session: initialSession, org, authUserId, userRole, onClose, onNavigate, backLabel = 'Back to registers' }) {
  const [session, setSession] = useState(initialSession)
  const [loadError, setLoadError] = useState('')
  const [starting, setStarting] = useState(false)
  const loadingRef = useRef(false)
  const pendingAttendance = useRef(new Set())
  const isMobile = useIsMobile()
  const { groups: orgGroups } = useOrgSettings(org?.id)
  const terms = useTerms()
  const configuredGroupLabels = useMemo(() => new Map((orgGroups || []).map(g => [(g.label || '').trim().toLowerCase(), g.label])), [orgGroups])
  const groupLabel = (name) => configuredGroupLabels.get((name || '').trim().toLowerCase()) || 'Ungrouped'
  // Same rule everywhere a register can be closed from: only staff/admin/owner.
  // Volunteers can still sign children in/out here — closing itself is the
  // one action that stays staff-only.
  const canCloseRegister = ['admin', 'owner', 'staff'].includes(userRole)
  const [children, setChildren] = useState([])
  const [attendance, setAttendance] = useState([])
  const [staffRows, setStaffRows] = useState([])
  const [staffProfiles, setStaffProfiles] = useState({})
  const [notes, setNotes] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [safeguardingCount, setSafeguardingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expected')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [signOutChild, setSignOutChild] = useState(null)
  const [absentChild, setAbsentChild] = useState(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [showClosure, setShowClosure] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedChild, setSelectedChild] = useState(null)
  const [paymentBalances, setPaymentBalances] = useState({}) // childId -> { outstanding, hasAny }
  // Correcting a mis-tap. null = closed; '' = open with no child chosen;
  // a child id = open, focused on that child from their row.
  const [correctChildId, setCorrectChildId] = useState(null)

  const loadPaymentBalances = useCallback(async () => {
    if (!org?.id) return
    const { data, error } = await supabase.from('payment_charge_balances')
      .select('child_id, remaining, computed_status').eq('org_id', org.id)
    if (error) return // table/view may not exist for orgs that haven't touched Payments yet -- fail silently, badge just won't show
    const map = {}
    for (const row of data || []) {
      const entry = map[row.child_id] || { outstanding: 0, hasAny: false }
      entry.hasAny = true
      if (row.computed_status !== 'waived') entry.outstanding += Number(row.remaining) || 0
      map[row.child_id] = entry
    }
    setPaymentBalances(map)
  }, [org?.id])

  useEffect(() => { loadPaymentBalances() }, [loadPaymentBalances])

  const load = useCallback(async () => {
    if (!session?.id || !org?.id || loadingRef.current) return
    loadingRef.current = true
    try {
    const results = await Promise.all([
      supabase.from('children').select('*').eq('org_id', org.id).order('first_name'),
      supabase.from('attendance').select('*').eq('org_id', org.id).eq('session_id', session.id),
      supabase.from('session_staff').select('*').eq('org_id', org.id).eq('session_id', session.id),
      supabase.from('session_notes').select('*').eq('org_id', org.id).eq('session_id', session.id).order('created_at', { ascending: false }),
      supabase.from('attendance_audit_log').select('*').eq('org_id', org.id).eq('session_id', session.id),
      supabase.from('cause_for_concern').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('session_id', session.id),
    supabase.from('sessions').select('*').eq('org_id', org.id).eq('id', session.id).single(),
    ])
    const failed = [results[0], results[1], results[2], results[6]].find(result => result.error)
    if (failed) throw failed.error
    const [{ data: childData }, { data: attData }, { data: ssData }, { data: noteData }, { data: auditData }, { count: sgCount }, { data: freshSession }] = results
    setSession(freshSession)
    setLoadError('')
    setChildren(childData || [])
    setAttendance(attData || [])
    setStaffRows(ssData || [])
    setNotes(noteData || [])
    setAuditLog(auditData || [])
    setSafeguardingCount(sgCount || 0)

    const staffIds = new Set((ssData || []).map(s => s.user_id || s.volunteer_id).filter(Boolean))
    ;(attData || []).forEach(a => { if (a.signed_in_by) staffIds.add(a.signed_in_by); if (a.signed_out_by) staffIds.add(a.signed_out_by) })
    ;(auditData || []).forEach(a => { if (a.changed_by) staffIds.add(a.changed_by) })
    if (session.closed_by) staffIds.add(session.closed_by)
    if (session.reopened_by) staffIds.add(session.reopened_by)
    if (staffIds.size) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id).in('id', [...staffIds])
      const map = {}
      ;(profiles || []).forEach(p => { map[p.id] = p.full_name })
      setStaffProfiles(map)
    }
    } catch (error) { setLoadError('Could not refresh the register. Check your connection and retry.') }
    finally { loadingRef.current = false; setLoading(false) }
  }, [session?.id, session?.closed_by, session?.reopened_by, org?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const refresh = () => { if (!document.hidden && !showClosure) load() }
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [load, showClosure])

  const attendanceByChild = useMemo(() => {
    const map = {}
    attendance.forEach(a => { map[a.child_id] = a })
    return map
  }, [attendance])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const rows = useMemo(() => {
    const attendedIds = new Set(attendance.map(a => a.child_id))
    return children.filter(c => attendedIds.has(c.id)).map(c => ({ child: c, att: attendanceByChild[c.id] || null }))
  }, [children, attendance, attendanceByChild])

  const grouped = useMemo(() => {
    const g = { expected: [], signed_in: [], absent: [], signed_out: [] }
    rows.forEach(r => {
      const status = r.att?.status
      if (status === 'signed_in') g.signed_in.push(r)
      else if (status === 'absent') g.absent.push(r)
      else if (status === 'signed_out') g.signed_out.push(r)
      else g.expected.push(r)
    })
    return g
  }, [rows])

  const searchFiltered = (list) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q) || (r.child.parent_name || '').toLowerCase().includes(q))
  }

  const signedInCount = grouped.signed_in.length
  const registerState = computeRegisterState(session, attendance)
  const requiredRatio = getRequiredRatio(session, org)
  const signedInStaffCount = staffRows.filter(s => s.signed_in_at && !s.signed_out_at).length
  const currentRatio = signedInStaffCount > 0 ? signedInCount / signedInStaffCount : null
  const ratioBreached = signedInCount > 0 && (!signedInStaffCount || currentRatio > requiredRatio)
  const processedCount = grouped.signed_in.length + grouped.absent.length + grouped.signed_out.length
  const totalExpected = rows.length

  async function upsertAttendance(childId, patch) {
    if (pendingAttendance.current.has(childId) || loadError || session.closed_at) return false
    pendingAttendance.current.add(childId)
    try {
      const existing = attendanceByChild[childId]
      const query = existing
        ? supabase.from('attendance').update(patch).eq('org_id', org.id).eq('session_id', session.id).eq('id', existing.id)
        : supabase.from('attendance').insert({ org_id: org.id, session_id: session.id, child_id: childId, ...patch })
      const { data, error } = await query.select('*').single()
      if (error || !data) throw error || new Error('Not saved')
      setAttendance(prev => [...prev.filter(row => row.child_id !== childId), data])
      return true
    } catch (error) {
      showToast('Could not save — please try again.')
      return false
    } finally { pendingAttendance.current.delete(childId) }
  }

  const handleSignIn = async (child) => {
    const now = new Date().toISOString()
    const ok = await upsertAttendance(child.id, { status: 'signed_in', signed_in_at: now, signed_in_by: authUserId })
    if (ok) { showToast(`${child.first_name} signed in at ${fmtTime(now)}`); load() }
  }

  const handleQuickSignOut = async (child) => {
    const now = new Date().toISOString()
    const ok = await upsertAttendance(child.id, { status: 'signed_out', signed_out_at: now, signed_out_by: authUserId })
    if (ok) { showToast(`${child.first_name} signed out at ${fmtTime(now)}`); load() }
  }

  const handleConfirmSignOut = async (form) => {
    const now = new Date().toISOString()
    const ok = await upsertAttendance(signOutChild.id, {
      status: 'signed_out', signed_out_at: now, signed_out_by: authUserId,
      collection_type: form.collection_type, collected_by_name: form.collected_by_name || null,
      collection_note: form.collection_note || null, identity_checked: form.identity_checked,
    })
    if (ok) { showToast(`${signOutChild.first_name} signed out at ${fmtTime(now)}`); setSignOutChild(null); load() }
  }

  const handleMarkAbsent = async (reason) => {
    const ok = await upsertAttendance(absentChild.id, { status: 'absent', absence_reason: reason })
    if (ok) { setAbsentChild(null); load() }
  }

  const handleStaffSignIn = async (staffRow) => {
    await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString(), signed_out_at: null }).eq('id', staffRow.id)
    load()
  }

  const handleStaffSignOut = async (staffRow) => {
    await supabase.from('session_staff').update({ signed_out_at: new Date().toISOString() }).eq('id', staffRow.id)
    load()
  }

  const handleAddNote = async (noteType, content, childId) => {
    if (!content.trim()) return
    await supabase.from('session_notes').insert({ org_id: org.id, session_id: session.id, child_id: childId || null, note_type: noteType, content: content.trim(), created_by: authUserId })
    load()
  }

  const handleRaiseSafeguardingConcern = async (child, summary) => {
    const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', authUserId).maybeSingle()
    const childName = child ? `${child.first_name} ${child.last_name}`.trim() : null
    await supabase.from('cause_for_concern').insert({
      org_id: org.id, submitted_by: authUserId, submitter_name: profile?.full_name || 'Team member',
      child_name: childName, concern_type: 'other', description: summary,
      date_of_incident: new Date().toISOString().slice(0, 10),
      location: session?.location || 'Not specified',
      session_id: session?.id || null,
      status: 'open', priority: 'medium',
    })
    showToast('Safeguarding concern raised — complete details in Safeguarding.')
    if (onNavigate) onNavigate('safeguarding')
  }

  const startSession = async () => {
    if (starting || loadError) return
    setStarting(true)
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('sessions')
        .update({ opened_at: now, opened_by: authUserId, register_opened_at: session.register_opened_at || now })
        .eq('org_id', org.id).eq('id', session.id).is('closed_at', null).is('opened_at', null).select('*').single()
      if (error || !data) { showToast('Could not start. Refresh the register and try again.'); return }
      setSession(data)
      showToast(`${terms.Session} started`)
    } catch (error) { showToast('Could not start. Check your connection and retry.') }
    finally { setStarting(false) }
  }

  const activeList = searchFiltered(tab === 'all' ? rows : grouped[tab] || []).filter(row => groupFilter === 'all' || groupLabel(row.child.group_name) === groupFilter)
  const registerGroups = [...new Set(rows.map(row => groupLabel(row.child.group_name)))].sort()

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Loading register...</div>
  }

  if (registerState === 'closed') {
    return (
      <>
        <PastSessionRegister
          session={session} org={org} grouped={grouped} rows={rows} staffRows={staffRows}
          peopleProfiles={staffProfiles} notes={notes} auditLog={auditLog}
          userRole={userRole} authUserId={authUserId} groupLabel={groupLabel}
          safeguardingCount={safeguardingCount}
          onClose={onClose}
          backLabel={backLabel}
          onOpenNotes={() => setShowNotes(true)}
          onOpenChild={(child) => setSelectedChild(child)}
          onReload={load}
        />
        {showNotes && (
          <NotesPanel notes={notes} onClose={() => setShowNotes(false)} onAdd={handleAddNote} onRaiseSafeguarding={handleRaiseSafeguardingConcern} children={children} />
        )}
        {selectedChild && (
          <ChildQuickInfo child={selectedChild} att={attendanceByChild[selectedChild.id]} onClose={() => setSelectedChild(null)} groupLabel={groupLabel} />
        )}
      </>
    )
  }

  return (
    <OverlayPortal>
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed', inset: 0, background: 'var(--surface2)', zIndex: 10200,
        display: 'flex', flexDirection: 'column',
        // inset: 0 puts the top of this overlay behind the status bar and notch
        // when the app is installed to the home screen, which is how staff
        // actually run a register. The back button was under the clock.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.85))',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)', padding: isMobile ? '12px 14px 11px' : '16px 18px 14px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -18px rgba(15,23,42,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button aria-label={backLabel} onClick={onClose} style={{ minHeight: 44, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 15.5, fontWeight: 800, color: 'var(--text)', cursor: 'pointer', padding: '4px 6px 4px 2px', borderRadius: 8, letterSpacing: '-0.01em' }}>
            <span style={{ fontSize: 20, color: org?.primary_color || '#1B9AAA' }}>‹</span><span style={{ textAlign: 'left', minWidth: 0 }}><span style={{ display: 'block', color: 'var(--text3)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{backLabel}</span><span style={{ display: 'block', overflowWrap: 'anywhere' }}>{session.title}</span></span>
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.02em', color: STATE_COLOR[registerState],
            background: `linear-gradient(135deg, ${STATE_COLOR[registerState]}1c, ${STATE_COLOR[registerState]}0c)`,
            border: `1px solid ${STATE_COLOR[registerState]}30`,
            borderRadius: 99, padding: '5px 12px 5px 10px', textTransform: 'uppercase',
          }}>
            {registerState === 'live' && (
              <motion.span
                animate={{ opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 6, height: 6, borderRadius: 99, background: STATE_COLOR[registerState], display: 'inline-block' }}
              />
            )}
            {STATE_LABEL[registerState]}
          </span>
        </div>
        {/* On a phone this line wrapped to three rows of grey text before you
            could see a single child. The long weekday and the full month name
            are the first things to go: if you are standing at the door running
            this register, you know what day it is. */}
        <div style={{ fontSize: isMobile ? 11.5 : 12.5, color: 'var(--text3)', marginBottom: isMobile ? 10 : 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span>{new Date(session.session_date).toLocaleDateString('en-GB', isMobile
            ? { day: 'numeric', month: 'short' }
            : { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <span>{session.start_time}–{session.end_time}</span>
          {session.location && <><span style={{ color: '#CBD5E1' }}>•</span><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.location}</span></>}
        </div>
        {/* Four pills wrapped onto two rows at phone width. A fixed four-column
            grid keeps them on one line and keeps the numbers comparable. */}
        <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(4, minmax(0,1fr))' : undefined, gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
          <MiniStat icon="👥" label="On site" value={signedInCount} color="#16A34A" />
          <MiniStat icon="⏳" label="Expected" value={grouped.expected.length} color="#64748B" />
          <MiniStat icon="✕" label="Absent" value={grouped.absent.length} color="#DC2626" />
          <MiniStat icon="✓" label="Signed out" value={grouped.signed_out.length} color="#2563EB" />
        </div>
        {ratioBreached && (
          <div style={{ marginTop: 12, background: 'linear-gradient(135deg,#FEF2F2,#FEF7F7)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '10px 13px', fontSize: 12, fontWeight: 700, color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}><Icon name="⚠" /></span> {signedInStaffCount ? `Current staffing ratio 1:${currentRatio.toFixed(1)}. Required ratio: 1:${requiredRatio}.` : 'No team members are signed in. Check the team attendance below.'}
          </div>
        )}
        {totalExpected > 0 && (
          <div style={{ marginTop: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 5 }}>
              <span>Register progress</span>
              <span>{processedCount} / {totalExpected}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: '#EEF0F4', overflow: 'hidden' }}>
              <motion.div
                initial={false}
                animate={{ width: `${totalExpected ? (processedCount / totalExpected) * 100 : 0}%` }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#7C3AED,#3B82F6)' }}
              />
            </div>
          </div>
        )}
      </div>

      {loadError && <div role="alert" style={{ padding: 12, background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>{loadError} <button onClick={load} style={{ minHeight: 44 }}>Retry</button></div>}
      <div style={{ padding: '12px 16px', background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border, var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          <strong>{!session.opened_at ? 'Ready for arrivals' : grouped.expected.length ? `${grouped.expected.length} arrivals to resolve` : signedInCount ? 'Delivery in progress' : 'Ready to finish'}</strong>
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>{!session.opened_at ? `Check your team and plan, then start the ${terms.session}.` : 'Record arrivals and departures here. Changes save as you go.'}</div>
        </div>
        {!session.opened_at && canCloseRegister && <button disabled={starting || !!loadError} onClick={startSession} style={{ ...ghostBtn, minHeight: 44, background: 'var(--org-primary, #2563EB)', color: 'var(--org-on-primary, #fff)' }}>{starting ? 'Starting…' : `Start ${terms.session}`}</button>}
      </div>
      {/* TABS */}
      <div style={{ padding: '10px 14px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', gap: 4, background: '#F1F3F7', borderRadius: 12, padding: 4, overflowX: 'auto', marginBottom: 10 }}>
          {[
            { key: 'all', label: 'All', count: rows.length },
            { key: 'expected', label: 'Expected', count: grouped.expected.length },
            { key: 'signed_in', label: 'Signed in', count: grouped.signed_in.length },
            { key: 'absent', label: 'Absent', count: grouped.absent.length },
            { key: 'signed_out', label: 'Signed out', count: grouped.signed_out.length },
          ].map(t => (
            <button key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)} style={{
              position: 'relative', flex: '1 0 auto', minHeight: 44, padding: '9px 8px', border: 'none', borderRadius: 9,
              background: tab === t.key ? '#fff' : 'transparent',
              boxShadow: tab === t.key ? '0 1px 4px rgba(15,23,42,0.12)' : 'none',
              color: tab === t.key ? '#111827' : '#64748B', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            }}>
              {t.label} <span style={{ color: tab === t.key ? '#7C3AED' : '#94A3B8', fontWeight: 800 }}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH + QUICK ACTIONS */}
      <div style={{ padding: '0 14px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 160px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-faint)', pointerEvents: 'none' }}><Icon name="🔍" /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${terms.people}...`} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 32px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface2)', outline: 'none', transition: 'border-color 0.15s ease' }} onFocus={e => e.target.style.borderColor = '#A78BFA'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
        </div>
        {registerGroups.length > 1 && <select aria-label="Filter register by group" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...ghostBtn, maxWidth: '100%' }}>
          <option value="all">All groups</option>{registerGroups.map(name => <option key={name} value={name}>{name}</option>)}
        </select>}
        {(search || groupFilter !== 'all') && <button style={ghostBtn} onClick={() => { setSearch(''); setGroupFilter('all') }}>Clear filters</button>}
        <button onClick={() => setShowWalkIn(true)} style={ghostBtn}>+ Walk-in</button>
        <button onClick={() => setShowNotes(true)} style={ghostBtn}>📝 Notes {notes.length > 0 && <span style={{ color: 'var(--violet-text)' }}>({notes.length})</span>}</button>
        {/* Not gated to staff: volunteers can sign children in and out here, so
            they are the most likely to mis-tap. Locking corrections to staff
            would leave the register knowingly wrong until someone else is free.
            Every correction is audited with changed_by and a reason. */}
        <button onClick={() => setCorrectChildId('')} style={ghostBtn}>✎ Correct</button>
      </div>

      {/* LIST */}
      {/* ls-scroll gives momentum scrolling and stops a flick at the end of the
          list rubber-banding the page behind this overlay. */}
      <div className="ls-scroll" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 14, background: '#FAFBFD' }}>
        {activeList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}><Icon name="✓" /></div>
            {search || groupFilter !== 'all' ? 'No matches. Try another name or clear your filters.' : tab === 'expected' && rows.length ? 'All arrivals accounted for. Switch to Signed in to record departures.' : rows.length ? 'Nobody in this list yet.' : `No ${terms.people} on this register yet. Add a walk-in or update the plan.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Signing someone in moves them out of this list. Animating the
                exit and letting the rest slide up makes that legible: on a
                busy door the list used to just silently reshuffle under your
                thumb, which is how you lose your place in it. */}
            <AnimatePresence initial={false}>
              {activeList.map(({ child, att }, i) => (
                <RegisterRow key={child.id} child={child} att={att} onOpen={() => setSelectedChild(child)} groupLabel={groupLabel}
                  org={org} authUserId={authUserId} paymentBalance={paymentBalances[child.id]} onPaymentChanged={loadPaymentBalances}
                  onSignIn={() => handleSignIn(child)} onSignOut={() => org?.collection_recording_required === false ? handleQuickSignOut(child) : setSignOutChild(child)} onMarkAbsent={() => setAbsentChild(child)} onCorrect={() => setCorrectChildId(child.id)} isMobile={isMobile}
                  index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* STAFF PANEL */}
        <div style={{ marginTop: 20, background: 'var(--surface)', border: '1px solid #EDEFF3', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--violet-bg)', color: 'var(--violet-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}><Icon name="👤" /></span>
            Session team
          </div>
          {staffRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No staff assigned to this session.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {staffRows.map(s => {
                const pid = s.user_id || s.volunteer_id
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, paddingBottom: 9, borderBottom: '1px solid var(--border-soft)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{staffProfiles[pid] || (s.volunteer_id ? 'Volunteer' : 'Team member')} <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>· {s.role}</span></span>
                    {s.signed_out_at ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>Signed out {fmtTime(s.signed_out_at)}</span>
                        <button onClick={() => handleStaffSignIn(s)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11 }}>Sign back in</button>
                      </span>
                    ) : s.signed_in_at ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--ok-text)', fontWeight: 700 }}>Signed in {fmtTime(s.signed_in_at)}</span>
                        <button onClick={() => handleStaffSignOut(s)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11 }}>Sign out</button>
                      </span>
                    ) : (
                      <button onClick={() => handleStaffSignIn(s)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 11 }}>Sign in</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM BAR */}
      <div style={{
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(226,232,240,0.8)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -8px 24px -18px rgba(15,23,42,0.25)',
      }}>
        <button onClick={() => { setTab('signed_in'); setSearch(''); setGroupFilter('all') }} style={{ ...ghostBtn, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#16A34A' }} />
          {signedInCount} currently on site →
        </button>
        {registerState !== 'closed' && (
          canCloseRegister ? (
            <button onClick={() => setShowClosure(true)} style={{ padding: '11px 22px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px -3px rgba(124,58,237,0.5)' }}>Finish {terms.session}</button>
          ) : (
            <span title="Only a staff member can close this register" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)' }}><Icon name="🔒" /> Staff only to close</span>
          )
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, zIndex: 10300 }}>{toast}</div>
      )}

      {signOutChild && (
        <SignOutSheet child={signOutChild} onClose={() => setSignOutChild(null)} onConfirm={handleConfirmSignOut} identityCheckRequired={!!org?.identity_check_required} />
      )}
      {absentChild && (
        <AbsentSheet child={absentChild} onClose={() => setAbsentChild(null)} onMark={handleMarkAbsent} />
      )}
      {showWalkIn && (
        <WalkInModal org={org} session={session} allChildren={children.filter(child => child.active !== false)} onClose={() => setShowWalkIn(false)} onDone={() => { setShowWalkIn(false); load() }} onSignIn={handleSignIn} />
      )}
      {showNotes && (
        <NotesPanel notes={notes} onClose={() => setShowNotes(false)} onAdd={handleAddNote} onRaiseSafeguarding={handleRaiseSafeguardingConcern} children={children} />
      )}
      {showClosure && (
        <EndSessionFlow session={session} org={org} authUserId={authUserId} canCloseRegister={canCloseRegister}
          onClose={() => { setShowClosure(false); load() }}
          onReview={nextTab => { setShowClosure(false); setTab(nextTab); setSearch(''); setGroupFilter('all'); load() }}
          onClosed={saved => { setShowClosure(false); setSession(saved); load() }}
          onReflect={onNavigate ? id => onNavigate('planner', { reflectSessionId: id }) : undefined} />
      )}
      {correctChildId !== null && (
        <OverlayPortal><AttendanceCorrectionModal
          session={session} org={org} rows={rows} authUserId={authUserId} groupLabel={groupLabel}
          presetChildId={correctChildId}
          onClose={() => setCorrectChildId(null)}
          onDone={() => { setCorrectChildId(null); showToast('Attendance corrected and logged.'); load() }}
        /></OverlayPortal>
      )}
      {selectedChild && (
        <ChildQuickInfo child={selectedChild} att={attendanceByChild[selectedChild.id]} onClose={() => setSelectedChild(null)} groupLabel={groupLabel} />
      )}
    </motion.div>
    </OverlayPortal>
  )
}

function MiniStat({ icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: `linear-gradient(135deg, ${color}14, ${color}08)`,
      border: `1px solid ${color}22`, borderRadius: 12, padding: '7px 12px 7px 10px',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 7, background: `${color}1c`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
      }}>{icon}</span>
      <span style={{ fontSize: 15.5, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700 }}>{label}</span>
    </div>
  )
}

const STATUS_FLASH = { signed_in: 'rgba(22,163,74,0.22)', absent: 'rgba(217,119,6,0.22)', signed_out: 'rgba(37,99,235,0.22)' }

function RegisterRow({ child, att, onOpen, onSignIn, onSignOut, onMarkAbsent, onCorrect, groupLabel, org, authUserId, paymentBalance, onPaymentChanged, isMobile, index = 0 }) {
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const status = att?.status
  const [hover, setHover] = useState(false)
  const reduced = useReducedMotion()

  // A single wash of colour when this child's status changes, so a tap at the
  // door is confirmed on the row itself rather than only by it disappearing.
  const [flash, setFlash] = useState(0)
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current !== status && status) setFlash(f => f + 1)
    prevStatus.current = status
  }, [status])

  return (
    <motion.div
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{
        duration: 0.28, ease: [0.22, 1, 0.36, 1],
        // Only the first screenful is staggered. Past that the delay would be
        // longer than anyone waits before their thumb is moving again.
        delay: reduced ? 0 : Math.min(index, 8) * 0.028,
        layout: { type: 'spring', stiffness: 420, damping: 38 },
      }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        // relative only, deliberately no overflow:hidden — the flash overlay
        // below already carries the row's own corner radius, and clipping here
        // would cut off anything a child badge legitimately overhangs.
        position: 'relative',
        // Actions drop below the name on a phone. Side by side, the two buttons
        // and the avatar left about 110px for a name, so anything longer than
        // "Hana Al-Rashid" truncated -- on the one screen where identifying the
        // right child matters most.
        display: 'flex', alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 12, background: 'var(--surface)',
        border: '1px solid #EDEFF3', borderRadius: 16, padding: 12,
        boxShadow: hover ? '0 6px 18px -10px rgba(15,23,42,0.18)' : '0 1px 2px rgba(15,23,42,0.04)',
        // Transform is left to framer here — an inline transform would be
        // overwritten by the layout animation the moment the list reorders.
        transition: 'box-shadow 0.15s ease',
      }}>
      {flash > 0 && !reduced && (
        <motion.div
          key={flash}
          aria-hidden="true"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: 16, background: STATUS_FLASH[status] || 'transparent', pointerEvents: 'none' }}
        />
      )}
      <div onClick={onOpen} style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff',
        background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)',
        boxShadow: '0 3px 8px -2px rgba(124,58,237,0.4)',
      }}>
        {child.photo_url ? <SignedImg bucket="gallery" src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {child.first_name} {child.last_name}
          {child.is_walk_in && child.profile_incomplete && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--warn-text)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 6, padding: '1px 6px' }}>WALK-IN · PROFILE INCOMPLETE</span>}
          <RegisterPaymentBadge org={org} session={{ user: { id: authUserId } }} childId={child.id} balance={paymentBalance} onChanged={onPaymentChanged} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontWeight: 500 }}>
          {groupLabel(child.group_name)}
          {status === 'signed_in' && ` · Signed in at ${fmtTime(att.signed_in_at)}`}
          {status === 'signed_out' && ` · Signed out at ${fmtTime(att.signed_out_at)}`}
          {status === 'absent' && ` · ${att.absence_reason || 'Absent'}`}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
          {(child.has_epipen || child.has_asthma || child.has_diabetes || child.takes_medication || child.has_medication || child.medical_notes) && (
            <span style={alertPill('#DC2626', '#FEE2E2')}>⚕ Medical</span>
          )}
          {child.allergies && <span style={alertPill('#D97706', '#FEF3C7')}><Icon name="⚠" /> Allergy</span>}
          {child.collection_restricted && <span style={alertPill('#D97706', '#FEF3C7')}><Icon name="⚠" /> Collection restriction</span>}
        </div>
      </div>
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 6,
        ...(isMobile ? { borderTop: '1px solid var(--border-soft)', paddingTop: 10 } : null),
      }}>
        {status === 'signed_in' ? (
          <>
            <button onClick={onSignOut} style={actionBtn('#2563EB', isMobile)}>Sign out</button>
            <button onClick={onCorrect} title="Correct this record" style={correctBtn}>Correct</button>
          </>
        ) : status === 'signed_out' || status === 'absent' ? (
          <button onClick={onCorrect} title="Correct this record" style={correctBtn}>Correct</button>
        ) : (
          <>
            <button onClick={onSignIn} style={actionBtn('#16A34A', isMobile)}>Sign in</button>
            <button onClick={onMarkAbsent} style={{ ...actionBtn('#6B7280', isMobile), background: 'var(--surface)', color: 'var(--text3)', border: '1.5px solid var(--border)', boxShadow: 'none' }}>Absent</button>
          </>
        )}
      </div>
    </motion.div>
  )
}

function alertPill(color, bg) { return { fontSize: 9.5, fontWeight: 800, color, background: bg, border: `1px solid ${color}30`, borderRadius: 6, padding: '1px 6px' } }
// 9px of vertical padding around 12px text is a 33px target. Anything under
// ~44px is genuinely hard to hit on a phone, and this is the button somebody
// presses fifty times in a row with a child waiting in front of them.
function actionBtn(color, isMobile) {
  return {
    padding: isMobile ? '13px 14px' : '9px 14px', borderRadius: 10, border: 'none',
    background: color, color: '#fff', fontSize: isMobile ? 13.5 : 12, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `0 3px 8px -2px ${color}55`,
    ...(isMobile ? { flex: 1, minHeight: 46 } : null),
  }
}
// Matches actionBtn's mobile floor via the wrapper's stretch.
const correctBtn = { padding: '12px 14px', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const ghostBtn = { minHeight: 44, padding: '9px 13px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }

function SignOutSheet({ child, onClose, onConfirm, identityCheckRequired }) {
  const [collectionType, setCollectionType] = useState('')
  const [collectedByName, setCollectedByName] = useState('')
  const [note, setNote] = useState('')
  const [identityChecked, setIdentityChecked] = useState(false)
  const contacts = child.collection_contacts || []
  const [saving, setSaving] = useState(false)
  const cannotConfirm = saving || !collectionType || (collectionType !== 'independent' && !collectedByName.trim()) || (identityCheckRequired && !identityChecked)
  const confirm = async () => {
    if (cannotConfirm) return
    setSaving(true)
    try { await onConfirm({ collection_type: collectionType, collected_by_name: collectedByName.trim(), collection_note: note, identity_checked: identityChecked }) }
    finally { setSaving(false) }
  }

  return (
    <OverlayPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '80dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Who is {child.first_name} leaving with?</div>
        {contacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {contacts.map((c, i) => (
              <button key={i} onClick={() => { setCollectionType('approved_adult'); setCollectedByName(`${c.name}${c.relationship ? ' · ' + c.relationship : ''}`) }}
                style={{ padding: '8px 14px', borderRadius: 10, border: collectedByName.startsWith(c.name) ? '2px solid #7C3AED' : '1.5px solid #E5E7EB', background: collectedByName.startsWith(c.name) ? '#F5F3FF' : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {c.name}{c.relationship ? ` · ${c.relationship}` : ''}
              </button>
            ))}
            <button onClick={() => { setCollectionType('independent'); setCollectedByName('') }}
              style={{ padding: '8px 14px', borderRadius: 10, border: collectionType === 'independent' ? '2px solid #7C3AED' : '1.5px solid #E5E7EB', background: collectionType === 'independent' ? '#F5F3FF' : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Leaving independently</button>
          </div>
        )}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>Or choose:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {COLLECTION_TYPES.map(t => (
            <button key={t.key} onClick={() => setCollectionType(t.key)} style={{ padding: '8px 14px', borderRadius: 10, border: collectionType === t.key ? '2px solid #7C3AED' : '1.5px solid #E5E7EB', background: collectionType === t.key ? '#F5F3FF' : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
        {collectionType && collectionType !== 'independent' && (
          <input value={collectedByName} onChange={e => setCollectedByName(e.target.value)} placeholder="Name of person collecting" style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, marginBottom: 10 }} />
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Collection note (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, minHeight: 44, marginBottom: 10 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12.5, color: 'var(--text2)' }}>
          <input type="checkbox" checked={identityChecked} onChange={e => setIdentityChecked(e.target.checked)} /> Identity checked{identityCheckRequired && ' *'}
        </label>
        <button onClick={confirm}
          disabled={cannotConfirm} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: (cannotConfirm) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (cannotConfirm) ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : 'Confirm Sign Out'}
        </button>
      </div>
    </div>
    </OverlayPortal>
  )
}

function AbsentSheet({ child, onClose, onMark }) {
  return (
    <OverlayPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 20, width: 340, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Mark {child.first_name} as...</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ABSENCE_REASONS.map(r => (
            <button key={r} onClick={() => onMark(r)} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      </div>
    </div>
    </OverlayPortal>
  )
}

function WalkInModal({ org, session, allChildren, onClose, onDone, onSignIn }) {
  const terms = useTerms()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', emergency_contact_name: '', emergency_contact_phone: '', consent: false })
  const [saving, setSaving] = useState(false)

  const matches = search.trim() ? allChildren.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())) : []

  const handleSelectExisting = async (child) => {
    await onSignIn(child)
    onDone()
  }

  const handleCreateWalkIn = async () => {
    if (!form.first_name.trim() || !form.consent) return
    setSaving(true)
    const { data, error } = await supabase.from('children').insert({
      org_id: org.id, first_name: form.first_name.trim(), last_name: form.last_name.trim() || '',
      emergency_contact_name: form.emergency_contact_name || null, emergency_contact_phone: form.emergency_contact_phone || null,
      is_walk_in: true, profile_incomplete: true, active: true,
    }).select().single()
    setSaving(false)
    if (error || !data) return
    await onSignIn(data)
    onDone()
  }

  return (
    <OverlayPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 20, width: 400, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', maxHeight: '80dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Add Walk-in</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Search existing {terms.people} first — don't create a duplicate record.</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, marginBottom: 10 }} />
        {matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {matches.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => handleSelectExisting(c)} style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', textAlign: 'left', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{c.first_name} {c.last_name}</button>
            ))}
          </div>
        )}
        {search.trim() && matches.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>No existing match — create a temporary walk-in record below.</div>
        )}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>Create temporary walk-in</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="First name *" style={inp} />
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" style={inp} />
          </div>
          <input value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Emergency contact name" style={{ ...inp, width: '100%', marginBottom: 8 }} />
          <input value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="Emergency contact phone" style={{ ...inp, width: '100%', marginBottom: 8 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12.5 }}>
            <input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} /> Consent confirmed for today's session
          </label>
          <button onClick={handleCreateWalkIn} disabled={!form.first_name.trim() || !form.consent || saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: (!form.first_name.trim() || !form.consent) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Adding...' : 'Create & Sign In'}
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  )
}

function NotesPanel({ notes, onClose, onAdd, onRaiseSafeguarding, children }) {
  const [noteType, setNoteType] = useState('general')
  const [content, setContent] = useState('')
  const [childId, setChildId] = useState('')

  const handleAdd = () => {
    if (noteType === 'incident' && window.confirm('Incidents involving safeguarding should go through the Safeguarding workflow instead. Raise a safeguarding concern instead?')) {
      const child = children.find(c => c.id === childId)
      onRaiseSafeguarding(child, content)
      setContent('')
      return
    }
    onAdd(noteType, content, childId || null)
    setContent('')
  }

  return (
    <OverlayPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 400, maxWidth: '100%', height: '100%', background: 'var(--surface)', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Session Notes</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <select value={noteType} onChange={e => setNoteType(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 8 }}>
          {NOTE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
        <select value={childId} onChange={e => setChildId(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 8 }}>
          <option value="">Not about a specific child</option>
          {children.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Note..." style={{ ...inp, width: '100%', minHeight: 60, marginBottom: 10 }} />
        <button onClick={handleAdd} disabled={!content.trim()} style={{ width: '100%', padding: 11, borderRadius: 9, border: 'none', background: !content.trim() ? '#D1D5DB' : '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>Add Note</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(n => {
            const nt = NOTE_TYPES.find(t => t.key === n.note_type)
            return (
              <div key={n.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{nt?.icon} {nt?.label}</div>
                <div style={{ color: 'var(--text2)' }}>{n.content}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10.5, marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-GB')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </OverlayPortal>
  )
}

function ChildQuickInfo({ child, att, onClose, groupLabel }) {
  return (
    <OverlayPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 20, width: 340, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{child.first_name} {child.last_name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>{groupLabel(child.group_name)}{child.date_of_birth ? ` · ${new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} yrs` : ''}</div>
        {child.allergies && <InfoLine label="Allergies" value={child.allergies} />}
        {child.medical_notes && <InfoLine label="Medical notes" value={child.medical_notes} />}
        {child.emergency_contact_name && <InfoLine label="Emergency contact" value={`${child.emergency_contact_name} · ${child.emergency_contact_phone || ''}`} />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {child.emergency_contact_phone && <a href={`tel:${child.emergency_contact_phone.replace(/[^+0-9]/g, '')}`} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Call emergency contact</a>}
          {child.parent_phone && <a href={`tel:${child.parent_phone.replace(/[^+0-9]/g, '')}`} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Call parent / carer</a>}
        </div>
        {att?.status === 'signed_out' && <InfoLine label="Collected by" value={att.collected_by_name || att.collection_type} />}
        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 700, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
    </OverlayPortal>
  )
}

function InfoLine({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{value}</div>
    </div>
  )
}

const inp = { padding: '9px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12.5, flex: 1 }

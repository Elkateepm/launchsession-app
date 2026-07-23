import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import PastSessionRegister from './PastSessionRegister'

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
  const anySignedIn = attendanceRows.some(a => a.status === 'signed_in')
  const now = new Date()
  try {
    const start = new Date(`${session.session_date}T${session.start_time}`)
    const end = new Date(`${session.end_date || session.session_date}T${session.end_time}`)
    if (anySignedIn) return now > end ? 'ending' : 'live'
    if (now >= start) return 'register_open'
  } catch (e) { /* fall through */ }
  return anySignedIn ? 'live' : 'upcoming'
}

const STATE_LABEL = { upcoming: 'Upcoming', register_open: 'Register open', live: 'Live', ending: 'Ending', closed: 'Closed' }
const STATE_COLOR = { upcoming: '#6B7280', register_open: '#2563EB', live: '#16A34A', ending: '#D97706', closed: '#6B7280' }

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
}

export default function LiveRegister({ session, org, authUserId, userRole, onClose, onNavigate }) {
  const { groups: orgGroups } = useOrgSettings(org?.id)
  const configuredGroupLabels = useMemo(() => new Map((orgGroups || []).map(g => [(g.label || '').trim().toLowerCase(), g.label])), [orgGroups])
  const groupLabel = (name) => configuredGroupLabels.get((name || '').trim().toLowerCase()) || 'Ungrouped'
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
  const [signOutChild, setSignOutChild] = useState(null)
  const [absentChild, setAbsentChild] = useState(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [showClosure, setShowClosure] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedChild, setSelectedChild] = useState(null)

  const load = useCallback(async () => {
    if (!session?.id) return
    const [{ data: childData }, { data: attData }, { data: ssData }, { data: noteData }, { data: auditData }, { count: sgCount }] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name'),
      supabase.from('attendance').select('*').eq('session_id', session.id),
      supabase.from('session_staff').select('*').eq('session_id', session.id),
      supabase.from('session_notes').select('*').eq('session_id', session.id).order('created_at', { ascending: false }),
      supabase.from('attendance_audit_log').select('*').eq('session_id', session.id),
      supabase.from('cause_for_concern').select('id', { count: 'exact', head: true }).eq('session_id', session.id),
    ])
    setChildren(childData || [])
    setAttendance(attData || [])
    setStaffRows(ssData || [])
    setNotes(noteData || [])
    setAuditLog(auditData || [])
    setSafeguardingCount(sgCount || 0)

    const staffIds = new Set((ssData || []).map(s => s.user_id).filter(Boolean))
    ;(attData || []).forEach(a => { if (a.signed_in_by) staffIds.add(a.signed_in_by); if (a.signed_out_by) staffIds.add(a.signed_out_by) })
    ;(auditData || []).forEach(a => { if (a.changed_by) staffIds.add(a.changed_by) })
    if (session.closed_by) staffIds.add(session.closed_by)
    if (session.reopened_by) staffIds.add(session.reopened_by)
    if (staffIds.size) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', [...staffIds])
      const map = {}
      ;(profiles || []).forEach(p => { map[p.id] = p.full_name })
      setStaffProfiles(map)
    }
    setLoading(false)
  }, [session, org?.id])

  useEffect(() => { load() }, [load])

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
  const signedInStaffCount = staffRows.filter(s => s.signed_in_at).length || staffRows.length // fall back if nobody's using staff sign-in yet
  const currentRatio = signedInStaffCount > 0 ? signedInCount / signedInStaffCount : null
  const ratioBreached = currentRatio !== null && signedInStaffCount > 0 && currentRatio > requiredRatio
  const processedCount = grouped.signed_in.length + grouped.absent.length + grouped.signed_out.length
  const totalExpected = rows.length

  async function upsertAttendance(childId, patch) {
    const existing = attendanceByChild[childId]
    if (existing) {
      const { error } = await supabase.from('attendance').update(patch).eq('id', existing.id)
      if (error) { showToast('Could not save — please try again.'); return false }
    } else {
      const { error } = await supabase.from('attendance').insert({ org_id: org.id, session_id: session.id, child_id: childId, ...patch })
      if (error) { showToast('Could not save — please try again.'); return false }
    }
    return true
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
    await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString() }).eq('id', staffRow.id)
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

  const activeList = searchFiltered(grouped[tab] || [])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading register...</div>
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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'fixed', inset: 0, background: '#F8FAFC', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>← {session.title}</button>
          <span style={{ fontSize: 11, fontWeight: 800, color: STATE_COLOR[registerState], background: STATE_COLOR[registerState] + '18', borderRadius: 99, padding: '4px 12px' }}>
            {registerState === 'live' && '● '}{STATE_LABEL[registerState]}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 10 }}>
          {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {session.start_time}–{session.end_time} · {session.location || 'No location set'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MiniStat label="On site" value={signedInCount} color="#16A34A" />
          <MiniStat label="Expected" value={grouped.expected.length} color="#6B7280" />
          <MiniStat label="Absent" value={grouped.absent.length} color="#DC2626" />
          <MiniStat label="Signed out" value={grouped.signed_out.length} color="#2563EB" />
        </div>
        {ratioBreached && (
          <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
            ⚠ Staff-to-child ratio is currently 1:{currentRatio.toFixed(1)}. Required ratio: 1:{requiredRatio}.
          </div>
        )}
        {totalExpected > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: '#6B7280', fontWeight: 600 }}>
            Register progress: {processedCount} of {totalExpected} processed
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
        {[
          { key: 'expected', label: 'Expected', count: grouped.expected.length },
          { key: 'signed_in', label: 'Signed in', count: grouped.signed_in.length },
          { key: 'absent', label: 'Absent', count: grouped.absent.length },
          { key: 'signed_out', label: 'Signed out', count: grouped.signed_out.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '11px 8px', border: 'none', borderBottom: tab === t.key ? '2.5px solid #7C3AED' : '2.5px solid transparent', background: 'none', color: tab === t.key ? '#7C3AED' : '#6B7280', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {/* SEARCH + QUICK ACTIONS */}
      <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..." style={{ flex: '1 1 160px', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13 }} />
        <button onClick={() => setShowWalkIn(true)} style={ghostBtn}>+ Add walk-in</button>
        <button onClick={() => setShowNotes(true)} style={ghostBtn}>📝 Notes ({notes.length})</button>
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {activeList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Nobody in this list{search ? ' matching your search' : ''}.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeList.map(({ child, att }) => (
              <RegisterRow key={child.id} child={child} att={att} onOpen={() => setSelectedChild(child)} groupLabel={groupLabel}
                onSignIn={() => handleSignIn(child)} onSignOut={() => org?.collection_recording_required === false ? handleQuickSignOut(child) : setSignOutChild(child)} onMarkAbsent={() => setAbsentChild(child)} />
            ))}
          </div>
        )}

        {/* STAFF PANEL */}
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Session team</div>
          {staffRows.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>No staff assigned to this session.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {staffRows.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{staffProfiles[s.user_id] || 'Team member'} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {s.role}</span></span>
                  {s.signed_in_at ? (
                    <span style={{ color: '#16A34A', fontWeight: 700 }}>Signed in {fmtTime(s.signed_in_at)}</span>
                  ) : (
                    <button onClick={() => handleStaffSignIn(s)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 11 }}>Sign in</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM BAR */}
      <div style={{ background: '#fff', borderTop: '1px solid #E5E7EB', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{signedInCount} currently on site</span>
        {registerState !== 'closed' && (
          <button onClick={() => setShowClosure(true)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close register</button>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '9px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, zIndex: 300 }}>{toast}</div>
      )}

      {signOutChild && (
        <SignOutSheet child={signOutChild} onClose={() => setSignOutChild(null)} onConfirm={handleConfirmSignOut} identityCheckRequired={!!org?.identity_check_required} />
      )}
      {absentChild && (
        <AbsentSheet child={absentChild} onClose={() => setAbsentChild(null)} onMark={handleMarkAbsent} />
      )}
      {showWalkIn && (
        <WalkInModal org={org} session={session} allChildren={children} onClose={() => setShowWalkIn(false)} onDone={() => { setShowWalkIn(false); load() }} onSignIn={handleSignIn} />
      )}
      {showNotes && (
        <NotesPanel notes={notes} onClose={() => setShowNotes(false)} onAdd={handleAddNote} onRaiseSafeguarding={handleRaiseSafeguardingConcern} children={children} />
      )}
      {showClosure && (
        <ClosureFlow session={session} grouped={grouped} onClose={() => setShowClosure(false)} org={org} authUserId={authUserId} onClosed={() => { setShowClosure(false); onClose && onClose() }} onMarkAllAbsent={async () => {
          await Promise.all(grouped.expected.map(r => upsertAttendance(r.child.id, { status: 'absent', absence_reason: 'No reason provided' })))
          load()
        }} />
      )}
      {selectedChild && (
        <ChildQuickInfo child={selectedChild} att={attendanceByChild[selectedChild.id]} onClose={() => setSelectedChild(null)} groupLabel={groupLabel} />
      )}
    </motion.div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: color + '12', borderRadius: 10, padding: '6px 12px' }}>
      <span style={{ fontSize: 15, fontWeight: 900, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginLeft: 5 }}>{label}</span>
    </div>
  )
}

function RegisterRow({ child, att, onOpen, onSignIn, onSignOut, onMarkAbsent, groupLabel }) {
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const status = att?.status
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 12 }}>
      <div onClick={onOpen} style={{ width: 46, height: 46, borderRadius: 14, background: '#7C3AED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0, cursor: 'pointer', overflow: 'hidden' }}>
        {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
          {child.first_name} {child.last_name}
          {child.is_walk_in && child.profile_incomplete && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: '#D97706', background: '#FFFBEB', borderRadius: 6, padding: '1px 6px' }}>WALK-IN · PROFILE INCOMPLETE</span>}
        </div>
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
          {groupLabel(child.group_name)}
          {status === 'signed_in' && ` · Signed in at ${fmtTime(att.signed_in_at)}`}
          {status === 'signed_out' && ` · Signed out at ${fmtTime(att.signed_out_at)}`}
          {status === 'absent' && ` · ${att.absence_reason || 'Absent'}`}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          {(child.has_epipen || child.has_asthma || child.has_diabetes || child.takes_medication || child.has_medication || child.medical_notes) && (
            <span style={alertPill('#DC2626', '#FEE2E2')}>⚕ Medical</span>
          )}
          {child.allergies && <span style={alertPill('#D97706', '#FEF3C7')}>⚠ Allergy</span>}
          {child.collection_restricted && <span style={alertPill('#D97706', '#FEF3C7')}>⚠ Collection restriction</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
        {status === 'signed_in' ? (
          <button onClick={onSignOut} style={actionBtn('#2563EB')}>Sign out</button>
        ) : status === 'signed_out' || status === 'absent' ? null : (
          <>
            <button onClick={onSignIn} style={actionBtn('#16A34A')}>Sign in</button>
            <button onClick={onMarkAbsent} style={{ ...actionBtn('#6B7280'), background: '#fff', color: '#6B7280', border: '1.5px solid #E5E7EB' }}>Absent</button>
          </>
        )}
      </div>
    </div>
  )
}

function alertPill(color, bg) { return { fontSize: 9.5, fontWeight: 800, color, background: bg, borderRadius: 6, padding: '1px 6px' } }
function actionBtn(color) { return { padding: '9px 14px', borderRadius: 9, border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' } }
const ghostBtn = { padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer' }

function SignOutSheet({ child, onClose, onConfirm, identityCheckRequired }) {
  const [collectionType, setCollectionType] = useState('')
  const [collectedByName, setCollectedByName] = useState('')
  const [note, setNote] = useState('')
  const [identityChecked, setIdentityChecked] = useState(false)
  const contacts = child.collection_contacts || []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>Or choose:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {COLLECTION_TYPES.map(t => (
            <button key={t.key} onClick={() => setCollectionType(t.key)} style={{ padding: '8px 14px', borderRadius: 10, border: collectionType === t.key ? '2px solid #7C3AED' : '1.5px solid #E5E7EB', background: collectionType === t.key ? '#F5F3FF' : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
        {collectionType && collectionType !== 'independent' && (
          <input value={collectedByName} onChange={e => setCollectedByName(e.target.value)} placeholder="Name of person collecting" style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, marginBottom: 10 }} />
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Collection note (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, minHeight: 44, marginBottom: 10 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12.5, color: '#374151' }}>
          <input type="checkbox" checked={identityChecked} onChange={e => setIdentityChecked(e.target.checked)} /> Identity checked{identityCheckRequired && ' *'}
        </label>
        <button onClick={() => onConfirm({ collection_type: collectionType || 'other', collected_by_name: collectedByName, collection_note: note, identity_checked: identityChecked })}
          disabled={!collectionType || (identityCheckRequired && !identityChecked)} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: (!collectionType || (identityCheckRequired && !identityChecked)) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!collectionType || (identityCheckRequired && !identityChecked)) ? 'not-allowed' : 'pointer' }}>
          Confirm Sign Out
        </button>
      </div>
    </div>
  )
}

function AbsentSheet({ child, onClose, onMark }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Mark {child.first_name} as...</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ABSENCE_REASONS.map(r => (
            <button key={r} onClick={() => onMark(r)} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function WalkInModal({ org, session, allChildren, onClose, onDone, onSignIn }) {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 400, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Add Walk-in</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Search existing young people first — don't create a duplicate record.</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, marginBottom: 10 }} />
        {matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {matches.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => handleSelectExisting(c)} style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', textAlign: 'left', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{c.first_name} {c.last_name}</button>
            ))}
          </div>
        )}
        {search.trim() && matches.length === 0 && (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>No existing match — create a temporary walk-in record below.</div>
        )}
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 8 }}>Create temporary walk-in</div>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 400, maxWidth: '100%', height: '100%', background: '#fff', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
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
              <div key={n.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{nt?.icon} {nt?.label}</div>
                <div style={{ color: '#374151' }}>{n.content}</div>
                <div style={{ color: '#9CA3AF', fontSize: 10.5, marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-GB')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ClosureFlow({ session, grouped, onClose, org, authUserId, onClosed, onMarkAllAbsent }) {
  const stillSignedIn = grouped.signed_in.length
  const unaccounted = grouped.expected.length

  const handleClose = async () => {
    await supabase.from('sessions').update({ closed_at: new Date().toISOString(), closed_by: authUserId, register_status: 'closed' }).eq('id', session.id)
    onClosed()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Close Register</div>

        {stillSignedIn > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
            ⚠ {stillSignedIn} young people are still marked on site. Sign them out before closing, or confirm this is expected.
          </div>
        )}
        {unaccounted > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
            {unaccounted} young people have no attendance status.
          </div>
        )}

        {unaccounted > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <button onClick={onMarkAllAbsent} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>Mark all remaining absent</button>
            <button onClick={onClose} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>Review individually</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Leave Open</button>
          <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close and Lock Register</button>
        </div>
      </div>
    </div>
  )
}

function ChildQuickInfo({ child, att, onClose, groupLabel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{child.first_name} {child.last_name}</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>{groupLabel(child.group_name)}{child.date_of_birth ? ` · ${new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} yrs` : ''}</div>
        {child.allergies && <InfoLine label="Allergies" value={child.allergies} />}
        {child.medical_notes && <InfoLine label="Medical notes" value={child.medical_notes} />}
        {child.emergency_contact_name && <InfoLine label="Emergency contact" value={`${child.emergency_contact_name} · ${child.emergency_contact_phone || ''}`} />}
        {att?.status === 'signed_out' && <InfoLine label="Collected by" value={att.collected_by_name || att.collection_type} />}
        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: 10, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#374151' }}>{value}</div>
    </div>
  )
}

const inp = { padding: '9px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12.5, flex: 1 }

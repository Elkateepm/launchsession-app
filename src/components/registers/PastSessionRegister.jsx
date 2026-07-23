import React, { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
}
function fmtDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function toCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return rows.map(r => r.map(esc).join(',')).join('\r\n')
}
function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function PastSessionRegister({
  session, org, grouped, rows, staffRows, peopleProfiles, notes, auditLog,
  userRole, authUserId, groupLabel, safeguardingCount,
  onClose, onOpenNotes, onOpenChild, onReload,
}) {
  const [tab, setTab] = useState('expected')
  const [search, setSearch] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)
  const [showReopen, setShowReopen] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showAuditFor, setShowAuditFor] = useState(null) // child id
  const [showMore, setShowMore] = useState(false)

  const canCorrect = ['admin', 'owner', 'staff'].includes(userRole)
  const canReopen = ['admin', 'owner'].includes(userRole)
  const canExport = ['admin', 'owner', 'staff'].includes(userRole)

  const primary = org?.primary_color || '#3B82F6'
  const secondary = org?.secondary_color || '#8B5CF6'

  const walkIns = useMemo(() => rows.filter(r => r.child.is_walk_in), [rows])
  const correctedChildIds = useMemo(() => new Set((auditLog || []).map(a => a.child_id)), [auditLog])
  const corrected = useMemo(() => rows.filter(r => correctedChildIds.has(r.child.id)), [rows, correctedChildIds])

  const attendedTotal = grouped.signed_in.length + grouped.signed_out.length
  const totalExpected = rows.length
  const attendanceRate = totalExpected > 0 ? Math.round((attendedTotal / totalExpected) * 100) : 0
  const processedCount = grouped.signed_in.length + grouped.absent.length + grouped.signed_out.length
  const completionPct = totalExpected > 0 ? Math.round((processedCount / totalExpected) * 100) : 100
  const hasUnresolved = grouped.expected.length > 0

  const closedByName = peopleProfiles[session.closed_by] || 'A team member'
  const reopenedByName = peopleProfiles[session.reopened_by] || 'A team member'

  const TABS = [
    { key: 'expected', label: 'Expected', count: grouped.expected.length },
    { key: 'signed_in', label: 'Attended', count: grouped.signed_in.length },
    { key: 'absent', label: 'Absent', count: grouped.absent.length },
    { key: 'signed_out', label: 'Signed out', count: grouped.signed_out.length },
  ]
  if (walkIns.length > 0) TABS.push({ key: 'walk_ins', label: 'Walk-ins', count: walkIns.length })
  if (corrected.length > 0) TABS.push({ key: 'corrected', label: 'Corrections', count: corrected.length })

  const listForTab = tab === 'walk_ins' ? walkIns : tab === 'corrected' ? corrected : (grouped[tab] || [])
  const filtered = search.trim()
    ? listForTab.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : listForTab

  const handleExportCsv = () => {
    const header = ['Name', 'Group', 'Status', 'Signed in', 'Signed out', 'Absence reason', 'Recorded by']
    const body = rows.map(({ child, att }) => [
      `${child.first_name} ${child.last_name}`,
      groupLabel(child.group_name),
      att?.status || 'unmarked',
      att?.signed_in_at ? fmtDateTime(att.signed_in_at) : '',
      att?.signed_out_at ? fmtDateTime(att.signed_out_at) : '',
      att?.absence_reason || '',
      att ? (peopleProfiles[att.signed_out_by || att.signed_in_by] || '') : '',
    ])
    downloadText(`${session.title}-attendance-${session.session_date}.csv`, toCsv([header, ...body]))
  }

  const handleExportEmergency = () => {
    const header = ['Name', 'Group', 'Medical', 'Allergy', 'Emergency contact', 'Emergency phone']
    const body = rows.map(({ child }) => [
      `${child.first_name} ${child.last_name}`,
      groupLabel(child.group_name),
      (child.has_epipen || child.has_asthma || child.has_diabetes || child.takes_medication || child.medical_notes) ? child.medical_notes || 'Yes' : '',
      child.allergies || '',
      child.emergency_contact_name || '',
      child.emergency_contact_phone || '',
    ])
    downloadText(`${session.title}-emergency-record-${session.session_date}.csv`, toCsv([header, ...body]))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F8FAFC', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      {/* HEADER */}
      <div className="no-print" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 18px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: '#6B7280', cursor: 'pointer', marginBottom: 10 }}>← Back to sessions</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${primary}, ${secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{(org?.name || 'L')[0]}</span>}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{session.title}</div>
              <div style={{ fontSize: 12.5, color: '#6B7280' }}>
                {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {session.start_time}–{session.end_time} · {session.location || 'No location set'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', background: '#F3F4F6', borderRadius: 99, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>🔒 Attendance closed</span>
            {session.closed_at && (
              <div style={{ textAlign: 'right', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>Final outcome</div>
                <div style={{ fontSize: 12, color: '#374151' }}>Closed {fmtDateTime(session.closed_at)}</div>
                <div style={{ fontSize: 11.5, color: '#6B7280' }}>by {closedByName}</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>This session has ended and the final attendance record is locked.</div>

        {session.reopened_at && !session.closed_at && (
          <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#92400E', fontWeight: 700 }}>
            Register reopened by {reopenedByName} at {fmtTime(session.reopened_at)}
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginTop: 14 }}>
          <Stat label="Expected" value={totalExpected} color="#6B7280" />
          <Stat label="Attended" value={attendedTotal} color="#16A34A" />
          <Stat label="Absent" value={grouped.absent.length} color="#DC2626" />
          <Stat label="Signed out" value={grouped.signed_out.length} color="#2563EB" />
          <Stat label="Walk-ins" value={walkIns.length} color="#7C3AED" />
          <Stat label="Attendance rate" value={`${attendanceRate}%`} color="#111827" />
        </div>
        {totalExpected === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#B45309' }}>Attendance record incomplete</div>
        )}

        {/* REGISTER COMPLETION */}
        <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            <span>Final register — {processedCount} of {totalExpected} processed</span>
            <span>{completionPct}% complete</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
          </div>
          {hasUnresolved && (
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>⚠ Register was closed with {grouped.expected.length} unresolved young people.</div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="no-print" style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: '1 0 auto', padding: '11px 14px', border: 'none', borderBottom: tab === t.key ? `2.5px solid ${primary}` : '2.5px solid transparent', background: 'none', color: tab === t.key ? primary : '#6B7280', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <div className="no-print" style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..." style={{ flex: '1 1 160px', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13 }} />
        <button onClick={onOpenNotes} style={ghostBtn}>📝 Notes ({notes.length})</button>
        {canCorrect && <button onClick={() => setShowCorrection(true)} style={ghostBtn}>Correct attendance</button>}
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Nobody in this list{search ? ' matching your search' : ''}.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(({ child, att }) => (
              <HistoricalRow key={child.id} child={child} att={att} groupLabel={groupLabel} peopleProfiles={peopleProfiles}
                isCorrected={correctedChildIds.has(child.id)} onOpen={() => onOpenChild(child)}
                onViewAudit={() => setShowAuditFor(child.id)} />
            ))}
          </div>
        )}

        <SessionTeamCard staffRows={staffRows} peopleProfiles={peopleProfiles} />
      </div>

      {/* STICKY FOOTER */}
      <div className="no-print" style={{ background: '#fff', borderTop: '1px solid #E5E7EB', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Attendance closed</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Final attendance recorded: {attendedTotal} attended · {grouped.absent.length} absent · {grouped.signed_out.length} signed out</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSummary(true)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View summary</button>
          <button onClick={() => setShowMore(v => !v)} style={{ ...ghostBtn, padding: '10px 12px' }}>⋯</button>
        </div>
        {showMore && (
          <div style={{ position: 'absolute', bottom: 56, right: 16, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 200 }}>
            {canExport && <MenuItem onClick={() => { handleExportCsv(); setShowMore(false) }}>Export register (CSV)</MenuItem>}
            {canExport && <MenuItem onClick={() => { handleExportEmergency(); setShowMore(false) }}>Download emergency record</MenuItem>}
            {canExport && <MenuItem onClick={() => { window.print(); setShowMore(false) }}>Print / export PDF</MenuItem>}
            {canCorrect && <MenuItem onClick={() => { setShowCorrection(true); setShowMore(false) }}>Correct attendance</MenuItem>}
            {canReopen && <MenuItem danger onClick={() => { setShowReopen(true); setShowMore(false) }}>Reopen register</MenuItem>}
          </div>
        )}
      </div>

      {showCorrection && (
        <AttendanceCorrectionModal session={session} org={org} rows={rows} authUserId={authUserId} groupLabel={groupLabel}
          onClose={() => setShowCorrection(false)} onDone={() => { setShowCorrection(false); onReload() }} />
      )}
      {showReopen && (
        <ReopenRegisterModal session={session} authUserId={authUserId}
          onClose={() => setShowReopen(false)} onDone={() => { setShowReopen(false); onReload() }} />
      )}
      {showSummary && (
        <SessionSummaryDrawer session={session} org={org} grouped={grouped} rows={rows} staffRows={staffRows}
          peopleProfiles={peopleProfiles} notes={notes} walkIns={walkIns} attendanceRate={attendanceRate}
          safeguardingCount={safeguardingCount} groupLabel={groupLabel} onClose={() => setShowSummary(false)} />
      )}
      {showAuditFor && (
        <RegisterAuditHistory childId={showAuditFor} auditLog={auditLog} peopleProfiles={peopleProfiles}
          rows={rows} onClose={() => setShowAuditFor(null)} />
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: color + '12', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

const STATUS_PILL = {
  signed_in: { label: 'Attended', color: '#16A34A', bg: '#DCFCE7' },
  signed_out: { label: 'Signed out', color: '#2563EB', bg: '#DBEAFE' },
  absent: { label: 'Absent', color: '#DC2626', bg: '#FEE2E2' },
  walk_in: { label: 'Walk-in', color: '#7C3AED', bg: '#EDE9FE' },
}

function HistoricalRow({ child, att, groupLabel, peopleProfiles, isCorrected, onOpen, onViewAudit }) {
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const status = att?.status
  const pill = STATUS_PILL[status] || { label: 'Unmarked', color: '#6B7280', bg: '#F3F4F6' }
  const recordedBy = peopleProfiles[att?.signed_out_by || att?.signed_in_by] || null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 12 }}>
      <div onClick={onOpen} style={{ width: 46, height: 46, borderRadius: 14, background: '#7C3AED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0, cursor: 'pointer', overflow: 'hidden' }}>
        {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
          {child.first_name} {child.last_name}
          {child.is_walk_in && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', borderRadius: 6, padding: '1px 6px' }}>WALK-IN</span>}
        </div>
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{groupLabel(child.group_name)}</div>
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
          {status === 'signed_in' && `Attended · Signed in at ${fmtTime(att.signed_in_at)}`}
          {status === 'signed_out' && `Attended · Signed in at ${fmtTime(att.signed_in_at)} · Signed out at ${fmtTime(att.signed_out_at)}${att.collected_by_name ? ` · Collected by ${att.collected_by_name}` : ''}`}
          {status === 'absent' && `Absent · Reason: ${att.absence_reason || 'Not specified'}`}
          {!status && 'No attendance recorded'}
        </div>
        {recordedBy && <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>Recorded by {recordedBy}</div>}
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          {(child.has_epipen || child.has_asthma || child.has_diabetes || child.takes_medication || child.medical_notes) && <span style={alertPill('#DC2626', '#FEE2E2')}>⚕ Medical</span>}
          {child.allergies && <span style={alertPill('#D97706', '#FEF3C7')}>⚠ Allergy</span>}
          {isCorrected && (
            <span onClick={onViewAudit} style={{ ...alertPill('#B45309', '#FEF3C7'), cursor: 'pointer', textDecoration: 'underline' }}>Corrected — view audit history</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: pill.color, background: pill.bg, borderRadius: 99, padding: '5px 12px' }}>{pill.label}</span>
      </div>
    </div>
  )
}

function alertPill(color, bg) { return { fontSize: 9.5, fontWeight: 800, color, background: bg, borderRadius: 6, padding: '1px 6px' } }
const ghostBtn = { padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer' }

function MenuItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', borderBottom: '1px solid #F1F5F9', background: '#fff', fontSize: 13, fontWeight: 600, color: danger ? '#DC2626' : '#374151', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function SessionTeamCard({ staffRows, peopleProfiles }) {
  return (
    <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Session team</div>
      {staffRows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>No staff assigned to this session.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffRows.map(s => (
            <div key={s.id} style={{ fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: '#374151' }}>{peopleProfiles[s.user_id] || 'Team member'} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {s.role}</span></div>
              <div style={{ color: '#9CA3AF', fontSize: 11 }}>
                {s.signed_in_at ? `Signed in ${fmtTime(s.signed_in_at)}` : 'Did not sign in'}
                {s.signed_out_at ? ` · Signed out ${fmtTime(s.signed_out_at)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AttendanceCorrectionModal({ session, org, rows, authUserId, groupLabel, onClose, onDone }) {
  const [childId, setChildId] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [signedInAt, setSignedInAt] = useState('')
  const [signedOutAt, setSignedOutAt] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = rows.find(r => r.child.id === childId)
  const original = selected?.att || null

  const handleConfirm = async () => {
    if (!childId || !newStatus || !reason.trim()) return
    setSaving(true)

    const patch = { status: newStatus === 'unmarked' ? null : newStatus }
    if (newStatus === 'signed_in' || newStatus === 'signed_out') patch.signed_in_at = signedInAt ? new Date(signedInAt).toISOString() : original?.signed_in_at || new Date().toISOString()
    if (newStatus === 'signed_out') patch.signed_out_at = signedOutAt ? new Date(signedOutAt).toISOString() : original?.signed_out_at || new Date().toISOString()

    let attendanceId = original?.id || null
    if (original) {
      await supabase.from('attendance').update(patch).eq('id', original.id)
    } else {
      const { data } = await supabase.from('attendance').insert({ org_id: org.id, session_id: session.id, child_id: childId, ...patch }).select().single()
      attendanceId = data?.id || null
    }

    await supabase.from('attendance_audit_log').insert({
      org_id: org.id, attendance_id: attendanceId, session_id: session.id, child_id: childId,
      previous_status: original?.status || null, new_status: patch.status,
      previous_signed_in_at: original?.signed_in_at || null, new_signed_in_at: patch.signed_in_at || null,
      previous_signed_out_at: original?.signed_out_at || null, new_signed_out_at: patch.signed_out_at || null,
      correction_reason: reason.trim(), changed_by: authUserId,
    })

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: 420, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Correct attendance</div>

        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>1. Select child</div>
        <select value={childId} onChange={e => setChildId(e.target.value)} style={sel}>
          <option value="">Choose a young person...</option>
          {rows.map(r => <option key={r.child.id} value={r.child.id}>{r.child.first_name} {r.child.last_name} · {groupLabel(r.child.group_name)}</option>)}
        </select>

        {childId && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', margin: '14px 0 6px' }}>2. Original record</div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 10, fontSize: 12.5, color: '#374151' }}>
              Status: {original?.status || 'unmarked'}{original?.signed_in_at ? ` · in ${fmtTime(original.signed_in_at)}` : ''}{original?.signed_out_at ? ` · out ${fmtTime(original.signed_out_at)}` : ''}
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', margin: '14px 0 6px' }}>3. Corrected status</div>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={sel}>
              <option value="">Choose corrected status...</option>
              <option value="signed_in">Attended</option>
              <option value="signed_out">Signed out</option>
              <option value="absent">Absent</option>
              <option value="unmarked">Unmarked</option>
            </select>

            {(newStatus === 'signed_in' || newStatus === 'signed_out') && (
              <>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', margin: '14px 0 6px' }}>4. Corrected timestamps</div>
                <input type="datetime-local" value={signedInAt} onChange={e => setSignedInAt(e.target.value)} style={{ ...sel, marginBottom: 8 }} />
                {newStatus === 'signed_out' && <input type="datetime-local" value={signedOutAt} onChange={e => setSignedOutAt(e.target.value)} style={sel} />}
              </>
            )}

            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', margin: '14px 0 6px' }}>5. Reason for correction</div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being corrected?" style={{ ...sel, minHeight: 60 }} />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!childId || !newStatus || !reason.trim() || saving}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: (!childId || !newStatus || !reason.trim()) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving...' : '6. Confirm correction'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReopenRegisterModal({ session, authUserId, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleReopen = async () => {
    if (!reason.trim()) return
    setSaving(true)
    await supabase.from('sessions').update({
      closed_at: null, register_status: 'open',
      reopened_at: new Date().toISOString(), reopened_by: authUserId, reopen_reason: reason.trim(),
    }).eq('id', session.id)
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Reopen register</div>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#B91C1C', fontWeight: 600 }}>
          Reopening this register will allow attendance records to be changed. All changes will be audited.
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for reopening (required)" style={{ ...sel, minHeight: 70, marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleReopen} disabled={!reason.trim() || saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: !reason.trim() ? '#D1D5DB' : '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Reopening...' : 'Confirm reopen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionSummaryDrawer({ session, org, grouped, rows, staffRows, peopleProfiles, notes, walkIns, attendanceRate, safeguardingCount, groupLabel, onClose }) {
  const groupBreakdown = useMemo(() => {
    const map = {}
    rows.forEach(({ child }) => {
      const g = groupLabel(child.group_name)
      map[g] = (map[g] || 0) + 1
    })
    return Object.entries(map)
  }, [rows, groupLabel])

  const noteCounts = useMemo(() => {
    const map = {}
    notes.forEach(n => { map[n.note_type] = (map[n.note_type] || 0) + 1 })
    return map
  }, [notes])

  const lateArrivals = noteCounts.late_arrival || 0
  const earlyCollections = noteCounts.early_collection || 0
  const medicalEvents = noteCounts.injury || 0
  const incidents = noteCounts.incident || 0
  const staffAttended = staffRows.filter(s => s.signed_in_at).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 420, maxWidth: '100%', height: '100%', background: '#fff', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Session summary</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <SummaryRow label="Session" value={`${session.title} · ${session.location || 'No location'}`} />
        <SummaryRow label="Date" value={new Date(session.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
        <SummaryRow label="Time" value={`${session.start_time}–${session.end_time}`} />
        <SummaryRow label="Attendance rate" value={`${attendanceRate}%`} />
        <SummaryRow label="Attended / expected" value={`${grouped.signed_in.length + grouped.signed_out.length} / ${rows.length}`} />
        <SummaryRow label="Absent" value={grouped.absent.length} />
        <SummaryRow label="Walk-ins" value={walkIns.length} />
        <SummaryRow label="Staff attendance" value={`${staffAttended} / ${staffRows.length}`} />
        <SummaryRow label="Late arrivals" value={lateArrivals} />
        <SummaryRow label="Early collections" value={earlyCollections} />
        <SummaryRow label="Medical / first-aid events" value={medicalEvents} />
        <SummaryRow label="Incidents" value={incidents} />
        <SummaryRow label="Safeguarding concerns" value={safeguardingCount} />
        <SummaryRow label="Session notes" value={notes.length} />

        {groupBreakdown.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', margin: '16px 0 8px' }}>Group breakdown</div>
            {groupBreakdown.map(([g, count]) => <SummaryRow key={g} label={g} value={count} />)}
          </>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 12.5, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>{value}</span>
    </div>
  )
}

function RegisterAuditHistory({ childId, auditLog, peopleProfiles, rows, onClose }) {
  const child = rows.find(r => r.child.id === childId)?.child
  const entries = (auditLog || []).filter(a => a.child_id === childId).sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Audit history</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14 }}>{child ? `${child.first_name} ${child.last_name}` : ''}</div>
        {entries.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>No corrections recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(e => (
              <div key={e.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>{e.previous_status || 'unmarked'} → {e.new_status || 'unmarked'}</div>
                <div style={{ color: '#374151', marginBottom: 4 }}>{e.correction_reason}</div>
                <div style={{ color: '#9CA3AF', fontSize: 11 }}>{peopleProfiles[e.changed_by] || 'A team member'} · {fmtDateTime(e.changed_at)}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: 10, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

const sel = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }

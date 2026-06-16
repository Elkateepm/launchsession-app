import React, { useState, useRef, useEffect } from \'react\'
import { format } from \'date-fns\'
import { supabase } from \'../../lib/supabase\'
import { useTodaySession, useAttendance, useChildren } from \'../../lib/hooks\'

const DEFAULT_BUBBLES = [
  { key: \'red\',    label: \'Red\',    color: \'#E53935\', light: \'#FFF0F0\', dark: \'#8B0000\' },
  { key: \'green\',  label: \'Green\',  color: \'#417505\', light: \'#EDFAED\', dark: \'#1A5C1A\' },
  { key: \'yellow\', label: \'Yellow\', color: \'#B8860B\', light: \'#FFF8E6\', dark: \'#7A4A00\' },
  { key: \'blue\',   label: \'Blue\',   color: \'#1B9AAA\', light: \'#EEF4FF\', dark: \'#1A3A8B\' },
  { key: \'purple\', label: \'Purple\', color: \'#7B2D8B\', light: \'#F5F0FF\', dark: \'#4A1A5C\' },
  { key: \'teens\',  label: \'Teens\',  color: \'#1A1A1A\', light: \'#F5F5F5\', dark: \'#000\' },
]

// ─── STAT BAR ────────────────────────────────────────────────
function StatBar({ counts, onFilterChange, activeFilter, primary }) {
  const total = counts.total || 0
  const pct = total > 0 ? Math.round((counts.signed_in / total) * 100) : 0
  return (
    <div style={{ background: \'#0D1B2A\', padding: \'12px 16px 14px\' }}>
      <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr 1fr 1fr\', gap: 8, marginBottom: 12 }}>
        {[
          { num: counts.signed_in,  label: \'Present\', color: \'#4ADE80\', filter: \'signed_in\' },
          { num: counts.expected,   label: \'Expected\', color: \'#F5D000\', filter: \'expected\' },
          { num: counts.absent,     label: \'Absent\',  color: \'#FF8080\', filter: \'absent\' },
          { num: counts.signed_out, label: \'Left\',    color: \'#9FE1CB\', filter: \'signed_out\' },
        ].map(({ num, label, color, filter }) => (
          <button key={label} onClick={() => onFilterChange(activeFilter === filter ? \'all\' : filter)}
            style={{ background: activeFilter === filter ? \'rgba(255,255,255,0.15)\' : \'rgba(255,255,255,0.07)\', borderRadius: 10, padding: \'8px 4px\', textAlign: \'center\', border: activeFilter === filter ? \'1.5px solid \' + color + \'60\' : \'1px solid transparent\', cursor: \'pointer\' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{num}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: \'rgba(255,255,255,0.6)\', marginTop: 3, textTransform: \'uppercase\', letterSpacing: 0.4 }}>{label}</div>
          </button>
        ))}
      </div>
      <div style={{ background: \'rgba(255,255,255,0.1)\', borderRadius: 99, height: 6, marginBottom: 4 }}>
        <div style={{ background: \'linear-gradient(90deg, #417505, #4ADE80)\', width: pct + \'%\', height: \'100%\', borderRadius: 99, transition: \'width 0.4s\' }} />
      </div>
      <div style={{ fontSize: 11, color: \'rgba(255,255,255,0.6)\', fontWeight: 600, textAlign: \'center\' }}>
        {pct}% checked in · {total} total
      </div>
    </div>
  )
}

// ─── CHILD ROW ───────────────────────────────────────────────
function ChildRow({ child, status, attendanceRecord, bubble, onTap }) {
  const name = `${child.first_name} ${child.last_name}`
  const hasAlert = child.allergies || child.medical_notes
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), \'HH:mm\') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), \'HH:mm\') : null

  const rowBg = status === \'signed_in\' ? \'#F0FFF4\' : status === \'signed_out\' ? \'#EEF4FF\' : status === \'absent\' ? \'#FFF5F5\' : \'#fff\'
  const rowBorder = status === \'signed_in\' ? \'#B0E8C0\' : status === \'signed_out\' ? \'#C0D8FF\' : status === \'absent\' ? \'#FFD0D0\' : \'#e5e7eb\'
  const badgeConfig = status === \'signed_in\'
    ? { bg: \'#417505\', icon: \'✓\', label: \'IN\' }
    : status === \'signed_out\'
    ? { bg: \'#1B9AAA\', icon: \'→\', label: \'OUT\' }
    : status === \'absent\'
    ? { bg: \'#C00\', icon: \'✗\', label: \'ABS\' }
    : status === \'expected\'
    ? { bg: \'#E09000\', icon: \'⏱\', label: \'EXP\' }
    : { bg: \'#C8CDD4\', icon: \'—\', label: \'MARK\' }

  return (
    <div style={{ display: \'flex\', gap: 8, marginBottom: 8 }}>
      <button onClick={() => onTap(child, status, attendanceRecord)}
        style={{ flex: 1, background: rowBg, borderRadius: 12, border: `1.5px solid ${rowBorder}`, padding: \'11px 13px\', display: \'flex\', alignItems: \'center\', gap: 11, cursor: \'pointer\', textAlign: \'left\' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bubble?.color || \'#1B9AAA\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: 13, fontWeight: 800, color: \'#fff\', flexShrink: 0, overflow: \'hidden\' }}>
          {child.photo_url ? <img src={child.photo_url} alt={name} style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: \'#111\' }}>{name}</div>
          <div style={{ display: \'flex\', gap: 8, marginTop: 3, flexWrap: \'wrap\' }}>
            {signedInTime && <span style={{ fontSize: 11, fontWeight: 700, color: \'#417505\' }}>In {signedInTime}</span>}
            {signedOutTime && <span style={{ fontSize: 11, fontWeight: 700, color: \'#1B9AAA\' }}>Out {signedOutTime}</span>}
            {!signedInTime && !signedOutTime && <span style={{ fontSize: 11, color: \'#9ca3af\', fontWeight: 600 }}>{child.group_name || \'—\'}</span>}
          </div>
        </div>
        {hasAlert && (
          <div style={{ display: \'flex\', flexDirection: \'column\', gap: 3, flexShrink: 0 }}>
            {child.allergies && <span style={{ background: \'#FFF0E0\', color: \'#B85C00\', borderRadius: 99, padding: \'2px 7px\', fontSize: 9, fontWeight: 800 }}>⚠ ALLERGY</span>}
            {child.medical_notes && <span style={{ background: \'#FFF0F0\', color: \'#C00\', borderRadius: 99, padding: \'2px 7px\', fontSize: 9, fontWeight: 800 }}>+ MEDICAL</span>}
          </div>
        )}
      </button>
      <div style={{ width: 52, borderRadius: 12, background: badgeConfig.bg, color: \'#fff\', display: \'flex\', flexDirection: \'column\', alignItems: \'center\', justifyContent: \'center\', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>{badgeConfig.icon}</span>
        <span style={{ fontSize: 9, fontWeight: 800 }}>{badgeConfig.label}</span>
      </div>
    </div>
  )
}

// ─── CHILD MODAL ─────────────────────────────────────────────
function ChildModal({ child, status, attendanceRecord, bubble, onClose, onUpdateStatus }) {
  const name = `${child.first_name} ${child.last_name}`
  const [absenceReason, setAbsenceReason] = useState(\'\')
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), \'HH:mm\') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), \'HH:mm\') : null
  const hasAlerts = child.allergies || child.medical_notes || child.sen

  const handleAction = (newStatus) => {
    onUpdateStatus(child.id, newStatus, newStatus === \'absent\' ? { absence_reason: absenceReason } : {})
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: \'fixed\', inset: 0, background: \'rgba(0,0,0,0.5)\', zIndex: 600, display: \'flex\', alignItems: \'center\', justifyContent: \'center\', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: \'#fff\', borderRadius: 24, width: \'100%\', maxWidth: 420, maxHeight: \'88vh\', overflowY: \'auto\', boxShadow: \'0 25px 60px rgba(0,0,0,0.3)\', paddingBottom: 24 }}>
        <div style={{ background: `linear-gradient(135deg, ${bubble?.color || \'#1B9AAA\'}, ${bubble?.dark || \'#0D6B78\'})`, margin: \'0 0 0\', padding: \'24px 18px 20px\', textAlign: \'center\', position: \'relative\' }}>
          <button onClick={onClose} style={{ position: \'absolute\', top: 12, right: 12, width: 28, height: 28, borderRadius: \'50%\', background: \'rgba(255,255,255,0.2)\', border: \'none\', cursor: \'pointer\', color: \'#fff\', fontSize: 16, display: \'flex\', alignItems: \'center\', justifyContent: \'center\' }}>×</button>
          <div style={{ width: 72, height: 72, borderRadius: \'50%\', background: \'rgba(255,255,255,0.2)\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: 22, fontWeight: 900, color: \'#fff\', margin: \'0 auto 12px\', overflow: \'hidden\', border: \'3px solid rgba(255,255,255,0.4)\' }}>
            {child.photo_url ? <img src={child.photo_url} alt={name} style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: \'#fff\', marginBottom: 6 }}>{name}</div>
          <div style={{ display: \'flex\', justifyContent: \'center\', gap: 8, flexWrap: \'wrap\' }}>
            {bubble && <span style={{ background: \'rgba(255,255,255,0.2)\', color: \'#fff\', borderRadius: 20, padding: \'3px 10px\', fontSize: 11, fontWeight: 700 }}>{bubble.label}</span>}
            {signedInTime && <span style={{ background: \'rgba(255,255,255,0.2)\', color: \'#fff\', borderRadius: 20, padding: \'3px 10px\', fontSize: 11, fontWeight: 700 }}>In {signedInTime}</span>}
            {signedOutTime && <span style={{ background: \'rgba(255,255,255,0.2)\', color: \'#fff\', borderRadius: 20, padding: \'3px 10px\', fontSize: 11, fontWeight: 700 }}>Out {signedOutTime}</span>}
          </div>
        </div>

        <div style={{ padding: \'16px 18px 0\' }}>
          {hasAlerts && (
            <div style={{ background: \'#FFF0F0\', border: \'1.5px solid #FFD0D0\', borderRadius: 12, padding: \'12px 14px\', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: \'#C00\', marginBottom: 6 }}>⚠ Alerts</div>
              {child.allergies && <div style={{ fontSize: 13, fontWeight: 600, color: \'#C00\', marginBottom: 4 }}>Dietary: {child.allergies}</div>}
              {child.medical_notes && <div style={{ fontSize: 13, fontWeight: 600, color: \'#C00\', marginBottom: 4 }}>Medical: {child.medical_notes}</div>}
              {child.sen && <div style={{ fontSize: 13, fontWeight: 600, color: \'#C00\' }}>SEN: {child.sen}</div>}
            </div>
          )}

          {child.emergency_contact_name && (
            <div style={{ background: \'#EEF4FF\', border: \'1.5px solid #C0D8FF\', borderRadius: 12, padding: \'12px 14px\', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: \'#1A3A8B\', marginBottom: 6 }}>📞 Emergency Contact</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{child.emergency_contact_name}</div>
              {child.emergency_contact_phone && <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 14, fontWeight: 700, color: \'#1B9AAA\', textDecoration: \'none\' }}>{child.emergency_contact_phone}</a>}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 800, color: \'#6b7280\', textTransform: \'uppercase\', letterSpacing: 0.5, marginBottom: 10 }}>Update Status</div>
          <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10, marginBottom: 10 }}>
            <button onClick={() => handleAction(\'signed_in\')} disabled={status === \'signed_in\'}
              style={{ padding: \'14px\', borderRadius: 12, border: \'none\', background: status === \'signed_in\' ? \'#EDFAED\' : \'#417505\', color: status === \'signed_in\' ? \'#417505\' : \'#fff\', fontWeight: 800, fontSize: 14, cursor: status === \'signed_in\' ? \'default\' : \'pointer\' }}>
              {status === \'signed_in\' ? \'✓ Signed In\' : \'Sign In\'}
            </button>
            <button onClick={() => handleAction(\'signed_out\')} disabled={status === \'signed_out\' || status === \'expected\' || !status}
              style={{ padding: \'14px\', borderRadius: 12, border: \'none\', background: status === \'signed_out\' ? \'#EEF4FF\' : \'#1B9AAA\', color: status === \'signed_out\' ? \'#1B9AAA\' : \'#fff\', fontWeight: 800, fontSize: 14, cursor: (status === \'signed_out\' || !status) ? \'default\' : \'pointer\', opacity: (!status || status === \'expected\') ? 0.4 : 1 }}>
              {status === \'signed_out\' ? \'✓ Signed Out\' : \'Sign Out\'}
            </button>
          </div>
          <input placeholder="Absence reason (optional)" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
            style={{ width: \'100%\', padding: \'10px 12px\', borderRadius: 10, border: \'1.5px solid #e5e7eb\', fontSize: 13, marginBottom: 10, boxSizing: \'border-box\', outline: \'none\' }} />
          <button onClick={() => handleAction(\'absent\')}
            style={{ width: \'100%\', padding: \'12px\', borderRadius: 12, border: \'1.5px solid #e5e7eb\', background: \'#fff\', color: \'#6b7280\', fontWeight: 800, fontSize: 13, cursor: \'pointer\' }}>
            Mark Absent
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ADD CHILD MODAL ─────────────────────────────────────────
function AddChildModal({ orgId, bubbles, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: \'\', last_name: \'\', date_of_birth: \'\', group_name: bubbles[0]?.label || \'\', allergies: \'\', medical_notes: \'\', emergency_contact_name: \'\', emergency_contact_phone: \'\' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(\'\')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError(\'First and last name required.\'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from(\'children\').insert([{ ...form, org_id: orgId, active: true, date_of_birth: form.date_of_birth || null, allergies: form.allergies || null, medical_notes: form.medical_notes || null }]).select().single()
    if (err) { setError(err.message); setSaving(false) } else { onAdded(data); onClose() }
  }

  const inp = { width: \'100%\', padding: \'10px 12px\', borderRadius: 10, border: \'1.5px solid #e5e7eb\', fontSize: 13, marginBottom: 10, outline: \'none\', boxSizing: \'border-box\' }
  const lbl = { fontSize: 11, fontWeight: 700, color: \'#6b7280\', textTransform: \'uppercase\', letterSpacing: 0.5, display: \'block\', marginBottom: 4 }

  return (
    <div onClick={onClose} style={{ position: \'fixed\', inset: 0, background: \'rgba(0,0,0,0.5)\', zIndex: 700, display: \'flex\', alignItems: \'center\', justifyContent: \'center\', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: \'#fff\', borderRadius: 24, width: \'100%\', maxWidth: 420, maxHeight: \'88vh\', overflowY: \'auto\', paddingBottom: 24 }}>
        <div style={{ padding: \'18px 20px 12px\', borderBottom: \'1px solid #e5e7eb\', display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>Add Child</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: \'50%\', background: \'#f3f4f6\', border: \'none\', cursor: \'pointer\', fontSize: 18, color: \'#6b7280\' }}>×</button>
        </div>
        <div style={{ padding: \'16px 20px 0\' }}>
          {error && <div style={{ background: \'#FFF0F0\', borderRadius: 10, padding: \'10px 12px\', marginBottom: 12, fontSize: 13, color: \'#C00\', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10 }}>
            <div><label style={lbl}>First Name *</label><input style={inp} value={form.first_name} onChange={e => set(\'first_name\', e.target.value)} placeholder="Amira" /></div>
            <div><label style={lbl}>Last Name *</label><input style={inp} value={form.last_name} onChange={e => set(\'last_name\', e.target.value)} placeholder="Khan" /></div>
          </div>
          <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10 }}>
            <div><label style={lbl}>Date of Birth</label><input style={inp} type="date" value={form.date_of_birth} onChange={e => set(\'date_of_birth\', e.target.value)} /></div>
            <div><label style={lbl}>Group / Bubble</label>
              <select style={{ ...inp, background: \'#fff\' }} value={form.group_name} onChange={e => set(\'group_name\', e.target.value)}>
                {bubbles.map(b => <option key={b.key} value={b.label}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <label style={lbl}>Dietary / Allergy Notes</label>
          <input style={inp} value={form.allergies} onChange={e => set(\'allergies\', e.target.value)} placeholder="e.g. Nut allergy, Halal" />
          <label style={lbl}>Medical Notes</label>
          <input style={inp} value={form.medical_notes} onChange={e => set(\'medical_notes\', e.target.value)} placeholder="e.g. Asthma — inhaler with staff" />
          <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10 }}>
            <div><label style={lbl}>Emergency Contact</label><input style={inp} value={form.emergency_contact_name} onChange={e => set(\'emergency_contact_name\', e.target.value)} placeholder="Name" /></div>
            <div><label style={lbl}>Phone</label><input style={{ ...inp, marginBottom: 0 }} value={form.emergency_contact_phone} onChange={e => set(\'emergency_contact_phone\', e.target.value)} placeholder="07700..." /></div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: \'100%\', marginTop: 16, background: \'#1B9AAA\', color: \'#fff\', border: \'none\', borderRadius: 12, padding: \'14px\', fontSize: 14, fontWeight: 800, cursor: \'pointer\', opacity: saving ? 0.7 : 1 }}>
            {saving ? \'Saving...\' : \'Add Child\'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN REGISTERS ──────────────────────────────────────────
export default function Registers({ org, session: authSession }) {
  const orgId = org?.id
  const primary = org?.primary_color || \'#1B9AAA\'
  const bubbles = org?.bubbles || DEFAULT_BUBBLES

  const { sessions: todaySessions, session } = useTodaySession(orgId)
  const { children, setChildren, loading } = useChildren(orgId)
  const { attendance, updateStatus } = useAttendance(session?.id)

  const [mainTab, setMainTab] = useState(\'all\')
  const [activeBubble, setActiveBubble] = useState(\'all\')
  const [statusFilter, setStatusFilter] = useState(\'all\')
  const [search, setSearch] = useState(\'\')
  const [selectedChild, setSelectedChild] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const getAttRec = (childId) => attendance.find(a => a.child_id === childId)
  const getStatus = (childId) => getAttRec(childId)?.status || \'unmarked\'
  const getBubble = (child) => bubbles.find(b => {
    const g = (child.group_name || \'\').toLowerCase()
    return g === b.key || g === b.label.toLowerCase()
  }) || bubbles[0]

  const handleUpdateStatus = async (childId, status, extra = {}) => {
    const existing = attendance.find(a => a.child_id === childId)
    const now = new Date().toISOString()
    if (existing) {
      const updates = { status, ...extra }
      if (status === \'signed_in\' && !existing.signed_in_at) updates.signed_in_at = now
      if (status === \'signed_out\') updates.signed_out_at = now
      await updateStatus(existing.id, status, updates)
    } else if (session?.id) {
      const updates = { status, ...extra }
      if (status === \'signed_in\') updates.signed_in_at = now
      await supabase.from(\'attendance\').insert([{ session_id: session.id, child_id: childId, org_id: orgId, ...updates }])
    }
  }

  const filtered = children.filter(c => {
    const nameOk = !search.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const statusOk = statusFilter === \'all\' || getStatus(c.id) === statusFilter
    const bubbleOk = activeBubble === \'all\' || mainTab !== \'bubbles\' || (() => {
      const g = (c.group_name || \'\').toLowerCase()
      const b = bubbles.find(b => b.key === activeBubble)
      return b && (g === b.key || g === b.label.toLowerCase())
    })()
    return nameOk && statusOk && bubbleOk
  })

  const counts = {
    total: children.length,
    signed_in: children.filter(c => getStatus(c.id) === \'signed_in\').length,
    expected: children.filter(c => getStatus(c.id) === \'expected\').length,
    absent: children.filter(c => getStatus(c.id) === \'absent\').length,
    signed_out: children.filter(c => getStatus(c.id) === \'signed_out\').length,
  }

  const today = new Date().toLocaleDateString(\'en-GB\', { weekday: \'long\', day: \'numeric\', month: \'long\' })

  return (
    <div style={{ display: \'flex\', flexDirection: \'column\', height: \'100%\', overflow: \'hidden\' }}>

      {/* SESSION HERO */}
      <div style={{ background: \'#0D1B2A\', padding: \'14px 20px\', flexShrink: 0 }}>
        <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'flex-start\' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: primary, textTransform: \'uppercase\', letterSpacing: 1.5, marginBottom: 6, display: \'flex\', alignItems: \'center\', gap: 6 }}>
              {session ? <><div style={{ width: 6, height: 6, borderRadius: \'50%\', background: \'#4ADE80\' }} />Session Live</> : \'No Session Today\'}
            </div>
            {session ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 900, color: \'#fff\', marginBottom: 4 }}>{session.title}</div>
                <div style={{ fontSize: 12, color: \'rgba(255,255,255,0.6)\', fontWeight: 600 }}>
                  {session.start_time}{session.end_time ? \' – \' + session.end_time : \'\'}
                  {session.location ? \' · \' + session.location.split(\',\')[0] : \'\'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: \'rgba(255,255,255,0.5)\', fontWeight: 600 }}>No sessions scheduled</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: \'rgba(255,255,255,0.4)\', fontWeight: 600, textAlign: \'right\' }}>{today}</div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: \'flex\', background: \'#fff\', borderBottom: \'2px solid #e5e7eb\', flexShrink: 0 }}>
        {[{ key: \'all\', label: \'All Children\' }, { key: \'bubbles\', label: \'Bubbles\' }].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            style={{ flex: 1, padding: \'12px 8px\', border: \'none\', background: \'transparent\', borderBottom: mainTab === t.key ? `2px solid ${primary}` : \'2px solid transparent\', marginBottom: -2, color: mainTab === t.key ? primary : \'#9ca3af\', fontWeight: 800, fontSize: 13, cursor: \'pointer\' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BUBBLE TABS */}
      {mainTab === \'bubbles\' && (
        <div style={{ display: \'flex\', gap: 8, overflowX: \'auto\', padding: \'10px 16px\', background: \'#fff\', borderBottom: \'1px solid #e5e7eb\', flexShrink: 0, scrollbarWidth: \'none\' }}>
          <button onClick={() => setActiveBubble(\'all\')} style={{ padding: \'6px 14px\', borderRadius: 20, border: \'none\', background: activeBubble === \'all\' ? \'#1A1A1A\' : \'#F5F5F5\', color: activeBubble === \'all\' ? \'#fff\' : \'#555\', fontWeight: 800, fontSize: 12, cursor: \'pointer\', whiteSpace: \'nowrap\', flexShrink: 0 }}>All</button>
          {bubbles.map(b => (
            <button key={b.key} onClick={() => setActiveBubble(b.key)} style={{ padding: \'6px 14px\', borderRadius: 20, border: \'none\', background: activeBubble === b.key ? b.color : b.light, color: activeBubble === b.key ? \'#fff\' : b.dark, fontWeight: 800, fontSize: 12, cursor: \'pointer\', whiteSpace: \'nowrap\', flexShrink: 0, display: \'flex\', alignItems: \'center\', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: \'50%\', background: activeBubble === b.key ? \'#fff\' : b.color }} />{b.label}
            </button>
          ))}
        </div>
      )}

      {/* STAT BAR */}
      <StatBar counts={counts} onFilterChange={setStatusFilter} activeFilter={statusFilter} primary={primary} />

      {/* SEARCH */}
      <div style={{ padding: \'10px 16px\', background: \'#fff\', borderBottom: \'1px solid #e5e7eb\', flexShrink: 0 }}>
        <div style={{ position: \'relative\' }}>
          <span style={{ position: \'absolute\', left: 12, top: \'50%\', transform: \'translateY(-50%)\', fontSize: 14, color: \'#9ca3af\' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
            style={{ width: \'100%\', padding: \'9px 12px 9px 36px\', borderRadius: 10, border: \'1.5px solid #e5e7eb\', fontSize: 13, outline: \'none\', boxSizing: \'border-box\', background: \'#f9fafb\' }} />
          {search && <button onClick={() => setSearch(\'\')} style={{ position: \'absolute\', right: 10, top: \'50%\', transform: \'translateY(-50%)\', background: \'none\', border: \'none\', cursor: \'pointer\', color: \'#9ca3af\', fontSize: 16 }}>×</button>}
        </div>
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: \'auto\', padding: \'12px 16px\' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: \'#9ca3af\', textTransform: \'uppercase\', letterSpacing: 0.5, marginBottom: 10 }}>
          {filtered.length} {filtered.length === 1 ? \'child\' : \'children\'}{search ? ` matching "${search}"` : \'\'}
        </div>
        {loading ? (
          <div style={{ display: \'flex\', alignItems: \'center\', justifyContent: \'center\', padding: 40, color: \'#9ca3af\' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: \'center\', padding: \'32px 20px\', color: \'#9ca3af\' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👧</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{children.length === 0 ? \'No children yet\' : \'No matches\'}</div>
            {children.length === 0 && <button onClick={() => setShowAdd(true)} style={{ marginTop: 12, background: primary, color: \'#fff\', border: \'none\', borderRadius: 10, padding: \'10px 20px\', fontSize: 13, fontWeight: 800, cursor: \'pointer\' }}>+ Add First Child</button>}
          </div>
        ) : filtered.map(child => (
          <ChildRow
            key={child.id}
            child={child}
            status={getStatus(child.id)}
            attendanceRecord={getAttRec(child.id)}
            bubble={getBubble(child)}
            onTap={(c, s, r) => setSelectedChild({ child: c, status: s, attRec: r })}
          />
        ))}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} style={{ position: \'fixed\', bottom: 24, right: 24, width: 52, height: 52, borderRadius: \'50%\', background: primary, color: \'#fff\', border: \'none\', fontSize: 26, cursor: \'pointer\', boxShadow: \'0 4px 16px rgba(0,0,0,0.25)\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', zIndex: 100 }}>+</button>

      {selectedChild && (
        <ChildModal
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
        />
      )}
      {showAdd && <AddChildModal orgId={orgId} bubbles={bubbles} onClose={() => setShowAdd(false)} onAdded={child => { setChildren(prev => [...prev, child]); setShowAdd(false) }} />}
    </div>
  )
}

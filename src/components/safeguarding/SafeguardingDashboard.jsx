import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import SignedImg from '../shared/SignedImg'
import { signOne } from '../../lib/storageUrl'

const PRIMARY = '#DC2626' // safeguarding stays red-branded regardless of org colour — deliberate, signals seriousness

const STATUS_COLORS = {
  open:        { bg: 'rgba(239,68,68,0.1)',   color: '#EF4444', label: 'Open' },
  in_progress: { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', label: 'In Progress' },
  resolved:    { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E', label: 'Resolved' },
  closed:      { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Closed' },
}

const PRIORITY_COLORS = {
  urgent: { bg: 'rgba(239,68,68,0.12)', color: '#DC2626', label: 'Urgent' },
  high:   { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'High' },
  medium: { bg: 'rgba(59,130,246,0.12)', color: '#2563EB', label: 'Medium' },
  low:    { bg: 'rgba(100,116,139,0.12)', color: '#64748B', label: 'Low' },
}

const MOODS = [
  { key: 'happy',   emoji: '😊', label: 'Happy',   color: '#22C55E' },
  { key: 'settled',  emoji: '🙂', label: 'Settled',  color: '#3B82F6' },
  { key: 'quiet',    emoji: '😐', label: 'Quiet',    color: '#64748B' },
  { key: 'worried',  emoji: '😟', label: 'Worried',  color: '#F59E0B' },
  { key: 'upset',    emoji: '😢', label: 'Upset',    color: '#EF4444' },
]

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }

function timeAgo(ts) {
  const diffMs = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

async function logAudit(orgId, caseId, eventType, detail, userId) {
  await supabase.from('safeguarding_audit_log').insert({ org_id: orgId, case_id: caseId, event_type: eventType, detail, performed_by: userId })
}

// ── CASE DETAIL MODAL ─────────────────────────────────────────
function CaseDetailModal({ c, onClose, onStatusChange, orgId, userId, onNavigate }) {
  // Who a concern can be assigned to. Safeguarding work sits with staff, so
  // volunteers and parents are not offered.
  const isNarrow = useIsMobile()
  const [staff, setStaff] = useState([])
  useEffect(() => {
    let cancelled = false
    supabase.from('user_profiles').select('id, email, role').eq('org_id', orgId)
      .in('role', ['owner', 'admin', 'manager', 'staff'])
      .then(({ data }) => { if (!cancelled) setStaff(data || []) })
    return () => { cancelled = true }
  }, [orgId])

  const [status, setStatus] = useState(c.status)
  const [notes, setNotes] = useState(c.resolution_notes || '')
  const [assignedTo, setAssignedTo] = useState(c.assigned_to || '')
  const [followUp, setFollowUp] = useState(!!c.follow_up_required)
  const [followUpDue, setFollowUpDue] = useState(c.follow_up_due || '')
  const [dslNotified, setDslNotified] = useState(!!c.dsl_notified)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [escalating, setEscalating] = useState(false)

  const isClosing = (st) => st === 'resolved' || st === 'closed'

  const handleSave = async () => {
    // A concern cannot be closed on nothing. The whole point of the resolution
    // note is that someone can later say why this was considered dealt with.
    if (isClosing(status) && !isClosing(c.status) && !notes.trim()) {
      setSaveError('Add a resolution note before closing this concern.')
      return
    }
    if (followUp && !followUpDue) {
      setSaveError('A follow-up needs a date, otherwise nothing can ever chase it.')
      return
    }
    setSaving(true)
    setSaveError('')
    const update = {
      status,
      resolution_notes: notes,
      assigned_to: assignedTo || null,
      follow_up_required: followUp,
      follow_up_due: followUp ? (followUpDue || null) : null,
      dsl_notified: dslNotified,
      updated_at: new Date().toISOString(),
    }
    // Both closing states stamp the closure. Previously only 'resolved' set
    // resolved_at, so every concern closed as 'closed' left no record of when
    // it happened or who did it -- which is exactly what an inspection asks
    // for, and why the Resolved counter read zero against five closed rows.
    if (isClosing(status) && !isClosing(c.status)) {
      update.closed_at = new Date().toISOString()
      update.closed_by = userId || null
      if (status === 'resolved') { update.resolved_at = update.closed_at; update.resolved_by = userId || null }
    }
    // Reopening clears the closure rather than leaving a stale one behind.
    if (!isClosing(status) && isClosing(c.status)) {
      update.closed_at = null; update.closed_by = null
      update.resolved_at = null; update.resolved_by = null
    }
    // The DSL notification is evidence, so it gets a real timestamp the moment
    // it is ticked. dsl_notified_time was free text and unverifiable.
    if (dslNotified && !c.dsl_notified) {
      update.dsl_notified_at = new Date().toISOString()
      update.dsl_notified_by = userId || null
    }

    const { error } = await supabase.from('cause_for_concern').update(update).eq('id', c.id)
    if (error) {
      setSaving(false)
      setSaveError(error.message)
      return
    }
    if (status !== c.status) {
      await logAudit(orgId, c.id, 'status_change', `Status changed to ${STATUS_COLORS[status]?.label || status}`, userId)
    }
    if ((assignedTo || '') !== (c.assigned_to || '')) {
      const who = staff.find(m => m.id === assignedTo)
      await logAudit(orgId, c.id, 'assignment', assignedTo ? `Assigned to ${who?.email || 'a colleague'}` : 'Assignment cleared', userId)
    }
    if (dslNotified && !c.dsl_notified) {
      await logAudit(orgId, c.id, 'dsl_notified', 'DSL recorded as notified', userId)
    }
    setSaving(false)
    onStatusChange(); onClose()
  }

  const RISK_MAP = { urgent: 'critical', high: 'high', medium: 'medium', low: 'low' }

  const handleEscalate = async () => {
    setEscalating(true)
    // Best-effort match to an existing child record so the case links properly; falls back to name-only.
    const { data: childMatch } = await supabase.from('children').select('id').eq('org_id', orgId)
      .ilike('first_name', (c.child_name || '').split(' ')[0] || '').maybeSingle()
    const { data: newCase, error } = await supabase.from('cases').insert({
      org_id: orgId, child_id: childMatch?.id || null, child_name: c.child_name,
      category: c.concern_type || 'Other', risk_level: RISK_MAP[c.priority] || 'medium',
      summary: c.description, status: 'open', created_by: userId, source_concern_id: c.id,
      requires_dsl: !!c.dsl_notified,
    }).select().single()
    if (error) { setEscalating(false); window.alert('Could not create the case: ' + error.message); return }
    await supabase.from('case_events').insert({
      case_id: newCase.id, org_id: orgId, event_type: 'concern_logged',
      body: `Escalated from a safeguarding concern reported ${new Date(c.created_at).toLocaleDateString('en-GB')}.`, created_by: userId,
    })
    await supabase.from('cause_for_concern').update({ escalated_to_case_id: newCase.id }).eq('id', c.id)
    await logAudit(orgId, c.id, 'escalated', 'Escalated to Case Management', userId)
    setEscalating(false)
    onStatusChange()
    onClose()
    if (onNavigate) onNavigate('case_management', { openCaseId: newCase.id })
  }

  const Row = ({ label, value }) => value ? (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{value}</div>
    </div>
  ) : null

  const Badge = ({ show, label }) => show ? (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 999, marginRight: 6 }}>{label}</span>
  ) : null

  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(680px,94vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: sc.color, background: sc.bg, padding: '3px 10px', borderRadius: 999 }}>{sc.label}</span>
              {c.priority && (
                <span style={{ fontSize: 10, fontWeight: 900, color: (PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.medium).color, background: (PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.medium).bg, padding: '3px 10px', borderRadius: 999 }}>
                  {(PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.medium).label}
                </span>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Case #{c.id.slice(-6).toUpperCase()}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Submitted {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <Row label="Submitted by" value={c.submitter_name} />
          <Row label="Date of incident" value={c.date_of_incident ? new Date(c.date_of_incident).toLocaleDateString('en-GB') : null} />
          <Row label="People involved" value={c.child_name} />
          <Row label="Location" value={c.location} />
          <Row label="Concern type" value={c.concern_type} />
        </div>
        <Row label="Description" value={c.description} />
        {c.witnesses && <Row label="Witnesses / CP co-ordinator" value={c.witnesses} />}
        {c.action_taken && <Row label="Immediate action taken" value={c.action_taken} />}

        <div style={{ background: 'rgba(245,208,0,0.06)', borderRadius: 12, padding: 16, border: '1px solid rgba(245,208,0,0.2)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#856404', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Action Plan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <Badge show={c.dsl_notified} label={'DSL Notified' + (c.dsl_notified_name ? ': ' + c.dsl_notified_name : '')} />
            <Badge show={c.parents_notified} label="Parents Notified" />
            <Badge show={c.police_notified} label={'Police/Agency' + (c.police_reference ? ': ' + c.police_reference : '')} />
            <Badge show={c.follow_up_required} label="Follow-up Required" />
            {!c.dsl_notified && !c.parents_notified && !c.police_notified && !c.follow_up_required && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>No actions recorded at time of submission.</span>
            )}
          </div>
          {c.follow_up_details && <Row label="Follow-up details" value={c.follow_up_details} />}
          {c.action_plan_notes && <Row label="Additional DSL notes" value={c.action_plan_notes} />}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Update Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.entries(STATUS_COLORS).map(([key, val]) => (
              <button key={key} onClick={() => setStatus(key)} style={{ padding: '7px 14px', borderRadius: 999, border: status === key ? '2px solid ' + val.color : '1px solid var(--border)', background: status === key ? val.bg : 'transparent', color: status === key ? val.color : 'var(--text3)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{val.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Assigned to</div>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Nobody — unassigned</option>
                {staff.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
              </select>
              {!assignedTo && (
                <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 5 }}>An unassigned concern has nobody to chase it.</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Follow-up</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} />
                Follow-up required
              </label>
              {followUp && (
                <input type="date" value={followUpDue || ''} onChange={e => setFollowUpDue(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              )}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={dslNotified} onChange={e => setDslNotified(e.target.checked)} />
            Designated Safeguarding Lead has been notified
            {c.dsl_notified_at && (
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                — recorded {new Date(c.dsl_notified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </label>

          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Resolution / Case Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add resolution notes, outcomes, or case updates..." style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 90, boxSizing: 'border-box' }} />

          {(c.closed_at || (isClosing(c.status) && !c.closed_at)) && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              {c.closed_at
                ? `Closed ${new Date(c.closed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Closed before closure dates were recorded — date not known.'}
            </div>
          )}

          {saveError && (
            <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#B91C1C', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 600 }}>
              {saveError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {c.escalated_to_case_id ? (
            <button onClick={() => { onClose(); onNavigate && onNavigate('case_management', { openCaseId: c.escalated_to_case_id }) }}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: PRIMARY, fontWeight: 800, cursor: 'pointer' }}>
              📁 View linked case →
            </button>
          ) : (
            <button onClick={handleEscalate} disabled={escalating}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 800, cursor: escalating ? 'default' : 'pointer', opacity: escalating ? 0.6 : 1 }}>
              {escalating ? 'Escalating…' : '📁 Escalate to Case →'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? 'rgba(37,99,235,0.4)' : 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── CASES TAB ─────────────────────────────────────────
function CasesTab({ cases, loading, filter, setFilter, onSelect, isMobile }) {
  const [search, setSearch] = useState('')
  const byFilter = filter === 'all' ? cases
    : filter === 'follow_up' ? cases.filter(c => c.follow_up_required && c.status !== 'resolved' && c.status !== 'closed')
    : cases.filter(c => c.status === filter)
  const q = search.trim().toLowerCase()
  const filtered = q ? byFilter.filter(c => (c.child_name || '').toLowerCase().includes(q) || (c.concern_type || '').toLowerCase().includes(q)) : byFilter

  const counts = {
    all: cases.length,
    open: cases.filter(c => c.status === 'open').length,
    follow_up: cases.filter(c => c.follow_up_required && c.status !== 'resolved' && c.status !== 'closed').length,
    resolved: cases.filter(c => c.status === 'resolved').length,
    closed: cases.filter(c => c.status === 'closed').length,
  }

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by child or concern type..."
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['open', 'Open'], ['follow_up', 'Follow-up'], ['resolved', 'Resolved'], ['closed', 'Closed']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ padding: '7px 14px', borderRadius: 999, border: filter === key ? '1px solid #2563EB' : '1px solid var(--border)', background: filter === key ? 'rgba(37,99,235,0.1)' : 'transparent', color: filter === key ? '#3B82F6' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label} ({counts[key]})</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading cases...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', ...card, borderStyle: 'dashed' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Everything looks good today.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>No safeguarding concerns are currently open.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open
            const pc = PRIORITY_COLORS[c.priority] || null
            return (
              <button key={c.id} onClick={() => onSelect(c)}
                style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 20px -12px rgba(0,0,0,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 10, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>👧</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.child_name} <span style={{ fontWeight: 600, color: 'var(--text3)' }}>· {c.concern_type || 'Concern'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 7px', borderRadius: 999 }}>{sc.label}</span>
                    {pc && <span style={{ fontSize: 10.5, fontWeight: 700, color: pc.color, background: pc.bg, padding: '2px 7px', borderRadius: 999 }}>{pc.label}</span>}
                    {c.follow_up_required && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B' }}>· Follow-up</span>}
                    <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>· {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: PRIMARY, flexShrink: 0, whiteSpace: 'nowrap' }}>View →</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── WELLBEING QUICK-LOG ─────────────────────────────────────────
function WellbeingQuickLog({ child, orgId, userId, onClose, onLogged }) {
  const [mood, setMood] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!mood) return
    setSaving(true)
    const { error } = await supabase.from('wellbeing_checks').insert({ org_id: orgId, child_id: child.id, mood, note: note.trim() || null, logged_by: userId })
    setSaving(false)
    if (!error) { onLogged(); onClose() }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(420px,92vw)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: 24, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 2 }}>How's {child.first_name} today?</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>Quick wellbeing check — takes 5 seconds.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {MOODS.map(m => (
            <button key={m.key} onClick={() => setMood(m.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 4px', borderRadius: 14, border: mood === m.key ? `2px solid ${m.color}` : '1.5px solid var(--border)', background: mood === m.key ? m.color + '15' : 'transparent', cursor: 'pointer' }}>
              <span style={{ fontSize: 24 }}>{m.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: mood === m.key ? m.color : 'var(--text3)' }}>{m.label}</span>
            </button>
          ))}
        </div>

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box', marginBottom: 18 }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={!mood || saving} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: !mood || saving ? '#E5E7EB' : PRIMARY, color: !mood || saving ? '#9CA3AF' : '#fff', fontWeight: 800, cursor: !mood || saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Log Check-in'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── CHILDREN TAB ─────────────────────────────────────────
function ChildrenTab({ org, cases, isMobile }) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [wellbeingChild, setWellbeingChild] = useState(null)
  const [recentChecks, setRecentChecks] = useState({})

  const load = useCallback(() => {
    supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name').then(({ data }) => {
      setChildren(data || [])
      setLoading(false)
    })
    supabase.from('wellbeing_checks').select('child_id, mood, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(200).then(({ data }) => {
      const latest = {}
      ;(data || []).forEach(w => { if (!latest[w.child_id]) latest[w.child_id] = w })
      setRecentChecks(latest)
    })
  }, [org.id])

  useEffect(() => { load() }, [load])

  // Counted by child_id where the concern is linked, falling back to the
  // recorded name for older records that predate the link. Matching on name
  // alone meant a concern filed as "Jineen Osman " or "jineen osman" counted
  // against a different person than the register knew about -- and a child's
  // concern history is the one thing here that must not fragment.
  const concernCountsById = {}
  const concernCountsByName = {}
  cases.forEach(c => {
    if (c.child_id) concernCountsById[c.child_id] = (concernCountsById[c.child_id] || 0) + 1
    else if (c.child_name) {
      const k = c.child_name.trim().toLowerCase()
      concernCountsByName[k] = (concernCountsByName[k] || 0) + 1
    }
  })
  const concernsFor = (ch) => (concernCountsById[ch.id] || 0)
    + (concernCountsByName[`${ch.first_name} ${ch.last_name}`.trim().toLowerCase()] || 0)

  const filtered = children.filter(c => !search || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()))

  const age = dob => {
    if (!dob) return null
    const d = new Date(dob)
    const diff = Date.now() - d.getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search children..."
        style={{ width: '100%', maxWidth: 340, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', marginBottom: 18, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', ...card, borderStyle: 'dashed' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🧒</div>
          <div style={{ fontWeight: 800, color: 'var(--text)' }}>No children found</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(c => {
            const lastCheck = recentChecks[c.id]
            const moodMeta = lastCheck ? MOODS.find(m => m.key === lastCheck.mood) : null
            return (
              <div key={c.id} style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: PRIMARY, flexShrink: 0, overflow: 'hidden' }}>
                    {c.photo_url ? <SignedImg bucket="gallery" src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.first_name?.[0] || '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{age(c.date_of_birth) != null ? `${age(c.date_of_birth)} years old` : 'Age unknown'}</div>
                  </div>
                  {moodMeta && (
                    <span title={`Last check: ${moodMeta.label}, ${timeAgo(lastCheck.created_at)}`} style={{ fontSize: 20 }}>{moodMeta.emoji}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.allergies && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 8px', borderRadius: 999 }}>⚠️ Allergies</span>}
                  {c.has_epipen && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 8px', borderRadius: 999 }}>💉 EpiPen</span>}
                  {c.has_asthma && <span style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.1)', padding: '2px 8px', borderRadius: 999 }}>🫁 Asthma</span>}
                  {c.has_diabetes && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 999 }}>💊 Diabetes</span>}
                  {c.has_behaviour_plan && <span style={{ fontSize: 10, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 999 }}>📋 Behaviour Plan</span>}
                  {c.sen && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.1)', padding: '2px 8px', borderRadius: 999 }}>SEN</span>}
                </div>

                {concernsFor(c) > 0 && (
                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>{concernsFor(c)} concern{concernsFor(c) === 1 ? '' : 's'} on file</div>
                )}

                <button onClick={() => setWellbeingChild(c)} style={{ marginTop: 4, padding: '9px 12px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  💬 Wellbeing Check-in
                </button>
              </div>
            )
          })}
        </div>
      )}

      {wellbeingChild && (
        <WellbeingQuickLog child={wellbeingChild} orgId={org.id} userId={org._sessionUserId}
          onClose={() => setWellbeingChild(null)} onLogged={load} />
      )}
    </div>
  )
}

// ── MEDICAL TAB ─────────────────────────────────────────
function MedicalTab({ org, isMobile }) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterFlag, setFilterFlag] = useState('all')

  useEffect(() => {
    supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name').then(({ data }) => {
      setChildren(data || [])
      setLoading(false)
    })
  }, [org.id])

  const flags = [
    ['all', 'All', null],
    ['allergies', 'Allergies', c => !!c.allergies],
    ['has_medication', 'Medication', c => c.has_medication],
    ['has_asthma', 'Asthma', c => c.has_asthma],
    ['has_epipen', 'EpiPens', c => c.has_epipen],
    ['has_diabetes', 'Diabetes', c => c.has_diabetes],
  ]

  const active = flags.find(f => f[0] === filterFlag)
  const filtered = active && active[2] ? children.filter(active[2]) : children
  const withMedical = children.filter(c => c.allergies || c.medical_notes || c.has_medication || c.has_asthma || c.has_epipen || c.has_diabetes)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {flags.map(([key, label]) => (
          <button key={key} onClick={() => setFilterFlag(key)} style={{ padding: '7px 16px', borderRadius: 999, border: filterFlag === key ? '1px solid #DC2626' : '1px solid var(--border)', background: filterFlag === key ? 'rgba(220,38,38,0.08)' : 'transparent', color: filterFlag === key ? '#DC2626' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
      ) : (filterFlag === 'all' ? withMedical : filtered).length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', ...card, borderStyle: 'dashed' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>❤️</div>
          <div style={{ fontWeight: 800, color: 'var(--text)' }}>No medical records match this filter</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(filterFlag === 'all' ? withMedical : filtered).map(c => (
            <div key={c.id} style={{ ...card, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: PRIMARY + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: PRIMARY, flexShrink: 0 }}>
                {c.first_name?.[0] || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{c.first_name} {c.last_name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {c.has_epipen && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 8px', borderRadius: 999 }}>💉 EpiPen</span>}
                  {c.has_asthma && <span style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.1)', padding: '2px 8px', borderRadius: 999 }}>🫁 Asthma</span>}
                  {c.has_diabetes && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 999 }}>💊 Diabetes</span>}
                  {c.has_medication && <span style={{ fontSize: 10, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 999 }}>💊 Medication</span>}
                </div>
                {c.allergies && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}><b>Allergies:</b> {c.allergies}</div>}
                {c.medical_notes && <div style={{ fontSize: 12, color: 'var(--text2)' }}><b>Notes:</b> {c.medical_notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DOCUMENTS TAB ─────────────────────────────────────────
function DocumentsTab({ org, userId, isMobile }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    supabase.from('safeguarding_documents').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).then(({ data }) => {
      setDocs(data || [])
      setLoading(false)
    })
  }, [org.id])

  useEffect(() => { load() }, [load])

  const handleFiles = async (files) => {
    setError('')
    setUploading(true)
    for (const file of Array.from(files)) {
      const path = `${org.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('safeguarding-docs').upload(path, file)
      if (upErr) { setError(upErr.message); continue }
      await supabase.from('safeguarding_documents').insert({
        org_id: org.id, file_name: file.name, file_path: path, file_type: file.type, uploaded_by: userId,
      })
    }
    setUploading(false)
    load()
  }

  // safeguarding-docs is a private bucket, so getPublicUrl produced a URL that
  // never resolved. Sign on click instead -- a short-lived link, opened once.
  const openDoc = async (e, path) => {
    e.preventDefault()
    const url = await signOne('safeguarding-docs', path, 300)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const fileIcon = (type) => {
    if (type?.includes('pdf')) return '📄'
    if (type?.includes('image')) return '🖼️'
    return '📎'
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        style={{ border: `2px dashed ${dragOver ? PRIMARY : 'var(--border)'}`, borderRadius: 20, padding: isMobile ? '32px 16px' : '48px 24px', textAlign: 'center', marginBottom: 24, background: dragOver ? PRIMARY + '08' : 'var(--surface)', transition: 'all 0.15s' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📤</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Drop files here, or</div>
        <label style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: PRIMARY, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : 'Browse files'}
          <input type="file" multiple hidden onChange={e => handleFiles(e.target.files)} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>PDFs, images, body maps, referral letters, meeting notes</div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
      ) : docs.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)' }}>No documents uploaded yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {docs.map(d => (
            <button key={d.id} type="button" onClick={e => openDoc(e, d.file_path)}
              style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: 22 }}>{fileIcon(d.file_type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(d.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AUDIT LOG TAB ─────────────────────────────────────────
function AuditLogTab({ org }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('safeguarding_audit_log').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setEntries(data || [])
      setLoading(false)
    })
  }, [org.id])

  const eventIcon = (type) => {
    if (type === 'status_change') return '🔄'
    if (type === 'created') return '➕'
    if (type === 'assigned') return '👤'
    if (type === 'contacted') return '📞'
    return '📝'
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
  if (entries.length === 0) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', ...card, borderStyle: 'dashed' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🕐</div>
      <div style={{ fontWeight: 800, color: 'var(--text)' }}>No activity recorded yet</div>
    </div>
  )

  return (
    <div style={{ ...card, padding: 20 }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 14, paddingBottom: i < entries.length - 1 ? 18 : 0, marginBottom: i < entries.length - 1 ? 18 : 0, borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{eventIcon(e.event_type)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{e.detail || e.event_type}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {timeAgo(e.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── SIDEBAR ─────────────────────────────────────────
function Sidebar({ org, cases }) {
  const followUps = cases.filter(c => c.follow_up_required && c.status !== 'resolved' && c.status !== 'closed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>🟠 Today's Follow-Ups</div>
        {followUps.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nothing pending 🎉</div>
        ) : followUps.slice(0, 5).map(c => (
          <div key={c.id} style={{ fontSize: 12, color: 'var(--text)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            {c.child_name} — <span style={{ color: '#F59E0B', fontWeight: 700 }}>{c.follow_up_details ? c.follow_up_details.slice(0, 40) : 'Follow-up due'}</span>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>🛡️ DSL Contact</div>
        {org.dsl_name ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{org.dsl_name}</div>
            {org.dsl_phone && <a href={`tel:${org.dsl_phone}`} style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, textDecoration: 'none', display: 'block' }}>{org.dsl_phone}</a>}
            {org.dsl_email && <a href={`mailto:${org.dsl_email}`} style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', display: 'block' }}>{org.dsl_email}</a>}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Not set — add in Organisation Settings</div>
        )}
      </div>

      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>🚨 Emergency Contacts</div>
        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6 }}><b>Emergency:</b> 999</div>
        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6 }}><b>NSPCC Helpline:</b> 0808 800 5000</div>
        <div style={{ fontSize: 12, color: 'var(--text)' }}><b>Police (non-emergency):</b> 101</div>
      </div>
    </div>
  )
}

// ── EMERGENCY GUIDANCE MODAL ─────────────────────────────────────────
function EmergencyGuidanceModal({ onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(480px,92vw)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: 26, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🚨</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 14 }}>Emergency Guidance</div>
        <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(220,38,38,0.15)', marginBottom: 16 }}>
          <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
            <li>If a child is in immediate danger, call <b>999</b> first.</li>
            <li>Report every concern, no matter how small.</li>
            <li>Do not investigate yourself — pass it to the DSL.</li>
            <li>Do not promise confidentiality to a child.</li>
            <li>Record facts, not opinions or assumptions.</li>
          </ul>
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Close</button>
      </div>
    </>
  )
}

// ── STATUS PILLS ─────────────────────────────────────────
function StatusPills({ stats }) {
  const pills = [
    { icon: '🔴', value: stats.open, label: 'Open', color: '#EF4444' },
    { icon: '🟠', value: stats.followUp, label: 'Follow-ups', color: '#F59E0B' },
    { icon: '✅', value: stats.resolvedThisMonth, label: 'Resolved', color: '#22C55E' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {pills.map(p => (
        <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: p.color, background: `${p.color}12`, border: `1px solid ${p.color}28`, borderRadius: 999, padding: '6px 12px' }}>
          {p.icon} {p.value} {p.label}
        </span>
      ))}
    </div>
  )
}

// ── NEEDS ATTENTION ───────────────────────────────────────────
//
// What an open concern looks like when it has gone wrong. Previously this
// only knew about follow-ups, and follow-ups had no due date, so it could
// only ever say "nothing requires your attention" -- including on a day with
// an unassigned open concern and no DSL notified.
//
// Ordered by how bad it is, not by date: an open concern the DSL has never
// been told about outranks a follow-up that slipped by a day.
export function attentionItems(cases) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOpen = c => c.status !== 'resolved' && c.status !== 'closed'
  const days = ts => Math.floor((today - new Date(ts)) / 86400000)
  const out = []

  for (const c of cases) {
    if (!isOpen(c)) continue
    if (!c.dsl_notified) {
      out.push({ id: c.id + '-dsl', c, rank: 0, title: 'DSL not notified', detail: c.child_name || 'Unnamed concern' })
    }
    if (c.follow_up_required && c.follow_up_due) {
      const due = new Date(c.follow_up_due); due.setHours(0, 0, 0, 0)
      const overdue = Math.floor((today - due) / 86400000)
      if (overdue > 0) out.push({ id: c.id + '-od', c, rank: 1, title: `Follow-up ${overdue} day${overdue === 1 ? '' : 's'} overdue`, detail: c.child_name })
      else if (overdue === 0) out.push({ id: c.id + '-due', c, rank: 2, title: 'Follow-up due today', detail: c.child_name })
    }
    // A follow-up with no date can never come due, so it would otherwise sit
    // silently forever. Surface it as the omission it is.
    if (c.follow_up_required && !c.follow_up_due) {
      out.push({ id: c.id + '-nodate', c, rank: 3, title: 'Follow-up has no date set', detail: c.child_name })
    }
    if (!c.assigned_to) {
      out.push({ id: c.id + '-unassigned', c, rank: 4, title: 'Nobody assigned', detail: c.child_name })
    }
    if (c.created_at && days(c.created_at) >= 14) {
      out.push({ id: c.id + '-stale', c, rank: 5, title: `Open ${days(c.created_at)} days`, detail: c.child_name })
    }
  }
  return out.sort((a, b) => a.rank - b.rank)
}

const ATTENTION_TONE = [
  { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)', color: '#B91C1C', icon: '🚨' },
  { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)', color: '#B91C1C', icon: '⏰' },
  { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.3)', color: '#B45309', icon: '⚠️' },
  { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.3)', color: '#B45309', icon: '⚠️' },
  { bg: 'rgba(100,116,139,0.07)', border: 'rgba(100,116,139,0.28)', color: '#475569', icon: '👤' },
  { bg: 'rgba(100,116,139,0.07)', border: 'rgba(100,116,139,0.28)', color: '#475569', icon: '🕐' },
]

function NeedsAttentionCard({ items, onSelect }) {
  const [showAll, setShowAll] = useState(false)
  if (items.length === 0) {
    return (
      <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>Nothing requires your attention today</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>All safeguarding actions are up to date.</div>
        </div>
      </div>
    )
  }
  const shown = showAll ? items : items.slice(0, 4)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {shown.map(item => {
        const tone = ATTENTION_TONE[item.rank] || ATTENTION_TONE[5]
        return (
          <button key={item.id} onClick={() => onSelect(item.c)}
            style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', background: tone.bg, borderColor: tone.border }}>
            <span style={{ fontSize: 19, flexShrink: 0 }} aria-hidden="true">{tone.icon}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.detail}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: tone.color, flexShrink: 0 }}>Open →</span>
          </button>
        )
      })}
      {items.length > 4 && (
        <button onClick={() => setShowAll(v => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
          {showAll ? 'Show less' : `Show ${items.length - 4} more`}
        </button>
      )}
    </div>
  )
}

// ── OVERVIEW TAB ─────────────────────────────────────────
function OverviewTab({ cases, attention, quickActions, onSelect, isMobile }) {
  const recent = cases.slice(0, 5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Needs Attention</div>
        <NeedsAttentionCard items={attention} onSelect={onSelect} />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
          {quickActions.map(qa => (
            <button key={qa.label} onClick={qa.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${qa.color}, ${qa.color}CC)`, color: '#fff', cursor: 'pointer', textAlign: 'left', boxShadow: `0 6px 16px -10px ${qa.color}80` }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{qa.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.2 }}>{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Recent Activity</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Nothing logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map(c => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open
              return (
                <button key={c.id} onClick={() => onSelect(c)}
                  style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 15 }}>👧</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.child_name} · {c.concern_type || 'Concern'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(c.created_at)}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>{sc.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────
export default function SafeguardingDashboard({ org, session, onReportConcern, onNavigate, initialOpenConcernId }) {
  const isMobile = useIsMobile()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('overview')
  const [showEmergency, setShowEmergency] = useState(false)

  const userId = session?.user?.id

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cause_for_concern').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  // Deep-link back from a case that originated here (Case Management's "View originating concern")
  useEffect(() => {
    if (!initialOpenConcernId || cases.length === 0) return
    const match = cases.find(c => c.id === initialOpenConcernId)
    if (match) { setTab('cases'); setSelected(match) }
  }, [initialOpenConcernId, cases])

  const stats = {
    open: cases.filter(c => c.status === 'open' || c.status === 'in_progress').length,
    followUp: cases.filter(c => c.follow_up_required && c.status !== 'resolved' && c.status !== 'closed').length,
    // Counts closed_at, not resolved_at. Only the 'resolved' status ever set
    // resolved_at, so a concern closed as 'closed' was invisible here -- which
    // is why this read zero against five closed concerns.
    resolvedThisMonth: cases.filter(c => c.closed_at
      && new Date(c.closed_at).getMonth() === new Date().getMonth()
      && new Date(c.closed_at).getFullYear() === new Date().getFullYear()).length,
  }
  const attention = attentionItems(cases)

  const TABS = [
    ['overview', '🏠 Overview'],
    ['cases', '📋 Cases'],
    ['children', '🧒 Children'],
    ['medical', '❤️ Medical'],
    ['documents', '📁 Documents'],
    ['audit', '🕐 Audit Log'],
  ]

  const QUICK_ACTIONS = [
    { icon: '🛡️', label: 'Report Concern', color: '#DC2626', onClick: () => onReportConcern && onReportConcern() },
    { icon: '❤️', label: 'Medical Incident', color: '#2563EB', onClick: () => setTab('medical') },
    { icon: '📞', label: 'Parent Contact', color: '#7C3AED', onClick: () => setTab('cases') },
    { icon: '📎', label: 'Upload Document', color: '#059669', onClick: () => setTab('documents') },
  ]

  return (
    <div>
      {/* Compact header — stays under ~100px, no oversized hero card */}
      <div style={{ background: 'var(--surface, #fff)', borderBottom: `2px solid ${PRIMARY}18`, padding: isMobile ? '14px 16px' : '16px 24px', flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY}66, transparent)` }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🛡️</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text, #111)', lineHeight: 1.2 }}>Safeguarding</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3, #6B7280)', fontWeight: 600 }}>Protect children and manage concerns · {org?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => onReportConcern && onReportConcern()} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY}CC)`, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>🛡️ Report Concern</button>
            <button onClick={() => setShowEmergency(true)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', color: 'var(--text, #111)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🚨 Emergency</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <StatusPills stats={stats} />
        </div>
      </div>

      <div style={{ padding: isMobile ? 16 : 24 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '10px 16px', border: 'none', borderBottom: tab === key ? `2px solid ${PRIMARY}` : '2px solid transparent', background: 'none', color: tab === key ? PRIMARY : 'var(--text3)', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile || tab !== 'cases' ? '1fr' : '1fr 280px', gap: 20, alignItems: 'flex-start' }}>
          <div>
            {tab === 'overview' && <OverviewTab cases={cases} attention={attention} quickActions={QUICK_ACTIONS} onSelect={setSelected} isMobile={isMobile} />}
            {tab === 'cases' && <CasesTab cases={cases} loading={loading} filter={filter} setFilter={setFilter} onSelect={setSelected} isMobile={isMobile} />}
            {tab === 'children' && <ChildrenTab org={{ ...org, _sessionUserId: userId }} cases={cases} isMobile={isMobile} />}
            {tab === 'medical' && <MedicalTab org={org} isMobile={isMobile} />}
            {tab === 'documents' && <DocumentsTab org={org} userId={userId} isMobile={isMobile} />}
            {tab === 'audit' && <AuditLogTab org={org} />}
          </div>
          {!isMobile && tab === 'cases' && <Sidebar org={org} cases={cases} />}
        </div>
      </div>

      {selected && <CaseDetailModal c={selected} onClose={() => setSelected(null)} onStatusChange={load} orgId={org.id} userId={userId} onNavigate={onNavigate} />}
      {showEmergency && <EmergencyGuidanceModal onClose={() => setShowEmergency(false)} />}
    </div>
  )
}

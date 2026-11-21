import React, { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import SessionSheet, { flowButton, flowInput } from '../sessions/SessionSheet'
import Icon from '../../lib/icons'
import { CONCERN_PRIORITY, CONCERN_STATUS, belongsTo, concernLabel, concernProblems, formatDay, fullName, isHandedOver, personName } from './sgModel'

// One concern, opened from anywhere in the hub. This was a centred modal with
// a 32px close button; it is the same side sheet the rest of the app uses now,
// and it links out to what the concern is about -- the child's file, the
// session it was raised at, and the case it became.
//
// The save and escalate rules are unchanged from the modal it replaces.

export const SG_RED = '#B91C1C'

async function logAudit(orgId, caseId, eventType, detail, userId) {
  await supabase.from('safeguarding_audit_log').insert({ org_id: orgId, case_id: caseId, event_type: eventType, detail, performed_by: userId })
}

const label = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6 }
const sectionHead = { fontSize: 12, fontWeight: 850, color: 'var(--text2)', letterSpacing: .4, textTransform: 'uppercase', margin: '0 0 10px' }
const chip = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color, background: bg, padding: '4px 10px', borderRadius: 999 })
const checkRow = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }

function Field({ name, value }) {
  if (!value) return null
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', marginBottom: 3 }}>{name}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

export default function ConcernSheet({ c, orgId, userId, children = [], today, onClose, onSaved, onOpenCase, onOpenChild, onOpenRegister }) {
  const isNarrow = useIsMobile()
  const ids = { owner: useId(), due: useId(), notes: useId() }

  // Who a concern can be assigned to. Safeguarding work sits with staff, so
  // volunteers and parents are not offered.
  const [staff, setStaff] = useState([])
  useEffect(() => {
    let cancelled = false
    supabase.from('user_profiles').select('id, email, full_name, first_name, last_name, preferred_name, role').eq('org_id', orgId)
      .in('role', ['owner', 'admin', 'manager', 'staff'])
      .then(({ data }) => { if (!cancelled) setStaff((data || []).sort((a, b) => personName(a).localeCompare(personName(b)))) })
    return () => { cancelled = true }
  }, [orgId])

  // The session it was raised at, so the register is one tap away.
  const [session, setSession] = useState(null)
  useEffect(() => {
    if (!c.session_id) return undefined
    let cancelled = false
    supabase.from('sessions').select('id, title, session_date').eq('id', c.session_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setSession(data || null) })
    return () => { cancelled = true }
  }, [c.session_id])

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
  const child = children.find(ch => belongsTo(c, ch)) || null
  const problems = concernProblems(c, today)

  const handleSave = async () => {
    // A concern cannot be closed on nothing: the note is how someone can later
    // say why this was considered dealt with.
    if (isClosing(status) && !isClosing(c.status) && !notes.trim()) {
      setSaveError('Add a note on the outcome before closing this concern.')
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
    // Both closing states stamp the closure, so an inspection can see when it
    // happened and who did it.
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
    // Telling the lead is evidence, so it gets a real timestamp when ticked.
    if (dslNotified && !c.dsl_notified) {
      update.dsl_notified_at = new Date().toISOString()
      update.dsl_notified_by = userId || null
    }

    const { error } = await supabase.from('cause_for_concern').update(update).eq('id', c.id)
    if (error) { setSaving(false); setSaveError(error.message); return }
    if (status !== c.status) await logAudit(orgId, c.id, 'status_change', `Status changed to ${CONCERN_STATUS[status]?.label || status}`, userId)
    if ((assignedTo || '') !== (c.assigned_to || '')) {
      const who = staff.find(m => m.id === assignedTo)
      await logAudit(orgId, c.id, 'assignment', assignedTo ? `Assigned to ${personName(who) || 'a colleague'}` : 'Assignment cleared', userId)
    }
    if (dslNotified && !c.dsl_notified) await logAudit(orgId, c.id, 'dsl_notified', 'DSL recorded as notified', userId)
    setSaving(false)
    onSaved && onSaved()
    onClose()
  }

  const RISK_MAP = { urgent: 'critical', high: 'high', medium: 'medium', low: 'low' }

  const handleEscalate = async () => {
    setEscalating(true)
    // Linked to the child record where the concern already is; otherwise a
    // best-effort match on first name, falling back to the name alone.
    let childId = c.child_id || child?.id || null
    if (!childId) {
      const { data: childMatch } = await supabase.from('children').select('id').eq('org_id', orgId)
        .ilike('first_name', (c.child_name || '').split(' ')[0] || '').maybeSingle()
      childId = childMatch?.id || null
    }
    const { data: newCase, error } = await supabase.from('cases').insert({
      org_id: orgId, child_id: childId, child_name: c.child_name,
      category: c.concern_type || 'Other', risk_level: RISK_MAP[c.priority] || 'medium',
      summary: c.description, status: 'open', created_by: userId, source_concern_id: c.id,
      requires_dsl: !!c.dsl_notified,
    }).select().single()
    if (error) { setEscalating(false); setSaveError('Could not open the case: ' + error.message); return }
    await supabase.from('case_events').insert({
      case_id: newCase.id, org_id: orgId, event_type: 'concern_logged',
      body: `Escalated from a safeguarding concern reported ${new Date(c.created_at).toLocaleDateString('en-GB')}.`, created_by: userId,
    })
    await supabase.from('cause_for_concern').update({ escalated_to_case_id: newCase.id }).eq('id', c.id)
    await logAudit(orgId, c.id, 'escalated', 'Escalated to Case Management', userId)
    setEscalating(false)
    onSaved && onSaved()
    onClose()
    onOpenCase && onOpenCase(newCase.id)
  }

  const sc = CONCERN_STATUS[c.status] || CONCERN_STATUS.open
  const pc = CONCERN_PRIORITY[c.priority] || null
  const actionsAtTime = [
    c.dsl_notified && `Lead told${c.dsl_notified_name ? `: ${c.dsl_notified_name}` : ''}`,
    c.parents_notified && 'Parents told',
    c.police_notified && `Police or agency${c.police_reference ? `: ${c.police_reference}` : ''}`,
    c.follow_up_required && 'Follow-up needed',
  ].filter(Boolean)

  const footer = (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      {isHandedOver(c) ? (
        <button type="button" onClick={() => { onClose(); onOpenCase && onOpenCase(c.escalated_to_case_id) }} style={{ ...flowButton, color: 'var(--info-text)' }}>
          <Icon name="📁" /> Open the case
        </button>
      ) : (
        <button type="button" onClick={handleEscalate} disabled={escalating || saving} style={{ ...flowButton, opacity: escalating ? .6 : 1 }}>
          <Icon name="📁" /> {escalating ? 'Opening a case…' : 'Make this a case'}
        </button>
      )}
      <button type="button" onClick={handleSave} disabled={saving || escalating}
        style={{ ...flowButton, flex: isNarrow ? 1 : undefined, border: 'none', background: SG_RED, color: '#fff', fontWeight: 850, opacity: saving ? .7 : 1 }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <SessionSheet
      title={c.child_name || 'Unnamed concern'}
      subtitle={`${concernLabel(c)} · raised ${formatDay(c.created_at)}${c.submitter_name ? ` by ${c.submitter_name}` : ''}`}
      onClose={onClose} busy={saving || escalating} width={660} footer={footer}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {isHandedOver(c) ? <span style={chip('var(--info-bg)', 'var(--info-text)')}>Now a case</span> : <span style={chip(sc.bg, sc.color)}>{sc.label}</span>}
        {pc && <span style={chip(pc.bg, pc.color)}>{pc.label} priority</span>}
        <span style={chip('var(--surface2)', 'var(--text2)')}>Ref {c.id.slice(-6).toUpperCase()}</span>
      </div>

      {problems.length > 0 && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: problems[0].urgency === 'urgent' ? 'var(--danger-bg)' : 'var(--warn-bg)', border: `1px solid ${problems[0].urgency === 'urgent' ? 'var(--danger-border)' : 'var(--warn-border)'}`, color: problems[0].urgency === 'urgent' ? 'var(--danger-text)' : 'var(--warn-text)', marginBottom: 16 }}>
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}><Icon name="⚠️" /></span>
          <div style={{ fontSize: 13.5, fontWeight: 750, lineHeight: 1.5 }}>
            Still to sort out: {problems.map(p => p.text).join(', ')}.
          </div>
        </div>
      )}

      {(child || session || isHandedOver(c)) && (
        <div style={{ marginBottom: 18 }}>
          <h3 style={sectionHead}>Connected to</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {child && onOpenChild && (
              <button type="button" onClick={() => onOpenChild(child.id)} style={flowButton}><Icon name="🧒" /> {fullName(child)}'s file</button>
            )}
            {session && (
              onOpenRegister
                ? <button type="button" onClick={() => onOpenRegister(session.id)} style={flowButton}><Icon name="📋" /> Register: {session.title || 'Session'}, {formatDay(session.session_date)}</button>
                : <span style={{ ...flowButton, cursor: 'default' }}><Icon name="📋" /> {session.title || 'Session'}, {formatDay(session.session_date)}</span>
            )}
            {isHandedOver(c) && onOpenCase && (
              <button type="button" onClick={() => { onClose(); onOpenCase(c.escalated_to_case_id) }} style={flowButton}><Icon name="📁" /> The case it became</button>
            )}
          </div>
        </div>
      )}

      <h3 style={sectionHead}>What was reported</h3>
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Field name="Date it happened" value={c.date_of_incident ? formatDay(c.date_of_incident) : null} />
        <Field name="Where" value={c.location} />
        <Field name="People involved" value={c.child_name} />
        <Field name="Type of concern" value={c.concern_type} />
      </div>
      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        <Field name="What happened" value={c.description} />
        <Field name="Witnesses" value={c.witnesses} />
        <Field name="Action taken straight away" value={c.action_taken} />
      </div>

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 22 }}>
        <h3 style={{ ...sectionHead, marginBottom: 8 }}>Done when it was reported</h3>
        {actionsAtTime.length
          ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actionsAtTime.map(a => <span key={a} style={chip('var(--surface)', 'var(--text)')}><Icon name="✓" /> {a}</span>)}</div>
          : <div style={{ fontSize: 13, color: 'var(--text2)' }}>Nothing recorded when it was reported.</div>}
        {(c.follow_up_details || c.action_plan_notes) && (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <Field name="Follow-up" value={c.follow_up_details} />
            <Field name="Lead's notes" value={c.action_plan_notes} />
          </div>
        )}
      </div>

      <h3 style={sectionHead}>Update this concern</h3>
      <div role="group" aria-label="Status" style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {Object.entries(CONCERN_STATUS).map(([key, val]) => {
          const on = status === key
          return (
            <button key={key} type="button" aria-pressed={on} onClick={() => setStatus(key)}
              style={{ minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, border: on ? `2px solid ${val.color}` : '1px solid var(--border2, var(--border))', background: on ? val.bg : 'var(--surface)', color: on ? val.color : 'var(--text2)' }}>
              {val.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 8 }}>
        <div>
          <label htmlFor={ids.owner} style={label}>Who owns it</label>
          <select id={ids.owner} value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={flowInput}>
            <option value="">Nobody yet</option>
            {staff.map(m => {
              // Only when two colleagues share a name is the email added.
              const name = personName(m)
              const duplicated = staff.filter(x => personName(x) === name).length > 1
              return <option key={m.id} value={m.id}>{duplicated ? `${name} (${m.email})` : name}</option>
            })}
          </select>
          {!assignedTo && <div style={{ fontSize: 12, color: 'var(--warn-text)', marginTop: 5 }}>A concern nobody owns has nobody to chase it.</div>}
        </div>
        <div>
          <label style={checkRow}>
            <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} style={{ width: 20, height: 20 }} />
            A follow-up is needed
          </label>
          {followUp && (
            <>
              <label htmlFor={ids.due} style={{ ...label, marginTop: 4 }}>Follow up by</label>
              <input id={ids.due} type="date" value={followUpDue || ''} onChange={e => setFollowUpDue(e.target.value)} style={flowInput} />
            </>
          )}
        </div>
      </div>

      <label style={{ ...checkRow, marginBottom: 12 }}>
        <input type="checkbox" checked={dslNotified} onChange={e => setDslNotified(e.target.checked)} style={{ width: 20, height: 20 }} />
        <span>
          The safeguarding lead has been told
          {c.dsl_notified_at && <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>Recorded {new Date(c.dsl_notified_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
        </span>
      </label>

      <label htmlFor={ids.notes} style={label}>Notes and outcome</label>
      <textarea id={ids.notes} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What has been done, what was decided, and why"
        style={{ ...flowInput, minHeight: 100, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }} />

      {(c.closed_at || isClosing(c.status)) && (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 8 }}>
          {c.closed_at ? `Closed ${formatDay(c.closed_at)}` : 'Closed before closure dates were recorded, so the date is not known.'}
        </div>
      )}

      {saveError && (
        <div role="alert" style={{ marginTop: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 650 }}>
          {saveError}
        </div>
      )}
    </SessionSheet>
  )
}

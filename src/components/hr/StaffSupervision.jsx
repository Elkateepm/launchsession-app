import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate, todayLondon, daysUntil, PROBATION_STATUSES } from '../../lib/hrAccess'

// Supervision / 1:1s and probation reviews.
//
// Reads come from hr_supervision_visible, not staff_supervisions. RLS cannot
// filter a single column, so that view blanks private_notes for everyone
// except its author and holders of disciplinary access -- the manager's own
// scratch notes are not part of what the next manager inherits.
//
// Nothing here decides a probation outcome. The outcome is a field somebody
// fills in.

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 12,
}
const field = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
  border: '1px solid #E2E8F0', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  background: '#fff',
}
const lbl = {
  display: 'block', fontSize: 11.5, fontWeight: 800, color: '#64748B',
  marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase',
}
const btn = (primary, disabled) => ({
  flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
  color: '#fff', fontSize: 14, fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
  opacity: disabled ? 0.55 : 1,
})
const ghost = {
  minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
  background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}
function Err({ children }) {
  if (!children) return null
  return <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
    border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{children}</div>
}
function Empty({ children }) {
  return <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B',
    fontSize: 13.5, lineHeight: 1.55 }}>{children}</div>
}

const MEETING_TYPES = [
  ['supervision', 'Supervision'],
  ['one_to_one', '1:1'],
  ['wellbeing', 'Wellbeing'],
  ['probation', 'Probation'],
  ['return_to_work', 'Return to work'],
  ['other', 'Other'],
]

export function SupervisionTab({ org, staff, primary, canEdit, sensitiveView }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('hr_supervision_visible')
      .select('*').eq('staff_id', staff.id).order('meeting_date', { ascending: false })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading supervisions…</div>

  const next = rows.find(r => r.next_supervision_date && daysUntil(r.next_supervision_date) >= 0)
  const overdue = rows.length > 0 && rows[0].next_supervision_date
    && daysUntil(rows[0].next_supervision_date) < 0

  return (
    <>
      {rows.length > 0 && (
        <div style={{ ...card, background: overdue ? '#FEF6E7' : '#fff',
          border: `1px solid ${overdue ? '#FCD9A5' : '#E2E8F0'}` }}>
          <div style={{ fontSize: 13, color: overdue ? '#93500A' : '#64748B', fontWeight: 700 }}>
            {overdue
              ? `Supervision overdue — next was due ${ukDate(rows[0].next_supervision_date)}`
              : next
                ? `Next supervision ${ukDate(next.next_supervision_date)}`
                : `Last supervision ${ukDate(rows[0].meeting_date)}`}
          </div>
        </div>
      )}

      {canEdit && !adding && (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Record a supervision</button>
      )}

      {adding && (
        <SupervisionForm org={org} staff={staff} primary={primary} sensitiveView={sensitiveView}
          onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}

      <Err>{error}</Err>

      {rows.length === 0 && !adding && (
        <Empty>No supervisions recorded for {staff.full_name} yet.</Empty>
      )}

      {rows.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                {(MEETING_TYPES.find(m => m[0] === r.meeting_type) || [null, r.meeting_type])[1]}
                {' · '}{ukDate(r.meeting_date)}
              </div>
              {r.next_supervision_date && (
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  Next due {ukDate(r.next_supervision_date)}
                </div>
              )}
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 99,
              background: r.status === 'completed' ? '#E7F8ED' : '#F3F2F7',
              color: r.status === 'completed' ? '#04713C' : '#5A5772',
              fontSize: 11.5, fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap',
            }}>{r.status === 'follow_up' ? 'Follow-up' : r.status}</span>
          </div>
          {[['Wellbeing', r.wellbeing], ['Workload', r.workload],
            ['Performance', r.performance], ['Development', r.development],
            ['Staff comments', r.staff_comments], ['Manager notes', r.manager_notes],
            ['Private notes', r.private_notes]].map(([k, v]) => v ? (
            <div key={k} style={{ padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 3, whiteSpace: 'pre-wrap' }}>{v}</div>
            </div>
          ) : null)}
          {r.safeguarding_discussed && (
            <div style={{ fontSize: 12.5, color: '#93500A', marginTop: 8, fontWeight: 700 }}>
              Safeguarding was discussed at this meeting
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function SupervisionForm({ org, staff, primary, sensitiveView, onCancel, onSaved }) {
  const [f, setF] = useState({
    meeting_date: todayLondon(), meeting_type: 'supervision', status: 'completed',
    wellbeing: '', workload: '', performance: '', development: '',
    staff_comments: '', manager_notes: '', private_notes: '',
    safeguarding_discussed: false, safeguarding_notes: '', next_supervision_date: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true); setErr('')
    const uid = (await supabase.auth.getUser()).data.user?.id || null
    const { data, error } = await supabase.from('staff_supervisions').insert({
      org_id: org.id, staff_id: staff.id, manager_id: uid, created_by: uid,
      meeting_date: f.meeting_date, meeting_type: f.meeting_type, status: f.status,
      wellbeing: f.wellbeing.trim() || null, workload: f.workload.trim() || null,
      performance: f.performance.trim() || null, development: f.development.trim() || null,
      staff_comments: f.staff_comments.trim() || null,
      manager_notes: f.manager_notes.trim() || null,
      private_notes: f.private_notes.trim() || null,
      safeguarding_discussed: f.safeguarding_discussed,
      safeguarding_notes: f.safeguarding_notes.trim() || null,
      next_supervision_date: f.next_supervision_date || null,
    }).select().maybeSingle()
    setBusy(false)
    if (error) { setErr(error.message); return }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_supervisions', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'recorded', p_summary: 'Supervision recorded', p_metadata: null,
    })
    onSaved()
  }

  const TA = ({ k, label, rows = 3 }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      <textarea value={f[k]} rows={rows} onChange={e => set(k, e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
    </div>
  )

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Record a supervision</div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Date</label>
        <input type="date" value={f.meeting_date} onChange={e => set('meeting_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Type</label>
        <select value={f.meeting_type} onChange={e => set('meeting_type', e.target.value)} style={{ ...field, minHeight: 44 }}>
          {MEETING_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <TA k="wellbeing" label="Wellbeing" />
      <TA k="workload" label="Workload" />
      <TA k="performance" label="Performance" />
      <TA k="development" label="Development" />
      <TA k="staff_comments" label="Staff comments" />
      <TA k="manager_notes" label="Manager notes" />
      {sensitiveView && (
        <>
          <TA k="private_notes" label="Private notes" rows={2} />
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 12, lineHeight: 1.45 }}>
            Visible only to you and to people with disciplinary access. Other managers
            see this supervision without this field.
          </div>
        </>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={f.safeguarding_discussed}
          onChange={e => set('safeguarding_discussed', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: '#0F172A' }}>Safeguarding was discussed</span>
      </label>
      {f.safeguarding_discussed && <TA k="safeguarding_notes" label="Safeguarding notes" rows={2} />}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Next supervision due</label>
        <input type="date" value={f.next_supervision_date}
          onChange={e => set('next_supervision_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Status</label>
        <select value={f.status} onChange={e => set('status', e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
          <option value="follow_up">Follow-up required</option>
        </select>
      </div>
      <Err>{err}</Err>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy} style={btn(primary, busy)}>
          {busy ? 'Saving…' : 'Save supervision'}
        </button>
        <button onClick={onCancel} style={ghost}>Cancel</button>
      </div>
    </div>
  )
}

export function ProbationTab({ org, staff, primary, canEdit }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('staff_probation_reviews')
      .select('*').eq('staff_id', staff.id).order('review_date', { ascending: false })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading probation…</div>

  if (!staff.probation_required) {
    return <Empty>This role does not have a probation period. Turn it on under Employment if it should.</Empty>
  }

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 13, color: '#64748B' }}>
          Probation {staff.probation_start ? `from ${ukDate(staff.probation_start)}` : ''}
          {staff.probation_end ? ` · review due ${ukDate(staff.probation_end)}` : ''}
          {staff.probation_status ? ` · ${(PROBATION_STATUSES.find(p => p.key === staff.probation_status) || {}).label}` : ''}
        </div>
      </div>

      {canEdit && !adding && (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Record a probation review</button>
      )}

      {adding && (
        <ProbationForm org={org} staff={staff} primary={primary}
          onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}

      <Err>{error}</Err>
      {rows.length === 0 && !adding && <Empty>No probation reviews recorded yet.</Empty>}

      {rows.map(r => (
        <div key={r.id} style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
            Review {ukDate(r.review_date)}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
            {r.outcome
              ? `Outcome: ${(PROBATION_STATUSES.find(p => p.key === r.outcome) || {}).label || r.outcome}`
              : 'No outcome recorded yet'}
            {r.extended_to ? ` · extended to ${ukDate(r.extended_to)}` : ''}
          </div>
          {r.objectives && <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.objectives}</div>}
          {r.review_notes && <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.review_notes}</div>}
        </div>
      ))}
    </>
  )
}

function ProbationForm({ org, staff, primary, onCancel, onSaved }) {
  const [f, setF] = useState({
    review_date: todayLondon(), objectives: '', review_notes: '',
    outcome: '', extended_to: '', status: 'completed',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true); setErr('')
    const uid = (await supabase.auth.getUser()).data.user?.id || null
    const { data, error } = await supabase.from('staff_probation_reviews').insert({
      org_id: org.id, staff_id: staff.id, manager_id: uid, created_by: uid,
      review_date: f.review_date,
      objectives: f.objectives.trim() || null,
      review_notes: f.review_notes.trim() || null,
      outcome: f.outcome || null,
      outcome_recorded_by: f.outcome ? uid : null,
      outcome_recorded_at: f.outcome ? new Date().toISOString() : null,
      extended_to: f.extended_to || null,
      status: f.status,
    }).select().maybeSingle()
    if (error) { setBusy(false); setErr(error.message); return }

    // The outcome is carried onto the employment record so the profile header
    // and the probation-due list agree with the review that was just written.
    if (f.outcome) {
      await supabase.from('hr_staff').update({
        probation_status: f.outcome,
        probation_end: f.extended_to || staff.probation_end,
      }).eq('id', staff.id)
    }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_probation_reviews', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'recorded', p_summary: 'Probation review recorded', p_metadata: null,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Probation review</div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Review date</label>
        <input type="date" value={f.review_date} onChange={e => set('review_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Objectives</label>
        <textarea value={f.objectives} rows={3} onChange={e => set('objectives', e.target.value)}
          style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Review notes</label>
        <textarea value={f.review_notes} rows={4} onChange={e => set('review_notes', e.target.value)}
          style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Outcome</label>
        <select value={f.outcome} onChange={e => set('outcome', e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="">No outcome yet</option>
          {PROBATION_STATUSES.filter(p => p.key !== 'in_progress')
            .map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
          Chosen by you. Nothing here works an outcome out from the notes above.
        </div>
      </div>
      {f.outcome === 'extended' && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Extended to</label>
          <input type="date" value={f.extended_to} onChange={e => set('extended_to', e.target.value)} style={field} />
        </div>
      )}
      <Err>{err}</Err>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy} style={btn(primary, busy)}>
          {busy ? 'Saving…' : 'Save review'}
        </button>
        <button onClick={onCancel} style={ghost}>Cancel</button>
      </div>
    </div>
  )
}

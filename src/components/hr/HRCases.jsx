import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate, todayLondon } from '../../lib/hrAccess'

// HR cases for one person, and the escalation into a disciplinary.
//
// Every write goes through an RPC rather than a direct insert. Each of these
// operations touches the case, its timeline and the audit log, and a browser
// that loses its connection between the update and the timeline write would
// leave a case whose history has a hole in it.

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
const primaryBtn = (c, d) => ({
  flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: c,
  color: '#fff', fontSize: 14, fontWeight: 800,
  cursor: d ? 'default' : 'pointer', fontFamily: 'inherit', opacity: d ? 0.55 : 1,
})
const ghostBtn = {
  minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
  background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

export const CASE_TYPES = [
  ['attendance', 'Attendance'], ['performance', 'Performance'],
  ['capability', 'Capability'], ['grievance', 'Grievance'],
  ['welfare', 'Welfare'], ['complaint', 'Complaint'],
  ['conduct_concern', 'Conduct concern'], ['management_concern', 'Management concern'],
  ['relationship', 'Relationship or team issue'], ['other', 'Other'],
]

const STATUSES = [
  ['open', 'Open', '#3730A3', '#EEF2FF'],
  ['triage', 'Triage', '#3730A3', '#EEF2FF'],
  ['review', 'Review', '#93500A', '#FEF6E7'],
  ['action_required', 'Action required', '#B42318', '#FEF2F2'],
  ['monitoring', 'Monitoring', '#93500A', '#FEF6E7'],
  ['resolved', 'Resolved', '#04713C', '#E7F8ED'],
  ['closed', 'Closed', '#5A5772', '#F3F2F7'],
]
const st = (k) => STATUSES.find(s => s[0] === k) || STATUSES[0]
const typeLabel = (k) => (CASE_TYPES.find(t => t[0] === k) || [null, k])[1]

const ENTRY_LABEL = {
  created: 'Case created', note: 'Note added', meeting: 'Meeting held',
  correspondence: 'Email or letter recorded', document: 'Document added',
  status_change: 'Status changed', owner_change: 'Owner changed',
  priority_change: 'Priority changed', action_created: 'Action created',
  action_completed: 'Action completed', escalated: 'Escalated',
  resolved: 'Resolved', closed: 'Closed', linked: 'Linked record',
}

export default function HRCasesTab({ org, staff, primary, canEdit, sensitiveEdit, onOpenDisciplinary }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('hr_cases')
      .select('*').eq('staff_id', staff.id).order('created_at', { ascending: false })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading HR cases…</div>

  if (openId) {
    return <CaseRecord
      org={org} staff={staff} caseId={openId} primary={primary}
      canEdit={canEdit} sensitiveEdit={sensitiveEdit}
      onBack={() => { setOpenId(null); load() }}
      onOpenDisciplinary={onOpenDisciplinary}
    />
  }

  return (
    <>
      {canEdit && !creating && (
        <button onClick={() => setCreating(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Open an HR case</button>
      )}

      {creating && (
        <CaseWizard org={org} staff={staff} primary={primary}
          onCancel={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); load(); setOpenId(id) }} />
      )}

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {rows.length === 0 && !creating && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
          No open HR cases for {staff.full_name}.
        </div>
      )}

      {rows.map(c => {
        const s = st(c.status)
        return (
          <button key={c.id} onClick={() => setOpenId(c.id)} style={{
            ...card, width: '100%', textAlign: 'left', cursor: 'pointer',
            fontFamily: 'inherit', display: 'block',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.4 }}>
                  {c.reference}
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {typeLabel(c.case_type)} · opened {ukDate(c.created_at)}
                  {c.next_action ? ` · next: ${c.next_action}` : ''}
                </div>
              </div>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                background: s[3], color: s[2], fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
              }}>{s[1]}</span>
            </div>
          </button>
        )
      })}
    </>
  )
}

// Step-by-step rather than one long form: this gets filled in by a manager on
// a phone, often straight after a difficult conversation.
function CaseWizard({ org, staff, primary, onCancel, onCreated }) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState({
    case_type: 'conduct_concern', title: '', description: '',
    issue_date: todayLondon(), reported_date: todayLondon(), reported_by: '',
    priority: 'normal', immediate_action: 'No action',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const create = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('hr_create_case', {
      p_staff_id: staff.id, p_case_type: f.case_type, p_title: f.title.trim(),
      p_description: f.description.trim() || null,
      p_issue_date: f.issue_date || null, p_reported_date: f.reported_date || null,
      p_reported_by: f.reported_by.trim() || null, p_priority: f.priority,
      p_immediate_action: f.immediate_action || null, p_owner_id: null,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onCreated(data)
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{
            flex: 1, height: 5, borderRadius: 99,
            background: n <= step ? primary : '#E2E8F0',
          }} />
        ))}
      </div>

      {step === 1 && (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            What kind of case is this?
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>
            For {staff.full_name}. Not every HR case becomes a disciplinary.
          </div>
          <select value={f.case_type} onChange={e => set('case_type', e.target.value)}
            style={{ ...field, minHeight: 44, marginBottom: 14 }}>
            {CASE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>The issue</div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Title</label>
            <input value={f.title} onChange={e => set('title', e.target.value)}
              placeholder="A short summary" style={field} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>What happened</label>
            <textarea value={f.description} rows={4} onChange={e => set('description', e.target.value)}
              style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Date of the issue</label>
            <input type="date" value={f.issue_date} onChange={e => set('issue_date', e.target.value)} style={field} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Reported by</label>
            <input value={f.reported_by} onChange={e => set('reported_by', e.target.value)} style={field} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Priority</label>
            <select value={f.priority} onChange={e => set('priority', e.target.value)} style={{ ...field, minHeight: 44 }}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            Has anything been done already?
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>
            Recording an immediate step is not a finding about anybody.
          </div>
          <select value={f.immediate_action} onChange={e => set('immediate_action', e.target.value)}
            style={{ ...field, minHeight: 44, marginBottom: 14 }}>
            {['No action', 'Support offered', 'Duties changed', 'Manager review',
              'Temporary adjustment', 'Safeguarding escalation', 'Other']
              .map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </>
      )}

      {step === 4 && (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Check and open</div>
          {[['Person', staff.full_name], ['Type', typeLabel(f.case_type)],
            ['Title', f.title || '—'], ['Priority', f.priority],
            ['Immediate action', f.immediate_action]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>{k}</span>
              <span style={{ fontSize: 13.5, color: '#0F172A', fontWeight: 600, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </>
      )}

      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, margin: '10px 0' }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {step > 1 && <button onClick={() => setStep(s => s - 1)} style={ghostBtn}>Back</button>}
        {step < 4 && (
          <button onClick={() => setStep(s => s + 1)}
            disabled={step === 2 && !f.title.trim()}
            style={primaryBtn(primary, step === 2 && !f.title.trim())}>Continue</button>
        )}
        {step === 4 && (
          <button onClick={create} disabled={busy || !f.title.trim()}
            style={primaryBtn(primary, busy || !f.title.trim())}>
            {busy ? 'Opening…' : 'Open case'}
          </button>
        )}
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}

function CaseRecord({ org, staff, caseId, primary, canEdit, sensitiveEdit, onBack, onOpenDisciplinary }) {
  const [c, setC] = useState(null)
  const [entries, setEntries] = useState([])
  const [actions, setActions] = useState([])
  const [linkedDisc, setLinkedDisc] = useState(null)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [rc, re, ra, rd] = await Promise.all([
      supabase.from('hr_cases').select('*').eq('id', caseId).maybeSingle(),
      supabase.from('hr_case_entries').select('*').eq('hr_case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase.from('hr_case_actions').select('*').eq('hr_case_id', caseId)
        .order('due_date', { nullsFirst: false }),
      supabase.from('disciplinary_cases').select('id, reference, stage')
        .eq('source_hr_case_id', caseId).maybeSingle(),
    ])
    if (rc.error) { setError(rc.error.message); return }
    setC(rc.data); setEntries(re.data || []); setActions(ra.data || [])
    // A null here can mean "no disciplinary" or "you cannot see it" -- both
    // land the same way, which is the intended behaviour for someone without
    // disciplinary access.
    setLinkedDisc(rd.data || null)
  }, [caseId])

  useEffect(() => { load() }, [load])

  if (!c) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading case…</div>

  const s = st(c.status)

  const addEntry = async (type, body) => {
    setBusy(true)
    const { error } = await supabase.rpc('hr_case_add_entry', {
      p_case_id: caseId, p_entry_type: type, p_body: body || null, p_occurred_at: null,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setPanel(null); load()
  }

  const setStatus = async (status, note) => {
    setBusy(true)
    const { error } = await supabase.rpc('hr_case_set_status', {
      p_case_id: caseId, p_status: status, p_note: note || null,
      p_next_action: null, p_next_review: null,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setPanel(null); load()
  }

  return (
    <>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 12 }}>← All cases</button>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.4 }}>{c.reference}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>{c.title}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99,
            background: s[3], color: s[2], fontSize: 11.5, fontWeight: 800 }}>{s[1]}</span>
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99,
            background: '#EEF2FF', color: '#3730A3', fontSize: 11.5, fontWeight: 800 }}>
            {typeLabel(c.case_type)}
          </span>
          {c.priority !== 'normal' && (
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99,
              background: '#FEF2F2', color: '#B42318', fontSize: 11.5, fontWeight: 800,
              textTransform: 'capitalize' }}>{c.priority}</span>
          )}
        </div>
        {c.description && (
          <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 12, whiteSpace: 'pre-wrap' }}>{c.description}</div>
        )}
        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 10 }}>
          Opened {ukDate(c.created_at)}
          {c.next_action ? ` · next: ${c.next_action}` : ''}
          {c.next_review_date ? ` · review ${ukDate(c.next_review_date)}` : ''}
        </div>
      </div>

      {linkedDisc && (
        <button onClick={() => onOpenDisciplinary(linkedDisc.id)} style={{
          ...card, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          background: '#FEF2F2', border: '1px solid #FECACA',
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#B42318' }}>
            Linked disciplinary {linkedDisc.reference}
          </div>
          <div style={{ fontSize: 12.5, color: '#B42318', opacity: 0.85, marginTop: 2 }}>
            Currently at {linkedDisc.stage} · open it
          </div>
        </button>
      )}

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {canEdit && c.status !== 'closed' && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#64748B', marginBottom: 10 }}>Actions</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['note', 'Add note'], ['meeting', 'Add meeting'], ['correspondence', 'Record letter/email']]
              .map(([k, l]) => (
                <button key={k} onClick={() => setPanel(k)} style={ghostBtn}>{l}</button>
              ))}
            <button onClick={() => setPanel('status')} style={ghostBtn}>Change status</button>
            <button onClick={() => setPanel('resolve')} style={ghostBtn}>Resolve</button>
            {sensitiveEdit && !linkedDisc && (
              <button onClick={() => setPanel('escalate')} style={{
                ...ghostBtn, border: '1px solid #FECACA', color: '#B42318',
              }}>Escalate to disciplinary</button>
            )}
          </div>
        </div>
      )}

      {panel && ['note', 'meeting', 'correspondence'].includes(panel) && (
        <TextPanel
          title={ENTRY_LABEL[panel]} primary={primary} busy={busy}
          onCancel={() => setPanel(null)} onSave={(v) => addEntry(panel, v)} />
      )}

      {panel === 'status' && (
        <StatusPanel primary={primary} busy={busy} current={c.status}
          onCancel={() => setPanel(null)} onSave={(v, note) => setStatus(v, note)} />
      )}

      {panel === 'resolve' && (
        <TextPanel title="Resolve this case" primary={primary} busy={busy}
          placeholder="How was it resolved?"
          onCancel={() => setPanel(null)} onSave={(v) => setStatus('resolved', v)} />
      )}

      {panel === 'escalate' && (
        <EscalatePanel
          caseId={caseId} caseRef={c.reference} primary={primary}
          onCancel={() => setPanel(null)}
          onDone={(discId) => { setPanel(null); load(); onOpenDisciplinary(discId) }} />
      )}

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Timeline</div>
        {entries.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8' }}>Nothing recorded yet.</div>
        )}
        {entries.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ width: 78, flexShrink: 0, fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
              {ukDate(e.created_at)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                {ENTRY_LABEL[e.entry_type] || e.entry_type}
              </div>
              {e.body && (
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 2, whiteSpace: 'pre-wrap' }}>{e.body}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {actions.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Actions</div>
          {actions.map(a => (
            <div key={a.id} style={{ padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 13.5, color: '#0F172A' }}>{a.description}</div>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>
                {a.due_date ? `Due ${ukDate(a.due_date)}` : 'No due date'}
                {a.completed_at ? ' · done' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function TextPanel({ title, placeholder, primary, busy, onCancel, onSave }) {
  const [v, setV] = useState('')
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{title}</div>
      <textarea value={v} rows={4} onChange={e => setV(e.target.value)}
        placeholder={placeholder} style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(v)} disabled={busy || !v.trim()}
          style={primaryBtn(primary, busy || !v.trim())}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}

function StatusPanel({ current, primary, busy, onCancel, onSave }) {
  const [v, setV] = useState(current)
  const [note, setNote] = useState('')
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Change status</div>
      <select value={v} onChange={e => setV(e.target.value)} style={{ ...field, minHeight: 44, marginBottom: 12 }}>
        {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input value={note} onChange={e => setNote(e.target.value)}
        placeholder="Why (optional)" style={{ ...field, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(v, note)} disabled={busy} style={primaryBtn(primary, busy)}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}

function EscalatePanel({ caseId, caseRef, primary, onCancel, onDone }) {
  const [confirmed, setConfirmed] = useState(false)
  const [f, setF] = useState({
    reason: '', category: 'conduct', allegation: '', risk_level: 'low',
    incident_date: todayLondon(),
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const go = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('hr_escalate_to_disciplinary', {
      p_hr_case_id: caseId,
      p_reason: f.reason.trim(),
      p_category: f.category,
      p_allegation: f.allegation.trim(),
      p_case_manager_id: null,
      p_risk_level: f.risk_level,
      p_incident_date: f.incident_date || null,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onDone(data)
  }

  return (
    <div style={{ ...card, border: '1px solid #FECACA' }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#B42318', marginBottom: 8 }}>
        Escalate to disciplinary
      </div>
      {!confirmed ? (
        <>
          <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, marginBottom: 14 }}>
            Starting a disciplinary creates a separate formal disciplinary record linked to
            this HR case. The original HR case will remain available as part of the audit trail.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmed(true)} style={primaryBtn('#B42318', false)}>
              I understand — continue
            </button>
            <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Why is this being escalated?</label>
            <textarea value={f.reason} rows={3} onChange={e => set('reason', e.target.value)}
              style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Category</label>
            <select value={f.category} onChange={e => set('category', e.target.value)} style={{ ...field, minHeight: 44 }}>
              {[['conduct', 'Conduct'], ['gross_misconduct_allegation', 'Gross misconduct allegation'],
                ['repeated_policy_breach', 'Repeated policy breach'],
                ['attendance_conduct', 'Attendance-related conduct'],
                ['performance_conduct', 'Performance-related conduct'],
                ['safeguarding_linked', 'Safeguarding-linked conduct'], ['other', 'Other']]
                .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Allegation</label>
            <textarea value={f.allegation} rows={3} onChange={e => set('allegation', e.target.value)}
              placeholder="Alleged breach of… — describe what is alleged, not what is concluded"
              style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.45 }}>
              Nothing is decided by opening this. Wording should stay neutral until an
              outcome is recorded.
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Risk level</label>
            <select value={f.risk_level} onChange={e => set('risk_level', e.target.value)} style={{ ...field, minHeight: 44 }}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
              border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={go} disabled={busy || !f.reason.trim() || !f.allegation.trim()}
              style={primaryBtn('#B42318', busy || !f.reason.trim() || !f.allegation.trim())}>
              {busy ? 'Opening…' : 'Open disciplinary'}
            </button>
            <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

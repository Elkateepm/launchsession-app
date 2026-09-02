import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate } from '../../lib/hrAccess'

// Compliance and training for one person.
//
// Status is never read from staff_compliance_records.status -- that column is
// what was true when the row was written. Everything here reads the
// hr_staff_compliance view, which derives status from the expiry date and the
// requirement's warning period, so this screen, the compliance centre and
// Needs Attention cannot disagree about whether a DBS has lapsed.

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

export const COMPLIANCE_TONES = {
  complete:     { label: 'Complete',     tone: '#04713C', bg: '#E7F8ED' },
  due_soon:     { label: 'Due soon',     tone: '#93500A', bg: '#FEF6E7' },
  overdue:      { label: 'Overdue',      tone: '#B42318', bg: '#FEF2F2' },
  missing:      { label: 'Missing',      tone: '#5A5772', bg: '#F3F2F7' },
  not_required: { label: 'Not required', tone: '#5A5772', bg: '#F3F2F7' },
}

function Tone({ status }) {
  const t = COMPLIANCE_TONES[status] || COMPLIANCE_TONES.missing
  return <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 99,
    background: t.bg, color: t.tone, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
  }}>{t.label}</span>
}

export function ComplianceTab({ org, staff, primary, canEdit, isAdmin, onSummary }) {
  const [rows, setRows] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [r, s] = await Promise.all([
      supabase.from('hr_staff_compliance').select('*')
        .eq('staff_id', staff.id).order('sort_order'),
      supabase.from('hr_staff_compliance_summary').select('*')
        .eq('staff_id', staff.id).maybeSingle(),
    ])
    if (r.error) { setError(r.error.message); setRows([]); return }
    setRows(r.data || [])
    setSummary(s.data || null)
    if (onSummary) onSummary(s.data || null)
  }, [staff.id, onSummary])

  useEffect(() => { load() }, [load])

  const seed = async () => {
    setSeeding(true); setError('')
    const { error: e } = await supabase.rpc('hr_seed_compliance_requirements')
    setSeeding(false)
    if (e) { setError(e.message); return }
    load()
  }

  // Distinguishes "still loading" from "genuinely nothing", so the screen never
  // flashes a confident 0% before the data arrives.
  if (rows === null) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading compliance…</div>
  }

  if (error) {
    return (
      <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div style={{ fontSize: 13.5, color: '#B42318', marginBottom: 10 }}>{error}</div>
        <button onClick={load} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #FECACA',
          background: '#fff', color: '#B42318', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Try again</button>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
          No compliance requirements set up yet
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55, marginBottom: 16 }}>
          {isAdmin
            ? 'Start from a standard set for a UK youth organisation — DBS, Right to Work, references, safeguarding and first aid — then edit them to match how you actually work.'
            : 'An administrator needs to set these up before compliance can be tracked.'}
        </div>
        {isAdmin && (
          <button onClick={seed} disabled={seeding} style={{
            minHeight: 46, padding: '0 20px', borderRadius: 12, border: 'none',
            background: primary, color: '#fff', fontSize: 14.5, fontWeight: 800,
            cursor: seeding ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>{seeding ? 'Setting up…' : 'Set up standard requirements'}</button>
        )}
      </div>
    )
  }

  return (
    <>
      {summary && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#0F172A', letterSpacing: -1 }}>
              {summary.percent === null ? '—' : `${summary.percent}%`}
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              {summary.in_place} of {summary.applicable} in place
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
            <div style={{
              width: `${summary.percent || 0}%`, height: '100%', borderRadius: 99,
              background: summary.overdue > 0 || summary.missing > 0 ? '#F59E0B' : '#22C55E',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 10 }}>
            {summary.overdue} overdue · {summary.missing} missing · {summary.due_soon} due soon
          </div>
        </div>
      )}

      {rows.map(r => (
        <div key={r.requirement_id} style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>{r.label}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                {r.expiry_date
                  ? `${r.status === 'overdue' ? 'Expired' : 'Expires'} ${ukDate(r.expiry_date)}`
                  : r.status === 'complete' ? 'Held — no expiry' : 'Nothing recorded'}
                {r.reference ? ` · ${r.reference}` : ''}
              </div>
            </div>
            <Tone status={r.status} />
          </div>

          {editing === r.requirement_id ? (
            <RecordForm
              row={r} staffId={staff.id} primary={primary}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); load() }}
            />
          ) : canEdit && (
            <button onClick={() => setEditing(r.requirement_id)} style={{
              minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid #E2E8F0',
              background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{r.status === 'missing' ? 'Record' : 'Update'}</button>
          )}
        </div>
      ))}
    </>
  )
}

function RecordForm({ row, staffId, primary, onCancel, onSaved }) {
  const [status, setStatus] = useState(row.status === 'not_required' ? 'not_required' : 'complete')
  const [issue, setIssue] = useState(row.issue_date || '')
  const [expiry, setExpiry] = useState(row.expiry_date || '')
  const [reference, setReference] = useState(row.reference || '')
  const [notes, setNotes] = useState(row.notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    const { error } = await supabase.rpc('hr_record_compliance', {
      p_staff_id: staffId,
      p_requirement_id: row.requirement_id,
      p_status: status,
      p_issue_date: issue || null,
      p_expiry_date: status === 'not_required' ? null : (expiry || null),
      p_reference: reference || null,
      p_notes: notes || null,
      p_document_id: null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, marginTop: 4 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="complete">Held / complete</option>
          <option value="not_required">Not required for this person</option>
          <option value="missing">Not held</option>
        </select>
      </div>
      {status === 'complete' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Issued</label>
            <input type="date" value={issue} onChange={e => setIssue(e.target.value)} style={field} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Expires</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={field} />
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
              Leave blank if it does not expire. Warns {row.warn_days} days ahead.
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="e.g. certificate number" style={field} />
          </div>
        </>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} style={field} />
      </div>
      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 10, lineHeight: 1.45 }}>
        Saving keeps the previous entry as history rather than overwriting it.
      </div>
    </div>
  )
}

export function TrainingTab({ org, staff, primary, canEdit }) {
  const [rows, setRows] = useState(null)
  const [reqs, setReqs] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [t, r] = await Promise.all([
      supabase.from('staff_training').select('*')
        .eq('staff_id', staff.id).order('completed_date', { ascending: false, nullsFirst: false }),
      supabase.from('staff_compliance_requirements').select('id, label')
        .eq('org_id', org.id).eq('active', true).order('sort_order'),
    ])
    if (t.error) { setError(t.error.message); setRows([]); return }
    setRows(t.data || [])
    setReqs(r.data || [])
  }, [staff.id, org?.id])

  useEffect(() => { load() }, [load])

  if (rows === null) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading training…</div>
  }

  if (error) {
    return (
      <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div style={{ fontSize: 13.5, color: '#B42318', marginBottom: 10 }}>{error}</div>
        <button onClick={load} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #FECACA',
          background: '#fff', color: '#B42318', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Try again</button>
      </div>
    )
  }

  return (
    <>
      {canEdit && !adding && (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Add training record</button>
      )}

      {adding && (
        <TrainingForm
          org={org} staff={staff} reqs={reqs} primary={primary}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); load() }}
        />
      )}

      {rows.length === 0 && !adding && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
          No training recorded for {staff.full_name} yet.
        </div>
      )}

      {rows.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                {t.course}{t.mandatory ? ' · Mandatory' : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                {t.provider ? `${t.provider} · ` : ''}
                {t.completed_date ? `Completed ${ukDate(t.completed_date)}` : 'Not yet completed'}
                {t.expiry_date ? ` · Expires ${ukDate(t.expiry_date)}` : ''}
              </div>
              {t.notes && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>{t.notes}</div>}
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 99,
              background: t.status === 'completed' ? '#E7F8ED' : '#F3F2F7',
              color: t.status === 'completed' ? '#04713C' : '#5A5772',
              fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'capitalize',
            }}>{t.status}</span>
          </div>
        </div>
      ))}
    </>
  )
}

function TrainingForm({ org, staff, reqs, primary, onCancel, onSaved }) {
  const [f, setF] = useState({
    course: '', provider: '', mandatory: false, status: 'completed',
    completed_date: '', expiry_date: '', requirement_id: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('staff_training').insert({
      org_id: org.id, staff_id: staff.id,
      course: f.course.trim(), provider: f.provider.trim() || null,
      mandatory: f.mandatory, status: f.status,
      completed_date: f.completed_date || null,
      expiry_date: f.expiry_date || null,
      requirement_id: f.requirement_id || null,
      notes: f.notes.trim() || null,
    }).select().maybeSingle()
    setSaving(false)
    if (error) { setErr(error.message); return }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_training', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'added', p_summary: 'Training record added', p_metadata: null,
    })
    onSaved()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Add training</div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Course</label>
        <input value={f.course} onChange={e => set('course', e.target.value)}
          placeholder="e.g. Safeguarding Level 2" style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Provider</label>
        <input value={f.provider} onChange={e => set('provider', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Status</label>
        <select value={f.status} onChange={e => set('status', e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="planned">Planned</option>
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Completed</label>
        <input type="date" value={f.completed_date} onChange={e => set('completed_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Expires</label>
        <input type="date" value={f.expiry_date} onChange={e => set('expiry_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Counts towards</label>
        <select value={f.requirement_id} onChange={e => set('requirement_id', e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="">Nothing — training record only</option>
          {reqs.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.45 }}>
          Linking it means completing this course satisfies that compliance requirement,
          so it does not have to be recorded twice.
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={f.mandatory} onChange={e => set('mandatory', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: '#0F172A' }}>Mandatory for this role</span>
      </label>
      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving || !f.course.trim()} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: saving || !f.course.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: saving || !f.course.trim() ? 0.55 : 1,
        }}>{saving ? 'Saving…' : 'Save training'}</button>
        <button onClick={onCancel} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate, todayLondon } from '../../lib/hrAccess'

// Absence and return-to-work.
//
// Absence extends staff_leave rather than living in a new table: sickness is a
// kind of leave, and staff_leave already keys on the same staff spine. The
// category column separates annual leave from sickness so the two can be
// counted apart without being stored apart.
//
// No statutory sick pay, no entitlement arithmetic. This is a record of who
// was away and whether the conversation afterwards happened.

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

const CATEGORIES = [
  ['sickness', 'Sickness'],
  ['annual_leave', 'Annual leave'],
  ['authorised_absence', 'Authorised absence'],
  ['unpaid_leave', 'Unpaid leave'],
  ['compassionate', 'Compassionate leave'],
  ['medical_appointment', 'Medical appointment'],
  ['other', 'Other'],
]
const catLabel = (k) => (CATEGORIES.find(c => c[0] === k) || [null, k])[1]

// Inclusive of both ends, which is how a charity counts "off Monday to Friday".
function workingSpan(start, end) {
  if (!start || !end) return null
  const a = new Date(start + 'T00:00:00Z'), b = new Date(end + 'T00:00:00Z')
  if (isNaN(a) || isNaN(b)) return null
  return Math.round((b - a) / 86400000) + 1
}

export default function StaffAbsence({ org, staff, primary, canEdit }) {
  const [rows, setRows] = useState(null)
  const [rtw, setRtw] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [rtwFor, setRtwFor] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const [a, r] = await Promise.all([
      supabase.from('staff_leave').select('*')
        .eq('staff_id', staff.id).order('start_date', { ascending: false }),
      supabase.from('staff_return_to_work').select('*')
        .eq('staff_id', staff.id).order('meeting_date', { ascending: false }),
    ])
    if (a.error) { setError(a.error.message); setRows([]); return }
    setRows(a.data || [])
    setRtw(r.data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading absence…</div>

  const rtwDue = rows.filter(a => a.rtw_required && !a.rtw_completed)

  return (
    <>
      {rtwDue.length > 0 && (
        <div style={{ ...card, background: '#FEF6E7', border: '1px solid #FCD9A5' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#93500A' }}>
            {rtwDue.length} return-to-work meeting{rtwDue.length === 1 ? '' : 's'} still to hold
          </div>
        </div>
      )}

      {canEdit && !adding && !rtwFor && (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Record an absence</button>
      )}

      {adding && (
        <AbsenceForm org={org} staff={staff} primary={primary}
          onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}

      {rtwFor && (
        <RtwForm org={org} staff={staff} absence={rtwFor} primary={primary}
          onCancel={() => setRtwFor(null)} onSaved={() => { setRtwFor(null); load() }} />
      )}

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
          No absence recorded for {staff.full_name}.
        </div>
      )}

      {rows.map(a => {
        const span = workingSpan(a.start_date, a.end_date)
        const meeting = rtw.find(r => r.absence_id === a.id)
        return (
          <div key={a.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                  {catLabel(a.category)}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {ukDate(a.start_date)}
                  {a.end_date && a.end_date !== a.start_date ? ` – ${ukDate(a.end_date)}` : ''}
                  {span ? ` · ${span} day${span === 1 ? '' : 's'}` : ''}
                </div>
                {a.notes && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>{a.notes}</div>}
              </div>
              {a.rtw_required && (
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                  background: a.rtw_completed ? '#E7F8ED' : '#FEF6E7',
                  color: a.rtw_completed ? '#04713C' : '#93500A',
                  fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
                }}>{a.rtw_completed ? 'RTW done' : 'RTW due'}</span>
              )}
            </div>

            {meeting && (
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12.5, color: '#64748B' }}>
                  Return-to-work {ukDate(meeting.meeting_date)}
                  {meeting.fit_to_return === true ? ' · fit to return' : ''}
                  {meeting.fit_to_return === false ? ' · not yet fit to return' : ''}
                </div>
                {meeting.adjustments && (
                  <div style={{ fontSize: 13, color: '#0F172A', marginTop: 4 }}>
                    Adjustments: {meeting.adjustments}
                  </div>
                )}
              </div>
            )}

            {canEdit && a.rtw_required && !a.rtw_completed && (
              <button onClick={() => setRtwFor(a)} style={{
                marginTop: 10, minHeight: 44, padding: '0 16px', borderRadius: 11,
                border: '1px solid #E2E8F0', background: '#fff', color: '#0F172A',
                fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>Record return-to-work</button>
            )}
          </div>
        )
      })}
    </>
  )
}

function AbsenceForm({ org, staff, primary, onCancel, onSaved }) {
  const [f, setF] = useState({
    category: 'sickness', start_date: todayLondon(), end_date: '',
    notes: '', rtw_required: true, status: 'recorded',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  // Defaulted, not forced: a return-to-work conversation is normal after
  // sickness and rarely wanted after a dentist appointment.
  useEffect(() => {
    set('rtw_required', f.category === 'sickness')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.category])

  const save = async () => {
    setBusy(true); setErr('')
    const uid = (await supabase.auth.getUser()).data.user?.id || null
    const span = workingSpan(f.start_date, f.end_date || f.start_date)
    const { data, error } = await supabase.from('staff_leave').insert({
      org_id: org.id, staff_id: staff.id,
      type: f.category, category: f.category,
      start_date: f.start_date, end_date: f.end_date || f.start_date,
      days: span, notes: f.notes.trim() || null,
      status: f.status, rtw_required: f.rtw_required,
      reported_to: uid, created_by: uid,
    }).select().maybeSingle()
    setBusy(false)
    if (error) { setErr(error.message); return }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_leave', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'recorded', p_summary: `Absence recorded: ${catLabel(f.category)}`,
      p_metadata: null,
    })
    onSaved()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Record an absence</div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Category</label>
        <select value={f.category} onChange={e => set('category', e.target.value)} style={{ ...field, minHeight: 44 }}>
          {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>First day</label>
        <input type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Last day</label>
        <input type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} style={field} />
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
          Leave blank for a single day.
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Notes</label>
        <input value={f.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Kept brief — medical detail belongs in the return-to-work record" style={field} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={f.rtw_required} onChange={e => set('rtw_required', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: '#0F172A' }}>A return-to-work meeting is needed</span>
      </label>
      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy || !f.start_date} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: busy || !f.start_date ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: busy || !f.start_date ? 0.55 : 1,
        }}>{busy ? 'Saving…' : 'Save absence'}</button>
        <button onClick={onCancel} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

function RtwForm({ org, staff, absence, primary, onCancel, onSaved }) {
  const [f, setF] = useState({
    meeting_date: todayLondon(), fit_to_return: 'yes',
    adjustments: '', follow_up: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true); setErr('')
    const uid = (await supabase.auth.getUser()).data.user?.id || null
    const { data, error } = await supabase.from('staff_return_to_work').insert({
      org_id: org.id, staff_id: staff.id, absence_id: absence.id,
      meeting_date: f.meeting_date, manager_id: uid, created_by: uid,
      fit_to_return: f.fit_to_return === 'yes',
      adjustments: f.adjustments.trim() || null,
      follow_up: f.follow_up.trim() || null,
      notes: f.notes.trim() || null,
      status: 'completed',
    }).select().maybeSingle()
    if (error) { setBusy(false); setErr(error.message); return }

    // Both sides move together: the absence stops showing as outstanding only
    // because a meeting record now exists.
    const { error: e2 } = await supabase.from('staff_leave')
      .update({ rtw_completed: true, updated_at: new Date().toISOString() })
      .eq('id', absence.id)
    if (e2) { setBusy(false); setErr(e2.message); return }

    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_return_to_work', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'recorded', p_summary: 'Return-to-work meeting recorded', p_metadata: null,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Return-to-work meeting</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>
        Following {catLabel(absence.category).toLowerCase()} from {ukDate(absence.start_date)}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Meeting date</label>
        <input type="date" value={f.meeting_date} onChange={e => set('meeting_date', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Fit to return</label>
        <select value={f.fit_to_return} onChange={e => set('fit_to_return', e.target.value)} style={{ ...field, minHeight: 44 }}>
          <option value="yes">Yes</option>
          <option value="no">Not yet</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Adjustments agreed</label>
        <textarea value={f.adjustments} rows={3} onChange={e => set('adjustments', e.target.value)}
          style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Follow-up</label>
        <input value={f.follow_up} onChange={e => set('follow_up', e.target.value)} style={field} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Notes</label>
        <textarea value={f.notes} rows={3} onChange={e => set('notes', e.target.value)}
          style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.55 : 1,
        }}>{busy ? 'Saving…' : 'Save meeting'}</button>
        <button onClick={onCancel} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

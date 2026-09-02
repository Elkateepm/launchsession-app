import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate, todayLondon } from '../../lib/hrAccess'

// The disciplinary record: concern, triage, investigation, hearing, outcome,
// appeal, closed.
//
// Two rules run through all of it. Wording stays neutral until an outcome is
// recorded -- "alleged", "concern raised", never a finding. And nothing is
// suggested or computed: every triage decision, recommendation and outcome is
// chosen by a person and attributed to them.

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
const pBtn = (c, d) => ({
  flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: c,
  color: '#fff', fontSize: 14, fontWeight: 800,
  cursor: d ? 'default' : 'pointer', fontFamily: 'inherit', opacity: d ? 0.55 : 1,
})
const gBtn = {
  minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
  background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

const STAGES = [
  ['concern', 'Concern'], ['triage', 'Triage'], ['investigation', 'Investigation'],
  ['hearing', 'Hearing'], ['outcome', 'Outcome'], ['appeal', 'Appeal'], ['closed', 'Closed'],
]

const OUTCOMES = [
  ['no_formal_action', 'No formal action'],
  ['informal_action', 'Informal management action'],
  ['first_written_warning', 'First written warning'],
  ['final_written_warning', 'Final written warning'],
  ['dismissal', 'Dismissal'],
  ['other_sanction', 'Other formal sanction'],
]

const TRIAGE = [
  ['no_formal_action', 'No formal action'],
  ['informal_action', 'Informal management action'],
  ['further_hr_management', 'Further HR management'],
  ['investigation_required', 'Investigation required'],
  ['safeguarding_process', 'Safeguarding process required'],
  ['other', 'Other'],
]

const RECOMMENDATIONS = [
  ['no_case_to_answer', 'No case to answer'],
  ['informal_action', 'Informal action'],
  ['proceed_to_hearing', 'Proceed to hearing'],
  ['further_investigation', 'Further investigation'],
]

// Horizontally scrollable on a phone rather than wrapped: the order of the
// stages is the information, and a wrapped stepper loses it.
function Stepper({ stage }) {
  const idx = STAGES.findIndex(s => s[0] === stage)
  return (
    <div style={{ ...card, overflowX: 'auto', padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
        {STAGES.map(([k, l], i) => {
          const done = i < idx, now = i === idx
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 99, whiteSpace: 'nowrap',
                background: now ? '#0F172A' : done ? '#E7F8ED' : '#F1F5F9',
                color: now ? '#fff' : done ? '#04713C' : '#94A3B8',
                fontSize: 12.5, fontWeight: 800,
              }}>
                {done ? '✓' : ''} {l}
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ width: 14, height: 2, background: i < idx ? '#A7E7C1' : '#E2E8F0' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DisciplinaryRecord({ org, staff, caseId, primary, canEdit, onBack }) {
  const [d, setD] = useState(null)
  const [inv, setInv] = useState(null)
  const [hearings, setHearings] = useState([])
  const [outcomes, setOutcomes] = useState([])
  const [appeals, setAppeals] = useState([])
  const [entries, setEntries] = useState([])
  const [warnings, setWarnings] = useState([])
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [rd, ri, rh, ro, ra, re, rw] = await Promise.all([
      supabase.from('disciplinary_cases').select('*').eq('id', caseId).maybeSingle(),
      supabase.from('disciplinary_investigations').select('*').eq('disciplinary_case_id', caseId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('disciplinary_hearings').select('*').eq('disciplinary_case_id', caseId)
        .order('hearing_date', { nullsFirst: false }),
      supabase.from('disciplinary_outcomes').select('*').eq('disciplinary_case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase.from('disciplinary_appeals').select('*').eq('disciplinary_case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase.from('disciplinary_entries').select('*').eq('disciplinary_case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase.from('hr_staff_warnings_live').select('*').eq('disciplinary_case_id', caseId),
    ])
    if (rd.error) { setError(rd.error.message); return }
    setD(rd.data); setInv(ri.data || null); setHearings(rh.data || [])
    setOutcomes(ro.data || []); setAppeals(ra.data || [])
    setEntries(re.data || []); setWarnings(rw.data || [])
  }, [caseId])

  useEffect(() => { load() }, [load])

  if (!d) {
    return (
      <>
        <button onClick={onBack} style={{ ...gBtn, marginBottom: 12 }}>← Back</button>
        <div style={{ ...card, color: '#64748B', fontSize: 14 }}>
          {error || 'Loading disciplinary…'}
        </div>
      </>
    )
  }

  const locked = d.locked
  const editable = canEdit && !locked
  const currentOutcome = outcomes.find(o => o.is_current) || outcomes[0]

  const run = async (fn) => {
    setBusy(true); setError('')
    const { error: e } = await fn()
    setBusy(false)
    if (e) { setError(e.message); return }
    setPanel(null); load()
  }

  const setStage = (stage, note) => run(() => supabase.rpc('hr_disciplinary_set_stage', {
    p_case_id: caseId, p_stage: stage, p_note: note || null,
    p_next_action: null, p_next_date: null,
  }))

  return (
    <>
      <button onClick={onBack} style={{ ...gBtn, marginBottom: 12 }}>← Back</button>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.4 }}>{d.reference}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
          {staff.full_name}
        </div>
        <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 10, whiteSpace: 'pre-wrap' }}>
          {d.allegation}
        </div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 10 }}>
          Opened {ukDate(d.created_at)}
          {d.risk_level ? ` · risk ${d.risk_level}` : ''}
          {d.next_action ? ` · next: ${d.next_action}` : ''}
          {d.next_action_date ? ` (${ukDate(d.next_action_date)})` : ''}
        </div>
        {locked && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10,
            background: '#F3F2F7', color: '#5A5772', fontSize: 12.5, lineHeight: 1.5 }}>
            This disciplinary is closed and is now read-only. Closed {ukDate(d.closed_at)}.
          </div>
        )}
      </div>

      <Stepper stage={d.stage} />

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Warning</div>
          {warnings.map(w => (
            <div key={w.id} style={{ padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                {w.warning_type.replace('_', ' ')} warning
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                Issued {ukDate(w.issued_date)}
                {w.expiry_date ? ` · expires ${ukDate(w.expiry_date)}` : ' · no expiry'}
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 800, textTransform: 'capitalize',
                  background: w.effective_status === 'active' ? '#FEF2F2' : '#F3F2F7',
                  color: w.effective_status === 'active' ? '#B42318' : '#5A5772',
                }}>{w.effective_status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage panels ─────────────────────────────────────────────── */}

      {d.stage === 'concern' && editable && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Triage</div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
            Decide how this is handled. Not every concern needs an investigation.
          </div>
          <button onClick={() => setPanel('triage')} style={pBtn(primary, false)}>Record a triage decision</button>
        </div>
      )}

      {panel === 'triage' && (
        <TriagePanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
          onSave={(decision, reasoning) => run(async () => {
            const { error } = await supabase.from('disciplinary_cases').update({
              triage_decision: decision, triage_reasoning: reasoning,
              triage_decided_at: new Date().toISOString(),
            }).eq('id', caseId)
            if (error) return { error }
            return supabase.rpc('hr_disciplinary_set_stage', {
              p_case_id: caseId,
              p_stage: decision === 'investigation_required' ? 'investigation' : 'outcome',
              p_note: 'Triage: ' + (TRIAGE.find(t => t[0] === decision) || [null, decision])[1],
              p_next_action: null, p_next_date: null,
            })
          })} />
      )}

      {d.triage_decision && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#64748B', marginBottom: 6 }}>TRIAGE DECISION</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            {(TRIAGE.find(t => t[0] === d.triage_decision) || [null, d.triage_decision])[1]}
          </div>
          {d.triage_reasoning && (
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, whiteSpace: 'pre-wrap' }}>{d.triage_reasoning}</div>
          )}
        </div>
      )}

      {d.stage === 'investigation' && (
        <Investigation org={org} caseId={caseId} inv={inv} primary={primary}
          editable={editable} onChanged={load} onProceed={() => setStage('hearing', 'Proceeding to hearing')} />
      )}

      {d.stage === 'hearing' && (
        <Hearing org={org} caseId={caseId} hearings={hearings} primary={primary}
          editable={editable} onChanged={load} onRecordOutcome={() => setPanel('outcome')} />
      )}

      {(d.stage === 'outcome' || panel === 'outcome') && editable && !currentOutcome && (
        <OutcomePanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
          onSave={(p) => run(() => supabase.rpc('hr_record_outcome', { p_case_id: caseId, ...p }))} />
      )}

      {currentOutcome && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Outcome</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
            {(OUTCOMES.find(o => o[0] === currentOutcome.outcome) || [null, currentOutcome.outcome])[1]}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
            Decided {ukDate(currentOutcome.decision_date)}
            {currentOutcome.decision_maker_name ? ` by ${currentOutcome.decision_maker_name}` : ''}
            {currentOutcome.appeal_deadline ? ` · appeal by ${ukDate(currentOutcome.appeal_deadline)}` : ''}
          </div>
          {currentOutcome.reasoning && (
            <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {currentOutcome.reasoning}
            </div>
          )}
          {outcomes.length > 1 && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>
              {outcomes.length - 1} earlier outcome{outcomes.length === 2 ? '' : 's'} kept as history.
            </div>
          )}
        </div>
      )}

      {currentOutcome && editable && appeals.length === 0 && (
        <div style={card}>
          <button onClick={() => setPanel('appeal')} style={pBtn(primary, false)}>Record an appeal</button>
        </div>
      )}

      {panel === 'appeal' && (
        <AppealPanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
          onSave={(p) => run(async () => {
            const { error } = await supabase.from('disciplinary_appeals').insert({
              org_id: org.id, disciplinary_case_id: caseId,
              outcome_id: currentOutcome?.id || null,
              lodged_date: p.lodged_date, grounds: p.grounds,
              appeal_manager_name: p.manager || null, status: 'lodged',
            })
            if (error) return { error }
            return supabase.rpc('hr_disciplinary_set_stage', {
              p_case_id: caseId, p_stage: 'appeal', p_note: 'Appeal lodged',
              p_next_action: null, p_next_date: null,
            })
          })} />
      )}

      {appeals.map(a => (
        <div key={a.id} style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Appeal</div>
          <div style={{ fontSize: 12.5, color: '#64748B' }}>
            Lodged {ukDate(a.lodged_date)}{a.appeal_manager_name ? ` · heard by ${a.appeal_manager_name}` : ''}
          </div>
          {a.grounds && <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 8, whiteSpace: 'pre-wrap' }}>{a.grounds}</div>}
          {a.decision ? (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', textTransform: 'capitalize' }}>
                {a.decision.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                {a.decision_reasoning}
              </div>
            </div>
          ) : editable && (
            <button onClick={() => setPanel('appeal_decision_' + a.id)} style={{ ...gBtn, marginTop: 10 }}>
              Record the appeal decision
            </button>
          )}
          {panel === 'appeal_decision_' + a.id && (
            <AppealDecisionPanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
              onSave={(decision, reasoning) => run(() => supabase.rpc('hr_record_appeal_decision', {
                p_appeal_id: a.id, p_decision: decision, p_reasoning: reasoning, p_decision_date: null,
              }))} />
          )}
        </div>
      ))}

      {editable && currentOutcome && (
        <div style={card}>
          <button onClick={() => setPanel('close')} style={pBtn('#0F172A', false)}>Close this disciplinary</button>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8, lineHeight: 1.45 }}>
            Closing makes the record read-only. Corrections afterwards need an administrator
            and are audited.
          </div>
        </div>
      )}

      {panel === 'close' && (
        <ClosePanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
          onSave={(summary, followUp) => run(() => supabase.rpc('hr_close_disciplinary', {
            p_case_id: caseId, p_summary: summary, p_follow_up: followUp || null,
          }))} />
      )}

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>History</div>
        {entries.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ width: 78, flexShrink: 0, fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
              {ukDate(e.created_at)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>
                {String(e.entry_type).replace(/_/g, ' ')}
              </div>
              {e.body && <div style={{ fontSize: 13, color: '#64748B', marginTop: 2, whiteSpace: 'pre-wrap' }}>{e.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Investigation({ org, caseId, inv, primary, editable, onChanged, onProceed }) {
  const [items, setItems] = useState({ evidence: [], witnesses: [], interviews: [] })
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!inv) return
    const [e, w, i] = await Promise.all([
      supabase.from('disciplinary_evidence').select('*').eq('investigation_id', inv.id).order('added_at'),
      supabase.from('disciplinary_witnesses').select('*').eq('investigation_id', inv.id).order('created_at'),
      supabase.from('disciplinary_interviews').select('*').eq('investigation_id', inv.id).order('created_at'),
    ])
    setItems({ evidence: e.data || [], witnesses: w.data || [], interviews: i.data || [] })
  }, [inv])

  useEffect(() => { load() }, [load])

  const start = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.from('disciplinary_investigations').insert({
      org_id: org.id, disciplinary_case_id: caseId,
      started_on: todayLondon(), status: 'open',
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onChanged()
  }

  if (!inv) {
    return (
      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Investigation</div>
        {err && <div style={{ fontSize: 13, color: '#B42318', marginBottom: 10 }}>{err}</div>}
        {editable
          ? <button onClick={start} disabled={busy} style={pBtn(primary, busy)}>
              {busy ? 'Opening…' : 'Open an investigation'}
            </button>
          : <div style={{ fontSize: 13, color: '#64748B' }}>No investigation has been opened.</div>}
      </div>
    )
  }

  const add = async (table, payload) => {
    setBusy(true); setErr('')
    const { error } = await supabase.from(table).insert({
      org_id: org.id, investigation_id: inv.id, ...payload,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPanel(null); load()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Investigation</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12 }}>
        {inv.investigator_name ? `${inv.investigator_name} · ` : ''}
        started {ukDate(inv.started_on)}
        {inv.target_completion ? ` · due ${ukDate(inv.target_completion)}` : ''}
        {' · '}{inv.status}
      </div>

      {err && <div style={{ fontSize: 13, color: '#B42318', marginBottom: 10 }}>{err}</div>}

      {[['evidence', 'Evidence', items.evidence, (x) => x.title],
        ['witnesses', 'Witnesses', items.witnesses, (x) => x.name],
        ['interviews', 'Interviews', items.interviews, (x) => x.interviewee]].map(([k, label, list, render]) => (
        <div key={k} style={{ paddingTop: 10, borderTop: '1px solid #F1F5F9', marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', letterSpacing: 0.4, marginBottom: 6 }}>
            {label.toUpperCase()} ({list.length})
          </div>
          {list.map(x => (
            <div key={x.id} style={{ fontSize: 13.5, color: '#0F172A', padding: '4px 0' }}>{render(x)}</div>
          ))}
          {editable && inv.status === 'open' && (
            <button onClick={() => setPanel(k)} style={{ ...gBtn, marginTop: 6 }}>Add {label.toLowerCase().replace(/s$/, '')}</button>
          )}
        </div>
      ))}

      {panel === 'evidence' && (
        <SimplePanel primary={primary} busy={busy} title="Add evidence"
          fields={[['title', 'Title'], ['evidence_type', 'Type'], ['description', 'Description'], ['source', 'Source']]}
          onCancel={() => setPanel(null)} onSave={(v) => add('disciplinary_evidence', v)} />
      )}
      {panel === 'witnesses' && (
        <SimplePanel primary={primary} busy={busy} title="Add witness"
          fields={[['name', 'Name'], ['relationship', 'Relationship'], ['statement', 'Statement']]}
          onCancel={() => setPanel(null)} onSave={(v) => add('disciplinary_witnesses', v)} />
      )}
      {panel === 'interviews' && (
        <SimplePanel primary={primary} busy={busy} title="Add interview"
          fields={[['interviewee', 'Interviewee'], ['interview_type', 'Type'], ['attendees', 'Attendees'], ['notes', 'Notes']]}
          onCancel={() => setPanel(null)} onSave={(v) => add('disciplinary_interviews', v)} />
      )}

      {editable && inv.status === 'open' && (
        <div style={{ paddingTop: 12, borderTop: '1px solid #F1F5F9', marginTop: 12 }}>
          <button onClick={() => setPanel('conclude')} style={pBtn(primary, false)}>Conclude the investigation</button>
        </div>
      )}

      {panel === 'conclude' && (
        <ConcludePanel primary={primary} busy={busy} onCancel={() => setPanel(null)}
          onSave={async (summary, recommendation) => {
            setBusy(true); setErr('')
            const { error } = await supabase.from('disciplinary_investigations').update({
              status: 'completed', completed_on: todayLondon(),
              summary, recommendation, recommended_at: new Date().toISOString(),
            }).eq('id', inv.id)
            setBusy(false)
            if (error) { setErr(error.message); return }
            setPanel(null)
            if (recommendation === 'proceed_to_hearing') onProceed()
            else onChanged()
          }} />
      )}

      {inv.status === 'completed' && (
        <div style={{ paddingTop: 12, borderTop: '1px solid #F1F5F9', marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', letterSpacing: 0.4 }}>RECOMMENDATION</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {(RECOMMENDATIONS.find(r => r[0] === inv.recommendation) || [null, inv.recommendation || '—'])[1]}
          </div>
          {inv.summary && <div style={{ fontSize: 13, color: '#64748B', marginTop: 6, whiteSpace: 'pre-wrap' }}>{inv.summary}</div>}
          {editable && inv.recommendation === 'proceed_to_hearing' && (
            <button onClick={onProceed} style={{ ...pBtn(primary, false), marginTop: 10 }}>Proceed to hearing</button>
          )}
        </div>
      )}
    </div>
  )
}

function Hearing({ org, caseId, hearings, primary, editable, onChanged, onRecordOutcome }) {
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const h = hearings[0]

  const save = async (payload) => {
    setBusy(true); setErr('')
    const { error } = h
      ? await supabase.from('disciplinary_hearings').update(payload).eq('id', h.id)
      : await supabase.from('disciplinary_hearings').insert({
          org_id: org.id, disciplinary_case_id: caseId, ...payload,
        })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPanel(null); onChanged()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Hearing</div>
      {err && <div style={{ fontSize: 13, color: '#B42318', marginBottom: 10 }}>{err}</div>}

      {!h && (editable
        ? <button onClick={() => setPanel('schedule')} style={pBtn(primary, false)}>Schedule the hearing</button>
        : <div style={{ fontSize: 13, color: '#64748B' }}>Not scheduled.</div>)}

      {h && (
        <>
          <div style={{ fontSize: 13.5, color: '#0F172A' }}>
            {h.hearing_date ? ukDate(h.hearing_date) : 'Date to be set'}
            {h.hearing_time ? ` at ${h.hearing_time}` : ''}
            {h.location ? ` · ${h.location}` : ''}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
            {h.chair_name ? `Chaired by ${h.chair_name}` : 'Chair not set'}
            {h.companion ? ` · accompanied by ${h.companion}` : ''}
            {' · '}{String(h.status).replace('_', ' ')}
          </div>
          {h.notes && <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 8, whiteSpace: 'pre-wrap' }}>{h.notes}</div>}

          {editable && h.status !== 'completed' && (
            <button onClick={() => setPanel('complete')} style={{ ...pBtn(primary, false), marginTop: 12 }}>
              Record the hearing
            </button>
          )}
          {editable && h.status === 'completed' && (
            <button onClick={onRecordOutcome} style={{ ...pBtn(primary, false), marginTop: 12 }}>
              Record the outcome
            </button>
          )}
        </>
      )}

      {panel === 'schedule' && (
        <SimplePanel primary={primary} busy={busy} title="Schedule the hearing"
          fields={[['hearing_date', 'Date', 'date'], ['hearing_time', 'Time'],
                   ['location', 'Location'], ['chair_name', 'Chair'],
                   ['hr_representative', 'HR representative'], ['companion', 'Companion']]}
          onCancel={() => setPanel(null)}
          onSave={(v) => save({ ...v, status: 'scheduled' })} />
      )}

      {panel === 'complete' && (
        <SimplePanel primary={primary} busy={busy} title="Record the hearing"
          fields={[['notes', 'Hearing notes']]} requireAll
          hint="A completed hearing needs its notes or an attached record."
          onCancel={() => setPanel(null)}
          onSave={(v) => save({ ...v, status: 'completed' })} />
      )}
    </div>
  )
}

// Generic small form. Every panel in this file is three or four fields, and
// thirty near-identical components would be harder to keep consistent than one.
function SimplePanel({ title, fields, primary, busy, hint, requireAll, onCancel, onSave }) {
  const [v, setV] = useState({})
  const ready = !requireAll || fields.every(([k]) => (v[k] || '').trim())
  return (
    <div style={{ ...card, background: '#F8FAFC', marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{title}</div>
      {fields.map(([k, label, type]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <label style={lbl}>{label}</label>
          {type === 'date'
            ? <input type="date" value={v[k] || ''} onChange={e => setV(s => ({ ...s, [k]: e.target.value }))} style={field} />
            : <textarea rows={2} value={v[k] || ''} onChange={e => setV(s => ({ ...s, [k]: e.target.value }))}
                style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />}
        </div>
      ))}
      {hint && <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, (val || '').trim() || null])
        ))} disabled={busy || !ready} style={pBtn(primary, busy || !ready)}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function TriagePanel({ primary, busy, onCancel, onSave }) {
  const [decision, setDecision] = useState('investigation_required')
  const [reasoning, setReasoning] = useState('')
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Triage decision</div>
      <select value={decision} onChange={e => setDecision(e.target.value)} style={{ ...field, minHeight: 44, marginBottom: 12 }}>
        {TRIAGE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label style={lbl}>Reasoning</label>
      <textarea value={reasoning} rows={3} onChange={e => setReasoning(e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(decision, reasoning)} disabled={busy || !reasoning.trim()}
          style={pBtn(primary, busy || !reasoning.trim())}>{busy ? 'Saving…' : 'Record decision'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function ConcludePanel({ primary, busy, onCancel, onSave }) {
  const [summary, setSummary] = useState('')
  const [rec, setRec] = useState('')
  return (
    <div style={{ ...card, background: '#F8FAFC', marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Conclude the investigation</div>
      <label style={lbl}>Investigator summary</label>
      <textarea value={summary} rows={4} onChange={e => setSummary(e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      <label style={lbl}>Recommendation</label>
      <select value={rec} onChange={e => setRec(e.target.value)} style={{ ...field, minHeight: 44, marginBottom: 8 }}>
        <option value="">Choose a recommendation</option>
        {RECOMMENDATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 1.45 }}>
        Chosen by the investigator. Nothing here reads the evidence and suggests one.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(summary.trim(), rec)} disabled={busy || !summary.trim() || !rec}
          style={pBtn(primary, busy || !summary.trim() || !rec)}>{busy ? 'Saving…' : 'Conclude'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function OutcomePanel({ primary, busy, onCancel, onSave }) {
  const [f, setF] = useState({
    outcome: '', decision_date: todayLondon(), reasoning: '', effective_date: '',
    follow_up: '', review_date: '', warning_months: '', appeal_deadline: '', decision_maker: '',
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const isWarning = ['first_written_warning', 'final_written_warning', 'informal_action'].includes(f.outcome)
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Record the outcome</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
        Chosen and recorded by the decision maker. Nothing is suggested here.
      </div>
      <label style={lbl}>Outcome</label>
      <select value={f.outcome} onChange={e => set('outcome', e.target.value)} style={{ ...field, minHeight: 44, marginBottom: 12 }}>
        <option value="">Choose an outcome</option>
        {OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label style={lbl}>Decision maker</label>
      <input value={f.decision_maker} onChange={e => set('decision_maker', e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <label style={lbl}>Decision date</label>
      <input type="date" value={f.decision_date} onChange={e => set('decision_date', e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <label style={lbl}>Reasoning</label>
      <textarea value={f.reasoning} rows={3} onChange={e => set('reasoning', e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      {isWarning && (
        <>
          <label style={lbl}>Warning lasts (months)</label>
          <input type="number" value={f.warning_months} onChange={e => set('warning_months', e.target.value)}
            placeholder="e.g. 6" style={{ ...field, marginBottom: 12 }} />
        </>
      )}
      <label style={lbl}>Appeal deadline</label>
      <input type="date" value={f.appeal_deadline} onChange={e => set('appeal_deadline', e.target.value)}
        style={{ ...field, marginBottom: 12 }} />
      <label style={lbl}>Follow-up</label>
      <input value={f.follow_up} onChange={e => set('follow_up', e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({
          p_outcome: f.outcome, p_decision_date: f.decision_date,
          p_reasoning: f.reasoning.trim() || null,
          p_effective_date: f.effective_date || null,
          p_follow_up: f.follow_up.trim() || null,
          p_review_date: f.review_date || null,
          p_warning_months: f.warning_months === '' ? null : Number(f.warning_months),
          p_appeal_deadline: f.appeal_deadline || null,
          p_decision_maker_name: f.decision_maker.trim() || null,
        })} disabled={busy || !f.outcome || !f.decision_date}
          style={pBtn(primary, busy || !f.outcome || !f.decision_date)}>
          {busy ? 'Saving…' : 'Record outcome'}
        </button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function AppealPanel({ primary, busy, onCancel, onSave }) {
  const [f, setF] = useState({ lodged_date: todayLondon(), grounds: '', manager: '' })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Appeal lodged</div>
      <label style={lbl}>Date lodged</label>
      <input type="date" value={f.lodged_date} onChange={e => set('lodged_date', e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <label style={lbl}>Grounds</label>
      <textarea value={f.grounds} rows={3} onChange={e => set('grounds', e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      <label style={lbl}>Appeal manager or chair</label>
      <input value={f.manager} onChange={e => set('manager', e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(f)} disabled={busy || !f.grounds.trim()}
          style={pBtn(primary, busy || !f.grounds.trim())}>{busy ? 'Saving…' : 'Record appeal'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function AppealDecisionPanel({ primary, busy, onCancel, onSave }) {
  const [decision, setDecision] = useState('upheld')
  const [reasoning, setReasoning] = useState('')
  return (
    <div style={{ ...card, background: '#F8FAFC', marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Appeal decision</div>
      <select value={decision} onChange={e => setDecision(e.target.value)} style={{ ...field, minHeight: 44, marginBottom: 12 }}>
        {[['upheld', 'Original decision upheld'], ['reduced', 'Outcome reduced'],
          ['overturned', 'Outcome overturned'], ['rehearing_required', 'Re-hearing required'],
          ['other', 'Other']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label style={lbl}>Final reasoning</label>
      <textarea value={reasoning} rows={3} onChange={e => setReasoning(e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 8 }} />
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 1.45 }}>
        Reducing or overturning marks the warning overturned and supersedes the outcome.
        Both stay on the record as history.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(decision, reasoning.trim())} disabled={busy || !reasoning.trim()}
          style={pBtn(primary, busy || !reasoning.trim())}>{busy ? 'Saving…' : 'Record decision'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

function ClosePanel({ primary, busy, onCancel, onSave }) {
  const [summary, setSummary] = useState('')
  const [followUp, setFollowUp] = useState('')
  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Close this disciplinary</div>
      <label style={lbl}>Final summary</label>
      <textarea value={summary} rows={3} onChange={e => setSummary(e.target.value)}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
      <label style={lbl}>Remaining follow-up</label>
      <input value={followUp} onChange={e => setFollowUp(e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(summary.trim(), followUp.trim())} disabled={busy || !summary.trim()}
          style={pBtn('#0F172A', busy || !summary.trim())}>{busy ? 'Closing…' : 'Close disciplinary'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

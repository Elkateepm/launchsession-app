import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const iStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' }
const taStyle = { ...iStyle, resize: 'vertical', minHeight: 90, lineHeight: 1.5 }
const lStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }

function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <div onClick={() => onChange(!checked)} style={{ width: 44, height: 26, borderRadius: 13, background: checked ? '#EF4444' : '#D1D5DB', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s', marginTop: 2 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>{sublabel}</div>}
      </div>
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 16px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export default function CauseForConcernForm({ org, session: authSession, onClose, onSubmitted }) {
  const [step, setStep] = useState('warning')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionSearch, setSessionSearch] = useState('')
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [children, setChildren] = useState([])
  const [childSearch, setChildSearch] = useState('')
  const [showChildPicker, setShowChildPicker] = useState(false)
  const [form, setForm] = useState({
    submitter_name: authSession?.user?.email?.split('@')[0] || '',
    child_name: '',
    location: '',
    date_of_incident: new Date().toISOString().split('T')[0],
    description: '',
    witnesses: '',
    action_taken: '',
    dsl_notified: false,
    dsl_notified_name: '',
    dsl_notified_time: '',
    parents_notified: false,
    parents_notified_reason: '',
    police_notified: false,
    police_reference: '',
    follow_up_required: false,
    follow_up_details: '',
    action_plan_notes: '',
  })

  useEffect(() => {
    supabase.from('sessions').select('id, title, session_date, location')
      .eq('org_id', org.id)
      .order('session_date', { ascending: false }).limit(60)
      .then(({ data }) => setSessions(data || []))
    supabase.from('children').select('id, first_name, last_name, group_name, allergies, has_epipen, has_asthma, has_diabetes, has_behaviour_plan')
      .eq('org_id', org.id).eq('active', true)
      .order('first_name')
      .then(({ data }) => setChildren(data || []))
  }, [org.id])

  const filteredSessions = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
    (s.session_date || '').includes(sessionSearch)
  )

  const filteredChildren = children.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(childSearch.toLowerCase())
  )

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const addChildToForm = (child) => {
    const fullName = `${child.first_name} ${child.last_name}`.trim()
    const current = form.child_name.trim()
    // Avoid adding the same name twice if picked more than once
    const already = current.split(',').map(n => n.trim().toLowerCase()).includes(fullName.toLowerCase())
    const next = !current ? fullName : already ? current : `${current}, ${fullName}`
    set('child_name', next)
    setChildSearch('')
    setShowChildPicker(false)
  }

  const handleSubmit = async () => {
    if (!form.submitter_name.trim()) { setError('Please enter your full name.'); return }
    if (!form.child_name.trim()) { setError('Please enter the names of people involved.'); return }
    if (!form.location.trim()) { setError('Please enter the location.'); return }
    if (!form.date_of_incident) { setError('Please enter the date.'); return }
    if (!form.description.trim()) { setError('Please describe the incident.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('cause_for_concern').insert({
      org_id: org.id,
      submitted_by: authSession?.user?.id,
      submitter_name: form.submitter_name,
      child_name: form.child_name,
      concern_type: 'general',
      description: form.description,
      date_of_incident: form.date_of_incident,
      location: form.location,
      witnesses: form.witnesses || null,
      action_taken: form.action_taken || null,
      session_id: selectedSession?.id || null,
      status: 'open',
      dsl_notified: form.dsl_notified,
      dsl_notified_name: form.dsl_notified_name || null,
      dsl_notified_time: form.dsl_notified_time || null,
      parents_notified: form.parents_notified,
      parents_notified_reason: form.parents_notified_reason || null,
      police_notified: form.police_notified,
      police_reference: form.police_reference || null,
      follow_up_required: form.follow_up_required,
      follow_up_details: form.follow_up_details || null,
      action_plan_notes: form.action_plan_notes || null,
    })
    setSaving(false)
    if (err) { setError('Failed to submit: ' + err.message); return }
    setStep('done')
    if (onSubmitted) onSubmitted()
  }

  if (step === 'done') return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30 }}>🛡️</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Concern Submitted</div>
      <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
        Your concern has been recorded and will be reviewed by the DSL. Do not discuss this with others.
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>Done</button>
    </div>
  )

  if (step === 'warning') return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🚨</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Cause for Concern</div>
      </div>
      <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 12, padding: 16, border: '1.5px solid rgba(220,38,38,0.2)', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', marginBottom: 10 }}>Please read before continuing:</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.8 }}>
          Causes for concern must be recorded no matter how small or great they may seem.<br /><br />
          They may range from poor personal hygiene to a disclosure of abuse.<br /><br />
          All concerns should be passed on to the Designated Safeguarding Lead (DSL).<br /><br />
          Do not discuss this form or any disclosures with others — adhere to your organisation's confidentiality policy.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>Cancel</button>
        <button onClick={() => setStep('form')} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>I understand — Continue</button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚨</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>Cause for Concern Form</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>1. Your full name *</label>
        <input style={iStyle} value={form.submitter_name} onChange={e => set('submitter_name', e.target.value)} placeholder="Your full name" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>2. Names of people involved *</label>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>Search the register to add a child, or type names directly below (children, staff, volunteers or members of the public).</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input style={iStyle} placeholder="🔍 Search register to add a child..." value={childSearch}
            onChange={e => { setChildSearch(e.target.value); setShowChildPicker(true) }}
            onFocus={() => setShowChildPicker(true)} />
          {showChildPicker && childSearch.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 20 }}>
              {filteredChildren.length === 0
                ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No children found</div>
                : filteredChildren.slice(0, 20).map(c => (
                  <button key={c.id} onClick={() => addChildToForm(c)}
                    style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
                      {c.group_name && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.group_name}</div>}
                    </div>
                    {(c.allergies || c.has_epipen || c.has_asthma || c.has_diabetes || c.has_behaviour_plan) && (
                      <span title="Has medical or behaviour flags" style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>⚠️ Flags</span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
        <textarea style={taStyle} value={form.child_name} onChange={e => set('child_name', e.target.value)} placeholder="Names of children, staff, volunteers or members of the public involved" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>3. Location of the incident *</label>
        <input style={iStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Where did this occur?" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>4. Date of the incident *</label>
        <input type="date" style={iStyle} value={form.date_of_incident} onChange={e => set('date_of_incident', e.target.value)} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>5. Attach to a session (optional)</label>
        {selectedSession ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(37,99,235,0.06)', borderRadius: 10, padding: '10px 13px', border: '1.5px solid rgba(37,99,235,0.2)' }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{selectedSession.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{selectedSession.session_date}</div>
            </div>
            <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input style={iStyle} placeholder="Search sessions..." value={sessionSearch}
              onChange={e => { setSessionSearch(e.target.value); setShowSessionPicker(true) }}
              onFocus={() => setShowSessionPicker(true)} />
            {showSessionPicker && sessionSearch.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 20 }}>
                {filteredSessions.length === 0
                  ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No sessions found</div>
                  : filteredSessions.slice(0, 20).map(s => (
                    <button key={s.id} onClick={() => { setSelectedSession(s); setShowSessionPicker(false); setSessionSearch('') }}
                      style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.session_date}{s.location ? ' — ' + s.location : ''}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>6. Description of the incident *</label>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Use your own words and the exact words of those involved.</div>
        <textarea style={{ ...taStyle, minHeight: 120 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe exactly what happened..." />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>7. Witnesses / CP co-ordinator present</label>
        <input style={iStyle} value={form.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Names of any witnesses or CP co-ordinator present" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lStyle}>8. Immediate action taken</label>
        <textarea style={taStyle} value={form.action_taken} onChange={e => set('action_taken', e.target.value)} placeholder="What immediate action was taken?" />
      </div>

      <SectionDivider label="Action Plan" />
      <div style={{ background: 'rgba(245,208,0,0.06)', borderRadius: 12, padding: '14px 14px 4px', border: '1.5px solid rgba(245,208,0,0.25)', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#856404', marginBottom: 14 }}>Record all notifications and follow-up actions taken after this concern.</div>
        <Toggle checked={form.dsl_notified} onChange={v => set('dsl_notified', v)} label="DSL has been notified" sublabel="Designated Safeguarding Lead informed" />
        {form.dsl_notified && (
          <div style={{ marginLeft: 56, marginTop: -8, marginBottom: 14, display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ ...lStyle, marginBottom: 4 }}>DSL Name</label>
              <input style={iStyle} value={form.dsl_notified_name} onChange={e => set('dsl_notified_name', e.target.value)} placeholder="Name of DSL notified" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...lStyle, marginBottom: 4 }}>Time</label>
              <input type="time" style={iStyle} value={form.dsl_notified_time} onChange={e => set('dsl_notified_time', e.target.value)} />
            </div>
          </div>
        )}
        <Toggle checked={form.parents_notified} onChange={v => set('parents_notified', v)} label="Parents / carers notified" sublabel="Family has been informed" />
        {form.parents_notified && (
          <div style={{ marginLeft: 56, marginTop: -8, marginBottom: 14 }}>
            <label style={{ ...lStyle, marginBottom: 4 }}>Who was contacted and when?</label>
            <input style={iStyle} value={form.parents_notified_reason} onChange={e => set('parents_notified_reason', e.target.value)} placeholder="e.g. Mother called at 14:30" />
          </div>
        )}
        <Toggle checked={form.police_notified} onChange={v => set('police_notified', v)} label="Police / external agency notified" sublabel="Police, social services, or other authority contacted" />
        {form.police_notified && (
          <div style={{ marginLeft: 56, marginTop: -8, marginBottom: 14 }}>
            <label style={{ ...lStyle, marginBottom: 4 }}>Reference number / agency details</label>
            <input style={iStyle} value={form.police_reference} onChange={e => set('police_reference', e.target.value)} placeholder="Reference number or agency name" />
          </div>
        )}
        <Toggle checked={form.follow_up_required} onChange={v => set('follow_up_required', v)} label="Follow-up action required" sublabel="Further steps still need to be taken" />
        {form.follow_up_required && (
          <div style={{ marginLeft: 56, marginTop: -8, marginBottom: 14 }}>
            <label style={{ ...lStyle, marginBottom: 4 }}>Follow-up details</label>
            <textarea style={taStyle} value={form.follow_up_details} onChange={e => set('follow_up_details', e.target.value)} placeholder="What further action is needed and by whom?" />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Additional notes for DSL / case file</label>
          <textarea style={taStyle} value={form.action_plan_notes} onChange={e => set('action_plan_notes', e.target.value)} placeholder="Any other notes..." />
        </div>
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12, color: '#DC2626', fontWeight: 700 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, paddingBottom: 20 }}>
        <button onClick={() => setStep('warning')} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>Back</button>
        <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: saving ? 'rgba(220,38,38,0.4)' : 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Submitting...' : 'Submit Concern'}
        </button>
      </div>
    </div>
  )
}

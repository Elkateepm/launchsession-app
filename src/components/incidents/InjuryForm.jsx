import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'
import BodyMap from './BodyMap'

// ─── INJURY LOG ──────────────────────────────────────────────
// The accident book, ported from the Solidarity Sports hub.
//
// Filled in on a phone, usually minutes after it happened and often one-handed,
// but it has to hold up months later in front of an insurer or an inspector --
// so the questions are the ones they ask, in the order someone would naturally
// answer them. That ordering is the reason to port this rather than rebuild it.
//
// Three things differ from the original, all because this app is not one
// organisation's hub:
//   * the noun comes from useTerms(), since an org calling its people "players"
//     should not be asked about a "child"
//   * children are loaded per org rather than from a global hook
//   * accents come from the org's own brand colour, except the ones carrying
//     meaning -- hospital red, told-them green, still-outstanding amber -- which
//     stay fixed because they are the point
//
// Visible afterwards to the person who logged it and to org admins. That is
// enforced by RLS, not by this screen.

const INJURY_TYPES = ['Cut or graze', 'Bruise', 'Bump to the head', 'Sprain or strain',
  'Break or suspected break', 'Burn or scald', 'Bite or sting', 'Nosebleed',
  'Existing condition', 'Other']
const BODY_PARTS = ['Head or face', 'Neck', 'Shoulder or arm', 'Hand or fingers',
  'Chest or back', 'Hip or leg', 'Knee', 'Foot or toes', 'Other']
const NOTIFY_METHODS = ['In person at collection', 'Phone call', 'Text message', 'Email', 'Not yet']

const ALERT = '#C0392B'
const GOOD = '#1B7A34'
const WARN = '#8A5A00'

const label = { fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }
// 16px, not 13: anything smaller makes iOS Safari zoom the page on focus, and
// a form filled in one-handed beside an upset child cannot afford that.
const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: '#fff' }
const section = { background: '#F8FAFC', borderRadius: 12, padding: '13px 14px', marginBottom: 12 }
const sectionTitle = { fontSize: 11.5, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }

// A datetime-local value for right now, in the browser's own time. An ISO
// string here would offer the user UTC and quietly record the wrong hour.
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function Chips({ options, value, onChange, accent = ALERT }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)} style={{
          minHeight: 36, padding: '7px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
          border: `1.5px solid ${value === o ? accent : '#E2E8F0'}`,
          background: value === o ? `${accent}12` : '#fff',
          color: value === o ? accent : '#64748B',
          fontSize: 12.5, fontWeight: 800,
        }}>{o}</button>
      ))}
    </div>
  )
}

function Toggle({ on, onClick, colour, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', minHeight: 44, borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      border: `1.5px solid ${on ? colour : '#E2E8F0'}`,
      background: on ? `${colour}12` : '#fff', padding: '10px 12px',
      fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
      color: on ? colour : '#64748B',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        border: `1.5px solid ${on ? colour : '#CBD5E1'}`, background: on ? colour : '#fff',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
      }}>{on ? <Icon name="✓" /> : null}</span>
      {children}
    </button>
  )
}

function PersonPicker({ options, value, onChange, terms, accent }) {
  const [q, setQ] = useState('')
  const selected = options.find(c => c.id === value)

  if (selected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
            {selected.first_name} {selected.last_name}
          </div>
          {selected.group_name && (
            <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>{selected.group_name}</div>
          )}
        </div>
        <button type="button" onClick={() => { onChange(''); setQ('') }} style={{
          minHeight: 36, padding: '7px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}>Change</button>
      </div>
    )
  }

  const matches = q.trim()
    ? options.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.trim().toLowerCase()))
    : options

  return (
    <div style={{ marginBottom: 10 }}>
      <input value={q} onChange={e => setQ(e.target.value)} style={{ ...input, marginBottom: 8 }}
        placeholder={`Search ${terms.people}...`} />
      <div style={{ maxHeight: 190, overflowY: 'auto', border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff' }}>
        {matches.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12.5, color: '#94A3B8', fontWeight: 600 }}>Nobody matches.</div>
        )}
        {matches.slice(0, 60).map(c => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', minHeight: 44,
            padding: '10px 12px', border: 'none', borderBottom: '1px solid #F1F5F9',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
            fontWeight: 700, color: '#0F172A',
          }}>
            {c.first_name} {c.last_name}
            {c.group_name && <span style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600, marginLeft: 7 }}>{c.group_name}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// `people` rather than `children`: a prop of that name collides with the JSX
// children slot, which is a confusing thing to leave in a component that never
// renders any.
export default function InjuryForm({ org, userProfile, session, people: providedPeople, onClose, onSaved, initialChildId = null }) {
  const terms = useTerms()
  const accent = org?.primary_color || '#6D5DF6'
  const [people, setPeople] = useState(providedPeople || [])
  const [f, setF] = useState({
    child_id: initialChildId || '',
    occurred_at: nowLocal(),
    location: session?.location || '',
    what_happened: '',
    injury_type: '',
    body_part: '',
    first_aid_given: '',
    treated_by: userProfile?.full_name || '',
    witnesses: '',
    sent_to_hospital: false,
    parent_notified: false,
    parent_notified_method: '',
    follow_up_needed: false,
    follow_up_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const loadPeople = useCallback(async () => {
    if (providedPeople || !org?.id) return
    const { data } = await supabase.from('children')
      .select('id, first_name, last_name, group_name, active')
      .eq('org_id', org.id).order('first_name')
    setPeople(data || [])
  }, [org?.id, providedPeople])

  useEffect(() => { loadPeople() }, [loadPeople])
  useEffect(() => { if (initialChildId) set('child_id', initialChildId) }, [initialChildId])

  const active = (people || []).filter(c => c.active !== false)
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  const submit = async () => {
    if (!f.child_id) { setError(`Choose the ${terms.person} this happened to.`); return }
    if (!f.what_happened.trim()) { setError('Describe what happened.'); return }
    setSaving(true); setError('')
    // org_id and reported_by are defaulted by the database from the caller's
    // own identity. Sending them from here would be a value the client could
    // choose, which is exactly what the policies are there to prevent.
    const { error: err } = await supabase.from('child_injuries').insert([{
      child_id: f.child_id,
      session_id: session?.id || null,
      occurred_at: new Date(f.occurred_at).toISOString(),
      location: f.location || null,
      what_happened: f.what_happened.trim(),
      injury_type: f.injury_type || null,
      body_part: f.body_part || null,
      first_aid_given: f.first_aid_given || null,
      treated_by: f.treated_by || null,
      witnesses: f.witnesses || null,
      sent_to_hospital: f.sent_to_hospital,
      parent_notified: f.parent_notified,
      parent_notified_at: f.parent_notified ? new Date().toISOString() : null,
      parent_notified_by: f.parent_notified ? (userProfile?.id || null) : null,
      parent_notified_method: f.parent_notified_method || null,
      follow_up_needed: f.follow_up_needed,
      follow_up_notes: f.follow_up_notes || null,
    }])
    setSaving(false)
    if (err) { setError(err.message); return }
    setDone(true)
    onSaved && onSaved()
  }

  if (done) {
    return (
      <div style={{ padding: '28px 20px calc(28px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: 18, background: '#E4F5E8', color: GOOD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>
          <Icon name="✓" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Recorded in the accident book</div>
        <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600, lineHeight: 1.55, maxWidth: 340, margin: '0 auto 18px' }}>
          {f.parent_notified
            ? 'The record shows the parent or carer has been told.'
            : 'The record shows the parent or carer has not been told yet.'}
        </div>
        <button onClick={onClose} style={{
          minHeight: 46, padding: '0 26px', borderRadius: 12, border: 'none',
          background: accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>Done</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 16px calc(20px + env(safe-area-inset-bottom))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <span style={{ fontSize: 20, color: ALERT, display: 'inline-flex' }}><Icon name="🩹" /></span>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A', flex: 1 }}>Log an injury</div>
        <button onClick={onClose} aria-label="Close" style={{
          width: 36, height: 36, borderRadius: 10, border: 'none', background: '#F1F5F9',
          color: '#64748B', cursor: 'pointer', fontSize: 17,
        }}><Icon name="✕" /></button>
      </div>
      <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600, lineHeight: 1.55, marginBottom: 14 }}>
        Record it while it is fresh. Only you and an administrator can see what you write here.
      </div>

      {error && (
        <div style={{ background: '#FDEEEC', border: '1.5px solid #F3C2C2', color: '#8C2A20', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>{error}</div>
      )}

      <div style={section}>
        <div style={sectionTitle}>Who and when</div>
        <label style={label}>{terms.Person}</label>
        <PersonPicker options={active} value={f.child_id} onChange={v => set('child_id', v)} terms={terms} accent={accent} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={label}>When</label>
            <input type="datetime-local" style={input} value={f.occurred_at} onChange={e => set('occurred_at', e.target.value)} />
          </div>
          <div>
            <label style={label}>Where</label>
            <input style={input} value={f.location} onChange={e => set('location', e.target.value)} placeholder="e.g. main hall" />
          </div>
        </div>
        {session && (
          <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="🔗" />Recorded against {session.title}
          </div>
        )}
      </div>

      <div style={section}>
        <div style={sectionTitle}>What happened</div>
        <textarea rows={4} style={{ ...input, resize: 'vertical' }} value={f.what_happened}
          onChange={e => set('what_happened', e.target.value)}
          placeholder="In your own words: what led up to it, what happened, and what you saw." />
      </div>

      <div style={section}>
        <div style={sectionTitle}>The injury</div>
        <label style={label}>Type</label>
        <div style={{ marginBottom: 12 }}><Chips options={INJURY_TYPES} value={f.injury_type} onChange={v => set('injury_type', v)} /></div>
        <label style={label}>Where on the body</label>
        {/* The map and the list both write body_part, so a record made either
            way is comparable. The list stays because an SVG-only picker would
            be unusable with a screen reader or a keyboard. */}
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <BodyMap value={f.body_part} onChange={v => set('body_part', v)} />
        </div>
        <div style={{ marginBottom: 12 }}><Chips options={BODY_PARTS} value={f.body_part} onChange={v => set('body_part', v)} /></div>
        <label style={label}>First aid given</label>
        <textarea rows={2} style={{ ...input, resize: 'vertical', marginBottom: 10 }} value={f.first_aid_given}
          onChange={e => set('first_aid_given', e.target.value)} placeholder="e.g. cleaned and covered, cold compress for 10 minutes" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={label}>Treated by</label>
            <input style={input} value={f.treated_by} onChange={e => set('treated_by', e.target.value)} />
          </div>
          <div>
            <label style={label}>Anyone who saw it</label>
            <input style={input} value={f.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Names" />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Toggle on={f.sent_to_hospital} colour={ALERT} onClick={() => set('sent_to_hospital', !f.sent_to_hospital)}>
            Went to hospital or needed a doctor
          </Toggle>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Parent or carer</div>
        <Toggle on={f.parent_notified} colour={GOOD} onClick={() => set('parent_notified', !f.parent_notified)}>
          They have been told
        </Toggle>
        {f.parent_notified ? (
          <div style={{ marginTop: 10 }}>
            <label style={label}>How</label>
            <Chips options={NOTIFY_METHODS} value={f.parent_notified_method} onChange={v => set('parent_notified_method', v)} accent={GOOD} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: WARN, fontWeight: 700, lineHeight: 1.5, marginTop: 10 }}>
            You can save this now and tell them at collection — the record will show they have not been told yet.
          </div>
        )}
      </div>

      <div style={section}>
        <div style={sectionTitle}>Follow-up</div>
        <Toggle on={f.follow_up_needed} colour={WARN} onClick={() => set('follow_up_needed', !f.follow_up_needed)}>
          Something still needs doing
        </Toggle>
        {f.follow_up_needed && (
          <textarea rows={2} style={{ ...input, resize: 'vertical', marginTop: 10 }} value={f.follow_up_notes}
            onChange={e => set('follow_up_notes', e.target.value)} placeholder="What needs to happen, and who by" />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ flex: 2, minHeight: 48, borderRadius: 12, border: 'none', background: saving ? '#94A3B8' : ALERT, color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : 'Save to accident book'}
        </button>
      </div>
    </div>
  )
}

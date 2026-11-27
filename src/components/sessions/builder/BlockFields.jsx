import React, { useState } from 'react'
import { KINDS } from '../../../lib/sessionPlan'
import { OUTCOME_AREAS } from '../../impact/impact_shared'
import Icon from '../../../lib/icons'

// The fields of one activity, shared by the session builder (a block in a
// plan) and the activity library (a reusable activity). The builder also
// passes who can lead and which groups the session has.

export const KIND_TONE = {
  welcome: { ink: 'var(--text2)', bg: 'var(--surface2)' },
  admin: { ink: 'var(--text2)', bg: 'var(--surface2)' },
  break: { ink: 'var(--text3)', bg: 'var(--surface2)' },
  warmup: { ink: 'var(--warn-text)', bg: 'var(--warn-bg)' },
  icebreaker: { ink: 'var(--violet-text)', bg: 'var(--violet-bg)' },
  skill: { ink: 'var(--org-ink)', bg: 'var(--org-a10)' },
  game: { ink: 'var(--org-ink)', bg: 'var(--org-a10)' },
  activity: { ink: 'var(--org-ink)', bg: 'var(--org-a10)' },
  discussion: { ink: 'var(--info-text)', bg: 'var(--info-bg)' },
  cooldown: { ink: 'var(--ok-text)', bg: 'var(--ok-bg)' },
  reflection: { ink: 'var(--ok-text)', bg: 'var(--ok-bg)' },
}
export const toneOf = kind => KIND_TONE[kind] || KIND_TONE.activity

export const fieldInput = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }

function Field({ title, children, wide }) {
  return <label style={{ display: 'block', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}><span style={label}>{title}</span>{children}</label>
}

// Equipment as tags: type and press Enter (or a comma) to add one.
function EquipmentInput({ value = [], onChange }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const items = draft.split(',').map(s => s.trim()).filter(Boolean)
    if (items.length) onChange([...value, ...items.filter(i => !value.some(v => v.toLowerCase() === i.toLowerCase()))])
    setDraft('')
  }
  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map(item => (
            <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 4px 4px 10px', borderRadius: 99, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
              {item}
              <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter(v => v !== item))}
                style={{ width: 28, height: 28, border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 99 }}><Icon name="✕" size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input style={fieldInput} value={draft} placeholder="Type an item and press Enter" aria-label="Add equipment"
        onChange={e => { if (e.target.value.endsWith(',')) { setDraft(e.target.value.slice(0, -1)); setTimeout(add, 0) } else setDraft(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} onBlur={add} />
    </div>
  )
}

export default function BlockFields({ value, onChange, mobile, staff = [], groups = [], showPeople = false, showAge = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const [adapt, setAdapt] = useState(!!(value.easier || value.harder))
  const grid = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={grid}>
        <Field title="Activity name" wide><input style={fieldInput} value={value.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Small-sided game" maxLength={120} /></Field>
        <Field title="Kind">
          <select style={{ ...fieldInput, appearance: 'auto' }} value={value.kind} onChange={e => set('kind', e.target.value)} aria-label="Kind">
            {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </Field>
        <Field title="Minutes"><input style={fieldInput} type="number" min={1} max={600} inputMode="numeric" value={value.minutes} onChange={e => set('minutes', e.target.value === '' ? '' : Math.max(1, Math.min(600, Number(e.target.value) || 1)))} /></Field>
        <Field title="What happens" wide><textarea style={{ ...fieldInput, minHeight: 84, resize: 'vertical' }} value={value.details} onChange={e => set('details', e.target.value)} placeholder="How it runs, rules, coaching points" maxLength={4000} /></Field>
        <Field title="Equipment" wide><EquipmentInput value={value.equipment} onChange={v => set('equipment', v)} /></Field>
        <Field title="Where"><input style={fieldInput} value={value.area || ''} onChange={e => set('area', e.target.value)} placeholder="e.g. Main hall, pitch 2" maxLength={80} /></Field>
        <Field title="Outcome it works on">
          <select style={{ ...fieldInput, appearance: 'auto' }} value={value.outcome || ''} onChange={e => set('outcome', e.target.value)} aria-label="Outcome it works on">
            <option value="">None</option>
            {OUTCOME_AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </Field>
        {showAge && <Field title="Ages"><input style={fieldInput} value={value.age_range || ''} onChange={e => set('age_range', e.target.value)} placeholder="e.g. 8–12" maxLength={40} /></Field>}
        {showPeople && (
          <Field title="Who leads it">
            <select style={{ ...fieldInput, appearance: 'auto' }} value={value.lead_id || ''} onChange={e => set('lead_id', e.target.value)} aria-label="Who leads it">
              <option value="">Anyone on the team</option>
              {staff.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Team member'}</option>)}
            </select>
          </Field>
        )}
      </div>
      {showPeople && groups.length > 0 && (
        <div>
          <span style={label}>Which groups</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {groups.map(g => {
              const on = (value.groups || []).includes(g)
              return (
                <button key={g} type="button" aria-pressed={on} onClick={() => set('groups', on ? value.groups.filter(x => x !== g) : [...(value.groups || []), g])}
                  style={{ minHeight: 40, padding: '0 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? 'var(--org-solid)' : 'var(--border)'}`, background: on ? 'var(--org-a10)' : 'var(--surface)', color: on ? 'var(--org-ink)' : 'var(--text2)' }}>{g}</button>
              )
            })}
          </div>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 5 }}>None picked means everyone.</span>
        </div>
      )}
      <Field title="Safety notes"><textarea style={{ ...fieldInput, minHeight: 60, resize: 'vertical' }} value={value.safety || ''} onChange={e => set('safety', e.target.value)} placeholder="Boundaries, supervision, medical points" maxLength={1000} /></Field>
      {adapt ? (
        <div style={grid}>
          <Field title="Make it easier"><textarea style={{ ...fieldInput, minHeight: 60, resize: 'vertical' }} value={value.easier || ''} onChange={e => set('easier', e.target.value)} maxLength={600} /></Field>
          <Field title="Make it harder"><textarea style={{ ...fieldInput, minHeight: 60, resize: 'vertical' }} value={value.harder || ''} onChange={e => set('harder', e.target.value)} maxLength={600} /></Field>
        </div>
      ) : (
        <button type="button" onClick={() => setAdapt(true)} style={{ justifySelf: 'start', minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px dashed var(--border)', background: 'none', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Ways to make it easier or harder</button>
      )}
    </div>
  )
}

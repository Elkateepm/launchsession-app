import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { readableDbError } from '../../lib/dbErrors'
import Icon from '../../lib/icons'
import OverlayPortal from '../shared/OverlayPortal'
import {
  GENDERS, ETHNICITY_GROUPS, RELIGIONS, LANGUAGES, YEAR_GROUPS, ANSWERS, CIRCUMSTANCES, CONSENTS,
  blankFamily, blankPerson, buildChildRows, consentRowsFor, yearGroupFor,
} from '../../lib/youngPersonFields'

// Add one young person, or a whole family of siblings in one go.
//
// The family's contact details are asked once and go on every child. Each
// child then has their own card. Consents are asked per child and never
// copied from a sibling: a parent can say yes to photos of one and not another.

const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
const newId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) }))

const inp = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
const lab = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }

function Field({ label, hint, children, wide }) {
  return (
    <label style={{ display: 'block', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <span style={lab}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{hint}</span>}
    </label>
  )
}

function Grid({ mobile, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{children}</div>
}

function Part({ title, note, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      {note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>{note}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  )
}

function Select({ value, onChange, children, label }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={{ ...inp, appearance: 'auto' }}>{children}</select>
}

// A tick that is a proper 44px target and reads as on/off at a glance.
function Toggle({ on, onChange, children }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        border: `1.5px solid ${on ? 'var(--org-solid)' : 'var(--border)'}`, background: on ? 'var(--org-a10)' : 'var(--surface)', color: on ? 'var(--org-ink)' : 'var(--text2)' }}>
      <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900,
        background: on ? 'var(--org-solid)' : 'transparent', color: 'var(--org-on-solid)', border: on ? 'none' : '1.5px solid var(--border)' }}>{on ? '✓' : ''}</span>
      {children}
    </button>
  )
}

function Answer({ label, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
      <span style={{ flex: '1 1 180px', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'inline-flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {ANSWERS.map(([k, l]) => {
          const on = value === k
          return (
            <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? '' : k)}
              style={{ minHeight: 40, padding: '0 12px', border: 'none', borderLeft: k === 'yes' ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                background: on ? 'var(--org-solid)' : 'var(--surface)', color: on ? 'var(--org-on-solid)' : 'var(--text2)' }}>
              {k === 'not_sure' ? 'Not sure' : l}
            </button>
          )
        })}
      </span>
    </div>
  )
}

function PersonCard({ person, index, total, open, mobile, groups, today, onToggle, onChange, onRemove, terms }) {
  const set = (k, v) => onChange({ ...person, [k]: v })
  const name = `${person.first_name} ${person.last_name}`.trim() || `${terms.Person} ${index + 1}`
  const suggestedYear = yearGroupFor(person.date_of_birth, today)
  const setDob = v => {
    const next = { ...person, date_of_birth: v }
    // Fill the school year from the date of birth unless someone chose one.
    if (!person.year_group || person.year_group === yearGroupFor(person.date_of_birth, today)) next.year_group = yearGroupFor(v, today) || ''
    onChange(next)
  }
  const summary = [person.date_of_birth && suggestedYear, person.gender, person.group_name].filter(Boolean).join(' · ')

  return (
    <div id={`yp-${person.key}`} style={{ border: `1.5px solid ${open ? 'var(--org-solid)' : 'var(--border)'}`, borderRadius: 16, background: 'var(--surface)', marginTop: 12, scrollMarginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 14px' }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          style={{ flex: 1, minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900,
            background: person.first_name.trim() ? 'var(--org-solid)' : 'var(--border-soft)', color: person.first_name.trim() ? 'var(--org-on-solid)' : 'var(--text3)' }}>{index + 1}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            <span style={{ display: 'block', fontSize: 12, color: person.first_name.trim() ? 'var(--text3)' : 'var(--warn-text)' }}>
              {person.first_name.trim() ? (summary || 'Tap to add more') : 'Needs a first name'}
            </span>
          </span>
          <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}
            style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 10 }}><Icon name="✕" /></button>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 16px 18px', borderTop: '1px solid var(--border-soft)' }}>
          <Part title="The basics">
            <Grid mobile={mobile}>
              <Field label="First name *"><input autoFocus={index > 0} style={inp} value={person.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
              <Field label="Last name" hint={index > 0 && !person.last_name ? 'Left blank, it uses the name above.' : null}><input style={inp} value={person.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
              <Field label="Date of birth"><input type="date" max={today} style={inp} value={person.date_of_birth} onChange={e => setDob(e.target.value)} /></Field>
              <Field label="School year" hint={suggestedYear && person.year_group === suggestedYear ? 'Worked out from their date of birth.' : null}>
                <Select label="School year" value={person.year_group} onChange={v => set('year_group', v)}>
                  <option value="">Choose…</option>
                  {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </Field>
              <Field label="School or college"><input style={inp} value={person.school} onChange={e => set('school', e.target.value)} /></Field>
              <Field label={terms.Group || 'Group'}>
                <input style={inp} list={`groups-${person.key}`} value={person.group_name} onChange={e => set('group_name', e.target.value)} placeholder={groups.length ? 'Choose or type' : ''} />
                <datalist id={`groups-${person.key}`}>{groups.map(g => <option key={g} value={g} />)}</datalist>
              </Field>
            </Grid>
          </Part>

          <Part title="About them" note="All optional, and every list has “Prefer not to say”. Funders ask for these; reports only ever show totals.">
            <Grid mobile={mobile}>
              <Field label="Gender">
                <Select label="Gender" value={person.gender} onChange={v => set('gender', v)}>
                  <option value="">Choose…</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </Select>
              </Field>
              <Field label="Pronouns"><input style={inp} value={person.pronouns} onChange={e => set('pronouns', e.target.value)} placeholder="e.g. she/her" /></Field>
              <Field label="Ethnicity">
                <Select label="Ethnicity" value={person.ethnicity} onChange={v => set('ethnicity', v)}>
                  <option value="">Choose…</option>
                  {ETHNICITY_GROUPS.map(([group, list]) => (
                    <optgroup key={group} label={group}>{list.map(e => <option key={e} value={e}>{e}</option>)}</optgroup>
                  ))}
                  <option value="Prefer not to say">Prefer not to say</option>
                </Select>
              </Field>
              <Field label="First language">
                <input style={inp} list="ln-languages" value={person.first_language} onChange={e => set('first_language', e.target.value)} placeholder="Choose or type" />
              </Field>
              <Field label="Religion or belief">
                <Select label="Religion or belief" value={person.religion} onChange={v => set('religion', v)}>
                  <option value="">Choose…</option>
                  {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
            </Grid>
            <div style={{ marginTop: 10 }}>
              {CIRCUMSTANCES.map(([k, l]) => <Answer key={k} label={l} value={person[k]} onChange={v => set(k, v)} />)}
            </div>
          </Part>

          <Part title="Health and support">
            <Grid mobile={mobile}>
              <Field label="Allergies" wide><input style={inp} value={person.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Peanuts. Leave blank if none" /></Field>
            </Grid>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Toggle on={person.has_asthma} onChange={v => set('has_asthma', v)}>Asthma</Toggle>
              <Toggle on={person.has_diabetes} onChange={v => set('has_diabetes', v)}>Diabetes</Toggle>
              <Toggle on={person.has_epipen} onChange={v => set('has_epipen', v)}>Carries an EpiPen</Toggle>
              <Toggle on={person.takes_medication} onChange={v => set('takes_medication', v)}>Takes medication</Toggle>
              <Toggle on={person.has_behaviour_plan} onChange={v => set('has_behaviour_plan', v)}>Support plan</Toggle>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {person.takes_medication && <Field label="Medication: what, when and how much"><textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={person.medication_details} onChange={e => set('medication_details', e.target.value)} /></Field>}
              {person.has_behaviour_plan && <Field label="Support plan notes"><textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={person.behaviour_plan_notes} onChange={e => set('behaviour_plan_notes', e.target.value)} /></Field>}
              <Field label="Special educational needs (SEN)"><input style={inp} value={person.sen} onChange={e => set('sen', e.target.value)} placeholder="e.g. EHCP for autism" /></Field>
              <Field label="Other medical notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={person.medical_notes} onChange={e => set('medical_notes', e.target.value)} /></Field>
            </div>
          </Part>

          <Part title="Permissions" note={total > 1 ? 'Asked for each child on their own. Not copied from siblings.' : 'Only tick what the parent or carer has agreed to.'}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Toggle on={person.travel_consent} onChange={v => set('travel_consent', v)}>Can go home on their own</Toggle>
              {CONSENTS.map(([k, l]) => (
                <Toggle key={k} on={!!person.consents[k]} onChange={v => set('consents', { ...person.consents, [k]: v })}>{l}</Toggle>
              ))}
            </div>
          </Part>

          <Part title="Anything else">
            <textarea aria-label="Anything else" style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={person.notes} onChange={e => set('notes', e.target.value)} placeholder="Likes, worries, who they come with…" />
          </Part>
        </div>
      )}
    </div>
  )
}

export default function AddYoungPeopleModal({ org, groups = [], onClose, onAdded }) {
  const terms = useTerms()
  const mobile = useIsMobile()
  const today = useMemo(londonToday, [])
  const [family, setFamily] = useState(blankFamily)
  const [people, setPeople] = useState(() => [blankPerson()])
  const [openKey, setOpenKey] = useState(() => null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  const open = openKey ?? people[0].key
  const setF = (k, v) => setFamily(f => ({ ...f, [k]: v }))
  const named = people.filter(p => p.first_name.trim())

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const addSibling = () => {
    const last = [...people].reverse().find(p => p.last_name.trim())?.last_name.trim() || ''
    const next = blankPerson(last)
    setPeople(list => [...list, next])
    setOpenKey(next.key)
    setTimeout(() => document.getElementById(`yp-${next.key}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 60)
  }

  const save = async () => {
    if (!named.length || saving) return
    setSaving(true)
    setError('')
    const rows = buildChildRows({ orgId: org.id, family, people, familyId: named.length > 1 ? newId() : null })
      .map(r => ({ id: newId(), ...r }))
    const { error: e1 } = await supabase.from('children').insert(rows)
    if (e1) { setSaving(false); setError(readableDbError(e1, `Could not add ${named.length > 1 ? terms.people : `this ${terms.person}`}.`)); return }
    const { data: auth } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const consentRows = rows.flatMap((row, i) => consentRowsFor({ orgId: org.id, childId: row.id, consents: named[i].consents, grantedBy: auth?.user?.id, now }))
    const { error: e2 } = await supabase.from('child_consents').insert(consentRows)
    setSaving(false)
    if (e2) { setError(`Added, but the permissions did not save: ${readableDbError(e2, 'try them again on each profile.')}`); return }
    onAdded?.(rows)
  }

  const action = named.length > 1 ? `Add ${named.length} ${terms.people}` : `Add ${terms.person}`

  return (
    <OverlayPortal>
    {/* Above the phone dock, like the Add person chooser that opens it. */}
    <div onClick={() => !saving && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 10700, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-yp-title" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg, var(--surface))', width: '100%', maxWidth: 760, maxHeight: mobile ? '100%' : '92vh', height: mobile ? '100%' : undefined, borderRadius: mobile ? 0 : 22, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,23,42,0.25)' }}>
        <header style={{ padding: mobile ? '16px 16px 12px' : '20px 24px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="add-yp-title" style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--text)' }}>Add {people.length > 1 ? terms.people : `a ${terms.person}`}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>Only a first name is needed now. Brothers and sisters can be added together below.</div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}><Icon name="✕" /></button>
        </header>

        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: mobile ? '14px 14px 20px' : '18px 24px 24px' }}>
          <section style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Parent or carer</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Asked once and saved on {people.length > 1 ? `all ${people.length} ${terms.people}` : `the ${terms.person}`}.</div>
            <div style={{ marginTop: 12 }}>
              <Grid mobile={mobile}>
                <Field label="Name"><input style={inp} autoComplete="off" value={family.parent_name} onChange={e => setF('parent_name', e.target.value)} /></Field>
                <Field label="Phone"><input style={inp} type="tel" inputMode="tel" value={family.parent_phone} onChange={e => setF('parent_phone', e.target.value)} /></Field>
                <Field label="Email" wide><input style={inp} type="email" inputMode="email" value={family.parent_email} onChange={e => setF('parent_email', e.target.value)} /></Field>
                <Field label="Home address"><input style={inp} value={family.address} onChange={e => setF('address', e.target.value)} placeholder="House number and street" /></Field>
                <Field label="Postcode"><input style={{ ...inp, textTransform: 'uppercase' }} value={family.postcode} onChange={e => setF('postcode', e.target.value)} /></Field>
                <Field label="Emergency contact (if not the parent)"><input style={inp} value={family.emergency_contact_name} onChange={e => setF('emergency_contact_name', e.target.value)} placeholder="Name and relationship" /></Field>
                <Field label="Emergency contact phone"><input style={inp} type="tel" inputMode="tel" value={family.emergency_contact_phone} onChange={e => setF('emergency_contact_phone', e.target.value)} /></Field>
              </Grid>
            </div>
          </section>

          {people.map((p, i) => (
            <PersonCard key={p.key} person={p} index={i} total={people.length} open={open === p.key} mobile={mobile} groups={groups} today={today} terms={terms}
              onToggle={() => setOpenKey(open === p.key ? '' : p.key)}
              onChange={next => setPeople(list => list.map(x => (x.key === p.key ? next : x)))}
              onRemove={() => { setPeople(list => list.filter(x => x.key !== p.key)); if (open === p.key) setOpenKey(null) }} />
          ))}

          {people.length < 10 && (
            <button type="button" onClick={addSibling}
              style={{ marginTop: 12, width: '100%', minHeight: 52, borderRadius: 16, border: '1.5px dashed var(--org-solid)', background: 'var(--org-a10)', color: 'var(--org-ink)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add a brother or sister
            </button>
          )}
          <datalist id="ln-languages">{LANGUAGES.map(l => <option key={l} value={l} />)}</datalist>
        </div>

        <footer style={{ padding: mobile ? '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' : '14px 24px', background: 'var(--surface)', borderTop: '1px solid var(--border-soft)' }}>
          {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ flex: mobile ? 1 : '0 0 auto', minHeight: 48, padding: '0 22px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="button" onClick={save} disabled={saving || !named.length}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', fontSize: 14.5, fontWeight: 800, cursor: saving || !named.length ? 'default' : 'pointer', opacity: saving || !named.length ? 0.55 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : action}
            </button>
          </div>
        </footer>
      </div>
    </div>
    </OverlayPortal>
  )
}

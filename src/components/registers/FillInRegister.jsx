import React, { useEffect, useRef, useState } from 'react'
import Icon from '../../lib/icons'

// The register template, filled in on screen, for an organisation that has no
// spreadsheet to upload yet. It produces the same rows a spreadsheet would,
// headed with the fields' own labels, so everything after it -- column
// matching, duplicate checks, the review step -- is the importer's existing
// path rather than a second one.

// What a new organisation needs first. Everything else is a click away.
export const SCREEN_FIELD_KEYS = ['first_name', 'last_name', 'date_of_birth', 'group_name', 'parent_name', 'parent_phone', 'parent_email', 'allergies', 'medical_notes']

const INPUT_TYPES = { date_of_birth: 'date', parent_email: 'email', parent_phone: 'tel', emergency_contact_phone: 'tel' }
const REQUIRED = new Set(['first_name', 'last_name'])

let nextId = 0
const blankRow = () => ({ id: `row-${++nextId}`, values: {} })
const hasText = v => String(v ?? '').trim() !== ''
export const isFilled = row => Object.values(row.values).some(hasText)

/** Rows ready for the importer: labels on top, then one row per person filled in. */
export function rowsForImport(rows, fields) {
  const filled = rows.filter(isFilled)
  const used = fields.filter(f => REQUIRED.has(f.key) || filled.some(r => hasText(r.values[f.key])))
  return [used.map(f => f.label), ...filled.map(r => used.map(f => String(r.values[f.key] ?? '').trim()))]
}

export default function FillInRegister({ fields, allFields = fields, groups = [], terms, primary, onCheck, onBack }) {
  const [rows, setRows] = useState(() => [blankRow(), blankRow(), blankRow()])
  const [showAll, setShowAll] = useState(false)
  const focusRow = useRef(null)
  const listRef = useRef(null)
  const shown = showAll ? allFields : fields
  const filled = rows.filter(isFilled)
  const unnamed = filled.filter(r => !hasText(r.values.first_name) || !hasText(r.values.last_name)).length
  const groupNames = [...new Set(groups.map(g => String(g?.label || g?.name || g || '').trim()).filter(Boolean))]
  const someone = n => (n === 1 ? terms.person : terms.people)

  useEffect(() => {
    if (!focusRow.current) return
    listRef.current?.querySelector(`[data-row="${focusRow.current}"] input, [data-row="${focusRow.current}"] select`)?.focus()
    focusRow.current = null
  }, [rows])

  const set = (id, key, value) => setRows(list => list.map(r => (r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r)))
  const add = () => { const row = blankRow(); focusRow.current = row.id; setRows(list => [...list, row]) }
  const remove = id => setRows(list => (list.length > 1 ? list.filter(r => r.id !== id) : [blankRow()]))

  const control = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit' }
  const quiet = { minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  const input = (row, f, n) => {
    const label = `${f.label}, ${terms.person} ${n}`
    const value = row.values[f.key] ?? ''
    const onChange = e => set(row.id, f.key, e.target.value)
    if (f.bool) return <select aria-label={label} value={value} onChange={onChange} style={control}><option value="">—</option><option>Yes</option><option>No</option></select>
    if (f.key === 'group_name' && groupNames.length) return <select aria-label={label} value={value} onChange={onChange} style={control}><option value="">No group</option>{groupNames.map(g => <option key={g}>{g}</option>)}</select>
    return <input aria-label={label} type={INPUT_TYPES[f.key] || 'text'} value={value} onChange={onChange} autoComplete="off" style={control} />
  }

  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Fill in the template</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>One card per {terms.person}. First and last name are needed; the rest can wait.</div>
      </div>
      {allFields.length > fields.length && <button type="button" onClick={() => setShowAll(v => !v)} aria-pressed={showAll} style={{ ...quiet, color: 'var(--org-ink)' }}>{showAll ? 'Fewer fields' : `All ${allFields.length} fields`}</button>}
    </div>

    <div ref={listRef}>
      {rows.map((row, i) => <div key={row.id} data-row={row.id} role="group" aria-label={`${terms.Person} ${i + 1}`} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 10, background: isFilled(row) ? 'var(--org-a05)' : 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--org-ink)' }}>{terms.Person} {i + 1}</span>
          <button type="button" onClick={() => remove(row.id)} aria-label={`Remove ${terms.person} ${i + 1}`} style={{ width: 36, height: 36, border: 0, borderRadius: 9, background: 'transparent', color: 'var(--text3)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 8 }}>
          {shown.map(f => <label key={f.key} style={{ display: 'block', minWidth: 0 }}>
            <span aria-hidden="true" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{f.label}{REQUIRED.has(f.key) && <span style={{ color: 'var(--danger-text)' }}> *</span>}</span>
            {input(row, f, i + 1)}
          </label>)}
        </div>
      </div>)}
    </div>

    <button type="button" onClick={add} style={{ ...quiet, width: '100%', border: '1.5px dashed var(--org-a35)', color: 'var(--org-ink)', background: 'var(--org-a05)', marginBottom: 10 }}><Icon name="➕" /> Add another {terms.person}</button>

    {unnamed > 0 && <div role="status" style={{ fontSize: 12, color: 'var(--warn-text)', background: 'var(--warn-bg)', borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>{unnamed} {someone(unnamed)} {unnamed === 1 ? 'has' : 'have'} no first or last name yet and will be skipped.</div>}

    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={onBack} style={{ ...quiet, flex: 1 }}><Icon name="←" /> Back</button>
      <button type="button" onClick={() => onCheck(rowsForImport(rows, allFields))} disabled={!filled.length}
        style={{ ...quiet, flex: 2, border: 'none', color: '#fff', background: filled.length ? primary : 'var(--text-faint)', cursor: filled.length ? 'pointer' : 'not-allowed' }}>
        {filled.length ? `Check ${filled.length} ${someone(filled.length)}` : 'Check'} <Icon name="→" />
      </button>
    </div>
  </div>
}

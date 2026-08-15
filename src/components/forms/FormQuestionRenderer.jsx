import React from 'react'

// One renderer for what a question looks like to the person answering it.
//
// The builder canvas and the preview both use this, so the thing staff are
// editing cannot drift away from the thing parents actually see. The public
// form has its own copy because it needs validation state and submission
// wiring; this one is deliberately inert.

export const QUESTION_TYPES = [
  { key: 'text', label: 'Short answer', hint: 'A name, a school, a short reply', group: 'common' },
  { key: 'textarea', label: 'Long answer', hint: 'Several sentences', group: 'common' },
  { key: 'select', label: 'Multiple choice', hint: 'Pick one from a list', group: 'common' },
  { key: 'checkbox', label: 'Tick box', hint: 'Agreement or confirmation', group: 'common' },
  { key: 'date', label: 'Date', hint: 'A day, month and year', group: 'more' },
  { key: 'number', label: 'Number', hint: 'An age, an amount', group: 'more' },
  { key: 'email', label: 'Email', hint: 'Checked for a valid address', group: 'more' },
  { key: 'phone', label: 'Phone', hint: 'A contact number', group: 'more' },
]

// Questions that fill their own options from the organisation's real data, so
// nobody retypes a list LaunchSession already holds.
export const SMART_FIELDS = [
  { key: 'ls_group', label: 'Group', type: 'select', source: 'groups', icon: '👥', hint: "Your organisation's groups" },
  { key: 'ls_session', label: 'Session', type: 'select', source: 'sessions', icon: '📅', hint: 'Upcoming sessions' },
  { key: 'ls_project', label: 'Project', type: 'select', source: 'projects', icon: '🗂', hint: 'Active projects' },
]

export function typeLabel(key) {
  return QUESTION_TYPES.find(t => t.key === key)?.label || 'Short answer'
}

const inputBase = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 14.5, fontFamily: 'inherit',
  background: '#F8FAFC', color: '#94A3B8', pointerEvents: 'none',
}

/**
 * Inert rendering of a single question, as the respondent would see it.
 * `interactive` is false in the canvas (the card itself is the click target)
 * and true in preview.
 */
export default function FormQuestionRenderer({ field, value, onChange, interactive = false, accent = '#6D5DF6' }) {
  const live = interactive
    ? { ...inputBase, background: '#fff', color: '#0F172A', pointerEvents: 'auto' }
    : inputBase

  const label = (
    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A', marginBottom: field.description ? 3 : 8 }}>
      {field.label || 'Untitled question'}
      {field.required && <span style={{ color: '#DC2626' }}> *</span>}
    </div>
  )

  const description = field.description ? (
    <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 9, lineHeight: 1.5 }}>
      {field.description}
    </div>
  ) : null

  let control
  switch (field.type) {
    case 'textarea':
      control = <textarea rows={3} value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)}
        placeholder="Enter answer…" style={{ ...live, resize: 'none' }} />
      break

    case 'checkbox':
      control = (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          fontSize: 14, color: '#334155', cursor: interactive ? 'pointer' : 'default',
        }}>
          <input type="checkbox" checked={!!value} readOnly={!interactive}
            onChange={e => onChange?.(e.target.checked)}
            style={{ marginTop: 2, width: 17, height: 17, accentColor: accent, pointerEvents: interactive ? 'auto' : 'none' }} />
          <span>{field.checkboxText || 'Yes, I confirm'}</span>
        </label>
      )
      break

    case 'select':
      control = (
        <select value={value || ''} disabled={!interactive}
          onChange={e => onChange?.(e.target.value)} style={live}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )
      break

    case 'date':
      control = <input type="date" value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)} style={live} />
      break

    case 'number':
      control = <input type="number" value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)} placeholder="0" style={live} />
      break

    case 'email':
      control = <input type="email" value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)} placeholder="name@example.com" style={live} />
      break

    case 'phone':
      control = <input type="tel" value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)} placeholder="07123 456789" style={live} />
      break

    default:
      control = <input type="text" value={value || ''} readOnly={!interactive}
        onChange={e => onChange?.(e.target.value)} placeholder="Enter answer…" style={live} />
  }

  return (
    <div>
      {field.type !== 'checkbox' && label}
      {field.type !== 'checkbox' && description}
      {field.type === 'checkbox' && field.description && description}
      {control}
    </div>
  )
}

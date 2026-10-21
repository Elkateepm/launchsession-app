import React, { useId } from 'react'

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

export default function FormQuestionRenderer({ field, value, onChange, interactive = false, accent = 'var(--org-primary)' }) {
  const id = useId()
  const base = {
    width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--border)', fontSize: 16, fontFamily: 'inherit',
    background: interactive ? 'var(--surface)' : 'var(--surface2)', color: 'var(--text)',
    pointerEvents: interactive ? 'auto' : 'none',
  }
  const common = { id, required: interactive && !!field.required, tabIndex: interactive ? 0 : -1,
    'aria-describedby': field.description ? `${id}-help` : undefined }
  let control
  if (field.type === 'checkbox') {
    control = <label htmlFor={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, padding: 12, borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, lineHeight: 1.55, cursor: interactive ? 'pointer' : 'default' }}>
      <input {...common} type="checkbox" checked={!!value} readOnly={!interactive} onChange={e => onChange?.(e.target.checked)} style={{ width: 19, height: 19, marginTop: 2, flexShrink: 0, accentColor: accent, pointerEvents: interactive ? 'auto' : 'none' }} />
      <span>{field.checkboxText || field.label || 'Untitled question'}{field.required && <span style={{ color: 'var(--danger-text)' }}> *</span>}</span>
    </label>
  } else if (field.type === 'select') {
    control = (field.options || []).length <= 5
      ? <div role="radiogroup" aria-labelledby={`${id}-label`} style={{ display: 'grid', gap: 8 }}>{(field.options || []).map((option, i) => <label key={i} style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, cursor: interactive ? 'pointer' : 'default', borderColor: value === option ? accent : 'var(--border)' }}>
          <input {...common} id={`${id}-${i}`} name={id} type="radio" value={option} checked={value === option} readOnly={!interactive} onChange={() => onChange?.(option)} style={{ accentColor: accent }} /><span style={{ fontSize: 14 }}>{option}</span>
        </label>)}</div>
      : <select {...common} disabled={!interactive} value={value || ''} onChange={e => onChange?.(e.target.value)} style={base}><option value="">Select an option…</option>{(field.options || []).map((option, i) => <option key={i} value={option}>{option}</option>)}</select>
  } else if (field.type === 'textarea') {
    control = <textarea {...common} rows={3} value={value ?? ''} readOnly={!interactive} onChange={e => onChange?.(e.target.value)} placeholder="Enter answer…" style={{ ...base, resize: 'vertical' }} />
  } else {
    const type = field.type === 'phone' ? 'tel' : ['text', 'email', 'date', 'number'].includes(field.type) ? field.type : 'text'
    control = <input {...common} type={type} value={value ?? ''} readOnly={!interactive} onChange={e => onChange?.(e.target.value)} placeholder={type === 'email' ? 'name@example.com' : type === 'tel' ? '07123 456789' : type === 'number' ? '0' : 'Enter answer…'} style={base} />
  }
  return <div>
    {field.type !== 'checkbox' && <label id={`${id}-label`} htmlFor={id} style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 9 }}>{field.label || 'Untitled question'}{field.required && <span style={{ color: 'var(--danger-text)' }}> *</span>}</label>}
    {field.description && <div id={`${id}-help`} style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 9, lineHeight: 1.6 }}>{field.description}</div>}
    {control}
  </div>
}

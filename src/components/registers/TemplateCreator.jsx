import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// Full set of fields available on the children table — the template creator lets
// orgs pick which of these to include in their import, in what order, and whether
// each is required. Group name is always available but its actual values (Red,
// Blue, etc.) are managed separately in Branding/Settings — the template only
// ever references the generic "group_name" column, never specific group values.
export const AVAILABLE_FIELDS = [
  { key: 'first_name',              label: 'First Name',              icon: '👤', alwaysRequired: true },
  { key: 'last_name',               label: 'Last Name',               icon: '👤', alwaysRequired: true },
  { key: 'date_of_birth',           label: 'Date of Birth',           icon: '🎂' },
  { key: 'group_name',              label: 'Group',                   icon: '🏷️' },
  { key: 'allergies',               label: 'Allergies',                icon: '⚠️' },
  { key: 'medical_notes',           label: 'Medical Notes',           icon: '⚕️' },
  { key: 'sen',                     label: 'SEN / Additional Needs',  icon: '💜' },
  { key: 'emergency_contact_name',  label: 'Emergency Contact Name',  icon: '📞' },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', icon: '📱' },
]

export function useImportTemplates(orgId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('import_templates').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  return { templates, loading, reload: load }
}

function defaultFieldsSelection() {
  return AVAILABLE_FIELDS.map(f => ({ key: f.key, label: f.label, required: !!f.alwaysRequired }))
}

// ─── TEMPLATE CREATOR MODAL ─────────────────────────────────────
export function TemplateCreatorModal({ org, existingTemplate, onClose, onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const isEditing = !!existingTemplate
  const [name, setName] = useState(existingTemplate?.name || '')
  const [fields, setFields] = useState(existingTemplate?.fields?.length ? existingTemplate.fields : defaultFieldsSelection())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isIncluded = (key) => fields.some(f => f.key === key)
  const fieldConfig = (key) => fields.find(f => f.key === key)

  const toggleField = (fieldDef) => {
    if (fieldDef.alwaysRequired) return // name fields can't be removed
    setFields(prev => isIncluded(fieldDef.key)
      ? prev.filter(f => f.key !== fieldDef.key)
      : [...prev, { key: fieldDef.key, label: fieldDef.label, required: false }])
  }

  const toggleRequired = (key) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f))
  }

  const moveField = (key, dir) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.key === key)
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Give this template a name.'); return }
    setSaving(true)
    setError('')
    const payload = { org_id: org.id, name: name.trim(), fields, updated_at: new Date().toISOString() }
    const { error: err } = isEditing
      ? await supabase.from('import_templates').update(payload).eq('id', existingTemplate.id)
      : await supabase.from('import_templates').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  // Ordered list: included fields first (in saved order), then available-but-not-included
  const orderedFields = [
    ...fields.map(f => AVAILABLE_FIELDS.find(af => af.key === f.key)).filter(Boolean),
    ...AVAILABLE_FIELDS.filter(af => !isIncluded(af.key)),
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#111' }}>{isEditing ? 'Edit Template' : '🧩 New Import Template'}</div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, color: '#6B7280' }}>×</button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name (e.g. Standard Register, Trip Sign-up)"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${primary}30`, fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
          {error && <div style={{ marginTop: 10, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>}
        </div>

        {/* Field list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, padding: '8px 4px 4px' }}>
            Fields to include ({fields.length} selected)
          </div>
          {orderedFields.map((fieldDef) => {
            const included = isIncluded(fieldDef.key)
            const cfg = fieldConfig(fieldDef.key)
            const locked = fieldDef.alwaysRequired
            return (
              <div key={fieldDef.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 12, background: included ? primary + '08' : 'transparent', marginBottom: 4, opacity: included ? 1 : 0.55 }}>
                <button onClick={() => toggleField(fieldDef)} disabled={locked}
                  style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${included ? primary : '#D1D5DB'}`, background: included ? primary : '#fff', cursor: locked ? 'default' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900 }}>
                  {included ? '✓' : ''}
                </button>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{fieldDef.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{fieldDef.label}</div>
                  {locked && <div style={{ fontSize: 10, color: '#9CA3AF' }}>Always required</div>}
                </div>
                {included && !locked && (
                  <button onClick={() => toggleRequired(fieldDef.key)}
                    style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99, border: `1px solid ${cfg?.required ? '#DC2626' : '#D1D5DB'}`, background: cfg?.required ? '#FEE2E2' : '#fff', color: cfg?.required ? '#DC2626' : '#9CA3AF', cursor: 'pointer', flexShrink: 0 }}>
                    {cfg?.required ? 'Required' : 'Optional'}
                  </button>
                )}
                {included && (
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <button onClick={() => moveField(fieldDef.key, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 10, padding: '1px 4px' }}>▲</button>
                    <button onClick={() => moveField(fieldDef.key, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 10, padding: '1px 4px' }}>▼</button>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            💡 <strong>Group</strong> stays flexible — this template only reserves a "Group" column. The actual group names and colours your org uses (Red, Blue, etc.) are managed in <strong>Settings → Branding</strong>, so this template works no matter how your groups change.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : '💾 Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TEMPLATE PICKER (list + create/edit/delete) ────────────────
export function TemplatePicker({ org, onUseTemplate }) {
  const primary = org?.primary_color || '#1B9AAA'
  const { templates, loading, reload } = useImportTemplates(org?.id)
  const [showCreator, setShowCreator] = useState(false)
  const [editing, setEditing] = useState(null)

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return
    await supabase.from('import_templates').delete().eq('id', template.id)
    reload()
  }

  const downloadTemplateCSV = (template) => {
    const cols = template.fields.map(f => f.key)
    const sample = {
      first_name: 'Sarah', last_name: 'Jones', date_of_birth: '2015-06-14', group_name: 'Red',
      allergies: 'Nut allergy', medical_notes: 'Asthma', sen: '',
      emergency_contact_name: 'Jane Jones', emergency_contact_phone: '07700900000',
    }
    const row = cols.map(c => sample[c] || '').join(',')
    const blob = new Blob([`${cols.join(',')}\n${row}\n`], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-import.csv`
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>🧩 Import Templates</div>
        <button onClick={() => { setEditing(null); setShowCreator(true) }}
          style={{ fontSize: 11, fontWeight: 800, color: primary, background: primary + '10', border: `1px solid ${primary}30`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
          + New
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          No templates yet. Create one to define exactly which fields your register imports use.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {templates.map(t => (
            <div key={t.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditing(t); setShowCreator(true) }} title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: 2 }}>✏️</button>
                  <button onClick={() => handleDelete(t)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: 2 }}>🗑️</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{t.fields.length} field{t.fields.length !== 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => downloadTemplateCSV(t)} style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px', cursor: 'pointer' }}>⬇ CSV</button>
                <button onClick={() => onUseTemplate(t)} style={{ flex: 1, fontSize: 11, fontWeight: 800, color: '#fff', background: primary, border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer' }}>Use to Import</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreator && (
        <TemplateCreatorModal org={org} existingTemplate={editing} onClose={() => setShowCreator(false)}
          onSaved={() => { setShowCreator(false); reload() }} />
      )}
    </div>
  )
}

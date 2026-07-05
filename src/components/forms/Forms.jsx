import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'

const FIELD_TYPES = [
  { key: 'text',     label: 'Short Text',  icon: '📝' },
  { key: 'textarea', label: 'Long Text',   icon: '📄' },
  { key: 'checkbox', label: 'Checkbox',    icon: '☑️' },
  { key: 'select',   label: 'Dropdown',    icon: '🔽' },
  { key: 'date',     label: 'Date',        icon: '📅' },
  { key: 'number',   label: 'Number',      icon: '🔢' },
  { key: 'email',    label: 'Email',       icon: '📧' },
  { key: 'phone',    label: 'Phone',       icon: '📞' },
]

const TEMPLATES = [
  { name: 'Trip Consent Form', icon: '✅', desc: 'Permission slip for events & trips', fields: [
    { type: 'text', label: 'Child Full Name', required: true },
    { type: 'text', label: 'Parent / Guardian Name', required: true },
    { type: 'phone', label: 'Emergency Contact Number', required: true },
    { type: 'textarea', label: 'Medical Information or Allergies' },
    { type: 'checkbox', label: 'I consent to my child attending this trip or event', required: true },
    { type: 'checkbox', label: 'I consent to photos being taken of my child' },
  ]},
  { name: 'Incident Report', icon: '🚨', desc: 'Record accidents and incidents', fields: [
    { type: 'text', label: 'Person Involved', required: true },
    { type: 'date', label: 'Date of Incident', required: true },
    { type: 'text', label: 'Location', required: true },
    { type: 'select', label: 'Severity', required: true, options: ['Minor', 'Moderate', 'Serious', 'Critical'] },
    { type: 'textarea', label: 'Description of What Happened', required: true },
    { type: 'textarea', label: 'Action Taken', required: true },
    { type: 'text', label: 'Staff Member Reporting', required: true },
  ]},
  { name: 'Registration Form', icon: '📋', desc: 'Collect participant information', fields: [
    { type: 'text', label: 'Child First Name', required: true },
    { type: 'text', label: 'Child Last Name', required: true },
    { type: 'date', label: 'Date of Birth', required: true },
    { type: 'text', label: 'Parent / Guardian Name', required: true },
    { type: 'email', label: 'Parent Email', required: true },
    { type: 'phone', label: 'Parent Phone', required: true },
    { type: 'textarea', label: 'Medical Info / Allergies' },
    { type: 'checkbox', label: 'I agree to the programme terms and conditions', required: true },
  ]},
  { name: 'Session Feedback', icon: '⭐', desc: 'Gather feedback from participants', fields: [
    { type: 'text', label: 'Name (optional)' },
    { type: 'select', label: 'How would you rate today?', options: ['⭐ Needs Improvement', '⭐⭐ OK', '⭐⭐⭐ Good', '⭐⭐⭐⭐ Great', '⭐⭐⭐⭐⭐ Outstanding!'] },
    { type: 'textarea', label: 'What did you enjoy most?' },
    { type: 'textarea', label: 'What could we do better?' },
    { type: 'checkbox', label: 'I would recommend this programme to a friend' },
  ]},
  { name: 'Volunteer Application', icon: '❤️', desc: 'Onboard new volunteers', fields: [
    { type: 'text', label: 'Full Name', required: true },
    { type: 'email', label: 'Email Address', required: true },
    { type: 'phone', label: 'Phone Number', required: true },
    { type: 'date', label: 'Date of Birth', required: true },
    { type: 'textarea', label: 'Why do you want to volunteer with us?' },
    { type: 'textarea', label: 'Relevant skills or experience' },
    { type: 'select', label: 'Availability', options: ['Weekdays', 'Weekends', 'Both', 'Flexible'] },
    { type: 'checkbox', label: 'I agree to a DBS check if required', required: true },
  ]},
  { name: 'Risk Assessment', icon: '⚠️', desc: 'Document session risk assessments', fields: [
    { type: 'text', label: 'Activity or Session Name', required: true },
    { type: 'date', label: 'Assessment Date', required: true },
    { type: 'text', label: 'Assessor Name', required: true },
    { type: 'text', label: 'Location', required: true },
    { type: 'number', label: 'Estimated Number of Participants' },
    { type: 'textarea', label: 'Identified Hazards', required: true },
    { type: 'textarea', label: 'Control Measures in Place', required: true },
    { type: 'select', label: 'Overall Risk Level', options: ['Low', 'Medium', 'High', 'Very High'] },
    { type: 'checkbox', label: 'This risk assessment has been reviewed and approved', required: true },
  ]},
]

function FormBuilder({ org, initial, onSave, onCancel }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(initial || { name: '', description: '', fields: [] })
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  const addField = (type) => {
    const newField = { id: Date.now(), type, label: FIELD_TYPES.find(f => f.key === type)?.label || type, required: false, options: type === 'select' ? ['Option 1', 'Option 2'] : undefined }
    setForm(f => ({ ...f, fields: [...f.fields, newField] }))
  }

  const updateField = (id, changes) => setForm(f => ({ ...f, fields: f.fields.map(field => field.id === id ? { ...field, ...changes } : field) }))
  const removeField = (id) => setForm(f => ({ ...f, fields: f.fields.filter(field => field.id !== id) }))
  const moveField = (from, to) => {
    const fields = [...form.fields]
    const [moved] = fields.splice(from, 1)
    fields.splice(to, 0, moved)
    setForm(f => ({ ...f, fields }))
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 900 }}>{initial ? 'Edit Form' : 'Build New Form'}</div>
        <button onClick={handleSave} disabled={saving || !form.name} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: saving || !form.name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
          {saving ? 'Saving...' : '💾 Save Form'}
        </button>
      </div>

      {/* Form meta */}
      <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>FORM NAME *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Trip Consent Form" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DESCRIPTION</label>
            <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this form for?" style={inp} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 20 }}>
        {/* Add fields panel */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Add Fields</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FIELD_TYPES.map(ft => (
              <button key={ft.key} onClick={() => addField(ft.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${primary}30`, background: primary + '08', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = primary + '15'; e.currentTarget.style.borderColor = primary }}
                onMouseLeave={e => { e.currentTarget.style.background = primary + '08'; e.currentTarget.style.borderColor = primary + '30' }}>
                <span>{ft.icon}</span> {ft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields canvas */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>Form Fields ({form.fields.length})</div>
          </div>
          {form.fields.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', borderRadius: 14, border: '1.5px dashed #e5e7eb', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              Add fields from the left to build your form
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.fields.map((field, idx) => (
                <div key={field.id} draggable onDragOver={e => { e.preventDefault(); setDragOver(idx) }} onDrop={() => { if (dragOver !== null && dragOver !== idx) moveField(dragOver > idx ? dragOver : dragOver, idx); setDragOver(null) }} onDragStart={() => setDragOver(idx)}
                  style={{ background: '#fff', border: `1.5px solid ${dragOver === idx ? primary : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 16, marginTop: 2, cursor: 'grab', opacity: 0.4 }}>⠿</div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} style={{ ...inp, flex: 1, fontSize: 13, fontWeight: 600 }} placeholder="Field label" />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F3F4F6', borderRadius: 8, padding: '0 10px', fontSize: 11, fontWeight: 700, color: '#6B7280', flexShrink: 0 }}>
                            {FIELD_TYPES.find(f => f.key === field.type)?.icon} {field.type}
                          </div>
                        </div>
                        {field.type === 'select' && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>Options (one per line):</div>
                            <textarea value={(field.options || []).join('\n')} onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })} rows={3} style={{ ...inp, resize: 'none', fontSize: 12 }} />
                          </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer', marginTop: 4 }}>
                          <input type="checkbox" checked={field.required || false} onChange={e => updateField(field.id, { required: e.target.checked })} />
                          Required field
                        </label>
                      </div>
                      <button onClick={() => removeField(field.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 18, padding: 0, marginTop: 2 }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SubmissionsView({ form, org, onBack }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    supabase.from('form_submissions').select('*').eq('form_id', form.id).order('created_at', { ascending: false }).then(({ data }) => { setSubmissions(data || []); setLoading(false) })
  }, [form.id])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{form.name}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div>
      ) : submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 16, color: '#9CA3AF', border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 700 }}>No submissions yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Share the form link to start collecting responses</div>
        </div>
      ) : selected ? (
        <div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← All Submissions</button>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Submitted {format(new Date(selected.created_at), 'd MMM yyyy HH:mm')}</div>
            {form.fields.map((field, i) => (
              <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < form.fields.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>{field.label}</div>
                <div style={{ fontSize: 14, color: '#111' }}>
                  {field.type === 'checkbox' ? (selected.data?.[field.label] ? '✅ Yes' : '☐ No') : selected.data?.[field.label] || <span style={{ color: '#9CA3AF' }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {submissions.map((sub, i) => (
            <div key={sub.id} onClick={() => setSelected(sub)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = primary}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Submission #{submissions.length - i}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{format(new Date(sub.created_at), 'd MMM yyyy · HH:mm')}</div>
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>View →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Forms({ org }) {
  const isMobile = useIsMobile()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'builder' | 'submissions'
  const [selectedForm, setSelectedForm] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('org_forms').select('*, form_submissions(count)').eq('org_id', org.id).order('created_at', { ascending: false })
    setForms(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const saveForm = async (formData) => {
    if (selectedForm) {
      await supabase.from('org_forms').update({ name: formData.name, description: formData.description, fields: formData.fields }).eq('id', selectedForm.id)
    } else {
      await supabase.from('org_forms').insert({ org_id: org.id, name: formData.name, description: formData.description, fields: formData.fields })
    }
    load()
    setView('list')
    setSelectedForm(null)
  }

  const deleteForm = async (form) => {
    if (!window.confirm(`Delete "${form.name}"? All submissions will be lost.`)) return
    await supabase.from('org_forms').delete().eq('id', form.id)
    setForms(f => f.filter(x => x.id !== form.id))
  }

  const toggleActive = async (form) => {
    const updated = !form.is_active
    await supabase.from('org_forms').update({ is_active: updated }).eq('id', form.id)
    setForms(f => f.map(x => x.id === form.id ? { ...x, is_active: updated } : x))
  }

  if (view === 'builder') return <FormBuilder org={org} initial={selectedForm} onSave={saveForm} onCancel={() => { setView('list'); setSelectedForm(null) }} />
  if (view === 'submissions' && selectedForm) return <SubmissionsView form={selectedForm} org={org} onBack={() => { setView('list'); setSelectedForm(null); load() }} />

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>📝 Forms</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{forms.length} form{forms.length !== 1 ? 's' : ''} · {forms.reduce((s, f) => s + (f.form_submissions?.[0]?.count || 0), 0)} total submissions</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowTemplates(!showTemplates)} style={{ padding: '10px 18px', borderRadius: 12, border: `1.5px solid ${primary}`, background: '#fff', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              📋 Templates
            </button>
            <button onClick={() => { setSelectedForm(null); setView('builder') }} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              + Build Form
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Total Forms', value: forms.length, icon: '📝' },
            { label: 'Active', value: forms.filter(f => f.is_active).length, icon: '✅', color: '#16A34A' },
            { label: 'Submissions', value: forms.reduce((s, f) => s + (f.form_submissions?.[0]?.count || 0), 0), icon: '📬' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color || '#111' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Templates panel */}
      {showTemplates && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 16, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>📋 Start from a Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {TEMPLATES.map(t => (
              <button key={t.name} onClick={() => { setSelectedForm({ name: t.name, description: t.desc, fields: t.fields.map((f, i) => ({ ...f, id: Date.now() + i })) }); setView('builder'); setShowTemplates(false) }}
                style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #FDE68A', background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.background = primary + '05' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#FDE68A'; e.currentTarget.style.background = '#fff' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forms list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading forms...</div>
      ) : forms.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No forms yet</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Build custom forms for consent, feedback, applications and more</div>
          <button onClick={() => { setShowTemplates(true) }} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>📋 Browse Templates</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forms.map(form => {
            const subCount = form.form_submissions?.[0]?.count || 0
            return (
              <div key={form.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📝</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{form.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{form.description || 'No description'} · {(form.fields || []).length} fields · {subCount} submission{subCount !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => toggleActive(form)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${form.is_active ? '#16A34A40' : '#e5e7eb'}`, background: form.is_active ? '#F0FDF4' : '#F9FAFB', color: form.is_active ? '#16A34A' : '#9CA3AF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {form.is_active ? '✅ Active' : '⏸ Inactive'}
                  </button>
                  <button onClick={() => { setSelectedForm(form); setView('submissions') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    📬 {subCount}
                  </button>
                  <button onClick={() => { setSelectedForm({ ...form, fields: form.fields || [] }); setView('builder') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => deleteForm(form)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

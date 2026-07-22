import React, { useState, useRef } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren } from '../../lib/hooks'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TemplatePicker } from './TemplateCreator'

const DEFAULT_BUBBLES = [
  { key: 'red',    label: 'Red',    color: '#E53935', dark: '#B71C1C' },
  { key: 'green',  label: 'Green',  color: '#417505', dark: '#2E5204' },
  { key: 'yellow', label: 'Yellow', color: '#B8860B', dark: '#9A7209' },
  { key: 'blue',   label: 'Blue',   color: '#1B9AAA', dark: '#0D6B78' },
  { key: 'purple', label: 'Purple', color: '#7B2D8B', dark: '#5A1F66' },
  { key: 'teens',  label: 'Teens',  color: '#1A1A1A', dark: '#000' },
]

function normaliseBubbles(groups) {
  if (!groups?.length) return DEFAULT_BUBBLES
  return groups.map(g => ({ key: String(g.id || g.label).toLowerCase(), label: g.label, color: g.color || '#1B9AAA', dark: g.dark || g.color || '#0D6B78' }))
}

// ─── GROUPS QUICK SETUP ───────────────────────────────────────
// Reuses the same preset-chip pattern as the onboarding "Set up your groups"
// step, but as a standalone modal reachable from the Register at any time —
// not just during first-time onboarding.
const GROUP_PRESETS = ['Under 7s','Under 10s','Under 12s','Under 14s','Under 16s','Beginners','Intermediate','Advanced','Team A','Team B']
const GROUP_COLOR_SWATCHES = ['#4F6EF7','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899']

function GroupsQuickSetupModal({ org, initialGroups, onClose, onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [groups, setGroups] = useState(initialGroups || org?.custom_groups || [])
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(GROUP_COLOR_SWATCHES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasGroup = (label) => groups.some(g => g.label.toLowerCase() === label.toLowerCase())

  const addPreset = (label) => {
    if (hasGroup(label)) return
    setGroups(prev => [...prev, { id: 'g-' + Date.now() + label, label, color: newColor }])
  }

  const addCustom = () => {
    const label = newLabel.trim()
    if (!label || hasGroup(label)) return
    setGroups(prev => [...prev, { id: 'g-' + Date.now(), label, color: newColor }])
    setNewLabel('')
  }

  const removeGroup = (id) => setGroups(prev => prev.filter(g => g.id !== id))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      // Any group present before this edit but not in the final list was removed —
      // clear group_name for children still assigned to it so no one is left pointing
      // at a group that no longer exists.
      const before = initialGroups || org?.custom_groups || []
      const removedLabels = before.filter(og => !groups.some(g => g.id === og.id)).map(g => g.label).filter(Boolean)

      const { error: err } = await supabase.from('organisations').update({ custom_groups: groups }).eq('id', org.id)
      if (err) throw err

      if (removedLabels.length > 0) {
        for (const label of removedLabels) {
          await supabase.from('children').update({ group_name: null }).eq('org_id', org.id).ilike('group_name', label)
        }
      }

      onSaved(groups, removedLabels)
    } catch (e) {
      setError(e.message || 'Could not save groups')
    }
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg, #0B1023 0%, #131B33 100%)', borderRadius: 22, width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', padding: '26px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>🏷️ Set up your groups</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 20 }}>
          Add the groups your participants are organised into — like "Under 10s" or "Beginners".
        </div>

        {error && <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#FCA5A5', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>⚠️ {error}</div>}

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {GROUP_PRESETS.map(label => (
            <button key={label} onClick={() => addPreset(label)}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.15)', background: hasGroup(label) ? primary + '4d' : 'rgba(255,255,255,0.05)', color: hasGroup(label) ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + {label}
            </button>
          ))}
        </div>

        {/* Added groups */}
        {groups.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: '#fff' }}>{g.label}</span>
                <button onClick={() => removeGroup(g.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Custom add */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Custom group name..."
              style={{ flex: 1, padding: '15px 18px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 16, outline: 'none' }} />
            <label title="Pick a colour" style={{ position: 'relative', width: 54, height: 54, borderRadius: 14, flexShrink: 0, background: newColor, border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', border: 'none', padding: 0, cursor: 'pointer', opacity: 0 }} />
              <span style={{ fontSize: 16, pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>🎨</span>
            </label>
          </div>
          <button onClick={addCustom} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Add Group</button>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: saving ? '#6B7280' : `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {saving ? 'Saving...' : `Save ${groups.length} Group${groups.length !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  )
}

// ─── EDIT FORM ────────────────────────────────────────────────
// ─── EDIT FORM HELPERS (must be outside EditChildForm to avoid remount on every keystroke) ───
function FormSection({ icon, title, color, children }) {
  return (
    <div style={{ background: color + '08', border: `1px solid ${color}25`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

function FormCheck({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, borderRadius: 4, accentColor: '#1B9AAA', cursor: 'pointer' }} />
      {label}
    </label>
  )
}

function EditChildForm({ child, onSaved }) {
  const [form, setForm] = useState({
    first_name: child.first_name || '',
    last_name: child.last_name || '',
    date_of_birth: child.date_of_birth || '',
    group_name: child.group_name || '',
    school: child.school || '',
    // Medical
    has_asthma: child.has_asthma || false,
    has_diabetes: child.has_diabetes || false,
    has_epipen: child.has_epipen || false,
    has_medication: child.has_medication || false,
    allergies: child.allergies || '',
    medical_notes: child.medical_notes || '',
    // SEN
    sen: child.sen || '',
    has_behaviour_plan: child.has_behaviour_plan || false,
    behaviour_plan_notes: child.behaviour_plan_notes || '',
    // Travel
    travel_consent: child.travel_consent || false,
    // Emergency + Parent
    emergency_contact_name: child.emergency_contact_name || '',
    emergency_contact_phone: child.emergency_contact_phone || '',
    parent_name: child.parent_name || '',
    parent_phone: child.parent_phone || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const fi = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }
  const lb = { fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('children').update({
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null, group_name: form.group_name || null,
      school: form.school || null,
      has_asthma: form.has_asthma, has_diabetes: form.has_diabetes,
      has_epipen: form.has_epipen, has_medication: form.has_medication,
      allergies: form.allergies || null, medical_notes: form.medical_notes || null,
      sen: form.sen || null, has_behaviour_plan: form.has_behaviour_plan,
      behaviour_plan_notes: form.behaviour_plan_notes || null,
      travel_consent: form.travel_consent,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      parent_name: form.parent_name || null, parent_phone: form.parent_phone || null,
    }).eq('id', child.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Basic info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginBottom: 8 }}>
        <div><label style={lb}>First Name *</label><input style={fi} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label style={lb}>Last Name *</label><input style={fi} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginBottom: 10 }}>
        <div><label style={lb}>Date of Birth</label><input style={fi} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
        <div><label style={lb}>Group</label><input style={fi} value={form.group_name} onChange={e => set('group_name', e.target.value)} placeholder="e.g. Blues" /></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={lb}>School</label><input style={fi} value={form.school} onChange={e => set('school', e.target.value)} placeholder="e.g. Ark Burlington Danes" /></div>

      {/* Medical */}
      <FormSection icon="⚕️" title="Medical Conditions" color="#0891B2">
        <FormCheck label="Asthma" value={form.has_asthma} onChange={v => set('has_asthma', v)} />
        <FormCheck label="Diabetes" value={form.has_diabetes} onChange={v => set('has_diabetes', v)} />
        <FormCheck label="Severe Allergy (EpiPen)" value={form.has_epipen} onChange={v => set('has_epipen', v)} />
        <FormCheck label="Takes regular medication" value={form.has_medication} onChange={v => set('has_medication', v)} />
        <div style={{ marginTop: 6 }}>
          <label style={lb}>Allergies / Other Medical Condition</label>
          <input style={fi} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="Describe any allergies or conditions..." />
        </div>
        <div style={{ marginTop: 6 }}>
          <label style={lb}>Medical Notes</label>
          <input style={fi} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="Any further medical detail..." />
        </div>
      </FormSection>

      {/* SEN */}
      <FormSection icon="🧩" title="SEN Needs" color="#059669">
        <div style={{ marginBottom: 8 }}>
          <label style={lb}>SEN Details</label>
          <input style={fi} value={form.sen} onChange={e => set('sen', e.target.value)} placeholder="e.g. ADHD, Autism Spectrum, Learning Difficulties..." />
        </div>
        <FormCheck label="Has a Behaviour Support Plan" value={form.has_behaviour_plan} onChange={v => set('has_behaviour_plan', v)} />
        {form.has_behaviour_plan && (
          <div style={{ marginTop: 6 }}>
            <label style={lb}>Behaviour Plan Notes</label>
            <input style={fi} value={form.behaviour_plan_notes} onChange={e => set('behaviour_plan_notes', e.target.value)} placeholder="Key details of the plan..." />
          </div>
        )}
      </FormSection>

      {/* Travel */}
      <FormSection icon="🚶" title="Travel Consent" color="#D97706">
        <FormCheck label="This child has consent to travel home alone" value={form.travel_consent} onChange={v => set('travel_consent', v)} />
      </FormSection>

      {/* Emergency Contact */}
      <FormSection icon="📞" title="Emergency Contact" color="#7C3AED">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <div><label style={lb}>Name</label><input style={fi} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Full name" /></div>
          <div><label style={lb}>Phone</label><input style={fi} type="tel" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="07700 900 000" /></div>
        </div>
      </FormSection>

      {/* Parent / Carer */}
      <FormSection icon="❤️" title="Parent / Carer" color="#DB2777">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <div><label style={lb}>Parent Name</label><input style={fi} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} placeholder="Full name" /></div>
          <div><label style={lb}>Parent Phone</label><input style={fi} type="tel" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} placeholder="07700 900 000" /></div>
        </div>
      </FormSection>

      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: saving ? '#9ca3af' : '#111', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {saving ? 'Saving...' : '⊙ Save Changes'}
      </button>
    </div>
  )
}

// ─── INLINE IMPORT ────────────────────────────────────────────
const CSV_COLS = ['first_name','last_name','date_of_birth','group_name','allergies','medical_notes','sen','emergency_contact_name','emergency_contact_phone']

function InlineChildImport({ org, template, onImported }) {
  const [step, setStep] = useState('upload')
  const [csvText, setCsvText] = useState('')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const inputRef = useRef(null)
  const primary = org?.primary_color || '#1B9AAA'

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return { rows: [], errs: ['Need a header row and at least one data row'] }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'))
    const errs = [], parsed = []
    lines.slice(1).forEach((line, i) => {
      const vals = []; let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
        else cur += ch
      }
      vals.push(cur.trim())
      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })
      if (!row.first_name) errs.push(`Row ${i+2}: missing first_name`)
      if (!row.last_name) errs.push(`Row ${i+2}: missing last_name`)
      parsed.push(row)
    })
    return { rows: parsed, errs }
  }

  const handleFile = (file) => {
    if (!file?.name.match(/\.(csv|txt)$/i)) return
    const reader = new FileReader()
    reader.onload = e => { const text = e.target.result; setCsvText(text); const { rows: p, errs } = parseCSV(text); setRows(p); setErrors(errs); setStep('preview') }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const records = rows.filter(r => r.first_name && r.last_name).map(r => ({
      first_name: r.first_name.trim(), last_name: r.last_name.trim(),
      date_of_birth: r.date_of_birth || null, group_name: r.group_name || null,
      allergies: r.allergies || null, medical_notes: r.medical_notes || null,
      emergency_contact_name: r.emergency_contact_name || null,
      emergency_contact_phone: r.emergency_contact_phone || null, active: true,
    }))
    const res = await fetch('/api/import-children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ org_id: org.id, records }),
    })
    const json = await res.json()
    setImporting(false)
    if (json.error) { setErrors([json.error]); return }
    const { data: all } = await supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('last_name')
    onImported(all || [])
  }

  const downloadTemplate = () => {
    const sample = { first_name: 'Sarah', last_name: 'Jones', date_of_birth: '2015-06-14', group_name: 'Red', allergies: 'Nut allergy', medical_notes: 'Asthma', sen: '', emergency_contact_name: 'Jane Jones', emergency_contact_phone: '07700900000' }
    const cols = template?.fields?.length ? template.fields.map(f => f.key) : CSV_COLS
    const row = cols.map(c => sample[c] || '').join(',')
    const blob = new Blob([`${cols.join(',')}\n${row}\n`], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${template?.name?.replace(/[^a-z0-9]+/gi,'-').toLowerCase() || 'children'}-import.csv`; a.click()
  }

  const fi = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }

  if (step === 'preview') return (
    <div>
      {errors.length > 0 && <div style={{ background: '#FFF0F0', border: '1px solid #FFB3B3', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
        {errors.map((e,i) => <div key={i} style={{ fontSize: 11, color: '#C00' }}>⚠ {e}</div>)}
      </div>}
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600 }}>{rows.length} records ready</div>
      <div style={{ background: '#F9FAFB', borderRadius: 8, border: '1px solid #e5e7eb', maxHeight: 140, overflowY: 'auto', marginBottom: 10 }}>
        {rows.slice(0,8).map((r,i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 10px', borderBottom: '1px solid #F3F4F6', fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: r.first_name ? '#111' : '#C00', minWidth: 80 }}>{r.first_name || '⚠'} {r.last_name}</span>
            <span style={{ color: '#9CA3AF' }}>{r.group_name || 'Ungrouped'}</span>
          </div>
        ))}
        {rows.length > 8 && <div style={{ padding: '5px 10px', fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>+{rows.length - 8} more</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setStep('upload')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>← Back</button>
        <button onClick={handleImport} disabled={importing || errors.length > 0} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: errors.length > 0 ? '#9CA3AF' : primary, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
          {importing ? 'Importing...' : `Import ${rows.filter(r=>r.first_name&&r.last_name).length}`}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
        style={{ border: `2px dashed ${primary}50`, borderRadius: 10, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', background: primary + '06', marginBottom: 8 }}>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 20, marginBottom: 4 }}>📂</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Drop CSV or click to browse</div>
      </div>
      <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="or paste CSV here..." rows={3} style={fi} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={downloadTemplate} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${primary}40`, background: primary + '10', color: primary, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⬇ Template</button>
        <button onClick={() => { const { rows: p, errs } = parseCSV(csvText); setRows(p); setErrors(errs); setStep('preview') }} disabled={!csvText.trim()}
          style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: csvText.trim() ? primary : '#9CA3AF', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Preview →</button>
      </div>
    </div>
  )
}

// ─── MARK MODAL ───────────────────────────────────────────────
function MarkModal({ child, status, bColor, onClose, onMark }) {
  const [absenceReason, setAbsenceReason] = useState('')
  const name = `${child.first_name} ${child.last_name}`
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 700, backdropFilter: 'blur(3px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(420px,100vw)', background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', zIndex: 701, boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E5E7EB', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 18 }}>Mark attendance for this session</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
          <button onClick={() => onMark('signed_in')} disabled={status === 'signed_in'}
            style={{ padding: '16px 12px', borderRadius: 14, border: 'none', background: status === 'signed_in' ? '#DCFCE7' : '#16A34A', color: status === 'signed_in' ? '#16A34A' : '#fff', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            ✅ {status === 'signed_in' ? 'Signed In' : 'Sign In'}
          </button>
          <button onClick={() => onMark('signed_out')} disabled={status !== 'signed_in'}
            style={{ padding: '16px 12px', borderRadius: 14, border: 'none', background: status === 'signed_out' ? '#DBEAFE' : status === 'signed_in' ? bColor : '#F3F4F6', color: status === 'signed_out' ? '#1D4ED8' : status === 'signed_in' ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            👋 {status === 'signed_out' ? 'Signed Out' : 'Sign Out'}
          </button>
        </div>
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
          <input value={absenceReason} onChange={e => setAbsenceReason(e.target.value)} placeholder="Absence reason (optional)..."
            style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => onMark('absent', { absence_reason: absenceReason })}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            ✕ Mark Absent
          </button>
        </div>
      </div>
    </>
  )
}

// ─── NOTES TAB ────────────────────────────────────────────────
function NotesTab({ child }) {
  const [notes, setNotes] = useState(child.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = React.useRef(null)

  const save = React.useCallback(async (value) => {
    setSaving(true)
    await supabase.from('children').update({ notes: value || null }).eq('id', child.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [child.id])

  const handleChange = (e) => {
    const value = e.target.value
    setNotes(value)
    setSaved(false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 1200)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Private notes about {child.first_name}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: saving ? '#F59E0B' : saved ? '#16A34A' : 'transparent' }}>
          {saving ? 'Saving...' : '✓ Saved'}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder={`Add notes about ${child.first_name} — behaviour, progress, parent conversations, anything relevant...`}
        style={{ width: '100%', minHeight: 200, padding: '12px 14px', borderRadius: 14, border: '1.5px solid #E2E8F0', fontSize: 13, lineHeight: 1.7, color: '#0F172A', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#FAFBFC' }}
      />
      <div style={{ fontSize: 11, color: '#94A3B8' }}>Auto-saves as you type. Visible to admins and staff only.</div>
    </div>
  )
}

// ─── CHILD DRAWER ─────────────────────────────────────────────
function ChildDrawer({ child, status, attendanceRecord, bubble, bubbles = [], onClose, primary, hasSession, onGroupChange, onChildUpdated }) {
  const isMobile = useIsMobile()
  const [drawerTab, setDrawerTab] = useState('info')
  const [photoUrl, setPhotoUrl] = useState(child.photo_url || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const currentGroup = child.group_name || ''
  const photoInputRef = React.useRef()

  const name = `${child.first_name} ${child.last_name}`
  const initials = `${child.first_name[0]}${child.last_name[0]}`
  const age = child.date_of_birth ? Math.floor((new Date() - new Date(child.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const hasAlerts = child.allergies || child.medical_notes
  const bColor = bubble?.color || primary || '#1B9AAA'

  const statusCfg = {
    signed_in:  { label: 'Signed In',  color: '#16A34A', bg: '#DCFCE7', icon: '✓' },
    signed_out: { label: 'Signed Out', color: '#2563EB', bg: '#DBEAFE', icon: '↗' },
    absent:     { label: 'Absent',     color: '#DC2626', bg: '#FEE2E2', icon: '✕' },
    expected:   { label: 'Expected',   color: '#D97706', bg: '#FEF3C7', icon: '◌' },
    unmarked:   { label: 'Not marked', color: '#6B7280', bg: '#F3F4F6', icon: '—' },
  }
  const sc = statusCfg[status] || statusCfg.unmarked

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `children/${child.id}/photo.${ext}`
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { upsert: true, contentType: file.type })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.from('children').update({ photo_url: url }).eq('id', child.id)
      setPhotoUrl(url)
    }
    setUploadingPhoto(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 600, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: isMobile ? '24px 24px 0 0' : 24, width: '100%', maxWidth: isMobile ? '100%' : 440, maxHeight: isMobile ? '94vh' : '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}>

        {/* Mobile drag handle */}
        {isMobile && <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}><div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.12)' }} /></div>}

        {/* ── HERO HEADER ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          {/* Coloured accent bar */}
          <div style={{ height: 5, background: `linear-gradient(90deg, ${bColor}, ${bColor}99)`, borderRadius: '0 0 0 0' }} />

          {/* Top controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
            <button onClick={async e => { e.stopPropagation(); if (!window.confirm(`Remove ${name} from the register?`)) return; await supabase.from('children').update({ active: false }).eq('id', child.id); onClose() }}
              style={{ padding: '5px 12px', borderRadius: 99, background: '#FEF2F2', border: '1px solid #FECACA', cursor: 'pointer', color: '#DC2626', fontSize: 11, fontWeight: 700 }}>
              Remove
            </button>
            <button onClick={e => { e.stopPropagation(); onClose() }}
              style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {/* Identity row */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '14px 16px 12px' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: bColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#fff', overflow: 'hidden', boxShadow: `0 8px 24px -8px ${bColor}90` }}>
                {photoUrl
                  ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{initials}</span>
                }
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>
              <button onClick={e => { e.stopPropagation(); photoInputRef.current?.click() }}
                style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: '50%', background: '#fff', border: `2px solid ${bColor}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>📷</button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>

            {/* Name + key facts */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', letterSpacing: -0.3, lineHeight: 1.15, marginBottom: 8 }}>{name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                {age !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', background: '#F1F5F9', borderRadius: 99, padding: '2px 9px' }}>Age {age}</span>
                )}
                {(bubble || currentGroup) && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: bColor, borderRadius: 99, padding: '2px 9px' }}>{bubble?.label || currentGroup}</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 800, color: sc.color, background: sc.bg, borderRadius: 99, padding: '2px 9px' }}>{sc.icon} {sc.label}</span>
              </div>
            </div>
          </div>

          {/* ── ALERT STRIP — prominent, can't miss it ── */}
          {(hasAlerts || child.has_epipen || child.has_asthma || child.has_diabetes || child.has_medication) && (
            <div style={{ margin: '0 16px 12px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#D97706', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚠️ Medical Alerts
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: (child.allergies || child.medical_notes) ? 8 : 0 }}>
                {child.has_epipen && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', borderRadius: 8, padding: '2px 8px' }}>💉 EpiPen</span>}
                {child.has_asthma && <span style={{ fontSize: 11, fontWeight: 700, color: '#0891B2', background: '#E0F2FE', borderRadius: 8, padding: '2px 8px' }}>🫁 Asthma</span>}
                {child.has_diabetes && <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', borderRadius: 8, padding: '2px 8px' }}>💊 Diabetes</span>}
                {child.has_medication && <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', background: '#FEF3C7', borderRadius: 8, padding: '2px 8px' }}>💊 Medication</span>}
              </div>
              {child.allergies && <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Allergies: {child.allergies}</div>}
              {child.medical_notes && <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>Notes: {child.medical_notes}</div>}
            </div>
          )}

          {/* Sign in/out times if applicable */}
          {(signedInTime || signedOutTime) && (
            <div style={{ display: 'flex', gap: 8, margin: '0 16px 12px' }}>
              {signedInTime && (
                <div style={{ flex: 1, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 1 }}>Signed In</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#15803D' }}>{signedInTime}</div>
                </div>
              )}
              {signedOutTime && (
                <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1 }}>Signed Out</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1D4ED8' }}>{signedOutTime}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', padding: '8px 12px', gap: 4, background: '#fff', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          {[
            ['info', 'Info'],
            ['notes', 'Notes'],
            ['edit', 'Edit'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setDrawerTab(key)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', background: drawerTab === key ? bColor : 'transparent', color: drawerTab === key ? '#fff' : '#94A3B8', fontWeight: drawerTab === key ? 800 : 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '16px 18px 24px', flex: 1 }}>

          {/* INFO */}
          {drawerTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Basic */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Date of Birth</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{child.date_of_birth ? format(new Date(child.date_of_birth), 'd MMM yyyy') : '—'}</div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Age</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{age !== null ? `${age} years old` : '—'}</div>
                </div>
              </div>
              {child.school && (
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 14px', border: '1px solid #F1F5F9', fontSize: 13, color: '#374151' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 2 }}>School</span>
                  {child.school}
                </div>
              )}

              {/* SEN */}
              {(child.sen || child.has_behaviour_plan) && (
                <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>🧩 SEN Needs</div>
                  {child.sen && <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{child.sen}</div>}
                  {child.has_behaviour_plan && <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.1)', borderRadius: 8, padding: '2px 8px' }}>Behaviour Plan</span>}
                </div>
              )}

              {/* Travel consent */}
              {child.travel_consent && (
                <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🚶</span>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>Consent to travel home alone</div>
                </div>
              )}

              {/* Emergency Contact */}
              <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>📞 Emergency Contact</div>
                {child.emergency_contact_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 2 }}>{child.emergency_contact_name}</div>
                      {child.emergency_contact_phone && (
                        <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'none', fontWeight: 700 }}>{child.emergency_contact_phone}</a>
                      )}
                    </div>
                    {child.emergency_contact_phone && (
                      <a href={`tel:${child.emergency_contact_phone}`} style={{ width: 38, height: 38, borderRadius: 11, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>📞</a>
                    )}
                  </div>
                ) : <div style={{ fontSize: 12, color: '#9CA3AF' }}>No emergency contact set</div>}
              </div>

              {/* Parent / Carer */}
              {(child.parent_name || child.parent_phone) && (
                <div style={{ background: 'rgba(219,39,119,0.06)', border: '1px solid rgba(219,39,119,0.2)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#DB2777', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>❤️ Parent / Carer</div>
                  {child.parent_name && <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 2 }}>{child.parent_name}</div>}
                  {child.parent_phone && <a href={`tel:${child.parent_phone}`} style={{ fontSize: 13, color: '#DB2777', textDecoration: 'none', fontWeight: 700 }}>{child.parent_phone}</a>}
                </div>
              )}
            </div>
          )}

          {drawerTab === 'notes' && <NotesTab child={child} />}

          {/* EDIT */}
          {drawerTab === 'edit' && <EditChildForm child={child} onSaved={() => onChildUpdated ? onChildUpdated(child.id) : onClose()} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}


// ─── CHILD CARD ───────────────────────────────────────────────
function ChildCard({ child, status, bubble, onClick, onMark, primary, selected, onToggleSelect }) {
  const bColor = bubble?.color || primary || '#1B9AAA'
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const [hovered, setHovered] = React.useState(false)

  const statusConfig = {
    signed_in:  { label: 'In',          bg: '#DCFCE7', color: '#15803D', dot: '#16A34A' },
    signed_out: { label: 'Out',         bg: '#DBEAFE', color: '#1D4ED8', dot: '#2563EB' },
    absent:     { label: 'Absent',      bg: '#FEE2E2', color: '#B91C1C', dot: '#DC2626' },
    expected:   { label: 'Expected',    bg: '#F1F5F9', color: '#94A3B8', dot: '#CBD5E1' },
    unmarked:   { label: 'Not marked',  bg: '#F1F5F9', color: '#94A3B8', dot: '#CBD5E1' },
  }
  const sc = statusConfig[status] || statusConfig.unmarked

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: selected ? `${primary}12` : hovered ? `${bColor}10` : `${bColor}06`,
        border: `1.5px solid ${selected ? primary + '40' : hovered ? bColor + '30' : bColor + '18'}`,
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? `0 4px 14px -8px ${bColor}40` : '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Checkbox */}
      <button onClick={e => { e.stopPropagation(); onToggleSelect(child.id) }}
        style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${selected ? primary : '#D1D5DB'}`, background: selected ? primary : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>
        {selected ? '✓' : ''}
      </button>

      {/* Avatar + name — opens info drawer */}
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: bColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden', boxShadow: `0 3px 10px -4px ${bColor}80`, transition: 'transform 0.15s', transform: hovered ? 'scale(1.05)' : 'none' }}>
          {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {child.first_name} {child.last_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: bubble ? bColor : '#94A3B8' }}>{bubble?.label || 'Ungrouped'}</span>
            {child.allergies && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#D97706', background: '#FEF3C7', borderRadius: 6, padding: '1px 6px' }}>⚠ ALLERGY</span>
            )}
            {child.medical_notes && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', borderRadius: 6, padding: '1px 6px' }}>✚ MEDICAL</span>
            )}
          </div>
        </div>
      </div>

      {/* Status badge — tappable during live session */}
      <div
        onClick={e => { e.stopPropagation(); if (onMark) onMark() }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: sc.bg, borderRadius: 99, padding: '5px 12px', flexShrink: 0, cursor: onMark ? 'pointer' : 'default', transition: 'transform 0.12s' }}
        onMouseEnter={e => { if (onMark) e.currentTarget.style.transform = 'scale(1.06)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: sc.color }}>{sc.label}</span>
      </div>
    </div>
  )
}

// ─── ENCOURAGEMENT PANEL ─────────────────────────────────────
function EncouragementPanel({ org, primary }) {
  const orgName = org?.name || 'your team'
  const quotes = [
    { text: `Every child who walks through that door is lucky to have ${orgName} in their corner.`, emoji: '⭐' },
    { text: 'You\'re not just running a session. You\'re building someone\'s highlight reel.', emoji: '🌟' },
    { text: `The work ${orgName} does today will stay with these young people for life.`, emoji: '💛' },
    { text: 'Small moments of connection matter more than you know. Keep showing up.', emoji: '🤝' },
    { text: `${orgName} is the reason some of these kids get out of bed on a Saturday.`, emoji: '🚀' },
    { text: 'You are the constant in someone\'s inconsistent world. That\'s everything.', emoji: '🏡' },
    { text: 'Every register signed is a young person who chose to be here. That\'s because of you.', emoji: '✅' },
    { text: 'The best youth workers don\'t just teach skills — they teach kids they matter.', emoji: '❤️' },
    { text: `What ${orgName} is building here is bigger than any one session.`, emoji: '🏗️' },
    { text: 'Someone in this room today will remember this moment for the rest of their life.', emoji: '✨' },
    { text: 'You chose the hardest and most important job there is. Thank you.', emoji: '🙏' },
    { text: `${orgName} — turning up, every time, for every child. That's the work.`, emoji: '💪' },
  ]

  // Seed by day so it changes daily but is consistent within a session
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const quote = quotes[dayIndex % quotes.length]

  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', marginTop: 'auto' }}>
      <div style={{ background: `linear-gradient(135deg, ${primary}10, ${primary}06)`, border: `1px solid ${primary}20`, borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>{quote.emoji}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
          "{quote.text}"
        </div>
      </div>
    </div>
  )
}

// ─── MAIN REGISTER ────────────────────────────────────────────
export default function Registers({ org, onNavigate }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const isMobile = useIsMobile()
  const { groups: orgGroups, refetch: refetchOrgSettings } = useOrgSettings(orgId)
  const bubbles = normaliseBubbles(orgGroups)
  const { session } = useTodaySession(orgId)
  const { children, setChildren, loading } = useChildren(orgId)
  const { attendance, updateStatus, addAttendanceRow } = useAttendance(session?.id)

  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('all')
  const [selectedChild, setSelectedChild] = useState(null)
  const [markChild, setMarkChild] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [showBulkGroupPicker, setShowBulkGroupPicker] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGroupsSetup, setShowGroupsSetup] = useState(false)
  const [activeImportTemplate, setActiveImportTemplate] = useState(null)
  const [toast, setToast] = useState('')
  const [note, setNote] = useState('')

  const getAttRec = (id) => attendance.find(a => a.child_id === id)
  const getStatus = (id) => getAttRec(id)?.status || 'unmarked'
  const getBubble = (child) => bubbles.find(b => {
    const g = (child.group_name || '').toLowerCase()
    return g === b.key || g === b.label.toLowerCase()
  }) || null

  const handlePrint = () => {
    const rows = children.map(c => {
      const status = getStatus(c.id)
      const bubble = getBubble(c)
      const statusLabel = { signed_in: 'In', signed_out: 'Out', absent: 'Absent', expected: 'Expected', unmarked: '—' }[status] || '—'
      const alerts = [c.allergies && '⚠ Allergy', c.medical_notes && '✚ Medical', c.has_epipen && '💉 EpiPen'].filter(Boolean).join('  ')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700">${c.first_name} ${c.last_name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:${bubble?.color || '#64748b'};font-weight:700">${bubble?.label || 'Ungrouped'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#dc2626">${alerts}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:800;color:${status === 'signed_in' ? '#16a34a' : status === 'absent' ? '#dc2626' : '#64748b'}">${statusLabel}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#94a3b8;font-size:12px">_______________</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>Register — ${org?.name || ''}</title>
    <style>body{font-family:system-ui,sans-serif;color:#111;padding:24px}h1{font-size:20px;font-weight:900;margin:0 0 4px}p{margin:0 0 16px;color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse}th{padding:8px 10px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #e5e7eb}@media print{button{display:none}}</style>
    </head><body>
    <h1>${session?.title || 'Register'} — ${org?.name || ''}</h1>
    <p>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; ${children.length} children</p>
    <table><thead><tr>
      <th>Name</th><th>Group</th><th>Alerts</th><th>Status</th><th>Signature</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const toggleSelect = (childId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(childId)) next.delete(childId)
      else next.add(childId)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkAssignGroup = async (groupLabel) => {
    if (selectedIds.size === 0) return
    setBulkAssigning(true)
    try {
      const ids = [...selectedIds]
      const { error: err } = await supabase.from('children').update({ group_name: groupLabel }).in('id', ids)
      if (err) throw err
      setChildren(prev => prev.map(c => ids.includes(c.id) ? { ...c, group_name: groupLabel } : c))
      showToast(`✅ Moved ${ids.length} ${ids.length === 1 ? 'child' : 'children'} to ${groupLabel}`)
      clearSelection()
      setShowBulkGroupPicker(false)
    } catch (e) {
      showToast(`⚠️ Could not assign group: ${e.message || 'unknown error'}`)
    }
    setBulkAssigning(false)
  }

  const handleUpdateStatus = async (childId, status, extra = {}) => {
    const existing = attendance.find(a => a.child_id === childId)
    const now = new Date().toISOString()
    const child = children.find(c => c.id === childId)
    const name = child ? `${child.first_name} ${child.last_name}` : 'Child'
    if (existing) {
      const updates = { status, ...extra }
      if (status === 'signed_in' && !existing.signed_in_at) updates.signed_in_at = now
      if (status === 'signed_out') updates.signed_out_at = now
      await updateStatus(existing.id, status, updates)
    } else if (session?.id) {
      const updates = { status, org_id: orgId, ...extra }
      if (status === 'signed_in') updates.signed_in_at = now
      const newRow = { session_id: session.id, child_id: childId, ...updates }
      const { data } = await supabase.from('attendance').insert([newRow]).select().single()
      if (data) addAttendanceRow(data)
    }
    const t = format(new Date(), 'HH:mm')
    if (status === 'signed_in') showToast(`✓ ${name} signed in at ${t}`)
    else if (status === 'signed_out') showToast(`${name} signed out at ${t}`)
    else showToast(`${name} marked absent`)
  }

  const counts = {
    total:      children.length,
    signed_in:  children.filter(c => getStatus(c.id) === 'signed_in').length,
    absent:     children.filter(c => getStatus(c.id) === 'absent').length,
    expected:   children.filter(c => getStatus(c.id) === 'expected').length,
    signed_out: children.filter(c => getStatus(c.id) === 'signed_out').length,
  }

  // Available groups — configured groups only. A child's group_name that no
  // longer matches a configured group (e.g. the group was since deleted or
  // renamed) is treated as ungrouped, not surfaced as a phantom filter tab.
  const availableGroups = React.useMemo(() => bubbles.map(b => b.label), [bubbles])

  const filtered = children.filter(c => {
    const nameOk = !search.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const groupOk = activeGroup === 'all' || (c.group_name || '').toLowerCase() === activeGroup.toLowerCase()
    return nameOk && groupOk
  })

  const attendanceRate = counts.total > 0 ? Math.round((counts.signed_in / counts.total) * 100) : 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', borderRadius: 12, padding: '11px 20px', fontSize: 13, fontWeight: 700, zIndex: 900, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#4ADE80' }}>✓</span> {toast}
        </div>
      )}

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ background: '#fff', borderBottom: `2px solid ${primary}18`, padding: '14px 20px 10px', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${primary}44, transparent)` }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#111', fontFamily: 'var(--font-display)' }}>
                  {session?.title || 'Register'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '3px 10px', background: session ? '#DCFCE7' : '#F3F4F6', color: session ? '#15803D' : '#9CA3AF' }}>
                  {session ? '● Live' : 'No Session'}
                </span>
              </div>
              {session && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>📅 {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  {session.start_time && <span style={{ fontSize: 12, color: '#9CA3AF' }}>🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</span>}
                  {session.location && <span style={{ fontSize: 12, color: '#9CA3AF' }}>📍 {session.location.split(',')[0]}</span>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {session && (
                <button onClick={() => setShowAdd(true)} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${primary}40`, background: primary + '10', color: primary, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  + Walk-in
                </button>
              )}
              <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                + Add Child
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 10px', border: '1.5px solid #E2E8F0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{counts.total}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 4 }}>On Register</div>
            </div>
            <div style={{ background: '#F0FDF4', borderRadius: 14, padding: '12px 10px', border: '1.5px solid #BBF7D0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#15803D', lineHeight: 1 }}>{counts.signed_in}</div>
              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 4 }}>Signed In</div>
            </div>
            <div style={{ background: '#FFFBEB', borderRadius: 14, padding: '12px 10px', border: '1.5px solid #FDE68A', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#D97706', lineHeight: 1 }}>{counts.expected}</div>
              <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600, marginTop: 4 }}>Yet to Arrive</div>
            </div>
          </div>

          {/* Attendance bar */}
          {counts.total > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Attendance</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: primary }}>{attendanceRate}%</span>
              </div>
              <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${attendanceRate}%`, background: `linear-gradient(90deg, ${primary}, #16A34A)`, borderRadius: 99, transition: 'width 0.5s' }} />
              </div>
            </div>
          )}

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9CA3AF' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              style={{ width: '100%', boxSizing: 'border-box', padding: isMobile ? '8px 10px 8px 32px' : '9px 12px 9px 36px', borderRadius: 10, border: `1.5px solid ${primary}25`, background: primary + '06', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = primary}
              onBlur={e => e.target.style.borderColor = primary + '25'}
            />
          </div>
        </div>

        {/* GROUP FILTER */}
        {availableGroups.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #F3F4F6', overflowX: 'auto', flexShrink: 0 }}>
            {['all', ...availableGroups].map(g => {
              const bubble = g === 'all' ? null : bubbles.find(b => b.label.toLowerCase() === g.toLowerCase())
              const isActive = activeGroup === g
              return (
                <button key={g} onClick={() => setActiveGroup(g)} style={{
                  padding: '5px 14px', borderRadius: 99, border: `1.5px solid ${isActive ? (bubble?.color || primary) : '#e5e7eb'}`,
                  background: isActive ? (bubble?.color || primary) + '18' : '#fff',
                  color: isActive ? (bubble?.color || primary) : '#6B7280',
                  fontSize: 12, fontWeight: isActive ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5
                }}>
                  {bubble && <span style={{ width: 8, height: 8, borderRadius: '50%', background: bubble.color, display: 'inline-block' }} />}
                  {g === 'all' ? 'All Groups' : g}
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {g === 'all' ? children.length : children.filter(c => (c.group_name || '').toLowerCase() === g.toLowerCase()).length}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* CHILDREN LIST */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', padding: isMobile ? '10px 10px' : '12px 14px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>Loading register...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👧</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#374151', marginBottom: 6 }}>{children.length === 0 ? 'No children yet' : 'No matches'}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>{children.length === 0 ? 'Add or import children to get started' : 'Try a different search or filter'}</div>
              {children.length === 0 && (
                <button onClick={() => setShowImport(true)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📥 Import Children</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(child => (
                <ChildCard
                  key={child.id}
                  child={child}
                  status={getStatus(child.id)}
                  bubble={getBubble(child)}
                  primary={primary}
                  selected={selectedIds.has(child.id)}
                  onToggleSelect={toggleSelect}
                  onClick={() => setSelectedChild({ child, status: getStatus(child.id), attRec: getAttRec(child.id) })}
                  onMark={session ? () => setMarkChild({ child, status: getStatus(child.id) }) : null}
                />
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        {!isMobile && (
          <div style={{ background: '#fff', borderTop: '1px solid #F3F4F6', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{filtered.length} of {children.length} shown</div>
          </div>
        )}
      </div>

      {/* SIDEBAR TOOLS — desktop only */}
      {!isMobile && (
        <div style={{ width: 220, background: '#fff', borderLeft: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 10 }}>Register Tools</div>
            {[
              { icon: '➕', label: 'Add Child', sub: 'Not on list', action: () => setShowAdd(true) },
              { icon: '🏷️', label: 'Manage Groups', sub: 'Quick add & colours', action: () => setShowGroupsSetup(true) },
              { icon: '📥', label: 'Import Children', sub: 'Bulk add from CSV', action: () => setShowImport(v => !v) },
              { icon: '🧩', label: 'Import Templates', sub: 'Customise import fields', action: () => setShowTemplates(v => !v) },
              { icon: '🖨', label: 'Print Register', sub: 'Print attendance sheet', action: () => handlePrint() },
            ].map(t => (
              <button key={t.label} onClick={t.action}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 14, border: '1px solid #F3F4F6', background: '#FAFBFC', cursor: t.action ? 'pointer' : 'default', textAlign: 'left', marginBottom: 6, transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease' }}
                onMouseEnter={e => {
                  if (!t.action) return
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 18px -8px rgba(0,0,0,0.14)'
                  e.currentTarget.style.borderColor = primary + '40'
                  e.currentTarget.style.background = '#fff'
                  const badge = e.currentTarget.querySelector('.tool-icon')
                  if (badge) { badge.style.transform = 'scale(1.12)'; badge.style.background = primary + '14' }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#F3F4F6'
                  e.currentTarget.style.background = '#FAFBFC'
                  const badge = e.currentTarget.querySelector('.tool-icon')
                  if (badge) { badge.style.transform = 'none'; badge.style.background = '#F3F4F6' }
                }}>
                <div className="tool-icon" style={{ width: 32, height: 32, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, transition: 'transform 0.18s ease, background 0.18s ease' }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{t.sub}</div>
                </div>
              </button>
            ))}
            {onNavigate && (
              <button onClick={() => onNavigate('settings')} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: primary, padding: '8px 8px 2px' }}>
                Full Groups Settings →
              </button>
            )}
          </div>

          {/* Templates panel */}
          {showTemplates && (
            <div style={{ padding: 14, borderBottom: '1px solid #F3F4F6' }}>
              <TemplatePicker org={org} onUseTemplate={(template) => {
                setActiveImportTemplate(template)
                setShowTemplates(false)
                setShowImport(true)
              }} />
            </div>
          )}

          {/* Import panel */}
          {showImport && (
            <div style={{ padding: 14, borderBottom: '1px solid #F3F4F6' }}>
              {activeImportTemplate && (
                <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, color: primary, background: primary + '0c', border: `1px solid ${primary}25`, borderRadius: 8, padding: '6px 10px' }}>
                  🧩 Using "{activeImportTemplate.name}" template
                </div>
              )}
              <InlineChildImport org={org} template={activeImportTemplate} onImported={newChildren => {
                setChildren(newChildren)
                setShowImport(false)
                setActiveImportTemplate(null)
                showToast(`✅ Register updated — ${newChildren.length} children total`)
              }} />
            </div>
          )}

          {/* Register notes */}
          <div style={{ padding: 14, borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>Session Notes</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add notes about this session..."
              style={{ width: '100%', height: 72, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#374151' }} />
          </div>

          {/* Safeguarding */}
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>🛡 Safeguarding</div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', marginBottom: 3 }}>
                {children.filter(c => c.allergies || c.medical_notes).length} medical alert{children.filter(c => c.allergies || c.medical_notes).length !== 1 ? 's' : ''} on register
              </div>
              <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.4, opacity: 0.8 }}>Log all concerns immediately.</div>
            </div>
          </div>

          {/* Encouragement */}
          <EncouragementPanel org={org} primary={primary} />
        </div>
      )}

      {/* BULK ASSIGN ACTION BAR */}
      {selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 600, background: '#111827', borderRadius: 16, padding: '12px 16px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowBulkGroupPicker(v => !v)} disabled={bulkAssigning}
              style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {bulkAssigning ? 'Assigning...' : '🏷️ Assign to Group ▾'}
            </button>
            {showBulkGroupPicker && (
              <div style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.25)', padding: 8, minWidth: 180, maxHeight: 240, overflowY: 'auto' }}>
                {bubbles.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 10px' }}>No groups set up yet.</div>
                ) : bubbles.map(b => (
                  <button key={b.key} onClick={() => handleBulkAssignGroup(b.label)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#111' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={clearSelection} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Cancel
          </button>
        </div>
      )}

      {/* MARK MODAL */}
      {markChild && (
        <MarkModal
          child={markChild.child}
          status={markChild.status}
          bColor={getBubble(markChild.child)?.color || primary}
          onClose={() => setMarkChild(null)}
          onMark={(newStatus, extra = {}) => {
            handleUpdateStatus(markChild.child.id, newStatus, extra)
            setMarkChild(null)
          }}
        />
      )}

      {/* CHILD DRAWER */}
      {selectedChild && (
        <ChildDrawer
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          bubbles={bubbles}
          primary={primary}
          hasSession={!!session}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
          onGroupChange={(childId, groupName) => {
            setChildren(prev => prev.map(ch => ch.id === childId ? { ...ch, group_name: groupName } : ch))
          }}
          onChildUpdated={async (childId) => {
            const { data } = await supabase.from('children').select('*').eq('id', childId).single()
            if (data) setChildren(prev => prev.map(ch => ch.id === childId ? data : ch))
            setSelectedChild(null)
          }}
        />
      )}

      {/* ADD CHILD MODAL */}
      {showAdd && (
        <AddChildModal orgId={orgId} bubbles={bubbles} onClose={() => setShowAdd(false)}
          onAdded={child => { setChildren(prev => [...prev, child]); setShowAdd(false); showToast(`✓ ${child.first_name} added`) }} />
      )}

      {/* GROUPS QUICK SETUP MODAL */}
      {showGroupsSetup && (
        <GroupsQuickSetupModal org={org} initialGroups={orgGroups} onClose={() => setShowGroupsSetup(false)}
          onSaved={(savedGroups, removedLabels) => {
            setShowGroupsSetup(false)
            refetchOrgSettings()
            if (removedLabels && removedLabels.length > 0) {
              const removedLower = removedLabels.map(l => l.toLowerCase())
              setChildren(prev => prev.map(c => removedLower.includes((c.group_name || '').toLowerCase()) ? { ...c, group_name: null } : c))
              const affected = children.filter(c => removedLower.includes((c.group_name || '').toLowerCase())).length
              showToast(`✅ Saved ${savedGroups.length} group${savedGroups.length !== 1 ? 's' : ''} — ${affected} child${affected !== 1 ? 'ren' : ''} moved to ungrouped`)
            } else {
              showToast(`✅ Saved ${savedGroups.length} group${savedGroups.length !== 1 ? 's' : ''}`)
            }
          }} />
      )}
    </div>
  )
}

// ─── ADD CHILD MODAL ──────────────────────────────────────────
function AddChildModal({ orgId, bubbles, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', group_name: bubbles[0]?.label || '', allergies: '', medical_notes: '', emergency_contact_name: '', emergency_contact_phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fi = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lb = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name required.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('children').insert([{ ...form, org_id: orgId, active: true, date_of_birth: form.date_of_birth || null, allergies: form.allergies || null, medical_notes: form.medical_notes || null }]).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onAdded(data)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>Add Child</div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFB3B3', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#C00' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginBottom: 12 }}>
            <div><label style={lb}>First Name *</label><input style={fi} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div><label style={lb}>Last Name *</label><input style={fi} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Date of Birth</label><input style={fi} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
          <div style={{ marginBottom: 12 }}>
            <label style={lb}>Group</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {bubbles.map(b => (
                <button key={b.key} onClick={() => set('group_name', b.label)} style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${form.group_name === b.label ? b.color : '#e5e7eb'}`, background: form.group_name === b.label ? b.color + '18' : '#fff', color: form.group_name === b.label ? b.color : '#6B7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Allergies</label><input style={fi} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Nut allergy" /></div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Medical Notes</label><input style={fi} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="e.g. Asthma" /></div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Emergency Contact</label><input style={fi} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Name" /></div>
          <div style={{ marginBottom: 20 }}><input style={fi} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="Phone number" type="tel" /></div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? '#9ca3af' : '#1B9AAA', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 20 }}>
            {saving ? 'Adding...' : 'Add Child'}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren, useOnlineStatus } from '../../lib/hooks'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TemplatePicker } from './TemplateCreator'
import HistoricalAttendanceModal from '../shared/HistoricalAttendanceModal'

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

export function GroupsQuickSetupModal({ org, initialGroups, onClose, onSaved }) {
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg, #0B1023 0%, #131B33 100%)', borderRadius: 22, width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', padding: '26px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg, #7C3AED, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/icons/manage-groups-icon.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>Set up your groups</div>
          </div>
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

// ─── PHOTOS TAB ───────────────────────────────────────────────
// Multiple attached images for a child (distinct from the single avatar
// photo on children.photo_url) — session photos, consent docs, etc. —
// each with who uploaded it, when, and an optional caption.
function PhotosTab({ child, org }) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [authUserId, setAuthUserId] = useState(null)
  const fileInputRef = React.useRef()

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('child_attachments')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
    setAttachments(data || [])
    setLoading(false)
  }, [child.id])

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data }) => setAuthUserId(data?.user?.id || null))
  }, [load])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `children/${child.id}/attachments/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
      await supabase.from('child_attachments').insert({
        org_id: org?.id, child_id: child.id, url: urlData.publicUrl, storage_path: path, uploaded_by: authUserId,
      })
      await load()
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (att) => {
    if (!window.confirm('Remove this photo?')) return
    await supabase.from('child_attachments').delete().eq('id', att.id)
    if (att.storage_path) await supabase.storage.from('gallery').remove([att.storage_path])
    setViewing(null)
    setAttachments(prev => prev.filter(a => a.id !== att.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Photos attached to {child.first_name}'s record</div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: '6px 12px', borderRadius: 9, border: '1.5px dashed #CBD5E1', background: '#F8FAFC', color: '#334155', fontSize: 11.5, fontWeight: 700, cursor: uploading ? 'default' : 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Add photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontSize: 12.5 }}>Loading…</div>
      ) : attachments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontSize: 12.5, background: '#F8FAFC', borderRadius: 14, border: '1px dashed #E2E8F0' }}>
          No photos attached yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {attachments.map(att => (
            <button key={att.id} onClick={() => setViewing(att)} style={{ padding: 0, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1', background: '#F1F5F9' }}>
              <img src={att.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: 420, width: '100%', overflow: 'hidden' }}>
            <img src={viewing.url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 700, marginBottom: 2 }}>
                Uploaded {format(new Date(viewing.created_at), 'd MMM yyyy \'at\' HH:mm')}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>
                by {viewing.uploader?.full_name || 'Unknown'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setViewing(null)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Close</button>
                <button onClick={() => handleDelete(viewing)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CHILD DRAWER ─────────────────────────────────────────────
function ChildDrawer({ child, status, attendanceRecord, bubble, bubbles = [], onClose, primary, org, hasSession, onGroupChange, onChildUpdated }) {
  const isMobile = useIsMobile()
  const dragControls = useDragControls()
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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10600, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose() }}
        style={{ background: '#fff', borderRadius: isMobile ? '24px 24px 0 0' : 24, width: '100%', maxWidth: isMobile ? '100%' : 440, maxHeight: isMobile ? '94vh' : '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}
      >

        {/* Mobile drag handle */}
        {isMobile && (
          <div onPointerDown={e => dragControls.start(e)} style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, cursor: 'grab', touchAction: 'none' }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.12)' }} />
          </div>
        )}

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
              <button onClick={() => setDrawerTab('photos')}
                style={{ marginTop: 8, background: 'none', border: 'none', color: bColor, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                ℹ️ More info — attached photos
              </button>
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
            ['photos', '📷 Photos'],
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

          {drawerTab === 'photos' && <PhotosTab child={child} org={org} />}

          {/* EDIT */}
          {drawerTab === 'edit' && <EditChildForm child={child} onSaved={() => onChildUpdated ? onChildUpdated(child.id) : onClose()} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </motion.div>
    </div>,
    document.body
  )
}


// ─── CHILD CARD ───────────────────────────────────────────────
function ChildCard({ child, status, bubble, onClick, onMark, primary, selected, selectMode, onToggleSelect, dark }) {
  const bColor = bubble?.color || primary || '#1B9AAA'
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const [hovered, setHovered] = React.useState(false)

  const statusConfig = dark ? {
    signed_in:  { label: 'In',          bg: 'rgba(34,197,94,0.16)', color: '#4ADE80', dot: '#22C55E' },
    signed_out: { label: 'Out',         bg: 'rgba(59,130,246,0.16)', color: '#60A5FA', dot: '#3B82F6' },
    absent:     { label: 'Absent',      bg: 'rgba(239,68,68,0.16)', color: '#F87171', dot: '#EF4444' },
    expected:   { label: 'Expected',    bg: 'rgba(255,255,255,0.06)', color: '#94A3B8', dot: '#CBD5E1' },
    unmarked:   { label: 'Not marked',  bg: 'rgba(255,255,255,0.06)', color: '#94A3B8', dot: '#CBD5E1' },
  } : {
    signed_in:  { label: 'In',          bg: 'linear-gradient(135deg,#DCFCE7,#BBF7D0)', color: '#15803D', dot: '#16A34A' },
    signed_out: { label: 'Out',         bg: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)', color: '#1D4ED8', dot: '#2563EB' },
    absent:     { label: 'Absent',      bg: 'linear-gradient(135deg,#FEE2E2,#FECACA)', color: '#B91C1C', dot: '#DC2626' },
    expected:   { label: 'Expected',    bg: '#F1F5F9', color: '#94A3B8', dot: '#CBD5E1' },
    unmarked:   { label: 'Not marked',  bg: '#F1F5F9', color: '#94A3B8', dot: '#CBD5E1' },
  }
  const sc = statusConfig[status] || statusConfig.unmarked

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px 10px 18px',
        overflow: 'hidden',
        background: dark
          ? (selected ? `${primary}22` : hovered ? 'rgba(255,255,255,0.06)' : '#161A30')
          : (selected ? `${primary}14` : hovered ? `${bColor}14` : `${bColor}08`),
        border: dark
          ? `1px solid ${selected ? primary + '55' : 'rgba(255,255,255,0.08)'}`
          : `1.5px solid ${selected ? primary + '45' : hovered ? bColor + '38' : bColor + '20'}`,
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: hovered ? `0 6px 16px -8px ${bColor}55` : (dark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'),
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Group colour accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: dark ? 4 : 5, background: bColor }} />

      {/* Checkbox — only shown once "Select" mode is switched on */}
      {selectMode && (
        <button onClick={e => { e.stopPropagation(); onToggleSelect(child.id) }}
          style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${selected ? primary : (dark ? 'rgba(255,255,255,0.25)' : '#D1D5DB')}`, background: selected ? primary : (dark ? 'transparent' : '#fff'), cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>
          {selected ? '✓' : ''}
        </button>
      )}

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${bColor}, ${bColor}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden', boxShadow: `0 3px 10px -4px ${bColor}90`, transition: 'transform 0.15s', transform: hovered ? 'scale(1.06)' : 'none' }}>
          {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#F1F5F9' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {child.first_name} {child.last_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: dark ? bColor : '#fff', background: dark ? 'transparent' : bColor, borderRadius: 99, padding: dark ? '1px 0' : '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {dark && <span style={{ width: 6, height: 6, borderRadius: '50%', background: bColor, display: 'inline-block' }} />}
              {bubble?.label || 'Ungrouped'}
            </span>
            {child.allergies && (
              <span style={{ fontSize: 10, fontWeight: 800, color: dark ? '#FBBF24' : '#D97706', background: dark ? 'rgba(251,191,36,0.14)' : 'linear-gradient(135deg,#FEF3C7,#FDE68A)', borderRadius: 6, padding: '1px 6px' }}>⚠ ALLERGY</span>
            )}
            {child.medical_notes && (
              <span style={{ fontSize: 10, fontWeight: 800, color: dark ? '#F87171' : '#DC2626', background: dark ? 'rgba(248,113,113,0.14)' : 'linear-gradient(135deg,#FEE2E2,#FECACA)', borderRadius: 6, padding: '1px 6px' }}>✚ MEDICAL</span>
            )}
          </div>
        </div>
      </div>

      {/* Status + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          onClick={e => { e.stopPropagation(); if (onMark) onMark() }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: dark ? 'transparent' : sc.bg, borderRadius: 99, padding: dark ? '5px 0' : '5px 12px', cursor: onMark ? 'pointer' : 'default', transition: 'transform 0.12s', boxShadow: !dark && (status === 'signed_in' || status === 'signed_out' || status === 'absent') ? '0 2px 6px -3px rgba(0,0,0,0.25)' : 'none' }}
          onMouseEnter={e => { if (onMark) e.currentTarget.style.transform = 'scale(1.06)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: sc.color }}>{sc.label}</span>
        </div>
        {dark && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>›</span>}
      </div>
    </motion.div>
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
export default function Registers({ org, onNavigate, autoOpenAdd }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const isMobile = useIsMobile()
  const { groups: orgGroups, refetch: refetchOrgSettings } = useOrgSettings(orgId)
  const bubbles = normaliseBubbles(orgGroups)
  const { session, fromCache: sessionFromCache } = useTodaySession(orgId)
  const { children, setChildren, loading, fromCache: childrenFromCache } = useChildren(orgId)
  const { attendance } = useAttendance(session?.id)
  const isOnline = useOnlineStatus()
  const showOfflineBanner = !isOnline || childrenFromCache || sessionFromCache

  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchPopupRef = useRef(null)
  const [activeGroup, setActiveGroup] = useState('all')
  const [selectedChild, setSelectedChild] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [showBulkGroupPicker, setShowBulkGroupPicker] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGroupsSetup, setShowGroupsSetup] = useState(false)
  const [activeImportTemplate, setActiveImportTemplate] = useState(null)
  const [toast, setToast] = useState('')
  const [note, setNote] = useState('')
  const [showMobileTools, setShowMobileTools] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('registerDarkMode') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('registerDarkMode', darkMode ? '1' : '0') } catch {}
  }, [darkMode])
  const [showPastRegisters, setShowPastRegisters] = useState(false)
  const [pastSessions, setPastSessions] = useState([])
  const [pastSessionsLoading, setPastSessionsLoading] = useState(false)
  const [viewingPastSession, setViewingPastSession] = useState(null)
  const [viewingPastAttendance, setViewingPastAttendance] = useState([])
  const [viewingPastLoading, setViewingPastLoading] = useState(false)

  useEffect(() => {
    if (!showPastRegisters || !orgId) return
    setPastSessionsLoading(true)
    supabase.from('sessions').select('*').eq('org_id', orgId).not('closed_at', 'is', null)
      .order('closed_at', { ascending: false }).limit(300)
      .then(({ data }) => { setPastSessions(data || []); setPastSessionsLoading(false) })
  }, [showPastRegisters, orgId])

  const openPastSession = async (s) => {
    setViewingPastLoading(true)
    setViewingPastSession(s)
    const { data } = await supabase.from('attendance').select('*').eq('session_id', s.id)
    setViewingPastAttendance(data || [])
    setViewingPastLoading(false)
  }

  // Triggered by the mobile Launch menu's "Add Child" quick action — opens the same
  // Add Child modal a person would reach via the header button, just pre-opened.
  useEffect(() => { if (autoOpenAdd) setShowAdd(true) }, [autoOpenAdd])
  useEffect(() => {
    if (!searchOpen) return
    const onDocClick = e => { if (searchPopupRef.current && !searchPopupRef.current.contains(e.target)) setSearchOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [searchOpen])

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
    <style>body{font-family:system-ui,sans-serif;color:#111;padding:24px}h1{font-size:20px;font-weight:900;margin:0 0 4px}p{margin:0 0 16px;color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse}th{padding:8px 10px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #e5e7eb}@media print{.no-print{display:none}}</style>
    </head><body>
    <button class="no-print" onclick="window.close()" aria-label="Close" style="position:fixed;top:16px;right:16px;width:34px;height:34px;border-radius:50%;border:1.5px solid #e5e7eb;background:#fff;color:#374151;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px -2px rgba(0,0,0,0.15);z-index:99">×</button>
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


  // Session status for the header badge — must agree with Hub and the session
  // detail panel: closed_at (actually closed) takes priority over the scheduled
  // time window, otherwise a manually-closed session still shows as "Live" here
  // just because a session object exists.
  const registerSessionStatus = (() => {
    if (!session) return { label: 'No Session', bg: '#F3F4F6', color: '#9CA3AF' }
    if (session.closed_at) return { label: '● Closed', bg: '#F1F5F9', color: '#64748B' }
    const now = new Date()
    const startDT = session.start_time ? new Date(`${session.session_date}T${session.start_time}`) : null
    const endDT = session.end_time ? new Date(`${session.session_date}T${session.end_time}`) : null
    const hasEnded = !!endDT && endDT < now
    const isLiveNow = !hasEnded && (!startDT || startDT <= now)
    if (hasEnded) return { label: '● Ended', bg: '#F1F5F9', color: '#64748B' }
    if (isLiveNow) return { label: '● Live', bg: '#DCFCE7', color: '#15803D' }
    return { label: '● Upcoming', bg: '#FEF9C3', color: '#92400E' }
  })()

  // Theme tokens — light values match the original design exactly; dark values
  // only apply when the Dark Mode toggle (in Register Options) is switched on.
  const t = {
    pageBg: darkMode ? 'linear-gradient(180deg, #0A0D1C 0%, #12152A 100%)' : '#F8FAFC',
    headerBg: darkMode ? 'linear-gradient(165deg, #171B33 0%, rgba(16,19,36,0) 60%)' : `linear-gradient(165deg, ${primary}0A 0%, #fff 55%)`,
    headerBorder: darkMode ? 'rgba(255,255,255,0.08)' : '#EEF1F6',
    text: darkMode ? '#F1F5F9' : '#0B1220',
    textSub: darkMode ? '#94A3B8' : '#64748B',
    textMuted: darkMode ? '#64748B' : '#9CA3AF',
    miniChipBg: darkMode ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
    miniChipBorder: darkMode ? 'rgba(255,255,255,0.1)' : '#EEF1F6',
    btnBg: darkMode ? null : '#fff',
    btnBorder: darkMode ? null : '#E2E8F0',
    btnShadow: darkMode ? null : '0 1px 4px -1px rgba(0,0,0,0.06)',
    cardBg: darkMode ? '#161A30' : '#fff',
    cardBorder: darkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
    inputBg: darkMode ? '#12152A' : (primary + '06'),
    inputBorder: darkMode ? 'rgba(255,255,255,0.1)' : (primary + '25'),
    filterBg: darkMode ? 'transparent' : '#fff',
    filterBorder: darkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    listBg: darkMode ? 'transparent' : '#F8FAFC',
  }
  const actionColors = { past: '#8B5CF6', medical: '#3B82F6', groups: '#14B8A6', print: '#A855F7', import: '#EC4899' }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: t.pageBg }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', borderRadius: 12, padding: '11px 20px', fontSize: 13, fontWeight: 700, zIndex: 10900, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#4ADE80' }}>✓</span> {toast}
        </div>
      )}

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ background: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: isMobile ? '12px 16px 8px' : '18px 20px 12px', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${primary}44, transparent)` }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: isMobile ? 8 : 14, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 9 : 12, minWidth: 0 }}>
              <div style={{ width: isMobile ? 32 : 42, height: isMobile ? 32 : 42, borderRadius: isMobile ? 10 : 13, background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 15 : 19, flexShrink: 0, boxShadow: `0 4px 14px -5px ${primary}90` }}>
                <img src="/icons/registers-icon.png" alt="" style={{ width: isMobile ? 22 : 28, height: isMobile ? 22 : 28, objectFit: 'contain' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 3 : 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: isMobile ? 16 : 19, fontWeight: 900, color: t.text, fontFamily: 'var(--font-display)', letterSpacing: -0.3 }}>
                    {session?.title || 'Register'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 99, padding: '3px 9px 3px 7px', background: darkMode ? 'rgba(255,255,255,0.08)' : registerSessionStatus.bg, color: darkMode ? t.textSub : registerSessionStatus.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: registerSessionStatus.color, flexShrink: 0 }} />
                    {registerSessionStatus.label.replace('● ', '')}
                  </span>
                </div>
                {session && (
                  <div style={{ display: 'flex', gap: isMobile ? 4 : 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 10.5 : 11.5, fontWeight: 600, color: t.textSub, background: t.miniChipBg, border: `1px solid ${t.miniChipBorder}`, borderRadius: 7, padding: isMobile ? '2px 7px' : '3px 9px' }}>
                      📅 {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {session.start_time && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 10.5 : 11.5, fontWeight: 600, color: t.textSub, background: t.miniChipBg, border: `1px solid ${t.miniChipBorder}`, borderRadius: 7, padding: isMobile ? '2px 7px' : '3px 9px' }}>
                        🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}
                      </span>
                    )}
                    {session.location && !isMobile && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: t.textSub, background: t.miniChipBg, border: `1px solid ${t.miniChipBorder}`, borderRadius: 7, padding: '3px 9px' }}>
                        📍 {session.location.split(',')[0]}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setShowMobileTools(true)} aria-label="Register options"
                style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.12)' : '#E2E8F0'}`, background: darkMode ? 'rgba(255,255,255,0.06)' : '#fff', color: t.textSub, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ⚙️
              </button>
            )}
            <div style={{ display: 'flex', gap: isMobile ? 4 : 6, alignItems: 'center', width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'space-between' : undefined, flexShrink: isMobile ? undefined : 0 }}>
              {[
                { key: 'past', label: 'Past Registers', icon: '/icons/past-registers-icon.png', onClick: () => setShowPastRegisters(true) },
                { key: 'medical', label: 'Medical Alerts', icon: '/icons/medical-icon.png', onClick: () => onNavigate && onNavigate('medical_alerts') },
                { key: 'groups', label: 'Manage Groups', icon: '/icons/manage-groups-icon.png', onClick: () => setShowGroupsSetup(true) },
                { key: 'print', label: 'Print Register', icon: '/icons/print-register-icon.png', onClick: () => handlePrint() },
                { key: 'import', label: 'Import Children', icon: '/icons/import-children-icon.png', onClick: () => setShowImport(true) },
              ].map(a => {
                const ac = actionColors[a.key]
                return (
                  <button key={a.key} onClick={a.onClick} aria-label={a.label}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, flex: isMobile ? '1 1 0' : '0 0 auto', minWidth: 0, width: isMobile ? undefined : 82, height: isMobile ? 68 : 80, boxSizing: 'border-box', padding: '3px 1px', borderRadius: 12, border: darkMode ? `1px solid ${ac}3A` : '1.5px solid #E2E8F0', background: darkMode ? `linear-gradient(160deg, ${ac}30, ${ac}12)` : '#fff', color: darkMode ? t.text : '#374151', fontSize: isMobile ? 8.5 : 10, fontWeight: 800, cursor: 'pointer', boxShadow: darkMode ? `0 4px 14px -8px ${ac}80` : '0 1px 4px -1px rgba(0,0,0,0.06)', textAlign: 'center', lineHeight: 1.15 }}>
                    <img src={a.icon} alt="" style={{ width: isMobile ? 48 : 52, height: isMobile ? 48 : 52, objectFit: 'contain', flexShrink: 0, marginBottom: -4 }} />
                    <span style={{ maxWidth: isMobile ? 62 : 74 }}>{a.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stats strip + search + select — one compact row */}
          <div ref={searchPopupRef}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: isMobile ? 8 : 12 }}>
              {[
                { icon: '📋', value: counts.total, label: 'On Register', color: primary },
                { icon: '✅', value: counts.signed_in, label: 'Signed In', color: '#16A34A' },
                { icon: '⏳', value: counts.expected, label: 'Yet to Arrive', color: '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: s.color + (darkMode ? '1A' : '10'), border: `1.5px solid ${s.color}30`, flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 0 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => setSearchOpen(v => !v)}
                  aria-label="Search"
                  style={{
                    width: isMobile ? 38 : 40, height: isMobile ? 38 : 40, borderRadius: 10, flexShrink: 0,
                    border: `1.5px solid ${searchOpen || search ? primary : (darkMode ? 'rgba(255,255,255,0.12)' : '#E2E8F0')}`,
                    background: searchOpen || search ? primary + '10' : (darkMode ? 'rgba(255,255,255,0.06)' : '#fff'),
                    color: searchOpen || search ? primary : t.textSub,
                    fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  🔍
                  {search && !searchOpen && (
                    <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: primary, border: '1.5px solid #fff' }} />
                  )}
                </button>
                <button
                  onClick={() => { if (selectMode) clearSelection(); setSelectMode(v => !v) }}
                  style={{
                    padding: '0 14px', height: isMobile ? 38 : 40, borderRadius: 10, border: `1.5px solid ${selectMode ? primary : (darkMode ? 'rgba(255,255,255,0.12)' : '#E5E7EB')}`,
                    background: selectMode ? primary : (darkMode ? 'rgba(255,255,255,0.06)' : '#fff'), color: selectMode ? '#fff' : t.textSub,
                    fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ position: 'relative', marginBottom: isMobile ? 8 : 12 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: t.textMuted }}>🔍</span>
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false) }}
                      placeholder="Search by name..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 32px 10px 34px', borderRadius: 10, border: `1.5px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                      onFocus={e => e.target.style.borderColor = primary}
                      onBlur={e => e.target.style.borderColor = t.inputBorder}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} aria-label="Clear search"
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: darkMode ? 'rgba(255,255,255,0.1)' : '#F1F5F9', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, color: t.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* OFFLINE BANNER */}
        {showOfflineBanner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: darkMode ? 'rgba(217,119,6,0.16)' : '#FFFBEB', borderBottom: `1px solid ${darkMode ? 'rgba(217,119,6,0.3)' : '#FDE68A'}`, flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>📡</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: darkMode ? '#FBBF24' : '#92400E' }}>
              {isOnline ? 'Reconnecting…' : "You're offline"} — showing the last saved register{isOnline ? '' : '. Changes made elsewhere won\'t appear until you\'re back online'}.
            </span>
          </div>
        )}

        {/* GROUP FILTER */}
        {availableGroups.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', background: t.filterBg, borderBottom: `1px solid ${t.filterBorder}`, overflowX: 'auto', flexShrink: 0 }}>
            {['all', ...availableGroups].map(g => {
              const bubble = g === 'all' ? null : bubbles.find(b => b.label.toLowerCase() === g.toLowerCase())
              const isActive = activeGroup === g
              const chipColor = bubble?.color || primary
              return (
                <button key={g} onClick={() => setActiveGroup(g)} style={{
                  padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${isActive ? chipColor : (darkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB')}`,
                  background: isActive ? `linear-gradient(135deg, ${chipColor}, ${chipColor}CC)` : (darkMode ? '#161A30' : '#fff'),
                  color: isActive ? '#fff' : t.textSub,
                  fontSize: 12, fontWeight: isActive ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: isActive ? `0 3px 10px -4px ${chipColor}90` : 'none',
                  transition: 'all 0.15s ease',
                }}>
                  {bubble && <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#fff' : bubble.color, display: 'inline-block' }} />}
                  {g === 'all' ? 'All Groups' : g}
                  <span style={{ fontSize: 10, opacity: isActive ? 0.9 : 0.7 }}>
                    {g === 'all' ? children.length : children.filter(c => (c.group_name || '').toLowerCase() === g.toLowerCase()).length}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* CHILDREN LIST */}
        <div style={{ flex: 1, overflowY: 'auto', background: t.listBg, padding: isMobile ? '10px 10px' : '12px 14px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>Loading register...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👧</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 6 }}>{children.length === 0 ? 'No children yet' : 'No matches'}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>{children.length === 0 ? 'Add or import children to get started' : 'Try a different search or filter'}</div>
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
                  selectMode={selectMode}
                  selected={selectedIds.has(child.id)}
                  onToggleSelect={toggleSelect}
                  onClick={() => selectMode ? toggleSelect(child.id) : setSelectedChild({ child, status: getStatus(child.id), attRec: getAttRec(child.id) })}
                  onMark={null}
                  dark={darkMode}
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
              { icon: '💊', label: 'Medical Alerts', sub: 'Review & sign off', action: () => onNavigate && onNavigate('medical_alerts') },
              { icon: '📥', label: 'Import Children', sub: 'Bulk add from CSV', action: () => setShowImport(v => !v) },
              { icon: '🧩', label: 'Import Templates', sub: 'Customise import fields', action: () => setShowTemplates(v => !v) },
              { icon: '🖨', label: 'Print Register', sub: 'Print attendance sheet', action: () => handlePrint() },
              { icon: '📜', label: 'Past Registers', sub: 'View closed sessions', action: () => setShowPastRegisters(true) },
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

      {/* MOBILE TOOLS SHEET — same actions as the desktop sidebar, surfaced as a bottom sheet.
          Portaled to document.body so it escapes this panel's stacking context and always
          renders above the fixed bottom nav bar (same fix as the Staff Rota rebuild). */}
      {isMobile && showMobileTools && createPortal(
        <div onClick={() => setShowMobileTools(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '80vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 16px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 10 }}><div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.12)' }} /></div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 10 }}>Register Options</div>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 10px', borderRadius: 14, border: '1px solid #F3F4F6', background: '#FAFBFC', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{darkMode ? '🌙' : '☀️'}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Dark Mode</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{darkMode ? 'On for this register' : 'Off'}</div>
                </div>
              </div>
              <button onClick={() => setDarkMode(v => !v)} aria-label="Toggle dark mode"
                style={{ width: 46, height: 26, borderRadius: 99, border: 'none', background: darkMode ? primary : '#D1D5DB', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
                <span style={{ position: 'absolute', top: 3, left: darkMode ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.15s' }} />
              </button>
            </div>
            {[
              { icon: '🏷️', label: 'Manage Groups', sub: 'Quick add & colours', action: () => { setShowGroupsSetup(true); setShowMobileTools(false) } },
              { icon: '💊', label: 'Medical Alerts', sub: 'Review & sign off', action: () => { setShowMobileTools(false); onNavigate && onNavigate('medical_alerts') } },
              { icon: '📥', label: 'Import Children', sub: 'Bulk add from CSV', action: () => { setShowImport(true); setShowMobileTools(false) } },
              { icon: '🧩', label: 'Import Templates', sub: 'Customise import fields', action: () => { setShowTemplates(true); setShowMobileTools(false) } },
              { icon: '🖨', label: 'Print Register', sub: 'Print attendance sheet', action: () => { handlePrint(); setShowMobileTools(false) } },
              { icon: '📜', label: 'Past Registers', sub: 'View closed sessions', action: () => { setShowPastRegisters(true); setShowMobileTools(false) } },
            ].map(t => (
              <button key={t.label} onClick={t.action}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 14, border: '1px solid #F3F4F6', background: '#FAFBFC', cursor: 'pointer', textAlign: 'left', marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{t.sub}</div>
                </div>
              </button>
            ))}
            {onNavigate && (
              <button onClick={() => { setShowMobileTools(false); onNavigate('settings') }} style={{ width: '100%', textAlign: 'center', border: '1px solid #F3F4F6', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: primary, padding: '10px 8px', borderRadius: 12, marginTop: 2 }}>
                Full Groups Settings →
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* MOBILE IMPORT MODAL — the desktop sidebar renders InlineChildImport inline, but the sidebar
          is hidden on mobile, so this presents the same import flow as a bottom sheet on phones */}
      {isMobile && showImport && createPortal(
        <div onClick={() => { setShowImport(false); setActiveImportTemplate(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Import Children</div>
              <button onClick={() => { setShowImport(false); setActiveImportTemplate(null) }} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 16 }}>×</button>
            </div>
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
        </div>,
        document.body
      )}

      {/* MOBILE TEMPLATES MODAL — mirrors the desktop sidebar's inline TemplatePicker panel */}
      {isMobile && showTemplates && createPortal(
        <div onClick={() => setShowTemplates(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Import Templates</div>
              <button onClick={() => setShowTemplates(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 16 }}>×</button>
            </div>
            <TemplatePicker org={org} onUseTemplate={(template) => {
              setActiveImportTemplate(template)
              setShowTemplates(false)
              setShowImport(true)
            }} />
          </div>
        </div>,
        document.body
      )}

      {/* BULK ASSIGN ACTION BAR */}
      {selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10600, background: '#111827', borderRadius: 16, padding: '12px 16px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 12 }}>
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

      {/* CHILD DRAWER */}
      {selectedChild && (
        <ChildDrawer
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          bubbles={bubbles}
          primary={primary}
          org={org}
          hasSession={!!session}
          onClose={() => setSelectedChild(null)}
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

      {/* PAST REGISTERS — full history of closed sessions, not just the last 7 days */}
      {showPastRegisters && (
        <PastRegistersListModal
          sessions={pastSessions}
          loading={pastSessionsLoading}
          primary={primary}
          onClose={() => setShowPastRegisters(false)}
          onSelect={openPastSession}
        />
      )}

      {viewingPastSession && !viewingPastLoading && (
        <HistoricalAttendanceModal
          session={viewingPastSession}
          attendance={viewingPastAttendance}
          allChildren={children}
          primary={primary}
          secondary={org?.secondary_color || primary}
          onClose={() => { setViewingPastSession(null); setViewingPastAttendance([]) }}
        />
      )}
    </div>
  )
}

// ─── PAST REGISTERS LIST ──────────────────────────────────────
// Every closed session for the org, most recent first, grouped by month —
// tap one to open its read-only timestamped attendance view.
function PastRegistersListModal({ sessions, loading, primary, onClose, onSelect }) {
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')

  const filtered = sessions.filter(s => !search.trim() || (s.title || '').toLowerCase().includes(search.trim().toLowerCase()))

  const monthLabel = (dateStr) => {
    if (!dateStr) return 'Undated'
    const d = new Date(`${dateStr}T00:00:00`)
    if (isNaN(d.getTime())) return 'Undated'
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const groups = []
  filtered.forEach(s => {
    const label = monthLabel(s.session_date)
    let g = groups.find(g => g.label === label)
    if (!g) { g = { label, items: [] }; groups.push(g) }
    g.items.push(s)
  })

  const fmtDayDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(`${dateStr}T00:00:00`)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
      background: isMobile ? '#F8FAFC' : 'rgba(15,23,42,0.45)',
      alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? 0 : 24, boxSizing: 'border-box',
    }} onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 560, maxHeight: isMobile ? 'none' : '86vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: isMobile ? 0 : 24, flex: isMobile ? 1 : undefined,
        background: '#F8FAFC', boxShadow: isMobile ? 'none' : '0 24px 60px -20px rgba(0,0,0,0.35)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: `linear-gradient(165deg, ${primary}0F 0%, #fff 60%)`, borderBottom: '1px solid #EEF1F6', padding: isMobile ? '18px 18px 14px' : '20px 22px 16px', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: isMobile ? 14 : 16, right: isMobile ? 14 : 16,
            width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #E2E8F0', background: '#fff',
            color: '#374151', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: 40 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}><img src="/icons/past-registers-icon.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} /></div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0B1220', letterSpacing: -0.3 }}>Past Registers</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>{sessions.length} closed session{sessions.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search sessions..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none' }} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px 24px' : '16px 22px 24px', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>Loading past registers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>
              {sessions.length === 0 ? 'No sessions have been closed yet.' : 'Nothing matches your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {groups.map(g => (
                <div key={g.label}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {g.items.map(s => (
                      <button key={s.id} onClick={() => onSelect(s)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                        background: '#fff', border: '1.5px solid #EEF1F6', borderRadius: 14, padding: '11px 13px',
                        cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                      }}>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🔒</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0B1220', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 1 }}>
                            {fmtDayDate(s.session_date)}{s.start_time ? ` · ${s.start_time}` : ''}{s.location ? ` · ${s.location}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, color: '#CBD5E1', flexShrink: 0 }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
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

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
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
    </div>,
    document.body
  )
}

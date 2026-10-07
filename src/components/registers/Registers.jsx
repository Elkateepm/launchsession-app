import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls } from 'framer-motion'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { signRows, signOne } from '../../lib/storageUrl'
import { useTodaySession, useAttendance, useChildren, useOnlineStatus } from '../../lib/hooks'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import { useIsMobile } from '../../hooks/useIsMobile'
import RegisterWorkspace from './RegisterWorkspace'
import { TemplatePicker, AVAILABLE_FIELDS, SAMPLE_ROW } from './TemplateCreator'
import OverlayPortal from '../shared/OverlayPortal'
import { parseDelimited, detectMapping, buildImport } from '../../lib/childImport'
import { buildTemplateWorkbook } from '../../lib/importTemplateWorkbook'
import FillInRegister, { SCREEN_FIELD_KEYS } from './FillInRegister'
import { orgFilename } from '../../lib/orgExport'
import HistoricalAttendanceModal from '../shared/HistoricalAttendanceModal'
import { useTerms } from '../../context/OrgContext'
import shrinkImage from '../../lib/shrinkImage'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'

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

        {error && <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: 'var(--danger-text)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}><Icon name="⚠️" /> {error}</div>}

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
                <button onClick={() => removeGroup(g.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}><Icon name="✕" /></button>
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
              <span style={{ fontSize: 16, pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}><Icon name="🎨" /></span>
            </label>
          </div>
          <button onClick={addCustom} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Add Group</button>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: saving ? 'var(--text3)' : `linear-gradient(135deg, ${primary}, #6366F1)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
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
    <div style={{ background: color + '08', border: `1px solid ${withAlpha(color, '25')}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

function FormCheck({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginBottom: 8, cursor: 'pointer' }}>
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

  const fi = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--surface)' }
  const lb = { fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }

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

      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: saving ? 'var(--text-faint)' : '#111', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {saving ? 'Saving...' : '⊙ Save Changes'}
      </button>
    </div>
  )
}

// ─── INLINE IMPORT ────────────────────────────────────────────
// Default column set when no custom template is chosen. Deliberately the full
// set rather than a minimal one: an org that imports without parent_email ends
// up with an empty newsletter audience and no obvious reason why.
const CSV_COLS = AVAILABLE_FIELDS.map(f => f.key)

export function InlineChildImport({ org, template, existingChildren = [], groups = [], onImported }) {
  const terms = useTerms()
  const someone = n => (n === 1 ? terms.person : terms.people)
  const [raw, setRaw] = useState(null)          // { headers, rows, source }
  const [mapping, setMapping] = useState({})
  const [pasted, setPasted] = useState('')
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileError, setFileError] = useState('')
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [fillingIn, setFillingIn] = useState(false)
  const inputRef = useRef(null)
  const primary = org?.primary_color || '#1B9AAA'
  // The template's columns: a chosen import template's fields, else all of them.
  const templateFields = useMemo(() => {
    const keys = template?.fields?.length ? template.fields.map(f => f.key) : CSV_COLS
    return keys.map(key => AVAILABLE_FIELDS.find(f => f.key === key)).filter(Boolean)
  }, [template])
  const screenFields = useMemo(
    () => (template?.fields?.length ? templateFields : templateFields.filter(f => SCREEN_FIELD_KEYS.includes(f.key))),
    [template, templateFields]
  )

  const load = useCallback((rows, source) => {
    if (!rows.length) { setFileError('That file has no rows in it.'); return }
    const [headers, ...body] = rows
    if (!body.length) { setFileError(`That file has a header row but no ${terms.people} under it.`); return }
    // The import route refuses more than 2000 in one go. Say so now rather than
    // after the columns have been mapped and Import pressed.
    if (body.length > 2000) {
      setFileError(`That file has ${body.length} rows. Imports are limited to 2000 at a time — split it and run it twice.`)
      return
    }
    setFileError('')
    setIncludeDuplicates(false)
    setRaw({ headers, rows: body, source })
    setMapping(detectMapping(headers))
  }, [terms])

  const handleFile = async (file) => {
    if (!file) return
    setFileError('')
    const isSheet = /\.(xlsx|xlsm|xls)$/i.test(file.name)
    if (!isSheet && !/\.(csv|txt|tsv)$/i.test(file.name)) {
      setFileError('Use a .csv or an Excel file (.xlsx).')
      return
    }
    setReading(true)
    try {
      if (isSheet) {
        // Loaded only when someone actually opens a spreadsheet: the parser is
        // several hundred kilobytes and most imports are CSV.
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true })
        load(rows.map(r => r.map(c => (c instanceof Date ? c : String(c ?? '').trim()))), file.name)
      } else {
        load(parseDelimited(await file.text()), file.name)
      }
    } catch {
      setFileError('Could not read that file. If it opens in Excel, try File → Save As → CSV.')
    }
    setReading(false)
  }

  const result = useMemo(
    () => (raw ? buildImport({ rows: raw.rows, mapping, groups, existing: existingChildren }) : null),
    [raw, mapping, groups, existingChildren]
  )

  const hasName = Object.values(mapping).some(f => f === 'full_name')
    || (Object.values(mapping).includes('first_name') && Object.values(mapping).includes('last_name'))

  const handleImport = async () => {
    if (!result || importing || !hasName) return
    const records = includeDuplicates
      ? [...result.ready, ...result.duplicates.map(d => ({ ...d.record, active: true }))]
      : result.ready
    if (!records.length) return
    setImporting(true)
    setFileError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Your sign-in has expired. Sign in again before importing.')
      const res = await fetch('/api/import-children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ org_id: org.id, records }),
      })
      const json = await res.json().catch(() => ({ error: 'The import did not complete.' }))
      if (res.ok === false || json.error) throw new Error(json.error || 'The import did not complete.')
      const { data: all, error } = await supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('last_name')
      if (error) {
        // The write succeeded: do not invite a retry that would add these people twice.
        onImported(existingChildren, json.inserted ?? records.length)
        return
      }
      onImported(all || [], json.inserted ?? records.length)
      setRaw(null); setPasted('')
    } catch (error) {
      setFileError(error.message || 'Unable to connect. Check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async () => {
    setFileError('')
    try {
      // Same lazy load as reading a spreadsheet: most visits never need it.
      const XLSX = await import('xlsx')
      const bytes = buildTemplateWorkbook(XLSX, { fields: templateFields, groups, orgName: org?.name, person: terms.person, people: terms.people, sample: SAMPLE_ROW })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = orgFilename(org, `${template?.name || 'register'}-template`, 'xlsx', { date: false })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setFileError('Could not create the template. Please try again.')
    }
  }

  // ── The drop target stays in the sidebar; the mapping and review happen in a
  //    dialog, because neither fits in a 250px column.
  if (raw && result) {
    const importable = result.ready.length + (includeDuplicates ? result.duplicates.length : 0)
    const hardSkips = result.skipped.filter(s => !s.soft)
    const softSkips = result.skipped.filter(s => s.soft)

    return <OverlayPortal><div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 10800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={() => { if (!importing) setRaw(null) }}>
      <div role="dialog" aria-modal="true" aria-label="Review register import" aria-busy={importing} onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: primary, marginBottom: 6 }}>STEP 2 OF 2 · REVIEW & IMPORT</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Check the columns</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {raw.source} · {raw.rows.length} row{raw.rows.length === 1 ? '' : 's'}
            </div>
          </div>
          <button disabled={importing} aria-label="Back to upload" onClick={() => setRaw(null)} style={{ border: 'none', background: 'var(--surface-hover)', color: 'var(--text2)', width: 44, height: 44, borderRadius: 9, cursor: 'pointer', fontSize: 15, fontWeight: 800 }}>×</button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>
            We matched your headings to LaunchSession fields. Change any that look wrong — anything set to “Skip” is ignored.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8, marginBottom: 16 }}>
            {raw.headers.map((h, i) => (
              <label key={i} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface2)' }}>
                <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h || <em style={{ color: 'var(--text3)' }}>(no heading)</em>}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', margin: '1px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  e.g. {raw.rows[0]?.[i] ? String(raw.rows[0][i]).slice(0, 28) : '—'}
                </span>
                <select
                  value={mapping[i] || ''}
                  onChange={e => setMapping(m => {
                    const next = { ...m }
                    if (!e.target.value) delete next[i]
                    else {
                      Object.keys(next).forEach(k => { if (next[k] === e.target.value) delete next[k] })
                      next[i] = e.target.value
                    }
                    return next
                  })}
                  style={{ width: '100%', minHeight: 44, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                >
                  <option value="">Skip this column</option>
                  <option value="full_name">Full name (split automatically)</option>
                  {AVAILABLE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </label>
            ))}
          </div>

          {!hasName && (
            <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--warn-text)', marginBottom: 14 }}>
              Point one column at <b>Full name</b>, or one each at <b>First Name</b> and <b>Last Name</b>, before importing.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Pill tone="ok" label={`${result.ready.length} ready to import`} />
            {result.duplicates.length > 0 && <Pill tone="warn" label={`${result.duplicates.length} already on the register`} />}
            {hardSkips.length > 0 && <Pill tone="danger" label={`${hardSkips.length} cannot be imported`} />}
            {result.newGroups.length > 0 && <Pill tone="info" label={`${result.newGroups.length} new ${result.newGroups.length === 1 ? terms.group : terms.group + 's'}`} />}
          </div>

          {result.newGroups.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              New {result.newGroups.length === 1 ? terms.group : terms.group + 's'} in this file: <b style={{ color: 'var(--text2)' }}>{result.newGroups.join(', ')}</b>. They will be created as you go.
            </div>
          )}

          {result.duplicates.length > 0 && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeDuplicates} onChange={e => setIncludeDuplicates(e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                Add {result.duplicates.length} {someone(result.duplicates.length)} already on your register anyway.
                <span style={{ display: 'block', color: 'var(--text3)', marginTop: 2 }}>
                  {result.duplicates.slice(0, 6).map(d => d.name).join(', ')}{result.duplicates.length > 6 ? `, +${result.duplicates.length - 6} more` : ''}
                </span>
              </span>
            </label>
          )}

          {(hardSkips.length > 0 || softSkips.length > 0) && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ padding: '8px 12px', background: 'var(--surface2)', fontSize: 11.5, fontWeight: 800, color: 'var(--text2)' }}>
                Rows we could not use in full
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {[...hardSkips, ...softSkips].slice(0, 40).map((sk, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 12px', fontSize: 12, borderTop: '1px solid var(--border-soft)' }}>
                    <span style={{ color: 'var(--text3)', minWidth: 48 }}>Row {sk.rowNumber}</span>
                    <span style={{ color: sk.soft ? 'var(--warn-text)' : 'var(--danger-text)' }}>{sk.reason}</span>
                    {sk.name && <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>{sk.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {fileError && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--danger-text)', marginTop: 10 }}>{fileError}</div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button disabled={importing} onClick={() => setRaw(null)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleImport} disabled={importing || !hasName || importable === 0}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff', cursor: importing || !hasName || importable === 0 ? 'not-allowed' : 'pointer', background: importing || !hasName || importable === 0 ? 'var(--text-faint)' : primary }}>
            {importing ? 'Importing…' : importable === 0 ? 'Nothing to import' : `Import ${importable} ${someone(importable)}`}
          </button>
        </div>
      </div>
    </div></OverlayPortal>
  }

  if (fillingIn) {
    return <FillInRegister fields={screenFields} allFields={templateFields} groups={groups} terms={terms} primary={primary}
      onBack={() => setFillingIn(false)} onCheck={rows => load(rows, 'Filled in on screen')} />
  }

  return (
    <div>
      <button type="button" disabled={reading} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!reading) handleFile(e.dataTransfer.files[0]) }}
        style={{ width: '100%', border: `2px dashed ${dragging ? primary : 'var(--org-a35)'}`, borderRadius: 18, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: withAlpha(primary, dragging ? '1F' : '0A'), marginBottom: 18, fontFamily: 'inherit' }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}><Icon name="📂" /></div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{reading ? 'Reading your register…' : dragging ? 'Drop your register here' : 'Choose a file or drop it here'}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Excel or CSV · up to 2,000 rows · headings matched automatically</div>
      </button>
        <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" style={{ display: 'none' }}
          onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Or paste from a spreadsheet</div>

      <textarea
        aria-label="Spreadsheet rows"
        value={pasted}
        onChange={e => setPasted(e.target.value)}
        onPaste={e => {
          const text = e.clipboardData?.getData('text')
          if (text && /[\t,]/.test(text)) { e.preventDefault(); setPasted(text); load(parseDelimited(text), 'pasted rows') }
        }}
        placeholder="…or paste rows straight from a spreadsheet"
        rows={3}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical', background: 'var(--surface)', color: 'var(--text)' }}
      />

      {fileError && <div style={{ fontSize: 11, color: 'var(--danger-text)', marginTop: 6 }}>{fileError}</div>}

      <button onClick={() => load(parseDelimited(pasted), 'pasted rows')} disabled={!pasted.trim()}
        style={{ width: '100%', marginTop: 8, minHeight: 44, padding: '10px', borderRadius: 8, border: 'none', background: pasted.trim() ? primary : 'var(--text-faint)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: pasted.trim() ? 'pointer' : 'not-allowed' }}>Check pasted rows <Icon name="→" /></button>

      <div style={{ marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid var(--org-a20)', background: 'var(--org-a05)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>No spreadsheet yet?</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', margin: '3px 0 10px', lineHeight: 1.5 }}>Fill in the template here, or download it to fill in Excel, Numbers or Google Sheets and upload it above.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setFileError(''); setFillingIn(true) }} style={{ flex: '1 1 180px', minHeight: 44, padding: '10px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}><Icon name="✏️" /> Fill in on screen</button>
          <button type="button" onClick={downloadTemplate} style={{ flex: '1 1 180px', minHeight: 44, padding: '10px', borderRadius: 10, border: '1px solid var(--org-a35)', background: 'var(--surface)', color: 'var(--org-ink)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}><Icon name="⬇" /> Download Excel template</button>
        </div>
      </div>
    </div>
  )
}

function Pill({ tone, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: `var(--${tone}-bg)`, color: `var(--${tone}-text)`, border: `1px solid var(--${tone}-border)` }}>{label}</span>
  )
}

// ─── MARK MODAL ───────────────────────────────────────────────
// ─── NOTES TAB ────────────────────────────────────────────────
function NotesTab({ child }) {
  const [notes, setNotes] = useState(child.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timerRef = React.useRef(null)
  const latestRef = React.useRef(child.notes || '')
  const dirtyRef = React.useRef(false)
  const mountedRef = React.useRef(true)

  const save = React.useCallback(async (value) => {
    setSaving(true)
    const { error: e } = await supabase.from('children').update({ notes: value || null }).eq('id', child.id)
    if (!mountedRef.current) return
    setSaving(false)
    if (e) {
      // Previously any failure still showed "Saved". Someone recording a
      // concern about a child would have walked away believing it was stored.
      setError('Not saved — check your connection and try again')
      return
    }
    dirtyRef.current = false
    setError('')
    setSaved(true)
    setTimeout(() => { if (mountedRef.current) setSaved(false) }, 2000)
  }, [child.id])

  // The debounce is 1.2s, so closing the drawer straight after typing used to
  // drop the last edit silently and then setState on an unmounted component.
  // Flush the pending value on the way out instead of cancelling it.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      if (dirtyRef.current) {
        supabase.from('children').update({ notes: latestRef.current || null }).eq('id', child.id)
      }
    }
  }, [child.id])

  const handleChange = (e) => {
    const value = e.target.value
    latestRef.current = value
    dirtyRef.current = true
    setNotes(value)
    setSaved(false)
    setError('')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 1200)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Private notes about {child.first_name}</div>
        <div aria-live="polite" style={{ fontSize: 11, fontWeight: 700, color: error ? '#DC2626' : saving ? 'var(--warn-text)' : saved ? 'var(--ok-text)' : 'transparent' }}>
          {error || (saving ? 'Saving…' : '✓ Saved')}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder={`Add notes about ${child.first_name} — behaviour, progress, parent conversations, anything relevant...`}
        style={{ width: '100%', minHeight: 200, padding: '12px 14px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, lineHeight: 1.7, color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--surface2)' }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Auto-saves as you type. Visible to admins and staff only.</div>
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

  // The drawer closes on Escape via a document-level listener. Without this,
  // pressing Escape to dismiss an enlarged photo closed the whole child record
  // instead. Capture phase so this runs first, and stop it going further.
  useEffect(() => {
    if (!viewing) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setViewing(null)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [viewing])

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('child_attachments')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
    setAttachments(await signRows('gallery', data || [], { pathField: 'storage_path' }))
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
    const path = `${org?.id}/children/${child.id}/attachments/${Date.now()}.${ext}`
    const up = await shrinkImage(file)
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, up, { contentType: up.type })
    if (!upErr) {
      await supabase.from('child_attachments').insert({
        org_id: org?.id, child_id: child.id, url: path, storage_path: path, uploaded_by: authUserId,
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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Photos attached to {child.first_name}'s record</div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: '6px 12px', borderRadius: 9, border: '1.5px dashed #CBD5E1', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 11.5, fontWeight: 700, cursor: uploading ? 'default' : 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Add photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-faint)', fontSize: 12.5 }}>Loading…</div>
      ) : attachments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-faint)', fontSize: 12.5, background: 'var(--surface2)', borderRadius: 14, border: '1px dashed var(--border)' }}>
          No photos attached yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {attachments.map(att => (
            <button key={att.id} onClick={() => setViewing(att)} style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1', background: 'var(--surface-hover)' }}>
              <img src={att.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 420, width: '100%', overflow: 'hidden' }}>
            <img src={viewing.url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700, marginBottom: 2 }}>
                Uploaded {format(new Date(viewing.created_at), 'd MMM yyyy \'at\' HH:mm')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>
                by {viewing.uploader?.full_name || 'Unknown'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setViewing(null)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Close</button>
                <button onClick={() => handleDelete(viewing)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CHILD DRAWER ─────────────────────────────────────────────
// ─── ACTIVITY TAB ─────────────────────────────────────────────
// A history timeline for one child, built only from attendance rows that
// already exist. Nothing here is invented: each entry is a real sign-in or
// sign-out against a real session. Note edits and detail changes are not
// shown because there is no audit trail behind them yet -- an "Updated
// details" row would have to be fabricated to appear.
function ActivityTab({ child, org }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      if (!org?.id) { setLoading(false); return }
      // Fetched wider than it is shown. limit() applies to attendance rows,
      // and one row yields up to two events, so limiting to 50 rows here and
      // showing 50 events would cut the timeline at an arbitrary point. Rows
      // are ordered by created_at because that is the only column every row
      // has -- an unmarked row has neither timestamp -- so the real ordering
      // is done below, after the events exist.
      const { data, error: e } = await supabase
        .from('attendance')
        .select('id, status, signed_in_at, signed_out_at, absence_reason, created_at, session_id, sessions(title, session_date)')
        .eq('child_id', child.id)
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(120)
      if (cancelled) return
      if (e) {
        // An unreadable history is not an empty history. Saying "no activity"
        // when the query failed tells a safeguarding lead this child has never
        // attended, which is a different and much worse claim.
        setError('Activity could not be loaded')
        setLoading(false)
        return
      }
      // One attendance row can be two events -- arrived, then left -- so it is
      // flattened into separate timeline entries and re-sorted by the moment
      // each thing actually happened.
      const events = []
      for (const r of data || []) {
        const label = r.sessions?.title || 'Session'
        if (r.signed_in_at) events.push({ id: r.id + '-in', at: r.signed_in_at, title: 'Signed in', detail: label, tone: 'green' })
        if (r.signed_out_at) events.push({ id: r.id + '-out', at: r.signed_out_at, title: 'Signed out', detail: label, tone: 'blue' })
        if (r.status === 'absent' && !r.signed_in_at) {
          // session_date is the only date an absence has, and it arrives
          // through the embedded join -- which returns null for anyone without
          // Planner access, since sessions carries its own module gate. Those
          // entries still appear, dated from the attendance row instead.
          events.push({
            id: r.id + '-abs',
            at: r.sessions?.session_date || r.created_at || null,
            title: 'Marked absent',
            detail: r.absence_reason ? `${label} — ${r.absence_reason}` : label,
            tone: 'slate',
          })
        }
      }
      // Tie-break on id so two events sharing a timestamp keep a stable order
      // between renders rather than depending on fetch order.
      events.sort((a, b) => (new Date(b.at || 0) - new Date(a.at || 0)) || a.id.localeCompare(b.id))
      setRows(events.slice(0, 60))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [child.id, org?.id])

  const TONES = {
    green: '#16A34A',
    blue: '#2563EB',
    slate: 'var(--text-faint)',
  }

  if (loading) return <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Loading activity…</div>

  if (error) {
    return (
      <div style={{ padding: '22px 18px', textAlign: 'center', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger-text)', marginBottom: 3 }}>{error}</div>
        <div style={{ fontSize: 12.5, color: 'var(--danger-text)', lineHeight: 1.55 }}>
          This does not mean {child.first_name} has no attendance history — the record could not be read.
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>No activity yet</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Sign-ins and sign-outs will appear here once {child.first_name} has attended a session.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
          <div style={{ width: 8, height: 8, borderRadius: 8, background: TONES[r.tone], marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>{r.detail}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {r.at ? format(new Date(r.at), 'd MMM · HH:mm') : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SHARED ROW PRIMITIVES ────────────────────────────────────
// Plain label/value rows rather than a coloured card each. Colour is reserved
// for things that need attention, so ordinary profile data stays neutral and
// the medical panel is the only thing competing for the eye.
function InfoRow({ label, children, last }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: last ? 'none' : '1px solid #F1F5F9', alignItems: 'baseline' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', width: 130, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function SectionHeading({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 2px' }}>
      <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, margin: 0 }}>{children}</h3>
      {action}
    </div>
  )
}

// ─── CHILD DRAWER ─────────────────────────────────────────────
function ChildDrawer({ child, status, attendanceRecord, bubble, bubbles = [], onClose, primary, org, hasSession, onGroupChange, onChildUpdated }) {
  const isMobile = useIsMobile()
  const dragControls = useDragControls()
  const [drawerTab, setDrawerTab] = useState('overview')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [photoCount, setPhotoCount] = useState(null)
  const [copied, setCopied] = useState(false)
  const dialogRef = React.useRef(null)
  const menuRef = React.useRef(null)
  const closeBtnRef = React.useRef(null)
  const tablistRef = React.useRef(null)
  // Focus has to go back where it came from when the modal closes, or a
  // keyboard user is dumped at the top of the register every time they look
  // at a child.
  const openerRef = React.useRef(typeof document !== 'undefined' ? document.activeElement : null)

  // child.photo_url holds an object path (or a legacy public URL) in the now
  // private gallery bucket, so it has to be signed before it can be rendered.
  useEffect(() => {
    let cancelled = false
    // Clear first. The drawer is reused across children rather than remounted,
    // so without this the previous child's photograph stays on screen until the
    // next one finishes signing -- and stays indefinitely if signing fails.
    // Showing one child's photo against another child's record is its own
    // safeguarding problem, so nothing is better than something stale here.
    setPhotoUrl(null)
    if (!child.photo_url) return undefined
    signOne('gallery', child.photo_url).then(u => { if (!cancelled) setPhotoUrl(u) })
    return () => { cancelled = true }
  }, [child.photo_url, child.id])

  // Count only, for the tab label. PhotosTab still loads and signs the
  // attachments itself when that tab is opened.
  useEffect(() => {
    let cancelled = false
    setPhotoCount(null)
    supabase.from('child_attachments').select('id', { count: 'exact', head: true }).eq('child_id', child.id)
      .then(({ count }) => { if (!cancelled) setPhotoCount(count ?? null) })
    return () => { cancelled = true }
  }, [child.id])

  // ESC closes. Menu first if it is open, so one press does not close both.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (menuOpen) { setMenuOpen(false); return }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, menuOpen])

  // Return focus to whatever opened the modal, or a keyboard user is dumped
  // back at the top of the register every time they look at a child. Read on
  // mount and captured in a local, since the ref's value is not guaranteed to
  // still be current by the time cleanup runs.
  useEffect(() => {
    const opener = openerRef.current
    return () => { if (opener && typeof opener.focus === 'function') opener.focus() }
  }, [])

  // Move focus into the dialog on open, then keep it there.
  //
  // Wrapping at the first and last control is not a trap on its own: if focus
  // never enters the dialog it simply tabs on through to the register behind,
  // which is exactly what happened here, because opening the modal by pointer
  // usually leaves activeElement on body. So focus is placed on the close
  // button first, and a focusin listener pulls anything that lands outside
  // back in.
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return undefined
    const focusablesIn = () => Array.from(
      node.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null || el === document.activeElement)

    closeBtnRef.current?.focus()

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const f = focusablesIn()
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    const onFocusIn = (e) => {
      if (node.contains(e.target)) return
      const f = focusablesIn()
      if (f.length) f[0].focus()
    }
    node.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  // Close the overflow menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const currentGroup = child.group_name || ''
  const photoInputRef = React.useRef()

  const name = `${child.first_name} ${child.last_name}`
  const initials = `${child.first_name[0]}${child.last_name[0]}`
  const age = child.date_of_birth ? Math.floor((new Date() - new Date(child.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const bColor = bubble?.color || primary || '#1B9AAA'
  const PURPLE = '#7C3AED'

  const medicalTags = [
    child.has_epipen && 'EpiPen',
    child.has_asthma && 'Asthma',
    child.has_diabetes && 'Diabetes',
    child.has_medication && 'Medication',
    child.allergies && child.allergies,
  ].filter(Boolean)
  const hasMedical = medicalTags.length > 0 || !!child.medical_notes

  const statusCfg = {
    signed_in:  { label: 'Signed in',  color: 'var(--ok-text)', bg: 'var(--ok-bg)', border: 'var(--ok-border)' },
    signed_out: { label: 'Signed out', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
    absent:     { label: 'Absent',     color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
    expected:   { label: 'Expected',   color: 'var(--warn-text)', bg: 'var(--warn-bg)', border: 'var(--warn-border)' },
    unmarked:   { label: 'Not marked', color: 'var(--text3)', bg: 'var(--surface2)', border: 'var(--border)' },
  }
  const sc = statusCfg[status] || statusCfg.unmarked

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${org?.id}/children/${child.id}/photo.${ext}`
    const up = await shrinkImage(file, { maxDimension: 900 })
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, up, { upsert: true, contentType: up.type })
    if (!upErr) {
      // Store the object path, not a URL: the bucket is private, so the only
      // durable reference is the path and signed URLs are minted at read time.
      await supabase.from('children').update({ photo_url: path }).eq('id', child.id)
      setPhotoUrl(await signOne('gallery', path))
    }
    setUploadingPhoto(false)
  }

  const removeFromRegister = async () => {
    setMenuOpen(false)
    if (!window.confirm(`Remove ${name} from the register?`)) return
    const { error: e } = await supabase.from('children').update({ active: false }).eq('id', child.id)
    if (e) {
      // Closing regardless made a refused write look like a completed removal;
      // the child reappears on the next load and nobody knows why.
      window.alert(`${name} could not be removed: ${e.message}`)
      return
    }
    onClose()
  }

  const copyNumber = async (number) => {
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) { /* clipboard unavailable (insecure context, older WebView) */ }
  }

  const ghostBtn = {
    padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }

  const TABS = [
    ['overview', 'Overview'],
    ['notes', 'Notes'],
    ['photos', photoCount ? `Photos ${photoCount}` : 'Photos'],
    ['activity', 'Activity'],
  ]

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 10600, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} — child profile`}
        onClick={e => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose() }}
        style={{
          background: 'var(--surface)', borderRadius: isMobile ? '24px 24px 0 0' : 23,
          width: '100%', maxWidth: isMobile ? '100%' : 486,
          // dvh follows the visible area rather than the layout viewport, so an
          // open keyboard does not push the Notes textarea behind itself.
          maxHeight: isMobile ? '94dvh' : '88vh',
          border: isMobile ? 'none' : '1px solid #EEF1F5',
          boxShadow: '0 24px 64px -12px rgba(15,23,42,0.28)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >

        {/* Mobile drag handle */}
        {isMobile && (
          <div onPointerDown={e => dragControls.start(e)} style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2, cursor: 'grab', touchAction: 'none', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--surface3)' }} />
          </div>
        )}

        {/* ── SCROLLING BODY ── */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch', scrollPaddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* Top controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, padding: '12px 14px 0' }}>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="More actions"
                style={{ width: 32, height: 32, borderRadius: 9, background: menuOpen ? 'var(--border-soft)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-soft)' }}
                onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
              >⋯</button>
              {menuOpen && (
                <div role="menu" style={{ position: 'absolute', top: 36, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 32px -8px rgba(15,23,42,0.22)', padding: 5, minWidth: 194, zIndex: 5 }}>
                  {[
                    ['Edit details', () => { setMenuOpen(false); setEditing(true) }],
                    ['View photos', () => { setMenuOpen(false); setDrawerTab('photos') }],
                    ['View activity', () => { setMenuOpen(false); setDrawerTab('activity') }],
                  ].map(([label, fn]) => (
                    <button key={label} role="menuitem" onClick={fn}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      {label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--surface-hover)', margin: '5px 0' }} />
                  <button role="menuitem" onClick={removeFromRegister}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--danger-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    Remove from register
                  </button>
                </div>
              )}
            </div>
            <button ref={closeBtnRef} onClick={onClose} aria-label="Close" title="Close"
              style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 19, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>×</button>
          </div>

          {/* ── IDENTITY ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 24px 18px' }}>
            <div style={{ position: 'relative', flexShrink: 0, marginBottom: 12 }}>
              <div style={{ width: 76, height: 76, borderRadius: 22, background: bColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, fontWeight: 800, color: '#fff', overflow: 'hidden' }}>
                {photoUrl
                  ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{initials}</span>
                }
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 22 }}>
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>
              <button onClick={() => photoInputRef.current?.click()} aria-label="Change profile photo" title="Change profile photo"
                style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, boxShadow: '0 2px 6px rgba(15,23,42,0.12)' }}><Icon name="📷" /></button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>

            <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.4, lineHeight: 1.2, margin: '0 0 7px', textAlign: 'center' }}>{name}</h2>

            <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text3)' }}>
              {age !== null && <span>Age {age}</span>}
              {(bubble || currentGroup) && <><span aria-hidden="true">·</span><span>{bubble?.label || currentGroup}</span></>}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 99, padding: '2px 9px' }}>{sc.label}</span>
            </div>
          </div>

          {/* ── MEDICAL — the one thing allowed to shout ── */}
          <div style={{ padding: '0 24px' }}>
            {hasMedical ? (
              <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--warn-text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: medicalTags.length ? 9 : 4 }}>
                  <span aria-hidden="true"><Icon name="⚠" /></span> Medical information
                </div>
                {medicalTags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: child.medical_notes ? 9 : 0 }}>
                    {medicalTags.map(t => (
                      <span key={t} style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn-text)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8, padding: '3px 9px' }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: child.medical_notes ? 'var(--warn-text)' : '#A16207', lineHeight: 1.55 }}>
                  {child.medical_notes || 'No additional medical notes'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'var(--ok-text)' }} aria-hidden="true"><Icon name="✓" /></span> No recorded medical alerts
              </div>
            )}
          </div>

          {/* ── TABS ── */}
          <div
            role="tablist"
            aria-label="Child profile sections"
            ref={tablistRef}
            // Arrow keys move between tabs and only the selected tab is a Tab
            // stop, which is the ARIA tab pattern. Four separate Tab stops
            // made reaching the content four presses away.
            onKeyDown={e => {
              const keys = TABS.map(t => t[0])
              const i = keys.indexOf(drawerTab)
              let next = null
              if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length]
              else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length]
              else if (e.key === 'Home') next = keys[0]
              else if (e.key === 'End') next = keys[keys.length - 1]
              if (!next) return
              e.preventDefault()
              setDrawerTab(next)
              setEditing(false)
              tablistRef.current?.querySelector(`#child-tab-${next}`)?.focus()
            }}
            style={{ display: 'flex', gap: 20, padding: '18px 24px 0', borderBottom: '1px solid var(--border-soft)', margin: '4px 0 0' }}>
            {TABS.map(([key, label]) => (
              <button key={key} id={`child-tab-${key}`} role="tab"
                aria-selected={drawerTab === key}
                aria-controls={`child-panel-${key}`}
                tabIndex={drawerTab === key ? 0 : -1}
                onClick={() => { setDrawerTab(key); setEditing(false) }}
                style={{
                  padding: '0 0 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  color: drawerTab === key ? PURPLE : 'var(--text3)',
                  fontWeight: drawerTab === key ? 800 : 600, fontSize: 13.5,
                  borderBottom: `2px solid ${drawerTab === key ? PURPLE : 'transparent'}`,
                  marginBottom: -1, transition: 'color 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── CONTENT ── */}
          <div
            id={`child-panel-${drawerTab}`}
            role="tabpanel"
            aria-labelledby={`child-tab-${drawerTab}`}
            tabIndex={-1}
            style={{ padding: '4px 24px 22px' }}>

            {editing ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 4px' }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Edit details</h3>
                  <button onClick={() => setEditing(false)} style={ghostBtn}>Cancel</button>
                </div>
                <EditChildForm child={child} onSaved={() => onChildUpdated ? onChildUpdated(child.id) : onClose()} />
              </div>
            ) : (
              <>
                {drawerTab === 'overview' && (
                  <div>
                    <SectionHeading action={
                      <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: PURPLE, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Edit</button>
                    }>Personal details</SectionHeading>
                    <div>
                      <InfoRow label="Date of birth">{child.date_of_birth ? format(new Date(child.date_of_birth), 'd MMMM yyyy') : '—'}</InfoRow>
                      <InfoRow label="Group">{bubble?.label || currentGroup || '—'}</InfoRow>
                      {child.school && <InfoRow label="School">{child.school}</InfoRow>}
                      <InfoRow label="Travel home alone" last={!child.sen && !child.has_behaviour_plan}>
                        {child.travel_consent
                          ? <span style={{ color: 'var(--ok-text)' }}><Icon name="✓" /> Consent given</span>
                          : <span style={{ color: 'var(--text3)', fontWeight: 500 }}>Not given</span>}
                      </InfoRow>
                      {child.sen && <InfoRow label="SEN needs" last={!child.has_behaviour_plan}>{child.sen}</InfoRow>}
                      {child.has_behaviour_plan && <InfoRow label="Behaviour plan" last>In place</InfoRow>}
                    </div>

                    <SectionHeading>Emergency contact</SectionHeading>
                    {child.emergency_contact_name ? (
                      <div style={{ paddingTop: 8 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{child.emergency_contact_name}</div>
                        {/* No relationship column exists on children yet, so
                            the contact's role is labelled generically rather
                            than rendering a field that is always empty. */}
                        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>Primary emergency contact</div>
                        {child.emergency_contact_phone && (
                          <>
                            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 4 }}>{child.emergency_contact_phone}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                              <a href={`tel:${child.emergency_contact_phone}`}
                                style={{ ...ghostBtn, background: PURPLE, borderColor: PURPLE, color: '#fff', textDecoration: 'none', display: 'inline-block' }}>
                                Call
                              </a>
                              <button onClick={() => copyNumber(child.emergency_contact_phone)} style={ghostBtn}>
                                <span aria-live="polite">{copied ? '✓ Copied' : 'Copy number'}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text3)', paddingTop: 8 }}>No emergency contact recorded</div>
                    )}

                    {(child.parent_name || child.parent_phone) && (
                      <>
                        <SectionHeading>Parent / carer</SectionHeading>
                        <div style={{ paddingTop: 8 }}>
                          {child.parent_name && <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{child.parent_name}</div>}
                          {child.parent_phone && (
                            <>
                              <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 4 }}>{child.parent_phone}</div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <a href={`tel:${child.parent_phone}`} style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Call</a>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {drawerTab === 'notes' && <div style={{ paddingTop: 16 }}><NotesTab child={child} /></div>}

                {drawerTab === 'photos' && <div style={{ paddingTop: 16 }}><PhotosTab child={child} org={org} /></div>}

                {drawerTab === 'activity' && <div style={{ paddingTop: 8 }}><ActivityTab child={child} org={org} /></div>}
              </>
            )}
          </div>
        </div>

        {/* ── SESSION FOOTER ──
            Only when the modal was opened against a live register AND this
            child has actually been marked. The marking itself lives in
            LiveRegister, which owns the sign-in/out correctness rules, so this
            reports state rather than duplicating that logic. */}
        {hasSession && (signedInTime || signedOutTime) && (
          <div style={{ borderTop: '1px solid var(--border-soft)', background: '#FCFCFD', padding: '13px 24px calc(13px + env(safe-area-inset-bottom))', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
            {signedOutTime ? (
              <><span style={{ color: 'var(--info-text)' }} aria-hidden="true"><Icon name="✓" /></span><span style={{ color: 'var(--info-text)' }}>Signed out at {signedOutTime}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 500, marginLeft: 'auto' }}>In at {signedInTime}</span></>
            ) : (
              <><span style={{ color: 'var(--ok-text)' }} aria-hidden="true"><Icon name="✓" /></span><span style={{ color: 'var(--ok-text)' }}>Signed in at {signedInTime}</span></>
            )}
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </motion.div>
    </div>,
    document.body
  )
}


// ─── MAIN REGISTER ────────────────────────────────────────────
export default function Registers({ org, onNavigate, autoOpenAdd }) {
  const terms = useTerms()
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const isMobile = useIsMobile()
  const { groups: orgGroups, refetch: refetchOrgSettings } = useOrgSettings(orgId)
  const bubbles = normaliseBubbles(orgGroups)
  const { sessions: todaySessions, session: defaultSession, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions, fromCache: sessionFromCache } = useTodaySession(orgId)
  const [chosenSessionId, setChosenSessionId] = useState(null)
  const availableSessions = todaySessions.filter(item => !item.archived_at && !item.cancelled_at && item.status !== 'cancelled' && item.status !== 'draft')
  const session = availableSessions.find(item => item.id === chosenSessionId) || availableSessions.find(item => item.id === defaultSession?.id) || availableSessions[0] || null
  const { children, setChildren, loading, fromCache: childrenFromCache } = useChildren(orgId)
  const { attendance: loadedAttendance, loading: attendanceLoading, fromCache: attendanceFromCache, error: attendanceError, refetch: refetchAttendance } = useAttendance(session?.id, orgId)
  const attendance = loadedAttendance.filter(row => row.session_id === session?.id)
  const isOnline = useOnlineStatus()
  const showOfflineBanner = !isOnline || childrenFromCache || sessionFromCache || (!!session && attendanceFromCache)

  const [selectedChild, setSelectedChild] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  useEffect(() => { setSelectedIds(new Set()); setSelectMode(false); setSelectedChild(null) }, [session?.id, orgId])
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGroupsSetup, setShowGroupsSetup] = useState(false)
  const [activeImportTemplate, setActiveImportTemplate] = useState(null)
  const [toast, setToast] = useState('')
  const [showPastRegisters, setShowPastRegisters] = useState(false)
  const [pastSessions, setPastSessions] = useState([])
  const [pastSessionsLoading, setPastSessionsLoading] = useState(false)
  const [viewingPastSession, setViewingPastSession] = useState(null)
  const [viewingPastAttendance, setViewingPastAttendance] = useState([])
  const [viewingPastLoading, setViewingPastLoading] = useState(false)

  useEffect(() => {
    if (!showPastRegisters || !orgId) return
    setPastSessionsLoading(true)
    // Archived registers live in the Archive tab instead, so they're excluded here.
    supabase.from('sessions').select('*').eq('org_id', orgId).not('closed_at', 'is', null).is('archived_at', null)
      .order('closed_at', { ascending: false }).limit(300)
      .then(({ data }) => { setPastSessions(data || []); setPastSessionsLoading(false) })
  }, [showPastRegisters, orgId])

  const openPastSession = async (s) => {
    setViewingPastLoading(true)
    setViewingPastSession(s)
    const { data } = await supabase.from('attendance').select('*').eq('org_id', orgId).eq('session_id', s.id)
    setViewingPastAttendance(data || [])
    setViewingPastLoading(false)
  }

  // ── ARCHIVE — closed registers the retention sweep has moved out of
  // Past Registers (see register_retention_months in Settings). Still
  // fully viewable/restorable here right up until they're permanently
  // deleted per the org's grace-period setting. ──
  const [showArchive, setShowArchive] = useState(false)
  const [archivedSessions, setArchivedSessions] = useState([])
  const [archivedSessionsLoading, setArchivedSessionsLoading] = useState(false)
  const [viewingArchivedSession, setViewingArchivedSession] = useState(null)
  const [viewingArchivedAttendance, setViewingArchivedAttendance] = useState([])
  const [viewingArchivedLoading, setViewingArchivedLoading] = useState(false)

  const loadArchivedSessions = React.useCallback(() => {
    if (!orgId) return
    setArchivedSessionsLoading(true)
    supabase.from('sessions').select('*').eq('org_id', orgId).not('archived_at', 'is', null)
      .order('archived_at', { ascending: false }).limit(300)
      .then(({ data }) => { setArchivedSessions(data || []); setArchivedSessionsLoading(false) })
  }, [orgId])

  useEffect(() => { if (showArchive) loadArchivedSessions() }, [showArchive, loadArchivedSessions])

  const openArchivedSession = async (s) => {
    setViewingArchivedLoading(true)
    setViewingArchivedSession(s)
    const { data } = await supabase.from('attendance').select('*').eq('org_id', orgId).eq('session_id', s.id)
    setViewingArchivedAttendance(data || [])
    setViewingArchivedLoading(false)
  }

  const handleRestoreSession = async (s) => {
    await supabase.from('sessions').update({ archived_at: null }).eq('org_id', orgId).eq('id', s.id)
    setArchivedSessions(prev => prev.filter(x => x.id !== s.id))
    showToast(`"${s.title}" restored to Past Registers`)
  }

  // Triggered by the mobile Launch menu's "Add Child" quick action — opens the same
  // Add Child modal a person would reach via the header button, just pre-opened.
  useEffect(() => { if (autoOpenAdd) setShowAdd(true) }, [autoOpenAdd])

  const getAttRec = (id) => attendance.find(a => a.child_id === id)
  const getStatus = (id) => getAttRec(id)?.status || 'unmarked'
  const getBubble = (child) => bubbles.find(b => {
    const g = (child.group_name || '').toLowerCase()
    return g === b.key || g === b.label.toLowerCase()
  }) || null

  const handlePrint = (visible = children, withAttendance = false) => {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    const rows = visible.map(c => {
      const status = withAttendance ? getStatus(c.id) : 'unmarked'
      const bubble = getBubble(c)
      const statusLabel = { signed_in: 'In', signed_out: 'Out', absent: 'Absent', expected: 'Expected', unmarked: '—' }[status] || '—'
      const alerts = [c.allergies && '⚠ Allergy', c.medical_notes && '✚ Medical', c.has_epipen && '💉 EpiPen'].filter(Boolean).join('  ')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700">${escape(c.first_name)} ${escape(c.last_name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700">${escape(bubble?.label || 'Ungrouped')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#dc2626">${alerts}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:800;color:${status === 'signed_in' ? '#16a34a' : status === 'absent' ? '#dc2626' : 'var(--text3)'}">${statusLabel}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#94a3b8;font-size:12px">_______________</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>Register — ${escape(org?.name)}</title>
    <style>body{font-family:system-ui,sans-serif;color:#111;padding:24px}h1{font-size:20px;font-weight:900;margin:0 0 4px}p{margin:0 0 16px;color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse}th{padding:8px 10px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #e5e7eb}@media print{.no-print{display:none}}</style>
    </head><body>
    <button class="no-print" onclick="window.close()" aria-label="Close" style="position:fixed;top:16px;right:16px;width:34px;height:34px;border-radius:50%;border:1.5px solid #e5e7eb;background:#fff;color:#374151;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px -2px rgba(0,0,0,0.15);z-index:99">×</button>
    <h1>${escape(withAttendance ? session?.title || 'Register' : terms.People)} — ${escape(org?.name)}</h1>
    <p>${new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; ${visible.length} ${escape(terms.people)}</p>
    <table><thead><tr>
      <th>Name</th><th>Group</th><th>Alerts</th><th>Status</th><th>Signature</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`

    const w = window.open('', '_blank')
    if (!w) { showToast('Allow pop-ups to print the register.'); return }
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
      const { error: err } = await supabase.from('children').update({ group_name: groupLabel }).eq('org_id', orgId).in('id', ids)
      if (err) throw err
      setChildren(prev => prev.map(c => ids.includes(c.id) ? { ...c, group_name: groupLabel } : c))
      showToast(`Moved ${ids.length} ${ids.length === 1 ? terms.person : terms.people} to ${groupLabel}`)
      clearSelection()
    } catch (e) {
      showToast(`⚠️ Could not assign group: ${e.message || 'unknown error'}`)
    }
    setBulkAssigning(false)
  }

  return (
    <div style={{ height: '100%', minWidth: 0, position: 'relative', overflow: 'hidden', background: 'var(--surface2)' }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', borderRadius: 12, padding: '11px 20px', fontSize: 13, fontWeight: 700, zIndex: 10900, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', overflowWrap: 'anywhere' }}>
          <span style={{ color: '#4ADE80' }}><Icon name="✓" /></span> {toast}
        </div>
      )}

      <RegisterWorkspace
        org={org} terms={terms} people={children} sessions={availableSessions} session={session}
        onSessionChange={setChosenSessionId} attendance={attendance} loading={loading}
        sessionsLoading={sessionsLoading} sessionsError={sessionsError} onRetrySessions={refetchSessions} attendanceLoading={attendanceLoading} attendanceError={attendanceError} onRetryAttendance={refetchAttendance} offline={showOfflineBanner}
        groups={bubbles} selectedIds={selectedIds} selectMode={selectMode} assigning={bulkAssigning}
        onSelectMode={() => { clearSelection(); setSelectMode(value => !value) }}
        onToggleSelect={toggleSelect} onSelectVisible={ids => setSelectedIds(new Set(ids))}
        onClearSelection={clearSelection} onAssign={handleBulkAssignGroup}
        onPerson={child => setSelectedChild({ child, status: getStatus(child.id), attRec: getAttRec(child.id) })}
        onOpenRegister={item => onNavigate?.('registers', { sessionId: item.id })}
        onPlan={() => onNavigate?.('planner')} onToday={() => onNavigate?.('today')}
        onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)}
        onTemplates={() => setShowTemplates(true)} onGroups={() => setShowGroupsSetup(true)}
        onMedical={() => onNavigate?.('medical_alerts')} onPrint={handlePrint}
        onHistory={() => setShowPastRegisters(true)} onArchive={() => setShowArchive(true)}
      />

      {/* Shared import dialog keeps the upload comfortable on desktop and mobile. */}
      {showImport && createPortal(
        <div onClick={() => { setShowImport(false); setActiveImportTemplate(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', padding: isMobile ? 0 : 24, justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-label="Import register" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: isMobile ? '24px 24px 0 0' : 24, width: '100%', maxWidth: 620, maxHeight: '88dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Import {terms.people}</div>
              <button aria-label="Close import" onClick={() => { setShowImport(false); setActiveImportTemplate(null) }} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-hover)', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: primary, marginBottom: 8 }}>STEP 1 OF 2 · UPLOAD</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text3)', margin: '0 0 20px' }}>Bring your existing register into {org?.name || 'your organisation'}. Review matched columns and duplicates before anything is added.</p>
            {activeImportTemplate && (
              <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, color: 'var(--org-ink)', background: primary + '0c', border: `1px solid var(--org-a10)`, borderRadius: 8, padding: '6px 10px' }}>
                🧩 Using "{activeImportTemplate.name}" template
              </div>
            )}
            <InlineChildImport org={org} template={activeImportTemplate} existingChildren={children} groups={bubbles} onImported={(newChildren, added) => {
              setChildren(newChildren)
              setShowImport(false)
              setActiveImportTemplate(null)
              showToast(`${added} added · ${newChildren.length} ${terms.people} in your directory`)
            }} />
          </div>
        </div>,
        document.body
      )}

      {/* Import templates are available from Tools on every viewport. */}
      {showTemplates && createPortal(
        <div onClick={() => setShowTemplates(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10700, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', padding: isMobile ? 0 : 24, justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: isMobile ? '24px 24px 0 0' : 24, width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Import Templates</div>
              <button aria-label="Close templates" onClick={() => setShowTemplates(false)} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-hover)', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button>
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

      {/* CHILD DRAWER */}
      {selectedChild && (
        <ChildDrawer
          // Keyed so switching child remounts rather than reuses. Without
          // this, NotesTab keeps the previous child's text in state while the
          // save closure moves to the new child's id -- one child's notes get
          // written onto another's record. Tab, menu and photo-count state
          // were leaking across children for the same reason.
          key={selectedChild.child.id}
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
            const { data } = await supabase.from('children').select('*').eq('org_id', orgId).eq('id', childId).single()
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

      {/* ARCHIVE — registers the retention policy has moved out of Past Registers */}
      {showArchive && (
        <ArchiveListModal
          sessions={archivedSessions}
          loading={archivedSessionsLoading}
          primary={primary}
          org={org}
          onClose={() => setShowArchive(false)}
          onSelect={openArchivedSession}
          onRestore={handleRestoreSession}
        />
      )}

      {viewingArchivedSession && !viewingArchivedLoading && (
        <HistoricalAttendanceModal
          session={viewingArchivedSession}
          attendance={viewingArchivedAttendance}
          allChildren={children}
          primary={primary}
          secondary={org?.secondary_color || primary}
          onClose={() => { setViewingArchivedSession(null); setViewingArchivedAttendance([]) }}
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
      background: isMobile ? 'var(--surface2)' : 'rgba(15,23,42,0.45)',
      alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? 0 : 24, boxSizing: 'border-box',
    }} onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 560, maxHeight: isMobile ? 'none' : '86vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: isMobile ? 0 : 24, flex: isMobile ? 1 : undefined,
        background: 'var(--surface2)', boxShadow: isMobile ? 'none' : '0 24px 60px -20px rgba(0,0,0,0.35)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: `linear-gradient(165deg, var(--org-a05) 0%, var(--surface) 60%)`, borderBottom: '1px solid var(--border)', padding: isMobile ? '18px 18px 14px' : '20px 22px 16px', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: isMobile ? 14 : 16, right: isMobile ? 14 : 16,
            width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text2)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="✕" /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: 40 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: `linear-gradient(135deg, ${primary}, var(--org-a85))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}><img src="/icons/past-registers-icon.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} /></div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3 }}>Past Registers</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{sessions.length} closed session{sessions.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search sessions..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px 24px' : '16px 22px 24px', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>Loading past registers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>
              {sessions.length === 0 ? 'No sessions have been closed yet.' : 'Nothing matches your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {groups.map(g => (
                <div key={g.label}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {g.items.map(s => (
                      <button key={s.id} onClick={() => onSelect(s)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                        background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '11px 13px',
                        cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                      }}>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-hover)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}><Icon name="🔒" /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, marginTop: 1 }}>
                            {fmtDayDate(s.session_date)}{s.start_time ? ` · ${s.start_time}` : ''}{s.location ? ` · ${s.location}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, color: 'var(--text-faint)', flexShrink: 0 }}><Icon name="→" /></span>
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

// ─── ARCHIVE LIST ─────────────────────────────────────────────
// Registers the retention sweep has moved out of Past Registers (see
// register_retention_months in Settings > Registers). Still fully
// viewable and restorable here — if the org has also set a deletion
// grace period, each row shows how long until it's permanently removed.
function ArchiveListModal({ sessions, loading, primary, org, onClose, onSelect, onRestore }) {
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

  const deletionInfo = (s) => {
    if (org?.register_deletion_grace_months == null || !s.archived_at) return null
    const deleteDate = new Date(s.archived_at)
    deleteDate.setMonth(deleteDate.getMonth() + org.register_deletion_grace_months)
    const daysLeft = Math.ceil((deleteDate.getTime() - Date.now()) / 86400000)
    if (daysLeft <= 0) return 'Pending deletion'
    if (daysLeft === 1) return 'Deletes tomorrow'
    if (daysLeft <= 31) return `Deletes in ${daysLeft} days`
    return `Deletes ${deleteDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
      background: isMobile ? 'var(--surface2)' : 'rgba(15,23,42,0.45)',
      alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? 0 : 24, boxSizing: 'border-box',
    }} onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 560, maxHeight: isMobile ? 'none' : '86vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: isMobile ? 0 : 24, flex: isMobile ? 1 : undefined,
        background: 'var(--surface2)', boxShadow: isMobile ? 'none' : '0 24px 60px -20px rgba(0,0,0,0.35)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: `linear-gradient(165deg, var(--org-a05) 0%, var(--surface) 60%)`, borderBottom: '1px solid var(--border)', padding: isMobile ? '18px 18px 14px' : '20px 22px 16px', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: isMobile ? 14 : 16, right: isMobile ? 14 : 16,
            width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text2)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="✕" /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: 40 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: `linear-gradient(135deg, ${primary}, var(--org-a85))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🗄️</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3 }}>Archive</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{sessions.length} archived session{sessions.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          {org?.register_retention_months == null && (
            <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 10, padding: '8px 12px', fontSize: 11.5, color: 'var(--info-text)', fontWeight: 600, marginBottom: 12 }}>
              Automatic archiving is off. Turn it on in Settings → Registers → Data Retention to move old registers here automatically.
            </div>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search archived sessions..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px 24px' : '16px 22px 24px', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>Loading archive…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>
              {sessions.length === 0 ? 'Nothing archived yet.' : 'Nothing matches your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {groups.map(g => (
                <div key={g.label}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {g.items.map(s => {
                      const delInfo = deletionInfo(s)
                      return (
                        <div key={s.id} onClick={() => onSelect(s)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', boxSizing: 'border-box',
                          background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '11px 13px',
                          cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                        }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🗄️</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, marginTop: 1 }}>
                              {fmtDayDate(s.session_date)}{s.start_time ? ` · ${s.start_time}` : ''}
                            </div>
                            {delInfo && (
                              <div style={{ fontSize: 10.5, color: 'var(--danger-text)', fontWeight: 700, marginTop: 3 }}><Icon name="⚠" /> {delInfo}</div>
                            )}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); onRestore(s) }} style={{
                            flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: 'var(--org-ink)', background: 'var(--org-a05)',
                            border: `1px solid var(--org-a20)`, borderRadius: 99, padding: '6px 11px', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>↩ Restore</button>
                        </div>
                      )
                    })}
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
function AddChildModal({ orgId, bubbles, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', group_name: bubbles[0]?.label || '', allergies: '', medical_notes: '', emergency_contact_name: '', emergency_contact_phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fi = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lb = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }

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
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>Add Child</div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--surface3)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          {error && <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#C00' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginBottom: 12 }}>
            <div><label style={lb}>First Name *</label><input style={fi} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div><label style={lb}>Last Name *</label><input style={fi} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Date of Birth</label><input style={fi} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
          <div style={{ marginBottom: 12 }}>
            <label style={lb}>Group</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {bubbles.map(b => (
                <button key={b.key} onClick={() => set('group_name', b.label)} style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${form.group_name === b.label ? b.color : 'var(--border)'}`, background: form.group_name === b.label ? b.color + '18' : 'var(--surface)', color: form.group_name === b.label ? b.color : 'var(--text3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Allergies</label><input style={fi} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Nut allergy" /></div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Medical Notes</label><input style={fi} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="e.g. Asthma" /></div>
          <div style={{ marginBottom: 12 }}><label style={lb}>Emergency Contact</label><input style={fi} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Name" /></div>
          <div style={{ marginBottom: 20 }}><input style={fi} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="Phone number" type="tel" /></div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? 'var(--text-faint)' : '#1B9AAA', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 20 }}>
            {saving ? 'Adding...' : 'Add Child'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

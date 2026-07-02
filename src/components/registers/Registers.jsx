import React, { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren } from '../../lib/hooks'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import { useIsMobile } from '../../hooks/useIsMobile'

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

// ─── EDIT FORM ────────────────────────────────────────────────
function EditChildForm({ child, onSaved }) {
  const [form, setForm] = useState({
    first_name: child.first_name || '', last_name: child.last_name || '',
    date_of_birth: child.date_of_birth || '', group_name: child.group_name || '',
    allergies: child.allergies || '', medical_notes: child.medical_notes || '',
    emergency_contact_name: child.emergency_contact_name || '',
    emergency_contact_phone: child.emergency_contact_phone || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fi = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const lb = { fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('children').update({
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null, group_name: form.group_name || null,
      allergies: form.allergies || null, medical_notes: form.medical_notes || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    }).eq('id', child.id)
    setSaving(false)
    onSaved()
  }
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label style={lb}>First Name *</label><input style={fi} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label style={lb}>Last Name *</label><input style={fi} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
      </div>
      <div style={{ marginBottom: 8 }}><label style={lb}>Date of Birth</label><input style={fi} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
      <div style={{ marginBottom: 8 }}><label style={lb}>Group</label><input style={fi} value={form.group_name} onChange={e => set('group_name', e.target.value)} placeholder="e.g. Red" /></div>
      <div style={{ marginBottom: 8 }}><label style={lb}>Allergies</label><input style={fi} value={form.allergies} onChange={e => set('allergies', e.target.value)} /></div>
      <div style={{ marginBottom: 8 }}><label style={lb}>Medical Notes</label><input style={fi} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} /></div>
      <div style={{ marginBottom: 8 }}><label style={lb}>Emergency Contact Name</label><input style={fi} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
      <div style={{ marginBottom: 12 }}><label style={lb}>Emergency Contact Phone</label><input style={fi} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} type="tel" /></div>
      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : '#1B9AAA', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

// ─── INLINE IMPORT ────────────────────────────────────────────
const CSV_COLS = ['first_name','last_name','date_of_birth','group_name','allergies','medical_notes','emergency_contact_name','emergency_contact_phone']

function InlineChildImport({ org, onImported }) {
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
    const blob = new Blob([`${CSV_COLS.join(',')}\nSarah,Jones,2015-06-14,Red,Nut allergy,Asthma,Jane Jones,07700900000\n`], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'children-import.csv'; a.click()
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
            <span style={{ color: '#9CA3AF' }}>{r.group_name || '—'}</span>
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

// ─── CHILD DRAWER ─────────────────────────────────────────────
function ChildDrawer({ child, status, attendanceRecord, bubble, bubbles = [], onClose, onUpdateStatus, primary, hasSession, onGroupChange }) {
  const isMobile = useIsMobile()
  const [drawerTab, setDrawerTab] = useState(hasSession ? 'actions' : 'info')
  const [absenceReason, setAbsenceReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState(child.photo_url || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [assigningGroup, setAssigningGroup] = useState(false)
  const [currentGroup, setCurrentGroup] = useState(child.group_name || '')
  const photoInputRef = React.useRef()

  const handleGroupAssign = async (groupLabel) => {
    setAssigningGroup(true)
    await supabase.from('children').update({ group_name: groupLabel }).eq('id', child.id)
    setCurrentGroup(groupLabel)
    if (onGroupChange) onGroupChange(child.id, groupLabel)
    setAssigningGroup(false)
  }

  const name = `${child.first_name} ${child.last_name}`
  const initials = `${child.first_name[0]}${child.last_name[0]}`
  const age = child.date_of_birth ? Math.floor((new Date() - new Date(child.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const hasAlerts = child.allergies || child.medical_notes
  const bColor = bubble?.color || primary || '#1B9AAA'
  const currentBubble = bubbles.find(b => b.label?.toLowerCase() === currentGroup?.toLowerCase()) || bubble

  const statusCfg = {
    signed_in:  { label: 'Signed In',  color: '#16A34A', bg: '#DCFCE7', icon: '✓' },
    signed_out: { label: 'Signed Out', color: '#2563EB', bg: '#DBEAFE', icon: '↗' },
    absent:     { label: 'Absent',     color: '#DC2626', bg: '#FEE2E2', icon: '✕' },
    expected:   { label: 'Expected',   color: '#D97706', bg: '#FEF3C7', icon: '◌' },
    unmarked:   { label: 'Not marked', color: '#6B7280', bg: '#F3F4F6', icon: '—' },
  }
  const sc = statusCfg[status] || statusCfg.unmarked

  const handleAction = (newStatus) => {
    onUpdateStatus(child.id, newStatus, newStatus === 'absent' ? { absence_reason: absenceReason } : {})
    onClose()
  }

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
        <div style={{ background: `linear-gradient(145deg, ${bColor}EE 0%, ${bColor} 100%)`, padding: '24px 20px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Child Profile</span>
            <button onClick={e => { e.stopPropagation(); onClose() }} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>

          {/* Avatar + info */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            {/* Photo with upload */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.22)', border: '3px solid rgba(255,255,255,0.5)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                {photoUrl
                  ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28 }}>{initials}</span>
                }
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>
              {/* Camera upload button */}
              <button onClick={e => { e.stopPropagation(); photoInputRef.current?.click() }}
                style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: `2px solid ${bColor}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                📷
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>

            {/* Name & badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 8, letterSpacing: -0.3 }}>{name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {age !== null && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Age {age}</span>
                )}
                {bubble && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{bubble.label}</span>
                )}
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
                  {sc.icon} {sc.label}
                </span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {hasAlerts && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {child.allergies && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🟠</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Allergy</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{child.allergies}</div>
                  </div>
                </div>
              )}
              {child.medical_notes && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔴</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Medical</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{child.medical_notes}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick group assign */}
          {bubbles.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Quick Assign Group</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {bubbles.map(b => {
                  const isActive = currentGroup?.toLowerCase() === b.label?.toLowerCase()
                  return (
                    <button key={b.key} onClick={() => handleGroupAssign(b.label)} disabled={assigningGroup}
                      style={{ padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.25)'}`, background: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, fontWeight: isActive ? 900 : 600, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, flexShrink: 0, boxShadow: isActive ? `0 0 6px ${b.color}` : 'none' }} />
                      {b.label}
                      {isActive && <span style={{ fontSize: 9 }}>✓</span>}
                    </button>
                  )
                })}
                {currentGroup && (
                  <button onClick={() => handleGroupAssign('')} disabled={assigningGroup}
                    style={{ padding: '5px 10px', borderRadius: 99, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Signed in/out times */}
          {(signedInTime || signedOutTime) && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              {signedInTime && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Signed In</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{signedInTime}</div>
                </div>
              )}
              {signedOutTime && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Signed Out</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{signedOutTime}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', padding: '10px 12px', gap: 6, background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          {[
            ...(hasSession ? [['actions', '✋ Sign In/Out']] : []),
            ['info', '📋 Info'],
            ['edit', '✏️ Edit'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setDrawerTab(key)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', background: drawerTab === key ? '#fff' : 'transparent', color: drawerTab === key ? '#111' : '#9CA3AF', fontWeight: drawerTab === key ? 800 : 500, fontSize: 11, cursor: 'pointer', boxShadow: drawerTab === key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '16px 18px 24px', flex: 1 }}>

          {/* SIGN IN/OUT */}
          {drawerTab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => handleAction('signed_in')} disabled={status === 'signed_in'}
                  style={{ padding: '16px 12px', borderRadius: 14, border: 'none', background: status === 'signed_in' ? '#DCFCE7' : '#16A34A', color: status === 'signed_in' ? '#16A34A' : '#fff', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  {status === 'signed_in' ? 'Signed In' : 'Sign In'}
                </button>
                <button onClick={() => handleAction('signed_out')} disabled={status !== 'signed_in'}
                  style={{ padding: '16px 12px', borderRadius: 14, border: 'none', background: status === 'signed_out' ? '#DBEAFE' : status === 'signed_in' ? bColor : '#F3F4F6', color: status === 'signed_out' ? '#1D4ED8' : status === 'signed_in' ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 18 }}>👋</span>
                  {status === 'signed_out' ? 'Signed Out' : 'Sign Out'}
                </button>
              </div>
              <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Absence Reason</label>
                <input placeholder="e.g. Sick, holiday, appointment..." value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={() => handleAction('absent')}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>✕</span> Mark Absent
                </button>
              </div>
            </div>
          )}

          {/* INFO */}
          {drawerTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!hasSession && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>No active session</div>
                    <div style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>Sign in/out is only available during a live session.</div>
                  </div>
                </div>
              )}

              {/* DOB + Age */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Date of Birth</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{child.date_of_birth ? format(new Date(child.date_of_birth), 'd MMM yyyy') : '—'}</div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Age</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{age !== null ? `${age} years old` : '—'}</div>
                </div>
              </div>

              {/* Group */}
              {(currentGroup || bubble) && (
                <div style={{ background: (currentBubble?.color || bColor) + '10', border: `1px solid ${(currentBubble?.color || bColor)}30`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentBubble?.color || bColor, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Group</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: currentBubble?.color || bColor, marginTop: 2 }}>{currentGroup || bubble?.label || '—'}</div>
                  </div>
                </div>
              )}

              {/* Emergency contact */}
              <div style={{ background: child.emergency_contact_name ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${child.emergency_contact_name ? '#BFDBFE' : '#F1F5F9'}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📞</span> Emergency Contact
                </div>
                {child.emergency_contact_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>{child.emergency_contact_name}</div>
                      {child.emergency_contact_phone && (
                        <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 14, color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>{child.emergency_contact_phone}</a>
                      )}
                    </div>
                    {child.emergency_contact_phone && (
                      <a href={`tel:${child.emergency_contact_phone}`}
                        style={{ width: 40, height: 40, borderRadius: 12, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                        📞
                      </a>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#9CA3AF' }}>No emergency contact set</div>
                )}
              </div>

              {/* Alerts detail */}
              {hasAlerts && (
                <div style={{ background: '#FFF8F0', border: '1px solid #FED7AA', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>⚠️ Health Alerts</div>
                  {child.allergies && (
                    <div style={{ marginBottom: child.medical_notes ? 8 : 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Allergies</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>{child.allergies}</div>
                    </div>
                  )}
                  {child.medical_notes && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Medical Notes</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>{child.medical_notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* EDIT */}
          {drawerTab === 'edit' && <EditChildForm child={child} onSaved={onClose} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// ─── CIRCULAR PROGRESS RING ───────────────────────────────────
function CircularProgress({ value, max, color, label, size = 92 }) {
  const [animated, setAnimated] = useState(0)
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 80)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - animated)}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)', filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedNumber value={value} color="#fff" size={22} />
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    </div>
  )
}

function AnimatedNumber({ value, color, size = 20 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf
    const start = display
    const startTime = performance.now()
    const duration = 500
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (value - start) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <div style={{ fontSize: size, fontWeight: 900, color, lineHeight: 1, fontFamily: 'var(--font-display, sans-serif)' }}>{display}</div>
}

// ─── DOT GRID — ONE DOT PER CHILD ─────────────────────────────
function DotGrid({ children, getStatus }) {
  const STATUS_COLORS = { signed_in: '#22C55E', signed_out: '#3B82F6', absent: '#EF4444', expected: '#CBD5E1', unmarked: '#CBD5E1' }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {children.map((c, i) => {
        const s = getStatus(c.id)
        const color = STATUS_COLORS[s] || STATUS_COLORS.unmarked
        return (
          <div key={c.id} title={`${c.first_name} ${c.last_name}`}
            style={{ width: 9, height: 9, borderRadius: '50%', background: color, transition: 'background 0.4s ease, transform 0.2s ease', animation: `dotPop 0.3s ease ${Math.min(i * 0.006, 1)}s both`, boxShadow: s === 'signed_in' ? `0 0 5px ${color}90` : 'none' }} />
        )
      })}
      <style>{`@keyframes dotPop { 0% { opacity: 0; transform: scale(0.4); } 100% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  )
}

// ─── CHILD ROW — FAST SIGN IN ──────────────────────────────────
function ChildCard({ child, status, bubble, onClick, onSignIn, onSignOut, primary }) {
  const bColor = bubble?.color || primary || '#1B9AAA'
  const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
  const [busy, setBusy] = useState(false)

  const signedInTime = child._signedInAt ? format(new Date(child._signedInAt), 'HH:mm') : null
  const signedOutTime = child._signedOutAt ? format(new Date(child._signedOutAt), 'HH:mm') : null

  const isExpected = status === 'expected' || status === 'unmarked'
  const isIn = status === 'signed_in'
  const isOut = status === 'signed_out'
  const isAbsent = status === 'absent'

  const handleButtonClick = async (e) => {
    e.stopPropagation()
    setBusy(true)
    if (isIn) await onSignOut(child.id)
    else await onSignIn(child.id)
    setBusy(false)
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '1px solid #F1F5F9',
        cursor: 'pointer', background: isIn ? '#F0FDF4' : isOut ? '#EFF6FF' : isAbsent ? '#FEF2F2' : '#fff',
        transition: 'background 0.25s ease', minHeight: 68,
      }}
      onMouseEnter={e => { if (isExpected) e.currentTarget.style.background = '#FAFBFC' }}
      onMouseLeave={e => { e.currentTarget.style.background = isIn ? '#F0FDF4' : isOut ? '#EFF6FF' : isAbsent ? '#FEF2F2' : '#fff' }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: bColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', overflow: 'hidden', boxShadow: `0 3px 10px ${bColor}45` }}>
          {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        {isIn && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 900 }}>✓</div>}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {child.first_name} {child.last_name}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {bubble && <span style={{ color: bColor, fontWeight: 700 }}>{bubble.label}</span>}
          {isExpected && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#94A3B8' }}>◌ Expected</span>}
          {isIn && signedInTime && <span style={{ color: '#16A34A', fontWeight: 700 }}>In {signedInTime}</span>}
          {isOut && signedOutTime && <span style={{ color: '#2563EB', fontWeight: 700 }}>Out {signedOutTime}</span>}
          {child.allergies && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, color: '#D97706', background: '#FEF3C7', borderRadius: 99, padding: '1px 8px' }}>⚠ Allergy</span>
          )}
          {child.medical_notes && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', borderRadius: 99, padding: '1px 8px' }}>✚ Medical</span>
          )}
        </div>
      </div>

      {/* Morphing sign in/out button */}
      <button
        onClick={handleButtonClick}
        disabled={busy || isOut || isAbsent}
        style={{
          minWidth: 96, padding: '10px 16px', borderRadius: 12, border: 'none', cursor: (isOut || isAbsent) ? 'default' : 'pointer',
          fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2, flexShrink: 0, transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          background: isIn ? '#F97316' : isOut ? '#E2E8F0' : isAbsent ? '#FECACA' : '#16A34A',
          color: isIn ? '#fff' : isOut ? '#64748B' : isAbsent ? '#991B1B' : '#fff',
          boxShadow: isExpected ? '0 4px 14px rgba(22,163,74,0.35)' : isIn ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
          transform: busy ? 'scale(0.95)' : 'scale(1)',
        }}
      >
        {busy ? '···' : isIn ? '↗ Sign Out' : isOut ? '✓ Signed Out' : isAbsent ? '✕ Absent' : '✓ Sign In'}
      </button>
    </div>
  )
}

// ─── MAIN REGISTER — LIVE REGISTER EXPERIENCE ──────────────────
export default function Registers({ org }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#0EA5E9'
  const isMobile = useIsMobile()
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbles = normaliseBubbles(orgGroups)
  const { session } = useTodaySession(orgId)
  const { children, setChildren, loading } = useChildren(orgId)
  const { attendance, updateStatus } = useAttendance(session?.id)

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [activeGroup, setActiveGroup] = useState('all')
  const [selectedChild, setSelectedChild] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [toast, setToast] = useState('')
  const [note, setNote] = useState('')
  const [activity, setActivity] = useState([])
  const searchRef = useRef(null)

  const getAttRec = (id) => attendance.find(a => a.child_id === id)
  const getStatus = (id) => getAttRec(id)?.status || 'unmarked'
  const getBubble = (child) => bubbles.find(b => {
    const g = (child.group_name || '').toLowerCase()
    return g === b.key || g === b.label.toLowerCase()
  }) || null

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
      await supabase.from('attendance').insert([{ session_id: session.id, child_id: childId, ...updates }])
    }
    const t = format(new Date(), 'HH:mm')
    const activityMsg = status === 'signed_in' ? `${name} signed in` : status === 'signed_out' ? `${name} signed out` : `${name} marked absent`
    setActivity(prev => [{ id: Date.now(), time: t, msg: activityMsg, type: status }, ...prev].slice(0, 12))
    if (status === 'signed_in') showToast(`✓ ${name} signed in at ${t}`)
    else if (status === 'signed_out') showToast(`${name} signed out at ${t}`)
    else showToast(`${name} marked absent`)
  }

  // Keyboard-first quick sign-in: Enter signs in the top filtered match
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setSearch(''); return }
    if (e.key === 'Enter' && search.trim()) {
      const match = filtered.find(c => ['expected', 'unmarked'].includes(getStatus(c.id)))
      if (match) { handleUpdateStatus(match.id, 'signed_in'); setSearch('') }
    }
  }

  const counts = {
    total:      children.length,
    signed_in:  children.filter(c => getStatus(c.id) === 'signed_in').length,
    absent:     children.filter(c => getStatus(c.id) === 'absent').length,
    expected:   children.filter(c => ['expected','unmarked'].includes(getStatus(c.id))).length,
    signed_out: children.filter(c => getStatus(c.id) === 'signed_out').length,
  }

  const availableGroups = React.useMemo(() => {
    const fromBubbles = bubbles.map(b => b.label)
    const fromChildren = [...new Set(children.map(c => c.group_name).filter(Boolean))]
    return [...new Set([...fromBubbles, ...fromChildren])]
  }, [bubbles, children])

  const filtered = children.filter(c => {
    const nameOk = !search.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const s = getStatus(c.id)
    const tabOk = activeTab === 'all'
      || (activeTab === 'signed_in' && s === 'signed_in')
      || (activeTab === 'absent' && s === 'absent')
      || (activeTab === 'expected' && ['expected','unmarked'].includes(s))
      || (activeTab === 'signed_out' && s === 'signed_out')
    const groupOk = activeGroup === 'all' || (c.group_name || '').toLowerCase() === activeGroup.toLowerCase()
    return nameOk && tabOk && groupOk
  })

  const medicalAlerts = children.filter(c => c.allergies || c.medical_notes)
  const attendanceRate = counts.total > 0 ? Math.round((counts.signed_in / counts.total) * 100) : 0

  const childWithTimes = (child) => ({
    ...child,
    _signedInAt: getAttRec(child.id)?.signed_in_at,
    _signedOutAt: getAttRec(child.id)?.signed_out_at,
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', borderRadius: 12, padding: '11px 20px', fontSize: 13, fontWeight: 700, zIndex: 900, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', animation: 'toastIn 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
          <span style={{ color: '#4ADE80' }}>✓</span> {toast}
        </div>
      )}
      <style>{`@keyframes toastIn { 0% { opacity: 0; transform: translate(-50%, -10px); } 100% { opacity: 1; transform: translate(-50%, 0); } }`}</style>

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── HERO CARD ── */}
          <div style={{ margin: isMobile ? 12 : '18px 20px 0', background: `linear-gradient(150deg, #0B1023 0%, #131B33 55%, #0F1729 100%)`, borderRadius: 24, padding: isMobile ? '20px 18px' : '26px 30px', position: 'relative', overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${primary}25, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -50, left: -30, width: 220, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${secondary}1a, transparent 70%)`, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {session ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#4ADE80', letterSpacing: 0.8 }}>
                      <span style={{ width: 5, height: 5, background: '#4ADE80', borderRadius: '50%', animation: 'pulseLive 1.5s infinite', boxShadow: '0 0 6px #4ADE80' }} />
                      LIVE SESSION
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, padding: '3px 10px' }}>NO ACTIVE SESSION</span>
                  )}
                </div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#fff', letterSpacing: -0.5, fontFamily: 'var(--font-display, sans-serif)' }}>{session?.title || 'Register'}</h1>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  <span>📅 {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  {session?.start_time && <span>🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</span>}
                  {session?.location && <span>📍 {session.location.split(',')[0]}</span>}
                </div>
              </div>
              <button onClick={() => setShowAdd(true)}
                style={{ padding: '12px 22px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 1px 0 rgba(255,255,255,0.25) inset, 0 10px 26px -8px ${primary}70`, flexShrink: 0, transition: 'transform 0.12s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                Open Full Register →
              </button>
            </div>

            {/* Circular progress rings */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: isMobile ? 8 : 40, marginBottom: 24, flexWrap: 'wrap' }}>
              <CircularProgress value={counts.expected} max={counts.total} color="#64748B" label="Expected" />
              <CircularProgress value={counts.signed_in} max={counts.total} color="#22C55E" label="Signed In" />
              <CircularProgress value={counts.signed_out} max={counts.total} color="#3B82F6" label="Signed Out" />
            </div>

            {/* Animated progress bar */}
            <div style={{ position: 'relative', marginBottom: counts.total > 0 ? 18 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                <span>{counts.signed_in} of {counts.total} checked in</span>
                <span style={{ color: '#4ADE80', fontWeight: 800 }}>{attendanceRate}%</span>
              </div>
              <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${attendanceRate}%`, background: `linear-gradient(90deg, ${primary}, #22C55E)`, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)', boxShadow: attendanceRate > 0 ? '0 0 12px rgba(34,197,94,0.6)' : 'none' }} />
              </div>
            </div>

            {/* Dot grid — one dot per child */}
            {counts.total > 0 && (
              <div style={{ position: 'relative' }}>
                <DotGrid children={children} getStatus={getStatus} />
              </div>
            )}

            <style>{`@keyframes pulseLive { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }`}</style>
          </div>

          {/* ── QUICK REGISTER SEARCH ── */}
          <div style={{ margin: isMobile ? '14px 12px 0' : '18px 20px 0' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: primary }}>🔍</span>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search child name... (Enter to sign in)"
                style={{ width: '100%', boxSizing: 'border-box', padding: '16px 18px 16px 48px', borderRadius: 16, border: `1.5px solid ${primary}25`, background: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit', fontWeight: 600, boxShadow: `0 1px 0 rgba(255,255,255,0.8) inset, 0 8px 24px -12px ${primary}35`, transition: 'all 0.2s' }}
                onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 4px ${primary}18, 0 8px 24px -10px ${primary}45` }}
                onBlur={e => { e.target.style.borderColor = primary + '25'; e.target.style.boxShadow = `0 1px 0 rgba(255,255,255,0.8) inset, 0 8px 24px -12px ${primary}35` }}
              />
            </div>
          </div>

          {/* ── GROUP CHIPS ── */}
          {availableGroups.length > 1 && (
            <div style={{ display: 'flex', gap: 7, padding: isMobile ? '14px 12px 0' : '16px 20px 0', overflowX: 'auto' }}>
              {['all', ...availableGroups].map(g => {
                const bubble = g === 'all' ? null : bubbles.find(b => b.label.toLowerCase() === g.toLowerCase())
                const isActive = activeGroup === g
                const gColor = bubble?.color || primary
                return (
                  <button key={g} onClick={() => setActiveGroup(g)} style={{
                    padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${isActive ? gColor : '#e5e7eb'}`,
                    background: isActive ? gColor : '#fff', color: isActive ? '#fff' : '#6B7280',
                    fontSize: 12.5, fontWeight: isActive ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 6, boxShadow: isActive ? `0 4px 14px ${gColor}45` : 'none', transition: 'all 0.15s'
                  }}>
                    {bubble && <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#fff' : bubble.color, display: 'inline-block' }} />}
                    {g === 'all' ? 'All Groups' : g}
                    <span style={{ fontSize: 10, opacity: 0.75 }}>
                      {g === 'all' ? children.length : children.filter(c => (c.group_name || '').toLowerCase() === g.toLowerCase()).length}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── STATUS CHIPS TABS ── */}
          <div style={{ display: 'flex', gap: 8, padding: isMobile ? '12px 12px 0' : '14px 20px 0', overflowX: 'auto' }}>
            {[
              { key: 'all', label: 'All', count: counts.total, color: '#374151' },
              { key: 'expected', label: 'Expected', count: counts.expected, color: '#64748B' },
              { key: 'signed_in', label: 'Signed In', count: counts.signed_in, color: '#16A34A' },
              { key: 'signed_out', label: 'Signed Out', count: counts.signed_out, color: '#2563EB' },
              { key: 'absent', label: 'Absent', count: counts.absent, color: '#DC2626' },
            ].map(t => {
              const isActive = activeTab === t.key
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${isActive ? t.color : '#e5e7eb'}`, background: isActive ? t.color + '14' : '#fff', color: isActive ? t.color : '#6B7280', fontSize: 12.5, fontWeight: isActive ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.label}
                  <span style={{ background: isActive ? t.color : '#F3F4F6', color: isActive ? '#fff' : '#9CA3AF', borderRadius: 99, padding: '1px 7px', fontSize: 10.5, fontWeight: 800 }}>{t.count}</span>
                </button>
              )
            })}
          </div>

          {/* ── CHILDREN LIST ── */}
          <div style={{ margin: isMobile ? '14px 12px' : '16px 20px', background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #F1F5F9', boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 10px 30px -18px rgba(15,23,42,0.25)' }}>
            {loading ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>Loading register...</div>
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
              filtered.map(child => (
                <ChildCard
                  key={child.id}
                  child={childWithTimes(child)}
                  status={getStatus(child.id)}
                  bubble={getBubble(child)}
                  primary={primary}
                  onClick={() => setSelectedChild({ child, status: getStatus(child.id), attRec: getAttRec(child.id) })}
                  onSignIn={(id) => handleUpdateStatus(id, 'signed_in')}
                  onSignOut={(id) => handleUpdateStatus(id, 'signed_out')}
                />
              ))
            )}
          </div>
        </div>

        {/* ── SESSION FOOTER ── */}
        <div style={{ background: '#fff', borderTop: '1px solid #F1F5F9', padding: isMobile ? '12px' : '14px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10, flexShrink: 0 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 14px', textAlign: isMobile ? 'left' : 'center' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Attendance</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: attendanceRate === 100 ? '#16A34A' : '#374151', marginTop: 2 }}>{attendanceRate}%</div>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 14px', textAlign: isMobile ? 'left' : 'center' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Missing</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: counts.expected > 0 ? '#D97706' : '#16A34A', marginTop: 2 }}>{counts.expected}</div>
          </div>
          <button onClick={() => setShowImport(v => !v)} style={{ background: primary + '0c', border: `1.5px solid ${primary}30`, borderRadius: 12, padding: '10px 14px', color: primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🖨 Print Register</button>
          <button style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: session ? `linear-gradient(135deg, ${primary}, #16A34A)` : '#F3F4F6', color: session ? '#fff' : '#9CA3AF', fontSize: 13, fontWeight: 800, cursor: session ? 'pointer' : 'default' }}>
            {session ? `✓ Complete Register` : 'No Active Session'}
          </button>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR — desktop only ── */}
      {!isMobile && (
        <div style={{ width: 260, background: '#fff', borderLeft: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>

          {/* Today's session */}
          <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 10 }}>📋 Today's Session</div>
            {session ? (
              <div style={{ background: primary + '0a', border: `1px solid ${primary}25`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{session.title}</div>
                {session.start_time && <div style={{ fontSize: 11, color: primary, fontWeight: 700, marginTop: 3 }}>{session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</div>}
                {session.location && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>📍 {session.location}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>No session scheduled today.</div>
            )}
          </div>

          {/* Medical alerts panel */}
          {medicalAlerts.length > 0 && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#DC2626', marginBottom: 10 }}>⚕️ Medical Alerts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {medicalAlerts.slice(0, 6).map(c => (
                  <button key={c.id} onClick={() => setSelectedChild({ child: c, status: getStatus(c.id), attRec: getAttRec(c.id) })}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <span style={{ fontSize: 13 }}>{c.allergies ? '🟠' : '🔴'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: 10, color: '#B91C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.allergies || c.medical_notes}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>⚡ Quick Actions</div>
            {[
              { icon: '🚶', label: 'Walk In', sub: 'Add & sign in now', action: () => setShowAdd(true) },
              { icon: '➕', label: 'Add Child', sub: 'Not on list', action: () => setShowAdd(true) },
              { icon: '📥', label: 'Import Children', sub: 'Bulk add from CSV', action: () => setShowImport(v => !v) },
              { icon: '🛡️', label: 'Log Concern', sub: 'Safeguarding', action: null },
            ].map(t => (
              <button key={t.label} onClick={t.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: t.action ? 'pointer' : 'default', textAlign: 'left', marginBottom: 2 }}
                onMouseEnter={e => { if (t.action) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{t.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Import panel */}
          {showImport && (
            <div style={{ padding: 14, borderBottom: '1px solid #F3F4F6' }}>
              <InlineChildImport org={org} onImported={newChildren => {
                setChildren(newChildren)
                setShowImport(false)
                showToast(`✅ Register updated — ${newChildren.length} children total`)
              }} />
            </div>
          )}

          {/* Live activity timeline */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 10 }}>📡 Live Activity</div>
            {activity.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>No activity yet this session.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activity.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', animation: 'toastIn 0.3s ease' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', minWidth: 34, marginTop: 1 }}>{a.time}</div>
                    <div style={{ fontSize: 11.5, color: '#374151', fontWeight: 600, lineHeight: 1.4 }}>
                      {a.type === 'signed_in' && <span style={{ color: '#16A34A' }}>●</span>}
                      {a.type === 'signed_out' && <span style={{ color: '#2563EB' }}>●</span>}
                      {a.type === 'absent' && <span style={{ color: '#DC2626' }}>●</span>}
                      {' '}{a.msg}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session notes */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>Session Notes</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add notes about this session..."
              style={{ width: '100%', height: 72, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#374151' }} />
          </div>

          {/* Safeguarding */}
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>🛡 Safeguarding</div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', marginBottom: 3 }}>
                {medicalAlerts.length} medical alert{medicalAlerts.length !== 1 ? 's' : ''} on register
              </div>
              <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.4, opacity: 0.8 }}>Log all concerns immediately.</div>
            </div>
          </div>
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
          hasSession={!!session}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
          onGroupChange={(childId, groupName) => {
            setChildren(prev => prev.map(ch => ch.id === childId ? { ...ch, group_name: groupName } : ch))
          }}
        />
      )}

      {/* ADD CHILD MODAL */}
      {showAdd && (
        <AddChildModal orgId={orgId} bubbles={bubbles} onClose={() => setShowAdd(false)}
          onAdded={child => { setChildren(prev => [...prev, child]); setShowAdd(false); showToast(`✓ ${child.first_name} added`) }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
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

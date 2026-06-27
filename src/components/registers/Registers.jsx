import React, { useState, useRef } from 'react'
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
function ChildDrawer({ child, status, attendanceRecord, bubble, onClose, onUpdateStatus, primary, hasSession }) {
  const [drawerTab, setDrawerTab] = useState(hasSession ? 'actions' : 'info')
  const [absenceReason, setAbsenceReason] = useState('')
  const name = `${child.first_name} ${child.last_name}`
  const age = child.date_of_birth ? new Date().getFullYear() - new Date(child.date_of_birth).getFullYear() : null
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const hasAlerts = child.allergies || child.medical_notes
  const bColor = bubble?.color || primary || '#1B9AAA'

  const handleAction = (newStatus) => {
    onUpdateStatus(child.id, newStatus, newStatus === 'absent' ? { absence_reason: absenceReason } : {})
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${bColor}, ${bubble?.dark || bColor})`, padding: '20px 18px 16px', borderRadius: '20px 20px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Child Profile</div>
            <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', border: '2.5px solid rgba(255,255,255,0.4)', overflow: 'hidden', flexShrink: 0 }}>
              {child.photo_url ? <img src={child.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.15 }}>{name}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                {bubble && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{bubble.label}</span>}
                {age && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Age {age}</span>}
                {signedInTime && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>In {signedInTime}</span>}
              </div>
            </div>
          </div>

          {/* Alerts strip */}
          {hasAlerts && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {child.allergies && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>🟠 {child.allergies}</span>}
              {child.medical_notes && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>🔴 {child.medical_notes}</span>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 0, padding: '8px 12px', gap: 6 }}>
          {[['actions','Sign In/Out'],['info','Info'],['edit','Edit']].filter(([key]) => key !== 'actions' || hasSession).map(([key, label]) => (
            <button key={key} onClick={() => setDrawerTab(key)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: drawerTab === key ? '#fff' : 'transparent', color: drawerTab === key ? '#111' : '#6B7280', fontWeight: drawerTab === key ? 700 : 500, fontSize: 12, cursor: 'pointer', boxShadow: drawerTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '14px 16px 20px' }}>
          {/* SIGN IN/OUT */}
          {drawerTab === 'actions' && (
            <div>
              {(signedInTime || signedOutTime) && (
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', background: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  {signedInTime && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5 }}>In</div><div style={{ fontSize: 24, fontWeight: 900, color: '#16A34A' }}>{signedInTime}</div></div>}
                  {signedOutTime && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, fontWeight: 800, color: '#1B9AAA', textTransform: 'uppercase', letterSpacing: 0.5 }}>Out</div><div style={{ fontSize: 24, fontWeight: 900, color: '#1B9AAA' }}>{signedOutTime}</div></div>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <button onClick={() => handleAction('signed_in')} disabled={status === 'signed_in'}
                  style={{ padding: '14px', borderRadius: 12, border: 'none', background: status === 'signed_in' ? '#DCFCE7' : '#16A34A', color: status === 'signed_in' ? '#16A34A' : '#fff', fontWeight: 800, fontSize: 15, cursor: status === 'signed_in' ? 'default' : 'pointer' }}>
                  {status === 'signed_in' ? '✓ Signed In' : 'Sign In'}
                </button>
                <button onClick={() => handleAction('signed_out')} disabled={!['signed_in'].includes(status)}
                  style={{ padding: '14px', borderRadius: 12, border: 'none', background: status === 'signed_out' ? '#DBEAFE' : '#1B9AAA', color: status === 'signed_out' ? '#1D4ED8' : '#fff', fontWeight: 800, fontSize: 15, cursor: status === 'signed_in' ? 'pointer' : 'default', opacity: status === 'signed_in' ? 1 : 0.4 }}>
                  {status === 'signed_out' ? '✓ Signed Out' : 'Sign Out'}
                </button>
              </div>
              <input placeholder="Absence reason (optional)" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
              <button onClick={() => handleAction('absent')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Mark Absent
              </button>
            </div>
          )}

          {/* NO SESSION BANNER */}
          {!hasSession && drawerTab === 'info' && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>No active session</div>
                <div style={{ fontSize: 11, color: '#B45309' }}>Sign in/out is only available during a live session.</div>
              </div>
            </div>
          )}

          {/* INFO */}
          {drawerTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Date of Birth</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{child.date_of_birth ? format(new Date(child.date_of_birth), 'd MMM yyyy') : '—'}</div>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Age</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{age ? `${age} yrs` : '—'}</div>
                </div>
              </div>
              <div style={{ background: child.emergency_contact_name ? '#EFF6FF' : '#F9FAFB', border: `1px solid ${child.emergency_contact_name ? '#BFDBFE' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1E40AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📞 Emergency Contact</div>
                {child.emergency_contact_name ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{child.emergency_contact_name}</div>
                    {child.emergency_contact_phone && <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>{child.emergency_contact_phone}</a>}
                  </>
                ) : <div style={{ fontSize: 13, color: '#9CA3AF' }}>Not set</div>}
              </div>
            </div>
          )}

          {/* EDIT */}
          {drawerTab === 'edit' && <EditChildForm child={child} onSaved={onClose} />}
        </div>
      </div>
    </div>
  )
}

// ─── CHILD CARD ───────────────────────────────────────────────
function ChildCard({ child, status, bubble, onClick, primary }) {
  const bColor = bubble?.color || '#e5e7eb'
  const hasAlerts = child.allergies || child.medical_notes
  const initials = `${child.first_name[0]}${child.last_name[0]}`

  const statusConfig = {
    signed_in:  { label: 'In',      bg: '#DCFCE7', color: '#15803D', dot: '#16A34A' },
    signed_out: { label: 'Out',     bg: '#DBEAFE', color: '#1D4ED8', dot: '#2563EB' },
    absent:     { label: 'Absent',  bg: '#FEE2E2', color: '#B91C1C', dot: '#DC2626' },
    expected:   { label: 'Expected', bg: '#FEF9C3', color: '#92400E', dot: '#F59E0B' },
    unmarked:   { label: '—',       bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
  }
  const sc = statusConfig[status] || statusConfig.unmarked

  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

      {/* Avatar with bubble colour */}
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: bColor + '22', border: `2.5px solid ${bColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: bColor, flexShrink: 0, overflow: 'hidden' }}>
        {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>

      {/* Name + group */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.first_name} {child.last_name}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {bubble && <span style={{ color: bColor, fontWeight: 700 }}>{bubble.label}</span>}
          {hasAlerts && <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚠ Alert</span>}
        </div>
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {hasAlerts && (
          <div style={{ display: 'flex', gap: 4 }}>
            {child.allergies && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', borderRadius: 99, padding: '2px 7px' }}>ALLERGY</span>}
            {child.medical_notes && <span style={{ fontSize: 10, fontWeight: 800, color: '#991B1B', background: '#FEE2E2', borderRadius: 99, padding: '2px 7px' }}>MEDICAL</span>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: sc.bg, borderRadius: 99, padding: '4px 10px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: sc.color }}>{sc.label}</span>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN REGISTER ────────────────────────────────────────────
export default function Registers({ org }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
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
    if (status === 'signed_in') showToast(`✓ ${name} signed in at ${t}`)
    else if (status === 'signed_out') showToast(`${name} signed out at ${t}`)
    else showToast(`${name} marked absent`)
  }

  const counts = {
    total:      children.length,
    signed_in:  children.filter(c => getStatus(c.id) === 'signed_in').length,
    absent:     children.filter(c => getStatus(c.id) === 'absent').length,
    expected:   children.filter(c => ['expected','unmarked'].includes(getStatus(c.id))).length,
    signed_out: children.filter(c => getStatus(c.id) === 'signed_out').length,
  }

  // Available groups from org settings + any from children
  const availableGroups = React.useMemo(() => {
    const fromBubbles = bubbles.map(b => b.label)
    const fromChildren = [...new Set(children.map(c => c.group_name).filter(Boolean))]
    const all = [...new Set([...fromBubbles, ...fromChildren])]
    return all
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

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
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
            <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              + Add Child
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Total', num: counts.total, color: '#374151', bg: '#F9FAFB' },
              { label: 'Signed In', num: counts.signed_in, color: '#15803D', bg: '#F0FDF4' },
              { label: 'Absent', num: counts.absent, color: '#B91C1C', bg: '#FEF2F2' },
              { label: 'Yet to Arrive', num: counts.expected, color: '#D97706', bg: '#FFFBEB' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center', border: `1px solid ${s.color}18` }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
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
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 36px', borderRadius: 10, border: `1.5px solid ${primary}25`, background: primary + '06', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
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

        {/* STATUS TABS */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '0 16px', flexShrink: 0, overflowX: 'auto' }}>
          {[
            { key: 'all', label: 'All', count: counts.total },
            { key: 'signed_in', label: 'In', count: counts.signed_in },
            { key: 'expected', label: 'Yet to Arrive', count: counts.expected },
            { key: 'absent', label: 'Absent', count: counts.absent },
            { key: 'signed_out', label: 'Out', count: counts.signed_out },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '10px 12px', border: 'none', borderBottom: `2.5px solid ${activeTab === t.key ? primary : 'transparent'}`, background: 'transparent', color: activeTab === t.key ? primary : '#6B7280', fontSize: 13, fontWeight: activeTab === t.key ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              <span style={{ background: activeTab === t.key ? primary + '18' : '#F3F4F6', color: activeTab === t.key ? primary : '#9CA3AF', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* CHILDREN LIST */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
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
            filtered.map(child => (
              <ChildCard
                key={child.id}
                child={child}
                status={getStatus(child.id)}
                bubble={getBubble(child)}
                primary={primary}
                onClick={() => setSelectedChild({ child, status: getStatus(child.id), attRec: getAttRec(child.id) })}
              />
            ))
          )}
        </div>

        {/* FOOTER */}
        <div style={{ background: '#fff', borderTop: '1px solid #F3F4F6', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${primary}30`, background: primary + '08', color: primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add Walk-in</button>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{filtered.length} of {children.length} shown</div>
          <button style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: session ? `linear-gradient(135deg, ${primary}, #16A34A)` : '#F3F4F6', color: session ? '#fff' : '#9CA3AF', fontSize: 13, fontWeight: 800, cursor: session ? 'pointer' : 'default' }}>
            {session ? `✓ Complete Register · ${counts.signed_in} in` : 'No Active Session'}
          </button>
        </div>
      </div>

      {/* SIDEBAR TOOLS — desktop only */}
      {!isMobile && (
        <div style={{ width: 220, background: '#fff', borderLeft: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 10 }}>Register Tools</div>
            {[
              { icon: '➕', label: 'Add Child', sub: 'Not on list', action: () => setShowAdd(true) },
              { icon: '📥', label: 'Import Children', sub: 'Bulk add from CSV', action: () => setShowImport(v => !v) },
              { icon: '🖨', label: 'Print Register', sub: 'Print attendance sheet', action: null },
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
        </div>
      )}

      {/* CHILD DRAWER */}
      {selectedChild && (
        <ChildDrawer
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          primary={primary}
          hasSession={!!session}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
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

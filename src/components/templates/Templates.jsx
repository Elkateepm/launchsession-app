import DOMPurify from 'dompurify'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TYPES = [
  { key: 'session_plan', label: 'Session Plans',      icon: '📋', color: '#3B82F6', desc: 'Pre-built agendas and activity plans' },
  { key: 'email',        label: 'Email Templates',    icon: '✉️',  color: '#8B5CF6', desc: 'Comms for parents, staff and volunteers' },
  { key: 'register',     label: 'Register Templates', icon: '📝', color: '#10B981', desc: 'Pre-configured attendance sheets' },
  { key: 'onboarding',   label: 'Onboarding',         icon: '🚀', color: '#F97316', desc: 'Org setup blueprints and welcome flows' },
  { key: 'import',       label: 'Data Import',        icon: '📥', color: '#1B9AAA', desc: 'Import young people, sessions and more' },
]

const lbl = { display: 'block', fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

function RichEditor({ value, onChange, placeholder, readOnly }) {
  const ref = useRef(null)
  const isFirst = useRef(true)
  useEffect(() => {
    if (ref.current && isFirst.current) {
      ref.current.innerHTML = value || ''
      isFirst.current = false
    }
  }, [value])
  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val)
    ref.current && onChange && onChange(ref.current.innerHTML)
  }
  const tb = (cmd, label, val = null) => (
    <button key={cmd+label} onMouseDown={e => { e.preventDefault(); exec(cmd, val) }}
      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
    >{label}</button>
  )
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {tb('bold','B')} {tb('italic','I')} {tb('underline','U')} {tb('insertUnorderedList','• List')} {tb('insertOrderedList','1. List')} {tb('formatBlock','H2','h2')} {tb('formatBlock','H3','h3')} {tb('formatBlock','P','p')} {tb('removeFormat','Clear')}
        </div>
      )}
      <div ref={ref} contentEditable={!readOnly} suppressContentEditableWarning
        onInput={() => !readOnly && ref.current && onChange && onChange(ref.current.innerHTML)}
        data-placeholder={placeholder || 'Start writing...'}
        style={{ minHeight: readOnly ? 120 : 200, padding: '14px 16px', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, outline: 'none' }}
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:var(--text3);pointer-events:none}[contenteditable] h2{font-size:1.2em;font-weight:800;margin:10px 0 5px}[contenteditable] h3{font-size:1.05em;font-weight:700;margin:8px 0 4px}[contenteditable] ul,[contenteditable] ol{padding-left:20px;margin:4px 0}[contenteditable] li{margin:2px 0}[contenteditable] p{margin:3px 0}`}</style>
    </div>
  )
}

function ViewModal({ template, onClose, onUse, onEdit, isOwn, using }) {
  const typeMeta = TYPES.find(t => t.key === template.type) || TYPES[0]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px,94vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>{typeMeta.icon}</span>
              {template.is_global && !isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '3px 8px', borderRadius: 999 }}>GLOBAL TEMPLATE</span>}
              {isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#86EFAC', background: 'rgba(34,197,94,0.12)', padding: '3px 8px', borderRadius: 999 }}>YOUR TEMPLATE</span>}
              {template.category && <span style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', background: 'rgba(124,58,237,0.12)', padding: '3px 8px', borderRadius: 999 }}>{template.category}</span>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{template.title}</div>
            {template.description && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{template.description}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16, flexShrink: 0, marginLeft: 12 }}>x</button>
        </div>
        {template.type === 'email' && template.content?.subject && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Subject Line</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{template.content.subject}</div>
          </div>
        )}
        {template.content?.body && (
          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>Content</div>
            <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.content.body || '') }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          {isOwn ? (
            <button onClick={onEdit} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Edit This Template</button>
          ) : (
            <button onClick={onUse} disabled={using} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: using ? 'rgba(34,197,94,0.4)' : 'linear-gradient(90deg,#16A34A,#059669)', color: '#fff', fontWeight: 900, cursor: using ? 'not-allowed' : 'pointer' }}>{using ? 'Saving...' : '+ Use This Template'}</button>
          )}
        </div>
      </div>
    </>
  )
}

function EditModal({ template, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: template?.title || '',
    description: template?.description || '',
    category: template?.category || '',
    content: template?.content || { body: '' },
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setContent = (k, v) => setForm(f => ({ ...f, content: { ...f.content, [k]: v } }))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px,94vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: '#38BDF8', fontWeight: 950 }}>EDIT TEMPLATE</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{template.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Description</label><input value={form.description} onChange={e => set('description', e.target.value)} style={inp} /></div>
        {template.type === 'email' && (
          <div style={{ marginBottom: 14 }}><label style={lbl}>Email Subject</label><input value={form.content.subject || ''} onChange={e => setContent('subject', e.target.value)} style={inp} /></div>
        )}
        <div style={{ marginBottom: 22 }}>
          <label style={lbl}>Content</label>
          <RichEditor value={form.content.body || ''} onChange={v => setContent('body', v)} placeholder="Edit your template content..." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.title.trim()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? 'rgba(37,99,235,0.4)' : 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </>
  )
}

// ─── FILE DROP ZONE ───────────────────────────────────────────
function FileDropZone({ primary, onLoad, showToast }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = React.useRef(null)

  const readFile = (file) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      showToast('Please upload a .csv file', '#EF4444')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      onLoad(e.target.result)
      showToast(`✓ ${file.name} loaded — preview below`)
    }
    reader.readAsText(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${dragging ? primary : 'var(--border)'}`, borderRadius: 16, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? primary + '08' : 'var(--surface)', transition: 'all 0.2s' }}
    >
      <input ref={inputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => readFile(e.target.files[0])} />
      <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        {dragging ? 'Drop it!' : 'Drop your CSV file here'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        or click to browse — accepts .csv files
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${primary}`, background: primary + '10', color: primary, fontSize: 13, fontWeight: 700 }}>
        📁 Choose File
      </div>
    </div>
  )
}

// ─── CHILD IMPORT TOOL ────────────────────────────────────────
const CHILD_COLUMNS = [
  { key: 'first_name',              label: 'First Name',              required: true,  example: 'Sarah',        note: 'Required' },
  { key: 'last_name',               label: 'Last Name',               required: true,  example: 'Jones',        note: 'Required' },
  { key: 'date_of_birth',           label: 'Date of Birth',           required: false, example: '2015-06-14',   note: 'YYYY-MM-DD format' },
  { key: 'group_name',              label: 'Group / Bubble',          required: false, example: 'Red',          note: 'Must match your group names' },
  { key: 'allergies',               label: 'Allergies / Dietary',     required: false, example: 'Nut allergy',  note: '' },
  { key: 'medical_notes',           label: 'Medical Notes',           required: false, example: 'Asthma',       note: '' },
  { key: 'emergency_contact_name',  label: 'Emergency Contact Name',  required: false, example: 'Jane Jones',   note: '' },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', required: false, example: '07700900000',  note: '' },
]

const CSV_HEADER = CHILD_COLUMNS.map(c => c.key).join(',')
const CSV_EXAMPLE = CHILD_COLUMNS.map(c => c.example).join(',')
const CSV_TEMPLATE = `${CSV_HEADER}\n${CSV_EXAMPLE}\n`

function ChildImportTool({ org, showToast, onNavigate }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [tab, setTab] = useState('template') // 'template' | 'import' | 'history'
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [history, setHistory] = useState([])

  // Load recent imports
  useEffect(() => {
    if (tab !== 'history') return
    supabase.from('children').select('id,first_name,last_name,created_at').eq('org_id', org.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistory(data || []))
  }, [tab, org.id])

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'launchsession-children-import.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Template downloaded!')
  }

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return { rows: [], errs: ['File must have a header row and at least one data row.'] }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const errs = []
    const rows = []
    lines.slice(1).forEach((line, i) => {
      // Handle quoted CSV fields
      const vals = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
        else cur += ch
      }
      vals.push(cur.trim())

      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })
      if (!row.first_name) errs.push(`Row ${i + 2}: missing first_name`)
      if (!row.last_name) errs.push(`Row ${i + 2}: missing last_name`)
      if (row.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth)) {
        errs.push(`Row ${i + 2}: date_of_birth must be YYYY-MM-DD (got "${row.date_of_birth}")`)
      }
      rows.push(row)
    })
    return { rows, errs }
  }

  const handlePreview = () => {
    if (!csvText.trim()) { setErrors(['Paste your CSV data first.']); return }
    const { rows, errs } = parseCSV(csvText)
    setErrors(errs)
    setPreview(rows)
    setImportResult(null)
  }

  const handleImport = async () => {
    if (!preview?.length) return
    setImporting(true)

    // Verify we have an authenticated session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      showToast('Session expired — please sign in again', '#EF4444')
      setImporting(false)
      return
    }

    // Explicitly set the session so the client sends the JWT
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    const records = preview.map(r => ({
      org_id: org.id,
      first_name: r.first_name?.trim() || '',
      last_name: r.last_name?.trim() || '',
      date_of_birth: r.date_of_birth || null,
      group_name: r.group_name || null,
      allergies: r.allergies || null,
      medical_notes: r.medical_notes || null,
      emergency_contact_name: r.emergency_contact_name || null,
      emergency_contact_phone: r.emergency_contact_phone || null,
      active: true,
    })).filter(r => r.first_name && r.last_name)

    const { data, error } = await supabase.from('children').insert(records).select('id')
    setImporting(false)
    if (error) {
      showToast('Import failed: ' + error.message, '#EF4444')
      setImportResult({ success: 0, failed: records.length, error: error.message })
    } else {
      showToast(`✅ ${data.length} young people imported!`)
      setImportResult({ success: data.length, failed: records.length - data.length })
      setCsvText('')
      setPreview(null)
    }
  }

  const TABS = [
    { key: 'template', label: '📄 Template', desc: 'Download the CSV template' },
    { key: 'import',   label: '📥 Import',   desc: 'Paste and import your data' },
    { key: 'history',  label: '📋 History',  desc: 'Recently imported records' },
  ]

  const fi = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${tab === t.key ? primary : 'var(--border)'}`, background: tab === t.key ? primary + '12' : 'var(--surface)', color: tab === t.key ? primary : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TEMPLATE TAB */}
      {tab === 'template' && (
        <div>
          {/* Hero */}
          <div style={{ background: `linear-gradient(135deg, ${primary}18, ${primary}08)`, border: `1.5px solid ${primary}30`, borderRadius: 18, padding: '22px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Children Import Template</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
                  Download the CSV template, fill it in with your young people's details in Excel, Numbers or Google Sheets, then upload or paste it on the Import tab.
                </div>
                <button onClick={downloadTemplate} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  ⬇️ Download Template CSV
                </button>
              </div>
            </div>
          </div>

          {/* Column guide */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Column Reference</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Exactly these column names must appear in your CSV header row</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Column Name', 'Label', 'Required', 'Example', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CHILD_COLUMNS.map((col, i) => (
                    <tr key={col.key} style={{ borderBottom: i < CHILD_COLUMNS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: primary, fontWeight: 700 }}>{col.key}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>{col.label}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {col.required
                          ? <span style={{ background: '#FEE2E2', color: '#C00', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>Required</span>
                          : <span style={{ background: '#F3F4F6', color: 'var(--text3)', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>Optional</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text3)' }}>{col.example}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)' }}>{col.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            {[
              { icon: '📊', title: 'Works with Excel', desc: 'Fill in Excel / Google Sheets, then export as CSV.' },
              { icon: '🔤', title: 'Keep the header', desc: 'Don\'t delete or rename the first row — it maps columns.' },
              { icon: '📅', title: 'Date format', desc: 'Use YYYY-MM-DD (e.g. 2015-06-14) for dates of birth.' },
              { icon: '👥', title: 'Group names', desc: 'Must exactly match your group names in Settings.' },
            ].map(t => (
              <div key={t.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === 'import' && (
        <div>
          {importResult ? (
            <div style={{ background: importResult.failed === 0 ? '#F0FDF4' : '#FFFBEB', border: `1.5px solid ${importResult.failed === 0 ? '#86EFAC' : '#FDE68A'}`, borderRadius: 16, padding: '24px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{importResult.failed === 0 ? '🎉' : '⚠️'}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
                {importResult.success} young {importResult.success === 1 ? 'person' : 'people'} imported!
              </div>
              {importResult.failed > 0 && <div style={{ fontSize: 13, color: '#92400E', marginBottom: 8 }}>{importResult.failed} rows skipped — check for missing names.</div>}
              {importResult.error && <div style={{ fontSize: 12, color: '#C00', marginBottom: 12 }}>{importResult.error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setImportResult(null)} style={{ padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${primary}`, background: 'transparent', color: primary, fontWeight: 700, cursor: 'pointer' }}>Import more</button>
                {onNavigate && <button onClick={() => onNavigate('registers')} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>View in Registers →</button>}
                <button onClick={() => setTab('history')} style={{ padding: '10px 20px', borderRadius: 10, border: `1.5px solid var(--border)`, background: 'var(--surface)', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>View history</button>
              </div>
            </div>
          ) : (
            <>
              {/* File upload drop zone */}
              <FileDropZone primary={primary} onLoad={text => { setCsvText(text); setPreview(null); setErrors([]) }} showToast={showToast} />

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>or paste CSV text</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <textarea
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); setPreview(null); setErrors([]) }}
                  placeholder={`first_name,last_name,date_of_birth,group_name,...\nSarah,Jones,2015-06-14,Red,...`}
                  rows={6}
                  style={{ ...fi, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                />
                {errors.length > 0 && (
                  <div style={{ background: '#FFF0F0', border: '1px solid #FFB3B3', borderRadius: 10, padding: '10px 14px', marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#C00', marginBottom: 4 }}>⚠️ {errors.length} issue{errors.length > 1 ? 's' : ''} found:</div>
                    {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#C00' }}>• {e}</div>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={handlePreview} style={{ padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${primary}`, background: primary + '12', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Preview →
                  </button>
                  {csvText && <button onClick={() => { setCsvText(''); setPreview(null); setErrors([]) }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                </div>
              </div>

              {preview && preview.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Preview — {preview.length} record{preview.length !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Showing first 5 rows · {errors.length > 0 ? `${errors.length} error${errors.length > 1 ? 's' : ''} found` : '✓ All clear'}</div>
                    </div>
                    <button onClick={handleImport} disabled={importing || errors.length > 0} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: errors.length > 0 ? '#9ca3af' : `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', fontWeight: 800, fontSize: 13, cursor: errors.length > 0 ? 'default' : 'pointer' }}>
                      {importing ? 'Importing...' : `✓ Import ${preview.length} records`}
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)' }}>
                          {['#', 'First Name', 'Last Name', 'DOB', 'Group', 'Allergies', 'Emergency Contact'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 5).map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '9px 12px', color: 'var(--text3)', fontWeight: 600 }}>{i + 1}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: row.first_name ? 'var(--text)' : '#C00' }}>{row.first_name || '⚠ Missing'}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: row.last_name ? 'var(--text)' : '#C00' }}>{row.last_name || '⚠ Missing'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{row.date_of_birth || '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{row.group_name || '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.allergies || '—'}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{row.emergency_contact_name || '—'}</td>
                          </tr>
                        ))}
                        {preview.length > 5 && (
                          <tr><td colSpan={7} style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11, fontStyle: 'italic' }}>...and {preview.length - 5} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Recently added young people (last 20)</div>
          {history.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>No records yet</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Import some young people to see them here.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              {history.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: primary, flexShrink: 0 }}>{c.first_name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Added {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Templates({ org, onNavigate }) {
  const [activeType, setActiveType] = useState('session_plan')
  const [globalTemplates, setGlobalTemplates] = useState([])
  const [ownTemplates, setOwnTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [using, setUsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, color = '#22C55E') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [globalRes, ownRes] = await Promise.all([
      supabase.from('templates').select('*').eq('type', activeType).eq('is_global', true).eq('is_active', true).order('title'),
      supabase.from('templates').select('*').eq('type', activeType).eq('org_id', org.id).eq('is_active', true).order('created_at', { ascending: false }),
    ])
    setGlobalTemplates(globalRes.data || [])
    setOwnTemplates(ownRes.data || [])
    setLoading(false)
  }, [activeType, org.id])

  useEffect(() => { load() }, [load])

  const handleUse = async (template) => {
    setUsing(true)
    const { error } = await supabase.from('templates').insert({
      title: template.title + ' (copy)',
      description: template.description,
      type: template.type,
      category: template.category,
      content: template.content,
      is_global: false,
      org_id: org.id,
      is_active: true,
    })
    setUsing(false)
    if (error) { showToast('Failed to save: ' + error.message, '#EF4444'); return }
    showToast('Template saved to your library!')
    setViewModal(null)
    load()
  }

  const handleSaveEdit = async (form) => {
    setSaving(true)
    const { error } = await supabase.from('templates').update({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      content: form.content,
      updated_at: new Date().toISOString(),
    }).eq('id', editModal.id)
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, '#EF4444'); return }
    showToast('Template updated!')
    setEditModal(null)
    load()
  }

  const handleDelete = async (t) => {
    if (!window.confirm('Delete "' + t.title + '"?')) return
    await supabase.from('templates').update({ is_active: false }).eq('id', t.id)
    showToast('Template deleted')
    load()
  }

  const typeMeta = TYPES.find(t => t.key === activeType)
  const filteredGlobal = globalTemplates.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category||'').toLowerCase().includes(search.toLowerCase()))
  const filteredOwn = ownTemplates.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category||'').toLowerCase().includes(search.toLowerCase()))

  const TemplateCard = ({ t, isOwn }) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#86EFAC', background: 'rgba(34,197,94,0.1)', padding: '2px 7px', borderRadius: 999 }}>YOURS</span>}
            {!isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 999 }}>GLOBAL</span>}
            {t.category && <span style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', background: 'rgba(124,58,237,0.1)', padding: '2px 7px', borderRadius: 999 }}>{t.category}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{t.title}</div>
          {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{t.description}</div>}
        </div>
        <div style={{ fontSize: 24, marginLeft: 10, flexShrink: 0 }}>{typeMeta.icon}</div>
      </div>
      {t.content?.body && (
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, maxHeight: 52, overflow: 'hidden', maskImage: 'linear-gradient(to bottom,black 50%,transparent 100%)' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t.content.body || '') }} />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => setViewModal({ ...t, isOwn })} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View</button>
        {isOwn ? (
          <>
            <button onClick={() => setEditModal(t)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(37,99,235,0.08)', color: '#93C5FD', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Edit</button>
            <button onClick={() => handleDelete(t)} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#F87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Del</button>
          </>
        ) : (
          <button onClick={() => handleUse(t)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#16A34A,#059669)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>+ Use</button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#fff', padding: '10px 22px', borderRadius: 12, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
      )}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Template Library</div>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>Browse global templates or manage your own custom versions.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 22 }}>
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)} style={{ padding: '14px 12px', borderRadius: 14, border: activeType === t.key ? '1px solid ' + t.color + '55' : '1px solid var(--border)', background: activeType === t.key ? t.color + '14' : 'var(--surface)', color: activeType === t.key ? 'var(--text)' : 'var(--text3)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 18, marginBottom: 5 }}>{t.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{t.label}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>
      {activeType !== 'import' && (
        <div style={{ marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'Search ' + typeMeta.label.toLowerCase() + '...'} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      )}
      {activeType === 'import' ? (
        <ChildImportTool org={org} showToast={showToast} onNavigate={onNavigate} />
      ) : loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading templates...</div>
      ) : (
        <>
          {filteredOwn.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#22C55E', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Your Templates ({filteredOwn.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {filteredOwn.map(t => <TemplateCard key={t.id} t={t} isOwn={true} />)}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#38BDF8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Global Library ({filteredGlobal.length})</div>
            {filteredGlobal.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{typeMeta.icon}</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No {typeMeta.label} yet</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Your platform admin is adding templates soon.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {filteredGlobal.map(t => <TemplateCard key={t.id} t={t} isOwn={false} />)}
              </div>
            )}
          </div>
        </>
      )}
      {viewModal && <ViewModal template={viewModal} isOwn={viewModal.isOwn} onClose={() => setViewModal(null)} onUse={() => handleUse(viewModal)} onEdit={() => { setViewModal(null); setEditModal(viewModal) }} using={using} />}
      {editModal && <EditModal template={editModal} onClose={() => setEditModal(null)} onSave={handleSaveEdit} saving={saving} />}
    </div>
  )
}

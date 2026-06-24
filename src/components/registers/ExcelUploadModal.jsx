import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

const TEMPLATE_DATA = [
  { first_name: 'Jane', last_name: 'Smith', date_of_birth: '2012-05-14', group_name: 'Blue', allergies: 'Nut allergy', medical_notes: '', emergency_contact_name: 'Sarah Smith', emergency_contact_phone: '07700900123' },
  { first_name: 'Marcus', last_name: 'Jones', date_of_birth: '2013-09-22', group_name: 'Red', allergies: '', medical_notes: 'Asthma - inhaler with staff', emergency_contact_name: 'David Jones', emergency_contact_phone: '07700900456' },
]

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_DATA)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Children')
  XLSX.writeFile(wb, 'launchsession-children-template.xlsx')
}

export default function ExcelUploadModal({ orgId, bubbles, onClose, onImported }) {
  const [rows, setRows] = useState(null)
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (data.length === 0) { setErrors(['The file appears to be empty.']); return }
        const normalised = data.map(row => {
          const out = {}
          Object.entries(row).forEach(([k, v]) => {
            const key = k.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            out[key] = typeof v === 'string' ? v.trim() : v
          })
          return out
        })
        const errs = []
        normalised.forEach((row, i) => {
          if (!row.first_name) errs.push('Row ' + (i + 2) + ': Missing first_name')
          if (!row.last_name) errs.push('Row ' + (i + 2) + ': Missing last_name')
        })
        if (errs.length > 0) { setErrors(errs); setRows(null); return }
        setErrors([])
        setRows(normalised)
      } catch (err) {
        setErrors(['Could not read the file. Please use .xlsx or .csv format.'])
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (!rows || rows.length === 0) return
    setImporting(true)
    const toInsert = rows.map(row => ({
      org_id: orgId,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      date_of_birth: row.date_of_birth
        ? (typeof row.date_of_birth === 'object' ? row.date_of_birth.toISOString().split('T')[0] : String(row.date_of_birth).slice(0, 10))
        : null,
      group_name: row.group_name || (bubbles[0]?.label || ''),
      allergies: row.allergies || null,
      medical_notes: row.medical_notes || null,
      emergency_contact_name: row.emergency_contact_name || null,
      emergency_contact_phone: String(row.emergency_contact_phone || '').replace(/[^0-9+\s]/g, '') || null,
      active: true,
    }))
    const { data, error } = await supabase.from('children').insert(toInsert).select()
    setImporting(false)
    if (error) { setErrors(['Import failed: ' + error.message]); return }
    setImportCount(data?.length || toInsert.length)
    setDone(true)
    if (onImported) onImported(data || [])
  }

  if (done) return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 440, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Import Complete</div>
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>{importCount} children added to your register successfully.</div>
        <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Import from Excel / CSV</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Bulk add children to your register</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <div style={{ background: 'rgba(27,154,170,0.06)', border: '1px solid rgba(27,154,170,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1B9AAA', marginBottom: 6 }}>Step 1: Download the template</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Required columns: first_name, last_name. Optional: date_of_birth, group_name, allergies, medical_notes, emergency_contact_name, emergency_contact_phone.</div>
            <button onClick={downloadTemplate} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(27,154,170,0.3)', background: '#fff', color: '#1B9AAA', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Download Template</button>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Step 2: Upload your file</div>
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#1B9AAA'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Click to choose a file</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Supports .xlsx, .xls, and .csv files</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
            </div>
          </div>

          {errors.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#DC2626', marginBottom: 6 }}>Please fix these issues:</div>
              {errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 12, color: '#B91C1C', marginBottom: 2 }}>- {e}</div>)}
              {errors.length > 5 && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>...and {errors.length - 5} more</div>}
            </div>
          )}

          {rows && rows.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
                Step 3: Review and import
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#1B9AAA' }}>{rows.length} children found</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Name','DOB','Group','Allergies','Emergency Contact'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)' }}>{row.first_name} {row.last_name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{row.date_of_birth ? String(row.date_of_birth).slice(0,10) : '-'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{row.group_name || '-'}</td>
                        <td style={{ padding: '8px 12px', color: row.allergies ? '#C2410C' : 'var(--text3)' }}>{row.allergies || 'None'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{row.emergency_contact_name || '-'}</td>
                      </tr>
                    ))}
                    {rows.length > 50 && <tr><td colSpan={5} style={{ padding: '8px 12px', color: 'var(--text3)', fontStyle: 'italic' }}>...and {rows.length - 50} more</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'transparent', color: 'var(--text3)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleImport} disabled={!rows || rows.length === 0 || importing}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: !rows || importing ? 'rgba(27,154,170,0.4)' : '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 800, cursor: !rows || importing ? 'not-allowed' : 'pointer' }}>
              {importing ? 'Importing...' : rows ? 'Import ' + rows.length + ' Children' : 'Select a file first'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

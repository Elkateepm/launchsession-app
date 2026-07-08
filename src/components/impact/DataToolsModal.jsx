import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { OUTCOME_AREAS, areaByKey, scoreColor } from './impact_shared'

// ---------------------------------------------------------------------------
// Export — download all outcome data as an .xlsx workbook
// ---------------------------------------------------------------------------
function exportData(org, children, scores, goals) {
  const childById = Object.fromEntries(children.map(c => [c.id, c]))

  const scoresSheet = scores.map(s => {
    const c = childById[s.child_id]
    return {
      'First Name': c?.first_name || '', 'Last Name': c?.last_name || '',
      'Area': areaByKey(s.area).label, 'Score': s.score, 'Notes': s.notes || '',
      'Recorded At': format(new Date(s.recorded_at), 'yyyy-MM-dd HH:mm'),
    }
  })

  const goalsSheet = goals.map(g => {
    const c = childById[g.child_id]
    return {
      'First Name': c?.first_name || '', 'Last Name': c?.last_name || '',
      'Goal': g.title, 'Area': g.area ? areaByKey(g.area).label : '', 'Status': g.status,
      'Progress %': g.progress_pct, 'Target Date': g.target_date || '',
    }
  })

  const summarySheet = children.map(c => {
    const cs = scores.filter(s => s.child_id === c.id)
    const avg = cs.length ? (cs.reduce((s, x) => s + x.score, 0) / cs.length).toFixed(1) : ''
    return {
      'First Name': c.first_name, 'Last Name': c.last_name, 'School': c.school || '',
      'Programme': c.group_name || '', 'Readings': cs.length, 'Average Score': avg,
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), 'Young People')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scoresSheet), 'Outcome Scores')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsSheet), 'Goals')
  XLSX.writeFile(wb, `${org.name || 'Impact'}-outcomes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

// ---------------------------------------------------------------------------
// Import — bulk-add outcome scores from an .xlsx / .csv file
// ---------------------------------------------------------------------------
function ImportPane({ org, children, primary, onClose, onImported }) {
  const [rows, setRows] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const areaKeys = OUTCOME_AREAS.map(a => a.key)
  const areaLabels = Object.fromEntries(OUTCOME_AREAS.map(a => [a.label.toLowerCase(), a.key]))

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      setRows(json)
    }
    reader.readAsBinaryString(file)
  }

  const doImport = async () => {
    if (!rows?.length) return
    setImporting(true)
    let inserted = 0, skipped = 0
    const toInsert = []
    for (const row of rows) {
      const first = (row['First Name'] || row['first_name'] || '').toString().trim().toLowerCase()
      const last = (row['Last Name'] || row['last_name'] || '').toString().trim().toLowerCase()
      const child = children.find(c => c.first_name?.toLowerCase() === first && c.last_name?.toLowerCase() === last)
      const rawArea = (row['Area'] || row['area'] || '').toString().trim().toLowerCase()
      const areaKey = areaKeys.includes(rawArea) ? rawArea : areaLabels[rawArea]
      const score = Number(row['Score'] || row['score'])
      if (!child || !areaKey || !score || score < 1 || score > 10) { skipped++; continue }
      toInsert.push({ org_id: org.id, child_id: child.id, area: areaKey, score, notes: row['Notes'] || row['notes'] || null })
    }
    if (toInsert.length) {
      const { error } = await supabase.from('outcome_scores').insert(toInsert)
      if (!error) inserted = toInsert.length
    }
    setImporting(false)
    setResult({ inserted, skipped })
    if (inserted) onImported()
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
        Upload an .xlsx or .csv file with columns: <strong>First Name, Last Name, Area, Score, Notes</strong> (Notes optional). Rows are matched to young people by name.
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={inp} />
      {rows && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#374151' }}>
          Found <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''} in the file.
        </div>
      )}
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: result.inserted ? '#F0FDF4' : '#FEF2F2', fontSize: 12.5, color: result.inserted ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
          ✅ Imported {result.inserted} outcome{result.inserted !== 1 ? 's' : ''}{result.skipped ? ` · Skipped ${result.skipped} unmatched row${result.skipped !== 1 ? 's' : ''}` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button disabled={!rows?.length || importing} onClick={doImport} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13, opacity: rows?.length ? 1 : 0.5 }}>
          {importing ? 'Importing...' : 'Import Rows'}
        </button>
        <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Close</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report — printable funding/trustee-ready summary
// ---------------------------------------------------------------------------
function ReportPane({ org, children, scores }) {
  const trackedCount = [...new Set(scores.map(s => s.child_id))].length
  const avgOverall = scores.length ? (scores.reduce((s, x) => s + x.score, 0) / scores.length).toFixed(1) : '—'

  return (
    <div>
      <div id="impact-report-printable" style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{org.name || 'Organisation'} — Impact Report</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>Generated {format(new Date(), 'd MMMM yyyy')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[{ l: 'Young People', v: children.length }, { l: 'Being Tracked', v: trackedCount }, { l: 'Average Score', v: `${avgOverall}/10` }].map(s => (
            <div key={s.l} style={{ border: '1px solid #F3F4F6', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Average score by area</div>
        {OUTCOME_AREAS.map(area => {
          const areaScores = scores.filter(s => s.area === area.key)
          const avg = areaScores.length ? (areaScores.reduce((s, x) => s + x.score, 0) / areaScores.length) : null
          return (
            <div key={area.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid #F9FAFB' }}>
              <span>{area.icon} {area.label}</span>
              <span style={{ fontWeight: 800, color: avg ? scoreColor(avg) : '#9CA3AF' }}>{avg ? `${avg.toFixed(1)}/10` : 'No data'}</span>
            </div>
          )
        })}
      </div>
      <button onClick={() => window.print()} style={{ marginTop: 16, padding: '9px 20px', borderRadius: 10, border: 'none', background: org.primary_color || '#1B9AAA', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
        🖨️ Print / Save as PDF
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main modal wrapper
// ---------------------------------------------------------------------------
export default function DataToolsModal({ mode, org, children, scores, goals, onClose, onImported }) {
  const primary = org?.primary_color || '#1B9AAA'
  const TITLES = { export: '⬇️ Export Data', import: '⬆️ Import Assessments', report: '📄 Generate Report' }

  useEffect(() => {
    if (mode === 'export') exportData(org, children, scores, goals)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 22, width: 480, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>{TITLES[mode]}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {mode === 'export' && (
          <div style={{ fontSize: 13, color: '#6B7280' }}>Your download has started — an .xlsx workbook with Young People, Outcome Scores and Goals sheets.</div>
        )}
        {mode === 'import' && <ImportPane org={org} children={children} primary={primary} onClose={onClose} onImported={onImported} />}
        {mode === 'report' && <ReportPane org={org} children={children} scores={scores} />}
      </motion.div>
    </div>
  )
}

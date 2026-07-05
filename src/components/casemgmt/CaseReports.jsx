import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { btnGhost, btnPrimary } from '../volunteers/vh_shared'
import { EVENT_META, STATUS_LABELS } from './cm_shared'

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportCasesToCSV(cases) {
  const headers = ['Case ID', 'Child', 'Category', 'Status', 'Risk Level', 'Assigned To', 'Created', 'Next Review']
  const rows = cases.map(c => [
    c.id.slice(0, 8).toUpperCase(), c.child_name, c.category || c.case_type || '', STATUS_LABELS[c.status] || c.status,
    c.risk_level || c.priority || '', c.assigned_to || '', new Date(c.created_at).toLocaleDateString('en-GB'), c.next_review_date || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob(csv, `cases-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
}

export default function CaseReportModal({ cas, org, staff = [], onClose }) {
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: n }, { data: e }, { data: t }] = await Promise.all([
        supabase.from('case_notes').select('*').eq('case_id', cas.id).order('created_at'),
        supabase.from('case_events').select('*').eq('case_id', cas.id).order('created_at'),
        supabase.from('case_tasks').select('*').eq('case_id', cas.id).order('created_at'),
      ])
      setNotes(n || []); setEvents(e || []); setTasks(t || [])
      setLoading(false)
    })()
  }, [cas.id])

  const authorName = (uid) => staff.find(s => s.id === uid)?.full_name || 'Team member'

  const chronology = [
    ...(notes || []).map(n => ({ ...n, event_type: 'note' })),
    ...(events || []),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const buildText = () => {
    const lines = []
    lines.push(`CASE CHRONOLOGY`)
    lines.push(`${org?.name || ''}`)
    lines.push(`Generated ${new Date().toLocaleString('en-GB')}`)
    lines.push('')
    lines.push(`Case ID: ${cas.id.slice(0, 8).toUpperCase()}`)
    lines.push(`Young person: ${cas.child_name}`)
    lines.push(`Category: ${cas.category || cas.case_type || '—'}`)
    lines.push(`Risk level: ${cas.risk_level || cas.priority || '—'}`)
    lines.push(`Status: ${STATUS_LABELS[cas.status] || cas.status}`)
    lines.push(`Assigned to: ${cas.assigned_to || 'Unassigned'}`)
    lines.push(`Opened: ${new Date(cas.created_at).toLocaleDateString('en-GB')}`)
    lines.push('')
    lines.push(`SUMMARY`)
    lines.push(cas.summary || '—')
    lines.push('')
    lines.push(`CHRONOLOGY OF EVENTS`)
    chronology.forEach(item => {
      const meta = EVENT_META[item.event_type] || EVENT_META.note
      lines.push(`[${new Date(item.created_at).toLocaleString('en-GB')}] ${meta.label} — ${authorName(item.created_by)}`)
      lines.push(`  ${item.body}`)
      lines.push('')
    })
    lines.push(`OPEN / COMPLETED TASKS`)
    tasks.forEach(t => {
      lines.push(`  [${t.completed ? 'x' : ' '}] ${t.title}${t.due_date ? ` (due ${new Date(t.due_date).toLocaleDateString('en-GB')})` : ''}`)
    })
    return lines.join('\n')
  }

  const printView = () => {
    const w = window.open('', '_blank')
    w.document.write(`<pre style="font-family: -apple-system, sans-serif; white-space: pre-wrap; padding: 32px; line-height:1.6;">${buildText().replace(/</g, '&lt;')}</pre>`)
    w.document.close()
    w.print()
  }

  const download = () => downloadBlob(buildText(), `chronology-${cas.child_name.replace(/\s+/g, '-')}-${cas.id.slice(0, 8)}.txt`, 'text/plain')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>📄 Case Report — {cas.child_name}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Chronology &amp; summary, ready to print or export</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
          {loading ? (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>Building report…</div>
          ) : (
            <pre style={{ fontFamily: 'inherit', fontSize: 12.5, whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.6, background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 12, padding: 18, margin: 0 }}>{buildText()}</pre>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={download} style={btnGhost}>⬇ Download .txt</button>
          <button onClick={printView} style={btnPrimary(org?.primary_color || '#7C5CFC')}>🖨 Print</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'

const CASE_TYPES = [
  { key: 'Safeguarding',   icon: '🛡️', color: '#DC2626' },
  { key: 'Behaviour',      icon: '⚠️',  color: '#F59E0B' },
  { key: 'Welfare',        icon: '💛',  color: '#F59E0B' },
  { key: 'Mental Health',  icon: '🧠',  color: '#8B5CF6' },
  { key: 'Medical',        icon: '🏥',  color: '#3B82F6' },
  { key: 'Attendance',     icon: '📅',  color: '#6B7280' },
  { key: 'Other',          icon: '📋',  color: '#6B7280' },
]
const STATUS_CONFIG = {
  open:        { label: 'Open',        color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  monitoring:  { label: 'Monitoring',  color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  resolved:    { label: 'Resolved',    color: '#16A34A', bg: 'rgba(22,163,74,0.08)'  },
  closed:      { label: 'Closed',      color: '#6B7280', bg: 'rgba(107,114,128,0.08)'},
}
const PRIORITY = {
  high:   { label: 'High',   color: '#DC2626' },
  medium: { label: 'Medium', color: '#F59E0B' },
  low:    { label: 'Low',    color: '#6B7280' },
}

function CaseDetail({ cas, org, session: authSession, onBack, onUpdate }) {
  const isMobile = useIsMobile()
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...cas })
  const primary = org?.primary_color || '#1B9AAA'
  const typeCfg = CASE_TYPES.find(t => t.key === cas.case_type) || CASE_TYPES[6]

  useEffect(() => {
    supabase.from('case_notes').select('*').eq('case_id', cas.id).order('created_at').then(({ data }) => { setNotes(data || []); setLoading(false) })
  }, [cas.id])

  const addNote = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    const { data } = await supabase.from('case_notes').insert({ case_id: cas.id, org_id: org.id, body: newNote.trim(), created_by: authSession?.user?.id }).select().single()
    if (data) setNotes(n => [...n, data])
    setNewNote('')
    setSaving(false)
  }

  const updateStatus = async (status) => {
    const { data } = await supabase.from('cases').update({ status }).eq('id', cas.id).select().single()
    if (data) onUpdate(data)
  }

  const saveEdit = async () => {
    const { data } = await supabase.from('cases').update({ child_name: editForm.child_name, case_type: editForm.case_type, summary: editForm.summary, assigned_to: editForm.assigned_to, priority: editForm.priority }).eq('id', cas.id).select().single()
    if (data) { onUpdate(data); setEditing(false) }
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const statusCfg = STATUS_CONFIG[cas.status] || STATUS_CONFIG.open

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Back to Cases</button>

      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, ${typeCfg.color}15, ${typeCfg.color}05)`, border: `1.5px solid ${typeCfg.color}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{typeCfg.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Case: {cas.child_name}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{cas.case_type} · Assigned to {cas.assigned_to || 'Unassigned'}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, maxWidth: 600 }}>{cas.summary}</div>
          </div>
          <div style={{ display: 'flex', flex: 'column', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ background: statusCfg.bg, color: statusCfg.color, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>{statusCfg.label}</span>
            {cas.priority && <span style={{ background: PRIORITY[cas.priority]?.color + '15', color: PRIORITY[cas.priority]?.color, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>⚡ {PRIORITY[cas.priority]?.label} Priority</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>📅 Opened {format(new Date(cas.created_at), 'd MMM yyyy')}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>📝 {notes.length} note{notes.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Status actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== cas.status).map(([k, v]) => (
          <button key={k} onClick={() => updateStatus(k)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${v.color}40`, background: v.bg, color: v.color, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            → {v.label}
          </button>
        ))}
        <button onClick={() => setEditing(!editing)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F9FAFB', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>
          {editing ? '✕ Cancel Edit' : '✏️ Edit Case'}
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Child Name</label><input value={editForm.child_name || ''} onChange={e => setEditForm(f => ({ ...f, child_name: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Case Type</label>
              <select value={editForm.case_type || ''} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))} style={inp}>
                {CASE_TYPES.map(t => <option key={t.key}>{t.icon} {t.key}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Assigned To</label><input value={editForm.assigned_to || ''} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Priority</label>
              <select value={editForm.priority || 'medium'} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} style={inp}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Summary</label><textarea value={editForm.summary || ''} onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} rows={3} style={{ ...inp, resize: 'none' }} /></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Save Changes</button>
            <button onClick={() => setEditing(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Case notes */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📝 Case Notes</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Loading notes...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {notes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, background: '#F9FAFB', borderRadius: 12, color: '#9CA3AF', fontSize: 13 }}>No notes yet — add the first one below</div>
          )}
          {notes.map(note => (
            <div key={note.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#374151', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.body}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })} · {format(new Date(note.created_at), 'd MMM yyyy HH:mm')}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ background: '#F9FAFB', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '12px 14px' }}>
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a case note... (be specific, factual and dated)" rows={3} style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={addNote} disabled={!newNote.trim() || saving} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: newNote.trim() ? primary : '#E5E7EB', color: newNote.trim() ? '#fff' : '#9CA3AF', fontWeight: 800, cursor: 'pointer' }}>
            {saving ? 'Adding...' : '+ Add Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CaseManagement({ org, session: authSession }) {
  const isMobile = useIsMobile()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [creating, setCreating] = useState(false)
  const [newCase, setNewCase] = useState({ child_name: '', case_type: 'Safeguarding', summary: '', assigned_to: '', priority: 'medium' })
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cases').select('*, case_notes(count)').eq('org_id', org.id).order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const createCase = async () => {
    if (!newCase.child_name || !newCase.summary) return
    setCreating(true)
    const { data } = await supabase.from('cases').insert({ ...newCase, org_id: org.id, status: 'open', created_by: authSession?.user?.id }).select().single()
    setCreating(false)
    if (data) { setCases(c => [{ ...data, case_notes: [{ count: 0 }] }, ...c]); setShowCreate(false); setNewCase({ child_name: '', case_type: 'Safeguarding', summary: '', assigned_to: '', priority: 'medium' }) }
  }

  let filtered = cases
  if (filterStatus !== 'all') filtered = filtered.filter(c => c.status === filterStatus)

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const openCases = cases.filter(c => c.status === 'open' || c.status === 'in_progress').length

  if (selectedCase) return <CaseDetail cas={selectedCase} org={org} session={authSession} onBack={() => { setSelectedCase(null); load() }} onUpdate={updated => { setCases(c => c.map(x => x.id === updated.id ? { ...x, ...updated } : x)); setSelectedCase(updated) }} />

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>👨‍💼 Case Management</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{openCases} active case{openCases !== 1 ? 's' : ''} · {cases.length} total</div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Open New Case</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 10 }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: v.color }}>{cases.filter(c => c.status === k).length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create case */}
      {showCreate && (
        <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>⚠️ Open New Case</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CHILD / YOUNG PERSON *</label><input value={newCase.child_name} onChange={e => setNewCase(n => ({ ...n, child_name: e.target.value }))} placeholder="Full name" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CASE TYPE</label>
              <select value={newCase.case_type} onChange={e => setNewCase(n => ({ ...n, case_type: e.target.value }))} style={inp}>
                {CASE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.key}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>ASSIGNED TO</label><input value={newCase.assigned_to} onChange={e => setNewCase(n => ({ ...n, assigned_to: e.target.value }))} placeholder="Staff member name" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>PRIORITY</label>
              <select value={newCase.priority} onChange={e => setNewCase(n => ({ ...n, priority: e.target.value }))} style={inp}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>SUMMARY *</label><textarea value={newCase.summary} onChange={e => setNewCase(n => ({ ...n, summary: e.target.value }))} placeholder="Brief factual description of the concern or case..." rows={3} style={{ ...inp, resize: 'none' }} /></div>
          </div>
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 12 }}>
            ⚠️ All case information is confidential. Follow your organisation's safeguarding procedures and report serious concerns to statutory services immediately.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createCase} disabled={creating || !newCase.child_name || !newCase.summary} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: creating || !newCase.child_name || !newCase.summary ? '#9CA3AF' : '#DC2626', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{creating ? 'Opening...' : '⚠️ Open Case'}</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...Object.keys(STATUS_CONFIG)].map(k => {
            const v = STATUS_CONFIG[k] || { label: 'All', color: '#6B7280' }
            return (
              <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${filterStatus === k ? primary : '#e5e7eb'}`, background: filterStatus === k ? primary + '12' : '#fff', color: filterStatus === k ? primary : '#6B7280', fontSize: 11, fontWeight: filterStatus === k ? 800 : 600, cursor: 'pointer' }}>
                {k === 'all' ? 'All Status' : v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cases list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading cases...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{cases.length === 0 ? 'No cases yet' : 'No matching cases'}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF' }}>{cases.length === 0 ? 'Cases are opened when concerns are raised about a young person' : 'Try a different filter'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(cas => {
            const typeCfg = CASE_TYPES.find(t => t.key === cas.case_type) || CASE_TYPES[6]
            const statusCfg = STATUS_CONFIG[cas.status] || STATUS_CONFIG.open
            const noteCount = cas.case_notes?.[0]?.count || 0
            return (
              <div key={cas.id} onClick={() => setSelectedCase(cas)} style={{ background: '#fff', border: `1.5px solid ${statusCfg.color}30`, borderLeft: `4px solid ${typeCfg.color}`, borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${typeCfg.color}20` }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{typeCfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{cas.child_name}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{cas.summary}</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#9CA3AF' }}>
                    <span>{cas.case_type}</span>
                    <span>Assigned: {cas.assigned_to || 'Unassigned'}</span>
                    <span>📝 {noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                    <span>{formatDistanceToNow(new Date(cas.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ background: statusCfg.bg, color: statusCfg.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>{statusCfg.label}</span>
                  {cas.priority && <span style={{ color: PRIORITY[cas.priority]?.color, fontSize: 11, fontWeight: 700 }}>⚡ {PRIORITY[cas.priority]?.label}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { RatingBadge, RAStatusChip } from './ra_shared'

// Embeds inside the Session Planner form (Details step). Two modes:
//  - sessionId present (editing an existing session): reads/writes risk_assessment_sessions directly.
//  - sessionId null (creating a new session): tracks a "pending" assessment id via onPendingChange,
//    which the parent links to risk_assessment_sessions once the session itself is saved.
export default function RASessionCard({ sessionId, sessionTitle, org, onNavigate, pendingAssessmentId, onPendingChange, onLinkedChange }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [linked, setLinked] = useState(null) // { id, name, risk_rating, status, linkRowId }
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState([])
  const [creating, setCreating] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback(async () => {
    setLoading(true)
    if (sessionId) {
      const { data } = await supabase.from('risk_assessment_sessions').select('id, risk_assessments(id, name, risk_rating, status)').eq('session_id', sessionId).limit(1).maybeSingle()
      if (mounted.current) setLinked(data?.risk_assessments ? { ...data.risk_assessments, linkRowId: data.id } : null)
    } else if (pendingAssessmentId) {
      const { data } = await supabase.from('risk_assessments').select('id, name, risk_rating, status').eq('id', pendingAssessmentId).single()
      if (mounted.current) setLinked(data || null)
    } else {
      setLinked(null)
    }
    setLoading(false)
  }, [sessionId, pendingAssessmentId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (onLinkedChange) onLinkedChange(!!linked) }, [linked]) // eslint-disable-line react-hooks/exhaustive-deps

  const openPicker = async () => {
    setPicker(true)
    const { data } = await supabase.from('risk_assessments').select('id, name, activity_type, risk_rating, status').eq('org_id', org.id).eq('archived', false).eq('is_template', false).order('name').limit(50)
    setOptions(data || [])
  }

  const attach = async (a) => {
    if (sessionId) {
      const { data } = await supabase.from('risk_assessment_sessions').insert({ assessment_id: a.id, session_id: sessionId, org_id: org.id }).select().single()
      setLinked({ ...a, linkRowId: data?.id })
      await supabase.from('risk_assessment_audit').insert({ assessment_id: a.id, org_id: org.id, action: 'attached', detail: `Attached to session "${sessionTitle}"` })
    } else {
      setLinked(a)
      if (onPendingChange) onPendingChange(a.id)
    }
    setPicker(false)
  }

  const detach = async () => {
    if (sessionId && linked?.linkRowId) {
      await supabase.from('risk_assessment_sessions').delete().eq('id', linked.linkRowId)
      await supabase.from('risk_assessment_audit').insert({ assessment_id: linked.id, org_id: org.id, action: 'detached', detail: `Detached from session "${sessionTitle}"` })
    } else if (onPendingChange) {
      onPendingChange(null)
    }
    setLinked(null)
  }

  const createNew = async () => {
    setCreating(true)
    const { data: ra, error } = await supabase.from('risk_assessments').insert({
      org_id: org.id, name: sessionTitle?.trim() || 'Untitled Session', status: 'draft',
    }).select().single()
    if (error) { alert('Failed to create: ' + error.message); setCreating(false); return }
    await supabase.from('risk_assessment_audit').insert({ assessment_id: ra.id, org_id: org.id, action: 'created', detail: `Created for session "${sessionTitle}"` })
    if (sessionId) {
      const { data } = await supabase.from('risk_assessment_sessions').insert({ assessment_id: ra.id, session_id: sessionId, org_id: org.id }).select().single()
      setLinked({ ...ra, linkRowId: data?.id })
    } else {
      setLinked(ra)
      if (onPendingChange) onPendingChange(ra.id)
    }
    setCreating(false)
  }

  const filteredOptions = options.filter(o => !search.trim() || o.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Risk Assessment</label>
      <div style={{ background: linked ? `${primary}0a` : '#FFF7ED', border: `1.5px solid ${linked ? `${primary}30` : '#FDBA74'}`, borderRadius: 14, padding: 14 }}>
        {loading ? (
          <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Checking…</div>
        ) : linked ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🛡️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linked.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  {linked.risk_rating && <RatingBadge rating={linked.risk_rating} size="sm" />}
                  {linked.status && <RAStatusChip status={linked.status} />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => onNavigate && onNavigate('risk_assessments')} style={{ fontSize: 11.5, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View Assessment →</button>
              <button onClick={detach} style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>Detach</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A3412' }}>No risk assessment attached to this session</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openPicker} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1.5px solid #FDBA74', background: '#fff', color: '#9A3412', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Attach Existing</button>
              <button onClick={createNew} disabled={creating} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', background: primary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{creating ? 'Creating…' : '+ Create New'}</button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {picker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 8, border: '1.5px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 10, background: '#F8FAFC' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search risk assessments…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 12.5, outline: 'none', marginBottom: 8 }} />
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filteredOptions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 10, color: '#94A3B8', fontSize: 12 }}>No assessments found.</div>
                ) : filteredOptions.map(a => (
                  <button key={a.id} onClick={() => attach(a)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 13 }}>🛡️</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    {a.risk_rating && <RatingBadge rating={a.risk_rating} size="sm" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setPicker(false)} style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.1)', background: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#64748B' }}>Close</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

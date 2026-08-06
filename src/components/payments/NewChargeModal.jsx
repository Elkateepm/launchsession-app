import React, { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { PB, CHARGE_TYPES, inputStyle } from './paymentsShared'

export default function NewChargeModal({ org, session, children, sessions, onClose, onCreated }) {
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [chargeType, setChargeType] = useState('trip')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [assignMode, setAssignMode] = useState('single') // single | multiple | session
  const [selectedChildIds, setSelectedChildIds] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [childSearch, setChildSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredChildren = useMemo(() => {
    const q = childSearch.trim().toLowerCase()
    if (!q) return children
    return children.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
  }, [children, childSearch])

  const toggleChild = (id) => {
    setSelectedChildIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    setError('')
    const amt = parseFloat(amount)
    if (!title.trim()) { setError('Give the charge a title.'); return }
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }

    let childIds = []
    let sessionIdForCharge = null

    if (assignMode === 'single' || assignMode === 'multiple') {
      childIds = selectedChildIds
      if (childIds.length === 0) { setError('Choose at least one child.'); return }
    } else if (assignMode === 'session') {
      if (!selectedSessionId) { setError('Choose a session.'); return }
      sessionIdForCharge = selectedSessionId
      setSaving(true)
      const { data: attRows, error: attErr } = await supabase.from('attendance')
        .select('child_id').eq('session_id', selectedSessionId)
      setSaving(false)
      if (attErr) { setError('Could not load expected children for that session.'); return }
      childIds = [...new Set((attRows || []).map(r => r.child_id))]
      if (childIds.length === 0) { setError('No children are expected on that session yet.'); return }

      // Avoid double-charging: skip children who already have a charge with this
      // exact title on this session.
      const { data: existing } = await supabase.from('payment_charges')
        .select('child_id').eq('org_id', org.id).eq('session_id', selectedSessionId).eq('title', title.trim())
      const already = new Set((existing || []).map(r => r.child_id))
      childIds = childIds.filter(id => !already.has(id))
      if (childIds.length === 0) { setError('Every expected child already has this charge.'); return }
    }

    setSaving(true)
    const rows = childIds.map(childId => ({
      org_id: org.id,
      child_id: childId,
      session_id: sessionIdForCharge,
      title: title.trim(),
      description: description.trim() || null,
      charge_type: chargeType,
      amount: amt,
      due_date: dueDate || null,
      created_by: session?.user?.id,
    }))
    const { error: err } = await supabase.from('payment_charges').insert(rows)
    setSaving(false)
    if (err) { setError(err.message || 'Could not create charge.'); return }
    onCreated && onCreated(rows.length)
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400, backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10401, background: '#fff',
        ...(isMobile
          ? { left: 0, right: 0, bottom: 0, maxHeight: '92vh', borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }
          : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(560px, 92vw)', maxHeight: '88vh', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }),
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>+ New Charge</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <Field label="Title">
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Thorpe Park Trip" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type">
              <select value={chargeType} onChange={e => setChargeType(e.target.value)} style={inputStyle}>
                {CHARGE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Amount">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#64748B', fontWeight: 700 }}>£</span>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, paddingLeft: 24 }} placeholder="0.00" />
              </div>
            </Field>
          </div>

          <Field label="Due date (optional)">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Assign to">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['single', 'Single child'],
                ['multiple', 'Multiple children'],
                ['session', 'Everyone on a session'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => { setAssignMode(key); setSelectedChildIds([]); setSelectedSessionId('') }} style={{
                  padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: assignMode === key ? `2px solid ${PB.blue}` : '1.5px solid #E2E8F0',
                  background: assignMode === key ? '#EFF6FF' : '#fff', color: '#334155',
                }}>{label}</button>
              ))}
            </div>
          </Field>

          {(assignMode === 'single' || assignMode === 'multiple') && (
            <Field label={assignMode === 'single' ? 'Child' : `Children ${selectedChildIds.length ? `(${selectedChildIds.length} selected)` : ''}`}>
              <input value={childSearch} onChange={e => setChildSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} placeholder="Search children…" />
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: 10 }}>
                {filteredChildren.slice(0, 100).map(c => {
                  const selected = selectedChildIds.includes(c.id)
                  return (
                    <button key={c.id} onClick={() => {
                      if (assignMode === 'single') setSelectedChildIds([c.id])
                      else toggleChild(c.id)
                    }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
                      padding: '8px 12px', border: 'none', borderBottom: '1px solid #F8FAFC', cursor: 'pointer',
                      background: selected ? '#EFF6FF' : '#fff', fontSize: 12.5, color: '#0F172A', fontWeight: selected ? 700 : 500,
                    }}>
                      {c.first_name} {c.last_name}
                      {selected && <span style={{ color: PB.blue }}>✓</span>}
                    </button>
                  )
                })}
                {filteredChildren.length === 0 && <div style={{ padding: 14, fontSize: 12, color: '#94A3B8' }}>No children match.</div>}
              </div>
            </Field>
          )}

          {assignMode === 'session' && (
            <Field label="Session">
              <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)} style={inputStyle}>
                <option value="">Choose a session…</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.title} · {s.session_date ? new Date(s.session_date).toLocaleDateString('en-GB') : ''}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Notes (optional)">
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          {error && <div style={{ fontSize: 12.5, color: PB.red, fontWeight: 600, marginBottom: 6 }}>{error}</div>}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
          <button onClick={handleCreate} disabled={saving} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: saving ? 'default' : 'pointer',
            background: saving ? '#93C5FD' : PB.gradient, color: '#fff', fontSize: 14, fontWeight: 800,
          }}>
            {saving ? 'Creating…' : 'Create charge'}
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

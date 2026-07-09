import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const STAGES = [
  { key: 'researching', label: 'Researching', color: '#6B7280' },
  { key: 'drafting', label: 'Drafting', color: '#374151' },
  { key: 'submitted', label: 'Submitted', color: '#BA7517' },
  { key: 'awarded', label: 'Awarded', color: '#16803C' },
  { key: 'declined', label: 'Declined', color: '#B91C1C' },
]

export default function ApplicationTracker({ org, refreshKey }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newApp, setNewApp] = useState({ custom_name: '', amount_requested: '', target_date: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('grant_applications').select('*, grants(name, funder_name, website_url)').eq('org_id', org.id).order('created_at', { ascending: false })
    setApps(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load, refreshKey])

  const moveStage = async (id, stage) => {
    setApps(a => a.map(x => x.id === id ? { ...x, stage } : x))
    const patch = { stage, updated_at: new Date().toISOString() }
    if (stage === 'submitted') patch.submitted_date = new Date().toISOString().slice(0, 10)
    if (stage === 'awarded' || stage === 'declined') patch.decision_date = new Date().toISOString().slice(0, 10)
    await supabase.from('grant_applications').update(patch).eq('id', id)
  }

  const addApp = async () => {
    if (!newApp.custom_name) return
    setCreating(true)
    const { data } = await supabase.from('grant_applications').insert({
      org_id: org.id, custom_name: newApp.custom_name, stage: 'researching',
      amount_requested: newApp.amount_requested ? parseFloat(newApp.amount_requested) : null,
      target_date: newApp.target_date || null,
    }).select().single()
    setCreating(false)
    if (data) { setApps(a => [data, ...a]); setShowAdd(false); setNewApp({ custom_name: '', amount_requested: '', target_date: '' }) }
  }

  const removeApp = async (id) => {
    setApps(a => a.filter(x => x.id !== id))
    await supabase.from('grant_applications').delete().eq('id', id)
  }

  const byStage = useMemo(() => {
    const grouped = {}
    STAGES.forEach(s => { grouped[s.key] = [] })
    apps.forEach(a => { (grouped[a.stage] = grouped[a.stage] || []).push(a) })
    return grouped
  }, [apps])

  const totalRequested = useMemo(() => apps.filter(a => a.stage !== 'declined').reduce((s, a) => s + (a.amount_requested || 0), 0), [apps])
  const inp = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{apps.length} application{apps.length !== 1 ? 's' : ''} tracked · £{totalRequested.toLocaleString()} in active pipeline</div>
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>+ Add application</button>
      </div>

      {showAdd && (
        <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newApp.custom_name} onChange={e => setNewApp(n => ({ ...n, custom_name: e.target.value }))} placeholder="Grant or funder name" style={{ ...inp, flex: '2 1 200px' }} />
          <input type="number" value={newApp.amount_requested} onChange={e => setNewApp(n => ({ ...n, amount_requested: e.target.value }))} placeholder="Amount requested (£)" style={{ ...inp, flex: '1 1 140px' }} />
          <input type="date" value={newApp.target_date} onChange={e => setNewApp(n => ({ ...n, target_date: e.target.value }))} style={{ ...inp, flex: '1 1 140px' }} />
          <button onClick={addApp} disabled={creating || !newApp.custom_name} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: creating || !newApp.custom_name ? '#9CA3AF' : '#16A34A', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{creating ? 'Adding…' : 'Add'}</button>
        </div>
      )}

      {apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, border: '1.5px dashed #e5e7eb', borderRadius: 14, color: '#9CA3AF' }}>
          No applications tracked yet. Add one here, or use "Track application" from Discover Funding.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {STAGES.map(stage => byStage[stage.key]?.length > 0 && (
            <div key={stage.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>({byStage[stage.key].length})</span>
              </div>
              <div style={{ borderTop: '0.5px solid #e5e7eb' }}>
                {byStage[stage.key].map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: '#1C2333' }}>{a.grants?.name || a.custom_name}</div>
                      <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
                        {a.grants?.funder_name || 'Custom entry'}
                        {a.amount_requested ? ` · £${a.amount_requested.toLocaleString()}` : ''}
                        {a.target_date ? ` · Target ${format(new Date(a.target_date), 'd MMM yyyy')}` : ''}
                      </div>
                    </div>
                    <select value={a.stage} onChange={e => moveStage(a.id, e.target.value)} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', color: '#374151', cursor: 'pointer' }}>
                      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button onClick={() => removeApp(a.id)} title="Remove" style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14, width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: -6 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

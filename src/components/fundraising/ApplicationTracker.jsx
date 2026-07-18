import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { LS, IconGlyph } from './fundraisingShared'
import FundraisingEmptyState from './hub/FundraisingEmptyState'

const STAGES = [
  { key: 'researching', label: 'Researching', color: '#6B7280', bg: '#F3F2F7' },
  { key: 'drafting', label: 'Drafting', color: LS.purpleDark, bg: LS.lavender },
  { key: 'submitted', label: 'Submitted', color: '#92640C', bg: '#FDF6E8' },
  { key: 'awarded', label: 'Awarded', color: '#16803C', bg: '#E7F6EC' },
  { key: 'declined', label: 'Declined', color: '#B91C1C', bg: '#FCEAEA' },
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
  const inp = { padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: LS.muted }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, color: LS.muted, fontWeight: 600 }}>{apps.length} application{apps.length !== 1 ? 's' : ''} tracked · £{totalRequested.toLocaleString()} in active pipeline</div>
        <button onClick={() => setShowAdd(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
          border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          boxShadow: `0 6px 14px ${LS.purple}30`,
        }}>
          <IconGlyph name="plus" color="#fff" size={13} /> Add application
        </button>
      </div>

      {showAdd && (
        <div style={{ background: LS.bg, border: `1.5px solid ${LS.lavenderBorder}`, borderRadius: 14, padding: 16, marginBottom: 22, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newApp.custom_name} onChange={e => setNewApp(n => ({ ...n, custom_name: e.target.value }))} placeholder="Grant or funder name" style={{ ...inp, flex: '2 1 200px' }} />
          <input type="number" value={newApp.amount_requested} onChange={e => setNewApp(n => ({ ...n, amount_requested: e.target.value }))} placeholder="Amount requested (£)" style={{ ...inp, flex: '1 1 140px' }} />
          <input type="date" value={newApp.target_date} onChange={e => setNewApp(n => ({ ...n, target_date: e.target.value }))} style={{ ...inp, flex: '1 1 140px' }} />
          <button onClick={addApp} disabled={creating || !newApp.custom_name} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: creating || !newApp.custom_name ? '#C4C1D6' : LS.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{creating ? 'Adding…' : 'Add'}</button>
        </div>
      )}

      {apps.length === 0 ? (
        <FundraisingEmptyState icon="doc" title="No applications tracked yet"
          subtitle='Add one here, or use "Track application" from Discover Funding.' />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {STAGES.map(stage => byStage[stage.key]?.length > 0 && (
            <div key={stage.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: stage.color }}>{stage.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: LS.muted, background: stage.bg, borderRadius: 20, padding: '1px 8px' }}>{byStage[stage.key].length}</span>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '4px 18px' }}>
                {byStage[stage.key].map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i === byStage[stage.key].length - 1 ? 'none' : `1px solid ${LS.border}` }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: stage.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconGlyph name="doc" color={stage.color} size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: LS.text }}>{a.grants?.name || a.custom_name}</div>
                      <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 1 }}>
                        {a.grants?.funder_name || 'Custom entry'}
                        {a.amount_requested ? ` · £${a.amount_requested.toLocaleString()}` : ''}
                        {a.target_date ? ` · Target ${format(new Date(a.target_date), 'd MMM yyyy')}` : ''}
                      </div>
                    </div>
                    <select value={a.stage} onChange={e => moveStage(a.id, e.target.value)} style={{
                      fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 20, border: 'none',
                      color: stage.color, background: stage.bg, cursor: 'pointer',
                    }}>
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

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'sport', label: 'Sport' },
  { key: 'youth', label: 'Youth' },
  { key: 'community', label: 'Community' },
  { key: 'education', label: 'Education' },
  { key: 'environment', label: 'Environment' },
  { key: 'general', label: 'General' },
]

function formatAmount(min, max) {
  const fmt = n => `£${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return 'Amount varies'
}

export default function FundingMarketplace({ org, primary, onTrack }) {
  const [grants, setGrants] = useState([])
  const [saves, setSaves] = useState({}) // grant_id -> save row id
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [trackedFeedback, setTrackedFeedback] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('grants').select('*').eq('active', true).order('funder_name'),
      supabase.from('grant_saves').select('id, grant_id').eq('org_id', org.id),
    ])
    setGrants(g || [])
    const saveMap = {}
    ;(s || []).forEach(row => { saveMap[row.grant_id] = row.id })
    setSaves(saveMap)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const toggleSave = async (grantId) => {
    setBusyId(grantId)
    if (saves[grantId]) {
      await supabase.from('grant_saves').delete().eq('id', saves[grantId])
      setSaves(s => { const n = { ...s }; delete n[grantId]; return n })
    } else {
      const { data } = await supabase.from('grant_saves').insert({ org_id: org.id, grant_id: grantId }).select().single()
      if (data) setSaves(s => ({ ...s, [grantId]: data.id }))
    }
    setBusyId(null)
  }

  const trackApplication = async (grant) => {
    setBusyId(grant.id)
    const { error } = await supabase.from('grant_applications').insert({ org_id: org.id, grant_id: grant.id, stage: 'researching' })
    setBusyId(null)
    if (!error) {
      setTrackedFeedback(grant.id)
      setTimeout(() => setTrackedFeedback(null), 2000)
      if (onTrack) onTrack()
    }
  }

  const filtered = useMemo(() => {
    return grants.filter(g => {
      if (category !== 'all' && g.category !== category) return false
      if (savedOnly && !saves[g.id]) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(g.name.toLowerCase().includes(q) || g.funder_name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [grants, category, savedOnly, saves, search])

  const inp = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search grants, funders, or keywords…" style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: category === c.key ? `1.5px solid ${primary}` : '1.5px solid #e5e7eb', background: category === c.key ? `${primary}12` : '#fff', color: category === c.key ? primary : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              {c.label}
            </button>
          ))}
          <button onClick={() => setSavedOnly(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: savedOnly ? '1.5px solid #BA7517' : '1.5px solid #e5e7eb', background: savedOnly ? '#FDF6E8' : '#fff', color: savedOnly ? '#92640C' : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            {savedOnly ? '★ Saved only' : '☆ Saved only'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
        {loading ? 'Loading…' : `${filtered.length} funder${filtered.length === 1 ? '' : 's'}`} · A curated, manually researched list — not a live-matched or auto-scraped feed. Always confirm current criteria on the funder's own site before applying.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, border: '1.5px dashed #e5e7eb', borderRadius: 14, color: '#9CA3AF' }}>No funders match your filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(g => (
            <div key={g.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1C2333' }}>{g.name}</div>
                  <div style={{ fontSize: 12.5, color: '#6B7280' }}>{g.funder_name}</div>
                </div>
                <button onClick={() => toggleSave(g.id)} disabled={busyId === g.id} title={saves[g.id] ? 'Unsave' : 'Save'}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: saves[g.id] ? '#BA7517' : '#D1D5DB', flexShrink: 0, padding: 0 }}>
                  {saves[g.id] ? '★' : '☆'}
                </button>
              </div>
              <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.55, marginBottom: 10 }}>{g.description}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Amount</div>
                  <div style={{ fontSize: 13, color: '#1C2333', fontWeight: 500 }}>{formatAmount(g.amount_min, g.amount_max)}</div>
                  {g.amount_note && <div style={{ fontSize: 11, color: '#9CA3AF', maxWidth: 220 }}>{g.amount_note}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Deadline</div>
                  <div style={{ fontSize: 13, color: '#1C2333', fontWeight: 500 }}>{g.deadline_type === 'fixed' && g.deadline_date ? format(new Date(g.deadline_date), 'd MMM yyyy') : 'Rolling — no fixed deadline'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Scope</div>
                  <div style={{ fontSize: 13, color: '#1C2333', fontWeight: 500, textTransform: 'capitalize' }}>{g.scope}</div>
                </div>
              </div>
              {g.eligibility && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, background: '#FAFAF8', border: '1px solid #ECEAE4', borderRadius: 8, padding: '8px 10px' }}><strong style={{ color: '#4B5563' }}>Eligibility: </strong>{g.eligibility}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a href={g.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: primary, fontWeight: 600, textDecoration: 'none' }}>Visit funder's website →</a>
                <button onClick={() => trackApplication(g)} disabled={busyId === g.id}
                  style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  {trackedFeedback === g.id ? 'Added ✓' : '+ Track application'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

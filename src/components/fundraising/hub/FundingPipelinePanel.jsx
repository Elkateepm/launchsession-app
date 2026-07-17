import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { LS, DAY_MS } from '../fundraisingShared'
import FundraisingEmptyState from './FundraisingEmptyState'

// Real stages tracked by grant_applications.stage (see ApplicationTracker.jsx).
// The spec's "Ideas / Searching / Application / Submitted / Awarded / Reporting"
// funnel doesn't map 1:1 onto tracked data — "Reporting" in particular isn't a
// stage the schema tracks — so this uses the real stages rather than inventing
// a "Reporting" count that has no backing data.
const STAGES = [
  { key: 'researching', label: 'Researching', color: '#6B7280', bg: '#F3F2F7' },
  { key: 'drafting',    label: 'Drafting',    color: '#7C5CFC', bg: '#F1EDFF' },
  { key: 'submitted',   label: 'Submitted',   color: '#BA7517', bg: '#FDF3E4' },
  { key: 'awarded',     label: 'Awarded',     color: '#16803C', bg: '#E7F6EC' },
  { key: 'declined',    label: 'Declined',    color: '#B91C1C', bg: '#FCEAEA' },
]

function waitingLabel(a) {
  const anchor = a.updated_at || a.created_at
  if (!anchor) return null
  const days = Math.floor((new Date() - new Date(anchor)) / DAY_MS)
  if (days <= 0) return 'Today'
  return `${days} day${days === 1 ? '' : 's'}`
}

export default function FundingPipelinePanel({ org, onViewPipeline }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('grant_applications').select('*, grants(name, funder_name)').eq('org_id', org.id).order('updated_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) { setApps(data || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [org.id])

  const counts = useMemo(() => {
    const c = {}
    STAGES.forEach(s => { c[s.key] = 0 })
    apps.forEach(a => { if (c[a.stage] !== undefined) c[a.stage]++ })
    return c
  }, [apps])

  const recent = useMemo(() => apps.filter(a => a.stage !== 'declined').slice(0, 4), [apps])

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Funding Pipeline</div>
        {apps.length > 0 && <button onClick={onViewPipeline} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View pipeline →</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: LS.muted, fontSize: 12.5 }}>Loading…</div>
      ) : apps.length === 0 ? (
        <FundraisingEmptyState icon="doc" title="No applications tracked yet"
          subtitle="Track a grant from Discover Funding, or add one manually from Applications." compact />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 6, marginBottom: 16 }}>
            {STAGES.map(s => (
              <div key={s.key} style={{ textAlign: 'center', padding: '9px 4px', borderRadius: 12, background: s.bg }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{counts[s.key]}</div>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: s.color, marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {recent.length > 0 && recent.map(a => {
            const stageMeta = STAGES.find(s => s.key === a.stage) || STAGES[0]
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LS.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: LS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.grants?.name || a.custom_name}
                  </div>
                  <div style={{ fontSize: 11, color: LS.muted, marginTop: 1 }}>{a.grants?.funder_name || 'Custom entry'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: stageMeta.color, background: stageMeta.bg, borderRadius: 20, padding: '2px 8px' }}>{stageMeta.label}</span>
                  {waitingLabel(a) && <div style={{ fontSize: 10, color: LS.muted, marginTop: 2 }}>Waiting {waitingLabel(a)}</div>}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

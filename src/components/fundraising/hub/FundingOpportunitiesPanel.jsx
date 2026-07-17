import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { LS, IconGlyph, matchScoreBand, computeMatchScore, daysLeftNumber } from '../fundraisingShared'
import FundraisingEmptyState from './FundraisingEmptyState'

function formatAmount(min, max) {
  const fmt = n => `£${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return 'Amount varies'
}

export default function FundingOpportunitiesPanel({ org, campaigns, onOpen, onViewAll }) {
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('grants').select('id, name, funder_name, amount_min, amount_max, category, deadline_type, deadline_date')
      .eq('active', true).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (!cancelled) { setGrants(data || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [org.id])

  const scored = useMemo(() => {
    return grants
      .map(g => ({ ...g, _score: computeMatchScore(g, campaigns) }))
      .filter(g => g.deadline_type !== 'fixed' || !g.deadline_date || daysLeftNumber(g.deadline_date) >= 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 4)
  }, [grants, campaigns])

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Funding Opportunities</div>
        {scored.length > 0 && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View all →</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: LS.muted, fontSize: 12.5 }}>Loading…</div>
      ) : scored.length === 0 ? (
        <FundraisingEmptyState icon="search" title="No open opportunities yet"
          subtitle="This is ready for live funding data — check back soon or browse Discover Funding." compact />
      ) : (
        <>
          {scored.map(g => {
            const band = matchScoreBand(g._score)
            const days = daysLeftNumber(g.deadline_date)
            return (
              <div key={g.id} onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LS.border}`, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: LS.lavender, color: LS.purpleDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {g.funder_name?.replace(/^The\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: LS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.funder_name}</div>
                  <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 1 }}>
                    {formatAmount(g.amount_min, g.amount_max)}
                    {g.deadline_type === 'fixed' && g.deadline_date && days !== null ? ` · Closes in ${days}d` : ' · Rolling'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: band.bg, color: band.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800 }}>
                    {g._score}%
                  </div>
                  <IconGlyph name="target" color={LS.muted} size={13} />
                </div>
              </div>
            )
          })}
          <button onClick={onViewAll} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}>
            Discover more funding →
          </button>
        </>
      )}
    </div>
  )
}

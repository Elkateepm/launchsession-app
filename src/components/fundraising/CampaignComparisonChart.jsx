import React from 'react'
import { motion } from 'framer-motion'

const GOLD = '#BA7517'

export default function CampaignComparisonChart({ campaigns }) {
  const withTargets = campaigns.filter(c => (c.target_amount || 0) > 0).map(c => ({
    id: c.id, name: c.name, raised: c.raised || 0, target: c.target_amount,
    pct: Math.min(((c.raised || 0) / c.target_amount) * 100, 100),
  })).sort((a, b) => b.pct - a.pct)

  if (withTargets.length === 0) {
    return (
      <div style={{ border: '1px dashed #E5E3DC', borderRadius: 16, padding: '18px 20px', marginBottom: 20, background: '#fff' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9890', marginBottom: 2 }}>Campaign comparison</div>
        <div style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.5 }}>Set a target amount on a campaign to track progress here.</div>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #E5E3DC', borderRadius: 16, padding: '18px 20px', marginBottom: 20, background: '#fff' }}>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9890', marginBottom: 2 }}>{withTargets.length === 1 ? 'Campaign progress' : 'Campaign comparison'}</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>{withTargets.length === 1 ? 'Add a second campaign with a target to compare them side by side' : 'Progress toward target, side by side'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {withTargets.map((c, i) => (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: '#1C2333' }}>{c.name}</span>
              <span style={{ fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>£{c.raised.toLocaleString()} <span style={{ color: '#B0AFA8' }}>of £{c.target.toLocaleString()}</span></span>
            </div>
            <div style={{ height: 8, background: '#F1EFE9', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: c.pct >= 100 ? '#16A34A' : GOLD, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

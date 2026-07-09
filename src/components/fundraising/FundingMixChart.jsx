import React from 'react'
import { motion } from 'framer-motion'

const PALETTE = ['#BA7517', '#375A82', '#4E7A3A', '#7A4066', '#2F6F63', '#8C5A3C', '#4C4A8C', '#54524A']

export default function FundingMixChart({ campaigns }) {
  const withRaised = campaigns.filter(c => (c.raised || 0) > 0).sort((a, b) => (b.raised || 0) - (a.raised || 0))
  const total = withRaised.reduce((s, c) => s + (c.raised || 0), 0)

  if (withRaised.length < 2 || total === 0) {
    return (
      <div style={{ border: '1px dashed #E5E3DC', borderRadius: 16, padding: '18px 20px', marginBottom: 20, background: '#fff' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9890', marginBottom: 2 }}>Funding mix</div>
        <div style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.5 }}>
          {total === 0 ? 'Record a donation on a couple of campaigns to see where your funding is coming from.' : 'Add a second campaign with donations to see the mix between them.'}
        </div>
      </div>
    )
  }

  const size = 140, stroke = 20, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius
  let cumulative = 0
  const segments = withRaised.slice(0, 8).map((c, i) => {
    const pct = (c.raised || 0) / total
    const segment = { ...c, pct, color: PALETTE[i % PALETTE.length], offset: cumulative }
    cumulative += pct
    return segment
  })

  return (
    <div style={{ border: '1px solid #E5E3DC', borderRadius: 16, padding: '18px 20px', marginBottom: 20, background: '#fff' }}>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9890', marginBottom: 2 }}>Funding mix</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>Where your £{total.toLocaleString()} raised has come from</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1EFE9" strokeWidth={stroke} />
          {segments.map((s, i) => (
            <motion.circle key={s.id} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - s.pct * circumference }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
              style={{ transform: `rotate(${s.offset * 360}deg)`, transformOrigin: '50% 50%' }} strokeLinecap="butt" />
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
          {segments.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#1C2333', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>{Math.round(s.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

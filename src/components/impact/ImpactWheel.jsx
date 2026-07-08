import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { HEALTH_AREAS } from './impact_shared'

export default function ImpactWheel({ scores, primary, onSelectArea }) {
  const [hovered, setHovered] = useState(null)
  const size = 320, cx = size / 2, cy = size / 2, maxR = 118, minR = 34

  const values = HEALTH_AREAS.map(area => {
    const areaScores = scores.filter(s => s.area === area.key)
    const avg = areaScores.length ? areaScores.reduce((s, x) => s + x.score, 0) / areaScores.length : 0
    return { ...area, avg }
  })

  const n = values.length
  const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pointFor = (i, r) => [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))]

  const ringLevels = [0.25, 0.5, 0.75, 1]

  const dataPoints = values.map((v, i) => {
    const r = minR + (v.avg / 10) * (maxR - minR)
    return pointFor(i, r)
  })
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'

  return (
    <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 20, padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 900, alignSelf: 'flex-start', marginBottom: 4 }}>🕸️ Impact Map</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', alignSelf: 'flex-start', marginBottom: 10 }}>Young Person Development, at a glance</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {ringLevels.map(level => {
          const r = minR + level * (maxR - minR)
          const pts = Array.from({ length: n }, (_, i) => pointFor(i, r))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
          return <path key={level} d={d} fill="none" stroke="#F3F4F6" strokeWidth={1} />
        })}
        {/* Spokes */}
        {values.map((v, i) => {
          const [x, y] = pointFor(i, maxR)
          return <line key={v.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#F3F4F6" strokeWidth={1} />
        })}
        {/* Centre label */}
        <circle cx={cx} cy={cy} r={minR - 6} fill={primary + '10'} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#6B7280">Young Person</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fontWeight="800" fill="#6B7280">Development</text>

        {/* Data shape */}
        <motion.path d={dataPath} fill={primary + '30'} stroke={primary} strokeWidth={2.5} strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }} />

        {/* Points + labels */}
        {values.map((v, i) => {
          const [px, py] = dataPoints[i]
          const [lx, ly] = pointFor(i, maxR + 26)
          return (
            <g key={v.key} onMouseEnter={() => setHovered(v.key)} onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectArea && onSelectArea(v.key)} style={{ cursor: 'pointer' }}>
              <circle cx={px} cy={py} r={hovered === v.key ? 6 : 4} fill={primary} stroke="#fff" strokeWidth={1.5} />
              <text x={lx} y={ly} textAnchor="middle" fontSize="10.5" fontWeight={hovered === v.key ? 900 : 700} fill={hovered === v.key ? primary : '#6B7280'}>
                {v.icon} {v.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

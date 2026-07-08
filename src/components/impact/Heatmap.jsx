import React from 'react'
import { OUTCOME_AREAS } from './impact_shared'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HEATMAP_AREAS = ['confidence', 'wellbeing', 'attendance', 'education', 'social', 'resilience']

function cellColor(avg) {
  if (avg === null) return '#F9FAFB'
  if (avg >= 8) return '#16A34A'
  if (avg >= 6.5) return '#65A30D'
  if (avg >= 5) return '#F59E0B'
  if (avg >= 3) return '#F97316'
  return '#DC2626'
}

export default function Heatmap({ scores }) {
  if (scores.length < 10) return null // not enough spread yet to be meaningful

  const grid = HEATMAP_AREAS.map(areaKey => {
    const areaLabel = OUTCOME_AREAS.find(a => a.key === areaKey)
    const cells = DAYS.map((_, dayIdx) => {
      // JS getDay(): 0 = Sunday .. 6 = Saturday. Map to Mon-first index.
      const matching = scores.filter(s => {
        const jsDay = new Date(s.recorded_at).getDay()
        const monFirst = jsDay === 0 ? 6 : jsDay - 1
        return monFirst === dayIdx && s.area === areaKey
      })
      const avg = matching.length ? matching.reduce((s, x) => s + x.score, 0) / matching.length : null
      return { avg, count: matching.length }
    })
    return { areaKey, areaLabel, cells }
  })

  const hasAnyData = grid.some(row => row.cells.some(c => c.avg !== null))
  if (!hasAnyData) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 20, padding: '20px 22px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>🗓️ Weekly Heatmap</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>Which days tend to produce the strongest outcomes</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, color: '#9CA3AF', fontWeight: 700, minWidth: 90 }}></th>
              {DAYS.map(d => <th key={d} style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, minWidth: 44 }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {grid.map(row => (
              <tr key={row.areaKey}>
                <td style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.areaLabel?.icon} {row.areaLabel?.label}</td>
                {row.cells.map((c, i) => (
                  <td key={i} title={c.avg !== null ? `${c.avg.toFixed(1)}/10 (${c.count} reading${c.count !== 1 ? 's' : ''})` : 'No data'}>
                    <div style={{ height: 30, borderRadius: 8, background: cellColor(c.avg), opacity: c.avg === null ? 1 : 0.15 + (c.avg / 10) * 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.avg !== null && <span style={{ fontSize: 10, fontWeight: 800, color: c.avg >= 5 ? '#fff' : '#7C2D12' }}>{c.avg.toFixed(1)}</span>}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

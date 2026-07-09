import React from 'react'
import { motion } from 'framer-motion'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_MS = 1000 * 60 * 60 * 24
const GOLD = '#BA7517'

export default function GivingHeatmap({ donations }) {
  if (donations.length < 5) return null // not enough spread to be meaningful yet

  const now = new Date()
  const weeks = 10
  // Build a Monday-first grid for the last `weeks` weeks
  const todayMonFirst = now.getDay() === 0 ? 6 : now.getDay() - 1
  const gridStart = new Date(now.getTime() - (todayMonFirst + (weeks - 1) * 7) * DAY_MS)
  gridStart.setHours(0, 0, 0, 0)

  const cellTotals = {} // key: `${weekIdx}-${dayIdx}` -> { amount, count }
  donations.forEach(d => {
    const dt = new Date(d.created_at)
    const daysSinceStart = Math.floor((dt - gridStart) / DAY_MS)
    if (daysSinceStart < 0 || daysSinceStart >= weeks * 7) return
    const weekIdx = Math.floor(daysSinceStart / 7)
    const dayIdx = daysSinceStart % 7
    const key = `${weekIdx}-${dayIdx}`
    if (!cellTotals[key]) cellTotals[key] = { amount: 0, count: 0 }
    cellTotals[key].amount += Number(d.amount) || 0
    cellTotals[key].count += 1
  })

  const maxAmount = Math.max(...Object.values(cellTotals).map(c => c.amount), 1)
  const hasAnyData = Object.keys(cellTotals).length > 0
  if (!hasAnyData) return null

  return (
    <div style={{ border: '1px solid #E5E3DC', borderRadius: 16, padding: '18px 20px', marginBottom: 20, background: '#fff' }}>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9890', marginBottom: 2 }}>Giving activity</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Which days tend to bring in donations, last {weeks} weeks</div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginRight: 4 }}>
            {DAYS.map(d => <div key={d} style={{ height: 16, fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>{d}</div>)}
          </div>
          {Array.from({ length: weeks }, (_, weekIdx) => (
            <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DAYS.map((_, dayIdx) => {
                const cell = cellTotals[`${weekIdx}-${dayIdx}`]
                const intensity = cell ? Math.max(0.12, cell.amount / maxAmount) : 0
                const cellDate = new Date(gridStart.getTime() + (weekIdx * 7 + dayIdx) * DAY_MS)
                return (
                  <motion.div key={dayIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: (weekIdx * 7 + dayIdx) * 0.003 }}
                    title={cell ? `${cellDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — £${cell.amount.toLocaleString()} (${cell.count} donation${cell.count !== 1 ? 's' : ''})` : cellDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    style={{ width: 16, height: 16, borderRadius: 4, background: cell ? GOLD : '#F1EFE9', opacity: cell ? intensity : 1 }} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

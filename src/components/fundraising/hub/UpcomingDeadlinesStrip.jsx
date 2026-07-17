import React, { useMemo } from 'react'
import { LS, daysLeftNumber } from '../fundraisingShared'
import FundraisingEmptyState from './FundraisingEmptyState'
import { useIsMobile } from '../../../hooks/useIsMobile'

function priorityOf(days) {
  if (days <= 7) return { label: 'High priority', color: '#B91C1C', bg: '#FCEAEA' }
  if (days <= 21) return { label: 'Medium priority', color: '#B45309', bg: '#FDF3E4' }
  return { label: 'Low priority', color: '#375A82', bg: '#E9F0F7' }
}

export default function UpcomingDeadlinesStrip({ events, loading, onViewCalendar }) {
  const isMobile = useIsMobile()
  const items = useMemo(() => events.slice(0, 4), [events])

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Upcoming Deadlines</div>
        {items.length > 0 && <button onClick={onViewCalendar} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View calendar →</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: LS.muted, fontSize: 12.5 }}>Loading…</div>
      ) : items.length === 0 ? (
        <FundraisingEmptyState icon="clock" title="No deadlines coming up"
          subtitle="Save a grant, set a campaign end date, or add an application target date to see it here." compact />
      ) : (
        <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)', gap: 10, overflowX: isMobile ? 'auto' : 'visible' }}>
          {items.map((e, i) => {
            const days = daysLeftNumber(e.date)
            const p = priorityOf(days)
            return (
              <div key={i} style={{ flex: isMobile ? '0 0 150px' : undefined, border: `1px solid ${LS.border}`, borderRadius: 14, padding: '12px 14px', background: LS.bg }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: LS.purpleDark, lineHeight: 1 }}>{days}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: LS.muted, textTransform: 'uppercase', marginBottom: 8 }}>days</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: LS.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                <div style={{ fontSize: 11, color: LS.muted, marginBottom: 8 }}>{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: p.color, background: p.bg, borderRadius: 20, padding: '2px 8px' }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

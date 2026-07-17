import React from 'react'
import { LS, IconGlyph, AnimatedNumber } from '../fundraisingShared'
import { useIsMobile } from '../../../hooks/useIsMobile'

function Kpi({ icon, iconColor, iconBg, label, value, prefix, suffix, support }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconGlyph name={icon} color={iconColor} size={15} />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: LS.muted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: LS.text }}>
        {value === null ? '—' : <>{prefix || ''}<AnimatedNumber value={value} />{suffix || ''}</>}
      </div>
      {support && <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 4 }}>{support}</div>}
    </div>
  )
}

export default function FundraisingKpis({ raisedThisYear, monthDelta, activeCount, endingSoonCount, upcomingDeadlinesCount, nextDeadlineDays, successRate, successRateSampleSize }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
      <Kpi icon="coin" iconColor="#7C5CFC" iconBg="#F1EDFF" label="Raised This Year" value={raisedThisYear} prefix="£"
        support={monthDelta === null ? 'No prior-year data yet' : monthDelta === 'new' ? 'New this year' : `${monthDelta >= 0 ? '↑' : '↓'} ${Math.abs(monthDelta)}% vs last year`} />
      <Kpi icon="rocket" iconColor="#2F6F63" iconBg="#EAF5F2" label="Active Campaigns" value={activeCount}
        support={endingSoonCount > 0 ? `${endingSoonCount} ending soon` : 'None ending soon'} />
      <Kpi icon="clock" iconColor="#BA7517" iconBg="#FDF3E4" label="Upcoming Deadlines" value={upcomingDeadlinesCount}
        support={nextDeadlineDays !== null ? `Next deadline in ${nextDeadlineDays} day${nextDeadlineDays === 1 ? '' : 's'}` : 'None scheduled'} />
      <Kpi icon="trophy" iconColor="#375A82" iconBg="#E9F0F7" label="Success Rate" value={successRate} suffix={successRate !== null ? '%' : ''}
        support={successRate !== null ? `Based on last ${successRateSampleSize} campaign${successRateSampleSize === 1 ? '' : 's'}` : 'Complete a campaign to see this'} />
    </div>
  )
}

import React, { useMemo } from 'react'
import { fmtDate, fmtTime } from '../../lib/resourceHelpers'

export default function InventoryAlerts({ resources, checkouts, bookings, onViewStock, onViewBooking, onViewAll }) {
  const alerts = useMemo(() => {
    const list = []
    resources.forEach(r => {
      if (r.archived_at) return
      if (r.low_stock_threshold && r.quantity_available <= r.low_stock_threshold) {
        list.push({ id: `low-${r.id}`, icon: '⚠️', color: '#D97706', text: `${r.name} running low`, sub: `Only ${r.quantity_available} left`, action: 'View Stock', onClick: () => onViewStock(r) })
      }
      if (r.status === 'maintenance') {
        list.push({ id: `maint-${r.id}`, icon: '🔧', color: '#DC2626', text: `${r.name} needs attention`, sub: 'Marked for maintenance', action: 'View Details', onClick: () => onViewStock(r) })
      }
    })
    checkouts.filter(c => c.status === 'checked_out' && c.expected_return_at).forEach(c => {
      const r = resources.find(x => x.id === c.resource_id)
      if (!r) return
      const due = new Date(c.expected_return_at)
      const now = new Date()
      const hoursUntil = (due - now) / 3600000
      if (hoursUntil < 0) {
        list.push({ id: `overdue-${c.id}`, icon: '⏰', color: '#DC2626', text: `${r.name} overdue`, sub: `Was due ${fmtDate(due)} ${fmtTime(due)}`, action: 'View Booking', onClick: () => onViewBooking(c) })
      } else if (hoursUntil < 6) {
        list.push({ id: `duesoon-${c.id}`, icon: '⏳', color: '#2563EB', text: `${r.name} due back soon`, sub: `Due at ${fmtTime(due)}`, action: 'View Booking', onClick: () => onViewBooking(c) })
      }
    })
    return list.slice(0, 6)
  }, [resources, checkouts, onViewStock, onViewBooking])

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Inventory Alerts</div>
        {alerts.length > 0 && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View all alerts</button>}
      </div>
      {alerts.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>All clear — nothing needs attention right now.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}>
              <div style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>{a.text}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{a.sub}</div>
              </div>
              <button onClick={a.onClick} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, fontWeight: 700, color: '#374151', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>{a.action}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

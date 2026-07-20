import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ResourceInventory from './ResourceInventory'
import ResourceCard from './ResourceCard'
import ResourceDetailsDrawer from './ResourceDetailsDrawer'
import AddResourceModal from './AddResourceModal'
import QuickBookingPanel from './QuickBookingPanel'
import UpcomingBookings from './UpcomingBookings'
import ResourceCalendar from './ResourceCalendar'
import InventoryTable from './InventoryTable'
import BookingRequests from './BookingRequests'
import ResourceCheckout from './ResourceCheckout'
import InventoryAlerts from './InventoryAlerts'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'requests', label: 'Requests' },
  { key: 'checkinout', label: 'Check-in / Check-out' },
]

export default function ResourceCentre({ org, session: authSession }) {
  const authUserId = authSession?.user?.id
  const [resources, setResources] = useState([])
  const [bookings, setBookings] = useState([])
  const [checkouts, setCheckouts] = useState([])
  const [sessions, setSessions] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [detailsResource, setDetailsResource] = useState(null)
  const [editResource, setEditResource] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [presetBookingResourceId, setPresetBookingResourceId] = useState(null)

  const load = useCallback(async () => {
    if (!org?.id) return
    const [{ data: res }, { data: book }, { data: co }, { data: sess }, { data: st }] = await Promise.all([
      supabase.from('resources').select('*').eq('org_id', org.id).order('name'),
      supabase.from('resource_bookings').select('*').eq('org_id', org.id).order('start_time'),
      supabase.from('resource_checkouts').select('*').eq('org_id', org.id).order('checked_out_at', { ascending: false }),
      supabase.from('sessions').select('id, title, session_date').eq('org_id', org.id).order('session_date', { ascending: false }).limit(100),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id).in('role', ['admin', 'staff', 'volunteer']),
    ])
    setResources(res || [])
    setBookings(book || [])
    setCheckouts(co || [])
    setSessions(sess || [])
    setStaff(st || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const activeResources = resources.filter(r => !r.archived_at)
  const bookedTodayCount = bookings.filter(b => new Date(b.start_time).toDateString() === new Date().toDateString() && ['pending', 'confirmed'].includes(b.status)).length
  const lowStockCount = activeResources.filter(r => r.status === 'low_stock' || (r.low_stock_threshold && r.quantity_available <= r.low_stock_threshold)).length
  const pendingCount = bookings.filter(b => b.status === 'pending').length

  const handleBook = (resource) => {
    setPresetBookingResourceId(resource.id)
    setTab('overview')
    setTimeout(() => document.getElementById('quick-booking-panel')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleQuickAction = (action, resource) => {
    if (action === 'View details') setDetailsResource(resource)
    else if (action === 'Edit') setEditResource(resource)
    else if (action === 'Mark unavailable') {
      supabase.from('resources').update({ status: resource.status === 'unavailable' ? 'available' : 'unavailable' }).eq('id', resource.id).then(load)
    } else if (action === 'Record maintenance') {
      supabase.from('resources').update({ status: 'maintenance' }).eq('id', resource.id).then(() => {
        supabase.from('resource_maintenance').insert({ org_id: org.id, resource_id: resource.id, maintenance_type: 'general', description: 'Marked for maintenance' }).then(load)
      })
    }
  }

  const handleCalendarSlotClick = (date, hour) => {
    setPresetBookingResourceId(null)
    setTab('overview')
    setTimeout(() => document.getElementById('quick-booking-panel')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 13 }}>Loading Resource Centre...</div>
      </div>
    )
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 900

  return (
    <div style={{ padding: isMobile ? 14 : 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>📅 Resource Centre</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Book rooms, vehicles, equipment and manage inventory from one place.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setPresetBookingResourceId(null); document.getElementById('quick-booking-panel')?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⚡ Quick Book</button>
          <button onClick={() => setShowAddModal(true)} style={{ padding: '11px 18px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add Resource</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon="📋" color="#7C3AED" value={activeResources.length} label="Total Resources" />
        <StatCard icon="✅" color="#16A34A" value={bookedTodayCount} label="Booked Today" />
        <StatCard icon="⚠️" color="#D97706" value={lowStockCount} label="Low Stock Items" />
        <StatCard icon="🕐" color="#2563EB" value={pendingCount} label="Pending Requests" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', borderBottom: tab === t.key ? '2.5px solid #7C3AED' : '2.5px solid transparent', background: 'none', color: tab === t.key ? '#7C3AED' : '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1fr', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, order: isMobile ? 2 : 1 }}>
            <ResourceInventory resources={activeResources} bookings={bookings} onBook={handleBook} onOpen={setDetailsResource} onQuickAction={handleQuickAction} onAddResource={() => setShowAddModal(true)} />
            <UpcomingBookings bookings={bookings} resources={resources} sessions={sessions} staff={staff} onChanged={load} onViewCalendar={() => setTab('calendar')} onViewAll={() => setTab('calendar')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, order: isMobile ? 1 : 2, position: isMobile ? 'static' : 'sticky', top: 16 }} id="quick-booking-panel">
            <QuickBookingPanel org={org} resources={activeResources} bookings={bookings} sessions={sessions} staff={staff} authUserId={authUserId} presetResourceId={presetBookingResourceId} onBooked={load} />
            <InventoryAlerts resources={resources} checkouts={checkouts} bookings={bookings}
              onViewStock={r => setDetailsResource(r)} onViewBooking={() => setTab('checkinout')} onViewAll={() => setTab('inventory')} />
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <ResourceCalendar resources={activeResources} bookings={bookings} onSlotClick={handleCalendarSlotClick} onBookingClick={b => setDetailsResource(resources.find(r => r.id === b.resource_id))} />
      )}

      {tab === 'inventory' && (
        <InventoryTable org={org} resources={resources} staff={staff} authUserId={authUserId} onChanged={load} onOpen={setDetailsResource} />
      )}

      {tab === 'requests' && (
        <BookingRequests org={org} bookings={bookings} resources={resources} sessions={sessions} staff={staff} authUserId={authUserId} onChanged={load} />
      )}

      {tab === 'checkinout' && (
        <ResourceCheckout org={org} resources={resources} checkouts={checkouts} sessions={sessions} staff={staff} authUserId={authUserId} onChanged={load} />
      )}

      {detailsResource && (
        <ResourceDetailsDrawer resource={detailsResource} staff={staff} org={org} onClose={() => setDetailsResource(null)}
          onBook={r => { setDetailsResource(null); handleBook(r) }} onEdit={r => { setDetailsResource(null); setEditResource(r) }} onChanged={load} />
      )}

      {(showAddModal || editResource) && (
        <AddResourceModal org={org} staff={staff} existingResource={editResource} onClose={() => { setShowAddModal(false); setEditResource(null) }} onSaved={() => { setShowAddModal(false); setEditResource(null); load() }} />
      )}
    </div>
  )
}

function StatCard({ icon, color, value, label }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

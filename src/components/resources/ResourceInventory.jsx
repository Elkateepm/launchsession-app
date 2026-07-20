import React, { useState, useMemo } from 'react'
import { CATEGORIES } from '../../lib/resourceHelpers'
import ResourceCard from './ResourceCard'
import ResourceEmptyState from './ResourceEmptyState'

export default function ResourceInventory({ resources, bookings, onBook, onOpen, onQuickAction, onAddResource }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [location, setLocation] = useState('all')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('name')

  const locations = useMemo(() => [...new Set(resources.map(r => r.location).filter(Boolean))], [resources])

  const filtered = useMemo(() => {
    let list = resources.filter(r => !r.archived_at)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
    }
    if (category !== 'all') list = list.filter(r => r.category === category)
    if (availability !== 'all') list = list.filter(r => r.status === availability)
    if (location !== 'all') list = list.filter(r => r.location === location)
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'category') list = [...list].sort((a, b) => a.category.localeCompare(b.category))
    if (sort === 'status') list = [...list].sort((a, b) => a.status.localeCompare(b.status))
    return list
  }, [resources, search, category, availability, location, sort])

  const nextBookingFor = (resourceId) => {
    const now = Date.now()
    return bookings
      .filter(b => b.resource_id === resourceId && ['pending', 'confirmed'].includes(b.status) && new Date(b.start_time).getTime() > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0]
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 14 }}>Resource Inventory</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search resources..." style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13 }} />
        <select value={category} onChange={e => setCategory(e.target.value)} style={selStyle}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
        </select>
        <select value={availability} onChange={e => setAvailability(e.target.value)} style={selStyle}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="low_stock">Low Stock</option>
          <option value="maintenance">Maintenance</option>
          <option value="unavailable">Unavailable</option>
        </select>
        {locations.length > 0 && (
          <select value={location} onChange={e => setLocation(e.target.value)} style={selStyle}>
            <option value="all">All locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle}>
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
          <option value="status">Sort: Status</option>
        </select>
        <div style={{ display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: 9, overflow: 'hidden' }}>
          <button onClick={() => setView('grid')} style={{ padding: '8px 12px', border: 'none', background: view === 'grid' ? '#7C3AED' : '#fff', color: view === 'grid' ? '#fff' : '#6B7280', cursor: 'pointer' }}>▦</button>
          <button onClick={() => setView('list')} style={{ padding: '8px 12px', border: 'none', background: view === 'list' ? '#7C3AED' : '#fff', color: view === 'list' ? '#fff' : '#6B7280', cursor: 'pointer' }}>☰</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <ResourceEmptyState
          icon="📦" title={resources.length === 0 ? 'No resources yet' : 'No matching resources'}
          description={resources.length === 0 ? "Add rooms, vehicles and equipment so your team can manage availability and bookings from one place." : 'Try adjusting your search or filters.'}
          actionLabel={resources.length === 0 ? 'Add First Resource' : undefined}
          onAction={onAddResource}
        />
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {filtered.map(r => (
            <ResourceCard key={r.id} resource={r} nextBooking={nextBookingFor(r.id)} onBook={onBook} onOpen={onOpen} onQuickAction={onQuickAction} view="grid" />
          ))}
          <button onClick={onAddResource} style={{ border: '2px dashed #E5E7EB', borderRadius: 16, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 180, cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#7C3AED' }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>Add New Resource</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '0 20px' }}>Add rooms, vehicles or equipment to your inventory</div>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <ResourceCard key={r.id} resource={r} nextBooking={nextBookingFor(r.id)} onBook={onBook} onOpen={onOpen} onQuickAction={onQuickAction} view="list" />
          ))}
        </div>
      )}
    </div>
  )
}

const selStyle = { padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 12.5, background: '#fff', color: '#374151' }

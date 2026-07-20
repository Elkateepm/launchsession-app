import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { categoryMeta, statusMeta } from '../../lib/resourceHelpers'

export default function InventoryTable({ org, resources, staff, authUserId, onChanged, onOpen }) {
  const [selected, setSelected] = useState([])
  const [movements, setMovements] = useState([])
  const [showMovements, setShowMovements] = useState(false)
  const [adjustingId, setAdjustingId] = useState(null)
  const [adjustQty, setAdjustQty] = useState('')

  const active = resources.filter(r => !r.archived_at)

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () => setSelected(selected.length === active.length ? [] : active.map(r => r.id))

  const loadMovements = async () => {
    const { data } = await supabase.from('resource_stock_movements').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(30)
    setMovements(data || [])
    setShowMovements(true)
  }

  const recordMovement = async (resource, movementType, quantity, newQty) => {
    await supabase.from('resource_stock_movements').insert({
      org_id: org.id, resource_id: resource.id, movement_type: movementType, quantity,
      previous_quantity: resource.quantity_available, new_quantity: newQty, performed_by: authUserId,
    })
  }

  const handleAdjust = async (resource) => {
    const newQty = Number(adjustQty)
    if (isNaN(newQty) || newQty < 0) return
    await supabase.from('resources').update({ quantity_available: newQty, quantity_total: Math.max(newQty, resource.quantity_total) }).eq('id', resource.id)
    await recordMovement(resource, 'adjusted', newQty - resource.quantity_available, newQty)
    setAdjustingId(null); setAdjustQty('')
    onChanged()
  }

  const handleMarkStatus = async (resource, status, movementType) => {
    await supabase.from('resources').update({ status }).eq('id', resource.id)
    if (movementType) await recordMovement(resource, movementType, 0, resource.quantity_available)
    onChanged()
  }

  const handleTransfer = async (resource) => {
    const newLocation = window.prompt('Transfer to location:', resource.location || '')
    if (newLocation === null) return
    await supabase.from('resources').update({ location: newLocation }).eq('id', resource.id)
    onChanged()
  }

  const handleArchive = async (resourceIds) => {
    if (!window.confirm(`Archive ${resourceIds.length} resource(s)?`)) return
    await supabase.from('resources').update({ archived_at: new Date().toISOString() }).in('id', resourceIds)
    setSelected([])
    onChanged()
  }

  const exportCSV = () => {
    const rows = active.map(r => ({
      name: r.name, category: r.category, location: r.location || '', total: r.quantity_total,
      available: r.quantity_available, checked_out: r.quantity_total - r.quantity_available,
      condition: r.condition || '', status: r.status,
    }))
    const headers = ['Resource', 'Category', 'Location', 'Total Quantity', 'Available', 'Checked Out', 'Condition', 'Status']
    const csv = [headers.join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'resource-inventory.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Inventory</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button onClick={() => handleArchive(selected)} style={ghostBtn}>Archive ({selected.length})</button>
          )}
          <button onClick={loadMovements} style={ghostBtn}>Stock Movements</button>
          <button onClick={exportCSV} style={ghostBtn}>Export CSV</button>
          <button onClick={() => window.print()} style={ghostBtn}>Print</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
              <th style={th}><input type="checkbox" checked={selected.length === active.length && active.length > 0} onChange={toggleAll} /></th>
              <th style={th}>Resource</th>
              <th style={th}>Category</th>
              <th style={th}>Location</th>
              <th style={th}>Total</th>
              <th style={th}>Available</th>
              <th style={th}>Checked Out</th>
              <th style={th}>Condition</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {active.map(r => {
              const cat = categoryMeta(r.category)
              const st = statusMeta(r.status)
              const checkedOut = r.quantity_total - r.quantity_available
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={td}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td style={td}><button onClick={() => onOpen(r)} style={{ background: 'none', border: 'none', fontWeight: 700, color: '#111827', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{r.name}</button></td>
                  <td style={td}>{cat.icon} {cat.label}</td>
                  <td style={td}>{r.location || '—'}</td>
                  <td style={td}>{r.quantity_total}</td>
                  <td style={td}>
                    {adjustingId === r.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} style={{ width: 50, padding: 3, borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 11 }} autoFocus />
                        <button onClick={() => handleAdjust(r)} style={{ fontSize: 10, color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setAdjustingId(null)} style={{ fontSize: 10, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAdjustingId(r.id); setAdjustQty(String(r.quantity_available)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#111827', padding: 0 }}>{r.quantity_available}</button>
                    )}
                  </td>
                  <td style={td}>{checkedOut}</td>
                  <td style={td}>{r.condition || '—'}</td>
                  <td style={td}><span style={{ fontSize: 10, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 99, padding: '2px 8px' }}>{st.label}</span></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => handleMarkStatus(r, 'maintenance')} style={miniBtn}>Damaged</button>
                      <button onClick={() => handleMarkStatus(r, 'unavailable', 'lost')} style={miniBtn}>Missing</button>
                      <button onClick={() => handleTransfer(r)} style={miniBtn}>Transfer</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {active.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontSize: 13 }}>No resources in inventory yet.</div>}
      </div>

      {showMovements && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowMovements(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: 480, maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Stock Movements</div>
            {movements.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No movements recorded yet.</div> : movements.map(m => {
              const r = resources.find(x => x.id === m.resource_id)
              return (
                <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                  <strong>{r?.name}</strong> — {m.movement_type} ({m.quantity >= 0 ? '+' : ''}{m.quantity}) · {new Date(m.created_at).toLocaleString('en-GB')}
                </div>
              )
            })}
            <button onClick={() => setShowMovements(false)} style={{ marginTop: 14, width: '100%', padding: 10, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

const th = { padding: '8px 10px', fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }
const td = { padding: '10px', color: '#374151' }
const ghostBtn = { padding: '7px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer' }
const miniBtn = { padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 10.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }

import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDate, fmtTime } from '../../lib/resourceHelpers'
import ResourceEmptyState from './ResourceEmptyState'

export default function ResourceCheckout({ org, resources, checkouts, sessions, staff, authUserId, onChanged }) {
  const [showNewCheckout, setShowNewCheckout] = useState(false)
  const [form, setForm] = useState({ resource_id: '', checked_out_to: '', session_id: '', quantity: 1, expected_return_at: '', notes: '' })
  const [returning, setReturning] = useState(null)
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnNotes, setReturnNotes] = useState('')

  const checkoutable = resources.filter(r => r.allows_checkout && !r.archived_at)
  const active = checkouts.filter(c => c.status === 'checked_out' || c.status === 'overdue')
  const dueToday = active.filter(c => c.expected_return_at && new Date(c.expected_return_at).toDateString() === new Date().toDateString())
  const overdue = active.filter(c => c.expected_return_at && new Date(c.expected_return_at) < new Date())
  const recentReturns = checkouts.filter(c => c.status === 'returned').sort((a, b) => new Date(b.returned_at) - new Date(a.returned_at)).slice(0, 5)

  const handleCheckOut = async () => {
    if (!form.resource_id || !form.checked_out_to) return
    const resource = resources.find(r => r.id === form.resource_id)
    await supabase.from('resource_checkouts').insert({
      org_id: org.id, resource_id: form.resource_id, checked_out_to: form.checked_out_to, checked_out_by: authUserId,
      quantity: Number(form.quantity) || 1, expected_return_at: form.expected_return_at || null, notes: form.notes || null,
    })
    await supabase.from('resources').update({ quantity_available: Math.max(0, resource.quantity_available - (Number(form.quantity) || 1)), status: 'checked_out' }).eq('id', form.resource_id)
    await supabase.from('resource_stock_movements').insert({ org_id: org.id, resource_id: form.resource_id, movement_type: 'checked_out', quantity: -(Number(form.quantity) || 1), previous_quantity: resource.quantity_available, new_quantity: resource.quantity_available - (Number(form.quantity) || 1), performed_by: authUserId })
    setShowNewCheckout(false)
    setForm({ resource_id: '', checked_out_to: '', session_id: '', quantity: 1, expected_return_at: '', notes: '' })
    onChanged()
  }

  const handleReturn = async (checkout, markDamaged, markMissing) => {
    const resource = resources.find(r => r.id === checkout.resource_id)
    const status = markMissing ? 'missing' : markDamaged ? 'damaged' : 'returned'
    await supabase.from('resource_checkouts').update({ status, returned_at: new Date().toISOString(), return_condition: returnCondition, notes: returnNotes || checkout.notes }).eq('id', checkout.id)
    if (!markMissing) {
      await supabase.from('resources').update({ quantity_available: Math.min(resource.quantity_total, resource.quantity_available + checkout.quantity), status: 'available' }).eq('id', checkout.resource_id)
    }
    if (resource) {
      await supabase.from('resource_stock_movements').insert({ org_id: org.id, resource_id: checkout.resource_id, movement_type: markMissing ? 'lost' : markDamaged ? 'damaged' : 'returned', quantity: markMissing ? 0 : checkout.quantity, previous_quantity: resource.quantity_available, new_quantity: markMissing ? resource.quantity_available : resource.quantity_available + checkout.quantity, performed_by: authUserId })
    }
    setReturning(null); setReturnCondition('good'); setReturnNotes('')
    onChanged()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatChip label="Currently checked out" value={active.length} color="#7C3AED" />
        <StatChip label="Due back today" value={dueToday.length} color="#2563EB" />
        <StatChip label="Overdue" value={overdue.length} color="#DC2626" />
        <StatChip label="Recently returned" value={recentReturns.length} color="#16A34A" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Check-in / Check-out</div>
          <button onClick={() => setShowNewCheckout(x => !x)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ New Check-out</button>
        </div>

        {showNewCheckout && (
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select style={sel} value={form.resource_id} onChange={e => setForm({ ...form, resource_id: e.target.value })}>
                <option value="">Search resource / asset code...</option>
                {checkoutable.map(r => <option key={r.id} value={r.id}>{r.name} ({r.quantity_available} available)</option>)}
              </select>
              <select style={sel} value={form.checked_out_to} onChange={e => setForm({ ...form, checked_out_to: e.target.value })}>
                <option value="">Select borrower...</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select style={sel} value={form.session_id} onChange={e => setForm({ ...form, session_id: e.target.value })}>
                <option value="">Link to session...</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <input type="number" min="1" style={sel} placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              <input type="datetime-local" style={sel} value={form.expected_return_at} onChange={e => setForm({ ...form, expected_return_at: e.target.value })} />
            </div>
            <textarea style={{ ...sel, minHeight: 44, resize: 'vertical', width: '100%', marginBottom: 10 }} placeholder="Notes (condition, etc.)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Signature capture isn't available in this version — use notes to record who signed for it if needed.</div>
            <button onClick={handleCheckOut} disabled={!form.resource_id || !form.checked_out_to} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: (!form.resource_id || !form.checked_out_to) ? '#D1D5DB' : '#7C3AED', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: (!form.resource_id || !form.checked_out_to) ? 'not-allowed' : 'pointer' }}>Confirm Check-out</button>
          </div>
        )}

        {active.length === 0 ? (
          <ResourceEmptyState icon="↗" title="Nothing checked out" description="Equipment currently on loan will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(c => {
              const resource = resources.find(r => r.id === c.resource_id)
              const borrower = staff.find(s => s.id === c.checked_out_to)
              const isOverdue = c.expected_return_at && new Date(c.expected_return_at) < new Date()
              return (
                <div key={c.id} style={{ border: `1px solid ${isOverdue ? '#FECACA' : '#E5E7EB'}`, background: isOverdue ? '#FEF2F2' : '#fff', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{resource?.name} <span style={{ fontWeight: 500, color: '#6B7280' }}>× {c.quantity}</span></div>
                      <div style={{ fontSize: 11.5, color: '#6B7280' }}>
                        To {borrower?.full_name || 'Unknown'} · out since {fmtDate(c.checked_out_at)}
                        {c.expected_return_at && ` · due ${fmtDate(c.expected_return_at)} ${fmtTime(c.expected_return_at)}`}
                        {isOverdue && <span style={{ color: '#DC2626', fontWeight: 700 }}> · OVERDUE</span>}
                      </div>
                    </div>
                    <button onClick={() => setReturning(returning === c.id ? null : c.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Return</button>
                  </div>
                  {returning === c.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                      <select style={{ ...sel, marginBottom: 8 }} value={returnCondition} onChange={e => setReturnCondition(e.target.value)}>
                        <option value="good">Good condition</option>
                        <option value="minor_wear">Minor wear</option>
                        <option value="damaged">Damaged</option>
                      </select>
                      <textarea style={{ ...sel, minHeight: 40, resize: 'vertical', width: '100%', marginBottom: 8 }} placeholder="Return notes..." value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', marginBottom: 8 }}>Photo evidence upload isn't available in this version — use notes to describe any damage.</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleReturn(c, false, false)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Mark Returned</button>
                        <button onClick={() => handleReturn(c, true, false)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Mark Damaged</button>
                        <button onClick={() => handleReturn(c, false, true)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Mark Missing</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

const sel = { padding: '9px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12.5, background: '#fff' }

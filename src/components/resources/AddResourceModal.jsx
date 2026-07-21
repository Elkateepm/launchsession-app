import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../lib/resourceHelpers'

const inp = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13.5, fontFamily: 'inherit' }
const label = { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }
const field = { marginBottom: 14 }

function Toggle({ checked, onChange, label: text }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
      <div onClick={() => onChange(!checked)} style={{ width: 38, height: 22, borderRadius: 99, background: checked ? '#7C3AED' : '#E5E7EB', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 19 : 3, transition: 'left 0.15s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{text}</span>
    </label>
  )
}

export default function AddResourceModal({ org, staff, venues, existingResource, onClose, onSaved }) {
  const r = existingResource
  const activeVenues = (venues || []).filter(v => v.is_active)
  const [form, setForm] = useState({
    name: r?.name || '', category: r?.category || 'room', description: r?.description || '', location: r?.location || '',
    venue_id: r?.venue_id || null,
    quantity_total: r?.quantity_total ?? 1, capacity: r?.capacity || '', reference_number: r?.reference_number || '',
    requires_approval: r?.requires_approval || false, allows_checkout: r?.allows_checkout || false,
    booking_limit_minutes: r?.booking_limit_minutes || '', buffer_minutes: r?.buffer_minutes || 0,
    responsible_user_id: r?.responsible_user_id || '', maintenance_interval_days: r?.maintenance_interval_days || '',
    low_stock_threshold: r?.low_stock_threshold || '', notes: r?.notes || '',
    metadata: r?.metadata || {},
  })
  const [useCustomLocation, setUseCustomLocation] = useState((!r?.venue_id && !!r?.location) || activeVenues.length === 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setMeta = (key, value) => setForm(f => ({ ...f, metadata: { ...f.metadata, [key]: value } }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Resource name is required.'); return }
    setSaving(true); setError('')
    const payload = {
      org_id: org.id, name: form.name.trim(), category: form.category, description: form.description || null,
      location: form.location || null, venue_id: form.venue_id || null, quantity_total: Number(form.quantity_total) || 1,
      quantity_available: r ? r.quantity_available : (Number(form.quantity_total) || 1),
      capacity: form.capacity ? Number(form.capacity) : null, reference_number: form.reference_number || null,
      requires_approval: form.requires_approval, allows_checkout: form.allows_checkout,
      booking_limit_minutes: form.booking_limit_minutes ? Number(form.booking_limit_minutes) : null,
      buffer_minutes: Number(form.buffer_minutes) || 0,
      responsible_user_id: form.responsible_user_id || null,
      maintenance_interval_days: form.maintenance_interval_days ? Number(form.maintenance_interval_days) : null,
      low_stock_threshold: form.low_stock_threshold ? Number(form.low_stock_threshold) : null,
      notes: form.notes || null, metadata: form.metadata,
    }
    const { error } = r
      ? await supabase.from('resources').update(payload).eq('id', r.id)
      : await supabase.from('resources').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 460, maxWidth: '100%', height: '100%', background: '#fff', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{r ? 'Edit Resource' : 'Add Resource'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
        </div>

        {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>{error}</div>}

        <div style={field}>
          <label style={label}>Resource name *</label>
          <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Minibus 1" />
        </div>

        <div style={field}>
          <label style={label}>Category</label>
          <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        <div style={field}>
          <label style={label}>Description</label>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Location</label>
            {activeVenues.length > 0 && !useCustomLocation ? (
              <>
                <select style={inp} value={form.venue_id || ''} onChange={e => {
                  const v = activeVenues.find(x => x.id === e.target.value)
                  setForm(f => ({ ...f, venue_id: e.target.value || null, location: v ? v.name : '' }))
                }}>
                  <option value="">— Select a venue —</option>
                  {activeVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button type="button" onClick={() => { setUseCustomLocation(true); setForm(f => ({ ...f, venue_id: null })) }}
                  style={{ background: 'none', border: 'none', padding: '5px 0 0', fontSize: 11, fontWeight: 700, color: '#7C3AED', cursor: 'pointer' }}>
                  Use a one-off location instead
                </button>
              </>
            ) : (
              <>
                <input style={inp} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Depot" />
                {activeVenues.length > 0 && (
                  <button type="button" onClick={() => setUseCustomLocation(false)}
                    style={{ background: 'none', border: 'none', padding: '5px 0 0', fontSize: 11, fontWeight: 700, color: '#7C3AED', cursor: 'pointer' }}>
                    Choose a saved venue instead
                  </button>
                )}
              </>
            )}
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Reference / asset no.</label>
            <input style={inp} value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>{form.category === 'equipment' || form.category === 'sports_equipment' || form.category === 'technology' ? 'Total quantity' : 'Quantity'}</label>
            <input type="number" min="1" style={inp} value={form.quantity_total} onChange={e => setForm({ ...form, quantity_total: e.target.value })} />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Capacity</label>
            <input type="number" style={inp} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. seats/people" />
          </div>
        </div>

        {/* Category-specific fields, stored in metadata */}
        {form.category === 'vehicle' && (
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Vehicle details</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <input style={inp} placeholder="Registration" value={form.metadata.registration || ''} onChange={e => setMeta('registration', e.target.value)} />
              <input style={inp} placeholder="Seats" type="number" value={form.metadata.seats || ''} onChange={e => setMeta('seats', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: '#6B7280', marginBottom: 4 }}>MOT date</div><input type="date" style={inp} value={form.metadata.mot_date || ''} onChange={e => setMeta('mot_date', e.target.value)} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: '#6B7280', marginBottom: 4 }}>Insurance expiry</div><input type="date" style={inp} value={form.metadata.insurance_expiry || ''} onChange={e => setMeta('insurance_expiry', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={inp} placeholder="Mileage" type="number" value={form.metadata.mileage || ''} onChange={e => setMeta('mileage', e.target.value)} />
              <input style={inp} placeholder="Driver requirements" value={form.metadata.driver_requirements || ''} onChange={e => setMeta('driver_requirements', e.target.value)} />
            </div>
          </div>
        )}

        {form.category === 'room' && (
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Room details</div>
            <input style={{ ...inp, marginBottom: 10 }} placeholder="Accessibility notes" value={form.metadata.accessibility || ''} onChange={e => setMeta('accessibility', e.target.value)} />
            <input style={{ ...inp, marginBottom: 10 }} placeholder="Facilities (e.g. projector, kitchen)" value={form.metadata.facilities || ''} onChange={e => setMeta('facilities', e.target.value)} />
            <input style={inp} placeholder="Opening times" value={form.metadata.opening_times || ''} onChange={e => setMeta('opening_times', e.target.value)} />
          </div>
        )}

        {(form.category === 'equipment' || form.category === 'sports_equipment' || form.category === 'technology') && (
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Equipment details</div>
            <select style={{ ...inp, marginBottom: 10 }} value={form.metadata.booking_mode || 'bulk'} onChange={e => setMeta('booking_mode', e.target.value)}>
              <option value="bulk">Bulk booking (by quantity)</option>
              <option value="individual">Individual item booking</option>
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={inp} placeholder="Condition" value={form.metadata.condition || ''} onChange={e => setMeta('condition', e.target.value)} />
              <input style={inp} placeholder="Replacement cost (£)" type="number" value={form.metadata.replacement_cost || ''} onChange={e => setMeta('replacement_cost', e.target.value)} />
            </div>
          </div>
        )}

        <div style={field}>
          <label style={label}>Responsible staff member</label>
          <select style={inp} value={form.responsible_user_id} onChange={e => setForm({ ...form, responsible_user_id: e.target.value })}>
            <option value="">— None —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>

        <Toggle checked={form.requires_approval} onChange={v => setForm({ ...form, requires_approval: v })} label="Requires approval before booking" />
        <Toggle checked={form.allows_checkout} onChange={v => setForm({ ...form, allows_checkout: v })} label="Can be checked out (physical item)" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Booking limit (mins)</label>
            <input type="number" style={inp} value={form.booking_limit_minutes} onChange={e => setForm({ ...form, booking_limit_minutes: e.target.value })} placeholder="No limit" />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Buffer between bookings (mins)</label>
            <input type="number" style={inp} value={form.buffer_minutes} onChange={e => setForm({ ...form, buffer_minutes: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Maintenance interval (days)</label>
            <input type="number" style={inp} value={form.maintenance_interval_days} onChange={e => setForm({ ...form, maintenance_interval_days: e.target.value })} />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label style={label}>Low stock threshold</label>
            <input type="number" style={inp} value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} placeholder="e.g. 5" />
          </div>
        </div>

        <div style={field}>
          <label style={label}>Notes</label>
          <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', marginTop: 8 }}>
          {saving ? 'Saving...' : r ? 'Save Changes' : 'Add Resource'}
        </button>
      </div>
    </div>
  )
}

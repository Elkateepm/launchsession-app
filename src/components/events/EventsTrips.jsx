import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'

const STATUS_CONFIG = {
  planning:   { label: 'Planning',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  confirmed:  { label: 'Confirmed',  color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
  live:       { label: 'Live',       color: '#16A34A', bg: 'rgba(22,163,74,0.1)'   },
  completed:  { label: 'Completed',  color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  cancelled:  { label: 'Cancelled',  color: '#DC2626', bg: 'rgba(220,38,38,0.1)'   },
}

const TYPE_CONFIG = {
  trip:        { label: 'Trip',          icon: '🚌' },
  sports:      { label: 'Sports Event',  icon: '⚽' },
  residential: { label: 'Residential',   icon: '🏕️' },
  theatre:     { label: 'Theatre',       icon: '🎭' },
  workshop:    { label: 'Workshop',      icon: '🎨' },
  competition: { label: 'Competition',   icon: '🏆' },
  other:       { label: 'Other',         icon: '🎟️' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planning
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
      {cfg.label}
    </span>
  )
}

// ── EVENT DETAIL ──────────────────────────────────────────────
function EventDetail({ event, org, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [participants, setParticipants] = useState([])
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...event })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const primary = org?.primary_color || '#1B9AAA'

  const typeCfg = TYPE_CONFIG[event.event_type] || TYPE_CONFIG.other

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: parts }, { data: kids }] = await Promise.all([
        supabase.from('event_participants').select('*, child:children(id,first_name,last_name,date_of_birth,allergies,medical_notes,emergency_contact_name,emergency_contact_phone)').eq('event_id', event.id),
        supabase.from('children').select('id,first_name,last_name,date_of_birth,allergies,medical_notes').eq('org_id', org.id).order('first_name'),
      ])
      setParticipants(parts || [])
      setChildren(kids || [])
      setLoading(false)
    }
    load()
  }, [event.id, org.id])

  const addParticipant = async (childId) => {
    const already = participants.find(p => p.child_id === childId)
    if (already) return
    const { data } = await supabase.from('event_participants').insert({ event_id: event.id, child_id: childId, org_id: org.id, status: 'attending', consent_given: false }).select('*, child:children(id,first_name,last_name,date_of_birth,allergies,medical_notes,emergency_contact_name,emergency_contact_phone)').single()
    if (data) setParticipants(p => [...p, data])
  }

  const removeParticipant = async (partId) => {
    await supabase.from('event_participants').delete().eq('id', partId)
    setParticipants(p => p.filter(x => x.id !== partId))
  }

  const toggleConsent = async (part) => {
    const newVal = !part.consent_given
    await supabase.from('event_participants').update({ consent_given: newVal }).eq('id', part.id)
    setParticipants(p => p.map(x => x.id === part.id ? { ...x, consent_given: newVal } : x))
  }

  const toggleSignedIn = async (part) => {
    const newStatus = part.status === 'signed_in' ? 'attending' : 'signed_in'
    await supabase.from('event_participants').update({ status: newStatus, signed_in_at: newStatus === 'signed_in' ? new Date().toISOString() : null }).eq('id', part.id)
    setParticipants(p => p.map(x => x.id === part.id ? { ...x, status: newStatus } : x))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    const { data, error } = await supabase.from('events').update(editForm).eq('id', event.id).select().single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    if (data) { onUpdate(data); setEditing(false) }
  }

  const updateStatus = async (status) => {
    const { data } = await supabase.from('events').update({ status }).eq('id', event.id).select().single()
    if (data) onUpdate(data)
  }

  const consentRate = participants.length > 0 ? Math.round(participants.filter(p => p.consent_given).length / participants.length * 100) : 0
  const signedIn = participants.filter(p => p.status === 'signed_in').length
  const alerts = participants.filter(p => p.child?.allergies || p.child?.medical_notes)

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', fontFamily: 'inherit' }

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        ← Back to Events
      </button>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}, ${primary}99)`, borderRadius: 20, padding: '24px 28px', marginBottom: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{typeCfg.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{event.title}</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{typeCfg.label} · {event.location || 'No location set'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, opacity: 0.9 }}>
              {event.event_date && <span>📅 {format(parseISO(event.event_date), 'd MMM yyyy')}</span>}
              {event.departure_time && <span>🕐 Departs {event.departure_time}</span>}
              {event.return_time && <span>🏠 Returns {event.return_time}</span>}
              {event.max_participants && <span>👥 Max {event.max_participants}</span>}
              {event.cost_per_person && <span>💷 £{event.cost_per_person}/person</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <StatusBadge status={event.status} />
            <button onClick={() => setEditing(!editing)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {editing ? '✕ Cancel' : '✏️ Edit'}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 20 }}>
          {[
            { label: 'Participants', value: participants.length, icon: '👥' },
            { label: 'Consent', value: `${consentRate}%`, icon: '✅' },
            { label: 'Signed In', value: signedIn, icon: '✓' },
            { label: 'Medical Alerts', value: alerts.length, icon: '⚠️' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{s.value}</div>
              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Edit Event</div>
          {saveError && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              ⚠️ {saveError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Title</label><input value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Location</label><input value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date</label><input type="date" value={editForm.event_date || ''} onChange={e => setEditForm(f => ({ ...f, event_date: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Max Participants</label><input type="number" value={editForm.max_participants || ''} onChange={e => setEditForm(f => ({ ...f, max_participants: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Departure Time</label><input type="time" value={editForm.departure_time || ''} onChange={e => setEditForm(f => ({ ...f, departure_time: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Return Time</label><input type="time" value={editForm.return_time || ''} onChange={e => setEditForm(f => ({ ...f, return_time: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Cost Per Person (£)</label><input type="number" step="0.01" value={editForm.cost_per_person || ''} onChange={e => setEditForm(f => ({ ...f, cost_per_person: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Status</label>
              <select value={editForm.status || 'planning'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Notes / Risk Assessment</label><textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, resize: 'none' }} /></div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            <button onClick={() => setEditing(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Status actions */}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).filter(([k]) => k !== event.status).map(([k, v]) => (
            <button key={k} onClick={() => updateStatus(k)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${v.color}40`, background: v.bg, color: v.color, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              → Mark {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {[['overview','📋 Overview'],['participants','👥 Participants'],['alerts','⚠️ Medical Alerts']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ padding: '10px 18px', border: 'none', borderBottom: `2.5px solid ${activeTab === key ? primary : 'transparent'}`, background: 'transparent', color: activeTab === key ? primary : '#6B7280', fontWeight: activeTab === key ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Event Details</div>
            {[
              { label: 'Date', value: event.event_date ? format(parseISO(event.event_date), 'EEEE d MMMM yyyy') : '—' },
              { label: 'Location', value: event.location || '—' },
              { label: 'Departure', value: event.departure_time || '—' },
              { label: 'Return', value: event.return_time || '—' },
              { label: 'Cost per person', value: event.cost_per_person ? `£${event.cost_per_person}` : 'Free' },
              { label: 'Max participants', value: event.max_participants || 'No limit' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>{f.label}</span>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Notes & Risk Assessment</div>
            <div style={{ fontSize: 13, color: event.notes ? '#374151' : '#9CA3AF', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {event.notes || 'No notes added yet. Click Edit to add risk assessment notes.'}
            </div>
          </div>
        </div>
      )}

      {/* Participants tab */}
      {activeTab === 'participants' && (
        <div>
          {/* Add participant */}
          <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Add Participant</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {children.filter(c => !participants.find(p => p.child_id === c.id)).map(c => (
                <button key={c.id} onClick={() => addParticipant(c.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${primary}40`, background: primary + '10', color: primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  + {c.first_name} {c.last_name}
                </button>
              ))}
              {children.filter(c => !participants.find(p => p.child_id === c.id)).length === 0 && (
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>All children added</span>
              )}
            </div>
          </div>

          {/* Participant list */}
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
          ) : participants.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No participants yet</div>
              <div style={{ fontSize: 13 }}>Add children from the list above</div>
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 40px', gap: 8, padding: '10px 16px', background: '#F9FAFB', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <div>Name</div><div>Consent</div><div>Status</div><div>Alerts</div><div></div>
              </div>
              {participants.map((part, i) => {
                const child = part.child || {}
                const hasAlerts = child.allergies || child.medical_notes
                return (
                  <div key={part.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 40px', gap: 8, padding: '12px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{child.first_name} {child.last_name}</div>
                    <button onClick={() => toggleConsent(part)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${part.consent_given ? '#16A34A40' : '#e5e7eb'}`, background: part.consent_given ? '#F0FDF4' : '#fff', color: part.consent_given ? '#16A34A' : '#9CA3AF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {part.consent_given ? '✓ Yes' : 'No'}
                    </button>
                    <button onClick={() => toggleSignedIn(part)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${part.status === 'signed_in' ? primary + '40' : '#e5e7eb'}`, background: part.status === 'signed_in' ? primary + '12' : '#fff', color: part.status === 'signed_in' ? primary : '#9CA3AF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {part.status === 'signed_in' ? '✓ In' : 'Out'}
                    </button>
                    <div>
                      {hasAlerts && <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>⚠️</span>}
                    </div>
                    <button onClick={() => removeParticipant(part.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Medical Alerts tab */}
      {activeTab === 'alerts' && (
        <div>
          {alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#F0FDF4', borderRadius: 14, color: '#15803D' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 700 }}>No medical alerts</div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>All participants are clear</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alerts.map(part => {
                const child = part.child || {}
                return (
                  <div key={part.id} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>⚠️ {child.first_name} {child.last_name}</div>
                    {child.allergies && <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 700, color: '#92400E' }}>Allergies: </span>{child.allergies}</div>}
                    {child.medical_notes && <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 700, color: '#92400E' }}>Medical: </span>{child.medical_notes}</div>}
                    {child.emergency_contact_name && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                        📞 Emergency: {child.emergency_contact_name} {child.emergency_contact_phone ? `· ${child.emergency_contact_phone}` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CREATE EVENT MODAL ────────────────────────────────────────
function CreateEventModal({ org, onClose, onCreate }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [form, setForm] = useState({
    title: '', event_type: 'trip', event_date: '', location: '',
    departure_time: '', return_time: '', max_participants: '',
    cost_per_person: '', notes: '', status: 'planning',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', fontFamily: 'inherit' }

  const handleCreate = async () => {
    if (!form.title || !form.event_date) return
    setSaving(true)
    setError('')
    const cleanForm = {
      ...form,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      cost_per_person: form.cost_per_person ? parseFloat(form.cost_per_person) : null,
    }
    const { data, error: err } = await supabase.from('events').insert({ ...cleanForm, org_id: org.id }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { onCreate(data); onClose() }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>New Event or Trip</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>EVENT TITLE *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Football Trip to Wembley" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>TYPE</label>
              <select value={form.event_type} onChange={e => set('event_type', e.target.value)} style={inp}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>DATE *</label>
              <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>LOCATION</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Wembley Stadium, London" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>DEPARTURE TIME</label>
              <input type="time" value={form.departure_time} onChange={e => set('departure_time', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>RETURN TIME</label>
              <input type="time" value={form.return_time} onChange={e => set('return_time', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>MAX PARTICIPANTS</label>
              <input type="number" value={form.max_participants} onChange={e => set('max_participants', e.target.value)} placeholder="e.g. 30" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>COST PER PERSON (£)</label>
              <input type="number" step="0.01" value={form.cost_per_person} onChange={e => set('cost_per_person', e.target.value)} placeholder="0 = free" style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 5 }}>NOTES / RISK ASSESSMENT</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Risk assessment, special instructions..." style={{ ...inp, resize: 'none' }} />
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={saving || !form.title || !form.event_date} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: saving || !form.title || !form.event_date ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              {saving ? 'Creating...' : '🎟️ Create Event'}
            </button>
            <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────
export default function EventsTrips({ org }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('events').select('*, event_participants(count)').eq('org_id', org.id).order('event_date', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const filtered = events.filter(e => filterStatus === 'all' || e.status === filterStatus)

  const upcoming = events.filter(e => e.event_date && new Date(e.event_date) >= new Date() && e.status !== 'cancelled' && e.status !== 'completed').length
  const totalParticipants = events.reduce((s, e) => s + (e.event_participants?.[0]?.count || 0), 0)

  if (selectedEvent) return (
    <EventDetail
      event={selectedEvent}
      org={org}
      onBack={() => setSelectedEvent(null)}
      onUpdate={(updated) => {
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
        setSelectedEvent(updated)
      }}
    />
  )

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>🎟️ Events & Trips</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{upcoming} upcoming · {totalParticipants} participants across all events</div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            + New Event
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Total Events', value: events.length },
            { label: 'Upcoming', value: upcoming, color: '#2563EB' },
            { label: 'Live Now', value: events.filter(e => e.status === 'live').length, color: '#16A34A' },
            { label: 'Participants', value: totalParticipants },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color || '#111' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${filterStatus === s ? primary : '#e5e7eb'}`, background: filterStatus === s ? primary + '12' : '#fff', color: filterStatus === s ? primary : '#6B7280', fontSize: 12, fontWeight: filterStatus === s ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s === 'all' ? `All (${events.length})` : `${STATUS_CONFIG[s].label} (${events.filter(e => e.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading events...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎟️</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{filterStatus === 'all' ? 'No events yet' : `No ${STATUS_CONFIG[filterStatus]?.label} events`}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Plan your first trip or event for your young people</div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Create First Event</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(event => {
            const typeCfg = TYPE_CONFIG[event.event_type] || TYPE_CONFIG.other
            const participantCount = event.event_participants?.[0]?.count || 0
            const isPast = event.event_date && new Date(event.event_date) < new Date()
            return (
              <div key={event.id} onClick={() => setSelectedEvent(event)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.boxShadow = `0 4px 16px ${primary}20` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {typeCfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#9CA3AF' }}>
                    {event.event_date && <span>📅 {format(parseISO(event.event_date), 'd MMM yyyy')}</span>}
                    {event.location && <span>📍 {event.location}</span>}
                    {event.departure_time && <span>🕐 {event.departure_time}</span>}
                    <span>👥 {participantCount} {event.max_participants ? `/ ${event.max_participants}` : ''}</span>
                    {event.cost_per_person > 0 && <span>💷 £{event.cost_per_person}/person</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <StatusBadge status={event.status} />
                  {isPast && event.status !== 'completed' && event.status !== 'cancelled' && (
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>Past date</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateEventModal org={org} onClose={() => setShowCreate(false)} onCreate={e => { setEvents(prev => [...prev, e].sort((a, b) => new Date(a.event_date) - new Date(b.event_date))); }} />}
    </div>
  )
}

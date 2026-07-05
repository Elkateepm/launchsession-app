import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Badge, Avatar, statusStyle, daysUntil, PURPLE } from './vh_shared'

const TRAINING_TYPES = [
  { key: 'dbs', label: 'DBS', icon: '🛡️' },
  { key: 'safeguarding', label: 'Safeguarding', icon: '❤️' },
  { key: 'first_aid', label: 'First Aid', icon: '⛑️' },
  { key: 'manual_handling', label: 'Manual Handling', icon: '📦' },
  { key: 'food_hygiene', label: 'Food Hygiene', icon: '🍽️' },
  { key: 'driving', label: 'Driving Check', icon: '🚗' },
  { key: 'insurance', label: 'Insurance', icon: '📄' },
]

function statusFromExpiry(expiry) {
  const d = daysUntil(expiry)
  if (d === null) return 'expired'
  if (d < 0) return 'expired'
  if (d <= 30) return 'expiring'
  return 'complete'
}

export default function VolunteersTraining({ org, volunteers, training, onDataChange }) {
  const primary = org?.primary_color || PURPLE
  const [activeType, setActiveType] = useState('dbs')
  const [editingFor, setEditingFor] = useState(null)
  const [expiryInput, setExpiryInput] = useState('')
  const [saving, setSaving] = useState(false)

  function recordFor(volunteerId, type) {
    if (type === 'dbs') {
      const v = volunteers.find(x => x.id === volunteerId)
      return v?.dbs_expiry ? { expiry_date: v.dbs_expiry, status: statusFromExpiry(v.dbs_expiry) } : null
    }
    return training.find(t => t.volunteer_id === volunteerId && t.training_type === type) || null
  }

  async function saveExpiry(volunteerId, type) {
    if (!expiryInput) return
    setSaving(true)
    const status = statusFromExpiry(expiryInput)
    if (type === 'dbs') {
      await supabase.from('user_profiles').update({ dbs_expiry: expiryInput }).eq('id', volunteerId)
    } else {
      await supabase.from('volunteer_training').upsert({
        org_id: org.id, volunteer_id: volunteerId, training_type: type, expiry_date: expiryInput, status,
      }, { onConflict: 'volunteer_id,training_type' })
    }
    setSaving(false)
    setEditingFor(null)
    setExpiryInput('')
    onDataChange?.()
  }

  const counts = TRAINING_TYPES.reduce((acc, t) => {
    acc[t.key] = volunteers.reduce((n, v) => {
      const rec = recordFor(v.id, t.key)
      return n + (rec && statusFromExpiry(rec.expiry_date) !== 'complete' ? 1 : 0)
    }, 0)
    return acc
  }, {})

  return (
    <div>
      <SectionTitle icon="🎓" title="Training & Compliance" subtitle="Track certifications and renewals across your volunteer team" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TRAINING_TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)} style={{
            padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            background: activeType === t.key ? primary : '#fff', color: activeType === t.key ? '#fff' : '#475569',
            boxShadow: activeType === t.key ? 'none' : '0 1px 3px rgba(15,23,42,0.08)',
          }}>
            {t.icon} {t.label}
            {counts[t.key] > 0 && <span style={{ background: activeType === t.key ? 'rgba(255,255,255,0.3)' : 'rgba(245,158,11,0.15)', color: activeType === t.key ? '#fff' : '#B45309', borderRadius: 99, padding: '1px 6px', fontSize: 10 }}>{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
          {volunteers.length} volunteer{volunteers.length !== 1 ? 's' : ''}
        </div>
        {volunteers.map((v, i) => {
          const rec = recordFor(v.id, activeType)
          const status = rec ? statusFromExpiry(rec.expiry_date) : 'expired'
          const st = statusStyle(status)
          const isEditing = editingFor === v.id
          return (
            <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < volunteers.length - 1 ? '1px solid #F1F5F9' : 'none', flexWrap: 'wrap' }}>
              <Avatar name={v.full_name} photoUrl={v.photo_url} size={32} color={primary} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.full_name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{rec?.expiry_date ? `Expires ${new Date(rec.expiry_date).toLocaleDateString('en-GB')}` : 'No record on file'}</div>
              </div>
              <Badge bg={st.bg} color={st.color}>{st.label}</Badge>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={expiryInput} onChange={e => setExpiryInput(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 12 }} />
                  <button onClick={() => saveExpiry(v.id, activeType)} disabled={saving} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>{saving ? '...' : 'Save'}</button>
                </div>
              ) : (
                <button onClick={() => { setEditingFor(v.id); setExpiryInput(rec?.expiry_date || '') }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#0F172A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  {rec?.expiry_date ? 'Update' : 'Request Renewal'}
                </button>
              )}
            </motion.div>
          )
        })}
      </Card>
    </div>
  )
}

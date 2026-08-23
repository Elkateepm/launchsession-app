import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Card, SectionTitle, Avatar, PURPLE } from './vh_shared'
import Icon from '../../lib/icons'

const STAGES = [
  { key: 'new', label: 'New', color: '#6366F1' },
  { key: 'reviewing', label: 'Reviewing', color: '#F59E0B' },
  { key: 'interview', label: 'Interview', color: '#8B5CF6' },
  { key: 'accepted', label: 'Accepted', color: '#22C55E' },
  { key: 'rejected', label: 'Rejected', color: '#EF4444' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#94A3B8' },
]

export default function VolunteersApplications({ org, applicants, onDataChange, publicApplications = [], onApprovePublic, onRejectPublic }) {
  const primary = org?.primary_color || PURPLE
  const [dragId, setDragId] = useState(null)

  async function moveTo(id, stage) {
    const update = { application_status: stage }
    if (stage === 'accepted') update.status = 'active'
    if (stage === 'rejected') update.status = 'rejected'
    if (stage === 'withdrawn') update.status = 'rejected'
    await supabase.from('user_profiles').update(update).eq('id', id)
    onDataChange?.()
  }

  return (
    <div>
      {publicApplications.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle icon="📱" title="New Sign-Ups" subtitle={`${publicApplications.length} waiting from your volunteer QR code / link`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {publicApplications.map(a => (
              <Card key={a.id} style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar name={`${a.first_name} ${a.last_name || ''}`} size={36} color={primary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{a.first_name} {a.last_name}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>{[a.phone, a.email].filter(Boolean).join(' · ') || 'No contact provided'}</div>
                    {(a.skills || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {a.skills.map(s => (
                          <span key={s} style={{ fontSize: 10, fontWeight: 700, color: primary, background: `${primary}12`, borderRadius: 6, padding: '2px 7px' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {(a.availability || []).length > 0 && (
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>Available: {a.availability.join(', ')}</div>
                    )}
                    {a.dbs_number && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>DBS: {a.dbs_number}{a.dbs_expiry ? ` (expires ${new Date(a.dbs_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}</div>}
                    {a.notes && <div style={{ fontSize: 11.5, color: '#475569', marginTop: 6, fontStyle: 'italic' }}>"{a.notes}"</div>}
                    <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 6 }}>Applied {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onApprovePublic?.(a)} style={{ fontSize: 11.5, fontWeight: 800, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.12)', color: '#15803D', cursor: 'pointer', whiteSpace: 'nowrap' }}><Icon name="✓" /> Approve & Invite</button>
                    <button onClick={() => onRejectPublic?.(a.id)} style={{ fontSize: 11.5, fontWeight: 800, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#B91C1C', cursor: 'pointer' }}>Decline</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <SectionTitle icon="📮" title="Applications" subtitle={`${applicants.length} applicant${applicants.length !== 1 ? 's' : ''} in the pipeline`} />
      {applicants.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📮</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>No applications yet</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>New volunteer sign-ups from your portal will land here.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.map(stage => {
            const items = applicants.filter(a => (a.application_status || 'new') === stage.key)
            return (
              <div key={stage.key}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) moveTo(dragId, stage.key); setDragId(null) }}
                style={{ minWidth: 240, flex: '0 0 240px', background: 'rgba(255,255,255,0.55)', borderRadius: 18, padding: 12, border: '1px solid rgba(15,23,42,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: stage.color }}>{stage.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', background: '#F1F5F9', borderRadius: 99, padding: '1px 8px' }}>{items.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                  {items.map(a => (
                    <motion.div key={a.id} layout draggable onDragStart={() => setDragId(a.id)}
                      whileHover={{ y: -2 }} style={{ background: '#fff', borderRadius: 14, padding: 12, boxShadow: '0 2px 10px rgba(15,23,42,0.06)', cursor: 'grab' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Avatar name={a.full_name} photoUrl={a.photo_url} size={30} color={primary} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{a.full_name || '—'}</div>
                          <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                        </div>
                      </div>
                      {(a.experience || []).length > 0 && (
                        <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 8 }}>{a.experience.slice(0, 2).join(', ')}</div>
                      )}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {stage.key !== 'accepted' && stage.key !== 'rejected' && (
                          <button onClick={() => moveTo(a.id, 'accepted')} style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 7, border: 'none', background: 'rgba(34,197,94,0.12)', color: '#15803D', cursor: 'pointer' }}>Accept</button>
                        )}
                        {stage.key !== 'rejected' && stage.key !== 'accepted' && (
                          <button onClick={() => moveTo(a.id, 'rejected')} style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#B91C1C', cursor: 'pointer' }}>Reject</button>
                        )}
                        {stage.key === 'new' && (
                          <button onClick={() => moveTo(a.id, 'reviewing')} style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 7, border: 'none', background: '#F1F5F9', color: '#475569', cursor: 'pointer' }}>Review <Icon name="→" /></button>
                        )}
                        {stage.key === 'reviewing' && (
                          <button onClick={() => moveTo(a.id, 'interview')} style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 7, border: 'none', background: '#F1F5F9', color: '#475569', cursor: 'pointer' }}>Interview <Icon name="→" /></button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

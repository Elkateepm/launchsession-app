import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

// The two things staff need while an activity is actually running: a way to
// record that conditions changed, and fast access to emergency information.
//
// Everything here is designed for someone standing in a car park holding a
// phone, not someone at a desk. Large targets, no nested navigation, and the
// emergency screen shows only what is useful in the next sixty seconds.

const OUTCOMES = [
  { key: 'safe_to_continue', label: 'Safe to continue', dot: '#12B76A', bg: '#E7F8ED', text: '#04713C' },
  { key: 'activity_modified', label: 'Activity modified', dot: '#F79009', bg: '#FEF6E7', text: '#93500A' },
  { key: 'activity_stopped', label: 'Activity stopped', dot: '#E5484D', bg: '#FEF2F2', text: '#B42318' },
]

const OUTCOME_BY_KEY = Object.fromEntries(OUTCOMES.map(o => [o.key, o]))

const field = {
  width: '100%', padding: '12px 13px', borderRadius: 11, fontSize: 15,
  border: '1px solid #ECE9F5', background: '#fff', color: '#1C1B2E',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Records a change in conditions during a live session. */
export function DynamicUpdateDrawer({ open, onClose, assessment, org, authSession, sessionId, onSaved }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'

  const [description, setDescription] = useState('')
  const [action, setAction] = useState('')
  const [outcome, setOutcome] = useState('safe_to_continue')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) { setDescription(''); setAction(''); setOutcome('safe_to_continue'); setError(null) }
  }, [open])

  async function save() {
    if (!description.trim()) return
    setSaving(true); setError(null)
    const { error: e } = await supabase.from('risk_dynamic_updates').insert({
      org_id: org.id,
      assessment_id: assessment?.id || null,
      session_id: sessionId || null,
      description: description.trim(),
      action_taken: action.trim() || null,
      outcome,
      created_by: authSession?.user?.id || null,
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved?.()
    onClose?.()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
            padding: isMobile ? 0 : 16,
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { scale: 0.97, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: '100%' } : { scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{
              background: '#fff', width: isMobile ? '100%' : 460, maxWidth: '100%',
              borderRadius: isMobile ? '20px 20px 0 0' : 18,
              maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #ECE9F5', flexShrink: 0 }}>
              {isMobile && <div style={{ width: 38, height: 4, borderRadius: 4, background: '#E4DFF5', margin: '0 auto 12px' }} />}
              <div style={{ fontSize: 16.5, fontWeight: 800, color: '#1C1B2E' }}>Dynamic risk update</div>
              <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 3 }}>
                Record a change in conditions and what you did about it.
              </div>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#8B87A3', marginBottom: 7 }}>
                WHAT CHANGED?
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. Heavy rain started and the pitch became waterlogged"
                style={{ ...field, resize: 'vertical', minHeight: 74 }}
                autoFocus
              />

              <div style={{ height: 16 }} />
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#8B87A3', marginBottom: 7 }}>
                WHAT DID YOU DO?
              </label>
              <textarea
                value={action}
                onChange={e => setAction(e.target.value)}
                rows={3}
                placeholder="e.g. Moved the session indoors to the sports hall"
                style={{ ...field, resize: 'vertical', minHeight: 74 }}
              />

              <div style={{ height: 16 }} />
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#8B87A3', marginBottom: 7 }}>
                OUTCOME
              </label>
              <div style={{ display: 'grid', gap: 7 }}>
                {OUTCOMES.map(o => {
                  const active = outcome === o.key
                  return (
                    <button
                      key={o.key}
                      onClick={() => setOutcome(o.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        padding: '13px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${active ? o.dot : '#ECE9F5'}`,
                        background: active ? o.bg : '#fff',
                      }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 9, background: o.dot, flexShrink: 0 }} />
                      <span style={{
                        fontSize: 14.5, fontWeight: 700,
                        color: active ? o.text : '#1C1B2E',
                      }}>{o.label}</span>
                    </button>
                  )
                })}
              </div>

              {error && (
                <div style={{
                  marginTop: 14, padding: '11px 13px', borderRadius: 10, background: '#FEF2F2',
                  border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
                }}>{error}</div>
              )}
            </div>

            <div style={{
              padding: '14px 20px', borderTop: '1px solid #ECE9F5', display: 'flex', gap: 10,
              paddingBottom: isMobile ? 'calc(14px + env(safe-area-inset-bottom))' : 14,
            }}>
              <button onClick={onClose} style={{
                padding: '13px 18px', borderRadius: 12, border: '1px solid #ECE9F5',
                background: '#fff', color: '#8B87A3', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button
                onClick={save}
                disabled={saving || !description.trim()}
                style={{
                  flex: 1, padding: '13px 18px', borderRadius: 12, border: 'none',
                  background: saving || !description.trim() ? '#E4DFF5' : primary,
                  color: '#fff', fontSize: 15, fontWeight: 800,
                  cursor: saving || !description.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >{saving ? 'Recording…' : 'Record update'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Permanent history of dynamic updates on an assessment. */
export function DynamicUpdateList({ assessment, org, staff = [], refreshKey }) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!assessment?.id) return
    setLoading(true)
    const { data } = await supabase.from('risk_dynamic_updates')
      .select('*').eq('assessment_id', assessment.id)
      .order('created_at', { ascending: false }).limit(50)
    setUpdates(data || [])
    setLoading(false)
  }, [assessment?.id])

  useEffect(() => { load() }, [load, refreshKey])

  const nameOf = id => staff.find(s => s.id === id)?.full_name || 'Staff member'

  if (loading) return <div style={{ padding: 20, color: '#8B87A3', fontSize: 13.5 }}>Loading…</div>

  if (!updates.length) {
    return (
      <div style={{
        padding: '22px 18px', borderRadius: 14, border: '1px solid #ECE9F5',
        background: '#fff', textAlign: 'center',
      }}>
        <div style={{ fontSize: 13.5, color: '#8B87A3', lineHeight: 1.5 }}>
          No dynamic updates recorded. These are added during a session when conditions change.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {updates.map(u => {
        const o = OUTCOME_BY_KEY[u.outcome] || OUTCOMES[0]
        return (
          <div key={u.id} style={{
            border: '1px solid #ECE9F5', borderRadius: 14, padding: 14, background: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                background: o.bg, color: o.text,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: o.dot }} />
                {o.label}
              </span>
              <span style={{ fontSize: 12, color: '#8B87A3', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {fmtDate(u.created_at)} · {fmtTime(u.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#1C1B2E', lineHeight: 1.5 }}>{u.description}</div>
            {u.action_taken && (
              <div style={{
                marginTop: 8, paddingLeft: 11, borderLeft: '2px solid #E4DFF5',
                fontSize: 13.5, color: '#5A5772', lineHeight: 1.5,
              }}>{u.action_taken}</div>
            )}
            <div style={{ fontSize: 11.5, color: '#B4B0C6', marginTop: 9 }}>
              Recorded by {nameOf(u.created_by)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Full-screen emergency information. Deliberately sparse: on a phone, in an
 * incident, anything that isn't immediately actionable is noise.
 */
export function EmergencyView({ open, onClose, assessment, org, venue }) {
  const isMobile = useIsMobile()
  if (!open) return null

  const rows = [
    ['Meeting point', assessment?.meeting_point],
    ['Nearest hospital', assessment?.nearest_hospital],
    ['First aid equipment', assessment?.first_aid_equipment],
    ['Defibrillator', assessment?.defibrillator_location],
    ['Evacuation plan', assessment?.evacuation_plan],
    ['Missing child procedure', assessment?.missing_child_procedure],
    ['Safeguarding escalation', assessment?.safeguarding_escalation],
    ['Emergency procedures', assessment?.emergency_procedures],
  ].filter(([, v]) => v && String(v).trim())

  // Phone numbers written into the contacts field are made tappable: retyping a
  // number from a screen while dealing with an incident is exactly the friction
  // this view exists to remove.
  const contacts = (assessment?.emergency_contacts || '').split('\n').filter(l => l.trim())

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1400, background: '#fff',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        position: 'sticky', top: 0, background: '#B42318', color: '#fff',
        padding: isMobile ? '16px 18px' : '18px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Emergency information</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
            {assessment?.name}{venue?.name ? ` · ${venue.name}` : assessment?.location ? ` · ${assessment.location}` : ''}
          </div>
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
          borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Close</button>
      </div>

      <div style={{ padding: isMobile ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
        <a
          href="tel:999"
          style={{
            display: 'block', textAlign: 'center', padding: '16px', borderRadius: 14,
            background: '#B42318', color: '#fff', fontSize: 17, fontWeight: 800,
            textDecoration: 'none', marginBottom: 16,
          }}
        >Call 999</a>

        {contacts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8B87A3', marginBottom: 8, letterSpacing: 0.3 }}>
              EMERGENCY CONTACTS
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {contacts.map((line, i) => {
                const phone = (line.match(/(\+?\d[\d\s()-]{7,})/) || [])[1]
                return (
                  <div key={i} style={{
                    border: '1px solid #ECE9F5', borderRadius: 12, padding: '13px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 14.5, color: '#1C1B2E', flex: 1, minWidth: 0 }}>{line}</span>
                    {phone && (
                      <a href={`tel:${phone.replace(/\s/g, '')}`} style={{
                        padding: '8px 14px', borderRadius: 9, background: '#12B76A',
                        color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}>Call</a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {rows.length === 0 && contacts.length === 0 && (
          <div style={{
            padding: '24px 18px', borderRadius: 14, border: '1px solid #ECE9F5',
            textAlign: 'center', color: '#8B87A3', fontSize: 13.5, lineHeight: 1.55,
          }}>
            No emergency information has been added to this assessment yet.
            Add it under Emergency so it's here when it's needed.
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{
              border: '1px solid #ECE9F5', borderRadius: 12, padding: '14px 15px',
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8B87A3', letterSpacing: 0.3, marginBottom: 5 }}>
                {label.toUpperCase()}
              </div>
              <div style={{ fontSize: 14.5, color: '#1C1B2E', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ACTIVITY_ICON, timeAgo } from './ra_shared'
import { safetyStateOf, SAFETY_META, isArchived } from './ra_safety'

// Reuse for recurring activities.
//
// Most sessions are the same session again: the same venue, the same hazards,
// the same controls. Retyping all of it is how risk assessments end up either
// skipped or copied carelessly. Reuse copies the whole thing -- hazards and
// controls included -- as a NEW record, so the historic assessment stays exactly
// as it was when the earlier session ran. That matters: an assessment is
// evidence of what was considered on a particular day, and editing it in place
// destroys that.

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 14 }

export default function ReuseAssessmentDrawer({
  open, onClose, org, authSession, session, onCreated,
}) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!open || !org?.id) return
    setLoading(true); setError(null)

    const { data } = await supabase.from('risk_assessments')
      .select('*').eq('org_id', org.id).eq('is_template', false)
      .order('updated_at', { ascending: false }).limit(40)

    const usable = (data || []).filter(a => !isArchived(a))

    // Rank by how likely this is the same activity happening again: matching
    // title first, then activity type, then venue.
    const title = (session?.title || '').toLowerCase()
    const scored = usable.map(a => {
      let score = 0
      const name = (a.name || '').toLowerCase()
      if (title && (name.includes(title) || title.includes(name.replace(/ risk assessment$/, '')))) score += 3
      if (session?.session_type && a.activity_type === session.session_type) score += 2
      if (session?.location && a.location === session.location) score += 1
      return { ...a, _score: score }
    })

    scored.sort((a, b) => b._score - a._score || (b.updated_at || '').localeCompare(a.updated_at || ''))
    setCandidates(scored.slice(0, 8))
    setLoading(false)
  }, [open, org?.id, session])

  useEffect(() => { load() }, [load])

  async function reuse(source) {
    setBusyId(source.id); setError(null)
    // There is no transaction across REST calls, so failure is handled by
    // undoing the copy: a half-built assessment sitting in the library looking
    // complete is worse than none at all, and the cascade removes its hazards
    // and controls with it.
    let createdId = null
    try {
      // Copy the record, not a reference to it. Approval and review dates are
      // deliberately NOT carried across: the new assessment has not been
      // reviewed, and inheriting a sign-off would be a false record.
      const { data: fresh, error: e1 } = await supabase.from('risk_assessments').insert({
        org_id: org.id,
        name: session?.title ? `${session.title} Risk Assessment` : `${source.name} (copy)`,
        activity_type: source.activity_type,
        location: session?.location || source.location,
        venue_id: source.venue_id,
        summary: source.summary,
        status: 'draft',
        risk_score: source.risk_score,
        risk_rating: source.risk_rating,
        emergency_contacts: source.emergency_contacts,
        meeting_point: source.meeting_point,
        nearest_hospital: source.nearest_hospital,
        first_aid_equipment: source.first_aid_equipment,
        defibrillator_location: source.defibrillator_location,
        emergency_procedures: source.emergency_procedures,
        evacuation_plan: source.evacuation_plan,
        missing_child_procedure: source.missing_child_procedure,
        safeguarding_escalation: source.safeguarding_escalation,
        weather_contingency: source.weather_contingency,
        created_by: authSession?.user?.id || null,
        owner_id: authSession?.user?.id || null,
        template_source_id: source.id,
        version: 1,
      }).select().single()
      if (e1) throw e1
      createdId = fresh.id

      const { data: hazards } = await supabase.from('risk_assessment_hazards')
        .select('*').eq('assessment_id', source.id).order('sort_order')

      if (hazards?.length) {
        const { data: newHazards, error: e2 } = await supabase.from('risk_assessment_hazards').insert(
          hazards.map((h, i) => ({
            assessment_id: fresh.id, org_id: org.id,
            hazard: h.hazard, who_at_risk: h.who_at_risk,
            likelihood: h.likelihood, severity: h.severity,
            residual_likelihood: h.residual_likelihood, residual_severity: h.residual_severity,
            control_measures: h.control_measures, owner: h.owner,
            // Not h.status: the copied controls are reset to not-in-place, so
            // carrying 'controlled' across would contradict them and show as
            // reassurance in the grid and the PDF export.
            status: 'open', sort_order: i,
          }))
        ).select()
        if (e2) throw e2

        // Controls come across as not-yet-in-place. They were in place for the
        // earlier session; whether they are in place for this one is precisely
        // what the person reusing this needs to confirm.
        const oldIds = hazards.map(h => h.id)
        const { data: controls, error: e3 } = await supabase.from('risk_controls')
          .select('*').in('hazard_id', oldIds)
        if (e3) throw e3

        if (controls?.length && newHazards?.length) {
          const idMap = {}
          hazards.forEach((h, i) => { idMap[h.id] = newHazards[i]?.id })
          const rows = controls
            .filter(c => idMap[c.hazard_id])
            .map(c => ({
              org_id: org.id,
              hazard_id: idMap[c.hazard_id],
              description: c.description,
              responsible_user_id: c.responsible_user_id,
              completed: false,
              sort_order: c.sort_order,
            }))
          if (rows.length) {
            const { error: e4 } = await supabase.from('risk_controls').insert(rows)
            if (e4) throw e4
          }
        }
      }

      if (session?.id) {
        const { error: e5 } = await supabase.from('risk_assessment_sessions')
          .insert({ assessment_id: fresh.id, session_id: session.id, org_id: org.id })
        if (e5) throw e5
      }

      const { error: eAudit } = await supabase.from('risk_assessment_audit').insert({
        assessment_id: fresh.id, org_id: org.id, action: 'created',
        detail: `Reused from "${source.name}" — controls reset for re-checking`,
        actor_id: authSession?.user?.id || null,
      })
      // The assessment itself is sound, so a missing audit row is not worth
      // discarding the copy over.
      if (eAudit) console.warn('Reuse audit entry failed:', eAudit.message)

      onCreated?.(fresh)
      onClose?.()
    } catch (e) {
      if (createdId) {
        // Best effort. If this also fails the user sees the error and a draft
        // they can delete, rather than silence.
        await supabase.from('risk_assessments').delete().eq('id', createdId)
      }
      setError(e.message || 'Could not reuse that assessment. Nothing was saved.')
    } finally {
      setBusyId(null)
    }
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
              background: '#fff', width: isMobile ? '100%' : 540, maxWidth: '100%',
              borderRadius: isMobile ? '20px 20px 0 0' : 18,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #ECE9F5', flexShrink: 0 }}>
              {isMobile && <div style={{ width: 38, height: 4, borderRadius: 4, background: '#E4DFF5', margin: '0 auto 12px' }} />}
              <div style={{ fontSize: 16.5, fontWeight: 800, color: '#1C1B2E' }}>Use a previous assessment</div>
              <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 3, lineHeight: 1.5 }}>
                Copies the hazards and controls into a new assessment. The original is left untouched.
              </div>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {loading && <div style={{ color: '#8B87A3', fontSize: 13.5, textAlign: 'center', padding: 20 }}>Looking…</div>}

              {!loading && !candidates.length && (
                <div style={{ color: '#8B87A3', fontSize: 13.5, textAlign: 'center', padding: 20, lineHeight: 1.55 }}>
                  There aren't any previous assessments to reuse yet.
                </div>
              )}

              <div style={{ display: 'grid', gap: 9 }}>
                {candidates.map(a => {
                  const meta = SAFETY_META[safetyStateOf(a)]
                  return (
                    <div key={a.id} style={{ ...CARD, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 17 }}>{ACTIVITY_ICON[a.activity_type] || '📋'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 800, color: '#1C1B2E',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: '#8B87A3', marginTop: 2 }}>
                            {a.location || a.activity_type || '—'} · updated {timeAgo(a.updated_at || a.created_at)}
                          </div>
                        </div>
                        <span style={{
                          width: 8, height: 8, borderRadius: 8, background: meta.dot, flexShrink: 0,
                        }} />
                      </div>
                      <button
                        onClick={() => reuse(a)}
                        disabled={!!busyId}
                        style={{
                          width: '100%', padding: '9px 14px', borderRadius: 10, border: 'none',
                          background: busyId === a.id ? '#E4DFF5' : primary, color: '#fff',
                          fontSize: 13, fontWeight: 700,
                          cursor: busyId ? 'wait' : 'pointer', fontFamily: 'inherit',
                        }}
                      >{busyId === a.id ? 'Copying…' : 'Reuse & review'}</button>
                    </div>
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
              padding: '14px 20px', borderTop: '1px solid #ECE9F5',
              paddingBottom: isMobile ? 'calc(14px + env(safe-area-inset-bottom))' : 14,
            }}>
              <button onClick={onClose} style={{
                width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #ECE9F5',
                background: '#fff', color: '#8B87A3', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { btnPrimary, btnGhost } from '../volunteers/vh_shared'
import { riskScore, riskRating, RatingBadge, RiskMatrix, LIKELIHOOD_LABELS, SEVERITY_LABELS } from './ra_shared'

export default function RAHazards({ assessment, org, session: authSession, onHazardsChanged }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [hazards, setHazards] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('risk_assessment_hazards').select('*').eq('assessment_id', assessment.id).order('sort_order').order('created_at')
    setHazards(data || [])
    setLoading(false)
  }, [assessment.id])

  useEffect(() => { load() }, [load])

  const recalcAssessment = useCallback(async (list) => {
    const top = list.reduce((m, h) => Math.max(m, riskScore(h.likelihood, h.severity)), 0)
    await supabase.from('risk_assessments').update({ risk_score: top, risk_rating: riskRating(top), updated_at: new Date().toISOString() }).eq('id', assessment.id)
    if (onHazardsChanged) onHazardsChanged(top, riskRating(top))
  }, [assessment.id, onHazardsChanged])

  const addHazard = async () => {
    const { data } = await supabase.from('risk_assessment_hazards').insert({
      assessment_id: assessment.id, org_id: org.id, hazard: '', who_at_risk: '',
      likelihood: 2, severity: 2, residual_likelihood: 1, residual_severity: 2, sort_order: hazards.length,
    }).select().single()
    if (data) { const next = [...hazards, data]; setHazards(next); setExpanded(data.id); recalcAssessment(next) }
  }

  // debounced field save
  const saveField = (id, patch) => {
    setHazards(hz => {
      const next = hz.map(h => h.id === id ? { ...h, ...patch } : h)
      recalcAssessment(next)
      return next
    })
    clearTimeout(saveField._t?.[id])
    saveField._t = saveField._t || {}
    saveField._t[id] = setTimeout(() => { supabase.from('risk_assessment_hazards').update(patch).eq('id', id) }, 500)
  }

  const deleteHazard = async (id) => {
    const next = hazards.filter(h => h.id !== id)
    setHazards(next)
    await supabase.from('risk_assessment_hazards').delete().eq('id', id)
    recalcAssessment(next)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const scale = (val, onChange) => (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: val === n ? primary : '#F1F5F9', color: val === n ? '#fff' : '#64748B' }}>{n}</button>
      ))}
    </div>
  )

  if (loading) return <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading hazards…</div>

  return (
    <div>
      {/* Live matrix summary */}
      <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <RiskMatrix hazards={hazards} compact />
      </div>

      {hazards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: 13 }}>No hazards recorded yet. Add the first one below.</div>
      ) : (
        <AnimatePresence initial={false}>
          {hazards.map((h, idx) => {
            const score = riskScore(h.likelihood, h.severity)
            const rating = riskRating(score)
            const rScore = riskScore(h.residual_likelihood, h.residual_severity)
            const isOpen = expanded === h.id
            return (
              <motion.div key={h.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                style={{ border: '1.5px solid rgba(15,23,42,0.08)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', background: '#fff' }}>
                <div onClick={() => setExpanded(isOpen ? null : h.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', width: 18 }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: h.hazard ? '#0F172A' : '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.hazard || 'Untitled hazard'}</div>
                    {h.who_at_risk && <div style={{ fontSize: 11.5, color: '#94A3B8' }}>At risk: {h.who_at_risk}</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748B' }}>{score}</span>
                  <RatingBadge rating={rating} size="sm" />
                  <span style={{ fontSize: 14, color: '#CBD5E1' }}>{isOpen ? '▾' : '▸'}</span>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Hazard</label>
                          <input style={inp} value={h.hazard || ''} onChange={e => saveField(h.id, { hazard: e.target.value })} placeholder="e.g. Slips, trips and falls on wet flooring" />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Who is at risk</label>
                          <input style={inp} value={h.who_at_risk || ''} onChange={e => saveField(h.id, { who_at_risk: e.target.value })} placeholder="e.g. Young people, staff, volunteers" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Likelihood ({LIKELIHOOD_LABELS[h.likelihood - 1]})</label>
                            {scale(h.likelihood, v => saveField(h.id, { likelihood: v }))}
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Severity ({SEVERITY_LABELS[h.severity - 1]})</label>
                            {scale(h.severity, v => saveField(h.id, { severity: v }))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Control measures</label>
                          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={h.control_measures || ''} onChange={e => saveField(h.id, { control_measures: e.target.value })} placeholder="What's in place to reduce this risk?" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Residual likelihood</label>
                            {scale(h.residual_likelihood, v => saveField(h.id, { residual_likelihood: v }))}
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Residual severity</label>
                            {scale(h.residual_severity, v => saveField(h.id, { residual_severity: v }))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>Residual risk: {rScore}</span>
                          <RatingBadge rating={riskRating(rScore)} size="sm" />
                          <input style={{ ...inp, width: 140 }} value={h.owner || ''} onChange={e => saveField(h.id, { owner: e.target.value })} placeholder="Owner" />
                          <div style={{ flex: 1 }} />
                          <button onClick={() => deleteHazard(h.id)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12, color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)' }}>Delete</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}
      <button onClick={addHazard} style={btnPrimary(primary)}>+ Add Hazard</button>
    </div>
  )
}

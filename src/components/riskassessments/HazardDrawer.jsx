import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { riskScore, riskRating, LIKELIHOOD_LABELS, SEVERITY_LABELS } from './ra_shared'

// Guided hazard entry.
//
// The old flow dropped an empty row into a spreadsheet-style grid and expected
// the user to know what belonged in each cell. Charity staff are not health and
// safety professionals; the questions are asked one at a time, in plain
// English, and the risk scores are calculated rather than typed.

const HAZARD_SUGGESTIONS = [
  { label: 'Transport', icon: '🚌' },
  { label: 'Road crossings', icon: '🚶' },
  { label: 'Water', icon: '🌊' },
  { label: 'Weather', icon: '🌧' },
  { label: 'Medical', icon: '🚑' },
  { label: 'Behaviour', icon: '⚠️' },
  { label: 'Missing child', icon: '🔍' },
  { label: 'Equipment', icon: '🛠' },
  { label: 'Fire', icon: '🔥' },
  { label: 'Venue', icon: '🏛' },
  { label: 'Food / allergies', icon: '🥪' },
  { label: 'Manual handling', icon: '📦' },
]

const WHO_OPTIONS = [
  'Young people', 'Staff', 'Volunteers', 'Members of public', 'Specific participants',
]

const STEPS = ['What', 'Who', 'Risk', 'Controls', 'After controls']

const field = {
  width: '100%', padding: '11px 13px', borderRadius: 11, fontSize: 15,
  border: '1px solid #ECE9F5', background: '#fff', color: '#1C1B2E',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#8B87A3', marginBottom: 7, letterSpacing: 0.2 }

function ScorePicker({ value, onChange, labels, primary }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const active = value === n
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              padding: '10px 3px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${active ? 'transparent' : '#ECE9F5'}`,
              background: active ? primary : '#fff',
              color: active ? '#fff' : '#5A5772',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 9.5, marginTop: 3, opacity: 0.85, lineHeight: 1.2 }}>{labels[n - 1]}</div>
          </button>
        )
      })}
    </div>
  )
}

function ScoreReadout({ likelihood, severity, caption }) {
  const score = riskScore(likelihood, severity)
  const rating = riskRating(score)
  const tone = {
    low: { bg: '#E7F8ED', text: '#04713C' },
    medium: { bg: '#FEF6E7', text: '#93500A' },
    high: { bg: '#FEF0E7', text: '#B54708' },
    critical: { bg: '#FEF2F2', text: '#B42318' },
  }[rating] || { bg: '#F3F2F7', text: '#5A5772' }

  return (
    <div style={{
      marginTop: 12, padding: '12px 14px', borderRadius: 12,
      background: tone.bg, color: tone.text,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{caption}</span>
      <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>
        {score} · {rating.charAt(0).toUpperCase() + rating.slice(1)}
      </span>
    </div>
  )
}

export default function HazardDrawer({ open, onClose, assessment, org, authSession, hazard, onSaved }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'
  const editing = !!hazard

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [who, setWho] = useState([])
  const [likelihood, setLikelihood] = useState(3)
  const [severity, setSeverity] = useState(3)
  const [controls, setControls] = useState([{ description: '', due_date: '', completed: false }])
  const [resLikelihood, setResLikelihood] = useState(1)
  const [resSeverity, setResSeverity] = useState(3)

  useEffect(() => {
    if (!open) return
    setStep(0); setError(null)
    if (hazard) {
      setName(hazard.hazard || '')
      setWho((hazard.who_at_risk || '').split(',').map(w => w.trim()).filter(Boolean))
      setLikelihood(hazard.likelihood || 3)
      setSeverity(hazard.severity || 3)
      setResLikelihood(hazard.residual_likelihood || 1)
      setResSeverity(hazard.residual_severity || 3)
      supabase.from('risk_controls').select('*').eq('hazard_id', hazard.id).order('sort_order')
        .then(({ data }) => {
          setControls(data?.length
            ? data.map(c => ({ ...c, due_date: c.due_date || '' }))
            // Controls used to be one free-text blob on the hazard. Carry it
            // across as a single row rather than losing what was written.
            : [{ description: hazard.control_measures || '', due_date: '', completed: false }])
        })
    } else {
      setName(''); setWho(['Young people']); setLikelihood(3); setSeverity(3)
      setControls([{ description: '', due_date: '', completed: false }])
      setResLikelihood(1); setResSeverity(3)
    }
  }, [open, hazard])

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return who.length > 0
    if (step === 3) return controls.some(c => c.description.trim())
    return true
  }

  const toggleWho = w => setWho(list => list.includes(w) ? list.filter(x => x !== w) : [...list, w])

  const setControl = (i, patch) =>
    setControls(list => list.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  async function save() {
    setSaving(true); setError(null)
    try {
      const cleanControls = controls.filter(c => c.description.trim())
      const payload = {
        assessment_id: assessment.id,
        org_id: org.id,
        hazard: name.trim(),
        who_at_risk: who.join(', '),
        likelihood, severity,
        residual_likelihood: resLikelihood,
        residual_severity: resSeverity,
        // Kept in sync so the existing grid view and PDF export, which still
        // read this column, don't show a hazard with no controls at all.
        control_measures: cleanControls.map(c => c.description.trim()).join('\n'),
        status: cleanControls.length && cleanControls.every(c => c.completed !== false || !c.due_date)
          ? 'controlled' : 'open',
      }

      let hazardId = hazard?.id
      if (editing) {
        const { error: e } = await supabase.from('risk_assessment_hazards').update(payload).eq('id', hazard.id)
        if (e) throw e
        await supabase.from('risk_controls').delete().eq('hazard_id', hazard.id)
      } else {
        const { data, error: e } = await supabase.from('risk_assessment_hazards')
          .insert({ ...payload, sort_order: 999 }).select().single()
        if (e) throw e
        hazardId = data.id
      }

      if (cleanControls.length) {
        const { error: ce } = await supabase.from('risk_controls').insert(
          cleanControls.map((c, i) => ({
            org_id: org.id,
            hazard_id: hazardId,
            description: c.description.trim(),
            due_date: c.due_date || null,
            completed: !!c.completed,
            completed_at: c.completed ? new Date().toISOString() : null,
            sort_order: i,
          }))
        )
        if (ce) throw ce
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Could not save this hazard.')
    } finally {
      setSaving(false)
    }
  }

  const panel = {
    background: '#fff',
    width: isMobile ? '100%' : 500,
    maxWidth: '100%',
    height: isMobile ? 'auto' : '100%',
    maxHeight: isMobile ? '92vh' : '100%',
    borderRadius: isMobile ? '20px 20px 0 0' : 0,
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'stretch',
            justifyContent: isMobile ? 'center' : 'flex-end',
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={panel}
          >
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #ECE9F5', flexShrink: 0 }}>
              {isMobile && (
                <div style={{ width: 38, height: 4, borderRadius: 4, background: '#E4DFF5', margin: '0 auto 12px' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 16.5, fontWeight: 800, color: '#1C1B2E', flex: 1 }}>
                  {editing ? 'Edit hazard' : 'Add a hazard'}
                </div>
                <button onClick={onClose} style={{
                  border: 'none', background: 'transparent', fontSize: 22,
                  color: '#8B87A3', cursor: 'pointer', lineHeight: 1, padding: 4,
                }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {STEPS.map((label, i) => (
                  <div key={label} style={{ flex: 1 }}>
                    <div style={{
                      height: 3, borderRadius: 3,
                      background: i <= step ? primary : '#ECE9F5',
                    }} />
                    <div style={{
                      fontSize: 10, marginTop: 5, textAlign: 'center',
                      color: i === step ? '#1C1B2E' : '#B4B0C6',
                      fontWeight: i === step ? 700 : 500,
                    }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>

              {step === 0 && (
                <>
                  <label style={labelStyle}>WHAT COULD CAUSE HARM?</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Road crossing on the walk to the park"
                    style={field}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: '#8B87A3', margin: '14px 0 8px' }}>
                    Common hazards — tap to use one as a starting point
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {HAZARD_SUGGESTIONS.map(h => (
                      <button
                        key={h.label}
                        onClick={() => setName(h.label)}
                        style={{
                          padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                          border: '1px solid #ECE9F5', background: '#fff', color: '#5A5772',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >{h.icon} {h.label}</button>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <label style={labelStyle}>WHO COULD BE AFFECTED?</label>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {WHO_OPTIONS.map(w => {
                      const active = who.includes(w)
                      return (
                        <button
                          key={w}
                          onClick={() => toggleWho(w)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                            padding: '12px 13px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${active ? primary : '#ECE9F5'}`,
                            background: active ? '#F6F3FF' : '#fff',
                          }}
                        >
                          <span style={{
                            width: 19, height: 19, borderRadius: 6, flexShrink: 0,
                            display: 'grid', placeItems: 'center', fontSize: 12, color: '#fff',
                            border: `1.6px solid ${active ? primary : '#E4DFF5'}`,
                            background: active ? primary : '#fff',
                          }}>{active ? '✓' : ''}</span>
                          <span style={{ fontSize: 14, color: '#1C1B2E', fontWeight: 600 }}>{w}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <label style={labelStyle}>HOW LIKELY IS IT, WITH NOTHING IN PLACE?</label>
                  <ScorePicker value={likelihood} onChange={setLikelihood} labels={LIKELIHOOD_LABELS} primary={primary} />
                  <div style={{ height: 18 }} />
                  <label style={labelStyle}>HOW SERIOUS WOULD IT BE?</label>
                  <ScorePicker value={severity} onChange={setSeverity} labels={SEVERITY_LABELS} primary={primary} />
                  <ScoreReadout likelihood={likelihood} severity={severity} caption="Risk before controls" />
                </>
              )}

              {step === 3 && (
                <>
                  <label style={labelStyle}>WHAT WILL YOU DO ABOUT IT?</label>
                  <div style={{ display: 'grid', gap: 9 }}>
                    {controls.map((c, i) => (
                      <div key={i} style={{
                        border: '1px solid #ECE9F5', borderRadius: 12, padding: 12,
                      }}>
                        <textarea
                          value={c.description}
                          onChange={e => setControl(i, { description: e.target.value })}
                          rows={2}
                          placeholder="e.g. Staff positioned at front and rear of the group"
                          style={{ ...field, resize: 'vertical', minHeight: 54, marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setControl(i, { completed: !c.completed })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7,
                              padding: '7px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                              border: `1px solid ${c.completed ? '#12B76A' : '#ECE9F5'}`,
                              background: c.completed ? '#E7F8ED' : '#fff',
                              color: c.completed ? '#04713C' : '#8B87A3',
                              fontSize: 12.5, fontWeight: 700,
                            }}
                          >{c.completed ? '✓ In place' : 'Not yet in place'}</button>

                          {!c.completed && (
                            <input
                              type="date"
                              value={c.due_date}
                              onChange={e => setControl(i, { due_date: e.target.value })}
                              style={{ ...field, width: 'auto', flex: '1 1 140px', padding: '7px 10px', fontSize: 12.5 }}
                            />
                          )}

                          {controls.length > 1 && (
                            <button
                              onClick={() => setControls(list => list.filter((_, idx) => idx !== i))}
                              style={{
                                marginLeft: 'auto', border: 'none', background: 'transparent',
                                color: '#B42318', fontSize: 12.5, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit', padding: '6px 2px',
                              }}
                            >Remove</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setControls(list => [...list, { description: '', due_date: '', completed: false }])}
                    style={{
                      marginTop: 9, padding: '9px 14px', borderRadius: 10,
                      border: '1px dashed #E4DFF5', background: '#fff', color: primary,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >+ Add another control</button>
                </>
              )}

              {step === 4 && (
                <>
                  <div style={{ fontSize: 13, color: '#8B87A3', lineHeight: 1.5, marginBottom: 16 }}>
                    With those controls in place, how likely and how serious is it now?
                  </div>
                  <label style={labelStyle}>LIKELIHOOD AFTER CONTROLS</label>
                  <ScorePicker value={resLikelihood} onChange={setResLikelihood} labels={LIKELIHOOD_LABELS} primary={primary} />
                  <div style={{ height: 18 }} />
                  <label style={labelStyle}>SEVERITY AFTER CONTROLS</label>
                  <ScorePicker value={resSeverity} onChange={setResSeverity} labels={SEVERITY_LABELS} primary={primary} />
                  <ScoreReadout likelihood={resLikelihood} severity={resSeverity} caption="Risk after controls" />

                  {riskScore(resLikelihood, resSeverity) > riskScore(likelihood, severity) && (
                    <div style={{
                      marginTop: 10, padding: '11px 13px', borderRadius: 11,
                      background: '#FEF6E7', border: '1px solid #FDE2B5',
                      fontSize: 12.5, color: '#93500A', lineHeight: 1.5,
                    }}>
                      The risk after controls is higher than before them. That's usually a
                      mistake — check the scores above.
                    </div>
                  )}
                </>
              )}

              {error && (
                <div style={{
                  marginTop: 14, padding: '11px 13px', borderRadius: 10, background: '#FEF2F2',
                  border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
                }}>{error}</div>
              )}
            </div>

            <div style={{
              padding: '14px 20px', borderTop: '1px solid #ECE9F5', flexShrink: 0,
              display: 'flex', gap: 10, background: '#fff',
              paddingBottom: isMobile ? 'calc(14px + env(safe-area-inset-bottom))' : 14,
            }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} style={{
                  padding: '13px 18px', borderRadius: 12, border: '1px solid #ECE9F5',
                  background: '#fff', color: '#8B87A3', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Back</button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canAdvance()}
                  style={{
                    flex: 1, padding: '13px 18px', borderRadius: 12, border: 'none',
                    background: canAdvance() ? primary : '#E4DFF5', color: '#fff',
                    fontSize: 15, fontWeight: 800,
                    cursor: canAdvance() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}
                >Continue</button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '13px 18px', borderRadius: 12, border: 'none',
                    background: saving ? '#E4DFF5' : primary, color: '#fff',
                    fontSize: 15, fontWeight: 800,
                    cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}
                >{saving ? 'Saving…' : editing ? 'Save hazard' : 'Add hazard'}</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

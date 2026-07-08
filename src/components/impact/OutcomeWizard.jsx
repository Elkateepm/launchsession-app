import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { OUTCOME_AREAS, scoreColor, scoreEmoji, scoreLabel } from './impact_shared'

const STEPS = ['Young Person', 'Outcome Area', 'Rate', 'Comments', 'Goal', 'Review']

export default function OutcomeWizard({ org, children, presetChild, onClose, onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    child: presetChild || null,
    area: 'confidence',
    score: 5,
    notes: '',
    addGoal: false,
    goalTitle: '',
    goalTarget: '',
  })

  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const canNext = [!!form.child, !!form.area, true, true, true, true]

  const filteredChildren = (children || []).filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const save = async () => {
    setSaving(true)
    try {
      const { data: scoreRow, error } = await supabase.from('outcome_scores')
        .insert({ org_id: org.id, child_id: form.child.id, area: form.area, score: form.score, notes: form.notes })
        .select().single()
      if (error) throw error

      if (form.addGoal && form.goalTitle.trim()) {
        await supabase.from('goals').insert({
          org_id: org.id, child_id: form.child.id, title: form.goalTitle.trim(),
          area: form.area, target_date: form.goalTarget || null,
        })
      }
      onSaved(scoreRow)
    } catch (e) {
      console.error('Failed to save outcome', e)
      alert('Something went wrong saving that outcome — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const areaObj = OUTCOME_AREAS.find(a => a.key === form.area)
  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 24, width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}
      >
        {/* Header + progress */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>📊 Record Outcome</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? primary : '#F3F4F6', transition: 'background 0.3s' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginTop: 6 }}>STEP {step + 1} OF {STEPS.length} · {STEPS[step].toUpperCase()}</div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

              {step === 0 && (
                <div>
                  {!presetChild && (
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..." style={{ ...inp, marginBottom: 12 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {filteredChildren.map(c => (
                      <div key={c.id} onClick={() => set({ child: c })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${form.child?.id === c.id ? primary : '#F3F4F6'}`, background: form.child?.id === c.id ? primary + '10' : '#fff' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: primary }}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
                        {form.child?.id === c.id && <div style={{ marginLeft: 'auto', color: primary, fontWeight: 900 }}>✓</div>}
                      </div>
                    ))}
                    {filteredChildren.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 13 }}>No young people found</div>}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {OUTCOME_AREAS.map(a => (
                    <div key={a.key} onClick={() => set({ area: a.key })}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${form.area === a.key ? a.color : '#F3F4F6'}`, background: form.area === a.key ? a.color + '12' : '#fff' }}>
                      <span style={{ fontSize: 17 }}>{a.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>{areaObj?.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20 }}>Rate {form.child?.first_name}'s {areaObj?.label}</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor(form.score) }}>{form.score}<span style={{ fontSize: 20, color: '#D1D5DB' }}>/10</span></div>
                  <div style={{ fontSize: 13, color: scoreColor(form.score), fontWeight: 700, marginTop: 4 }}>{scoreEmoji(form.score)} {scoreLabel(form.score)}</div>
                  <input type="range" min={1} max={10} value={form.score} onChange={e => set({ score: Number(e.target.value) })} style={{ width: '100%', marginTop: 24 }} />
                </div>
              )}

              {step === 3 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 6 }}>NOTES (optional)</label>
                  <textarea autoFocus value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="What's contributed to this score? Any specific observations..." rows={5} style={{ ...inp, resize: 'none' }} />
                </div>
              )}

              {step === 4 && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                    <input type="checkbox" checked={form.addGoal} onChange={e => set({ addGoal: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>Set a goal based on this outcome</span>
                  </label>
                  {form.addGoal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input value={form.goalTitle} onChange={e => set({ goalTitle: e.target.value })} placeholder="e.g. Improve confidence in group settings" style={inp} />
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TARGET DATE (optional)</label>
                        <input type="date" value={form.goalTarget} onChange={e => set({ goalTarget: e.target.value })} style={inp} />
                      </div>
                    </div>
                  )}
                  {!form.addGoal && <div style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>You can skip this and add a goal later from their profile</div>}
                </div>
              )}

              {step === 5 && (
                <div>
                  <div style={{ background: '#F9FAFB', borderRadius: 16, padding: 18, border: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: primary }}>
                        {form.child?.first_name?.[0]}{form.child?.last_name?.[0]}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{form.child?.first_name} {form.child?.last_name}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: '#6B7280' }}>{areaObj?.icon} {areaObj?.label}</span>
                      <span style={{ fontWeight: 900, color: scoreColor(form.score) }}>{form.score}/10</span>
                    </div>
                    {form.notes && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid #E5E7EB', paddingTop: 8 }}>{form.notes}</div>}
                    {form.addGoal && form.goalTitle && <div style={{ fontSize: 12.5, color: primary, marginTop: 8, fontWeight: 700 }}>🎯 Goal: {form.goalTitle}</div>}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>← Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button disabled={!canNext[step]} onClick={() => setStep(s => s + 1)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: canNext[step] ? primary : '#E5E7EB', color: '#fff', fontWeight: 800, cursor: canNext[step] ? 'pointer' : 'not-allowed', fontSize: 13 }}>Continue →</button>
          ) : (
            <button disabled={saving} onClick={save} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>{saving ? 'Saving...' : '📊 Save Outcome'}</button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

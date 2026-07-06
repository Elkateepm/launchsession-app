import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { inputStyle, btnPrimary, btnGhost, Avatar } from '../volunteers/vh_shared'
import { CATEGORIES, RISK_LEVELS, RiskBadge } from './cm_shared'

const STEPS = ['Child', 'Category', 'Risk', 'Summary', 'Assign', 'First Action', 'Evidence', 'Review']

export default function CaseCreationWizard({ org, session: authSession, staff, onClose, onCreated }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [childQuery, setChildQuery] = useState('')
  const [childResults, setChildResults] = useState([])
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    child_id: null, child_name: '', category: '', risk_level: 'medium', summary: '',
    assigned_to_user_id: '', requires_dsl: false, next_review_date: '',
    first_action_title: '', first_action_due: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!childQuery.trim() || childQuery.length < 2) { setChildResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('children').select('id, first_name, last_name, date_of_birth, photo_url, group_name')
        .eq('org_id', org.id).eq('active', true)
        .or(`first_name.ilike.%${childQuery}%,last_name.ilike.%${childQuery}%`)
        .order('last_name').limit(8)
      setChildResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [childQuery, org.id])

  const canNext = () => {
    if (step === 0) return !!form.child_name.trim()
    if (step === 1) return !!form.category
    if (step === 3) return !!form.summary.trim()
    return true
  }

  const create = async () => {
    setSaving(true)
    try {
      const payload = {
        org_id: org.id, child_id: form.child_id, child_name: form.child_name,
        category: form.category, case_type: form.category, risk_level: form.risk_level,
        priority: form.risk_level, summary: form.summary,
        assigned_to_user_id: form.assigned_to_user_id || null,
        assigned_to: staff.find(s => s.id === form.assigned_to_user_id)?.full_name || null,
        requires_dsl: form.requires_dsl, next_review_date: form.next_review_date || null,
        status: 'open', created_by: authSession?.user?.id,
      }
      const { data: cas, error } = await supabase.from('cases').insert(payload).select().single()
      if (error) throw error

      await supabase.from('case_events').insert({ case_id: cas.id, org_id: org.id, event_type: 'concern_logged', body: form.summary, created_by: authSession?.user?.id })

      if (form.first_action_title.trim()) {
        await supabase.from('case_tasks').insert({
          case_id: cas.id, org_id: org.id, title: form.first_action_title.trim(),
          due_date: form.first_action_due || null, owner_id: form.assigned_to_user_id || null,
          priority: form.risk_level === 'critical' || form.risk_level === 'high' ? 'high' : 'medium',
          created_by: authSession?.user?.id,
        })
      }

      for (const file of evidenceFiles) {
        const path = `case-evidence/${org.id}/${cas.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('safeguarding-docs').upload(path, file)
        if (!upErr) {
          await supabase.from('case_documents').insert({ case_id: cas.id, org_id: org.id, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size, uploaded_by: authSession?.user?.id })
        }
      }

      await supabase.from('case_audit_log').insert({ case_id: cas.id, org_id: org.id, action: 'created', detail: `Case opened for ${form.child_name}`, actor_id: authSession?.user?.id })

      onCreated(cas)
    } catch (err) {
      alert('Failed to create case: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ y: 20, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 14, scale: 0.97, opacity: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.35)' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>🛡️ Open New Case</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: i <= step ? primary : '#F1F5F9', transition: 'background 0.2s' }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: 700 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
        </div>

        <div style={{ padding: 22, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>

              {step === 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Who is this case about?</div>
                  <input style={inputStyle} placeholder="Search young person by name…" value={childQuery} onChange={e => { setChildQuery(e.target.value); set('child_name', e.target.value); set('child_id', null) }} autoFocus />
                  {childResults.length > 0 && (
                    <div style={{ marginTop: 8, border: '1.5px solid rgba(15,23,42,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      {childResults.map(c => (
                        <div key={c.id} onClick={() => { set('child_id', c.id); set('child_name', `${c.first_name} ${c.last_name}`); setChildQuery(`${c.first_name} ${c.last_name}`); setChildResults([]) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
                          <Avatar name={c.first_name} photoUrl={c.photo_url} size={28} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.group_name || 'No group'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.child_id && <div style={{ marginTop: 8, fontSize: 12, color: '#15803D', fontWeight: 700 }}>✓ Linked to child record</div>}
                  <div style={{ marginTop: 10, fontSize: 11.5, color: '#94A3B8' }}>Searches your active Registers roster. Can't find them? Just type their name — you can link the record later.</div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#0F172A' }}>What category best fits this concern?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => set('category', c)}
                        style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${form.category === c ? primary : 'rgba(15,23,42,0.1)'}`, background: form.category === c ? `${primary}14` : '#fff', color: form.category === c ? primary : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#0F172A' }}>How urgent is this?</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {RISK_LEVELS.map(r => (
                      <button key={r} onClick={() => set('risk_level', r)}
                        style={{ padding: '14px 10px', borderRadius: 14, border: `2px solid ${form.risk_level === r ? primary : 'rgba(15,23,42,0.08)'}`, background: form.risk_level === r ? `${primary}0c` : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                        <RiskBadge level={r} />
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                          {r === 'low' && 'Monitor, no immediate action'}
                          {r === 'medium' && 'Needs attention this week'}
                          {r === 'high' && 'Requires review within 24 hours'}
                          {r === 'critical' && 'Immediate safeguarding response'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.requires_dsl} onChange={e => set('requires_dsl', e.target.checked)} style={{ width: 15, height: 15 }} />
                    Requires DSL (Designated Safeguarding Lead) sign-off
                  </label>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Summarise the concern</div>
                  <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} placeholder="What happened, when, who was involved…" value={form.summary} onChange={e => set('summary', e.target.value)} autoFocus />
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Next review date (optional)</label>
                    <input type="date" style={inputStyle} value={form.next_review_date} onChange={e => set('next_review_date', e.target.value)} />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#0F172A' }}>Assign to a staff member</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {staff.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: `1.5px solid ${form.assigned_to_user_id === s.id ? primary : 'rgba(15,23,42,0.08)'}`, background: form.assigned_to_user_id === s.id ? `${primary}0c` : '#fff', cursor: 'pointer' }}>
                        <input type="radio" name="assignee" checked={form.assigned_to_user_id === s.id} onChange={() => set('assigned_to_user_id', s.id)} style={{ width: 15, height: 15 }} />
                        <Avatar name={s.full_name} photoUrl={s.photo_url} size={26} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.full_name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Create a first action (optional)</div>
                  <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="e.g. Contact parent, speak with school…" value={form.first_action_title} onChange={e => set('first_action_title', e.target.value)} />
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Due date</label>
                  <input type="date" style={inputStyle} value={form.first_action_due} onChange={e => set('first_action_due', e.target.value)} />
                </div>
              )}

              {step === 6 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Upload any evidence (optional)</div>
                  <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed rgba(15,23,42,0.15)', borderRadius: 14, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', background: '#F8FAFC' }}>
                    <div style={{ fontSize: 22 }}>📎</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Click to select files</div>
                    <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => setEvidenceFiles(f => [...f, ...Array.from(e.target.files || [])])} />
                  </div>
                  {evidenceFiles.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {evidenceFiles.map((f, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: '#334155', padding: '4px 0' }}>📄 {f.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 7 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>Review & create</div>
                  {[
                    ['Young person', form.child_name || '—'],
                    ['Category', form.category || '—'],
                    ['Summary', form.summary || '—'],
                    ['Assigned to', staff.find(s => s.id === form.assigned_to_user_id)?.full_name || 'Unassigned'],
                    ['First action', form.first_action_title || 'None'],
                    ['Evidence', `${evidenceFiles.length} file(s)`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>{label}</span>
                      <span style={{ fontSize: 12.5, color: '#0F172A', fontWeight: 600, textAlign: 'right', maxWidth: 300 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>Risk level</span>
                    <RiskBadge level={form.risk_level} />
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={btnGhost}>← Back</button>}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={btnPrimary(primary)}>Continue →</button>
          ) : (
            <button onClick={create} disabled={saving} style={btnPrimary(primary)}>{saving ? 'Creating…' : '✓ Create Case'}</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

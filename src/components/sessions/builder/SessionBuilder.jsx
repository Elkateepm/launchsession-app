import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import {
  normalisePlan, toStored, withTimes, fit, equipmentList, outcomesCovered, kindOf, newBlock,
  moveBlock, duplicateBlock, removeBlock, scaffold, blocksFromHtml, planToHtml, KINDS,
} from '../../../lib/sessionPlan'
import { areaByKey } from '../../impact/impact_shared'
import BlockFields, { toneOf } from './BlockFields'
import ActivityLibrary, { saveToLibrary } from './ActivityLibrary'
import RunningOrder from './RunningOrder'
import { printPlan } from './printPlan'
import Icon from '../../../lib/icons'

// The session builder: the session's running order, block by block.
//
//  - Build: add activities (blank, from the library, from a plan template, or
//    a starting shape sized to the session), edit them in place, reorder,
//    and see at a glance whether the plan fills the time.
//  - Run it: the same plan as a live running order for the day.
//  - Print, or save the plan as a template (admins).
//
// Saved to sessions.plan, so it follows the session's own permissions.

const btn = { minHeight: 44, padding: '0 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, whiteSpace: 'nowrap' }
const solid = { ...btn, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)' }
const ghost = { ...btn, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }

function FitBar({ blocks, result }) {
  const span = Math.max(result.length || 0, result.total, 1)
  return (
    <div>
      <div aria-hidden="true" style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        {blocks.map(b => <div key={b.id} title={`${b.title || kindOf(b.kind).label} · ${b.minutes} min`} style={{ width: `${(b.minutes / span) * 100}%`, background: toneOf(b.kind).ink, borderRight: '2px solid var(--surface)' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 12.5, fontWeight: 800, color: result.status === 'over' ? 'var(--danger-text)' : result.status === 'fits' ? 'var(--ok-text)' : 'var(--text2)' }}>
        <span>{result.text}</span>
        {result.length ? <span style={{ color: 'var(--text3)', fontWeight: 700 }}>{result.length} min session</span> : null}
      </div>
    </div>
  )
}

function TemplatePicker({ org, hasPlan, onApply, onClose }) {
  const mobile = useIsMobile()
  const [list, setList] = useState(null)
  useEffect(() => {
    supabase.from('templates').select('id, title, description, content, is_global').eq('type', 'session_plan').eq('is_active', true).order('is_global').order('title')
      .then(({ data }) => setList((data || []).map(t => {
        const blocks = Array.isArray(t.content?.blocks) ? normalisePlan(t.content.blocks) : blocksFromHtml(t.content?.body || '')
        return { ...t, blocks, minutes: blocks.reduce((s, b) => s + b.minutes, 0) }
      }).filter(t => t.blocks.length)), () => setList([]))
  }, [org.id])
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(10,14,28,0.55)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-label="Start from a plan template" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: mobile ? '88dvh' : '80vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: mobile ? '20px 20px 0 0' : 20, padding: mobile ? 16 : 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Start from a plan</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}><Icon name="✕" /></button>
        </div>
        {list === null ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading plans…</div>
          : list.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>No plan templates yet. Admins can save any plan as one.</div>
          : <div style={{ display: 'grid', gap: 10 }}>
            {list.map(t => (
              <div key={t.id} style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t.blocks.length} activities · {t.minutes} min{t.is_global ? ' · LaunchSession' : ''}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6 }}>{t.blocks.map(b => b.title || kindOf(b.kind).label).join(' → ')}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onApply(t.blocks, 'replace')} style={solid}>{hasPlan ? 'Replace my plan' : 'Use this plan'}</button>
                  {hasPlan && <button type="button" onClick={() => onApply(t.blocks, 'append')} style={ghost}>Add to the end</button>}
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>,
    document.body
  )
}

export default function SessionBuilder({ org, session, staff = [], userRole, onClose, onSaved }) {
  const mobile = useIsMobile()
  const canWrite = ['owner', 'admin', 'manager', 'staff'].includes(userRole)
  const isAdmin = ['owner', 'admin'].includes(userRole)
  const [blocks, setBlocks] = useState(() => normalisePlan(session.plan))
  const [saved, setSaved] = useState(() => JSON.stringify(toStored(normalisePlan(session.plan))))
  const [mode, setMode] = useState('build')
  const [openId, setOpenId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [library, setLibrary] = useState(false)
  const [templates, setTemplates] = useState(false)
  const [templateName, setTemplateName] = useState(null)

  const calc = useMemo(() => blocks.map(b => ({ ...b, minutes: Number(b.minutes) || 0 })), [blocks])
  const timed = withTimes(calc, session.start_time)
  const result = fit(calc, session)
  const kit = equipmentList(calc)
  const outcomes = outcomesCovered(calc)
  const names = useMemo(() => Object.fromEntries(staff.map(p => [p.id, p.full_name])), [staff])
  const dirty = JSON.stringify(toStored(blocks)) !== saved

  const flash = m => { setNotice(m); setTimeout(() => setNotice(''), 3200) }
  const update = (i, next) => setBlocks(list => list.map((b, j) => (j === i ? next : b)))
  const add = (block, open = true) => { setBlocks(list => [...list, block]); if (open) setOpenId(block.id) }

  const close = () => {
    if (dirty && !window.confirm('Leave without saving your changes to this plan?')) return
    onClose()
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !library && !templates) close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const save = async () => {
    setSaving(true); setError('')
    const plan = toStored(blocks)
    const { data, error: e } = await supabase.from('sessions').update({ plan: plan.length ? plan : null }).eq('id', session.id).eq('org_id', org.id).select('id')
    setSaving(false)
    if (e || !data?.length) { setError(e?.message?.includes('ORG_BILLING_LOCKED') ? 'Your plan has ended, so changes cannot be saved.' : 'The plan did not save. You may not have permission to edit this session.'); return }
    setSaved(JSON.stringify(plan))
    flash('Plan saved.')
    onSaved?.({ ...session, plan: plan.length ? plan : null })
  }

  const applyTemplate = (tplBlocks, how) => {
    const fresh = tplBlocks.map(b => newBlock({ ...b, id: undefined }))
    setBlocks(list => (how === 'append' ? [...list, ...fresh] : fresh))
    setTemplates(false); setOpenId(null)
    flash(how === 'append' ? 'Added to the end of the plan.' : 'Plan filled in. Change anything you like.')
  }

  const saveTemplate = async () => {
    const title = (templateName || '').trim()
    if (!title) return
    setSaving(true); setError('')
    const plan = toStored(blocks)
    const { error: e } = await supabase.from('templates').insert({
      org_id: org.id, type: 'session_plan', title, description: `${plan.length} activities · ${result.total} min`,
      content: { body: planToHtml(normalisePlan(plan)), blocks: plan }, is_global: false, is_active: true,
    })
    setSaving(false)
    if (e) { setError('The template did not save. Only admins can save plan templates.'); return }
    setTemplateName(null); flash(`Saved as "${title}". It is in Templates too.`)
  }

  const toLibrary = async b => {
    const { error: e } = await saveToLibrary(org, b)
    if (e) { setError(e.message || 'That did not save to the library.'); return }
    flash(`"${b.title}" saved to the activity library.`)
  }

  const dateLabel = session.session_date ? new Date(`${session.session_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  const timeLabel = session.start_time ? `${session.start_time.slice(0, 5)}${session.end_time ? `–${session.end_time.slice(0, 5)}` : ''}` : ''

  const side = (
    <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <section style={{ ...card, padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}><Icon name="📦" size={15} /> What to bring</h3>
        {kit.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>Add equipment to an activity and it collects here.</div>
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {kit.map(k => <li key={k.item} style={{ fontSize: 13, color: 'var(--text)' }}><b>{k.item}</b> <span style={{ color: 'var(--text3)' }}>· {k.uses.join(', ')}</span></li>)}
          </ul>}
      </section>
      <section style={{ ...card, padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}><Icon name="🎯" size={15} /> Outcomes</h3>
        {outcomes.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tag activities with an outcome to see what this session works on.</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{outcomes.map(o => <span key={o.key} style={{ fontSize: 12.5, fontWeight: 800, padding: '5px 10px', borderRadius: 99, background: 'var(--org-a10)', color: 'var(--org-ink)' }}>{areaByKey(o.key).label} · {o.minutes} min</span>)}</div>}
      </section>
      {isAdmin && blocks.length > 0 && (
        <section style={{ ...card, padding: 16 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Reuse this plan</h3>
          {templateName === null
            ? <button type="button" onClick={() => setTemplateName(session.title || '')} style={{ ...ghost, width: '100%' }}>Save as a plan template</button>
            : <div style={{ display: 'grid', gap: 8 }}>
              <input aria-label="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} maxLength={120} style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setTemplateName(null)} style={{ ...ghost, flex: 1 }}>Cancel</button>
                <button type="button" onClick={saveTemplate} disabled={saving || !templateName.trim()} style={{ ...solid, flex: 1 }}>Save template</button>
              </div>
            </div>}
        </section>
      )}
    </aside>
  )

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="builder-title" style={{ position: 'fixed', inset: 0, zIndex: 10700, background: 'var(--bg, var(--surface2))', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: mobile ? '10px 12px' : '12px 22px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={close} aria-label="Close the session builder" style={{ ...ghost, width: 44, padding: 0 }}><Icon name="←" /></button>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--org-ink)' }}>Session builder</div>
          <h1 id="builder-title" style={{ margin: 0, fontSize: mobile ? 17 : 20, fontWeight: 900, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</h1>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{[dateLabel, timeLabel, session.location].filter(Boolean).join(' · ')}</div>
        </div>
        <div role="tablist" aria-label="Builder view" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {[['build', 'Build'], ['run', 'Run it']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)}
              style={{ minHeight: 42, padding: '0 14px', border: 'none', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', background: mode === k ? 'var(--org-solid)' : 'var(--surface)', color: mode === k ? 'var(--org-on-solid)' : 'var(--text2)' }}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => printPlan({ org, session, blocks: calc, names })} disabled={!blocks.length} style={{ ...ghost, opacity: blocks.length ? 1 : 0.5 }}><Icon name="📄" size={15} /> {!mobile && 'Print'}</button>
        <button type="button" onClick={save} disabled={!dirty || saving} style={{ ...solid, opacity: !dirty || saving ? 0.55 : 1 }}>{saving ? 'Saving…' : dirty ? 'Save plan' : 'Saved'}</button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '14px 12px 40px' : '20px 22px 48px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {error && <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '10px 12px' }}>{error}</div>}
          {notice && <div role="status" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--ok-text)', background: 'var(--ok-bg)', borderRadius: 12, padding: '10px 12px' }}>{notice}</div>}

          {mode === 'run' ? (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <RunningOrder session={session} blocks={calc} names={names} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
              <main style={{ minWidth: 0 }}>
                <section style={{ ...card, padding: 16, marginBottom: 14 }}>
                  <FitBar blocks={calc} result={result} />
                </section>

                {blocks.length === 0 ? (
                  <section style={{ ...card, padding: mobile ? 18 : 24, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--org-a10)', color: 'var(--org-ink)' }}><Icon name="📋" size={24} /></div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Plan what happens, minute by minute</h2>
                    <p style={{ margin: '6px auto 16px', maxWidth: 440, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text3)' }}>Build the running order for this session. Your team sees it on the day, and you can print it.</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => { setBlocks(scaffold(session)); flash('A starting shape for the whole session. Rename and change anything.') }} style={solid}>Start with a shape</button>
                      <button type="button" onClick={() => setLibrary(true)} style={ghost}>Pick from the library</button>
                      <button type="button" onClick={() => setTemplates(true)} style={ghost}>Use a plan</button>
                    </div>
                  </section>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }} aria-label="Running order">
                    {timed.map((b, i) => {
                      const tone = toneOf(b.kind)
                      const open = openId === b.id
                      const raw = blocks[i]
                      return (
                        <li key={b.id} style={{ ...card, borderColor: open ? 'var(--org-solid)' : 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '10px 10px 10px 12px' : '12px 14px' }}>
                            <span style={{ width: 48, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 900, color: 'var(--text)' }}>{b.start || '—'}</span>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{b.end ? `to ${b.end}` : ''}</span>
                            </span>
                            <button type="button" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open} aria-label={`${b.title || kindOf(b.kind).label}, ${b.minutes} minutes. ${open ? 'Close' : 'Edit'}`}
                              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minHeight: 44 }}>
                              <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: tone.bg, color: tone.ink, flexShrink: 0 }}><Icon name={kindOf(b.kind).icon} size={18} /></span>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: b.title ? 'var(--text)' : 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || `Untitled ${kindOf(b.kind).label.toLowerCase()}`}</span>
                                <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {[kindOf(b.kind).label, b.lead_id && names[b.lead_id], b.equipment.length && `${b.equipment.length} item${b.equipment.length === 1 ? '' : 's'}`, b.outcome && areaByKey(b.outcome).label, b.safety && 'Safety note'].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                            </button>
                            <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, flexShrink: 0 }}>
                              <button type="button" aria-label={`Five minutes less for ${b.title || 'this activity'}`} onClick={() => update(i, { ...raw, minutes: Math.max(1, (Number(raw.minutes) || 0) - 5) })} style={{ width: 36, height: 40, border: 'none', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, fontWeight: 800 }}>−</button>
                              <span style={{ minWidth: 38, textAlign: 'center', fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{b.minutes}′</span>
                              <button type="button" aria-label={`Five minutes more for ${b.title || 'this activity'}`} onClick={() => update(i, { ...raw, minutes: Math.min(600, (Number(raw.minutes) || 0) + 5) })} style={{ width: 36, height: 40, border: 'none', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, fontWeight: 800 }}>+</button>
                            </span>
                          </div>
                          {open && (
                            <div style={{ padding: mobile ? '4px 12px 14px' : '4px 16px 16px', borderTop: '1px solid var(--border-soft)' }}>
                              <div style={{ paddingTop: 12 }}>
                                <BlockFields value={raw} onChange={next => update(i, next)} mobile={mobile} staff={staff} groups={session.bubbles || []} showPeople />
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                                <button type="button" onClick={() => setBlocks(list => moveBlock(list, i, -1))} disabled={i === 0} style={{ ...ghost, opacity: i === 0 ? 0.45 : 1 }} aria-label="Move up"><Icon name="↑" size={15} /> {!mobile && 'Up'}</button>
                                <button type="button" onClick={() => setBlocks(list => moveBlock(list, i, 1))} disabled={i === blocks.length - 1} style={{ ...ghost, opacity: i === blocks.length - 1 ? 0.45 : 1 }} aria-label="Move down"><Icon name="↓" size={15} /> {!mobile && 'Down'}</button>
                                <button type="button" onClick={() => setBlocks(list => duplicateBlock(list, i))} style={ghost}>Duplicate</button>
                                {canWrite && <button type="button" onClick={() => toLibrary(raw)} disabled={!raw.title?.trim()} style={{ ...ghost, opacity: raw.title?.trim() ? 1 : 0.45 }}>Save to library</button>}
                                <button type="button" onClick={() => { setBlocks(list => removeBlock(list, i)); setOpenId(null) }} style={{ ...ghost, color: 'var(--danger-text)' }}>Remove</button>
                                <button type="button" onClick={() => setOpenId(null)} style={{ ...solid, marginLeft: 'auto' }}>Done</button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}

                {blocks.length > 0 && (
                  <div style={{ ...card, padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setLibrary(true)} style={solid}>+ From the library</button>
                      <button type="button" onClick={() => setTemplates(true)} style={ghost}>+ From a plan</button>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', marginBottom: 6 }}>Or add a blank one</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {KINDS.map(k => (
                          <button key={k.key} type="button" onClick={() => add(newBlock({ kind: k.key, minutes: k.key === 'break' ? 10 : 15 }))}
                            style={{ minHeight: 38, padding: '0 11px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface)', color: toneOf(k.key).ink, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Icon name={k.icon} size={13} /> {k.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </main>
              {side}
            </div>
          )}
        </div>
      </div>

      {library && <ActivityLibrary org={org} mode="pick" canWrite={canWrite} onClose={() => setLibrary(false)}
        onPick={b => { add(b, false); setLibrary(false); flash(`"${b.title}" added to the plan.`) }} />}
      {templates && <TemplatePicker org={org} hasPlan={blocks.length > 0} onApply={applyTemplate} onClose={() => setTemplates(false)} />}
    </div>,
    document.body
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { KINDS, STARTER_ACTIVITIES, kindOf, newBlock } from '../../../lib/sessionPlan'
import { areaByKey } from '../../impact/impact_shared'
import BlockFields, { toneOf, fieldInput } from './BlockFields'
import Icon from '../../../lib/icons'

// The organisation's reusable activities, plus built-in ideas to start from.
// Opened from the session builder to add an activity to a plan ("pick"), or
// from Sessions to look after the library ("manage"). Everyone can browse;
// staff add, edit and remove (activity_library RLS).

const COLUMNS = ['kind', 'title', 'minutes', 'details', 'equipment', 'area', 'age_range', 'outcome', 'safety', 'easier', 'harder']
const toRow = (orgId, a) => {
  const row = { org_id: orgId }
  for (const c of COLUMNS) {
    const v = a[c]
    row[c] = c === 'equipment' ? (v || []) : c === 'minutes' ? Math.max(1, Math.min(600, Number(v) || 15)) : (typeof v === 'string' ? (v.trim() || null) : v ?? null)
  }
  row.kind = row.kind || 'activity'
  return row
}

/** Save one activity (a plan block, or a starter idea) to the library. */
export async function saveToLibrary(org, activity) {
  if (!activity.title?.trim()) return { error: { message: 'Give it a name first.' } }
  return supabase.from('activity_library').insert(toRow(org.id, activity)).select('id').single()
}

function ActivityCard({ a, mode, canWrite, onAdd, onEdit, onDelete, onKeep, busy }) {
  const tone = toneOf(a.kind)
  return (
    <article style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: tone.bg, color: tone.ink, flexShrink: 0 }}><Icon name={kindOf(a.kind).icon} size={19} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{a.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {[`${a.minutes} min`, kindOf(a.kind).label, a.age_range && `Ages ${a.age_range}`, a.outcome && areaByKey(a.outcome).label].filter(Boolean).join(' · ')}
        </div>
        {a.details && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.details}</div>}
        {a.equipment?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}><Icon name="📦" size={12} /> {a.equipment.join(', ')}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {mode === 'pick' && <button type="button" onClick={() => onAdd(a)} disabled={busy} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add to plan</button>}
          {a.starter && canWrite && <button type="button" onClick={() => onKeep(a)} disabled={busy} style={ghost}>Save to my library</button>}
          {!a.starter && canWrite && mode === 'manage' && <>
            <button type="button" onClick={() => onEdit(a)} disabled={busy} style={ghost}>Edit</button>
            <button type="button" onClick={() => onDelete(a)} disabled={busy} style={{ ...ghost, color: 'var(--danger-text)' }}>Remove</button>
          </>}
        </div>
      </div>
    </article>
  )
}
const ghost = { minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

export default function ActivityLibrary({ org, mode = 'manage', canWrite = false, onPick, onClose }) {
  const mobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error: e } = await supabase.from('activity_library').select('*').eq('org_id', org.id).order('title')
    if (e) setError('Your saved activities could not be loaded. The ideas below still work.')
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [org.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !editing) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  const flash = m => { setNotice(m); setTimeout(() => setNotice(''), 3000) }
  const match = a => (kind === 'all' || a.kind === kind) && (!query.trim() || [a.title, a.details, ...(a.equipment || [])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  const mine = useMemo(() => items.filter(match), [items, query, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => STARTER_ACTIVITIES.filter(a => match(a) && !items.some(i => i.title.toLowerCase() === a.title.toLowerCase())), [items, query, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = a => {
    onPick?.(newBlock({ ...a, id: undefined }))
    if (!a.starter && a.id) supabase.from('activity_library').update({ use_count: (a.use_count || 0) + 1 }).eq('id', a.id).then(() => {}, () => {})
  }
  const keep = async a => {
    setBusy(true)
    const { error: e } = await saveToLibrary(org, a)
    setBusy(false)
    if (e) { setError(e.message || 'That did not save.'); return }
    flash(`"${a.title}" is in your library.`); load()
  }
  const remove = async a => {
    if (!window.confirm(`Remove "${a.title}" from your library? Plans that already use it keep their copy.`)) return
    setBusy(true)
    const { error: e } = await supabase.from('activity_library').delete().eq('id', a.id)
    setBusy(false)
    if (e) { setError(e.message || 'That did not remove.'); return }
    load()
  }
  const saveEdit = async () => {
    if (!editing.title?.trim()) { setError('Give the activity a name.'); return }
    setBusy(true); setError('')
    const row = toRow(org.id, editing)
    const { error: e } = editing.id
      ? await supabase.from('activity_library').update(row).eq('id', editing.id).eq('org_id', org.id)
      : await supabase.from('activity_library').insert(row)
    setBusy(false)
    if (e) { setError(e.message || 'That did not save.'); return }
    setEditing(null); flash('Saved.'); load()
  }

  const kindsInUse = KINDS.filter(k => [...items, ...STARTER_ACTIVITIES].some(a => a.kind === k.key))

  return createPortal(
    <div onClick={() => !editing && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(10,14,28,0.55)', display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="library-title" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 760, height: mobile ? '100%' : 'min(86vh, 900px)', background: 'var(--bg, var(--surface2))', borderRadius: mobile ? 0 : 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }}>
        <header style={{ padding: mobile ? '14px 14px 12px' : '18px 22px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id="library-title" style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--text)' }}>{editing ? (editing.id ? 'Edit activity' : 'New activity') : 'Activity library'}</h2>
              {!editing && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{mode === 'pick' ? 'Pick an activity to add to the plan.' : 'Activities your team can drop into any session plan.'}</div>}
            </div>
            {!editing && canWrite && <button type="button" onClick={() => setEditing({ ...newBlock({ title: '' }), id: null })} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ New</button>}
            <button type="button" onClick={() => (editing ? setEditing(null) : onClose())} aria-label={editing ? 'Back to the library' : 'Close the library'}
              style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}><Icon name={editing ? '←' : '✕'} /></button>
          </div>
          {!editing && (
            <>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search activities or equipment" aria-label="Search activities" style={{ ...fieldInput, marginTop: 12 }} />
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
                {[{ key: 'all', label: 'All' }, ...kindsInUse].map(k => (
                  <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}
                    style={{ minHeight: 36, padding: '0 12px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${kind === k.key ? 'var(--org-solid)' : 'var(--border)'}`, background: kind === k.key ? 'var(--org-a10)' : 'var(--surface)', color: kind === k.key ? 'var(--org-ink)' : 'var(--text2)' }}>{k.label}</button>
                ))}
              </div>
            </>
          )}
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? 14 : '16px 22px 24px' }}>
          {error && <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
          {notice && <div role="status" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--ok-text)', background: 'var(--ok-bg)', borderRadius: 10, padding: '9px 12px' }}>{notice}</div>}
          {editing ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <BlockFields value={editing} onChange={setEditing} mobile={mobile} showAge />
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setEditing(null)} style={{ ...ghost, minHeight: 46, flex: mobile ? 1 : undefined }}>Cancel</button>
                <button type="button" onClick={saveEdit} disabled={busy} style={{ flex: 1, minHeight: 46, borderRadius: 12, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save activity'}</button>
              </div>
            </div>
          ) : (
            <>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Your activities {!loading && <span style={{ color: 'var(--text3)', fontWeight: 700 }}>· {mine.length}</span>}</h3>
              {loading ? <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>Loading…</div>
                : mine.length === 0 ? (
                  <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px dashed var(--border)', fontSize: 13, color: 'var(--text3)', marginBottom: 18, lineHeight: 1.5 }}>
                    {items.length ? 'Nothing matches that search.' : canWrite ? 'Nothing saved yet. Save activities from any plan, or keep one of the ideas below.' : 'Nothing saved yet.'}
                  </div>
                ) : <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>{mine.map(a => <ActivityCard key={a.id} a={a} mode={mode} canWrite={canWrite} busy={busy} onAdd={add} onEdit={x => setEditing({ ...x, equipment: x.equipment || [] })} onDelete={remove} />)}</div>}
              {ideas.length > 0 && <>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Ideas to start from</h3>
                <div style={{ display: 'grid', gap: 10 }}>{ideas.map(a => <ActivityCard key={a.title} a={a} mode={mode} canWrite={canWrite} busy={busy} onAdd={add} onKeep={keep} />)}</div>
              </>}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

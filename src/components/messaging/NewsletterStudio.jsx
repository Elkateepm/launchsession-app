import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import shrinkImage from '../../lib/shrinkImage'
import AudienceBuilder from './AudienceBuilder'
import Icon from '../../lib/icons'

// Newsletter Studio.
//
// Three stages rather than one long scroll: write it, choose who gets it,
// check it and send. Those are genuinely separate jobs -- previously the
// audience controls sat between the subject and the content, so you scrolled
// past recipient configuration every time you edited a paragraph.
//
// The preview is not a stage. It stays on screen throughout on a wide screen,
// because the whole point is watching the thing take shape.
//
// Blocks are rendered to email HTML server-side in the send route; Preview
// below is an on-screen approximation. Two renderers is a known cost and they
// want changing together.

// Widths in px inside the 496px email content column. Mirrored by renderBlocks
// in api/send-volunteer-broadcast.js.
const IMAGE_SIZES = [
  { key: 'small', label: 'Small', px: 240 },
  { key: 'medium', label: 'Medium', px: 360 },
  { key: 'full', label: 'Full', px: 496 },
]
const imageWidth = (size) => (IMAGE_SIZES.find(s => s.key === size) || IMAGE_SIZES[2]).px

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'text', label: 'Text', icon: '¶' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'callout', label: 'Highlight', icon: '★' },
  { type: 'button', label: 'Button', icon: '⬤' },
  { type: 'divider', label: 'Divider', icon: '—' },
]

const STAGES = [
  { key: 'write', label: 'Write', n: 1 },
  { key: 'audience', label: 'Audience', n: 2 },
  { key: 'review', label: 'Review & send', n: 3 },
]

const uid = () => Math.random().toString(36).slice(2, 9)

const blank = (type) => {
  switch (type) {
    case 'heading': return { id: uid(), type, text: '' }
    case 'text': return { id: uid(), type, text: '' }
    case 'image': return { id: uid(), type, url: '', alt: '', caption: '', size: 'full' }
    case 'callout': return { id: uid(), type, title: '', text: '' }
    case 'button': return { id: uid(), type, label: '', url: '' }
    default: return { id: uid(), type }
  }
}

const inp = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10,
  border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', color: 'var(--text)',
}
const miniLabel = {
  fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: 0.7, marginBottom: 7, display: 'block',
}
const card = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 18, marginBottom: 14,
}

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1080)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1080)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide
}

const summarise = (b) => {
  if (b.type === 'heading') return b.text || 'Empty heading'
  if (b.type === 'text') return b.text || 'Empty paragraph'
  if (b.type === 'callout') return b.title || b.text || 'Empty highlight'
  if (b.type === 'button') return b.label || 'Unlabelled button'
  if (b.type === 'image') return b.url ? (b.caption || 'Image') : 'No image chosen'
  return 'Divider'
}

function BlockEditor({ block, orgId, primary, open, onOpen, onChange, onRemove, onMove, onDuplicate, isFirst, isLast }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => onChange({ ...block, [k]: v })

  // Measured so the block knows its own shape. A phone photo is portrait, and
  // a portrait image at full content width is about 880px tall in an inbox --
  // a whole screen of one picture. Landscape at full width is fine.
  const measure = (file) => new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }) }
    img.src = url
  })

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const up = await shrinkImage(file, { maxDimension: 1200 })
    const dims = await measure(up)
    const path = `${orgId}/${Date.now()}-${(up.name || 'image').replace(/[^a-z0-9.]/gi, '_')}`
    const { error } = await supabase.storage
      .from('newsletter-images').upload(path, up, { contentType: up.type })
    if (error) {
      setErr('Could not upload that image.')
    } else {
      // A public URL, not a signed one. An email lives in an inbox for years
      // and a signed URL would stop resolving an hour after sending.
      const { data } = supabase.storage.from('newsletter-images').getPublicUrl(path)
      const portrait = dims.h > dims.w * 1.1
      onChange({ ...block, url: data.publicUrl, w: dims.w, h: dims.h, size: portrait ? 'small' : 'full' })
    }
    setBusy(false)
    e.target.value = ''
  }

  const meta = BLOCK_TYPES.find(b => b.type === block.type)
  const iconBtn = (disabled) => ({
    background: 'none', border: 'none', padding: '4px 6px', fontSize: 12.5,
    cursor: disabled ? 'default' : 'pointer', color: disabled ? 'var(--border)' : 'var(--text3)',
  })
  const empty = !['divider'].includes(block.type) &&
    !(block.text || '').trim() && !block.url && !(block.label || '').trim() && !(block.title || '').trim()

  return (
    <div style={{
      border: `1.5px solid ${open ? primary : 'var(--border)'}`,
      borderRadius: 13, marginBottom: 9, background: 'var(--surface)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px' }}>
        <button type="button" onClick={onOpen} aria-expanded={open} style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
        }}>
          <span aria-hidden="true" style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
            background: `${primary}18`, color: primary,
          }}>{meta?.icon}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'block', fontSize: 13, fontWeight: 700,
              color: empty ? 'var(--text3)' : 'var(--text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontStyle: empty ? 'italic' : 'normal',
            }}>{summarise(block)}</span>
          </span>
        </button>
        <button onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" style={iconBtn(isFirst)}><Icon name="↑" /></button>
        <button onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" style={iconBtn(isLast)}><Icon name="↓" /></button>
        <button onClick={onDuplicate} aria-label="Duplicate" style={iconBtn(false)}>⧉</button>
        <button onClick={onRemove} aria-label={`Remove ${meta?.label || 'block'}`} style={iconBtn(false)}><Icon name="✕" /></button>
      </div>

      {open && block.type !== 'divider' && (
        <div style={{ padding: '2px 12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ height: 12 }} />

          {block.type === 'heading' && (
            <input style={inp} value={block.text} placeholder="Section heading" autoFocus
              onChange={e => set('text', e.target.value)} />
          )}

          {block.type === 'text' && (
            <>
              <textarea style={{ ...inp, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }} value={block.text}
                placeholder="Write your paragraph. Leave a blank line to start a new one."
                onChange={e => set('text', e.target.value)} />
              <button type="button" onClick={() => set('text', `${block.text || ''}{{first_name}}`)}
                style={{ marginTop: 7, padding: '4px 10px', borderRadius: 99, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: primary, fontFamily: 'inherit' }}>
                + Their first name
              </button>
            </>
          )}

          {block.type === 'image' && (
            <>
              {block.url && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--border)', borderRadius: 9, marginBottom: 10,
                    maxHeight: 200, overflow: 'hidden',
                  }}>
                    {/* Capped so a tall photo doesn't push the controls off screen. */}
                    <img src={block.url} alt="" style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                  <label style={miniLabel}>Size in the email</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 11 }}>
                    {IMAGE_SIZES.map(sz => {
                      const active = (block.size || 'full') === sz.key
                      return (
                        <button key={sz.key} type="button" onClick={() => set('size', sz.key)} style={{
                          flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 11.5, fontWeight: 800,
                          border: `1.5px solid ${active ? primary : 'var(--border)'}`,
                          background: active ? `${primary}18` : 'transparent',
                          color: active ? primary : 'var(--text3)',
                        }}>{sz.label}</button>
                      )
                    })}
                  </div>
                  {block.w > 0 && block.h > block.w * 1.1 && (block.size || 'full') === 'full' && (
                    <div style={{ fontSize: 11.5, color: '#B45309', marginBottom: 10, lineHeight: 1.5 }}>
                      Tall photo — at full width it'll be about {Math.round(496 * block.h / block.w)}px high in the email.
                    </div>
                  )}
                </>
              )}
              <input type="file" accept="image/*" onChange={upload} disabled={busy} style={{ fontSize: 12.5, marginBottom: 9 }} />
              {busy && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Uploading…</div>}
              {err && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 6 }}>{err}</div>}
              <label style={miniLabel}>Caption (optional)</label>
              <input style={inp} value={block.caption} onChange={e => set('caption', e.target.value)} placeholder="Caption" />
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5, paddingLeft: 9, borderLeft: '2px solid var(--border)' }}>
                Images here are publicly readable, so they still load in an inbox a year from now. Don't upload photographs of young people unless you have consent to publish them.
              </div>
            </>
          )}

          {block.type === 'callout' && (
            <>
              <input style={{ ...inp, marginBottom: 9 }} value={block.title} placeholder="Highlight title" autoFocus
                onChange={e => set('title', e.target.value)} />
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={block.text}
                placeholder="What you want to stand out" onChange={e => set('text', e.target.value)} />
            </>
          )}

          {block.type === 'button' && (
            <>
              <input style={{ ...inp, marginBottom: 9 }} value={block.label} placeholder="Button text" autoFocus
                onChange={e => set('label', e.target.value)} />
              <input style={inp} value={block.url} placeholder="https://…"
                onChange={e => set('url', e.target.value)} />
              {block.url && !/^https?:\/\//i.test(block.url) && (
                <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 7 }}>
                  Needs to start with https:// or it won't be linked in the email.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Preview({ subject, preheader, blocks, org, compact }) {
  const primary = org?.primary_color || '#3B82F6'
  const fill = (t) => String(t || '').replaceAll('{{first_name}}', 'Sam')

  return (
    <div style={{ background: '#EEF1F6', padding: compact ? 14 : 20, borderRadius: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
        fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
        Live preview
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 10px rgba(15,23,42,0.10)' }}>
        <div style={{ background: '#0F172A', padding: '26px 30px', textAlign: 'center', borderTop: `4px solid ${primary}` }}>
          {org?.logo_url
            ? <img src={org.logo_url} alt="" style={{ maxHeight: 44, maxWidth: 150, objectFit: 'contain' }} />
            : <div style={{ fontSize: 21, fontWeight: 900, color: '#fff' }}>{org?.name}</div>}
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Powered by LaunchSession</div>
        </div>
        <div style={{ height: 4, background: primary }} />
        <div style={{ padding: '30px 30px 34px' }}>
          {blocks.length === 0 && (
            <div style={{ color: '#94A3B8', fontSize: 13.5, textAlign: 'center', padding: '30px 10px', lineHeight: 1.6 }}>
              Your newsletter will appear here as you build it.
            </div>
          )}
          {blocks.map(b => {
            if (b.type === 'heading' && b.text) return <h2 key={b.id} style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 800, color: '#0F172A' }}>{b.text}</h2>
            if (b.type === 'text' && b.text) return <div key={b.id} style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>{fill(b.text)}</div>
            if (b.type === 'image' && b.url) return (
              <div key={b.id} style={{ marginBottom: 18, textAlign: 'center' }}>
                <img src={b.url} alt={b.alt || ''} style={{
                  width: imageWidth(b.size), maxWidth: '100%', height: 'auto',
                  borderRadius: 8, display: 'inline-block',
                }} />
                {b.caption && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{b.caption}</div>}
              </div>
            )
            if (b.type === 'callout' && (b.title || b.text)) return (
              <div key={b.id} style={{ background: `${primary}12`, borderLeft: `4px solid ${primary}`, padding: '14px 16px', marginBottom: 18 }}>
                {b.title && <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{b.title}</div>}
                <div style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fill(b.text)}</div>
              </div>
            )
            if (b.type === 'button' && b.label) return (
              <div key={b.id} style={{ marginBottom: 20 }}>
                <span style={{ display: 'inline-block', background: primary, color: '#fff', padding: '14px 30px', borderRadius: 8, fontSize: 15, fontWeight: 700 }}>{b.label}</span>
              </div>
            )
            if (b.type === 'divider') return <div key={b.id} style={{ borderTop: '1px solid #E2E8F0', margin: '0 0 20px' }} />
            return null
          })}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: '#64748B', marginTop: 12, lineHeight: 1.6 }}>
        <strong style={{ color: '#334155' }}>{subject || 'No subject yet'}</strong>
        {preheader ? <> — {preheader}</> : null}
        <br />Personalisation is shown as "Sam".
      </div>
    </div>
  )
}

export default function NewsletterStudio({ org, session }) {
  const wide = useWide()
  const [view, setView] = useState('compose') // compose | past
  const [stage, setStage] = useState('write')

  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [blocks, setBlocks] = useState([])
  const [openBlock, setOpenBlock] = useState(null)

  const [roles, setRoles] = useState(['parent'])
  const [groupNames, setGroupNames] = useState([])
  const [projectIds, setProjectIds] = useState([])
  const [manualEmails, setManualEmails] = useState([])
  const [excludedEmails, setExcludedEmails] = useState([])
  const [resolved, setResolved] = useState([])
  const audienceCount = resolved.filter(r => !r.suppressed).length
  const suppressedCount = resolved.filter(r => r.suppressed).length

  const [past, setPast] = useState([])
  const [draftId, setDraftId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)
  const [savedAt, setSavedAt] = useState(null)

  const primary = org?.primary_color || '#3B82F6'

  const load = useCallback(async () => {
    const { data } = await supabase.from('newsletters').select('*')
      .eq('org_id', org?.id).order('created_at', { ascending: false }).limit(20)
    setPast(data || [])
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const addBlock = (type) => {
    const b = blank(type)
    setBlocks(x => [...x, b])
    setOpenBlock(b.id)
  }
  const updateBlock = (i, next) => setBlocks(b => b.map((x, j) => (j === i ? next : x)))
  const removeBlock = (i) => setBlocks(b => b.filter((_, j) => j !== i))
  const duplicateBlock = (i) => setBlocks(b => {
    const copy = { ...b[i], id: uid() }
    return [...b.slice(0, i + 1), copy, ...b.slice(i + 1)]
  })
  const moveBlock = (i, dir) => setBlocks(b => {
    const j = i + dir
    if (j < 0 || j >= b.length) return b
    const next = [...b]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const hasContent = subject.trim() && blocks.some(b => (b.text || '').trim() || b.url || (b.label || '').trim())
  const canSend = hasContent && roles.length > 0 && audienceCount > 0 && !busy

  const row = useCallback(() => ({
    org_id: org?.id,
    subject: subject.trim(),
    preheader: preheader.trim() || null,
    blocks,
    audience_roles: roles,
    audience: { group_names: groupNames, project_ids: projectIds },
    manual_emails: manualEmails,
    excluded_emails: excludedEmails,
    status: 'draft',
    created_by: session?.user?.id || null,
  }), [org?.id, subject, preheader, blocks, roles, groupNames, projectIds, manualEmails, excludedEmails, session])

  const save = useCallback(async () => {
    const r = row()
    if (draftId) {
      const { error } = await supabase.from('newsletters').update(r).eq('id', draftId)
      if (error) throw new Error(error.message)
      return draftId
    }
    const { data, error } = await supabase.from('newsletters').insert([r]).select().single()
    if (error || !data) throw new Error(error?.message || 'Could not save the newsletter')
    setDraftId(data.id)
    return data.id
  }, [row, draftId])

  // Autosave. Only once there is a subject to save under, and only for drafts
  // -- a sent newsletter reopened as a copy must not be silently written back
  // over the record of what actually went out.
  const dirtyRef = useRef(false)
  useEffect(() => { dirtyRef.current = true }, [subject, preheader, blocks, roles, groupNames, projectIds, manualEmails, excludedEmails])
  useEffect(() => {
    if (!subject.trim() || busy) return undefined
    const t = setTimeout(async () => {
      if (!dirtyRef.current) return
      try { await save(); dirtyRef.current = false; setSavedAt(new Date()) } catch { /* autosave stays quiet */ }
    }, 2500)
    return () => clearTimeout(t)
  }, [subject, preheader, blocks, roles, groupNames, projectIds, manualEmails, excludedEmails, busy, save])

  const sendTest = async () => {
    if (!hasContent || testing) return
    setTesting(true); setResult(null)
    try {
      const id = await save()
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-volunteer-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token || ''}` },
        body: JSON.stringify({ newsletterId: id, testTo: s?.user?.email }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Test failed')
      setResult({ ok: true, text: `Test sent to ${payload.to}. Nothing else was changed.` })
    } catch (err) { setResult({ ok: false, text: err.message }) }
    setTesting(false)
  }

  const send = async () => {
    if (!canSend) return
    if (!window.confirm(`Send "${subject.trim()}" to ${audienceCount} ${audienceCount === 1 ? 'person' : 'people'}? This cannot be unsent.`)) return
    setBusy(true); setResult(null)
    try {
      const id = await save()
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-volunteer-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token || ''}` },
        body: JSON.stringify({ newsletterId: id }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Send failed')
      setResult({
        ok: payload.failed === 0,
        text: payload.failed
          ? `Sent to ${payload.sent}, ${payload.failed} failed. Open it from Sent & drafts to retry.`
          : `Sent to ${payload.sent} ${payload.sent === 1 ? 'person' : 'people'}.`,
      })
      if (payload.failed === 0) {
        setSubject(''); setPreheader(''); setBlocks([]); setDraftId(null); setStage('write')
      }
      load()
    } catch (err) { setResult({ ok: false, text: err.message }) }
    setBusy(false)
  }

  const openPast = (n) => {
    setSubject(n.subject || '')
    setPreheader(n.preheader || '')
    setBlocks(Array.isArray(n.blocks) ? n.blocks.map(b => ({ ...b, id: b.id || uid() })) : [])
    setRoles(n.audience_roles || ['parent'])
    setGroupNames(n.audience?.group_names || [])
    setProjectIds(n.audience?.project_ids || [])
    setManualEmails(n.manual_emails || [])
    setExcludedEmails(n.excluded_emails || [])
    setDraftId(n.status === 'draft' ? n.id : null)
    setResult(n.status === 'draft' ? null : { ok: true, text: 'Opened as a copy — sending will create a new one.' })
    setView('compose'); setStage('write')
  }

  const startNew = () => {
    setSubject(''); setPreheader(''); setBlocks([]); setDraftId(null)
    setRoles(['parent']); setGroupNames([]); setProjectIds([])
    setManualEmails([]); setExcludedEmails([])
    setResult(null); setSavedAt(null); setView('compose'); setStage('write')
  }

  // ------------------------------------------------------------- stages
  const stageIssues = {
    write: !subject.trim() ? 'Needs a subject' : blocks.length === 0 ? 'Needs some content' : null,
    audience: roles.length === 0 ? 'Nobody chosen' : audienceCount === 0 ? 'Nobody can be emailed' : null,
    review: null,
  }

  const Stepper = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
      {STAGES.map(st => {
        const active = stage === st.key
        const issue = stageIssues[st.key]
        return (
          <button key={st.key} onClick={() => setStage(st.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px',
            borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${active ? primary : 'var(--border)'}`,
            background: active ? `${primary}14` : 'transparent',
            transition: 'all 0.15s',
          }}>
            <span aria-hidden="true" style={{
              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10.5, fontWeight: 900,
              background: active ? primary : 'var(--border)',
              color: active ? '#fff' : 'var(--text3)',
            }}>{st.n}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: active ? primary : 'var(--text3)' }}>{st.label}</span>
            {issue && <span title={issue} aria-label={issue} style={{ fontSize: 11, color: '#B45309' }}>•</span>}
          </button>
        )
      })}
    </div>
  )

  const writeStage = (
    <>
      <div style={card}>
        <label style={miniLabel} htmlFor="nl-subject">Subject</label>
        <input id="nl-subject" style={{ ...inp, marginBottom: 14, fontSize: 15, fontWeight: 600 }} value={subject}
          onChange={e => setSubject(e.target.value)} placeholder="What's this newsletter about?" />
        <label style={miniLabel} htmlFor="nl-pre">Inbox preview line <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· optional</span></label>
        <input id="nl-pre" style={inp} value={preheader}
          onChange={e => setPreheader(e.target.value)} placeholder="The grey line shown after the subject" />
      </div>

      <div style={card}>
        <label style={miniLabel}>Content</label>
        {blocks.length === 0 && (
          <div style={{
            border: '1.5px dashed var(--border)', borderRadius: 12, padding: '26px 18px',
            textAlign: 'center', color: 'var(--text3)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 14,
          }}>
            Nothing in here yet.<br />Start with a heading or a paragraph.
          </div>
        )}
        {blocks.map((b, i) => (
          <BlockEditor
            key={b.id}
            block={b}
            orgId={org?.id}
            primary={primary}
            open={openBlock === b.id}
            onOpen={() => setOpenBlock(k => (k === b.id ? null : b.id))}
            onChange={next => updateBlock(i, next)}
            onRemove={() => removeBlock(i)}
            onDuplicate={() => duplicateBlock(i)}
            onMove={dir => moveBlock(i, dir)}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
          />
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8, marginTop: 10 }}>
          {BLOCK_TYPES.map(t => (
            <button key={t.type} type="button" onClick={() => addBlock(t.type)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '11px 6px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text3)', fontSize: 11.5, fontWeight: 700,
            }}>
              <span aria-hidden="true" style={{ fontSize: 14, color: primary }}><Icon name={t.icon} /></span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  const audienceStage = (
    <div style={card}>
      <AudienceBuilder
        org={org}
        primary={primary}
        roles={roles} setRoles={setRoles}
        groupNames={groupNames} setGroupNames={setGroupNames}
        projectIds={projectIds} setProjectIds={setProjectIds}
        manualEmails={manualEmails} setManualEmails={setManualEmails}
        excludedEmails={excludedEmails} setExcludedEmails={setExcludedEmails}
        onResolved={setResolved}
      />
    </div>
  )

  const checkRow = (ok, label, detail) => (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span aria-hidden="true" style={{ fontSize: 13, color: ok ? '#15803D' : '#B45309', flexShrink: 0 }}>{ok ? '✓' : '!'}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        {detail && <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{detail}</span>}
      </span>
    </div>
  )

  const reviewStage = (
    <div style={card}>
      <label style={miniLabel}>Before you send</label>
      {checkRow(!!subject.trim(), subject.trim() || 'No subject yet',
        preheader.trim() ? `Preview line: ${preheader.trim()}` : 'No inbox preview line — the first words of the newsletter will show instead.')}
      {checkRow(blocks.length > 0, `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'} of content`,
        blocks.map(b => BLOCK_TYPES.find(t => t.type === b.type)?.label).join(' · ') || null)}
      {checkRow(audienceCount > 0, `${audienceCount} ${audienceCount === 1 ? 'recipient' : 'recipients'}`,
        suppressedCount > 0
          ? `${suppressedCount} unsubscribed and will be skipped.`
          : 'Someone in two groups still only gets one email.')}
      {checkRow(true, 'Every recipient gets an unsubscribe link',
        'Suppressed for this organisation only, and applied to every future newsletter.')}

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={sendTest} disabled={!hasContent || testing} style={{
          padding: '12px 18px', borderRadius: 11, border: '1.5px solid var(--border)',
          background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 700,
          cursor: !hasContent || testing ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: !hasContent || testing ? 0.5 : 1,
        }}>{testing ? 'Sending test…' : 'Send a test to me'}</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
        A test goes only to your own address, changes nothing, and carries no unsubscribe link — clicking one in a test would opt you out for real.
      </div>
    </div>
  )

  const composer = (
    <>
      <Stepper />
      {stage === 'write' && writeStage}
      {stage === 'audience' && audienceStage}
      {stage === 'review' && reviewStage}

      <div style={{
        position: 'sticky', bottom: 0, zIndex: 5,
        background: 'var(--bg, var(--surface))', paddingTop: 10, paddingBottom: 14,
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {stage !== 'review' ? (
            <button onClick={() => setStage(stage === 'write' ? 'audience' : 'review')} style={{
              flex: 1, minWidth: 190, padding: '12px 24px', borderRadius: 11, border: 'none',
              background: primary, color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {stage === 'write' ? 'Next — choose who gets it' : 'Next — review'}
            </button>
          ) : (
            <button onClick={send} disabled={!canSend} style={{
              flex: 1, minWidth: 190, padding: '12px 24px', borderRadius: 11, border: 'none',
              background: primary, color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: canSend ? 'pointer' : 'default', fontFamily: 'inherit',
              opacity: canSend ? 1 : 0.45,
            }}>
              {busy ? 'Sending…' : audienceCount
                ? `Send to ${audienceCount} ${audienceCount === 1 ? 'person' : 'people'}`
                : 'Send newsletter'}
            </button>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            {savedAt ? `Draft saved ${savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>Newsletter Studio</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
            Write it, choose who gets it, send it.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={startNew} style={{
            padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${view === 'compose' ? primary : 'var(--border)'}`,
            background: view === 'compose' ? primary : 'transparent',
            color: view === 'compose' ? '#fff' : 'var(--text3)', fontSize: 12.5, fontWeight: 800,
          }}>New newsletter</button>
          <button onClick={() => setView('past')} style={{
            padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${view === 'past' ? primary : 'var(--border)'}`,
            background: view === 'past' ? primary : 'transparent',
            color: view === 'past' ? '#fff' : 'var(--text3)', fontSize: 12.5, fontWeight: 800,
          }}>Sent &amp; drafts ({past.length})</button>
        </div>
      </div>

      {result && (
        <div style={{
          padding: '11px 15px', borderRadius: 11, fontSize: 13, fontWeight: 600, marginBottom: 14,
          background: result.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: result.ok ? '#15803D' : '#B91C1C',
        }}>{result.text}</div>
      )}

      {view === 'compose' ? (
        wide ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
            <div>{composer}</div>
            <div style={{ position: 'sticky', top: 8 }}>
              <Preview subject={subject} preheader={preheader} blocks={blocks} org={org} compact />
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            {composer}
            <div style={{ marginTop: 18 }}>
              <Preview subject={subject} preheader={preheader} blocks={blocks} org={org} />
            </div>
          </div>
        )
      ) : (
        <div style={{ maxWidth: 640 }}>
          {past.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', fontSize: 13.5, padding: '30px 18px' }}>
              Nothing yet. Drafts and sent newsletters will show up here.
            </div>
          )}
          {past.map(n => (
            <button key={n.id} onClick={() => openPast(n)} style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 15px', marginBottom: 9, borderRadius: 12, cursor: 'pointer',
              border: '1.5px solid var(--border)', background: 'var(--surface)', fontFamily: 'inherit',
            }}>
              <span style={{
                padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: 0.4,
                background: n.status === 'draft' ? 'var(--border)' : 'rgba(34,197,94,0.15)',
                color: n.status === 'draft' ? 'var(--text3)' : '#15803D',
              }}>{n.status === 'draft' ? 'Draft' : 'Sent'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.subject}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {n.status === 'draft'
                    ? 'Not sent yet'
                    : `${n.sent_count} delivered${n.failed_count ? ` · ${n.failed_count} failed` : ''}`}
                  {' · '}{new Date(n.created_at).toLocaleDateString('en-GB')}
                </span>
              </span>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}><Icon name="→" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

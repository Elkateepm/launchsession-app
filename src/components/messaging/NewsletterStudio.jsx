import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import shrinkImage from '../../lib/shrinkImage'

// Newsletter Studio.
//
// A newsletter is an ordered array of blocks stored on the `newsletters` row.
// The blocks are rendered to email HTML server-side in the send route, not
// here -- this component renders an on-screen approximation for the Preview
// tab. Keeping one renderer authoritative avoids the usual drift where the
// preview and the delivered email slowly stop matching.
//
// Audience is resolved at send time rather than being frozen into the draft,
// so a newsletter written on Monday and sent on Friday goes to whoever is on
// the books on Friday.

const AUDIENCES = [
  { key: 'parent', label: 'Parents', hint: 'From the parent email on each child record' },
  { key: 'volunteer', label: 'Volunteers', hint: 'Everyone in your volunteer list' },
  { key: 'staff', label: 'Staff', hint: 'Staff accounts in your organisation' },
  { key: 'admin', label: 'Admins', hint: 'Admin accounts in your organisation' },
]

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: '🅷' },
  { type: 'text', label: 'Text', icon: '¶' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'callout', label: 'Highlight', icon: '💡' },
  { type: 'button', label: 'Button', icon: '🔘' },
  { type: 'divider', label: 'Divider', icon: '—' },
]

const uid = () => Math.random().toString(36).slice(2, 9)

const blank = (type) => {
  switch (type) {
    case 'heading': return { id: uid(), type, text: '' }
    case 'text': return { id: uid(), type, text: '' }
    case 'image': return { id: uid(), type, url: '', alt: '', caption: '' }
    case 'callout': return { id: uid(), type, title: '', text: '' }
    case 'button': return { id: uid(), type, label: '', url: '' }
    default: return { id: uid(), type }
  }
}

const inp = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', color: 'var(--text)',
}
const miniLabel = {
  fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: 0.6, marginBottom: 5, display: 'block',
}

function BlockEditor({ block, orgId, primary, onChange, onRemove, onMove, isFirst, isLast }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => onChange({ ...block, [k]: v })

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const up = await shrinkImage(file, { maxDimension: 1200 })
    const path = `${orgId}/${Date.now()}-${(up.name || 'image').replace(/[^a-z0-9.]/gi, '_')}`
    const { error } = await supabase.storage
      .from('newsletter-images').upload(path, up, { contentType: up.type })
    if (error) {
      setErr('Could not upload that image.')
    } else {
      // A public URL, not a signed one. An email lives in an inbox for years
      // and a signed URL would stop resolving an hour after sending.
      const { data } = supabase.storage.from('newsletter-images').getPublicUrl(path)
      set('url', data.publicUrl)
    }
    setBusy(false)
    e.target.value = ''
  }

  const meta = BLOCK_TYPES.find(b => b.type === block.type)

  return (
    <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: block.type === 'divider' ? 0 : 10 }}>
        <span aria-hidden="true" style={{ fontSize: 13 }}>{meta?.icon}</span>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {meta?.label || block.type}
        </span>
        <button onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up"
          style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? 'var(--border)' : 'var(--text3)', padding: 3, fontSize: 14 }}>↑</button>
        <button onClick={() => onMove(1)} disabled={isLast} aria-label="Move down"
          style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? 'var(--border)' : 'var(--text3)', padding: 3, fontSize: 14 }}>↓</button>
        <button onClick={onRemove} aria-label="Remove block"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 3, fontSize: 14 }}>✕</button>
      </div>

      {block.type === 'heading' && (
        <input style={inp} value={block.text} placeholder="Section heading"
          onChange={e => set('text', e.target.value)} />
      )}

      {block.type === 'text' && (
        <>
          <textarea style={{ ...inp, minHeight: 110, resize: 'vertical', lineHeight: 1.6 }} value={block.text}
            placeholder="Write your paragraph. Leave a blank line to start a new one."
            onChange={e => set('text', e.target.value)} />
          <button type="button" onClick={() => set('text', `${block.text || ''}{{first_name}}`)}
            style={{ marginTop: 6, padding: '4px 9px', borderRadius: 99, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: primary }}>
            + First name
          </button>
        </>
      )}

      {block.type === 'image' && (
        <>
          {block.url && <img src={block.url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />}
          <input type="file" accept="image/*" onChange={upload} disabled={busy} style={{ fontSize: 12.5, marginBottom: 8 }} />
          {busy && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Uploading…</div>}
          {err && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 6 }}>{err}</div>}
          <label style={miniLabel}>Caption (optional)</label>
          <input style={inp} value={block.caption} onChange={e => set('caption', e.target.value)} placeholder="Caption" />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
            Images here are publicly readable so they still load in an inbox months from now. Don't upload photographs of children unless you have consent to publish them.
          </div>
        </>
      )}

      {block.type === 'callout' && (
        <>
          <input style={{ ...inp, marginBottom: 8 }} value={block.title} placeholder="Highlight title"
            onChange={e => set('title', e.target.value)} />
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={block.text}
            placeholder="What you want to stand out" onChange={e => set('text', e.target.value)} />
        </>
      )}

      {block.type === 'button' && (
        <>
          <input style={{ ...inp, marginBottom: 8 }} value={block.label} placeholder="Button text"
            onChange={e => set('label', e.target.value)} />
          <input style={inp} value={block.url} placeholder="https://…"
            onChange={e => set('url', e.target.value)} />
          {block.url && !/^https?:\/\//i.test(block.url) && (
            <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 6 }}>
              Needs to start with https:// or it won't be linked.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Preview({ subject, preheader, blocks, org }) {
  const primary = org?.primary_color || '#3B82F6'
  const fill = (t) => String(t || '').replaceAll('{{first_name}}', 'Sam')

  return (
    <div style={{ background: '#f4f6f9', padding: 24, borderRadius: 14 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ background: '#0F172A', padding: '28px 32px', textAlign: 'center', borderTop: `4px solid ${primary}` }}>
          {org?.logo_url
            ? <img src={org.logo_url} alt="" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }} />
            : <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{org?.name}</div>}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Powered by LaunchSession</div>
        </div>
        <div style={{ height: 4, background: primary }} />
        <div style={{ padding: '36px 32px' }}>
          {preheader && <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14, fontStyle: 'italic' }}>Inbox preview: {preheader}</div>}
          {blocks.map(b => {
            if (b.type === 'heading' && b.text) return <h2 key={b.id} style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 800, color: '#0F172A' }}>{b.text}</h2>
            if (b.type === 'text' && b.text) return <div key={b.id} style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>{fill(b.text)}</div>
            if (b.type === 'image' && b.url) return (
              <div key={b.id} style={{ marginBottom: 18 }}>
                <img src={b.url} alt={b.alt || ''} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
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
          {!blocks.length && <div style={{ color: '#94A3B8', fontSize: 14 }}>Add a block to see it here.</div>}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text3)', marginTop: 12 }}>
        Subject: {subject || '(none yet)'} · Personalisation shown as "Sam"
      </div>
    </div>
  )
}

export default function NewsletterStudio({ org, session }) {
  const [tab, setTab] = useState('write')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [blocks, setBlocks] = useState([])
  const [roles, setRoles] = useState(['parent'])
  const [audienceCount, setAudienceCount] = useState(null)
  const [past, setPast] = useState([])
  const [draftId, setDraftId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const primary = org?.primary_color || '#3B82F6'

  const load = useCallback(async () => {
    const { data } = await supabase.from('newsletters').select('*')
      .eq('org_id', org?.id).order('created_at', { ascending: false }).limit(20)
    setPast(data || [])
  }, [org?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    supabase.rpc('count_newsletter_audience', { p_roles: roles })
      .then(({ data }) => { if (!cancelled) setAudienceCount(typeof data === 'number' ? data : null) })
    return () => { cancelled = true }
  }, [roles])

  const toggleRole = (k) => setRoles(r => (r.includes(k) ? r.filter(x => x !== k) : [...r, k]))
  const addBlock = (type) => setBlocks(b => [...b, blank(type)])
  const updateBlock = (i, next) => setBlocks(b => b.map((x, j) => (j === i ? next : x)))
  const removeBlock = (i) => setBlocks(b => b.filter((_, j) => j !== i))
  const moveBlock = (i, dir) => setBlocks(b => {
    const j = i + dir
    if (j < 0 || j >= b.length) return b
    const next = [...b]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const hasContent = subject.trim() && blocks.some(b => (b.text || '').trim() || b.url || (b.label || '').trim())

  // Saved before sending, so a send failure leaves the work intact.
  const save = async () => {
    const row = {
      org_id: org?.id,
      subject: subject.trim(),
      preheader: preheader.trim() || null,
      blocks,
      audience_roles: roles,
      status: 'draft',
      created_by: session?.user?.id || null,
    }
    if (draftId) {
      const { error } = await supabase.from('newsletters').update(row).eq('id', draftId)
      if (error) throw new Error(error.message)
      return draftId
    }
    const { data, error } = await supabase.from('newsletters').insert([row]).select().single()
    if (error || !data) throw new Error(error?.message || 'Could not save the newsletter')
    setDraftId(data.id)
    return data.id
  }

  const saveDraft = async () => {
    setBusy(true); setResult(null)
    try { await save(); setResult({ ok: true, text: 'Saved as a draft.' }); load() }
    catch (err) { setResult({ ok: false, text: err.message }) }
    setBusy(false)
  }

  const send = async () => {
    if (!hasContent || busy) return
    const who = audienceCount === null ? 'the selected audience' : `${audienceCount} ${audienceCount === 1 ? 'person' : 'people'}`
    if (!window.confirm(`Send "${subject.trim()}" to ${who}? This cannot be unsent.`)) return

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
          ? `Sent to ${payload.sent}, ${payload.failed} failed. Open it from Sent to retry the failures.`
          : `Sent to ${payload.sent} ${payload.sent === 1 ? 'person' : 'people'}.`,
      })
      if (payload.failed === 0) { setSubject(''); setPreheader(''); setBlocks([]); setDraftId(null) }
      load()
    } catch (err) { setResult({ ok: false, text: err.message }) }
    setBusy(false)
  }

  const openPast = (n) => {
    setSubject(n.subject || '')
    setPreheader(n.preheader || '')
    setBlocks(Array.isArray(n.blocks) ? n.blocks.map(b => ({ ...b, id: b.id || uid() })) : [])
    setRoles(n.audience_roles || ['parent'])
    setDraftId(n.status === 'draft' ? n.id : null)
    setResult(n.status === 'draft' ? null : { ok: true, text: 'Opened as a copy — sending will create a new one.' })
    setTab('write')
  }

  const tabBtn = (k, label) => (
    <button key={k} onClick={() => setTab(k)} style={{
      padding: '8px 15px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
      border: `1.5px solid ${tab === k ? primary : 'var(--border)'}`,
      background: tab === k ? primary : 'transparent',
      color: tab === k ? '#fff' : 'var(--text3)',
      fontSize: 12.5, fontWeight: 800,
    }}>{label}</button>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 40px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>Newsletter Studio</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
          Build it in blocks, preview it, send it to your people.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabBtn('write', 'Write')}
        {tabBtn('preview', 'Preview')}
        {tabBtn('past', `Sent & drafts (${past.length})`)}
      </div>

      {result && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14,
          background: result.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: result.ok ? '#15803D' : '#B91C1C',
        }}>{result.text}</div>
      )}

      {tab === 'write' && (
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1fr)' }}>
          <div>
            <label style={miniLabel}>Subject</label>
            <input style={{ ...inp, marginBottom: 12 }} value={subject}
              onChange={e => setSubject(e.target.value)} placeholder="What's this newsletter about?" />

            <label style={miniLabel}>Inbox preview line (optional)</label>
            <input style={{ ...inp, marginBottom: 16 }} value={preheader}
              onChange={e => setPreheader(e.target.value)} placeholder="The grey line shown after the subject" />

            <label style={miniLabel}>Who gets it</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
              {AUDIENCES.map(a => {
                const active = roles.includes(a.key)
                return (
                  <button key={a.key} type="button" onClick={() => toggleRole(a.key)} title={a.hint} style={{
                    padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                    border: `1.5px solid ${active ? primary : 'var(--border)'}`,
                    background: active ? `${primary}18` : 'transparent',
                    color: active ? primary : 'var(--text3)',
                  }}>{a.label}</button>
                )
              })}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 18 }}>
              {roles.length === 0
                ? 'Pick at least one group.'
                : audienceCount === null
                  ? 'Counting…'
                  : `${audienceCount} ${audienceCount === 1 ? 'person' : 'people'} will receive this. Duplicates across groups are only counted once.`}
            </div>

            <label style={miniLabel}>Content</label>
            {blocks.map((b, i) => (
              <BlockEditor
                key={b.id}
                block={b}
                orgId={org?.id}
                primary={primary}
                onChange={next => updateBlock(i, next)}
                onRemove={() => removeBlock(i)}
                onMove={dir => moveBlock(i, dir)}
                isFirst={i === 0}
                isLast={i === blocks.length - 1}
              />
            ))}

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 4 }}>
              {BLOCK_TYPES.map(t => (
                <button key={t.type} type="button" onClick={() => addBlock(t.type)} style={{
                  padding: '8px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: '1.5px dashed var(--border)', background: 'transparent',
                  color: 'var(--text3)', fontSize: 12.5, fontWeight: 700,
                }}>+ {t.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              <button onClick={saveDraft} disabled={busy || !subject.trim()} style={{
                padding: '12px 20px', borderRadius: 11, border: '1.5px solid var(--border)',
                background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700,
                cursor: busy || !subject.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: busy || !subject.trim() ? 0.5 : 1,
              }}>Save draft</button>
              <button onClick={send} disabled={busy || !hasContent || roles.length === 0} style={{
                padding: '12px 24px', borderRadius: 11, border: 'none', background: primary,
                color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                cursor: busy || !hasContent || roles.length === 0 ? 'default' : 'pointer',
                opacity: busy || !hasContent || roles.length === 0 ? 0.5 : 1,
              }}>{busy ? 'Sending…' : 'Send newsletter'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'preview' && <Preview subject={subject} preheader={preheader} blocks={blocks} org={org} />}

      {tab === 'past' && (
        <div>
          {past.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 14 }}>Nothing yet.</div>}
          {past.map(n => (
            <button key={n.id} onClick={() => openPast(n)} style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 15px', marginBottom: 9, borderRadius: 12, cursor: 'pointer',
              border: '1.5px solid var(--border)', background: 'var(--surface)', fontFamily: 'inherit',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.subject}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {n.status === 'draft'
                    ? 'Draft'
                    : `Sent to ${n.sent_count}${n.failed_count ? ` · ${n.failed_count} failed` : ''}`}
                  {' · '}{new Date(n.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

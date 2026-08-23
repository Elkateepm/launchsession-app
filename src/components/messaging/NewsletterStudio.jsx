import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import shrinkImage from '../../lib/shrinkImage'
import AudienceBuilder from './AudienceBuilder'

// Newsletter Studio.
//
// A newsletter is an ordered array of blocks stored on the `newsletters` row.
// The blocks are rendered to email HTML server-side in the send route; the
// preview here is an on-screen approximation of that. Two renderers is a known
// cost -- the alternative is shipping the email HTML into the browser -- so
// they are kept deliberately close and any change to one wants the other.
//
// Audience is resolved at send time rather than frozen into the draft, so a
// newsletter written on Monday and sent on Friday goes to whoever is on the
// books on Friday.

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: 'H', hint: 'Section title' },
  { type: 'text', label: 'Text', icon: '¶', hint: 'A paragraph' },
  { type: 'image', label: 'Image', icon: '🖼', hint: 'A photo' },
  { type: 'callout', label: 'Highlight', icon: '★', hint: 'Make it stand out' },
  { type: 'button', label: 'Button', icon: '⬤', hint: 'A link to tap' },
  { type: 'divider', label: 'Divider', icon: '—', hint: 'A line break' },
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
  const iconBtn = (disabled) => ({
    background: 'none', border: 'none', padding: '3px 5px', fontSize: 13,
    cursor: disabled ? 'default' : 'pointer', color: disabled ? 'var(--border)' : 'var(--text3)',
  })

  return (
    <div style={{ border: '1.5px solid var(--border)', borderRadius: 13, padding: 13, marginBottom: 10, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: block.type === 'divider' ? 0 : 11 }}>
        <span aria-hidden="true" style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 800,
          background: `${primary}18`, color: primary,
        }}>{meta?.icon}</span>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {meta?.label || block.type}
        </span>
        <button onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" style={iconBtn(isFirst)}>↑</button>
        <button onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" style={iconBtn(isLast)}>↓</button>
        <button onClick={onRemove} aria-label={`Remove ${meta?.label || 'block'}`} style={iconBtn(false)}>✕</button>
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
            style={{ marginTop: 7, padding: '4px 10px', borderRadius: 99, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: primary, fontFamily: 'inherit' }}>
            + Their first name
          </button>
        </>
      )}

      {block.type === 'image' && (
        <>
          {block.url && <img src={block.url} alt="" style={{ width: '100%', borderRadius: 9, marginBottom: 9, display: 'block' }} />}
          <input type="file" accept="image/*" onChange={upload} disabled={busy} style={{ fontSize: 12.5, marginBottom: 9 }} />
          {busy && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Uploading…</div>}
          {err && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 6 }}>{err}</div>}
          <label style={miniLabel}>Caption (optional)</label>
          <input style={inp} value={block.caption} onChange={e => set('caption', e.target.value)} placeholder="Caption" />
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 9, lineHeight: 1.5, paddingLeft: 9, borderLeft: '2px solid var(--border)' }}>
            Images here are publicly readable, so they still load in an inbox a year from now. Don't upload photographs of young people unless you have consent to publish them.
          </div>
        </>
      )}

      {block.type === 'callout' && (
        <>
          <input style={{ ...inp, marginBottom: 9 }} value={block.title} placeholder="Highlight title"
            onChange={e => set('title', e.target.value)} />
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={block.text}
            placeholder="What you want to stand out" onChange={e => set('text', e.target.value)} />
        </>
      )}

      {block.type === 'button' && (
        <>
          <input style={{ ...inp, marginBottom: 9 }} value={block.label} placeholder="Button text"
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
  const [tab, setTab] = useState('write')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [blocks, setBlocks] = useState([])
  const [roles, setRoles] = useState(['parent'])
  const [groupNames, setGroupNames] = useState([])
  const [projectIds, setProjectIds] = useState([])
  const [manualEmails, setManualEmails] = useState([])
  const [excludedEmails, setExcludedEmails] = useState([])
  const [resolved, setResolved] = useState([])
  const audienceCount = resolved.filter(r => !r.suppressed).length
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
  const canSend = hasContent && roles.length > 0 && audienceCount > 0 && !busy

  // Says what is actually missing rather than leaving a disabled button with no
  // explanation, which was the main thing wrong with the first version.
  const blocker = !subject.trim() ? 'Add a subject to send.'
    : blocks.length === 0 ? 'Add at least one block of content.'
    : !hasContent ? 'Your blocks are still empty.'
    : roles.length === 0 ? 'Choose who gets it.'
    : audienceCount === 0 ? 'Nobody in that audience can be emailed.'
    : null

  const save = async () => {
    const row = {
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
    if (!canSend) return
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
          ? `Sent to ${payload.sent}, ${payload.failed} failed. Open it from Sent to retry.`
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
    setGroupNames(n.audience?.group_names || [])
    setProjectIds(n.audience?.project_ids || [])
    setManualEmails(n.manual_emails || [])
    setExcludedEmails(n.excluded_emails || [])
    setDraftId(n.status === 'draft' ? n.id : null)
    setResult(n.status === 'draft' ? null : { ok: true, text: 'Opened as a copy — sending will create a new one.' })
    setTab('write')
  }

  // On a wide screen the preview is always on screen, so a Preview tab would
  // just be a tab that does nothing.
  const TABS = wide
    ? [['write', 'Write'], ['past', `Sent & drafts (${past.length})`]]
    : [['write', 'Write'], ['preview', 'Preview'], ['past', `Sent & drafts (${past.length})`]]

  const composer = (
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
            onChange={next => updateBlock(i, next)}
            onRemove={() => removeBlock(i)}
            onMove={dir => moveBlock(i, dir)}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
          />
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8, marginTop: 4 }}>
          {BLOCK_TYPES.map(t => (
            <button key={t.type} type="button" onClick={() => addBlock(t.type)} title={t.hint}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '11px 6px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--text3)', fontSize: 11.5, fontWeight: 700,
              }}>
              <span aria-hidden="true" style={{ fontSize: 14, color: primary }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, zIndex: 5,
        background: 'var(--bg, var(--surface))', paddingTop: 10, paddingBottom: 14,
        borderTop: '1px solid var(--border)',
      }}>
        {blocker && (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 9 }}>{blocker}</div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={saveDraft} disabled={busy || !subject.trim()} style={{
            padding: '12px 20px', borderRadius: 11, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700,
            cursor: busy || !subject.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: busy || !subject.trim() ? 0.5 : 1,
          }}>Save draft</button>
          <button onClick={send} disabled={!canSend} style={{
            flex: 1, minWidth: 190,
            padding: '12px 24px', borderRadius: 11, border: 'none', background: primary,
            color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
            cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.45,
          }}>
            {busy ? 'Sending…' : audienceCount
              ? `Send to ${audienceCount} ${audienceCount === 1 ? 'person' : 'people'}`
              : 'Send newsletter'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 32px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>Newsletter Studio</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
          Build it in blocks, watch it come together, send it to your people.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 15px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${tab === k ? primary : 'var(--border)'}`,
            background: tab === k ? primary : 'transparent',
            color: tab === k ? '#fff' : 'var(--text3)',
            fontSize: 12.5, fontWeight: 800,
          }}>{label}</button>
        ))}
      </div>

      {result && (
        <div style={{
          padding: '11px 15px', borderRadius: 11, fontSize: 13, fontWeight: 600, marginBottom: 14,
          background: result.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: result.ok ? '#15803D' : '#B91C1C',
        }}>{result.text}</div>
      )}

      {tab === 'write' && (
        wide ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
            <div>{composer}</div>
            <div style={{ position: 'sticky', top: 8 }}>
              <Preview subject={subject} preheader={preheader} blocks={blocks} org={org} compact />
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>{composer}</div>
        )
      )}

      {tab === 'preview' && <Preview subject={subject} preheader={preheader} blocks={blocks} org={org} />}

      {tab === 'past' && (
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
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

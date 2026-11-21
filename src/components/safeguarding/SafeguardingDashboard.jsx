import React, { useState, useEffect, useCallback, useId } from 'react'
import { supabase } from '../../lib/supabase'
import SignedImg from '../shared/SignedImg'
import SessionSheet, { flowButton, flowInput } from '../sessions/SessionSheet'
import { signOne } from '../../lib/storageUrl'
import Icon from '../../lib/icons'
import {
  CONCERN_PRIORITY, CONCERN_STATUS, MOODS, ageFrom, childFlags, concernLabel, concernProblems, formatDay, fullName,
  isHandedOver, isOpenConcern, moodOf, relativeDay,
} from './sgModel'
import { signalChips } from './SafeguardingOverview'
import { SG_RED } from './ConcernSheet'

// The hub's list views: concerns, children, documents and the audit log.
// The hub itself loads the data and owns the sheets these open, so a concern
// or a child's file opens the same way from here, from Overview and from
// anywhere that links in.

export { isHandedOver }

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }
const pill = (on) => ({ minHeight: 44, padding: '0 14px', borderRadius: 999, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, border: `1px solid ${on ? 'var(--danger-border)' : 'var(--border)'}`, background: on ? 'var(--danger-bg)' : 'var(--surface)', color: on ? 'var(--danger-text)' : 'var(--text2)', whiteSpace: 'nowrap' })
const search = { ...flowInput, background: 'var(--surface)', maxWidth: 420 }
const TONE = { danger: ['var(--danger-bg)', 'var(--danger-text)'], warn: ['var(--warn-bg)', 'var(--warn-text)'], info: ['var(--info-bg)', 'var(--info-text)'], ok: ['var(--ok-bg)', 'var(--ok-text)'] }

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDay(ts)
}

// What an open concern looks like when it has gone wrong, as one row per
// problem. The hub's Overview now groups these per concern (sgModel's
// hubAttention); this stays because the handover rules are pinned by tests
// against it.
export function attentionItems(cases) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOpen = c => c.status !== 'resolved' && c.status !== 'closed'
  const days = ts => Math.floor((today - new Date(ts)) / 86400000)
  const out = []
  for (const c of cases) {
    if (!isOpen(c)) continue
    // Chasing a concern that is already a case is chasing work somebody is
    // actively doing somewhere else.
    if (isHandedOver(c)) continue
    if (!c.dsl_notified) out.push({ id: c.id + '-dsl', c, rank: 0, title: 'DSL not notified', detail: c.child_name || 'Unnamed concern' })
    if (c.follow_up_required && c.follow_up_due) {
      const due = new Date(c.follow_up_due); due.setHours(0, 0, 0, 0)
      const overdue = Math.floor((today - due) / 86400000)
      if (overdue > 0) out.push({ id: c.id + '-od', c, rank: 1, title: `Follow-up ${overdue} day${overdue === 1 ? '' : 's'} overdue`, detail: c.child_name })
      else if (overdue === 0) out.push({ id: c.id + '-due', c, rank: 2, title: 'Follow-up due today', detail: c.child_name })
    }
    if (c.follow_up_required && !c.follow_up_due) out.push({ id: c.id + '-nodate', c, rank: 3, title: 'Follow-up has no date set', detail: c.child_name })
    if (!c.assigned_to) out.push({ id: c.id + '-unassigned', c, rank: 4, title: 'Nobody assigned', detail: c.child_name })
    if (c.created_at && days(c.created_at) >= 14) out.push({ id: c.id + '-stale', c, rank: 5, title: `Open ${days(c.created_at)} days`, detail: c.child_name })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

// ── CONCERNS ─────────────────────────────────────────
// A handed-over concern is its own bucket rather than an open or a closed
// one: filed under either it looks like work nobody is doing, or like work
// that finished, and it is neither.
const followingUp = (c) => !isHandedOver(c) && c.follow_up_required && isOpenConcern(c)
export const CONCERN_FILTERS = {
  needs: { label: 'Needs action', test: (c, today) => concernProblems(c, today).length > 0 },
  open: { label: 'Open', test: (c) => !isHandedOver(c) && isOpenConcern(c) },
  follow_up: { label: 'Follow-up', test: followingUp },
  escalated: { label: 'Now cases', test: isHandedOver },
  resolved: { label: 'Resolved', test: (c) => !isHandedOver(c) && c.status === 'resolved' },
  closed: { label: 'Closed', test: (c) => !isHandedOver(c) && c.status === 'closed' },
  all: { label: 'All', test: () => true },
}
const URGENCY_RANK = { urgent: 0, soon: 1, later: 2 }
const sortRank = (c, today) => {
  const p = concernProblems(c, today)
  if (p.length) return Math.min(...p.map(x => URGENCY_RANK[x.urgency]))
  return isOpenConcern(c) && !isHandedOver(c) ? 3 : 4
}

function ConcernsView({ concerns, loading, today, filter, setFilter, onOpenConcern, onReport, mobile }) {
  const [q, setQ] = useState('')
  const searchId = useId()
  const counts = Object.fromEntries(Object.entries(CONCERN_FILTERS).map(([k, f]) => [k, concerns.filter(c => f.test(c, today)).length]))
  const term = q.trim().toLowerCase()
  const list = concerns
    .filter(c => (CONCERN_FILTERS[filter] || CONCERN_FILTERS.all).test(c, today))
    .filter(c => !term || [c.child_name, c.concern_type, c.location, c.submitter_name].some(v => (v || '').toLowerCase().includes(term)))
    .map((c, i) => ({ c, i, r: sortRank(c, today) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.c)

  return (
    <div>
      <label htmlFor={searchId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search concerns</label>
      <input id={searchId} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by child, type, place or who reported it" style={{ ...search, marginBottom: 10 }} />
      <div role="group" aria-label="Show" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {Object.entries(CONCERN_FILTERS).filter(([k]) => k !== 'escalated' || counts.escalated).map(([k, f]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={pill(filter === k)}>
            {f.label} <span style={{ opacity: .75 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Loading concerns…</div>
      ) : list.length === 0 ? (
        <div style={{ ...card, padding: '44px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontSize: 34, marginBottom: 8, color: 'var(--ok-text)' }}><Icon name="🛡️" /></div>
          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', marginBottom: 4 }}>{term ? 'No concerns match that search' : filter === 'needs' ? 'Nothing needs action' : 'No concerns here'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 16 }}>If something worries you about a child, report it. Small things matter.</div>
          <button type="button" onClick={() => onReport({})} style={{ ...flowButton, border: 'none', background: SG_RED, color: '#fff' }}><Icon name="🛡️" /> Report a concern</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((c, i) => {
            const handed = isHandedOver(c)
            const sc = CONCERN_STATUS[c.status] || CONCERN_STATUS.open
            const pc = CONCERN_PRIORITY[c.priority] || null
            const problems = concernProblems(c, today)
            const urgent = problems.some(p => p.urgency === 'urgent')
            return (
              <button key={c.id} type="button" onClick={() => onOpenConcern(c.id)} className="ls-rise ls-row"
                style={{ ...card, animationDelay: `${Math.min(i, 8) * 45}ms`, display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: mobile ? 12 : '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderLeft: `4px solid ${urgent ? '#DC2626' : problems.length ? '#D97706' : handed ? '#7C3AED' : isOpenConcern(c) ? 'var(--border)' : '#16A34A'}`, transition: 'transform .18s ease, border-color .18s ease' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>{c.child_name || 'Unnamed'}</span>
                    <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text2)' }}>{concernLabel(c)}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                    {handed
                      ? <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--info-text)', background: 'var(--info-bg)', padding: '2px 8px', borderRadius: 999 }}>Now a case</span>
                      : <span style={{ fontSize: 11.5, fontWeight: 800, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 999 }}>{sc.label}</span>}
                    {pc && <span style={{ fontSize: 11.5, fontWeight: 800, color: pc.color, background: pc.bg, padding: '2px 8px', borderRadius: 999 }}>{pc.label}</span>}
                  </span>
                  {problems.length > 0 && (
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 750, color: urgent ? 'var(--danger-text)' : 'var(--warn-text)', marginTop: 6, lineHeight: 1.4 }}>
                      <Icon name="⚠️" /> {problems.map(p => p.text).join(' · ')}
                    </span>
                  )}
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)', marginTop: 5 }}>
                    {[`Raised ${relativeDay(c.created_at, today)}`, c.location, c.submitter_name && `by ${c.submitter_name}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span style={{ alignSelf: 'center', fontSize: 13, fontWeight: 850, color: handed ? 'var(--info-text)' : 'var(--danger-text)', whiteSpace: 'nowrap' }}>Open <Icon name="→" /></span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── WELLBEING CHECK-IN ─────────────────────────────────────────
export function WellbeingQuickLog({ child, orgId, userId, onClose, onLogged }) {
  const [mood, setMood] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const noteId = useId()

  const submit = async () => {
    if (!mood) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('wellbeing_checks').insert({ org_id: orgId, child_id: child.id, mood, note: note.trim() || null, logged_by: userId })
    setSaving(false)
    if (err) { setError(err.message); return }
    onLogged && onLogged()
    onClose()
  }

  return (
    <SessionSheet title={`How's ${child.first_name} today?`} subtitle="A quick check-in. It goes on their safeguarding file." onClose={onClose} busy={saving} width={480}
      footer={<button type="button" onClick={submit} disabled={!mood || saving} style={{ ...flowButton, width: '100%', border: 'none', background: mood ? SG_RED : 'var(--border)', color: mood ? '#fff' : 'var(--text2)', cursor: mood ? 'pointer' : 'default' }}>{saving ? 'Saving…' : 'Save check-in'}</button>}>
      <div role="group" aria-label="Mood" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {MOODS.map(m => {
          const on = mood === m.key
          return (
            <button key={m.key} type="button" aria-pressed={on} onClick={() => setMood(m.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 72, padding: '10px 2px', borderRadius: 14, border: on ? `2px solid ${m.color}` : '1px solid var(--border)', background: on ? 'var(--surface2)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span aria-hidden="true" style={{ fontSize: 26 }}>{m.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: on ? m.color : 'var(--text2)' }}>{m.label}</span>
            </button>
          )
        })}
      </div>
      <label htmlFor={noteId} style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6 }}>Anything to note? (optional)</label>
      <textarea id={noteId} value={note} onChange={e => setNote(e.target.value)} placeholder="What they said or did, in their words where you can"
        style={{ ...flowInput, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
      {['worried', 'upset'].includes(mood) && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--warn-text)', background: 'var(--warn-bg)', borderRadius: 12, padding: '10px 12px', lineHeight: 1.45 }}>
          If what they said worries you, report a concern as well. A check-in on its own does not reach the safeguarding lead.
        </div>
      )}
      {error && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: 'var(--danger-text)' }}>{error}</div>}
    </SessionSheet>
  )
}

// ── CHILDREN ─────────────────────────────────────────
const CHILD_FILTERS = {
  all: { label: 'Everyone', test: () => true },
  watch: { label: 'Keep an eye on', test: (s) => (s?.score || 0) > 0 },
  concerns: { label: 'Open concern or case', test: (s) => !!(s?.openConcerns || s?.openCases) },
  low: { label: 'Low moods lately', test: (s) => !!s?.lowMoods },
}

function ChildrenView({ children, signals, loading, today, onOpenChild, onCheckIn, mobile }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const searchId = useId()
  const term = q.trim().toLowerCase()
  const counts = Object.fromEntries(Object.entries(CHILD_FILTERS).map(([k, f]) => [k, children.filter(ch => f.test(signals[ch.id])).length]))
  const list = children
    .filter(ch => CHILD_FILTERS[filter].test(signals[ch.id]))
    .filter(ch => !term || fullName(ch).toLowerCase().includes(term) || (ch.group_name || '').toLowerCase().includes(term))
    .sort((a, b) => (signals[b.id]?.score || 0) - (signals[a.id]?.score || 0) || fullName(a).localeCompare(fullName(b)))

  return (
    <div>
      <label htmlFor={searchId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search children</label>
      <input id={searchId} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or group" style={{ ...search, marginBottom: 10 }} />
      <div role="group" aria-label="Show" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {Object.entries(CHILD_FILTERS).map(([k, f]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={pill(filter === k)}>{f.label} <span style={{ opacity: .75 }}>{counts[k]}</span></button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ ...card, padding: '44px 24px', textAlign: 'center', borderStyle: 'dashed', color: 'var(--text2)' }}>
          <div style={{ fontWeight: 850, color: 'var(--text)', marginBottom: 4 }}>{filter === 'all' ? 'No children found' : 'Nobody here right now'}</div>
          {filter !== 'all' && <div style={{ fontSize: 13.5 }}>That's good news.</div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {list.map((ch, i) => {
            const s = signals[ch.id]
            const mood = s?.lastCheck ? moodOf(s.lastCheck.mood) : null
            const chips = signalChips(s)
            const age = ageFrom(ch.date_of_birth, today)
            const flags = childFlags(ch).slice(0, 4)
            return (
              <article key={ch.id} className="ls-rise" aria-label={fullName(ch)} style={{ ...card, animationDelay: `${Math.min(i, 10) * 40}ms`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: chips.length ? 'var(--danger-bg)' : 'var(--surface2)', color: chips.length ? 'var(--danger-text)' : 'var(--text2)', display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0, overflow: 'hidden' }}>
                    {ch.photo_url ? <SignedImg bucket="gallery" src={ch.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (ch.first_name?.[0] || '?')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>{fullName(ch)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{[age != null ? `${age} years old` : 'Age unknown', ch.group_name].filter(Boolean).join(' · ')}</div>
                  </div>
                  {mood && <span title={`Last check-in: ${mood.label}, ${relativeDay(s.lastCheck.created_at, today)}`} aria-label={`Last check-in: ${mood.label}`} style={{ fontSize: 22 }}>{mood.emoji}</span>}
                </div>
                {(chips.length > 0 || flags.length > 0 || s?.concernsEver > 0) && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {chips.map(c => <span key={c.label} style={{ fontSize: 11.5, fontWeight: 800, color: c.fg, background: c.bg, padding: '2px 8px', borderRadius: 999 }}>{c.label}</span>)}
                    {!chips.length && s?.concernsEver > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 999 }}>{s.concernsEver} past {s.concernsEver === 1 ? 'concern' : 'concerns'}</span>}
                    {flags.map(f => { const [bg, fg] = TONE[f.tone]; return <span key={f.key} style={{ fontSize: 11.5, fontWeight: 700, color: fg, background: bg, padding: '2px 8px', borderRadius: 999 }}>{f.label}</span> })}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                  <button type="button" onClick={() => onOpenChild(ch.id)} style={{ ...flowButton, border: 'none', background: 'var(--text)', color: 'var(--surface)', fontSize: 13.5 }}>Open file</button>
                  <button type="button" onClick={() => onCheckIn(ch)} style={{ ...flowButton, fontSize: 13.5 }}><Icon name="💬" /> Check-in</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The Medical tab that stood here listed children carrying an allergy, an
// EpiPen, asthma, diabetes or medication. Medical Alerts is its own screen
// reading the same `children` table with the same flags, plus review
// tracking, so the child file links there instead of keeping a second copy.

// ── DOCUMENTS ─────────────────────────────────────────
function DocumentsTab({ org, userId, mobile }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    supabase.from('safeguarding_documents').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).then(({ data }) => {
      setDocs(data || [])
      setLoading(false)
    })
  }, [org.id])

  useEffect(() => { load() }, [load])

  const handleFiles = async (files) => {
    setError('')
    setUploading(true)
    for (const file of Array.from(files)) {
      const path = `${org.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('safeguarding-docs').upload(path, file)
      if (upErr) { setError(upErr.message); continue }
      await supabase.from('safeguarding_documents').insert({ org_id: org.id, file_name: file.name, file_path: path, file_type: file.type, uploaded_by: userId })
    }
    setUploading(false)
    load()
  }

  // safeguarding-docs is a private bucket: sign on click, a short-lived link opened once.
  const openDoc = async (path) => {
    const url = await signOne('safeguarding-docs', path, 300)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const fileIcon = (type) => (type?.includes('image') ? '🖼️' : type?.includes('pdf') ? '📄' : '📎')

  return (
    <div>
      {org.safeguarding_policy_url && (
        <button type="button" onClick={() => openDoc(org.safeguarding_policy_url)}
          style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 14, marginBottom: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderColor: 'var(--danger-border)' }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--danger-bg)', color: 'var(--danger-text)', display: 'grid', placeItems: 'center', fontSize: 18 }}><Icon name="🛡️" /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 850, color: 'var(--text)' }}>Our safeguarding policy</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)' }}>The version uploaded in Settings</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 850, color: 'var(--danger-text)' }}>Open <Icon name="→" /></span>
        </button>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        style={{ border: `2px dashed ${dragOver ? SG_RED : 'var(--border)'}`, borderRadius: 20, padding: mobile ? '28px 16px' : '40px 24px', textAlign: 'center', marginBottom: 20, background: dragOver ? 'var(--danger-bg)' : 'var(--surface)', transition: 'background .15s, border-color .15s' }}>
        <div style={{ fontSize: 34, marginBottom: 8, color: 'var(--text2)' }}><Icon name="📤" /></div>
        <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)', marginBottom: 10 }}>{mobile ? 'Add body maps, referral letters or meeting notes' : 'Drop files here, or'}</div>
        <label style={{ ...flowButton, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: SG_RED, color: '#fff' }}>
          {uploading ? 'Uploading…' : 'Choose files'}
          <input type="file" multiple hidden onChange={e => handleFiles(e.target.files)} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
        {!mobile && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 10 }}>PDFs, images, body maps, referral letters, meeting notes</div>}
        {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--danger-text)', fontWeight: 650 }}>{error}</div>}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text2)' }}>No documents uploaded yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {docs.map(d => (
            <button key={d.id} type="button" onClick={() => openDoc(d.file_path)}
              style={{ ...card, padding: 14, minHeight: 56, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit' }}>
              <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--text2)' }}><Icon name={fileIcon(d.file_type)} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{timeAgo(d.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AUDIT LOG ─────────────────────────────────────────
function AuditLogTab({ org }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('safeguarding_audit_log').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setEntries(data || [])
      setLoading(false)
    })
  }, [org.id])

  const eventIcon = (type) => ({ status_change: '🔄', created: '➕', assigned: '👤', assignment: '👤', contacted: '📞', escalated: '📁', dsl_notified: '🛡️' }[type] || '📝')

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Loading…</div>
  if (entries.length === 0) return (
    <div style={{ ...card, padding: '48px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
      <div style={{ fontWeight: 850, color: 'var(--text)' }}>No activity recorded yet</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Every change to a concern is recorded here, with who made it.</div>
    </div>
  )

  return (
    <div style={{ ...card, padding: '6px 18px' }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', color: 'var(--text2)', display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}><Icon name={eventIcon(e.event_type)} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{e.detail || e.event_type}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {timeAgo(e.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── VIEWS ─────────────────────────────────────────
export default function SafeguardingDashboard({
  org, userId, view, concerns, children, signals, loading, today, filter, setFilter, mobile,
  onOpenConcern, onOpenChild, onCheckIn, onReport,
}) {
  if (view === 'concerns') return <ConcernsView concerns={concerns} loading={loading} today={today} filter={filter} setFilter={setFilter} onOpenConcern={onOpenConcern} onReport={onReport} mobile={mobile} />
  if (view === 'children') return <ChildrenView children={children} signals={signals} loading={loading} today={today} onOpenChild={onOpenChild} onCheckIn={onCheckIn} mobile={mobile} />
  if (view === 'documents') return <DocumentsTab org={org} userId={userId} mobile={mobile} />
  if (view === 'audit') return <AuditLogTab org={org} />
  return null
}

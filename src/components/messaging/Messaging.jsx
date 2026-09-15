import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimeTable } from '../../lib/useRealtimeTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { notifyEvent } from '../../services/notifyEvent'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'
import {
  MANUAL_AUDIENCES, FILTERS, QUICK_MESSAGES,
  audienceOf, isDirect, directUserId, notificationTargets,
  displayName, initials, buildTimeline, latestByThread, isUnread,
  clockTime, listTime,
} from './messagingShared'

// Team messaging: a conversation list and the open conversation.
//
// Side by side from 768px (useIsMobile), one at a time below that. The page fills the height
// left under the app header and each pane scrolls on its own, so the composer
// stays in reach instead of sitting at the bottom of a 70vh box.

const SEEN_KEY = (orgId, userId) => `ls_msg_seen_${orgId}_${userId}`
const readSeen = (key) => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch (e) { return {} } }
const writeSeen = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {} }

const PROFILE_COLUMNS = 'id, full_name, first_name, last_name, preferred_name, photo_url, role'

function Avatar({ profile, name, size = 36, color }) {
  const label = name || displayName(profile)
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(size * 0.38), fontWeight: 800, letterSpacing: 0.2,
  }
  if (profile?.photo_url) {
    return (
      <div style={{ ...base, background: 'var(--surface3)' }}>
        <SignedImg bucket="staff-photos" src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div aria-hidden="true" style={{ ...base, background: color ? color + '1A' : 'var(--org-a10)', color: color || 'var(--org-ink)' }}>
      {initials(label)}
    </div>
  )
}

function AudienceMark({ audience, size = 40, profile }) {
  const aud = audienceOf(audience)
  if (isDirect(audience)) return <Avatar profile={profile} size={size} color={aud.color} />
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: aud.color + '14', color: aud.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={aud.icon} size={Math.round(size * 0.45)} />
    </div>
  )
}

function threadTitle(thread, profiles) {
  if (isDirect(thread.audience)) {
    const who = profiles[directUserId(thread.audience)]
    return who ? displayName(who) : (thread.subject || 'Direct message')
  }
  return thread.subject || 'Untitled conversation'
}

// ─── Conversation ──────────────────────────────────────────────

function Conversation({ thread, org, userId, profiles, ensureProfiles, eventTitle, readOnly, isMobile, onBack, onActivity }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [showQuick, setShowQuick] = useState(false)
  const [newBelow, setNewBelow] = useState(0)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const atBottom = useRef(true)
  const lastCount = useRef(0)
  const aud = audienceOf(thread.audience)
  const title = threadTitle(thread, profiles)

  const scrollToBottom = (smooth) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setNewBelow(0)
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('message_thread_messages')
      .select('id, thread_id, sender_id, body, created_at')
      .eq('thread_id', thread.id).order('created_at', { ascending: true })
    const rows = data || []
    ensureProfiles(rows.map(m => m.sender_id))
    // Keep what is still sending or failed, and anything just confirmed that a
    // poll which started before the send has not seen yet -- otherwise a
    // message can blink out for a poll interval after it was sent.
    setMessages(prev => {
      const newest = rows.length ? new Date(rows[rows.length - 1].created_at) : new Date(0)
      const extras = prev.filter(m => !rows.some(r => r.id === m.id) && (m._local || new Date(m.created_at) > newest))
      return extras.length ? [...rows, ...extras].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : rows
    })
    setLoading(false)
  }, [thread.id, ensureProfiles])

  useEffect(() => {
    setMessages([]); setLoading(true); setDraft(''); setShowQuick(false)
    lastCount.current = 0; atBottom.current = true
    load()
  }, [thread.id, load])
  useRealtimeTable('message_thread_messages', load, { filter: `thread_id=eq.${thread.id}`, pollInterval: 4000 })

  // Follow new messages only when already at the bottom. Someone reading back
  // through a thread should not be yanked down by every poll.
  useEffect(() => {
    const count = messages.length
    if (count === lastCount.current) return
    const added = count - lastCount.current
    const first = lastCount.current === 0
    lastCount.current = count
    const mineLast = messages[count - 1]?.sender_id === userId
    if (first || atBottom.current || mineLast) {
      requestAnimationFrame(() => scrollToBottom(!first))
    } else if (added > 0) {
      setNewBelow(n => n + added)
    }
    if (count) onActivity(thread.id, messages[count - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom.current && newBelow) setNewBelow(0)
  }

  // Grow the composer with its content, up to a few lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [draft])

  const send = async (retry) => {
    const text = retry ? retry.body : draft.trim()
    if (!text) return
    const localId = retry ? retry.id : `local-${Date.now()}`
    const pending = { id: localId, _local: true, status: 'sending', thread_id: thread.id, sender_id: userId, body: text, created_at: new Date().toISOString() }
    setMessages(m => retry ? m.map(x => x.id === localId ? pending : x) : [...m, pending])
    if (!retry) setDraft('')
    setShowQuick(false)

    const { data, error } = await supabase.from('message_thread_messages')
      .insert({ thread_id: thread.id, org_id: org.id, sender_id: userId, body: text })
      .select('id, thread_id, sender_id, body, created_at').single()

    if (error || !data) {
      // The text stays on screen with a retry, rather than being cleared and lost.
      setMessages(m => m.map(x => x.id === localId ? { ...x, status: 'failed' } : x))
      return
    }
    setMessages(m => {
      const withoutLocal = m.filter(x => x.id !== localId)
      return withoutLocal.some(x => x.id === data.id) ? withoutLocal : [...withoutLocal, data]
    })
    onActivity(thread.id, data)
    await supabase.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id)

    // Best-effort: never blocks sending, and the server re-checks every id
    // against the sender's own organisation.
    const { roles, extraIds } = notificationTargets(thread.audience)
    supabase.from('user_profiles').select('id').eq('org_id', org.id).in('role', roles).then(({ data: members }) => {
      const ids = [...new Set([...(members || []).map(p => p.id), ...extraIds])].filter(id => id && id !== userId)
      if (ids.length) notifyEvent('NEW_MESSAGE', { target_user_ids: ids, thread_id: thread.id })
    })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
  }

  const timeline = useMemo(() => buildTimeline(messages), [messages])
  const dmProfile = isDirect(thread.audience) ? profiles[directUserId(thread.audience)] : null

  return (
    <section aria-label={title} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, flex: 1, background: 'var(--surface2)' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '10px 12px' : '14px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {isMobile && (
          <button onClick={onBack} aria-label="Back to conversations" style={iconButton}>
            <Icon name="←" size={20} />
          </button>
        )}
        <AudienceMark audience={thread.audience} size={isMobile ? 36 : 40} profile={dmProfile} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: 'var(--text3)', minWidth: 0 }}>
            <span style={{ color: aud.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{aud.label}</span>
            {eventTitle && <><span aria-hidden="true">·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventTitle}</span></>}
            {!eventTitle && !isMobile && <><span aria-hidden="true">·</span><span style={{ whiteSpace: 'nowrap' }}>For {aud.who.charAt(0).toLowerCase() + aud.who.slice(1)}</span></>}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={scrollRef} onScroll={onScroll} role="log" aria-live="polite"
          style={{ position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px 12px 8px' : '18px 24px 10px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
              {[62, 44, 70].map((w, i) => (
                <div key={i} style={{ alignSelf: i === 1 ? 'flex-end' : 'flex-start', width: `${w}%`, height: 42, borderRadius: 16, background: 'var(--surface3)', opacity: 0.7 }} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, color: 'var(--text3)' }}>
              <AudienceMark audience={thread.audience} size={52} profile={dmProfile} />
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 14 }}>No messages yet</div>
              <div style={{ fontSize: 13, marginTop: 4, maxWidth: 280, lineHeight: 1.5 }}>
                {readOnly ? 'Nothing has been posted here.' : `Posts here are for ${aud.who.charAt(0).toLowerCase() + aud.who.slice(1)}.`}
              </div>
            </div>
          ) : timeline.map(item => item.type === 'day' ? (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.label}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          ) : (
            <MessageGroup key={item.key} group={item} mine={item.sender_id === userId}
              profile={profiles[item.sender_id]} isMobile={isMobile} onRetry={send} />
          ))}
        </div>

        {newBelow > 0 && (
          <button onClick={() => scrollToBottom(true)} style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', borderRadius: 99,
            border: 'none', background: 'var(--org-primary)', color: 'var(--org-on-primary)',
            fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(15,23,42,0.18)',
          }}>
            <Icon name="↓" size={14} /> {newBelow} new message{newBelow === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {/* Composer */}
      {readOnly ? (
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="👁" size={15} /> You can read these conversations but not post in them.
        </div>
      ) : (
        <div style={{ flexShrink: 0, minWidth: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: isMobile ? '8px 10px 10px' : '12px 20px 14px' }}>
          {showQuick && (
            <div role="group" aria-label="Quick messages" className="ls-hide-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {QUICK_MESSAGES.map(q => (
                <button key={q} onClick={() => { setDraft(q); setShowQuick(false); inputRef.current?.focus() }} style={{
                  flexShrink: 0, minHeight: 36, padding: '0 12px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: '1px solid var(--org-a20)', background: 'var(--org-a05)', color: 'var(--org-ink)', fontSize: 12.5, fontWeight: 600,
                }}>{q}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowQuick(s => !s)} aria-pressed={showQuick} aria-label="Quick messages" title="Quick messages"
              style={{ ...iconButton, background: showQuick ? 'var(--org-a10)' : 'transparent', color: showQuick ? 'var(--org-ink)' : 'var(--text3)' }}>
              <Icon name="⚡" size={18} />
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 22, padding: '4px 4px 4px 14px', minWidth: 0 }}>
              <textarea ref={inputRef} value={draft} rows={1}
                onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown}
                aria-label={`Message ${title}`}
                placeholder={`Message ${aud.short === 'Direct' ? title : aud.label.toLowerCase()}`}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.45, padding: '8px 0', color: 'var(--text)', maxHeight: 132 }} />
              <button onClick={() => send()} disabled={!draft.trim()} aria-label="Send"
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: draft.trim() ? 'var(--org-primary)' : 'var(--surface3)',
                  color: draft.trim() ? 'var(--org-on-primary)' : 'var(--text4)',
                  cursor: draft.trim() ? 'pointer' : 'default', transition: 'background 0.15s',
                }}>
                <Icon name="↑" size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
          {!isMobile && (
            <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 6, paddingLeft: 52 }}>Enter to send · Shift + Enter for a new line</div>
          )}
        </div>
      )}
    </section>
  )
}

function MessageGroup({ group, mine, profile, isMobile, onRetry }) {
  const name = displayName(profile)
  const last = group.messages[group.messages.length - 1]
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', marginBottom: 12 }}>
      {!mine && <Avatar profile={profile} size={30} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3, maxWidth: isMobile ? '82%' : '68%', minWidth: 0 }}>
        {!mine && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', padding: '0 4px' }}>{name}</div>}
        {group.messages.map((m, i) => {
          // Corners on the sender's side tighten where bubbles in a run meet,
          // so a run reads as one turn.
          const first = i === 0, r = 18, tight = 6
          const radius = mine
            ? `${r}px ${first ? r : tight}px ${tight}px ${r}px`
            : `${first ? r : tight}px ${r}px ${r}px ${tight}px`
          return (
            <div key={m.id} style={{
              padding: '9px 13px', borderRadius: radius, fontSize: 14.5, lineHeight: 1.45,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: mine ? 'var(--org-primary)' : 'var(--surface)',
              color: mine ? 'var(--org-on-primary)' : 'var(--text)',
              border: mine ? 'none' : '1px solid var(--border)',
              opacity: m.status === 'sending' ? 0.65 : 1,
            }}>
              {m.body}
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: last.status === 'failed' ? '#DC2626' : 'var(--text3)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {last.status === 'failed' ? (
            <>
              <span>Not sent</span>
              <button onClick={() => onRetry(last)} style={{ border: 'none', background: 'none', padding: 0, color: '#DC2626', fontWeight: 800, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
            </>
          ) : last.status === 'sending' ? 'Sending…' : clockTime(last.created_at)}
        </div>
      </div>
    </div>
  )
}

// ─── New conversation ──────────────────────────────────────────

function NewConversation({ onCreate, onClose, isMobile }) {
  const [subject, setSubject] = useState('')
  const [audience, setAudience] = useState('all_staff')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (!subject.trim() || creating) return
    setCreating(true); setError('')
    const ok = await onCreate(subject.trim(), audience)
    if (!ok) { setError('That conversation could not be started. Please try again.'); setCreating(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="New conversation" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: 'var(--surface)',
        borderRadius: isMobile ? '22px 22px 0 0' : 20, padding: isMobile ? '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))' : 24,
        boxShadow: '0 30px 80px rgba(15,23,42,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>New conversation</h2>
          <button onClick={onClose} aria-label="Close" style={iconButton}><Icon name="✕" size={18} /></button>
        </div>

        <label htmlFor="ls-new-thread-subject" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>What is it about?</label>
        <input id="ls-new-thread-subject" autoFocus value={subject} maxLength={120}
          onChange={e => setSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="e.g. Schedule change for Tuesday"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface2)', fontSize: 15, fontFamily: 'inherit', color: 'var(--text)', outline: 'none', marginBottom: 18 }} />

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>Who is it for?</div>
        <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {MANUAL_AUDIENCES.map(a => {
            const on = audience === a.key
            return (
              <button key={a.key} role="radio" aria-checked={on} onClick={() => setAudience(a.key)} style={{
                textAlign: 'left', minHeight: 64, padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
                border: on ? `2px solid ${a.color}` : '1.5px solid var(--border)',
                background: on ? a.color + '0F' : 'var(--surface)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ color: a.color, marginTop: 1 }}><Icon name={a.icon} size={17} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.35 }}>{a.who}</span>
                </span>
              </button>
            )
          })}
        </div>

        {error && <div role="alert" style={{ fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}>{error}</div>}

        <button onClick={create} disabled={!subject.trim() || creating} style={{
          width: '100%', minHeight: 48, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800,
          background: subject.trim() ? 'var(--org-primary)' : 'var(--surface3)',
          color: subject.trim() ? 'var(--org-on-primary)' : 'var(--text4)',
          cursor: subject.trim() && !creating ? 'pointer' : 'default',
        }}>{creating ? 'Starting…' : 'Start conversation'}</button>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────

export default function Messaging({ org, session: authSession, initialThreadId, readOnly = false }) {
  const isMobile = useIsMobile()
  const split = !isMobile
  const userId = authSession?.user?.id
  const [threads, setThreads] = useState([])
  const [latest, setLatest] = useState({})
  const [profiles, setProfiles] = useState({})
  const [eventTitles, setEventTitles] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const seenKey = SEEN_KEY(org.id, userId)
  const [seen, setSeen] = useState(() => readSeen(seenKey))
  const requested = useRef(new Set())

  // Names and photos for anyone who appears, fetched once each.
  const ensureProfiles = useCallback(async (ids) => {
    const missing = [...new Set(ids)].filter(id => id && !requested.current.has(id))
    if (!missing.length) return
    missing.forEach(id => requested.current.add(id))
    const { data } = await supabase.from('user_profiles').select(PROFILE_COLUMNS).in('id', missing)
    if (data?.length) setProfiles(p => ({ ...p, ...Object.fromEntries(data.map(x => [x.id, x])) }))
  }, [])

  const load = useCallback(async (background) => {
    if (!background) setLoading(true)
    const [{ data: th }, { data: recent }] = await Promise.all([
      supabase.from('message_threads').select('*').eq('org_id', org.id).order('updated_at', { ascending: false }),
      // Enough recent messages to preview every active thread without a query per thread.
      supabase.from('message_thread_messages').select('id, thread_id, sender_id, body, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(400),
    ])
    const list = th || []
    const last = latestByThread(recent)
    setThreads(list)
    setLatest(last)
    ensureProfiles([
      ...Object.values(last).map(m => m.sender_id),
      ...list.filter(t => isDirect(t.audience)).map(t => directUserId(t.audience)),
    ])
    const sessionIds = [...new Set(list.map(t => t.session_id).filter(Boolean))]
    if (sessionIds.length) {
      const { data: sess } = await supabase.from('sessions').select('id, title').in('id', sessionIds)
      setEventTitles(Object.fromEntries((sess || []).map(s => [s.id, s.title])))
    }
    setLoading(false)
  }, [org.id, ensureProfiles])

  useEffect(() => { load(false) }, [load])
  useRealtimeTable('message_threads', () => load(true), { filter: `org_id=eq.${org.id}`, pollInterval: 6000 })
  useRealtimeTable('message_thread_messages', () => load(true), { filter: `org_id=eq.${org.id}`, pollInterval: 6000 })

  useEffect(() => {
    if (initialThreadId && threads.some(t => t.id === initialThreadId)) setActiveId(initialThreadId)
  }, [initialThreadId, threads])

  // Open the most recent conversation on wide screens, so the right-hand pane
  // is never an empty box on arrival.
  useEffect(() => {
    if (split && !activeId && !initialThreadId && threads.length) setActiveId(threads[0].id)
  }, [split, activeId, initialThreadId, threads])

  const markSeen = useCallback((threadId, lastMessage) => {
    const stamp = lastMessage?.created_at || new Date().toISOString()
    setSeen(prev => {
      if (prev[threadId] && new Date(prev[threadId]) >= new Date(stamp)) return prev
      const next = { ...prev, [threadId]: stamp }
      writeSeen(seenKey, next)
      return next
    })
    if (lastMessage && !lastMessage._local) setLatest(l => ({ ...l, [threadId]: l[threadId] && new Date(l[threadId].created_at) > new Date(lastMessage.created_at) ? l[threadId] : lastMessage }))
  }, [seenKey])

  const createThread = async (subject, audience) => {
    const { data, error } = await supabase.from('message_threads')
      .insert({ org_id: org.id, subject, audience, created_by: userId }).select().single()
    if (error || !data) return false
    setThreads(t => [data, ...t])
    setActiveId(data.id)
    setShowNew(false)
    return true
  }

  const filterDef = FILTERS.find(f => f.key === filter) || FILTERS[0]
  const q = search.trim().toLowerCase()
  const visible = threads.filter(t => {
    if (!filterDef.test(t.audience)) return false
    if (!q) return true
    const hay = [threadTitle(t, profiles), eventTitles[t.session_id], latest[t.id]?.body].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
  // Only offer filters that would show something.
  const filters = FILTERS.filter(f => f.key === 'all' || f.key === filter || threads.some(t => f.test(t.audience)))
  const active = threads.find(t => t.id === activeId) || null
  const unreadCount = threads.filter(t => isUnread(t, latest[t.id], seen[t.id], userId)).length

  const list = (
    <aside aria-label="Conversations" style={{
      display: 'flex', flexDirection: 'column', minHeight: 0,
      width: split ? 340 : '100%', flexShrink: 0, flex: split ? '0 0 340px' : 1,
      background: 'var(--surface)', borderRight: split ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{ padding: isMobile ? '14px 14px 10px' : '18px 18px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.3 }}>Messages</h1>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
              {loading ? 'Loading…' : unreadCount ? `${unreadCount} unread` : `${threads.length} conversation${threads.length === 1 ? '' : 's'}`}
            </div>
          </div>
          {!readOnly && (
            <button onClick={() => setShowNew(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none',
              background: 'var(--org-primary)', color: 'var(--org-on-primary)', fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
            }}>
              <Icon name="✏️" size={16} /> New
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex' }}><Icon name="🔍" size={16} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '0 12px 0 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', outline: 'none' }} />
        </div>

        {filters.length > 1 && (
          <div className="ls-hide-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {filters.map(f => {
              const on = filter === f.key
              return (
                <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={on} style={{
                  flexShrink: 0, minHeight: 34, padding: '0 13px', borderRadius: 99, cursor: 'pointer',
                  border: on ? '1px solid transparent' : '1px solid var(--border)',
                  background: on ? 'var(--org-a10)' : 'transparent',
                  color: on ? 'var(--org-ink)' : 'var(--text2)', fontSize: 12.5, fontWeight: on ? 800 : 600,
                }}>{f.label}</button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 8px 12px' }}>
        {loading ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 10px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface3)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'var(--surface3)', marginBottom: 8 }} />
                <div style={{ height: 10, width: '85%', borderRadius: 6, background: 'var(--surface3)' }} />
              </div>
            </div>
          ))
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
            <div style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--org-a10)', color: 'var(--org-ink)', marginBottom: 12 }}>
              <Icon name="💬" size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{threads.length ? 'No matching conversations' : 'No conversations yet'}</div>
            <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              {threads.length ? 'Try a different search or filter.' : readOnly ? 'Nothing has been posted yet.' : 'Start one to message your team.'}
            </div>
            {!threads.length && !readOnly && (
              <button onClick={() => setShowNew(true)} style={{ marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--org-primary)', color: 'var(--org-on-primary)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Start a conversation</button>
            )}
          </div>
        ) : visible.map(t => {
          const last = latest[t.id]
          const unread = isUnread(t, last, seen[t.id], userId)
          const on = t.id === activeId
          const aud = audienceOf(t.audience)
          const sender = last && (last.sender_id === userId ? 'You' : displayName(profiles[last.sender_id]).split(' ')[0])
          const dmProfile = isDirect(t.audience) ? profiles[directUserId(t.audience)] : null
          return (
            <button key={t.id} onClick={() => setActiveId(t.id)} aria-current={on ? 'true' : undefined} style={{
              width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center',
              padding: '11px 10px', marginBottom: 2, borderRadius: 14, cursor: 'pointer', border: 'none',
              background: on && split ? 'var(--org-a10)' : 'transparent', fontFamily: 'inherit',
            }}
              onMouseEnter={e => { if (!(on && split)) e.currentTarget.style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = on && split ? 'var(--org-a10)' : 'transparent' }}>
              <AudienceMark audience={t.audience} size={44} profile={dmProfile} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: unread ? 800 : 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{threadTitle(t, profiles)}</span>
                  <span style={{ fontSize: 11.5, color: unread ? 'var(--org-ink)' : 'var(--text3)', fontWeight: unread ? 800 : 500, flexShrink: 0 }}>{listTime(last?.created_at || t.updated_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: unread ? 'var(--text2)' : 'var(--text3)', fontWeight: unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last ? `${sender}: ${last.body}` : (eventTitles[t.session_id] ? eventTitles[t.session_id] : `${aud.label} · no messages yet`)}
                  </span>
                  {unread && <span aria-label="Unread" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--org-primary)', flexShrink: 0 }} />}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )

  const conversation = active ? (
    <Conversation
      key={active.id}
      thread={active} org={org} userId={userId} profiles={profiles} ensureProfiles={ensureProfiles}
      eventTitle={eventTitles[active.session_id]} readOnly={readOnly} isMobile={isMobile}
      onBack={() => setActiveId(null)} onActivity={markSeen}
    />
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', background: 'var(--org-a10)', color: 'var(--org-ink)', marginBottom: 12 }}>
          <Icon name="💬" size={28} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Pick a conversation</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Or start a new one for your team.</div>
      </div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', flex: '1 1 auto', minHeight: isMobile ? 420 : 520, minWidth: 0,
      margin: isMobile ? 0 : '12px 20px 20px', overflow: 'hidden',
      borderRadius: isMobile ? 0 : 20, border: isMobile ? 'none' : '1px solid var(--border)',
      boxShadow: isMobile ? 'none' : '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -20px rgba(15,23,42,0.18)',
      background: 'var(--surface)',
    }}>
      {split ? <>{list}{conversation}</> : (active ? conversation : list)}
      {showNew && <NewConversation onCreate={createThread} onClose={() => setShowNew(false)} isMobile={isMobile} />}
    </div>
  )
}

const iconButton = {
  width: 44, height: 44, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
}

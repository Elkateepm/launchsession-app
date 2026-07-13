import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { useRealtimeTable } from '../../lib/useRealtimeTable'
import { useIsMobile } from '../../hooks/useIsMobile'

const AUDIENCES = [
  { key: 'all_staff',   label: 'All Staff',   icon: '👥', color: '#3B82F6' },
  { key: 'volunteers',  label: 'Volunteers',  icon: '❤️', color: '#EC4899' },
  { key: 'team',        label: 'Team Leads',  icon: '⭐', color: '#F59E0B' },
  { key: 'general',     label: 'General',     icon: '💬', color: '#6B7280' },
  { key: 'event_staff',      label: 'Event Staff',      icon: '🎟️', color: '#7C3AED' },
  { key: 'event_volunteers', label: 'Event Volunteers',  icon: '🙋', color: '#0EA5E9' },
]
// Event-scoped threads (event_staff/event_volunteers) are auto-created against a specific
// session, not manually started — so they're excluded from the "new thread" picker and the
// top stats grid, but still recognised everywhere threads are looked up/filtered/displayed.
const MANUAL_AUDIENCES = AUDIENCES.filter(a => !a.key.startsWith('event_'))

const QUICK_MESSAGES = [
  '🚨 Urgent: Please read before today\'s session',
  '✅ Reminder: Session starts at the usual time',
  '🌧️ Weather update — please check for changes',
  '🎉 Great work everyone — brilliant session today!',
  '📋 Registers need updating before Friday',
  '⏰ Please arrive 15 mins early this week',
]

function ThreadView({ thread, org, session: authSession, onBack }) {
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef()
  const primary = org?.primary_color || '#1B9AAA'
  const userId = authSession?.user?.id
  const audienceCfg = AUDIENCES.find(a => a.key === thread.audience) || AUDIENCES[0]

  const load = useCallback(async () => {
    const { data } = await supabase.from('message_thread_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [thread.id])

  useEffect(() => { load() }, [load])
  useRealtimeTable('message_thread_messages', load, { filter: `thread_id=eq.${thread.id}`, pollInterval: 4000 })

  const send = async (body) => {
    const text = body || newMsg.trim()
    if (!text) return
    setSending(true)
    const { data } = await supabase.from('message_thread_messages').insert({ thread_id: thread.id, org_id: org.id, sender_id: userId, body: text }).select().single()
    if (data) setMessages(m => [...m, data])
    setNewMsg('')
    setSending(false)
    await supabase.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh', minHeight: 400 }}>
      {/* Thread header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{thread.subject}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11 }}>{audienceCfg.icon}</span>
            <span style={{ fontSize: 11, color: audienceCfg.color, fontWeight: 700 }}>{audienceCfg.label}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {messages.length} message{messages.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30 }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>Start the conversation</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Be the first to post in this thread</div>
          </div>
        ) : messages.map((msg, i) => {
          const isMine = msg.sender_id === userId
          const showTime = i === 0 || new Date(msg.created_at) - new Date(messages[i-1].created_at) > 5 * 60 * 1000
          return (
            <div key={msg.id}>
              {showTime && (
                <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
                  {format(new Date(msg.created_at), 'HH:mm · d MMM')}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMine ? primary : '#F3F4F6', color: isMine ? '#fff' : '#111', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {msg.body}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick message suggestions */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
        {QUICK_MESSAGES.map((qm, i) => (
          <button key={i} onClick={() => send(qm)} style={{ padding: '5px 12px', borderRadius: 99, border: `1px solid ${primary}40`, background: primary + '08', color: primary, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {qm}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#F9FAFB', borderRadius: 14, padding: '10px 14px', border: '1.5px solid #e5e7eb' }}>
        <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={handleKey} placeholder="Write a message... (Enter to send)" rows={1} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
        <button onClick={() => send()} disabled={!newMsg.trim() || sending} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: newMsg.trim() ? primary : '#E5E7EB', color: newMsg.trim() ? '#fff' : '#9CA3AF', fontWeight: 800, fontSize: 13, cursor: newMsg.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.15s' }}>
          {sending ? '...' : '↑ Send'}
        </button>
      </div>
    </div>
  )
}

export default function Messaging({ org, session: authSession, initialThreadId }) {
  const isMobile = useIsMobile()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeThread, setActiveThread] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newThread, setNewThread] = useState({ subject: '', audience: 'all_staff' })
  const [creating, setCreating] = useState(false)
  const [filterAudience, setFilterAudience] = useState('all')
  const [eventTitles, setEventTitles] = useState({})
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async (isBackground) => {
    if (!isBackground) setLoading(true)
    const { data } = await supabase.from('message_threads').select('*, message_thread_messages(count)').eq('org_id', org.id).order('updated_at', { ascending: false })
    setThreads(data || [])
    const sessionIds = [...new Set((data || []).map(t => t.session_id).filter(Boolean))]
    if (sessionIds.length) {
      const { data: sess } = await supabase.from('sessions').select('id, title').in('id', sessionIds)
      setEventTitles(Object.fromEntries((sess || []).map(s => [s.id, s.title])))
    }
    setLoading(false)
  }, [org.id])

  useEffect(() => { load(false) }, [load])
  useEffect(() => {
    if (!initialThreadId || !threads.length) return
    const t = threads.find(t => t.id === initialThreadId)
    if (t) setActiveThread(t)
  }, [initialThreadId, threads])
  useRealtimeTable('message_threads', () => load(true), { filter: `org_id=eq.${org.id}`, pollInterval: 4000 })
  useRealtimeTable('message_thread_messages', () => load(true), { pollInterval: 4000 })

  const createThread = async () => {
    if (!newThread.subject) return
    setCreating(true)
    const { data } = await supabase.from('message_threads').insert({ org_id: org.id, subject: newThread.subject, audience: newThread.audience, created_by: authSession?.user?.id }).select().single()
    setCreating(false)
    if (data) { setThreads(t => [{ ...data, message_thread_messages: [{ count: 0 }] }, ...t]); setActiveThread(data); setShowNew(false); setNewThread({ subject: '', audience: 'all_staff' }) }
  }

  const filtered = filterAudience === 'all' ? threads : threads.filter(t => t.audience === filterAudience)
  const totalMessages = threads.reduce((s, t) => s + (t.message_thread_messages?.[0]?.count || 0), 0)

  if (activeThread) return (
    <div>
      <ThreadView thread={activeThread} org={org} session={authSession} onBack={() => { setActiveThread(null); load() }} />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>💬 Team Messaging</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{threads.length} thread{threads.length !== 1 ? 's' : ''} · {totalMessages} messages total</div>
          </div>
          <button onClick={() => setShowNew(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            + New Thread
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
          {MANUAL_AUDIENCES.map(a => (
            <div key={a.key} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: a.color }}>{threads.filter(t => t.audience === a.key).length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{a.icon} {a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* New thread form */}
      {showNew && (
        <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>💬 Start a New Thread</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 12 }}>
            <input value={newThread.subject} onChange={e => setNewThread(n => ({ ...n, subject: e.target.value }))} placeholder="Thread subject e.g. 'Schedule change for Tuesday'" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && createThread()} />
            <select value={newThread.audience} onChange={e => setNewThread(n => ({ ...n, audience: e.target.value }))} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit' }}>
              {MANUAL_AUDIENCES.map(a => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createThread} disabled={creating || !newThread.subject} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{creating ? 'Creating...' : 'Create Thread'}</button>
            <button onClick={() => setShowNew(false)} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Audience filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: 'All Threads', icon: '💬', color: '#6B7280' }, ...AUDIENCES].map(a => (
          <button key={a.key} onClick={() => setFilterAudience(a.key)} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${filterAudience === a.key ? primary : '#e5e7eb'}`, background: filterAudience === a.key ? primary + '12' : '#fff', color: filterAudience === a.key ? primary : '#6B7280', fontSize: 12, fontWeight: filterAudience === a.key ? 800 : 600, cursor: 'pointer' }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Threads list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading messages...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No threads yet</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Start a conversation with your team</div>
          <button onClick={() => setShowNew(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Start First Thread</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(thread => {
            const aud = AUDIENCES.find(a => a.key === thread.audience) || AUDIENCES[0]
            const msgCount = thread.message_thread_messages?.[0]?.count || 0
            return (
              <div key={thread.id} onClick={() => setActiveThread(thread)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.boxShadow = `0 4px 12px ${primary}15` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: aud.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {aud.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{thread.subject}</div>
                  {thread.session_id && eventTitles[thread.session_id] && (
                    <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', borderRadius: 99, padding: '2px 8px', marginBottom: 4 }}>
                      🎟️ {eventTitles[thread.session_id]}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#9CA3AF' }}>
                    <span style={{ color: aud.color, fontWeight: 700 }}>{aud.label}</span>
                    <span>{msgCount} message{msgCount !== 1 ? 's' : ''}</span>
                    <span>Updated {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#9CA3AF', flexShrink: 0 }}>→</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { timeAgo } from './vp_shared'

const REACTIONS = ['👍', '❤️', '😊', '🎉']

export default function VPMessages({ org, user, primary }) {
  const [threads, setThreads] = useState([])
  const [pins, setPins] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const dmAudience = `dm:${user.id}`
    const [{ data: th }, { data: pinRows }] = await Promise.all([
      supabase.from('message_threads').select('*, message_thread_messages(count)').eq('org_id', org.id).in('audience', ['volunteers', 'general', dmAudience]).order('updated_at', { ascending: false }),
      supabase.from('message_thread_pins').select('thread_id').eq('org_id', org.id).eq('user_id', user.id),
    ])
    setThreads(th || [])
    setPins(new Set((pinRows || []).map(p => p.thread_id)))
    setLoading(false)
  }, [org.id, user.id])

  useEffect(() => { load() }, [load])

  const startDM = async () => {
    const dmAudience = `dm:${user.id}`
    const existing = threads.find(t => t.audience === dmAudience)
    if (existing) { setActive(existing); return }
    const { data } = await supabase.from('message_threads').insert({ org_id: org.id, subject: 'Message to Staff', audience: dmAudience, created_by: user.id }).select().single()
    if (data) { setThreads(t => [data, ...t]); setActive(data) }
  }

  const filtered = threads.filter(t => !search.trim() || t.subject?.toLowerCase().includes(search.toLowerCase()))
  const pinned = filtered.filter(t => pins.has(t.id))
  const rest = filtered.filter(t => !pins.has(t.id))

  const togglePin = async (threadId, e) => {
    e.stopPropagation()
    if (pins.has(threadId)) {
      await supabase.from('message_thread_pins').delete().eq('thread_id', threadId).eq('user_id', user.id)
      setPins(p => { const n = new Set(p); n.delete(threadId); return n })
    } else {
      await supabase.from('message_thread_pins').insert({ thread_id: threadId, user_id: user.id, org_id: org.id })
      setPins(p => new Set([...p, threadId]))
    }
  }

  if (active) return <VPThread thread={active} org={org} user={user} primary={primary} onBack={() => { setActive(null); load() }} />

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>Messages</div>
        <button onClick={startDM} style={{ padding: '8px 14px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>+ Message Staff</button>
      </div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>Announcements, updates, and direct messages</div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13.5, outline: 'none', marginBottom: 16 }} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>No conversations yet</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Announcements and messages will show up here</div>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>📌 Pinned</div>
              {pinned.map(t => <ThreadRow key={t.id} t={t} user={user} onOpen={() => setActive(t)} onPin={e => togglePin(t.id, e)} pinned />)}
              <div style={{ height: 8 }} />
            </>
          )}
          {rest.map(t => <ThreadRow key={t.id} t={t} user={user} onOpen={() => setActive(t)} onPin={e => togglePin(t.id, e)} />)}
        </>
      )}
    </div>
  )
}

function ThreadRow({ t, user, onOpen, onPin, pinned }) {
  const isDM = t.audience === `dm:${user.id}`
  const icon = isDM ? '💬' : t.audience === 'volunteers' ? '❤️' : '📣'
  const count = t.message_thread_messages?.[0]?.count || 0
  return (
    <motion.div layout onClick={onOpen} whileTap={{ scale: 0.98 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, background: '#fff', border: '1.5px solid rgba(15,23,42,0.06)', marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || (isDM ? 'Message to Staff' : 'Announcement')}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{count} message{count !== 1 ? 's' : ''} · {timeAgo(t.updated_at || t.created_at)}</div>
      </div>
      <button onClick={onPin} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', opacity: pinned ? 1 : 0.3 }}>📌</button>
    </motion.div>
  )
}

function VPThread({ thread, org, user, primary, onBack }) {
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('message_thread_messages').select('*').eq('thread_id', thread.id).order('created_at')
    setMessages(data || [])
    if (data?.length) {
      const { data: react } = await supabase.from('message_reactions').select('*').in('message_id', data.map(m => m.id))
      const rmap = {}
      ;(react || []).forEach(r => { rmap[r.message_id] = rmap[r.message_id] || {}; rmap[r.message_id][r.emoji] = (rmap[r.message_id][r.emoji] || 0) + 1 })
      setReactions(rmap)
    }
  }, [thread.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    const { data } = await supabase.from('message_thread_messages').insert({ thread_id: thread.id, org_id: org.id, sender_id: user.id, body: body.trim() }).select().single()
    if (data) setMessages(m => [...m, data])
    await supabase.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id)
    setBody('')
    setSending(false)
  }

  const uploadPhoto = async (file) => {
    if (!file) return
    setUploading(true)
    const path = `messages/${org.id}/${thread.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('safeguarding-docs').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('safeguarding-docs').getPublicUrl(path)
      const { data } = await supabase.from('message_thread_messages').insert({ thread_id: thread.id, org_id: org.id, sender_id: user.id, body: '', attachment_url: urlData?.publicUrl, attachment_type: file.type }).select().single()
      if (data) setMessages(m => [...m, data])
    }
    setUploading(false)
  }

  const react = async (messageId, emoji) => {
    await supabase.from('message_reactions').upsert({ message_id: messageId, org_id: org.id, user_id: user.id, emoji }, { onConflict: 'message_id,user_id,emoji' })
    setReactions(r => ({ ...r, [messageId]: { ...(r[messageId] || {}), [emoji]: ((r[messageId]?.[emoji]) || 0) + 1 } }))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{thread.subject}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#F8FAFC' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No messages yet — say hello!</div>
        ) : messages.map(m => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div style={{ maxWidth: '78%' }}>
                <div style={{ background: mine ? primary : '#fff', color: mine ? '#fff' : '#0F172A', borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, padding: '10px 13px', fontSize: 13.5, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  {m.attachment_url && (m.attachment_type?.startsWith('image/') ? <img src={m.attachment_url} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: m.body ? 6 : 0 }} /> : <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>📎 Attachment</a>)}
                  {m.body}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{timeAgo(m.created_at)}</span>
                  {reactions[m.id] && Object.entries(reactions[m.id]).map(([emoji, count]) => (
                    <span key={emoji} style={{ fontSize: 10.5, background: '#fff', borderRadius: 99, padding: '2px 6px', border: '1px solid rgba(15,23,42,0.08)' }}>{emoji} {count}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 3, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {REACTIONS.map(e => <button key={e} onClick={() => react(m.id, e)} style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', opacity: 0.5 }}>{e}</button>)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8, alignItems: 'center', background: '#fff', flexShrink: 0 }}>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>{uploading ? '…' : '📎'}</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files?.[0])} />
        <input value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 99, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13.5, outline: 'none' }} />
        <button onClick={send} disabled={sending || !body.trim()} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: primary, color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>↑</button>
      </div>
    </div>
  )
}

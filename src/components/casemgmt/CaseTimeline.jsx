import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Avatar, btnPrimary } from '../volunteers/vh_shared'
import { EVENT_META, timeAgo } from './cm_shared'

const COMPOSER_TYPES = [
  { key: 'note', label: '📝 Note' },
  { key: 'meeting', label: '🤝 Meeting' },
  { key: 'phone_call', label: '📞 Call' },
  { key: 'email', label: '✉️ Email' },
  { key: 'agency_contacted', label: '🏛️ Agency' },
]

export default function CaseTimeline({ caseId, org, session: authSession, staff = [], refreshKey }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [composerType, setComposerType] = useState('note')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: notes }, { data: events }] = await Promise.all([
      supabase.from('case_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      supabase.from('case_events').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
    ])
    const merged = [
      ...(notes || []).map(n => ({ ...n, event_type: 'note', _kind: 'note' })),
      ...(events || []).map(e => ({ ...e, _kind: 'event' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setItems(merged)
    setLoading(false)
  }, [caseId])

  useEffect(() => { load() }, [load, refreshKey])

  const authorName = (uid) => staff.find(s => s.id === uid)?.full_name || 'Team member'
  const authorPhoto = (uid) => staff.find(s => s.id === uid)?.photo_url

  const submit = async () => {
    if (!body.trim()) return
    setSaving(true)
    if (composerType === 'note') {
      const { data } = await supabase.from('case_notes').insert({ case_id: caseId, org_id: org.id, body: body.trim(), created_by: authSession?.user?.id }).select().single()
      if (data) setItems(i => [{ ...data, event_type: 'note', _kind: 'note' }, ...i])
    } else {
      const { data } = await supabase.from('case_events').insert({ case_id: caseId, org_id: org.id, event_type: composerType, body: body.trim(), created_by: authSession?.user?.id }).select().single()
      if (data) setItems(i => [{ ...data, _kind: 'event' }, ...i])
    }
    setBody('')
    setSaving(false)
  }

  return (
    <div>
      {/* Composer */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {COMPOSER_TYPES.map(t => (
            <button key={t.key} onClick={() => setComposerType(t.key)}
              style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${composerType === t.key ? primary : 'rgba(15,23,42,0.1)'}`, background: composerType === t.key ? `${primary}12` : '#fff', color: composerType === t.key ? primary : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder={composerType === 'note' ? 'Add a note about this case…' : `Log details of this ${COMPOSER_TYPES.find(t => t.key === composerType)?.label.split(' ')[1].toLowerCase()}…`}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
        />
        <button onClick={submit} disabled={saving || !body.trim()} style={btnPrimary(primary)}>{saving ? 'Saving…' : '+ Add to Timeline'}</button>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading timeline…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: '#94A3B8', fontSize: 13 }}>No entries yet — the first note or logged contact will appear here.</div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 4 }}>
          <div style={{ position: 'absolute', left: 19, top: 6, bottom: 6, width: 2, background: 'rgba(15,23,42,0.06)' }} />
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const meta = EVENT_META[item.event_type] || EVENT_META.note
              return (
                <motion.div key={item.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1.5px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1.5px solid rgba(15,23,42,0.06)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={authorName(item.created_by)} photoUrl={authorPhoto(item.created_by)} size={16} />
                        {authorName(item.created_by)}
                        <span style={{ fontWeight: 600, color: '#94A3B8' }}>· {meta.label}</span>
                      </span>
                      <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.body}</div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

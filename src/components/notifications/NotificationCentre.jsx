import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { NotificationsSection } from '../settings/Settings'
import { withAlpha } from '../../lib/withAlpha'
import {
  NOTIF_ICONS, NOTIF_LABELS, notifColor, timeAgo, groupNotifications, notifDestination,
} from '../../lib/notificationMeta'

// ─── NOTIFICATION CENTRE ──────────────────────────────────────
// Everything the bell on Home cannot hold: the whole history, filters, and
// each person's own alert and device settings. Those settings used to live
// only in Settings, which is admin-only, so staff and volunteers had no way
// to turn push on or quieten a category. Here they are for everyone.

const PAGE = 40
const POLL_MS = 60000
const URGENT = new Set(['critical', 'high'])

export default function NotificationCentre({ org, session, onNavigate, initialView }) {
  const userId = session?.user?.id
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#1B9AAA'
  const [view, setView] = useState(initialView === 'settings' ? 'settings' : 'inbox')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'unread' | 'urgent'
  const [category, setCategory] = useState(null)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const loadedCount = useRef(PAGE)

  // Unread is counted on the server: the list only holds what has been
  // loaded, and "3 unread" that is really 40 would hide the ones that matter.
  const loadUnreadTotal = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('read_at', null)
    setUnreadTotal(count || 0)
  }, [userId])

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: loadErr } = await supabase.from('notifications').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).range(0, loadedCount.current - 1)
    if (loadErr) { setError('Could not load your notifications. Check your connection and try again.'); setLoading(false); return }
    setError('')
    setItems(data || [])
    setHasMore((data || []).length === loadedCount.current)
    setLoading(false)
    loadUnreadTotal()
  }, [userId, loadUnreadTotal])

  // Polled, not Realtime (Realtime crashes iOS WebKit here), and paused while
  // the tab is hidden so a phone in a pocket is not making requests.
  useEffect(() => {
    load()
    const tick = () => { if (!document.hidden) load() }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [load])

  const loadOlder = async () => {
    setLoadingMore(true)
    loadedCount.current += PAGE
    await load()
    setLoadingMore(false)
  }

  const markRead = (ids) => {
    if (!ids.length) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(x => (ids.includes(x.id) ? { ...x, read_at: now } : x)))
    setUnreadTotal(t => Math.max(0, t - ids.length))
    supabase.from('notifications').update({ read_at: now }).in('id', ids).then(() => {})
  }

  // All of this person's unread, not only the rows on screen.
  const markAllRead = async () => {
    const now = new Date().toISOString()
    setItems(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: now })))
    setUnreadTotal(0)
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
  }

  const open = (n) => {
    markRead((n.dupes || [n]).filter(x => !x.read_at).map(x => x.id))
    const dest = notifDestination(n)
    if (dest && onNavigate) onNavigate(dest.tab, dest.payload)
  }

  const categories = useMemo(() => {
    const seen = new Map()
    items.forEach(n => { if (n.category) seen.set(n.category, (seen.get(n.category) || 0) + (n.read_at ? 0 : 1)) })
    return [...seen.entries()].map(([key, unread]) => ({ key, unread }))
  }, [items])

  const visible = useMemo(() => items.filter(n => {
    if (filter === 'unread' && n.read_at) return false
    if (filter === 'urgent' && !URGENT.has(n.priority)) return false
    if (category && n.category !== category) return false
    return true
  }), [items, filter, category])
  const groups = useMemo(() => groupNotifications(visible), [visible])
  const urgentUnread = items.filter(n => !n.read_at && URGENT.has(n.priority)).length

  const pill = (active) => ({
    minHeight: 40, padding: '0 14px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1.5px solid ${active ? primary : 'var(--border)'}`,
    background: active ? withAlpha(primary, '14') : 'var(--surface)',
    color: active ? 'var(--org-ink)' : 'var(--text2)',
  })

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? '16px 16px 32px' : '28px 32px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>Notifications</h1>
            <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 4 }}>
              {unreadTotal ? `${unreadTotal} unread${urgentUnread ? ` · ${urgentUnread} urgent` : ''}` : 'You are all caught up.'}
            </div>
          </div>
          {view === 'inbox' && unreadTotal > 0 && (
            <button type="button" onClick={markAllRead} style={{ ...pill(false), minHeight: 44 }}>Mark all read</button>
          )}
        </div>

        <div role="tablist" aria-label="Notification views" style={{ display: 'flex', gap: 4, background: 'var(--surface-hover)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[{ key: 'inbox', label: 'Inbox' }, { key: 'settings', label: 'Alerts & devices' }].map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={view === t.key} onClick={() => setView(t.key)}
              style={{ flex: 1, minHeight: 44, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800,
                background: view === t.key ? 'var(--surface)' : 'transparent', color: view === t.key ? 'var(--text)' : 'var(--text3)',
                boxShadow: view === t.key ? '0 1px 3px rgba(15,23,42,0.12)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {view === 'settings' ? (
          <NotificationsSection org={org} session={session} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
              {[{ key: 'all', label: 'All' }, { key: 'unread', label: `Unread${unreadTotal ? ` (${unreadTotal})` : ''}` }, { key: 'urgent', label: 'Urgent' }].map(f => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} style={pill(filter === f.key)}>{f.label}</button>
              ))}
              {categories.length > 1 && <span aria-hidden="true" style={{ width: 1, background: 'var(--border)', margin: '6px 2px', flexShrink: 0 }} />}
              {categories.length > 1 && categories.map(c => (
                <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => setCategory(category === c.key ? null : c.key)} style={pill(category === c.key)}>
                  {NOTIF_ICONS[c.key] || '🔔'} {NOTIF_LABELS[c.key] || c.key}{c.unread ? ` · ${c.unread}` : ''}
                </button>
              ))}
            </div>

            {error && <div role="alert" style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Loading notifications…</div>
            ) : groups.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>{filter === 'all' && !category ? '🔔' : '🎉'}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text2)' }}>
                  {filter === 'all' && !category ? 'No notifications yet' : 'Nothing here'}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-faint)', marginTop: 6 }}>
                  {filter === 'all' && !category ? 'Alerts about sessions, registers and safeguarding will appear here.' : 'Try another filter.'}
                </div>
                {filter === 'all' && !category && (
                  <button type="button" onClick={() => setView('settings')} style={{ ...pill(true), minHeight: 44, marginTop: 16 }}>Turn on alerts for this device</button>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? '4px 8px 10px' : '6px 10px 12px' }}>
                {groups.map(group => (
                  <section key={group.label} aria-label={group.label}>
                    <h2 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, padding: '14px 8px 7px' }}>{group.label}</h2>
                    {group.items.map(n => {
                      const color = notifColor(n, primary)
                      const repeats = (n.dupes || []).length
                      const unread = !n.read_at
                      return (
                        <button key={n.id} type="button" onClick={() => open(n)}
                          aria-label={`${unread ? 'Unread: ' : ''}${n.title}. ${n.body || ''}`}
                          style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 12px 14px 16px', marginBottom: 4, border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 14,
                            background: unread ? withAlpha(color, '0A') : 'transparent' }}>
                          {unread && <span aria-hidden="true" style={{ position: 'absolute', left: 3, top: 12, bottom: 12, width: 3, borderRadius: 2, background: color }} />}
                          <span aria-hidden="true" style={{ position: 'relative', width: 40, height: 40, borderRadius: 13, background: withAlpha(color, '18'), border: `1px solid ${withAlpha(color, '2A')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {NOTIF_ICONS[n.category] || '🔔'}
                            {repeats > 1 && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 99, background: color, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{repeats}</span>}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 15, fontWeight: unread ? 800 : 600, color: 'var(--text)', lineHeight: 1.3 }}>
                                {n.priority === 'critical' && <span style={{ color: '#DC2626' }}>● </span>}{n.title}
                              </span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                            </span>
                            <span style={{ display: 'block', fontSize: 13.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{n.body}</span>
                            {repeats > 1 && <span style={{ display: 'block', fontSize: 12, color, fontWeight: 700, marginTop: 4 }}>{repeats} times</span>}
                          </span>
                        </button>
                      )
                    })}
                  </section>
                ))}
                {hasMore && (
                  <button type="button" onClick={loadOlder} disabled={loadingMore} style={{ ...pill(false), width: '100%', minHeight: 44, marginTop: 8 }}>
                    {loadingMore ? 'Loading…' : 'Load older notifications'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

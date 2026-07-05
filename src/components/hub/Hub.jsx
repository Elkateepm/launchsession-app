import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useRealtimeTable } from "../../lib/useRealtimeTable";

const ANNOUNCEMENT_EMOJIS = ['📣', '🎉', '⭐', '🔥', '💡', '📌', '🚨', '🙌', '❤️', '🏆']

// ── ANNOUNCEMENTS PANEL ─────────────────────────────────────────
// Staff/admin only — visibility is enforced both here (UI) and via RLS
// (see announcements table policies), so this is defense in depth, not
// the only guard.
// ─── PHOTO CAROUSEL ──────────────────────────────────────────
function PhotoCarousel({ orgId, primary, userId }) {
  const [photos, setPhotos] = React.useState([])
  const [uploading, setUploading] = React.useState(false)
  const [lightbox, setLightbox] = React.useState(null)
  const inputRef = React.useRef(null)

  const load = React.useCallback(() => {
    supabase.from('gallery_photos').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setPhotos(data || []))
  }, [orgId])

  React.useEffect(() => { load() }, [load])

  const handleUpload = async (files) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const path = `${orgId}/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`
      const { error } = await supabase.storage.from('gallery').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path)
        await supabase.from('gallery_photos').insert({ org_id: orgId, url: publicUrl, path })
      }
    }
    setUploading(false)
    load()
  }

  const handleDelete = async (e, photo) => {
    e.stopPropagation()
    await supabase.storage.from('gallery').remove([photo.path])
    await supabase.from('gallery_photos').delete().eq('id', photo.id)
    setPhotos(p => p.filter(x => x.id !== photo.id))
    if (lightbox?.id === photo.id) setLightbox(null)
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={e => handleUpload(e.target.files)} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>📸 Photos</div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${primary}`, background: uploading ? '#F3F4F6' : '#fff', color: primary, fontSize: 12, fontWeight: 800, cursor: uploading ? 'default' : 'pointer' }}>
          📷 {uploading ? 'Uploading...' : 'Add Photo'}
        </button>
      </div>

      {/* Photo strip */}
      {photos.length === 0 ? (
        <div onClick={() => inputRef.current?.click()}
          style={{ height: 110, borderRadius: 16, border: '2px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 22 }}>📷</span> Add your first photo
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {photos.map(p => (
            <div key={p.id} onClick={() => setLightbox(p)}
              style={{ position: 'relative', flexShrink: 0, width: 110, height: 110, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.12)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <img src={p.url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {/* Delete dot */}
              <button onClick={e => handleDelete(e, p)}
                style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff', color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 900, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox.url} alt={lightbox.caption || ''} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }} />
          {lightbox.caption && (
            <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '6px 16px', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              {lightbox.caption}
            </div>
          )}
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}

function AnnouncementsPanel({ orgId, primary, userId }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emoji, setEmoji] = useState(ANNOUNCEMENT_EMOJIS[0])
  const [pinned, setPinned] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const load = React.useCallback(() => {
    if (!orgId) return
    supabase.from('announcements')
      .select('*')
      .eq('org_id', orgId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!err) setAnnouncements(data || [])
        setLoading(false)
      })
  }, [orgId])

  useEffect(() => { load() }, [load])
  useRealtimeTable('announcements', load, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 15000 })

  const post = async () => {
    if (!title.trim() || !content.trim()) { setError('Add a title and a message.'); return }
    setPosting(true); setError('')
    const { error: err } = await supabase.from('announcements').insert({
      org_id: orgId, title: title.trim(), content: content.trim(), emoji, pinned, created_by: userId,
    })
    if (err) { setError(err.message); setPosting(false); return }
    setTitle(''); setContent(''); setEmoji(ANNOUNCEMENT_EMOJIS[0]); setPinned(false)
    setComposing(false); setPosting(false)
    load()
  }

  const remove = async id => {
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  const timeAgo = ts => {
    const diffMs = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  if (loading) return null // avoid a flash of empty state before first load

  const visible = expanded ? announcements : announcements.slice(0, 3)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text,#111)', margin: 0 }}>📣 Announcements</h3>
        <button onClick={() => setComposing(c => !c)} style={{ fontSize: 11, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {composing ? 'Cancel' : '+ Post announcement'}
        </button>
      </div>

      {composing && (
        <div style={{ background: '#F9FAFB', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: 16, marginBottom: 14 }}>
          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C00', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {ANNOUNCEMENT_EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                style={{ fontSize: 18, width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${emoji === e ? primary : '#E5E7EB'}`, background: emoji === e ? primary + '15' : '#fff', cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>

          <input
            value={title} onChange={e => setTitle(e.target.value)} placeholder="Give it a headline..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 14, fontWeight: 700, outline: 'none', marginBottom: 8 }}
          />
          <textarea
            value={content} onChange={e => setContent(e.target.value)} placeholder="What's the news? Keep it short and sweet 🎉"
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, outline: 'none', marginBottom: 10, fontFamily: 'inherit', resize: 'vertical' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#6B7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
              📌 Pin to top
            </label>
            <button onClick={post} disabled={posting} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: posting ? '#E5E7EB' : primary, color: posting ? '#9CA3AF' : '#fff', fontSize: 13, fontWeight: 800, cursor: posting ? 'default' : 'pointer' }}>
              {posting ? 'Posting...' : 'Post →'}
            </button>
          </div>
        </div>
      )}

      {announcements.length === 0 && !composing ? (
        <div style={{ background: `linear-gradient(135deg, ${primary}10, ${primary}05)`, border: `1.5px dashed ${primary}30`, borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📣</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text,#111)', marginBottom: 4 }}>No announcements yet</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Share news, shout-outs, or reminders with your team</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: '14px 16px', position: 'relative' }}>
              {a.pinned && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 11 }}>📌</div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{a.emoji || '📣'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', marginBottom: 3, paddingRight: a.pinned ? 20 : 0 }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{timeAgo(a.created_at)}</span>
                    {a.created_by === userId && (
                      <button onClick={() => remove(a.id)} style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {announcements.length > 3 && (
            <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 12, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
              {expanded ? 'Show less ↑' : `Show ${announcements.length - 3} more →`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── LIVE SESSION PANEL ─────────────────────────────────────────
function LiveSessionPanel({ sessions, childList, attendance, primary, secondary, orgId, reflections, onOpenRegister, onNavigate, getLiveSessionStats }) {
  const isMobile = useIsMobile()
  const [activeSession, setActiveSession] = useState(sessions[0])
  const [localAttendance, setLocalAttendance] = useState(attendance)
  const [bubbleFilter, setBubbleFilter] = useState('all')
  const [popupMode, setPopupMode] = useState(null) // 'expected' | 'signed_in' | 'signed_out' | null
  const [busyChildId, setBusyChildId] = useState(null)
  const [popupSearch, setPopupSearch] = useState('')

  // Keep local attendance in sync
  React.useEffect(() => { setLocalAttendance(attendance) }, [attendance])
  React.useEffect(() => { if (sessions.length) setActiveSession(sessions[0]) }, [sessions])

  const sessionAttendance = localAttendance.filter(a => a.session_id === activeSession?.id)

  // Compute stats from local state so they update immediately on sign-in
  const stats = React.useMemo(() => {
    if (!activeSession) return { signedIn: 0, expected: 0, absent: 0, signedOut: 0, percent: 0 }
    const targetGroups = Array.isArray(activeSession.bubbles) ? activeSession.bubbles.map(g => (g || '').toLowerCase()) : []
    const targetedChildren = targetGroups.length > 0
      ? childList.filter(c => targetGroups.includes((c.group_name || '').toLowerCase()))
      : childList
    const si = sessionAttendance.filter(a => a.status === 'signed_in').length
    const so = sessionAttendance.filter(a => a.status === 'signed_out').length
    const absent = sessionAttendance.filter(a => a.status === 'absent').length
    const signedInIds = new Set(sessionAttendance.filter(a => a.status === 'signed_in').map(a => a.child_id))
    const expected = targetedChildren.filter(c => !signedInIds.has(c.id)).length
      + sessionAttendance.filter(a => a.status === 'signed_in' && !targetedChildren.find(c => c.id === a.child_id)).length
    const total = Math.max(targetedChildren.length, sessionAttendance.length)
    return { signedIn: si, absent, signedOut: so, expected, percent: total > 0 ? Math.round((si / total) * 100) : 0 }
  }, [activeSession, sessionAttendance, childList])

  const BUBBLE_COLORS = { red: '#D0021B', orange: '#F97316', yellow: '#F97316', blue: '#1B4FA8', purple: '#7B2D8B', teens: '#1A1A1A' }
  const getBubbleColor = (groupName) => BUBBLE_COLORS[(groupName || '').toLowerCase()] || '#9CA3AF'

  // Live group breakdown — derived from children actually in this session
  const sessionChildIds = new Set(sessionAttendance.map(a => a.child_id))
  const sessionChildren = childList.filter(ch => sessionChildIds.has(ch.id))
  const bubbleGroups = [...new Set(sessionChildren.map(ch => (ch.group_name || '').trim()).filter(Boolean))]

  const getChildStatus = (childId) => {
    const rec = sessionAttendance.find(a => a.child_id === childId)
    return rec?.status || 'expected'
  }

  // All children targeted by this session (respects group targeting), used as the base pool for every popup
  const targetedChildren = useMemo(() => {
    if (!activeSession) return []
    const targetGroups = Array.isArray(activeSession?.bubbles) ? activeSession.bubbles.map(g => (g || '').toLowerCase()) : []
    return targetGroups.length > 0
      ? childList.filter(c => targetGroups.includes((c.group_name || '').toLowerCase()))
      : childList
  }, [activeSession, childList])

  const popupChildren = useMemo(() => {
    let base = popupMode === 'walkin'
      ? childList  // walk-ins can be any child in the org
      : targetedChildren
    if (popupMode === 'signed_in') base = base.filter(c => getChildStatus(c.id) === 'signed_in')
    else if (popupMode === 'signed_out') base = base.filter(c => getChildStatus(c.id) === 'signed_out')
    return base.filter(c => !popupSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(popupSearch.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetedChildren, childList, popupMode, popupSearch, sessionAttendance])

  const handleAddToExpected = async (child) => {
    if (!activeSession) return
    setBusyChildId(child.id)
    const existing = sessionAttendance.find(a => a.child_id === child.id)
    if (!existing) {
      const { data } = await supabase.from('attendance').insert({
        session_id: activeSession.id, child_id: child.id, org_id: orgId, status: 'expected'
      }).select().single()
      if (data) setLocalAttendance(prev => [...prev, data])
    }
    setBusyChildId(null)
  }

  const handleWalkIn = async (child) => {
    if (!activeSession) return
    setBusyChildId(child.id)
    const existing = sessionAttendance.find(a => a.child_id === child.id)
    const now = new Date().toISOString()
    if (existing) {
      await supabase.from('attendance').update({ status: 'signed_in', signed_in_at: now }).eq('id', existing.id)
      setLocalAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status: 'signed_in', signed_in_at: now } : a))
    } else {
      const { data } = await supabase.from('attendance').insert({
        session_id: activeSession.id, child_id: child.id, org_id: orgId, status: 'signed_in', signed_in_at: now
      }).select().single()
      if (data) setLocalAttendance(prev => [...prev, data])
    }
    setBusyChildId(null)
  }

  const handleSignIn = async (child) => {
    if (!activeSession) return
    setBusyChildId(child.id)
    const existing = sessionAttendance.find(a => a.child_id === child.id)
    const now = new Date().toISOString()
    if (existing) {
      await supabase.from('attendance').update({ status: 'signed_in', signed_in_at: now, signed_out_at: null }).eq('id', existing.id)
      setLocalAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status: 'signed_in', signed_in_at: now, signed_out_at: null } : a))
    } else {
      const { data } = await supabase.from('attendance').insert({
        session_id: activeSession.id, child_id: child.id, org_id: orgId, status: 'signed_in', signed_in_at: now
      }).select().single()
      if (data) setLocalAttendance(prev => [...prev, data])
    }
    setBusyChildId(null)
  }

  const handleSignOut = async (child) => {
    if (!activeSession) return
    setBusyChildId(child.id)
    const existing = sessionAttendance.find(a => a.child_id === child.id)
    const now = new Date().toISOString()
    if (existing) {
      await supabase.from('attendance').update({ status: 'signed_out', signed_out_at: now }).eq('id', existing.id)
      setLocalAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status: 'signed_out', signed_out_at: now } : a))
    } else {
      const { data } = await supabase.from('attendance').insert({
        session_id: activeSession.id, child_id: child.id, org_id: orgId, status: 'signed_out', signed_out_at: now
      }).select().single()
      if (data) setLocalAttendance(prev => [...prev, data])
    }
    setBusyChildId(null)
  }

  const pct = stats.percent || 0

  const [nowTick, setNowTick] = React.useState(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => setNowTick(new Date()), 30000) // tick every 30s, enough for a minutes-based display
    return () => clearInterval(interval)
  }, [])

  const sessionTimeInfo = React.useMemo(() => {
    if (!activeSession?.start_time || !activeSession?.end_time || !activeSession?.session_date) {
      return { pct: 0, minutesLeft: null, hasEnded: false }
    }
    const start = new Date(`${activeSession.session_date}T${activeSession.start_time}`)
    const end = new Date(`${activeSession.session_date}T${activeSession.end_time}`)
    const total = end - start
    if (total <= 0) return { pct: 0, minutesLeft: null, hasEnded: false }
    const elapsed = nowTick - start
    const pct = Math.round((elapsed / total) * 100)
    const msLeft = end - nowTick
    const hasEnded = msLeft <= 0
    const minutesLeft = hasEnded ? 0 : Math.max(0, Math.round(msLeft / 60000))
    return { pct, minutesLeft, hasEnded }
  }, [activeSession, nowTick])
  const sessionTimePct = sessionTimeInfo.pct

  const isSessionEnded = React.useMemo(() => {
    if (!activeSession?.session_date) return false
    const endDateStr = activeSession.end_date || activeSession.session_date
    const endDateTime = new Date(`${endDateStr}T${activeSession.end_time || '23:59'}`)
    return endDateTime < nowTick
  }, [activeSession, nowTick])

  const hasReflection = (reflections || []).some(r => r.session_id === activeSession?.id)

  return (
    <div style={{ background: `linear-gradient(160deg, #0B1023 0%, #131B33 55%, #0F1729 100%)`, borderRadius: 22, overflow: 'hidden', position: 'relative', boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)`, marginBottom: 0 }}>

      {/* Ambient brand glow */}
      <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${primary}22, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -30, width: 220, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${secondary}18, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
        {!isMobile && (
          <>
            <button onClick={() => onOpenRegister(activeSession?.id)}
              style={{ position: 'absolute', top: 20, right: 22, padding: '11px 18px', borderRadius: 13, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `0 1px 0 rgba(255,255,255,0.25) inset, 0 8px 22px -6px ${primary}70`, transition: 'transform 0.12s', zIndex: 1 }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              Full Register →
            </button>
            <button onClick={() => { setPopupMode('walkin'); setPopupSearch('') }}
              style={{ position: 'absolute', top: 20, right: 152, padding: '11px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', transition: 'transform 0.12s', zIndex: 1 }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              + Walk-in
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginBottom: 14, padding: isMobile ? '0' : '0 130px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
            {isSessionEnded ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(148,163,184,0.16)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#CBD5E1', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#94A3B8', borderRadius: '50%' }}></span>
                SESSION ENDED
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#4ADE80', letterSpacing: 0.8, boxShadow: '0 2px 10px rgba(34,197,94,0.15)' }}>
                <span style={{ width: 5, height: 5, background: '#4ADE80', borderRadius: '50%', animation: 'pulse-live 1.5s infinite', boxShadow: '0 0 6px #4ADE80' }}></span>
                LIVE SESSION
              </span>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 23, fontWeight: 900, color: '#fff', letterSpacing: -0.5, fontFamily: 'var(--font-display, sans-serif)' }}>{activeSession?.title}</h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            {activeSession?.start_time || ''}{activeSession?.end_time ? ` – ${activeSession.end_time}` : ''}
            {activeSession?.location ? ` · ${activeSession.location}` : ''}
          </p>
        </div>

        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => { setPopupMode('walkin'); setPopupSearch('') }}
              style={{ flex: 1, padding: '11px 10px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)' }}>
              + Walk-in
            </button>
            <button onClick={() => onOpenRegister(activeSession?.id)}
              style={{ flex: 1, padding: '11px 10px', borderRadius: 13, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: `0 1px 0 rgba(255,255,255,0.25) inset, 0 8px 22px -6px ${primary}70` }}>
              Full Register →
            </button>
          </div>
        )}

        {/* Live group breakdown — clickable bubble filter pills */}
        {bubbleGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {bubbleGroups.map(g => {
              const gColor = getBubbleColor(g)
              const isActive = bubbleFilter === g
              return (
                <button key={g} onClick={() => setBubbleFilter(isActive ? 'all' : g)}
                  style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#fff', background: isActive ? gColor : gColor + '30', border: `1px solid ${gColor}90`, borderRadius: 99, padding: '4px 11px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {g}
                </button>
              )
            })}
            {bubbleFilter !== 'all' && (
              <button onClick={() => setBubbleFilter('all')} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>Clear ✕</button>
            )}
          </div>
        )}
      </div>

      {/* Stat row — single gradient strip, subtle dividers, legible colour-coded numbers */}
      <div style={{ margin: '0 22px 4px', background: `linear-gradient(90deg, #16A34A15, #7C3AED15, #2563EB15)`, borderRadius: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 10px 24px -12px rgba(0,0,0,0.4)', overflow: 'hidden', backdropFilter: 'blur(6px)' }}>
        {[
          { key: 'signed_in',  label: 'Signed In',  value: stats.signedIn,  color: '#4ADE80', icon: '↪' },
          { key: 'signed_out', label: 'Signed Out', value: stats.signedOut, color: '#C084FC', icon: '↩' },
          { key: 'expected',   label: 'Expected',   value: stats.expected,  color: '#60A5FA', icon: '👥' },
        ].map((s, i) => (
          <button key={s.key} onClick={() => setPopupMode(s.key)}
            style={{ background: 'transparent', border: 'none', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none', padding: isMobile ? '10px 4px' : '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 2 : 8 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 12, color: s.color }}>{s.icon}</span>
            <span style={{ fontSize: isMobile ? 16 : 19, fontWeight: 900, color: s.color, letterSpacing: -0.3, fontFamily: 'var(--font-display, sans-serif)', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{s.value}</span>
            <span style={{ fontSize: isMobile ? 9 : 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Progress + absent note */}
      <div style={{ padding: '16px 22px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          <span>Register progress</span>
          <span style={{ color: pct === 100 ? '#4ADE80' : 'rgba(255,255,255,0.4)', fontWeight: 800 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ADE80' : `linear-gradient(90deg, ${primary}, ${secondary})`, borderRadius: 99, transition: 'width 0.5s ease', boxShadow: pct > 0 ? `0 0 10px ${pct === 100 ? '#4ADE80' : primary}70` : 'none' }} />
        </div>

        {activeSession?.start_time && activeSession?.end_time && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              <span>Session progress</span>
              <span style={{ color: sessionTimeInfo.hasEnded ? '#F87171' : 'rgba(255,255,255,0.4)', fontWeight: 800 }}>
                {sessionTimeInfo.hasEnded
                  ? 'Ended'
                  : sessionTimePct <= 0
                  ? 'Not started'
                  : sessionTimeInfo.minutesLeft != null
                  ? `${sessionTimePct}% · ${sessionTimeInfo.minutesLeft >= 60 ? `${Math.floor(sessionTimeInfo.minutesLeft / 60)}h ${sessionTimeInfo.minutesLeft % 60}m left` : `${sessionTimeInfo.minutesLeft}m left`}`
                  : `${sessionTimePct}%`}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, sessionTimePct))}%`, background: sessionTimeInfo.hasEnded ? '#F87171' : `linear-gradient(90deg, #F59E0B, #F97316)`, borderRadius: 99, transition: 'width 0.5s ease', boxShadow: sessionTimePct > 0 ? `0 0 10px ${sessionTimeInfo.hasEnded ? '#F87171' : '#F59E0B'}70` : 'none' }} />
            </div>
          </div>
        )}

        {stats.absent > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#FB923C', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            ⚠ {stats.absent} marked absent
          </div>
        )}

        {isSessionEnded && !hasReflection && (
          <button onClick={() => onNavigate('planner', { reflectSessionId: activeSession?.id })}
            style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D' }}>Complete Reflection</div>
                <div style={{ fontSize: 11, color: 'rgba(252,211,77,0.75)', marginTop: 1 }}>This session has ended — capture what went well while it's fresh</div>
              </div>
            </div>
            <span style={{ color: '#FCD34D', fontSize: 16 }}>→</span>
          </button>
        )}
      </div>
      <style>{`@keyframes pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.6)}}`}</style>

      {popupMode && (
        <div onClick={() => setPopupMode(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>
                    {popupMode === 'expected' ? '👥 Expected Children' : popupMode === 'signed_in' ? '↪ Signed In' : popupMode === 'signed_out' ? '↩ Signed Out' : '🚶 Walk-in'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{activeSession?.title} · {popupChildren.length} {popupMode === 'expected' ? 'expected' : popupMode === 'signed_in' ? 'signed in' : popupMode === 'signed_out' ? 'signed out' : 'children'}</div>
                </div>
                <button onClick={() => setPopupMode(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: 16, color: '#6B7280' }}>×</button>
              </div>
              <input value={popupSearch} onChange={e => setPopupSearch(e.target.value)} placeholder="Search a child..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {/* Child rows */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {popupChildren.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  {popupMode === 'signed_in' ? 'No one signed in yet.' : popupMode === 'signed_out' ? 'No one signed out yet.' : popupMode === 'walkin' ? 'No children found.' : 'No children match.'}
                </div>
              ) : popupChildren.map(child => {
                const status = getChildStatus(child.id)
                const isIn = status === 'signed_in'
                const isOut = status === 'signed_out'
                const isExpected = sessionAttendance.some(a => a.child_id === child.id)
                const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
                const gColor = getBubbleColor(child.group_name)
                const isBusy = busyChildId === child.id
                return (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #F9FAFB', borderLeft: `3px solid ${gColor}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: gColor + '18', border: `1.5px solid ${gColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: gColor, flexShrink: 0, overflow: 'hidden' }}>
                      {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.first_name} {child.last_name}</div>
                      {child.group_name && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{child.group_name}</div>}
                    </div>
                    {popupMode === 'walkin' ? (
                      isIn ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', borderRadius: 99, padding: '5px 12px' }}>✓ In</span>
                      ) : (
                        <button onClick={() => handleWalkIn(child)} disabled={isBusy}
                          style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isBusy ? '#9CA3AF' : primary, border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                          {isBusy ? '···' : '+ Walk-in'}
                        </button>
                      )
                    ) : popupMode === 'expected' ? (
                      isIn ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', borderRadius: 99, padding: '5px 12px' }}>✓ In</span>
                      ) : isOut ? (
                        <button onClick={() => handleSignIn(child)} disabled={isBusy}
                          style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isBusy ? '#9CA3AF' : primary, border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                          {isBusy ? '···' : 'Sign In'}
                        </button>
                      ) : isExpected ? (
                        <button onClick={() => handleSignIn(child)} disabled={isBusy}
                          style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isBusy ? '#9CA3AF' : primary, border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                          {isBusy ? '···' : 'Sign In'}
                        </button>
                      ) : (
                        <button onClick={() => handleAddToExpected(child)} disabled={isBusy}
                          style={{ fontSize: 11, fontWeight: 800, color: primary, background: 'transparent', border: `1.5px solid ${primary}`, borderRadius: 99, padding: '6px 12px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                          {isBusy ? '···' : '+ Add'}
                        </button>
                      )
                    ) : isIn ? (
                      <button onClick={() => handleSignOut(child)} disabled={isBusy}
                        style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', background: isBusy ? '#F3F4F6' : '#DBEAFE', border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                        {isBusy ? '···' : 'Sign Out'}
                      </button>
                    ) : isOut ? (
                      <button onClick={() => handleSignIn(child)} disabled={isBusy}
                        style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isBusy ? '#9CA3AF' : primary, border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                        {isBusy ? '···' : 'Sign In'}
                      </button>
                    ) : (
                      <button onClick={() => handleSignIn(child)} disabled={isBusy}
                        style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isBusy ? '#9CA3AF' : primary, border: 'none', borderRadius: 99, padding: '7px 14px', cursor: isBusy ? 'default' : 'pointer', flexShrink: 0 }}>
                        {isBusy ? '···' : 'Sign In'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ordinalSuffix(day) {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function DateTimeInline({ primary }) {
  const [now, setNow] = React.useState(new Date())

  React.useEffect(() => {
    const tick = () => setNow(new Date())
    // Align to the next minute boundary, then tick every 60s
    const msToNextMinute = 60000 - (Date.now() % 60000)
    const timeout = setTimeout(() => {
      tick()
      const interval = setInterval(tick, 60000)
      return () => clearInterval(interval)
    }, msToNextMinute)
    return () => clearTimeout(timeout)
  }, [])

  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = now.toLocaleDateString('en-GB', { month: 'long' })
  const day = now.getDate()
  const year = now.getFullYear()
  const dateStr = `${weekday} ${day}${ordinalSuffix(day)} ${month} ${year}`
  const timeStr = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/^0/, '')

  return (
    <div style={{ textAlign: 'right', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text, #111)' }}>{dateStr}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: primary, letterSpacing: 0.2 }}>{timeStr}</div>
    </div>
  )
}

function NotificationBell({ primary, secondary, concernsCount, reflectionsCount, onGoConcerns, onGoReflections }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  const total = concernsCount + reflectionsCount

  React.useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${primary}22`, background: open ? primary + '10' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s', boxShadow: open ? `0 1px 0 rgba(255,255,255,0.7) inset, 0 4px 12px -4px ${primary}35` : `0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -3px ${primary}25` }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.borderColor = primary + '50'; e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 16px -6px ${primary}45` } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = primary + '22'; e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -3px ${primary}25` } }}
        aria-label="Notifications"
      >
        🔔
        {total > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff' }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, width: 300, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 800, color: '#111' }}>Notifications</div>
          {total === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
              You're all caught up.
            </div>
          ) : (
            <div style={{ padding: 6 }}>
              {concernsCount > 0 && (
                <button onClick={() => { onGoConcerns(); setOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 9 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🛡️</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{concernsCount} open safeguarding concern{concernsCount > 1 ? 's' : ''}</div>
                    <div style={{ fontSize: 11, color: '#B45309' }}>Needs review</div>
                  </div>
                </button>
              )}
              {reflectionsCount > 0 && (
                <button onClick={() => { onGoReflections(); setOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 9 }}
                  onMouseEnter={e => e.currentTarget.style.background = primary + '10'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📝</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{reflectionsCount} session reflection{reflectionsCount > 1 ? 's' : ''} due</div>
                    <div style={{ fontSize: 11, color: primary }}>Complete when ready</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Hub({ org, session, setTab, onNavigate, userProfile, onAvatarClick }) {
  const [hubUserName, setHubUserName] = React.useState(() => session?.user?.email?.split('@')[0] || 'there')
  const [search, setSearch] = React.useState('')
  const [searchResults, setSearchResults] = React.useState(null)

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  React.useEffect(() => {
    if (!session?.user?.id) return
    import('../../lib/supabase').then(({ supabase }) => {
      supabase.from('user_profiles').select('full_name').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.full_name) setHubUserName(data.full_name) })
    })
  }, [session?.user?.id])

  const orgId = org?.id;
  const primary = org?.primary_color || "#1B9AAA";
  const secondary = org?.secondary_color || "#0EA5E9";
  const activeModules = org?.modules || [];
  const hasModule = (key) => activeModules.includes(key);
  const orgName = org?.name || "LaunchSession";

  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [children, setChildren] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    const city = org?.city
    if (!city) { setWeatherError(true); return }
    let alive = true
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
      .then(r => r.json())
      .then(geo => {
        const loc = geo?.results?.[0]
        if (!loc || !alive) { if (alive) setWeatherError(true); return }
        return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`)
          .then(r => r.json())
          .then(data => {
            if (!alive || !data?.current) { if (alive) setWeatherError(true); return }
            setWeather({
              city: loc.name,
              temp: Math.round(data.current.temperature_2m),
              code: data.current.weather_code,
              wind: Math.round(data.current.wind_speed_10m),
              high: data.daily?.temperature_2m_max?.[0] != null ? Math.round(data.daily.temperature_2m_max[0]) : null,
              low: data.daily?.temperature_2m_min?.[0] != null ? Math.round(data.daily.temperature_2m_min[0]) : null,
              rainChance: data.daily?.precipitation_probability_max?.[0] ?? null,
            })
          })
      })
      .catch(() => { if (alive) setWeatherError(true) })
    return () => { alive = false }
  }, [org?.city]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const today = new Date().toISOString().split("T")[0];

  function go(tab, payload) {
    if (typeof onNavigate === "function") onNavigate(tab, payload);
    else if (typeof setTab === "function") setTab(tab);
  }

  const loadHub = React.useCallback(async () => {
    if (!orgId) return;
    const [
      { data: sessionData },
      { data: attendanceData },
      { data: concernData },
      { data: childData },
      { data: reflectionData },
    ] = await Promise.all([
      supabase.from("sessions").select("*").eq("org_id", orgId).order("session_date", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("attendance").select("*").eq("org_id", orgId),
      supabase.from("safeguarding_concerns").select("*").eq("org_id", orgId).eq("status", "open"),
      supabase.from("children").select("*").eq("org_id", orgId).eq("active", true).order("first_name", { ascending: true }),
      supabase.from("session_reflections").select("*").eq("org_id", orgId),
    ]);
    setSessions(sessionData || []);
    setAttendance(attendanceData || []);
    setConcerns(concernData || []);
    setChildren(childData || []);
    setReflections(reflectionData || []);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    setLoading(true);
    loadHub().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, loadHub]);

  // Live updates: Realtime on desktop/Android, polling fallback on iOS (WebKit crash risk)
  useRealtimeTable("attendance", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 3000 });
  useRealtimeTable("sessions", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 3000 });
  useRealtimeTable("safeguarding_concerns", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 3000 });

  // ── SEARCH ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    const q = search.toLowerCase()
    const timer = setTimeout(() => {
      const matchedChildren = children.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.group_name?.toLowerCase().includes(q)
      ).slice(0, 4)
      const matchedSessions = sessions.filter(s =>
        s.title?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)
      ).slice(0, 4)
      setSearchResults({ children: matchedChildren, sessions: matchedSessions })
    }, 250)
    return () => clearTimeout(timer)
  }, [search, children, sessions])

  const todaySessions = useMemo(() => {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    return sessions.filter(s => {
      if (!s.session_date) return false
      // Today's sessions — stay visible all day, even after they've ended, until midnight
      if (s.session_date === today) return true
      // Include yesterday's sessions that haven't ended yet (within 24h window)
      if (s.session_date === yesterdayStr && s.end_time) {
        const endDateTime = new Date(`${s.session_date}T${s.end_time}`)
        return endDateTime > yesterday && endDateTime > new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }
      // Include tomorrow's sessions starting within next 24h
      const startDateTime = new Date(`${s.session_date}T${s.start_time || '00:00'}`)
      return startDateTime <= in24h && startDateTime >= now
    }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }, [sessions, today]);
  const upcomingSessions = useMemo(() => {
    const now = new Date()
    const sevenDaysOut = new Date(now)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
    const sevenDaysStr = sevenDaysOut.toISOString().slice(0, 10)

    return sessions
      .filter(s => {
        if (!s.session_date) return false
        if (s.session_date === today) {
          const startDateTime = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
          const endDateStr = s.end_date || s.session_date
          const endDateTime = new Date(`${endDateStr}T${s.end_time || '23:59'}`)
          const hasStarted = !startDateTime || startDateTime <= now
          return hasStarted && endDateTime >= now
        }
        return s.session_date > today && s.session_date <= sevenDaysStr
      })
      .sort((a, b) => (a.session_date + (a.start_time || '')).localeCompare(b.session_date + (b.start_time || '')))
      .slice(0, 6)
  }, [sessions, today]);
  const completedWithoutReflection = useMemo(() => {
    const now = new Date();
    return sessions.filter(s => {
      const end = new Date(`${s.session_date}T${s.end_time || "23:59"}`);
      return end < now && !reflections.some(r => r.session_id === s.id);
    }).slice(0, 3);
  }, [sessions, reflections]);

  const signedIn = attendance.filter(a => a.status === "signed_in").length;
  const signedOut = attendance.filter(a => a.status === "signed_out").length;
  const medicalAlerts = children.filter(c => c.allergies || c.medical_notes).length;
  const attendanceRate = children.length > 0 ? Math.round((signedIn / children.length) * 100) : 0;
  const nextSession = upcomingSessions[0];
  const liveHeroSession = todaySessions[0];
  const trialDaysLeft = (org?.status === 'trial' && org?.created_at)
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(org.created_at).getTime()) / 86400000))
    : null;

  const getLiveSessionStats = (item) => {
    const records = attendance.filter(a => a.session_id === item.id);
    const si = records.filter(a => a.status === "signed_in").length;
    const absent = records.filter(a => a.status === "absent").length;
    const so = records.filter(a => a.status === "signed_out").length;
    const targetGroups = Array.isArray(item?.bubbles) ? item.bubbles.map(g => (g || '').toLowerCase()) : [];
    const targetedChildren = targetGroups.length > 0
      ? children.filter(c => targetGroups.includes((c.group_name || '').toLowerCase()))
      : children;
    const expected = Math.max(targetedChildren.length, records.length);
    return { signedIn: si, absent, signedOut: so, expected, percent: expected > 0 ? Math.round((si / expected) * 100) : 0 };
  };

  const openRegisterForSession = (sessionId) => {
    try { window.localStorage.setItem("launchsession_selected_session_id", sessionId); } catch (e) {}
    go("registers");
  };

  if (loading) return <div style={styles.page}><div style={styles.loading}>Loading...</div></div>;

  const pad = isMobile ? 16 : 22;

  return (
    <div style={styles.page}>
      {/* ── HEADER ── */}
      <header style={{ background: `linear-gradient(120deg, ${primary}14 0%, ${secondary}10 55%, var(--surface, #fff) 100%)`, borderBottom: `2px solid ${primary}22`, padding: `0 ${pad}px`, flexShrink: 0, position: 'relative', overflow: 'visible', boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, 0 12px 28px -20px ${primary}50` }}>

        {/* Brand gradient top strip — two-tone */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${secondary}, ${primary}22, transparent)` }} />

        {/* Ambient brand glow */}
        <div style={{ position: 'absolute', top: -40, right: '15%', width: 260, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${secondary}14, transparent 70%)`, pointerEvents: 'none' }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 0 14px', borderBottom: `1px solid ${primary}18`, position: 'relative' }}>

          {/* Org identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, padding: '4px 0' }}>
            <div style={{ position: 'relative' }}>
              {org?.logo_url ? (
                <img src={org.logo_url} alt={orgName} style={{ width: 48, height: 48, borderRadius: 13, objectFit: 'contain', border: `1.5px solid ${primary}30`, background: '#fff', padding: 3, boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 20px -6px ${primary}45` }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg, ${primary}, ${secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 900, color: '#fff', boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 -2px 0 rgba(0,0,0,0.1) inset, 0 8px 20px -6px ${primary}55` }}>
                  {orgName[0]}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
            </div>
            {!isMobile && (
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #111)', lineHeight: 1.25, fontFamily: 'var(--font-display, sans-serif)', whiteSpace: 'nowrap' }}>{orgName}</div>
                {org?.slogan && (
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text3, #6b7280)', fontStyle: 'italic', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230 }}>
                    "{org.slogan}"
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', background: `linear-gradient(90deg, ${primary}, ${secondary})`, borderRadius: 5, padding: '3px 9px', boxShadow: `0 2px 8px ${primary}35` }}>{org?.plan || 'Starter'} Plan</span>
                  {org?.status === 'trial' && trialDaysLeft !== null && (
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: trialDaysLeft <= 2 ? '#DC2626' : '#B45309', background: trialDaysLeft <= 2 ? '#FEE2E2' : '#FEF3C7', borderRadius: 5, padding: '3px 8px', border: `1px solid ${trialDaysLeft <= 2 ? '#FCA5A5' : '#FDE68A'}` }}>
                      ⭐ {trialDaysLeft}d left
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search — centred in header */}
          {!isMobile && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: 440, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: primary, fontSize: 14, opacity: 0.75, pointerEvents: 'none' }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && setSearch('')}
                  placeholder="Search young people, sessions..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 37px', borderRadius: 12, border: `1.5px solid ${primary}22`, background: '#fff', fontSize: 13, color: 'var(--text, #111)', outline: 'none', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: `0 1px 0 rgba(255,255,255,0.8) inset, 0 2px 8px -4px ${primary}25` }}
                  onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}18, 0 2px 10px -4px ${primary}35` }}
                  onBlur={e => { e.target.style.borderColor = primary + '22'; e.target.style.boxShadow = `0 1px 0 rgba(255,255,255,0.8) inset, 0 2px 8px -4px ${primary}25` }}
                />
                {searchResults && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 14, boxShadow: '0 16px 40px -8px rgba(0,0,0,0.18)', zIndex: 100, marginTop: 6, overflow: 'hidden' }}>
                  {searchResults.children.length === 0 && searchResults.sessions.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>No results for "{search}"</div>
                  ) : (
                    <>
                      {searchResults.children.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 14px 4px' }}>Young People</div>
                          {searchResults.children.map(c => (
                            <button key={c.id} onClick={() => { go('registers'); setSearch('') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = primary + '08'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: primary, flexShrink: 0 }}>{c.first_name[0]}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{c.first_name} {c.last_name}</div>
                                {c.group_name && <div style={{ fontSize: 11, color: '#6B7280' }}>{c.group_name}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.sessions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 14px 4px' }}>Sessions</div>
                          {searchResults.sessions.map(s => (
                            <button key={s.id} onClick={() => { openRegisterForSession(s.id); setSearch('') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = primary + '08'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📅</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{s.title}</div>
                                <div style={{ fontSize: 11, color: '#6B7280' }}>{formatDate(s.session_date)} · {s.start_time || 'No time'}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ padding: '8px 14px', borderTop: `1px solid ${primary}15` }}>
                    <button onClick={() => setSearch('')} style={{ fontSize: 11, color: primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Press Esc to close</button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Right: notifications + avatar + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
            <NotificationBell
              primary={primary}
              secondary={secondary}
              concernsCount={concerns.length}
              reflectionsCount={completedWithoutReflection.length}
              onGoConcerns={() => go('safeguarding')}
              onGoReflections={() => go('planner')}
            />
            {!isMobile && <DateTimeInline primary={primary} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 10px 5px 5px', borderRadius: 12, border: `1.5px solid ${primary}22`, background: '#fff', transition: 'all 0.2s', boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -3px ${primary}25` }}
              onClick={onAvatarClick}
              onMouseEnter={e => { e.currentTarget.style.borderColor = primary + '50'; e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 16px -6px ${primary}45` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = primary + '22'; e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -3px ${primary}25` }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, ${secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0, boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 3px 10px -2px ${primary}50` }}>
                {userProfile?.photo_url ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : hubUserName[0]?.toUpperCase() || '?'}
              </div>
              {!isMobile && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #111)', fontFamily: 'var(--font-display, sans-serif)', lineHeight: 1.2 }}>{hubUserName.split(' ')[0]}</div>
                  {userProfile?.role && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: primary, lineHeight: 1.2, textTransform: 'capitalize' }}>{userProfile.role}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Greeting row */}
        <div style={{ padding: '14px 0 12px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 900, color: 'var(--text, #0f172a)', lineHeight: 1.15, fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '-0.3px' }}>
            {getGreeting()}, {hubUserName.split(' ')[0]}! 👋
          </h1>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3, #64748b)', fontWeight: 600, background: todaySessions.length > 0 ? '#DCFCE7' : '#F3F4F6', borderRadius: 99, padding: '3px 10px' }}>
              <span style={{ color: todaySessions.length > 0 ? '#16A34A' : '#9ca3af', fontSize: 7 }}>●</span>
              {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} today
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, background: concerns.length > 0 ? '#FEF9C3' : '#DCFCE7', color: concerns.length > 0 ? '#92400E' : '#16A34A', borderRadius: 99, padding: '3px 10px' }}>
              {concerns.length > 0 ? `⚠ ${concerns.length} concern${concerns.length > 1 ? 's' : ''}` : '✓ All clear'}
            </span>
            {!isMobile && children.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{children.length} young people</span>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* ── LIVE SESSION HERO ── */}
      <div style={{ padding: `${pad}px ${pad}px 0` }}>
      {liveHeroSession ? (
        <div style={{ display: 'grid', gridTemplateColumns: todaySessions.length === 1 ? '1fr' : todaySessions.length === 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: '0 0 8px' }}>
          {todaySessions.slice(0, 20).map(s => (
            <LiveSessionPanel
              key={s.id}
              sessions={[s]}
              childList={children}
              attendance={attendance}
              primary={primary}
              secondary={secondary}
              orgId={org?.id}
              reflections={reflections}
              onOpenRegister={openRegisterForSession}
              onNavigate={go}
              getLiveSessionStats={getLiveSessionStats}
            />
          ))}
        </div>
      ) : (
        <section style={{ ...styles.encouragement, background: `linear-gradient(135deg, ${primary}, #6D28D9)` }}>
          <div style={styles.trophy}>🏆</div>
          <div>
            <h2 style={styles.encouragementTitle}>Keep making an impact, {orgName}! ⭐</h2>
            <p style={styles.encouragementText}>Supporting {children.length} young people across {sessions.length} planned sessions.</p>
          </div>
          <div style={styles.confetti}>✨</div>
        </section>
      )}
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 18, padding: pad }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* TODAY AT A GLANCE */}
          <Panel title="🧭 Today at a glance">
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>

              {/* WEATHER CARD */}
              <div style={{ background: weather ? `linear-gradient(135deg, #0EA5E9, #38BDF8)` : 'linear-gradient(135deg, #94A3B8, #CBD5E1)', borderRadius: 16, padding: '16px 18px', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 128, boxShadow: '0 10px 28px -10px rgba(14,165,233,0.5)', flex: '1 1 220px', minWidth: 200 }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                {weatherError ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🌡️</div>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>Weather unavailable</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Add a city in Settings</div>
                  </div>
                ) : !weather ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>Loading weather...</div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>{weather.city}</div>
                      <div style={{ fontSize: 26 }}>{weatherFromCode(weather.code).icon}</div>
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 4, fontFamily: 'var(--font-display, sans-serif)' }}>{weather.temp}°<span style={{ fontSize: 16, fontWeight: 700, opacity: 0.8 }}>C</span></div>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, marginTop: 2 }}>{weatherFromCode(weather.code).label}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                      {weather.high != null && <span>↑{weather.high}° ↓{weather.low}°</span>}
                      {weather.rainChance != null && <span>💧 {weather.rainChance}%</span>}
                      <span>💨 {weather.wind}mph</span>
                    </div>
                  </div>
                )}
              </div>

              <StatCard icon="🗓️" title={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today` : "No sessions today"} text={todaySessions.length > 0 ? "Ready for delivery" : "Plan something amazing"} button="Open Planner" onClick={() => go("planner")} colour={primary} />
              <StatCard icon="⚽" title={nextSession ? nextSession.title : "Next Session"} text={nextSession ? `${formatDate(nextSession.session_date)} · ${nextSession.start_time || "No time"}` : "Nothing booked yet"} badge={nextSession ? "Upcoming" : "Plan now"} onClick={() => go("planner")} colour="#7C3AED" />
              {hasModule('registers') ? (
                <StatCard icon="✅" title={signedIn > 0 ? `${signedIn} signed in` : "Registers"} text={signedOut > 0 ? `${signedOut} signed out` : "Take today's register"} button="Take Register" onClick={() => go("registers")} colour="#16A34A" />
              ) : (
                <StatCard icon="👥" title="Young People" text={`${children?.length || 0} on roll`} button="View roster" onClick={() => go("planner")} colour="#16A34A" />
              )}
              {hasModule('safeguarding') ? (
                <StatCard icon="🛡️" title={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? 's' : ''}` : "Safeguarding"} text={concerns.length > 0 ? "Needs attention" : "All clear"} button="View concerns" onClick={() => go("safeguarding")} colour={concerns.length > 0 ? "#F59E0B" : "#2563EB"} />
              ) : (
                <StatCard icon="🚀" title="Grow your workspace" text="Unlock more modules" button="Explore plans" onClick={() => go("settings")} colour="#7C3AED" />
              )}
            </div>
          </Panel>

          {/* COMING UP */}
          <div>
            <style>{`@keyframes pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.6)}}`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text,#111)', margin: 0 }}>📅 Live &amp; Upcoming (next 7 days)</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => go('calendar')} style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>📆 Calendar</button>
                <button onClick={() => go('planner')} style={{ fontSize: 11, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ New session</button>
              </div>
            </div>
            {upcomingSessions.length === 0 ? (
              <div style={{ background: `linear-gradient(135deg, ${primary}10, ${primary}05)`, border: `1.5px dashed ${primary}30`, borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text,#111)', marginBottom: 6 }}>Nothing running or planned in the next 7 days</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Create a session and it'll appear here instantly</div>
                <button onClick={() => go('planner')} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px ${primary}40` }}>Plan a Session →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingSessions.map((s, idx) => {
                  const isToday = s.session_date === today
                  const now = new Date()
                  const startDateTime = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
                  const isLiveNow = isToday && (!startDateTime || startDateTime <= now)
                  const typeColors = {
                    activity:  { bg: '#EFF6FF', accent: '#3B82F6', icon: '🏃' },
                    workshop:  { bg: '#F0FDF4', accent: '#16A34A', icon: '🛠️' },
                    trip:      { bg: '#FFFBEB', accent: '#D97706', icon: '🚌' },
                    sports:    { bg: '#F0FDF4', accent: '#16A34A', icon: '⚽' },
                    arts:      { bg: '#FAF5FF', accent: '#7C3AED', icon: '🎨' },
                    mentoring: { bg: '#EFF6FF', accent: '#2563EB', icon: '🤝' },
                  }
                  const tc = typeColors[s.session_type] || { bg: primary + '10', accent: primary, icon: '📅' }
                  return (
                    <div key={s.id}
                      style={{ width: '100%', background: isToday ? `linear-gradient(135deg, ${primary}, ${primary}CC)` : '#fff', border: isToday ? 'none' : '1.5px solid #F1F5F9', borderRadius: 18, padding: '18px 18px', cursor: 'pointer', textAlign: 'left', boxShadow: isToday ? `0 8px 32px ${primary}35` : '0 2px 12px rgba(0,0,0,0.06)', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                      onClick={() => go('planner')}
                      onMouseEnter={e => { if (!isToday) { e.currentTarget.style.borderColor = primary; e.currentTarget.style.boxShadow = `0 4px 20px ${primary}20`; e.currentTarget.style.transform = 'translateY(-2px)' }}}
                      onMouseLeave={e => { if (!isToday) { e.currentTarget.style.borderColor = '#F1F5F9'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}}>

                      {/* Background decoration */}
                      {isToday && <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />}

                      {/* Calendar jump icon */}
                      <button onClick={e => { e.stopPropagation(); go('calendar') }} title="View in Calendar"
                        style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 9, border: 'none', background: isToday ? 'rgba(255,255,255,0.2)' : '#F8FAFC', color: isToday ? '#fff' : '#6B7280', fontSize: 13, cursor: 'pointer', zIndex: 2 }}>
                        📆
                      </button>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        {/* Icon */}
                        <div style={{ width: 46, height: 46, borderRadius: 13, background: isToday ? 'rgba(255,255,255,0.2)' : tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: isToday ? '1px solid rgba(255,255,255,0.3)' : 'none' }}>
                          {tc.icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: isToday ? '#fff' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                            {isLiveNow && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse-live 1.5s infinite' }} />LIVE NOW</span>}
                            {isToday && !isLiveNow && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>TODAY</span>}
                            {idx === 0 && !isToday && <span style={{ background: primary + '15', color: primary, borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>NEXT</span>}
                          </div>

                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: isToday ? 'rgba(255,255,255,0.8)' : '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>📅</span> {formatDate(s.session_date)}
                            </span>
                            {s.start_time && (
                              <span style={{ fontSize: 12, color: isToday ? 'rgba(255,255,255,0.8)' : '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>⏰</span> {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
                              </span>
                            )}
                            {s.location && (
                              <span style={{ fontSize: 12, color: isToday ? 'rgba(255,255,255,0.8)' : '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>📍</span> {s.location.split(',')[0]}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 18, color: isToday ? 'rgba(255,255,255,0.7)' : '#CBD5E1', flexShrink: 0 }}>→</div>
                      </div>

                      {/* Bottom action bar for today's session */}
                      {isToday && hasModule('registers') && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', gap: 8 }}>
                          <button onClick={e => { e.stopPropagation(); openRegisterForSession(s.id) }}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                            🟢 Open Register
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* PHOTO CAROUSEL */}
          <PhotoCarousel orgId={orgId} primary={primary} userId={session?.user?.id} />

          {/* ANNOUNCEMENTS — staff/admin only */}
          {['admin', 'owner', 'staff'].includes(userProfile?.role) && (
            <AnnouncementsPanel orgId={orgId} primary={primary} userId={session?.user?.id} />
          )}

          {/* REFLECTIONS DUE */}
          {completedWithoutReflection.length > 0 && (
            <Panel title={`⭐ Reflection Due (${completedWithoutReflection.length})`}>
              {completedWithoutReflection.map(s => (
                <MiniRow key={s.id} icon="📝" title={s.title} text={formatDate(s.session_date)} badge="Due" onClick={() => go("planner", { reflectSessionId: s.id })} />
              ))}
              <button style={styles.yellowButton} onClick={() => go("planner", { reflectSessionId: completedWithoutReflection[0]?.id })}>Complete reflections →</button>
            </Panel>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ATTENTION CENTRE */}
          {(hasModule('registers') || hasModule('safeguarding') || hasModule('volunteers') || hasModule('mentoring') || hasModule('reports')) && (
            <Panel title="🔔 Attention Centre">
              {hasModule('registers') && <AttentionRow icon="📋" label="Registers" value={signedIn > 0 ? `${signedIn} signed in today` : "No activity yet"} tone={signedIn > 0 ? "green" : "blue"} onClick={() => go("registers")} />}
              {hasModule('safeguarding') && <AttentionRow icon="🛡️" label="Safeguarding" value={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? "s" : ""}` : "No open concerns"} tone={concerns.length > 0 ? "amber" : "green"} onClick={() => go("safeguarding")} />}
              {hasModule('volunteers') && <AttentionRow icon="❤️" label="Volunteers" value="Review session cover" tone="blue" onClick={() => go("volunteers")} />}
              {hasModule('mentoring') && <AttentionRow icon="🤝" label="Mentoring" value="View active matches" tone="blue" onClick={() => go("mentoring")} />}
              {hasModule('reports') && <AttentionRow icon="📊" label="Reports" value="View impact data" tone="blue" onClick={() => go("reports")} />}
            </Panel>
          )}

          {/* SAFEGUARDING SNAPSHOT */}
          {hasModule('safeguarding') && (
            <Panel title="🛡️ Safeguarding Snapshot">
              <div style={styles.snapshotGrid}>
                <SmallMetric label="Open Concerns" value={concerns.length} colour={concerns.length > 0 ? "#F59E0B" : "#059669"} onClick={() => go("safeguarding")} />
                <SmallMetric label="Medical Alerts" value={medicalAlerts} colour="#F59E0B" onClick={() => go("registers")} />
                <SmallMetric label="Reflections Due" value={completedWithoutReflection.length} colour={completedWithoutReflection.length > 0 ? "#DC2626" : "#059669"} onClick={() => go("planner")} />
              </div>
            </Panel>
          )}

          {/* IMPACT */}
          <Panel title="💎 Impact This Month">
            <div style={styles.impactGrid}>
              <SmallMetric label="Young People" value={children.length} colour={primary} onClick={() => go("registers")} />
              <SmallMetric label="Sessions" value={sessions.length} colour="#7C3AED" onClick={() => go("planner")} />
              <SmallMetric label="Signed In" value={signedIn} colour="#2563EB" onClick={() => go("registers")} />
              <SmallMetric label="Attendance" value={`${attendanceRate}%`} colour="#059669" onClick={() => go("reports")} />
            </div>
          </Panel>
        </div>
      </section>
      </div>
    </div>
  );
}
function Panel({ title, children }) {
  return <div style={styles.panel}><h3 style={styles.panelTitle}>{title}</h3>{children}</div>;
}

function StatCard({ icon, title, text, button, badge, onClick, colour }) {
  return (
    <button onClick={onClick} style={{
      background: `linear-gradient(135deg, ${colour}, ${colour}CC)`,
      borderRadius: 16, padding: '16px 18px', color: '#fff', position: 'relative', overflow: 'hidden',
      minHeight: 128, boxShadow: `0 10px 28px -10px ${colour}80`, textAlign: 'left', cursor: 'pointer',
      border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      flex: '1 1 190px', minWidth: 180,
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 26 }}>{icon}</div>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: '10px 0 4px', lineHeight: 1.25 }}>{title}</h3>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0 }}>{text}</p>
      </div>
      {(button || badge) && (
        <div style={{ position: 'relative', marginTop: 10, display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 800, color: '#fff', alignSelf: 'flex-start' }}>
          {button || badge}
        </div>
      )}
    </button>
  );
}

function AttentionRow({ icon, label, value, tone, onClick }) {
  const colour = tone === "green" ? "#16A34A" : tone === "amber" ? "#F59E0B" : "#0EA5E9";
  return (
    <button style={styles.attentionRow} onClick={onClick}>
      <span style={{ ...styles.attentionIcon, fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{value}</div>
      </div>
      <span style={{ ...styles.dot, background: colour }} />
    </button>
  );
}

function MiniRow({ icon, title, text, badge, onClick }) {
  return (
    <div style={{ ...styles.miniRow, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111)' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>{text}</div>
      </div>
      {badge && <span style={styles.dueBadge}>{badge}</span>}
    </div>
  );
}

function SmallMetric({ label, value, colour, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.smallMetric, cursor: onClick ? 'pointer' : 'default' }}>
      <strong style={{ color: colour, fontSize: 22, fontWeight: 900 }}>{value}</strong>
      <span style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{label}</span>
    </button>
  );
}

function weatherFromCode(code) {
  const map = {
    0: { icon: '☀️', label: 'Clear sky' },
    1: { icon: '🌤️', label: 'Mostly clear' },
    2: { icon: '⛅', label: 'Partly cloudy' },
    3: { icon: '☁️', label: 'Overcast' },
    45: { icon: '🌫️', label: 'Fog' }, 48: { icon: '🌫️', label: 'Fog' },
    51: { icon: '🌦️', label: 'Light drizzle' }, 53: { icon: '🌦️', label: 'Drizzle' }, 55: { icon: '🌦️', label: 'Heavy drizzle' },
    61: { icon: '🌧️', label: 'Light rain' }, 63: { icon: '🌧️', label: 'Rain' }, 65: { icon: '🌧️', label: 'Heavy rain' },
    71: { icon: '🌨️', label: 'Light snow' }, 73: { icon: '🌨️', label: 'Snow' }, 75: { icon: '❄️', label: 'Heavy snow' },
    80: { icon: '🌦️', label: 'Rain showers' }, 81: { icon: '🌧️', label: 'Rain showers' }, 82: { icon: '⛈️', label: 'Violent showers' },
    95: { icon: '⛈️', label: 'Thunderstorm' }, 96: { icon: '⛈️', label: 'Thunderstorm' }, 99: { icon: '⛈️', label: 'Severe storm' },
  }
  return map[code] || { icon: '🌡️', label: 'Weather' }
}

function formatDate(date) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const styles = {
  page: { height: "100%", background: "linear-gradient(180deg, #F8FBFF 0%, #EEF4FA 100%)", padding: 0, color: "#0F172A", overflow: "hidden", display: "flex", flexDirection: "column", boxSizing: "border-box" },
  loading: { padding: 50, textAlign: "center", color: "#64748B", fontWeight: 800 },
  liveHero: { background: "linear-gradient(135deg, #081226, #12235A)", borderRadius: 22, color: "#fff", padding: 24, marginBottom: 22, boxShadow: "0 18px 38px rgba(15,23,42,0.25)" },
  liveHeroTop: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 22 },
  liveBadge: { color: "#5EEAD4", fontSize: 12, fontWeight: 950, letterSpacing: 2 },
  liveCount: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 800 },
  liveHeroBody: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 },
  liveHeroTitle: { margin: 0, fontSize: 26, fontWeight: 950 },
  liveHeroMeta: { margin: "8px 0 0", color: "rgba(255,255,255,0.72)", fontSize: 14 },
  liveHeroButton: { border: "none", background: "linear-gradient(135deg, #06B6D4, #14B8A6)", color: "#fff", borderRadius: 14, padding: "13px 18px", fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap" },
  liveStatsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 },
  liveStat: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 4 },
  progressLabel: { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: 800, marginBottom: 8 },
  progressBar: { height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  equalLiveGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 16 },
  equalLiveCard: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 20 },
  equalLiveTitle: { fontSize: 20, fontWeight: 950, color: "#fff" },
  equalLiveMeta: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
  equalStatsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  equalStat: { padding: "12px 8px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 3 },
  equalPrimaryButton: { border: "none", color: "#fff", borderRadius: 12, padding: "12px 14px", fontWeight: 900, cursor: "pointer", fontSize: 13, width: "100%" },
  encouragement: { borderRadius: 18, color: "#fff", padding: "22px 26px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 16px 34px rgba(79,70,229,0.25)", marginBottom: 22, overflow: "hidden" },
  trophy: { fontSize: 48 },
  encouragementTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  encouragementText: { margin: "7px 0 0", fontWeight: 600, fontSize: 13, opacity: 0.85 },
  confetti: { marginLeft: "auto", fontSize: 26 },
  mainGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 },
  leftColumn: { display: "flex", flexDirection: "column", gap: 18 },
  rightColumn: { display: "flex", flexDirection: "column", gap: 18 },
  panel: { background: "rgba(255,255,255,0.92)", border: "1px solid #E5EAF2", borderRadius: 20, padding: 18, boxShadow: "0 12px 28px rgba(15,23,42,0.06)" },
  panelTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: 'var(--text, #111)' },
  glanceGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  mobileGrid: { gridTemplateColumns: "1fr" },
  statCard: { background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: 16, textAlign: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", width: "100%" },
  bigIcon: { fontSize: 36, marginBottom: 8 },
  statTitle: { margin: "0 0 4px", fontSize: 14, fontWeight: 900 },
  cardText: { margin: 0, color: "#64748B", fontSize: 12, lineHeight: 1.45 },
  softBadge: { marginTop: 12, background: "#F5F3FF", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 800 },
  actionCard: { border: "1px solid #E5EAF2", borderRadius: 14, padding: "12px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", width: "100%" },
  actionIcon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, flexShrink: 0 },
  attentionRow: { width: "100%", border: "1px solid #E5EAF2", background: "#F8FAFC", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, textAlign: "left", cursor: "pointer" },
  attentionIcon: { width: 34, height: 34, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  miniRow: { display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #EEF2F7", padding: "10px 0" },
  dueBadge: { background: "#FEF3C7", color: "#B45309", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 800 },
  yellowButton: { width: "100%", border: "none", background: "#FACC15", color: "#111827", borderRadius: 10, padding: 11, marginTop: 12, fontWeight: 900, cursor: "pointer" },
  smallMetric: { background: "#F8FAFC", border: "1px solid #E5EAF2", borderRadius: 12, padding: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" },
  snapshotGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  impactGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
};

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useRealtimeTable } from "../../lib/useRealtimeTable";
import { useOrgSettings } from "../../hooks/useOrgSettings";
import CauseForConcernForm from "../safeguarding/CauseForConcernForm";
import LiveRegister from "../registers/LiveRegister";
import { InviteParentModal } from "../children/ChildrenDirectory";
import AddVolunteersToSessionModal from "../volunteers/AddVolunteersToSessionModal";
import { isPushSupported, getNotificationPermission, subscribeToPush } from "../../services/pushNotifications";
import { notifyEvent } from "../../services/notifyEvent";

// Shown wherever the org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

const ANNOUNCEMENT_EMOJIS = ['📣', '🎉', '⭐', '🔥', '💡', '📌', '🚨', '🙌', '❤️', '🏆']
const RA_RATING_COLORS = {
  low: { bg: 'rgba(34,197,94,0.18)', color: '#86EFAC' },
  medium: { bg: 'rgba(245,158,11,0.18)', color: '#FDE047' },
  high: { bg: 'rgba(239,68,68,0.18)', color: '#FCA5A5' },
  critical: { bg: 'rgba(124,58,237,0.2)', color: '#C4B5FD' },
}

// ── LIVE SESSION CARD: dual progress rings ──────────────────────
const RING_R = 22
const RING_C = 2 * Math.PI * RING_R // ≈ 106.8

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Attendance ring — draws in on mount, fires a one-off confetti burst
// the moment everyone expected is signed in.
function AttendanceRing({ signedIn, total, primary, secondary }) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, signedIn / total)) : 0
  const offset = RING_C * (1 - fraction)
  const isFull = total > 0 && signedIn === total
  const firedRef = useRef(false)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (isFull && !firedRef.current) {
      firedRef.current = true
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 900)
      return () => clearTimeout(t)
    }
    if (!isFull) firedRef.current = false
  }, [isFull])

  const confettiColours = ['#4ADE80', primary, secondary, '#FBBF24']

  return (
    <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="27" cy="27" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <motion.circle
          cx="27" cy="27" r={RING_R} fill="none" stroke="#4ADE80" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={RING_C}
          initial={{ strokeDashoffset: RING_C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 0.85, 0.3, 1] }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>
        {signedIn}/{total}
      </div>
      {celebrate && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = Math.random() * Math.PI * 2
            const dist = 26 + Math.random() * 36
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 8, opacity: 0, scale: 0.3, rotate: Math.random() * 360 }}
                transition={{ duration: 0.85, delay: Math.random() * 0.15, ease: [0.2, 0.7, 0.4, 1] }}
                style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -2.5, marginLeft: -2.5, width: 5, height: 5, borderRadius: 1, background: confettiColours[i % confettiColours.length] }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Time ring — counts down to session end while live, to session start
// while upcoming, and settles into a solid tick once closed. The fill
// reflects real elapsed progress through a fixed, meaningful window
// (session duration while live; time-since-creation-to-start while
// upcoming) passed in via `totalSeconds`, so the ring's fraction is
// stable across reloads instead of resetting to "full" every time the
// card happens to mount.
function TimeRing({ status, target, totalSeconds }) {
  const [remaining, setRemaining] = useState(() => (target ? Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)) : 0))

  useEffect(() => {
    if (!target || status === 'ended') return
    const tick = () => setRemaining(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target, status])

  if (status === 'ended') {
    return (
      <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="27" cy="27" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
          <circle cx="27" cy="27" r={RING_R} fill="none" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={0} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#4ADE80' }}>✓</div>
      </div>
    )
  }

  if (!target) {
    return (
      <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="27" cy="27" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>–</div>
      </div>
    )
  }

  const total = totalSeconds && totalSeconds > 0 ? totalSeconds : (remaining || 1)
  const fraction = Math.max(0, Math.min(1, remaining / total))
  const offset = RING_C * (1 - fraction)
  const colour = status === 'live' ? '#2EC5CE' : '#FBBF24'

  return (
    <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="27" cy="27" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <motion.circle
          cx="27" cy="27" r={RING_R} fill="none" stroke={colour} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={RING_C}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>
        {formatCountdown(remaining)}
      </div>
    </div>
  )
}

// ── ANNOUNCEMENTS PANEL ─────────────────────────────────────────
// Staff/admin only — visibility is enforced both here (UI) and via RLS
// (see announcements table policies), so this is defense in depth, not
// the only guard.
// ─── PHOTO CAROUSEL ──────────────────────────────────────────
function PhotoCarousel({ orgId, primary, userId }) {
  const [photos, setPhotos] = React.useState([])
  const [uploading, setUploading] = React.useState(false)
  const [lightbox, setLightbox] = React.useState(null)
  const [managing, setManaging] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef(null)
  const scrollRef = React.useRef(null)

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

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || !el.clientWidth) return
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const scrollToIndex = (i) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={e => handleUpload(e.target.files)} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>📸 Photos</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {photos.length > 0 && (
            <button onClick={() => setManaging(m => !m)}
              style={{ padding: '6px 14px', borderRadius: 99, border: '1.5px solid #E5E7EB', background: managing ? '#F1F5F9' : '#fff', color: managing ? '#374151' : '#6B7280', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {managing ? 'Done' : 'Manage'}
            </button>
          )}
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${primary}`, background: uploading ? '#F3F4F6' : '#fff', color: primary, fontSize: 12, fontWeight: 800, cursor: uploading ? 'default' : 'pointer' }}>
            📷 {uploading ? 'Uploading...' : 'Add Photo'}
          </button>
        </div>
      </div>

      {/* Photo carousel — full-width, swipeable, snaps one photo per view */}
      {photos.length === 0 ? (
        <div onClick={() => inputRef.current?.click()}
          style={{ height: 110, borderRadius: 16, border: '2px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 22 }}>📷</span> Add your first photo
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={handleScroll} className="ls-hide-scrollbar"
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', borderRadius: 18 }}>
            {photos.map(p => (
              <div key={p.id} onClick={() => !managing && setLightbox(p)}
                style={{ position: 'relative', flex: '0 0 100%', width: '100%', scrollSnapAlign: 'center', height: 230, overflow: 'hidden', cursor: 'pointer', borderRadius: 18, background: '#F1F5F9' }}>
                <img src={p.url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {p.caption && (
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 16px 12px', background: 'linear-gradient(0deg, rgba(0,0,0,0.55), transparent)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
                    {p.caption}
                  </div>
                )}
                {/* Delete dot — only shown once "Manage" is tapped, not by default */}
                {managing && (
                  <button onClick={e => handleDelete(e, p)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Dot pagination */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => scrollToIndex(i)}
                  style={{ width: i === activeIndex ? 18 : 6, height: 6, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer', background: i === activeIndex ? primary : '#E2E8F0', transition: 'width 0.25s ease, background 0.25s ease' }} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox — portaled to <body> so it always sits above the bottom nav pill (z-index 9999) and Launch FAB (z-index 10000), and can't get trapped inside any ancestor's stacking context */}
      {lightbox && createPortal(
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 999999, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox.url} alt={lightbox.caption || ''} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }} />
          {lightbox.caption && (
            <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '6px 16px', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              {lightbox.caption}
            </div>
          )}
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 16px))', right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', zIndex: 1 }}>×</button>
        </div>,
        document.body
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
const COLLECTION_TYPES_HUB = [
  { key: 'approved_adult', label: 'Approved adult' },
  { key: 'parent_guardian', label: 'Parent or guardian' },
  { key: 'independent', label: 'Leaving independently' },
  { key: 'staff_transport', label: 'Staff transport' },
  { key: 'other', label: 'Other' },
]
const ABSENCE_REASONS_HUB = ['Absent', 'Cancelled', 'Ill', 'Parent notified', 'No reason provided']
const NOTE_TYPES_HUB = [
  { key: 'general', label: 'General note', icon: '📝' },
  { key: 'late_arrival', label: 'Late arrival', icon: '⏰' },
  { key: 'early_collection', label: 'Early collection', icon: '🚪' },
  { key: 'behaviour', label: 'Behaviour note', icon: '⚠️' },
  { key: 'injury', label: 'Injury / first aid', icon: '🩹' },
  { key: 'incident', label: 'Accident or incident', icon: '🚨' },
]
function hubFmtTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }) }
function hubRequiredRatio(session, org) {
  if (session?.staff_ratio) {
    const m = session.staff_ratio.match(/(\d+)\s*:\s*(\d+)/)
    if (m) return Number(m[2]) / Number(m[1])
  }
  return org?.default_staff_ratio || 8
}

function ModalEdgeFade({ colour = '#0B1023' }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, background: `linear-gradient(to bottom, ${colour}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, background: `linear-gradient(to top, ${colour}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 32, background: `linear-gradient(to right, ${colour}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 32, background: `linear-gradient(to left, ${colour}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
    </>
  )
}

function LiveSessionPanel({ sessions, childList, attendance, primary, secondary, orgId, org, authUserId, reflections, onNavigate, getLiveSessionStats }) {
  const isMobile = useIsMobile()
  const [activeSession, setActiveSession] = useState(sessions[0])
  const [localAttendance, setLocalAttendance] = useState(attendance)
  const [bubbleFilter, setBubbleFilter] = useState('all')
  const [linkedRA, setLinkedRA] = useState(undefined) // undefined = loading, null = none, object = found
  const [showRAPicker, setShowRAPicker] = useState(false)
  const [viewingRA, setViewingRA] = useState(false)
  const [raOptions, setRaOptions] = useState([])
  const [raPickerSearch, setRaPickerSearch] = useState('')
  const [raPickerBusy, setRaPickerBusy] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoToast, setPhotoToast] = useState('')
  const photoInputRef = React.useRef(null)

  // ── Full register state (built in, matching the card's own dark aesthetic) ──
  const [regTab, setRegTab] = useState('expected')
  const [regExpanded, setRegExpanded] = useState(false)
  const [regSearch, setRegSearch] = useState('')
  const [signOutChild, setSignOutChild] = useState(null)
  const [absentChild, setAbsentChild] = useState(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [showClosure, setShowClosure] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [regToast, setRegToast] = useState('')
  const [sessionStaff, setSessionStaff] = useState([])
  const [staffProfiles, setStaffProfiles] = useState({})
  const [sessionNotes, setSessionNotes] = useState([])

  const loadRegisterExtras = React.useCallback(async () => {
    if (!activeSession?.id) return
    const [{ data: ssData }, { data: noteData }] = await Promise.all([
      supabase.from('session_staff').select('*').eq('session_id', activeSession.id),
      supabase.from('session_notes').select('*').eq('session_id', activeSession.id).order('created_at', { ascending: false }),
    ])
    setSessionStaff(ssData || [])
    setSessionNotes(noteData || [])
    const staffIds = [...new Set((ssData || []).map(s => s.user_id).filter(Boolean))]
    if (staffIds.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', staffIds)
      const map = {}
      ;(profiles || []).forEach(p => { map[p.id] = p.full_name })
      setStaffProfiles(map)
    }
  }, [activeSession?.id])

  useEffect(() => { loadRegisterExtras() }, [loadRegisterExtras])

  // Keep local attendance in sync
  React.useEffect(() => { setLocalAttendance(attendance) }, [attendance])
  React.useEffect(() => { if (sessions.length) setActiveSession(sessions[0]) }, [sessions])

  // Closed sessions are historical records — open straight into the full register
  // instead of behind an extra click, and default to the tab that's actually useful.
  React.useEffect(() => {
    if (activeSession?.closed_at) {
      setRegTab(prev => prev === 'expected' ? 'signed_out' : prev)
      setRegExpanded(true)
    }
  }, [activeSession?.id, activeSession?.closed_at])

  const loadLinkedRA = React.useCallback(() => {
    if (!activeSession?.id) { setLinkedRA(null); return }
    supabase.from('risk_assessment_sessions').select('risk_assessments(id, name, risk_rating, status)').eq('session_id', activeSession.id).limit(1)
      .then(({ data, error }) => {
        if (error) { setLinkedRA(null); return }
        setLinkedRA(data && data.length > 0 ? data[0].risk_assessments : null)
      })
      .catch(() => setLinkedRA(null))
  }, [activeSession?.id])

  React.useEffect(() => { setLinkedRA(undefined); loadLinkedRA() }, [loadLinkedRA])
  useRealtimeTable('risk_assessment_sessions', loadLinkedRA, { filter: activeSession?.id ? `session_id=eq.${activeSession.id}` : undefined, enabled: !!activeSession?.id, pollInterval: 5000 })
  useRealtimeTable('risk_assessments', loadLinkedRA, { filter: linkedRA?.id ? `id=eq.${linkedRA.id}` : undefined, enabled: !!linkedRA?.id, pollInterval: 5000 })

  const openRAPicker = async () => {
    setShowRAPicker(true)
    setRaPickerSearch('')
    const { data } = await supabase.from('risk_assessments').select('id, name, activity_type, risk_rating, status')
      .eq('org_id', orgId).eq('archived', false).eq('is_template', false).order('name').limit(50)
    setRaOptions(data || [])
  }

  const attachExistingRA = async (a) => {
    setRaPickerBusy(true)
    await supabase.from('risk_assessment_sessions').insert({ assessment_id: a.id, session_id: activeSession.id, org_id: orgId })
    await supabase.from('risk_assessment_audit').insert({ assessment_id: a.id, org_id: orgId, action: 'attached', detail: `Attached to session "${activeSession.title}"`, actor_id: authUserId })
    setRaPickerBusy(false)
    setShowRAPicker(false)
    loadLinkedRA()
  }

  const createAndAttachRA = async () => {
    setRaPickerBusy(true)
    const { data: ra, error } = await supabase.from('risk_assessments').insert({
      org_id: orgId, name: activeSession.title?.trim() || 'Untitled Session', status: 'draft',
      location: activeSession.location || null, venue_id: activeSession.venue_id || null,
      created_by: authUserId,
    }).select().single()
    if (error) { setRaPickerBusy(false); return }
    await supabase.from('risk_assessment_sessions').insert({ assessment_id: ra.id, session_id: activeSession.id, org_id: orgId })
    await supabase.from('risk_assessment_audit').insert({ assessment_id: ra.id, org_id: orgId, action: 'created', detail: `Created for session "${activeSession.title}"`, actor_id: authUserId })
    setRaPickerBusy(false)
    setShowRAPicker(false)
    loadLinkedRA()
  }

  const sessionAttendance = localAttendance.filter(a => a.session_id === activeSession?.id)

  // Compute stats straight from this session's attendance rows — session creation
  // (create_session_with_dependencies) already writes one 'expected' row per child
  // targeted by group OR by individual selection, so this is the real roster,
  // not something to re-derive from bubbles on the client.
  const stats = React.useMemo(() => {
    if (!activeSession) return { signedIn: 0, expected: 0, absent: 0, signedOut: 0, percent: 0 }
    const si = sessionAttendance.filter(a => a.status === 'signed_in').length
    const so = sessionAttendance.filter(a => a.status === 'signed_out').length
    const absent = sessionAttendance.filter(a => a.status === 'absent').length
    const expected = sessionAttendance.filter(a => a.status === 'expected').length
    const total = sessionAttendance.length
    return { signedIn: si, absent, signedOut: so, expected, percent: total > 0 ? Math.round((si / total) * 100) : 0 }
  }, [activeSession, sessionAttendance])

  const { groups: orgGroups } = useOrgSettings(orgId)
  const getBubbleColor = (groupName) => {
    const name = (groupName || '').trim().toLowerCase()
    const match = (orgGroups || []).find(g => (g.label || '').trim().toLowerCase() === name)
    return match?.color || '#9CA3AF'
  }

  // All children with an attendance record for this session — this is the
  // real roster session creation wrote (bubbles, individual selection, or
  // walk-ins added since), not a re-derivation from bubbles alone.
  const targetedChildren = useMemo(() => {
    if (!activeSession) return []
    const ids = new Set(sessionAttendance.map(a => a.child_id))
    return childList.filter(c => ids.has(c.id))
  }, [activeSession, sessionAttendance, childList])

  // Live group breakdown — union of children targeted by this session's bubbles AND any
  // walk-ins who have an attendance record but weren't in a targeted group. Using attendance
  // alone meant a group selected for the session wouldn't show its pill until someone in that
  // group was actually signed in/expected, even though the session was already configured for it.
  const sessionChildIds = new Set(sessionAttendance.map(a => a.child_id))
  const targetedChildIds = new Set(targetedChildren.map(c => c.id))
  const sessionChildren = childList.filter(ch => sessionChildIds.has(ch.id) || targetedChildIds.has(ch.id))
  // Only ever show pills for groups that actually exist in org settings right now —
  // a child's group_name can go stale (group renamed/deleted) without the child
  // record itself being touched, and that shouldn't resurrect a phantom group.
  const configuredGroupLabels = new Map((orgGroups || []).map(g => [(g.label || '').trim().toLowerCase(), g.label]))
  const bubbleGroups = [...new Set(
    sessionChildren
      .map(ch => configuredGroupLabels.get((ch.group_name || '').trim().toLowerCase()))
      .filter(Boolean)
  )]

  const pct = stats.percent || 0

  // ── Register logic ──────────────────────────────────────────
  const attendanceByChild = useMemo(() => {
    const map = {}
    sessionAttendance.forEach(a => { map[a.child_id] = a })
    return map
  }, [sessionAttendance])

  const regRows = useMemo(() => targetedChildren.map(c => ({ child: c, att: attendanceByChild[c.id] || null })), [targetedChildren, attendanceByChild])

  const regGrouped = useMemo(() => {
    const g = { expected: [], signed_in: [], absent: [], signed_out: [] }
    regRows.forEach(r => {
      const status = r.att?.status
      if (status === 'signed_in') g.signed_in.push(r)
      else if (status === 'absent') g.absent.push(r)
      else if (status === 'signed_out') g.signed_out.push(r)
      else g.expected.push(r)
    })
    return g
  }, [regRows])

  const regSearchFiltered = (list) => {
    if (!regSearch.trim()) return list
    const q = regSearch.toLowerCase()
    return list.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q))
  }

  const showRegToast = (msg) => { setRegToast(msg); setTimeout(() => setRegToast(''), 3000) }

  async function upsertAttendance(childId, patch) {
    const existing = attendanceByChild[childId]

    // Closed registers are read-only — any correction needs a reason and an audit record.
    if (activeSession?.closed_at) {
      const reason = window.prompt('This register is closed. To make a correction, enter a reason (this will be recorded in the audit log):')
      if (!reason || !reason.trim()) return
      await supabase.from('attendance_corrections').insert({
        org_id: orgId, session_id: activeSession.id, attendance_id: existing?.id || null, child_id: childId,
        previous_status: existing?.status || null, new_status: patch.status || existing?.status || null,
        reason: reason.trim(), corrected_by: authUserId,
      })
    }

    if (existing) {
      const { data } = await supabase.from('attendance').update(patch).eq('id', existing.id).select().single()
      if (data) setLocalAttendance(prev => prev.map(a => a.id === existing.id ? data : a))
    } else {
      const { data } = await supabase.from('attendance').insert({ org_id: orgId, session_id: activeSession.id, child_id: childId, ...patch }).select().single()
      if (data) setLocalAttendance(prev => [...prev, data])
    }
  }

  const handleRegSignIn = async (child) => {
    const now = new Date().toISOString()
    await upsertAttendance(child.id, { status: 'signed_in', signed_in_at: now, signed_in_by: authUserId })
    showRegToast(`${child.first_name} signed in at ${hubFmtTime(now)}`)
  }

  const handleQuickSignOut = async (child) => {
    const now = new Date().toISOString()
    await upsertAttendance(child.id, { status: 'signed_out', signed_out_at: now, signed_out_by: authUserId })
    showRegToast(`${child.first_name} signed out at ${hubFmtTime(now)}`)
  }

  const handleConfirmSignOut = async (form) => {
    const now = new Date().toISOString()
    await upsertAttendance(signOutChild.id, {
      status: 'signed_out', signed_out_at: now, signed_out_by: authUserId,
      collection_type: form.collection_type, collected_by_name: form.collected_by_name || null,
      collection_note: form.collection_note || null, identity_checked: form.identity_checked,
    })
    showRegToast(`${signOutChild.first_name} signed out at ${hubFmtTime(now)}`)
    setSignOutChild(null)
  }

  const handleMarkAbsent = async (reason) => {
    await upsertAttendance(absentChild.id, { status: 'absent', absence_reason: reason })
    setAbsentChild(null)
  }

  const handleStaffSignIn = async (staffRow) => {
    await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString() }).eq('id', staffRow.id)
    loadRegisterExtras()
  }

  const handleAddRegNote = async (noteType, content, childId) => {
    if (!content.trim()) return
    await supabase.from('session_notes').insert({ org_id: orgId, session_id: activeSession.id, child_id: childId || null, note_type: noteType, content: content.trim(), created_by: authUserId })
    loadRegisterExtras()
  }

  const handleRaiseSafeguardingConcern = async (child, summary) => {
    const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', authUserId).maybeSingle()
    const childName = child ? `${child.first_name} ${child.last_name}`.trim() : null
    await supabase.from('cause_for_concern').insert({
      org_id: orgId, submitted_by: authUserId, submitter_name: profile?.full_name || 'Team member',
      child_name: childName, concern_type: 'other', description: summary,
      date_of_incident: new Date().toISOString().slice(0, 10),
      location: activeSession?.location || 'Not specified',
      session_id: activeSession?.id || null,
      status: 'open', priority: 'medium',
    })
    notifyEvent('SAFEGUARDING_ACTION_REQUIRED')
    showRegToast('Safeguarding concern raised — complete details in Safeguarding.')
    if (onNavigate) onNavigate('safeguarding')
  }

  const handleSelectExistingWalkIn = async (child) => {
    await handleRegSignIn(child)
    setShowWalkIn(false)
  }

  const handleCreateWalkIn = async (form) => {
    const { data } = await supabase.from('children').insert({
      org_id: orgId, first_name: form.first_name.trim(), last_name: form.last_name.trim() || '',
      emergency_contact_name: form.emergency_contact_name || null, emergency_contact_phone: form.emergency_contact_phone || null,
      is_walk_in: true, profile_incomplete: true, active: true,
    }).select().single()
    if (data) { await handleRegSignIn(data) }
    setShowWalkIn(false)
  }

  const handleMarkAllRemainingAbsent = async () => {
    await Promise.all(regGrouped.expected.map(r => upsertAttendance(r.child.id, { status: 'absent', absence_reason: 'No reason provided' })))
  }

  const handleCloseRegister = async () => {
    await supabase.from('sessions').update({ closed_at: new Date().toISOString(), closed_by: authUserId, register_status: 'closed' }).eq('id', activeSession.id)
    setActiveSession(prev => ({ ...prev, closed_at: new Date().toISOString() }))
    setShowClosure(false)
  }

  const requiredRatio = hubRequiredRatio(activeSession, org)
  const signedInStaffCount = sessionStaff.filter(s => s.signed_in_at).length || sessionStaff.length
  const currentRatio = signedInStaffCount > 0 ? stats.signedIn / signedInStaffCount : null
  const ratioBreached = currentRatio !== null && signedInStaffCount > 0 && currentRatio > requiredRatio
  const processedCount = regGrouped.signed_in.length + regGrouped.absent.length + regGrouped.signed_out.length

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
    // Only use end_date when the session genuinely crosses midnight (end_time earlier than start_time).
    // Some sessions carry a stray/incorrect end_date even when they're same-day — don't blindly trust it.
    const crossesMidnight = !!(activeSession.start_time && activeSession.end_time && activeSession.end_time < activeSession.start_time)
    const endDateStr = (crossesMidnight && activeSession.end_date) || activeSession.session_date
    const endDateTime = new Date(`${endDateStr}T${activeSession.end_time || '23:59'}`)
    return endDateTime < nowTick
  }, [activeSession, nowTick])

  const activeReflection = (reflections || []).find(r => r.session_id === activeSession?.id) || null
  const hasReflection = !!activeReflection

  // ── Session lifecycle: Upcoming → Live → Ending → Closed ──
  // Register opens 30 min before start (or when the lead starts the session early);
  // "Live" begins only when the lead taps Start Session (opened_at), not just because
  // the clock passed start time. "Ending" begins 15 min before scheduled end.
  const sessionStartDT = activeSession?.session_date && activeSession?.start_time ? new Date(`${activeSession.session_date}T${activeSession.start_time}`) : null
  const minsToStart = sessionStartDT ? Math.round((sessionStartDT - nowTick) / 60000) : null
  const registerOpen = !!activeSession && !activeSession.closed_at && (
    !!activeSession.opened_at || !!activeSession.register_opened_at || (minsToStart !== null && minsToStart <= 30)
  )
  const sessionPhase = React.useMemo(() => {
    if (!activeSession) return 'upcoming'
    if (activeSession.closed_at) return 'closed'
    if (!activeSession.opened_at) return 'upcoming'
    if (isSessionEnded) return 'ending'
    const endDT = activeSession.session_date && activeSession.end_time ? new Date(`${activeSession.session_date}T${activeSession.end_time}`) : null
    if (endDT && (endDT - nowTick) <= 15 * 60000) return 'ending'
    return 'live'
  }, [activeSession, isSessionEnded, nowTick])

  const handleStartSession = async () => {
    const now = new Date().toISOString()
    await supabase.from('sessions').update({ opened_at: now, opened_by: authUserId, register_opened_at: activeSession.register_opened_at || now }).eq('id', activeSession.id)
    setActiveSession(prev => ({ ...prev, opened_at: now, register_opened_at: prev.register_opened_at || now }))
    setRegExpanded(true)
    setRegToast('✓ Session started — register is live')
    setTimeout(() => setRegToast(''), 3000)
  }

  // Closure readiness checks (surfaced as warnings in the closure flow)
  const closureIssues = React.useMemo(() => {
    const issues = []
    const stillIn = regGrouped.signed_in.length
    const noStatus = regGrouped.expected.length
    if (stillIn > 0) issues.push(`${stillIn} young ${stillIn === 1 ? 'person is' : 'people are'} still signed in.`)
    if (noStatus > 0) issues.push(`${noStatus} expected attendee${noStatus === 1 ? ' has' : 's have'} no status.`)
    const staffStillIn = sessionStaff.filter(s => s.signed_in_at && !s.signed_out_at).length
    if (staffStillIn > 0) issues.push(`${staffStillIn} staff ${staffStillIn === 1 ? 'member is' : 'members are'} still signed in.`)
    if (!hasReflection) issues.push('Session reflection is incomplete.')
    return issues
  }, [regGrouped, sessionStaff, hasReflection])

  const handleAddPhotoFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length || !activeSession?.id) return
    setPhotoUploading(true)
    let succeeded = 0
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
        const { error: insErr } = await supabase.from('gallery_photos').insert({
          org_id: orgId, url: urlData.publicUrl, path,
          category: 'Sessions', session_id: activeSession.id,
          media_type: file.type.startsWith('video') ? 'video' : 'image',
          consent_status: 'pending_review',
        })
        if (!insErr) succeeded++
      }
    }
    setPhotoUploading(false)
    setPhotoToast(succeeded > 0 ? `✓ ${succeeded} photo${succeeded === 1 ? '' : 's'} added to ${activeSession.title}` : 'Upload failed — please try again')
    setTimeout(() => setPhotoToast(''), 3000)
  }

  return (
    <div style={{ background: `linear-gradient(160deg, ${primary}4D 0%, ${secondary}33 45%, transparent 100%), linear-gradient(160deg, #0B1023 0%, #131B33 55%, #0F1729 100%)`, borderRadius: 22, overflow: 'hidden', position: 'relative', boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)`, marginBottom: 0 }}>

      {/* Ambient brand glow */}
      <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${primary}22, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -30, width: 220, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${secondary}18, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
        <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={org?.name || ''} style={{
          position: 'absolute', top: 20, left: 22, zIndex: 1,
          width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 12, objectFit: 'contain',
          background: 'rgba(255,255,255,0.96)', padding: 3.5, border: '1.5px solid rgba(255,255,255,0.25)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 16px -6px rgba(0,0,0,0.4)',
        }} />
        {!isMobile && (
          <>
            <div style={{ position: 'absolute', top: 20, right: 22, display: 'flex', gap: 8, zIndex: 1 }}>
              <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                style={{ padding: '11px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: photoUploading ? 'default' : 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', transition: 'transform 0.12s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                {photoUploading ? 'Uploading…' : '📷 Add Photo'}
              </button>
              <button onClick={() => setShowWalkIn(true)}
                style={{ padding: '11px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', transition: 'transform 0.12s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                + Walk-in
              </button>
            </div>
          </>
        )}
        <input ref={photoInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => { handleAddPhotoFiles(e.target.files); e.target.value = '' }} />
        {photoToast && (
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 2, background: 'rgba(15,23,42,0.92)', color: '#fff', padding: '7px 16px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
            {photoToast}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 14, padding: isMobile ? '0 46px' : '0 130px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
            {sessionPhase === 'closed' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(148,163,184,0.16)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#CBD5E1', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#94A3B8', borderRadius: '50%' }}></span>
                CLOSED
              </span>
            ) : sessionPhase === 'ending' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#FB923C', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#FB923C', borderRadius: '50%', animation: 'pulse-live 1.5s infinite' }}></span>
                ENDING
              </span>
            ) : sessionPhase === 'upcoming' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#FBBF24', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#FBBF24', borderRadius: '50%' }}></span>
                {registerOpen ? 'REGISTER OPEN' : 'UPCOMING'}
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
          {linkedRA === undefined ? null : linkedRA ? (
            <button onClick={() => setViewingRA(true)}
              style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 99, padding: '5px 12px 5px 10px', cursor: 'pointer' }}>
              <span style={{ fontSize: 12 }}>🛡️</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{linkedRA.name}</span>
              <span style={{
                fontSize: 9.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', borderRadius: 99, padding: '2px 8px',
                background: RA_RATING_COLORS[linkedRA.risk_rating]?.bg || 'rgba(148,163,184,0.16)',
                color: RA_RATING_COLORS[linkedRA.risk_rating]?.color || '#CBD5E1',
              }}>{linkedRA.risk_rating || '—'}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>View →</span>
            </button>
          ) : (
            <button onClick={openRAPicker}
              style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 99, padding: '5px 12px', cursor: 'pointer' }}>
              <span style={{ fontSize: 12 }}>🛡️</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>No risk assessment attached</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>+ Attach</span>
            </button>
          )}
        </div>

        {/* ── Lifecycle prompts ── */}
        {sessionPhase === 'upcoming' && !activeSession?.closed_at && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 14, padding: '12px 16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              {minsToStart !== null && minsToStart > 0
                ? `${activeSession.title} starts in ${minsToStart >= 60 ? `${Math.floor(minsToStart / 60)}h ${minsToStart % 60}m` : `${minsToStart} min`}.${registerOpen ? ' Register is open for arrivals.' : ''}`
                : `${activeSession.title} is due to start now.`}
            </div>
            {(minsToStart === null || minsToStart <= 30) ? (
              <button onClick={handleStartSession}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #16A34A, #22C55E)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}>
                ▶ Start session
              </button>
            ) : (
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>Can start from 30 min before</span>
            )}
          </div>
        )}
        {sessionPhase === 'ending' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 14, padding: '12px 16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              {isSessionEnded
                ? (closureIssues.length > 0 ? `This session has ended — ${closureIssues[0].toLowerCase().replace(/\.$/, '')}.` : 'This session has ended and everything is resolved.')
                : 'This session ends soon. Begin closing checks?'}
            </div>
            <button onClick={() => setShowClosure(true)}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F97316, #FB923C)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
              Review and close session
            </button>
          </div>
        )}

        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
              style={{ flex: 1, padding: '11px 10px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: photoUploading ? 'default' : 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)' }}>
              {photoUploading ? 'Uploading…' : '📷 Add Photo'}
            </button>
            <button onClick={() => setShowWalkIn(true)}
              style={{ flex: 1, padding: '11px 10px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)' }}>
              + Walk-in
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
          <button key={s.key} onClick={() => { setRegTab(s.key); setRegExpanded(true) }}
            style={{ background: regTab === s.key && regExpanded ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none', boxShadow: regTab === s.key && regExpanded ? `inset 0 -2px 0 ${s.color}` : 'none', padding: isMobile ? '10px 4px' : '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 2 : 8 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = regTab === s.key && regExpanded ? 'rgba(255,255,255,0.12)' : 'transparent'}>
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

        {ratioBreached && (
          <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#FCA5A5' }}>
            ⚠ Staff-to-child ratio is currently 1:{currentRatio.toFixed(1)}. Required ratio: 1:{requiredRatio}.
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          Register progress: {processedCount} of {regRows.length} processed
        </div>

        <button onClick={() => (registerOpen || activeSession?.closed_at) ? setRegExpanded(x => !x) : null} disabled={!registerOpen && !activeSession?.closed_at}
          style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: (registerOpen || activeSession?.closed_at) ? 'pointer' : 'default', opacity: (registerOpen || activeSession?.closed_at) ? 1 : 0.55 }}>
          <span>📋 Register{activeSession?.closed_at ? ' (read-only)' : ''}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            {!registerOpen && !activeSession?.closed_at
              ? `🔒 Opens ${minsToStart !== null && minsToStart > 30 ? `${minsToStart - 30} min before arrivals` : 'soon'}`
              : regExpanded ? '▲ Hide' : (activeSession?.closed_at ? '🔒 View ▼' : '▼ Open')}
          </span>
        </button>
        {!registerOpen && !activeSession?.closed_at && minsToStart !== null && minsToStart > 30 && (
          <button onClick={async () => {
            const now = new Date().toISOString()
            await supabase.from('sessions').update({ register_opened_at: now }).eq('id', activeSession.id)
            setActiveSession(prev => ({ ...prev, register_opened_at: now }))
            setRegExpanded(true)
          }}
            style={{ marginTop: 8, width: '100%', padding: '9px 14px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.22)', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            Open register early (trips / off-site meeting points)
          </button>
        )}

        <AnimatePresence initial={false}>
          {regExpanded && (
            <motion.div
              key="register-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.32, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.22 } }}
              style={{ overflow: 'hidden' }}
            >
          <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {{ expected: 'Expected', signed_in: 'Signed in', absent: 'Absent', signed_out: 'Signed out' }[regTab]}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{(regGrouped[regTab] || []).length}</span>
            </div>
            <input value={regSearch} onChange={e => setRegSearch(e.target.value)} placeholder="🔍 Search young people..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12.5, marginBottom: 10, outline: 'none' }} />

            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {regSearchFiltered(regGrouped[regTab] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Nobody in this list{regSearch ? ' matching your search' : ''}.</div>
              ) : regSearchFiltered(regGrouped[regTab] || []).map(({ child, att }) => {
                const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`
                const gColor = getBubbleColor(child.group_name)
                return (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: gColor + '30', border: `1.5px solid ${gColor}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {child.first_name} {child.last_name}
                        {child.is_walk_in && child.profile_incomplete && <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, color: '#FCD34D', background: 'rgba(251,191,36,0.15)', borderRadius: 6, padding: '1px 5px' }}>WALK-IN</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                        {configuredGroupLabels.get((child.group_name || '').trim().toLowerCase()) || 'Ungrouped'}
                        {att?.status === 'signed_in' && ` · in at ${hubFmtTime(att.signed_in_at)}`}
                        {att?.status === 'signed_out' && ` · out at ${hubFmtTime(att.signed_out_at)}`}
                        {att?.status === 'absent' && ` · ${att.absence_reason || 'Absent'}`}
                      </div>
                      {(child.allergies || child.medical_notes || child.has_epipen || child.has_asthma) && (
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#FCA5A5', background: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>⚕ Medical</span>
                      )}
                    </div>
                    {activeSession?.closed_at ? (
                      att?.status && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{{ signed_in: 'Signed in', signed_out: 'Signed out', absent: 'Absent' }[att.status] || ''}</span>
                    ) : att?.status === 'signed_in' ? (
                      <button onClick={() => org?.collection_recording_required === false ? handleQuickSignOut(child) : setSignOutChild(child)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>Sign out</button>
                    ) : att?.status === 'signed_out' || att?.status === 'absent' ? null : (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button onClick={() => handleRegSignIn(child)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: '#16A34A', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Sign in</button>
                        <button onClick={() => setAbsentChild(child)} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Absent</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Staff panel */}
            {sessionStaff.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Session team</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sessionStaff.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{staffProfiles[s.user_id] || 'Team member'} <span style={{ color: 'rgba(255,255,255,0.35)' }}>· {s.role}</span></span>
                      {s.signed_in_at ? (
                        <span style={{ color: '#4ADE80', fontWeight: 700 }}>In {hubFmtTime(s.signed_in_at)}</span>
                      ) : (
                        <button onClick={() => handleStaffSignIn(s)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>Sign in</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowNotes(true)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>📝 Notes ({sessionNotes.length})</button>
              {!activeSession?.closed_at && (
                <button onClick={() => setShowClosure(true)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>Close register</button>
              )}
            </div>
          </div>
            </motion.div>
          )}
        </AnimatePresence>

        {regToast && (
          <div style={{ marginTop: 10, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 14px', fontSize: 11.5, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
            {regToast}
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

        {isSessionEnded && activeReflection && (
          <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>📝</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Session Reflection</span>
                {activeReflection.overall_rating ? (
                  <span style={{ fontSize: 11, color: '#FCD34D', letterSpacing: 1 }}>{'★'.repeat(activeReflection.overall_rating)}{'☆'.repeat(Math.max(0, 5 - activeReflection.overall_rating))}</span>
                ) : null}
              </div>
              <button onClick={() => onNavigate('planner', { reflectSessionId: activeSession?.id })}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Edit →
              </button>
            </div>
            {activeReflection.what_went_well && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginBottom: activeReflection.what_could_improve ? 6 : 0 }}>
                <span style={{ color: '#4ADE80', fontWeight: 700 }}>Went well: </span>{activeReflection.what_went_well}
              </div>
            )}
            {activeReflection.what_could_improve && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                <span style={{ color: '#FB923C', fontWeight: 700 }}>Could improve: </span>{activeReflection.what_could_improve}
              </div>
            )}
            {!activeReflection.what_went_well && !activeReflection.what_could_improve && activeReflection.reflection && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{activeReflection.reflection}</div>
            )}
            {activeReflection.safeguarding_flag && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#FCA5A5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>🛡️ Safeguarding note flagged</div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.6)}}`}</style>

      {signOutChild && (
        <HubSignOutSheet child={signOutChild} onClose={() => setSignOutChild(null)} onConfirm={handleConfirmSignOut} identityCheckRequired={!!org?.identity_check_required} />
      )}
      {absentChild && (
        <HubAbsentSheet child={absentChild} onClose={() => setAbsentChild(null)} onMark={handleMarkAbsent} />
      )}
      {showWalkIn && (
        <HubWalkInModal allChildren={childList} onClose={() => setShowWalkIn(false)} onSelectExisting={handleSelectExistingWalkIn} onCreate={handleCreateWalkIn} />
      )}
      {showNotes && (
        <HubNotesPanel notes={sessionNotes} childList={targetedChildren} onClose={() => setShowNotes(false)} onAdd={handleAddRegNote} onRaiseSafeguarding={handleRaiseSafeguardingConcern} />
      )}
      {showClosure && (
        <HubClosureFlow grouped={regGrouped} issues={closureIssues} onClose={() => setShowClosure(false)} onMarkAllAbsent={handleMarkAllRemainingAbsent} onCloseRegister={handleCloseRegister} primary={primary} secondary={secondary} />
      )}
      {showRAPicker && (
        <HubRAPicker
          options={raOptions} search={raPickerSearch} onSearchChange={setRaPickerSearch} busy={raPickerBusy}
          onAttach={attachExistingRA} onCreate={createAndAttachRA} onClose={() => setShowRAPicker(false)}
        />
      )}
      {viewingRA && linkedRA && (
        <HubRAPreviewModal assessmentId={linkedRA.id} onClose={() => setViewingRA(false)} onNavigate={onNavigate} />
      )}
    </div>
  )
}

function HubRAPicker({ options, search, onSearchChange, busy, onAttach, onCreate, onClose }) {
  const filtered = options.filter(o => !search.trim() || o.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, width: '100%', maxWidth: 420, padding: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🛡️ Attach Risk Assessment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>✕</button>
        </div>
        <button onClick={onCreate} disabled={busy} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Working…' : '+ Create new for this session'}
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Or attach existing</div>
        <input autoFocus value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search risk assessments…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, outline: 'none', marginBottom: 10 }} />
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 14, color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>No assessments found.</div>
          ) : filtered.map(a => (
            <button key={a.id} onClick={() => onAttach(a)} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: busy ? 'default' : 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 13 }}>🛡️</span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              {a.risk_rating && (
                <span style={{
                  fontSize: 9.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', borderRadius: 99, padding: '2px 8px',
                  background: RA_RATING_COLORS[a.risk_rating]?.bg || 'rgba(148,163,184,0.16)',
                  color: RA_RATING_COLORS[a.risk_rating]?.color || '#CBD5E1',
                }}>{a.risk_rating}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function HubRAPreviewModal({ assessmentId, onClose, onNavigate }) {
  const [ra, setRa] = useState(null)
  const [hazards, setHazards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('risk_assessments').select('*').eq('id', assessmentId).single(),
      supabase.from('risk_assessment_hazards').select('*').eq('assessment_id', assessmentId).order('sort_order'),
    ]).then(([{ data: raData }, { data: hazardData }]) => {
      if (cancelled) return
      setRa(raData || null)
      setHazards(hazardData || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [assessmentId])

  const emergencyFields = ra ? [
    ['Meeting point', ra.meeting_point],
    ['Nearest hospital', ra.nearest_hospital],
    ['Defibrillator location', ra.defibrillator_location],
    ['Emergency contacts', ra.emergency_contacts],
  ].filter(([, v]) => v) : []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, width: '100%', maxWidth: 540, maxHeight: '86vh', overflowY: 'auto', padding: 22, boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Loading…</div>
        ) : !ra ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Couldn't load this risk assessment.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4 }}>🛡️ {ra.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{ra.activity_type || 'Session'}{ra.location ? ` · ${ra.location}` : ''}</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
              <span style={{
                fontSize: 10.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', borderRadius: 99, padding: '3px 10px',
                background: RA_RATING_COLORS[ra.risk_rating]?.bg || 'rgba(148,163,184,0.16)',
                color: RA_RATING_COLORS[ra.risk_rating]?.color || '#CBD5E1',
              }}>{ra.risk_rating || 'Unrated'}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', borderRadius: 99, padding: '3px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>{ra.status || 'draft'}</span>
            </div>

            {ra.summary && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginBottom: 16 }}>{ra.summary}</div>}

            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Hazards ({hazards.length})
            </div>
            {hazards.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>No hazards logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {hazards.map(h => (
                  <div key={h.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: h.control_measures ? 4 : 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{h.hazard}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>L{h.likelihood}×S{h.severity} = {(h.likelihood || 0) * (h.severity || 0)}</span>
                    </div>
                    {h.control_measures && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{h.control_measures}</div>}
                  </div>
                ))}
              </div>
            )}

            {emergencyFields.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Emergency plan</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {emergencyFields.map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{k}: </span>{v}
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => { onClose(); onNavigate && onNavigate('risk_assessments', { openAssessmentId: assessmentId }) }}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Open full assessment to edit →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function HubSignOutSheet({ child, onClose, onConfirm, identityCheckRequired }) {
  const [collectionType, setCollectionType] = useState('')
  const [collectedByName, setCollectedByName] = useState('')
  const [note, setNote] = useState('')
  const [identityChecked, setIdentityChecked] = useState(false)
  const contacts = child.collection_contacts || []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Who is {child.first_name} leaving with?</div>
        {contacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {contacts.map((c, i) => (
              <button key={i} onClick={() => { setCollectionType('approved_adult'); setCollectedByName(`${c.name}${c.relationship ? ' · ' + c.relationship : ''}`) }}
                style={{ padding: '8px 14px', borderRadius: 10, border: collectedByName.startsWith(c.name) ? '2px solid #7C3AED' : '1.5px solid rgba(255,255,255,0.14)', background: collectedByName.startsWith(c.name) ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {c.name}{c.relationship ? ` · ${c.relationship}` : ''}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {COLLECTION_TYPES_HUB.map(t => (
            <button key={t.key} onClick={() => setCollectionType(t.key)} style={{ padding: '8px 14px', borderRadius: 10, border: collectionType === t.key ? '2px solid #7C3AED' : '1.5px solid rgba(255,255,255,0.14)', background: collectionType === t.key ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
        {collectionType && collectionType !== 'independent' && (
          <input value={collectedByName} onChange={e => setCollectedByName(e.target.value)} placeholder="Name of person collecting" style={hubInp} />
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Collection note (optional)" style={{ ...hubInp, minHeight: 44, marginTop: 10 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 18px', fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
          <input type="checkbox" checked={identityChecked} onChange={e => setIdentityChecked(e.target.checked)} /> Identity checked{identityCheckRequired && ' *'}
        </label>
        <button onClick={() => onConfirm({ collection_type: collectionType || 'other', collected_by_name: collectedByName, collection_note: note, identity_checked: identityChecked })}
          disabled={!collectionType || (identityCheckRequired && !identityChecked)} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: (!collectionType || (identityCheckRequired && !identityChecked)) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!collectionType || (identityCheckRequired && !identityChecked)) ? 'not-allowed' : 'pointer' }}>
          Confirm Sign Out
        </button>
      </div>
    </div>
  )
}

function HubAbsentSheet({ child, onClose, onMark }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 20, width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Mark {child.first_name} as...</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ABSENCE_REASONS_HUB.map(r => (
            <button key={r} onClick={() => onMark(r)} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function HubWalkInModal({ allChildren, onClose, onSelectExisting, onCreate }) {
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', emergency_contact_name: '', emergency_contact_phone: '', consent: false })
  const [saving, setSaving] = useState(false)
  const matches = search.trim() ? allChildren.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())) : []

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.consent) return
    setSaving(true)
    await onCreate(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 20, width: 400, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Add Walk-in</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>Search existing young people first — don't create a duplicate record.</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ ...hubInp, marginBottom: 10 }} />
        {matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {matches.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => onSelectExisting(c)} style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', textAlign: 'left', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{c.first_name} {c.last_name}</button>
            ))}
          </div>
        )}
        {search.trim() && matches.length === 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>No existing match — create a temporary walk-in record below.</div>
        )}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Create temporary walk-in</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="First name *" style={{ ...hubInp, flex: 1 }} />
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" style={{ ...hubInp, flex: 1 }} />
          </div>
          <input value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Emergency contact name" style={{ ...hubInp, marginBottom: 8 }} />
          <input value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="Emergency contact phone" style={{ ...hubInp, marginBottom: 8 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
            <input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} /> Consent confirmed for today's session
          </label>
          <button onClick={handleCreate} disabled={!form.first_name.trim() || !form.consent || saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: (!form.first_name.trim() || !form.consent) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Adding...' : 'Create & Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HubNotesPanel({ notes, childList, onClose, onAdd, onRaiseSafeguarding }) {
  const [noteType, setNoteType] = useState('general')
  const [content, setContent] = useState('')
  const [childId, setChildId] = useState('')

  const handleAdd = () => {
    if (noteType === 'incident' && window.confirm('Incidents involving safeguarding should go through the Safeguarding workflow instead. Raise a safeguarding concern instead?')) {
      const child = childList.find(c => c.id === childId)
      onRaiseSafeguarding(child, content)
      setContent('')
      return
    }
    onAdd(noteType, content, childId || null)
    setContent('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 380, maxWidth: '100%', height: '100%', background: '#0F172A', borderLeft: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Session Notes</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#fff', cursor: 'pointer' }}>×</button>
        </div>
        <select value={noteType} onChange={e => setNoteType(e.target.value)} style={{ ...hubInp, marginBottom: 8 }}>
          {NOTE_TYPES_HUB.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
        <select value={childId} onChange={e => setChildId(e.target.value)} style={{ ...hubInp, marginBottom: 8 }}>
          <option value="">Not about a specific child</option>
          {childList.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Note..." style={{ ...hubInp, minHeight: 60, marginBottom: 10 }} />
        <button onClick={handleAdd} disabled={!content.trim()} style={{ width: '100%', padding: 11, borderRadius: 9, border: 'none', background: !content.trim() ? 'rgba(255,255,255,0.1)' : '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>Add Note</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(n => {
            const nt = NOTE_TYPES_HUB.find(t => t.key === n.note_type)
            return (
              <div key={n.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>{nt?.icon} {nt?.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)' }}>{n.content}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10.5, marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-GB')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EndSessionConfirmModal({ sess, attendance, primary, secondary, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)
  const sessAttendance = (attendance || []).filter(a => a.session_id === sess.id)
  const stillSignedIn = sessAttendance.filter(a => a.status === 'signed_in').length
  const unresolved = sessAttendance.filter(a => a.status !== 'signed_in' && a.status !== 'absent' && a.status !== 'signed_out').length

  const handleConfirm = async () => {
    setSaving(true)
    await onConfirm()
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: 400, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Close {sess.title}?</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14 }}>This locks the register into a read-only historical record. Corrections can still be made with an audit trail, or the register can be reopened later.</div>

        {stillSignedIn > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>
            ⚠ {stillSignedIn} young {stillSignedIn === 1 ? 'person is' : 'people are'} still marked on site.
          </div>
        )}
        {unresolved > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 12.5, color: '#92400E' }}>
            {unresolved} expected {unresolved === 1 ? 'attendee has' : 'attendees have'} no attendance status.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Closing...' : 'Close and lock register'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HubClosureFlow({ grouped, onClose, onMarkAllAbsent, onCloseRegister, primary, secondary, issues = [] }) {
  const stillSignedIn = grouped.signed_in.length
  const unaccounted = grouped.expected.length
  const [overrideOnSite, setOverrideOnSite] = useState(false)
  const blocked = stillSignedIn > 0 && !overrideOnSite

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 22, width: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Review and close session</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>Once closed, attendance is locked and the register becomes read-only. Later corrections need a reason and are audited.</div>

        {issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {issues.map((iss, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, fontWeight: 600, color: '#FCD34D' }}>
                <span>⚠</span><span>{iss}</span>
              </div>
            ))}
          </div>
        )}
        {issues.length === 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: '#4ADE80', marginBottom: 14 }}>
            ✓ Everything is resolved — safe to close.
          </div>
        )}

        {stillSignedIn > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>
            ⚠ {stillSignedIn} young {stillSignedIn === 1 ? 'person is' : 'people are'} still marked on site. Sign them out before closing.
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
              <input type="checkbox" checked={overrideOnSite} onChange={e => setOverrideOnSite(e.target.checked)} />
              Override — I confirm responsibility for these young people has safely ended
            </label>
          </div>
        )}
        {unaccounted > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#FCD34D' }}>
            {unaccounted} young {unaccounted === 1 ? 'person has' : 'people have'} no attendance status.
          </div>
        )}

        {unaccounted > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <button onClick={onMarkAllAbsent} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>Mark all remaining absent</button>
            <button onClick={onClose} style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>Review individually</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Leave Open</button>
          <button onClick={onCloseRegister} disabled={blocked}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: blocked ? 'rgba(148,163,184,0.35)' : `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: blocked ? 'default' : 'pointer' }}>
            {blocked ? 'Resolve on-site first' : 'Close and Lock Register'}
          </button>
        </div>
      </div>
    </div>
  )
}

const hubInp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

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
  const [showConcernForm, setShowConcernForm] = React.useState(false)
  const [showInviteChild, setShowInviteChild] = React.useState(false)
  const [showReflectionsModal, setShowReflectionsModal] = React.useState(false)
  const [statsView, setStatsView] = React.useState('today') // 'today' | 'month' — merged stats toggle
  const [sessionsView, setSessionsView] = React.useState('upcoming') // 'upcoming' | 'ended' — merged sessions toggle

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
  const [volunteersCount, setVolunteersCount] = useState(0);
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
  const [checkedOutCount, setCheckedOutCount] = useState(0);
  const [medicalReviews, setMedicalReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [openLiveSessionId, setOpenLiveSessionId] = useState(null);

  // ── Soft push-notification prompt (never auto-triggers the real browser
  // permission popup — only shown once per device until dismissed or acted on) ──
  const pushDismissKey = 'ls_push_prompt_dismissed'
  const [showPushPrompt, setShowPushPrompt] = useState(() => {
    try {
      return isPushSupported() && getNotificationPermission() === 'default' && localStorage.getItem(pushDismissKey) !== 'true'
    } catch (e) { return false }
  })
  const [pushEnabling, setPushEnabling] = useState(false)
  const dismissPushPrompt = () => {
    try { localStorage.setItem(pushDismissKey, 'true') } catch (e) {}
    setShowPushPrompt(false)
  }
  const handleEnablePush = async () => {
    setPushEnabling(true)
    await subscribeToPush(org?.id, session?.user?.id)
    setPushEnabling(false)
    dismissPushPrompt()
  }

  // Local calendar date (NOT toISOString, which converts to UTC and can roll
  // the date back during the early hours of BST — e.g. 00:19 local on 8 Jul
  // becomes 23:19 UTC on 7 Jul, silently hiding today's live sessions).
  const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = toLocalDateStr(new Date());

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
      { data: volunteerData },
      { data: checkoutData },
      { data: medicalReviewData },
    ] = await Promise.all([
      supabase.from("sessions").select("*").eq("org_id", orgId).order("session_date", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("attendance").select("*").eq("org_id", orgId),
      supabase.from("cause_for_concern").select("*").eq("org_id", orgId).eq("status", "open"),
      supabase.from("children").select("*").eq("org_id", orgId).eq("active", true).order("first_name", { ascending: true }),
      supabase.from("session_reflections").select("*").eq("org_id", orgId),
      supabase.from("volunteers").select("id").eq("org_id", orgId),
      supabase.from("resource_checkouts").select("id").eq("org_id", orgId).in("status", ["checked_out", "overdue"]),
      supabase.from("medical_alert_reviews").select("*").eq("org_id", orgId),
    ]);
    setSessions(sessionData || []);
    setAttendance(attendanceData || []);
    setConcerns(concernData || []);
    setChildren(childData || []);
    setReflections(reflectionData || []);
    setVolunteersCount(volunteerData?.length || 0);
    setCheckedOutCount(checkoutData?.length || 0);
    setMedicalReviews(medicalReviewData || []);
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
  useRealtimeTable("cause_for_concern", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 3000 });
  useRealtimeTable("children", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 3000 });
  useRealtimeTable("medical_alert_reviews", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 5000 });
  useRealtimeTable("organisations", loadHub, { filter: orgId ? `id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 5000 });
  useRealtimeTable("session_reflections", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 5000 });
  useRealtimeTable("volunteers", loadHub, { filter: orgId ? `org_id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 5000 });

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
    const yesterdayStr = toLocalDateStr(yesterday)
    return sessions.filter(s => {
      if (!s.session_date) return false
      // Today's sessions — stay visible all day, even after they've ended, until midnight
      if (s.session_date === today) return true
      // Include yesterday's sessions only if genuinely still ongoing right now
      // (e.g. an overnight residential that hasn't reached its end time yet) —
      // NOT just "ended less than 24h ago", which would keep any finished
      // session pinned as the hero card for most of the next day.
      if (s.session_date === yesterdayStr && s.end_time) {
        const endDateTime = new Date(`${s.session_date}T${s.end_time}`)
        return endDateTime > now
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
    const sevenDaysStr = toLocalDateStr(sevenDaysOut)

    return sessions
      .filter(s => {
        if (!s.session_date) return false
        if (s.closed_at) return false // closed sessions live in the Ended sessions area instead
        if (s.session_date === today) {
          // Keep today's sessions visible all day, even after they've ended —
          // the hero badge below distinguishes Live Now / Not Started / Ended.
          return true
        }
        return s.session_date > today && s.session_date <= sevenDaysStr
      })
      .sort((a, b) => (a.session_date + (a.start_time || '')).localeCompare(b.session_date + (b.start_time || '')))
      .slice(0, 6)
  }, [sessions, today]);
  const endedSessions = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = toLocalDateStr(sevenDaysAgo)
    return sessions
      .filter(s => s.closed_at && s.session_date >= sevenDaysAgoStr)
      .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))
      .slice(0, 8)
  }, [sessions]);
  const completedWithoutReflection = useMemo(() => {
    const now = new Date();
    return sessions.filter(s => {
      const end = new Date(`${s.session_date}T${s.end_time || "23:59"}`);
      return end < now && !reflections.some(r => r.session_id === s.id);
    }).sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
  }, [sessions, reflections]);

  const todaySessionIds = useMemo(() => new Set(todaySessions.map(s => s.id)), [todaySessions]);
  const todayAttendance = useMemo(() => attendance.filter(a => todaySessionIds.has(a.session_id)), [attendance, todaySessionIds]);
  const signedIn = todayAttendance.filter(a => a.status === "signed_in").length;
  const medicalReviewByChild = useMemo(() => {
    const map = {}
    medicalReviews.forEach(r => {
      const existing = map[r.child_id]
      if (!existing || new Date(r.reviewed_at) > new Date(existing.reviewed_at)) map[r.child_id] = r
    })
    return map
  }, [medicalReviews]);
  const MEDICAL_REVIEW_INTERVAL_DAYS = 180; // re-confirm medical info roughly every 6 months
  const medicalAlertsNeedingReview = useMemo(() => {
    const cutoff = Date.now() - MEDICAL_REVIEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000
    return children.filter(c => {
      const flagged = c.allergies || c.medical_notes || c.has_medication || c.has_asthma || c.has_epipen || c.has_diabetes
      if (!flagged) return false
      const review = medicalReviewByChild[c.id]
      if (!review) return true
      return new Date(review.reviewed_at).getTime() < cutoff
    }).length
  }, [children, medicalReviewByChild]);
  const attendanceRate = children.length > 0 ? Math.round((signedIn / children.length) * 100) : 0;
  const strictlyTodaySessions = useMemo(() => todaySessions.filter(s => s.session_date === today), [todaySessions, today]);
  const sessionsEndedToday = useMemo(() => {
    const now = new Date()
    return strictlyTodaySessions.filter(s => {
      const end = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
      return !!end && end < now
    }).length
  }, [strictlyTodaySessions]);
  const todayHasLiveSession = useMemo(() => {
    const now = new Date()
    return todaySessions.some(s => {
      const startDateTime = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
      const endDateTime = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
      const hasEnded = !!endDateTime && endDateTime < now
      return (!startDateTime || startDateTime <= now) && !hasEnded
    })
  }, [todaySessions]);
  const nextSession = upcomingSessions[0];
  const nextSessionStatus = useMemo(() => {
    if (!nextSession) return null
    const isToday = nextSession.session_date === today
    const now = new Date()
    const startDateTime = nextSession.start_time ? new Date(`${nextSession.session_date}T${nextSession.start_time}`) : null
    const endDateTime = nextSession.end_time ? new Date(`${nextSession.session_date}T${nextSession.end_time}`) : null
    const hasEnded = isToday && !!endDateTime && endDateTime < now
    const isLiveNow = isToday && (!startDateTime || startDateTime <= now) && !hasEnded
    if (isLiveNow) return 'live'
    if (hasEnded) return 'ended'
    return 'upcoming'
  }, [nextSession, today]);
  const liveHeroSession = todaySessions[0];
  const trialDaysLeft = (org?.status === 'trial' && org?.created_at)
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(org.created_at).getTime()) / 86400000))
    : null;

  const getLiveSessionStats = (item) => {
    const records = attendance.filter(a => a.session_id === item.id);
    const si = records.filter(a => a.status === "signed_in").length;
    const absent = records.filter(a => a.status === "absent").length;
    const so = records.filter(a => a.status === "signed_out").length;
    const expected = records.filter(a => a.status === "expected").length;
    const total = records.length;
    return { signedIn: si, absent, signedOut: so, expected, percent: total > 0 ? Math.round((si / total) * 100) : 0 };
  };

  // Staff/volunteer names per session, for the compact live-session launcher cards' avatar stack
  const [sessionStaffList, setSessionStaffList] = useState({});
  const todaySessionIdsKey = useMemo(() => todaySessions.map(s => s.id).sort().join(','), [todaySessions]);
  const loadSessionStaff = useCallback(async (ids) => {
    if (!ids || ids.length === 0) { setSessionStaffList({}); return; }
    const { data } = await supabase.from('session_staff').select('session_id, user_id, volunteer_id').in('session_id', ids);
    const rows = data || [];
    const personIds = Array.from(new Set(rows.map(r => r.user_id || r.volunteer_id).filter(Boolean)));
    let names = {};
    if (personIds.length > 0) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', personIds);
      (profiles || []).forEach(p => { names[p.id] = p.full_name; });
    }
    const list = {};
    rows.forEach(row => {
      const pid = row.user_id || row.volunteer_id;
      if (!pid) return;
      if (!list[row.session_id]) list[row.session_id] = [];
      list[row.session_id].push({ id: pid, name: names[pid] || 'Staff', type: row.volunteer_id ? 'volunteer' : 'staff' });
    });
    setSessionStaffList(list);
  }, []);
  useEffect(() => {
    loadSessionStaff(todaySessionIdsKey ? todaySessionIdsKey.split(',') : []);
  }, [todaySessionIdsKey, loadSessionStaff]);

  const [addVolunteersSessionId, setAddVolunteersSessionId] = useState(null);

  const [liveRegisterSessionId, setLiveRegisterSessionId] = useState(null)
  const openRegisterForSession = (sessionId) => {
    setLiveRegisterSessionId(sessionId)
  };

  const [closingSession, setClosingSession] = useState(null)
  const handleCloseSessionFromCard = async (sess) => {
    const now = new Date().toISOString()
    await supabase.from('sessions').update({ closed_at: now, closed_by: session?.user?.id, register_status: 'closed' }).eq('id', sess.id)
    setSessions(prev => prev.map(x => x.id === sess.id ? { ...x, closed_at: now, closed_by: session?.user?.id, register_status: 'closed' } : x))
    setClosingSession(null)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: isMobile ? '12px 0 10px' : '18px 0 14px', borderBottom: `1px solid ${primary}18`, position: 'relative' }}>

          {/* Org identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, padding: '4px 0' }}>
            <div style={{ position: 'relative' }}>
              <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={orgName} style={{ width: 48, height: 48, borderRadius: 13, objectFit: 'contain', border: `1.5px solid ${primary}30`, background: '#fff', padding: 3, boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 20px -6px ${primary}45` }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
            </div>
            {!isMobile ? (
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
            ) : (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text, #111)', lineHeight: 1.25, fontFamily: 'var(--font-display, sans-serif)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{orgName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 10.5, fontWeight: 700, color: todayHasLiveSession ? '#DC2626' : '#16A34A' }}>
                  <span style={{ fontSize: 7 }}>●</span>
                  {org?.status === 'trial' && trialDaysLeft !== null
                    ? <span style={{ color: trialDaysLeft <= 2 ? '#DC2626' : 'var(--text3, #6b7280)' }}>Trial · {trialDaysLeft}d left</span>
                    : (todayHasLiveSession ? 'Live now' : 'Online')}
                </div>
              </div>
            )}
          </div>

          {/* Search — centred in header */}
          {!isMobile && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
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
              onGoReflections={() => setShowReflectionsModal(true)}
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
        {!isMobile ? (
          <div style={{ padding: '14px 0 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text, #0f172a)', lineHeight: 1.15, fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '-0.3px' }}>
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
              {children.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{children.length} young people</span>
              )}
            </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowInviteChild(true)}
                style={{ padding: '12px 22px', borderRadius: 99, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7, boxShadow: `0 6px 16px -8px ${primary}80` }}>
                🧒 Invite Child
              </button>
              {hasModule('volunteers') && (
                <button onClick={() => go('volunteers', { autoOpenInvite: true })}
                  style={{ padding: '12px 22px', borderRadius: 99, border: 'none', background: `linear-gradient(135deg, ${secondary}, ${primary})`, color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7, boxShadow: `0 6px 16px -8px ${secondary}80` }}>
                  🤝 Invite Volunteer
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 0 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text, #0f172a)', lineHeight: 1.2, fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '-0.3px' }}>
                {getGreeting()}, {hubUserName.split(' ')[0]} 👋
              </h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0, color: concerns.length > 0 ? '#92400E' : '#16A34A', background: concerns.length > 0 ? '#FEF9C3' : '#DCFCE7', borderRadius: 99, padding: '3px 9px' }}>
                {concerns.length > 0 ? `⚠ ${concerns.length}` : '✓ Clear'}
              </span>
            </div>

            {/* Quick actions row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2, WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%)' }}>
              <HeaderQuickAction icon="＋" label="Session" onClick={() => go('planner', { autoOpenWizard: true })} primary={primary} filled />
              {hasModule('registers') && <HeaderQuickAction icon="📋" label="Register" onClick={() => go('registers')} primary={primary} />}
              <HeaderQuickAction icon="💬" label="Messages" onClick={() => go('messaging')} primary={primary} />
              {hasModule('volunteers') && <HeaderQuickAction icon="👥" label="Volunteers" onClick={() => go('volunteers')} primary={primary} />}
              <HeaderQuickAction icon="🧒" label="Invite Child" onClick={() => setShowInviteChild(true)} primary={primary} gradientTo={secondary} filled />
              {hasModule('volunteers') && <HeaderQuickAction icon="🤝" label="Invite Volunteer" onClick={() => go('volunteers', { autoOpenInvite: true })} primary={secondary} gradientTo={primary} filled />}
            </div>
          </div>
        )}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {showPushPrompt && (
        <div style={{ padding: `${pad}px ${pad}px 0` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: `linear-gradient(135deg, ${primary}12, ${secondary}0A)`, border: `1.5px solid ${primary}30`,
            borderRadius: 18, padding: '14px 18px',
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🔔</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text, #111)' }}>Enable notifications</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>Stay updated when something important needs your attention — sessions, registers, messages and urgent alerts.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={dismissPushPrompt} style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Not now</button>
              <button onClick={handleEnablePush} disabled={pushEnabling} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {pushEnabling ? 'Enabling…' : 'Enable notifications'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── LIVE SESSION HERO ── */}
      <div style={{ padding: `${pad}px ${pad}px 0` }}>
      {liveHeroSession ? (
        (() => {
          const getSessionMeta = (s) => {
            const now = new Date()
            const startDT = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
            const endDT = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
            // A session is "ended" if it's actually been closed (register closed_at set),
            // not just because the scheduled end time has passed — a manually-closed
            // session should show as Ended everywhere, even if it's still within its
            // scheduled window. This keeps Home in sync with the session detail panel,
            // which already treats closed_at as the source of truth.
            const hasEnded = !!s.closed_at || (!!endDT && endDT < now)
            const isLiveNow = !hasEnded && (!startDT || startDT <= now)
            return { startDT, endDT, hasEnded, isLiveNow }
          }

          const todayList = todaySessions.slice(0, 20)
          const liveGroup = todayList.filter(s => getSessionMeta(s).isLiveNow)
          const currentGroup = todayList.filter(s => { const m = getSessionMeta(s); return !m.isLiveNow && !m.hasEnded })
          const endedGroup = todayList.filter(s => getSessionMeta(s).hasEnded)

          const renderCard = (s) => {
            const { startDT, endDT, hasEnded, isLiveNow } = getSessionMeta(s)
            const statusLabel = hasEnded ? 'Closed' : isLiveNow ? 'Live now' : 'Upcoming'
            const statusColour = hasEnded ? '#94A3B8' : isLiveNow ? '#DC2626' : '#FBBF24'
            const cardStatus = hasEnded ? 'ended' : isLiveNow ? 'live' : 'upcoming'
            const countdownTarget = cardStatus === 'live' ? endDT : cardStatus === 'upcoming' ? startDT : null
            // Fixed reference window each ring fraction is measured against, so it
            // reflects real elapsed progress rather than resetting to "full" on
            // every mount: session length while live, time from creation to start
            // while upcoming.
            const createdDT = s.created_at ? new Date(s.created_at) : null
            const timeRingTotalSeconds = cardStatus === 'live' && startDT && endDT
              ? Math.max(1, Math.floor((endDT.getTime() - startDT.getTime()) / 1000))
              : cardStatus === 'upcoming' && startDT && createdDT
              ? Math.max(1, Math.floor((startDT.getTime() - createdDT.getTime()) / 1000))
              : null
            const ctaLabel = cardStatus === 'live' ? 'Open register' : cardStatus === 'upcoming' ? 'View session' : 'View summary'

            const panel = (
              <LiveSessionPanel
                key={s.id}
                sessions={[s]}
                childList={children}
                attendance={attendance}
                primary={primary}
                secondary={secondary}
                orgId={org?.id}
                org={org}
                authUserId={session?.user?.id}
                reflections={reflections}
                onOpenRegister={openRegisterForSession}
                onNavigate={go}
                getLiveSessionStats={getLiveSessionStats}
              />
            )

            const stats = getLiveSessionStats(s)
            const attendeeTotal = stats.signedIn + stats.absent + stats.signedOut + stats.expected
            const attendedCount = stats.signedIn + stats.signedOut
            const staffList = sessionStaffList[s.id] || []
            const staffOnly = staffList.filter(p => p.type !== 'volunteer')
            const volunteerList = staffList.filter(p => p.type === 'volunteer')
            const visibleStaff = staffOnly.slice(0, 2)
            const extraStaff = staffOnly.length - visibleStaff.length

            return (
              <React.Fragment key={s.id}>
                <style>{`
                  @keyframes lsPing1{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.6);opacity:0}}
                  @keyframes lsPing2{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.6);opacity:0}}
                  @keyframes lsBrandFade{0%,100%{opacity:0}50%{opacity:1}}
                  @keyframes lsOrbDrift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(-10px,8px) scale(1.08)}100%{transform:translate(0,0) scale(1)}}
                  @keyframes lsArrowNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
                  .ls-livecard:hover .ls-card-arrow{animation:lsArrowNudge .7s ease-in-out infinite}
                  .ls-livecard:focus-visible{outline:2px solid rgba(255,255,255,0.4);outline-offset:2px}
                `}</style>
                <motion.div
                  onClick={() => setOpenLiveSessionId(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenLiveSessionId(s.id) } }}
                  className="ls-livecard"
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.45, ease: [0.22, 0.9, 0.3, 1] }}
                  style={{
                    textAlign: 'left', width: '100%', boxSizing: 'border-box', cursor: 'pointer', border: 'none',
                    borderRadius: 20, padding: 0, position: 'relative', overflow: 'hidden',
                    background: `linear-gradient(160deg, #0C1226 0%, #141D3B 60%, #0F1729 100%)`,
                    boxShadow: `0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 34px -14px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)`,
                  }}>
                  <div style={{ height: 3, width: '100%', position: 'relative', overflow: 'hidden', background: primary }}>
                    <div style={{ position: 'absolute', inset: 0, background: secondary, opacity: 0, animation: 'lsBrandFade 6s ease-in-out infinite' }} />
                  </div>
                  <div style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${secondary}26 0%, transparent 70%)`, pointerEvents: 'none', animation: 'lsOrbDrift 7s ease-in-out infinite' }} />

                  <div style={{ padding: '16px 18px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '3px 9px 3px 7px', marginBottom: 10,
                          background: cardStatus === 'live' ? 'rgba(220,38,38,0.14)' : cardStatus === 'upcoming' ? 'rgba(251,191,36,0.14)' : 'rgba(148,163,184,0.14)',
                          border: `1px solid ${cardStatus === 'live' ? 'rgba(220,38,38,0.35)' : cardStatus === 'upcoming' ? 'rgba(251,191,36,0.35)' : 'rgba(148,163,184,0.3)'}`,
                        }}>
                          <div style={{ position: 'relative', width: 7, height: 7 }}>
                            {cardStatus === 'live' && (
                              <>
                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#F87171', animation: 'lsPing1 1.8s ease-out infinite' }} />
                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#F87171', animation: 'lsPing2 1.8s ease-out infinite 0.9s' }} />
                              </>
                            )}
                            <span style={{ position: 'relative', zIndex: 2, width: 7, height: 7, borderRadius: '50%', display: 'block', background: statusColour, animation: cardStatus === 'live' ? 'pulse-live 1.5s infinite' : 'none' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase', color: cardStatus === 'live' ? '#FCA5A5' : cardStatus === 'upcoming' ? '#FDE68A' : '#CBD5E1' }}>{statusLabel}</span>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.25, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                        {(s.start_time || s.location) && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px' }}>
                            {s.start_time && (
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>⏰</span> {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
                              </span>
                            )}
                            {s.location && (
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                <span>📍</span> {s.location.split(',')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <AttendanceRing signedIn={attendedCount} total={attendeeTotal} primary={primary} secondary={secondary} />
                        <TimeRing status={cardStatus} target={countdownTarget} totalSeconds={timeRingTotalSeconds} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{attendedCount}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cardStatus === 'ended' ? 'Attended' : 'Signed in'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{cardStatus === 'upcoming' ? attendeeTotal : stats.absent}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cardStatus === 'upcoming' ? 'Expected' : 'Absent'}</span>
                      </div>
                      <div style={{ flex: 1 }} />
                      {visibleStaff.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {visibleStaff.map((p, i) => (
                            <div key={p.id} style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, ${secondary})`, border: '2px solid #131B33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', marginLeft: i === 0 ? 0 : -7 }}>
                              {getInitials(p.name)}
                            </div>
                          ))}
                          {extraStaff > 0 && (
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '2px solid #131B33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', marginLeft: -7 }}>+{extraStaff}</div>
                          )}
                        </div>
                      )}
                      {volunteerList.length > 0 ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddVolunteersSessionId(s.id) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: '#FDA4AF',
                            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.28)', borderRadius: 99, padding: '5px 10px', cursor: 'pointer',
                          }}>
                          ❤️ {volunteerList.length} volunteer{volunteerList.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddVolunteersSessionId(s.id) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.65)',
                            background: 'transparent', border: '1px dashed rgba(255,255,255,0.24)', borderRadius: 99, padding: '5px 10px', cursor: 'pointer',
                          }}>
                          + Add volunteers
                        </button>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 99, padding: '6px 12px 6px 13px' }}>
                        {ctaLabel} <span className="ls-card-arrow" style={{ display: 'inline-block' }}>→</span>
                      </span>
                    </div>
                  </div>
                </motion.div>

                {openLiveSessionId === s.id && createPortal(
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
                    background: isMobile ? '#0B1023' : 'rgba(8,11,23,0.7)',
                    alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
                    padding: isMobile ? 0 : 24, boxSizing: 'border-box',
                  }} onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) setOpenLiveSessionId(null) }}>
                    <div style={{
                      position: 'relative',
                      width: '100%', maxWidth: isMobile ? 'none' : 720, maxHeight: isMobile ? 'none' : '90vh',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      borderRadius: isMobile ? 0 : 26,
                      flex: isMobile ? 1 : undefined,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '14px 14px 0', background: '#0B1023' }}>
                        <button onClick={() => setOpenLiveSessionId(null)} aria-label="Close" style={{
                          width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 14px 24px' : '10px 20px 24px', background: '#0B1023' }}>
                        {panel}
                      </div>
                      <ModalEdgeFade />
                    </div>
                  </div>,
                  document.body
                )}

                {addVolunteersSessionId === s.id && (
                  <AddVolunteersToSessionModal
                    session={s}
                    orgId={org?.id}
                    primary={primary}
                    secondary={secondary}
                    alreadyAssignedIds={(sessionStaffList[s.id] || []).filter(p => p.type === 'volunteer').map(p => p.id)}
                    isMobile={isMobile}
                    onClose={() => setAddVolunteersSessionId(null)}
                    onDone={() => {
                      setAddVolunteersSessionId(null)
                      loadSessionStaff(todaySessionIdsKey ? todaySessionIdsKey.split(',') : [])
                    }}
                  />
                )}
              </React.Fragment>
            )
          }

          const allToday = [...liveGroup, ...currentGroup, ...endedGroup]
          const cardBasis = allToday.length === 1 ? '100%' : allToday.length === 2 ? 'calc(50% - 8px)' : '340px'

          return (
            <div className="ls-hub-today-sessions" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '0 0 8px' }}>
              {allToday.map(s => (
                <div key={s.id} className="ls-hub-today-session-item" style={{ flex: `1 1 ${cardBasis}`, minWidth: allToday.length >= 3 ? 300 : 280, boxSizing: 'border-box' }}>
                  {renderCard(s)}
                </div>
              ))}
            </div>
          )
        })()
      ) : (
        <section style={{ ...styles.encouragement, background: `linear-gradient(135deg, ${primary}, ${secondary})`, boxShadow: `0 16px 34px ${primary}40` }}>
          <div style={styles.trophy}>🏆</div>
          <div>
            <h2 style={styles.encouragementTitle}>Keep making an impact, {orgName}! ⭐</h2>
            <p style={styles.encouragementText}>Supporting {children.length} young people across {sessions.length} planned sessions.</p>
          </div>
          <div style={styles.confetti}>✨</div>
        </section>
      )}
      </div>

      <section className="ls-hub-outer-grid" style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 18, padding: pad }}>
        <div style={{ minWidth: 0, boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* TODAY AT A GLANCE */}
          <Panel title="📍 Right now">
            {/* CSS Grid instead of flex+fixed-px basis: grid columns are a hard
               limit the browser can't push past, unlike flex-basis which is
               just a hint — this is what lets cards blow past the viewport
               edge on phones since 220px/190px minimums don't fit 3-up on a
               ~360-400px-wide panel. */}
            <div className="ls-hub-rightnow-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? 10 : 12 }}>

              {/* WEATHER CARD */}
              <div style={{ minWidth: 0 }}>
                <div style={{ background: weather ? `linear-gradient(135deg, #0EA5E9, #38BDF8)` : 'linear-gradient(135deg, #94A3B8, #CBD5E1)', borderRadius: 16, padding: isMobile ? '14px 14px' : '16px 18px', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 128, height: '100%', boxShadow: '0 10px 28px -10px rgba(14,165,233,0.5)', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
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
              </div>

              <div style={{ minWidth: 0 }}>
                {todaySessions.length > 0 ? (
                  <StatCard icon="🗓️" title={`${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today`} text={todayHasLiveSession ? "In progress" : "Ready for delivery"} button={todayHasLiveSession ? "Open Register" : "Open Planner"} onClick={() => go(todayHasLiveSession ? "registers" : "planner")} colour={todayHasLiveSession ? '#DC2626' : primary} compact={isMobile} />
                ) : (
                  <StatCard icon="🚀" title="Create Session" text="Start planning your next activity, trip or workshop." button="+ New Session" onClick={() => go('planner', { autoOpenWizard: true })} colour="#0D9488" gradient="linear-gradient(135deg, #0F766E, #1E293B)" compact={isMobile} />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <StatCard icon="⚽" title={nextSession ? nextSession.title : "Next Session"} text={nextSession ? `${formatDate(nextSession.session_date)} · ${nextSession.start_time || "No time"}` : "Nothing booked yet"} button={!nextSession ? "Plan now" : null} badge={nextSession ? (nextSessionStatus === 'live' ? 'Live now' : nextSessionStatus === 'ended' ? 'Ended' : 'Upcoming') : null} onClick={() => nextSession ? go(nextSessionStatus === 'live' ? "registers" : "planner") : go('planner', { autoOpenWizard: true })} colour={nextSessionStatus === 'live' ? '#DC2626' : secondary} compact={isMobile} />
              </div>
            </div>
          </Panel>

          {/* OVERVIEW — merged "today" and "this month" stats behind one toggle, instead of three separate stat blocks */}
          <Panel title="🧭 Overview" right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 99, padding: 3 }}>
                {['today', 'month'].map(v => (
                  <button key={v} onClick={() => setStatsView(v)}
                    style={{ border: 'none', borderRadius: 99, padding: '5px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                      background: statsView === v ? '#fff' : 'none', color: statsView === v ? primary : '#6B7280',
                      boxShadow: statsView === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
                    {v === 'today' ? 'Today' : 'This month'}
                  </button>
                ))}
              </div>
              <button onClick={() => go('reports')} style={{ background: `${primary}14`, color: primary, border: 'none', borderRadius: 99, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>View summary →</button>
            </div>
          }>
            {statsView === 'today' ? (
              <div className="ls-hub-overview-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid #F1F5F9' }}>
                <GlanceStat icon="👥" iconImg="/icons/young-people-icon-v2.png" iconBg="#DCFCE7" value={children.length} valueColour="#16A34A" label="Young people" sub="Expected" onClick={() => go('registers')} />
                <GlanceStat icon="↪" iconImg="/icons/signedin-icon.png" iconBg="#DBEAFE" value={signedIn} valueColour="#2563EB" label="Signed in" sub="So far" onClick={() => go('registers')} />
                <GlanceStat icon="🕐" iconImg="/icons/sessions-icon.png" iconBg="#FEF3C7" value={strictlyTodaySessions.length} valueColour="#D97706" label="Sessions" sub="Today" onClick={() => go('planner')} />
                <GlanceStat icon="❤️" iconImg="/icons/volunteers-icon.png" iconBg={`${secondary}1A`} value={volunteersCount} valueColour={secondary} label="Volunteers" sub="Involved" onClick={() => go('volunteers')} />
              </div>
            ) : (
              <div className="ls-hub-overview-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid #F1F5F9' }}>
                <GlanceStat icon="👥" iconImg="/icons/young-people-icon-v2.png" iconBg="#DCFCE7" value={children.length} valueColour={primary} label="Young people" sub="This month" onClick={() => go('registers')} />
                <GlanceStat icon="📅" iconImg="/icons/sessions-icon.png" iconBg={`${secondary}1A`} value={sessions.length} valueColour={secondary} label="Sessions" sub="Planned" onClick={() => go('planner')} />
                <GlanceStat icon="↪" iconImg="/icons/signedin-icon.png" iconBg="#DBEAFE" value={signedIn} valueColour="#2563EB" label="Signed in" sub="Total" onClick={() => go('registers')} />
                <GlanceStat icon="✓" iconBg="#DCFCE7" value={`${attendanceRate}%`} valueColour="#059669" label="Attendance" sub="Rate" onClick={() => go('reports')} />
              </div>
            )}

            <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr 1fr' : undefined, gap: isMobile ? 10 : 12, flexWrap: 'wrap', marginBottom: 14 }}>
              {hasModule('registers') ? (
                <GlanceCard icon="📋" iconImg="/icons/hub-registers-icon-v2.png" tone="green" title="Registers" subtitle="Take today's register"
                  fraction={`${sessionsEndedToday} / ${strictlyTodaySessions.length}`} fractionLabel="Sessions completed"
                  onClick={() => go('registers')} compact={isMobile} />
              ) : (
                <GlanceCard icon="👥" tone="green" title="Young People" subtitle="View your roster"
                  fraction={children.length} fractionLabel="On roll"
                  onClick={() => go('planner')} compact={isMobile} />
              )}
              {hasModule('safeguarding') ? (
                <GlanceCard icon="🛡️" iconImg="/icons/hub-safeguarding-icon-v2.png" tone={concerns.length > 0 ? "amber" : "blue"} title="Safeguarding" subtitle={concerns.length > 0 ? "Needs attention" : "All clear"}
                  fraction={concerns.length} fractionLabel={concerns.length > 0 ? `Open concern${concerns.length > 1 ? 's' : ''}` : "No open concerns"}
                  onClick={() => go('safeguarding')} compact={isMobile} />
              ) : (
                <GlanceCard icon="🚀" tone="blue" title="Grow your workspace" subtitle="Unlock more modules"
                  fraction="→" fractionLabel="Explore plans"
                  onClick={() => go('settings')} compact={isMobile} />
              )}
            </div>
          </Panel>

          {/* SESSIONS — merged Live & Upcoming + Ended sessions behind one segmented control, instead of two stacked lists */}
          <div>
            <style>{`@keyframes pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.6)}}`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 99, padding: 3 }}>
                <button onClick={() => setSessionsView('upcoming')}
                  style={{ border: 'none', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: sessionsView === 'upcoming' ? '#fff' : 'none', color: sessionsView === 'upcoming' ? primary : '#6B7280',
                    boxShadow: sessionsView === 'upcoming' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
                  📅 Upcoming
                </button>
                <button onClick={() => setSessionsView('ended')}
                  style={{ border: 'none', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: sessionsView === 'ended' ? '#fff' : 'none', color: sessionsView === 'ended' ? primary : '#6B7280',
                    boxShadow: sessionsView === 'ended' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
                  🔒 Ended{endedSessions.length > 0 ? ` (${endedSessions.length})` : ''}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => go('calendar')} style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>📆 Calendar</button>
                <button onClick={() => go('planner')} style={{ fontSize: 11, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ New session</button>
              </div>
            </div>
            {sessionsView === 'ended' ? (
              endedSessions.length === 0 ? (
                <div style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', background: '#F8FAFC', border: '1.5px dashed #E5E7EB', borderRadius: 20, padding: '36px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>
                  No ended sessions yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {endedSessions.map(s => (
                    <div key={s.id} onClick={() => openRegisterForSession(s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = primary }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔒</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                        <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{formatDate(s.session_date)} · Closed {new Date(s.closed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#6B7280', background: '#E5E7EB', borderRadius: 99, padding: '4px 10px', flexShrink: 0 }}>CLOSED</span>
                      <span style={{ fontSize: 16, color: '#CBD5E1', flexShrink: 0 }}>→</span>
                    </div>
                  ))}
                </div>
              )
            ) : upcomingSessions.length === 0 ? (
              <div style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', background: `linear-gradient(135deg, ${primary}10, ${primary}05)`, border: `1.5px dashed ${primary}30`, borderRadius: 20, padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text,#111)', marginBottom: 6, maxWidth: 320 }}>Nothing running or planned in the next 7 days</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20, maxWidth: 320 }}>Create a session and it'll appear here instantly</div>
                <button onClick={() => go('planner')} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px ${primary}40` }}>Plan a Session →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingSessions.map((s, idx) => {
                  const isToday = s.session_date === today
                  const now = new Date()
                  const startDateTime = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
                  const endDateTime = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
                  const hasEnded = isToday && !!endDateTime && endDateTime < now
                  const notStartedYet = isToday && !!startDateTime && startDateTime > now
                  const isLiveNow = isToday && (!startDateTime || startDateTime <= now) && !hasEnded
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
                            {isToday && hasEnded && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>ENDED</span>}
                            {isToday && notStartedYet && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>NOT STARTED</span>}
                            {isToday && !isLiveNow && !hasEnded && !notStartedYet && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 99, padding: '2px 9px', fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>TODAY</span>}
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
                          {hasEnded && (
                            <button onClick={e => { e.stopPropagation(); setClosingSession(s) }}
                              style={{ flex: 1, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                              🔒 Close session
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RECENT REGISTERS — dedicated last-7-days historical register section, separate from
              the Ended tab above, so past registers are easy to find without digging through a toggle. */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text, #111)' }}>📜 Recent Registers</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Last 7 days</div>
              </div>
              <button onClick={() => go('registers')} style={{ fontSize: 11, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all registers →</button>
            </div>
            {endedSessions.length === 0 ? (
              <div style={{ boxSizing: 'border-box', width: '100%', background: '#F8FAFC', border: '1.5px dashed #E5E7EB', borderRadius: 20, padding: '28px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontWeight: 600 }}>
                No sessions have closed in the last 7 days yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {endedSessions.map(s => {
                  const stats = getLiveSessionStats(s)
                  const attendedTotal = stats.signedIn + stats.absent + stats.signedOut + stats.expected
                  const attended = stats.signedIn + stats.signedOut
                  return (
                    <button key={s.id} onClick={() => setOpenLiveSessionId(s.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '1.5px solid #EEF1F6', borderRadius: 99, padding: '8px 14px 8px 8px',
                      background: '#fff', boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = primary }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#EEF1F6' }}>
                      <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🔒</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>🧒 {attended}/{attendedTotal}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>· {formatDate(s.session_date)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* NEEDS ATTENTION — merged Attention Centre + Safeguarding Snapshot + Reflection Due into
              one list, sorted by real urgency (safeguarding concerns and overdue reflections first)
              instead of three separate panels that repeated the same numbers in different card styles. */}
          {(() => {
            const items = []
            if (hasModule('safeguarding') && concerns.length > 0) {
              items.push({ key: 'safeguarding', icon: '🛡️', label: 'Safeguarding', value: `${concerns.length} open concern${concerns.length > 1 ? 's' : ''}`, tone: 'amber', rank: 0, onClick: () => go('safeguarding') })
            }
            if (completedWithoutReflection.length > 0) {
              items.push({ key: 'reflections', icon: '⭐', label: 'Reflections due', value: `${completedWithoutReflection.length} session${completedWithoutReflection.length > 1 ? 's' : ''} to write up`, tone: 'amber', rank: 0, onClick: () => setShowReflectionsModal(true) })
            }
            if (hasModule('resource_booking') && checkedOutCount > 0) {
              items.push({ key: 'resources', icon: '↗', label: 'Resources', value: `${checkedOutCount} item${checkedOutCount > 1 ? 's' : ''} checked out`, tone: 'amber', rank: 1, onClick: () => go('resource_booking') })
            }
            if (medicalAlertsNeedingReview > 0) {
              items.push({ key: 'medical', icon: '💊', label: 'Medical alerts', value: `${medicalAlertsNeedingReview} young ${medicalAlertsNeedingReview > 1 ? 'people' : 'person'} to review`, tone: 'amber', rank: 1, onClick: () => go('medical_alerts') })
            }
            if (hasModule('registers')) {
              items.push({ key: 'registers', icon: '📋', label: 'Registers', value: signedIn > 0 ? `${signedIn} signed in today` : 'No activity yet', tone: 'blue', rank: 2, onClick: () => go('registers') })
            }
            if (hasModule('safeguarding') && concerns.length === 0) {
              items.push({ key: 'safeguarding-clear', icon: '🛡️', label: 'Safeguarding', value: 'No open concerns', tone: 'blue', rank: 3, onClick: () => go('safeguarding') })
            }
            if (hasModule('volunteers')) {
              items.push({ key: 'volunteers', icon: '❤️', label: 'Volunteers', value: 'Review session cover', tone: 'blue', rank: 3, onClick: () => go('volunteers') })
            }
            if (hasModule('mentoring')) {
              items.push({ key: 'mentoring', icon: '🤝', label: 'Mentoring', value: 'View active matches', tone: 'blue', rank: 3, onClick: () => go('mentoring') })
            }
            if (hasModule('reports')) {
              items.push({ key: 'reports', icon: '📊', label: 'Reports', value: 'View impact data', tone: 'blue', rank: 3, onClick: () => go('reports') })
            }
            items.sort((a, b) => a.rank - b.rank)
            if (items.length === 0) return null
            return (
              <Panel title="🔔 Needs attention">
                {items.map(item => (
                  <AttentionRow key={item.key} icon={item.icon} label={item.label} value={item.value} tone={item.tone} onClick={item.onClick} />
                ))}
              </Panel>
            )
          })()}

          {/* PHOTO CAROUSEL — community content, kept below operational items */}
          <PhotoCarousel orgId={orgId} primary={primary} userId={session?.user?.id} />

          {/* ANNOUNCEMENTS — staff/admin only */}
          {['admin', 'owner', 'staff'].includes(userProfile?.role) && (
            <AnnouncementsPanel orgId={orgId} primary={primary} userId={session?.user?.id} />
          )}
        </div>
      </section>

      {/* Floating Report a Cause for Concern button — always accessible from Home, no password needed */}
      <button
        onClick={() => setShowConcernForm(true)}
        title="Report a Cause for Concern"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '14px' : '12px 20px',
          borderRadius: 99, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)',
          color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 10px 28px rgba(220,38,38,0.4)',
        }}
      >
        🚨{!isMobile && ' Report a Cause for Concern'}
      </button>

      {showConcernForm && (
        <>
          <div onClick={() => setShowConcernForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <CauseForConcernForm
              org={org}
              session={session}
              onClose={() => setShowConcernForm(false)}
              onSubmitted={() => {}}
            />
          </div>
        </>
      )}

      {showInviteChild && <InviteParentModal org={org} onClose={() => setShowInviteChild(false)} />}

      {/* Historical register modal — reuses the same dark launcher-card modal style as today's
          live sessions, for any past session opened from outside today's list (e.g. Recent Registers). */}
      {openLiveSessionId && !todaySessions.some(s => s.id === openLiveSessionId) && (() => {
        const pastSession = sessions.find(s => s.id === openLiveSessionId)
        if (!pastSession) return null
        return createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
            background: isMobile ? '#0B1023' : 'rgba(8,11,23,0.7)',
            alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
            padding: isMobile ? 0 : 24, boxSizing: 'border-box',
          }} onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) setOpenLiveSessionId(null) }}>
            <div style={{
              position: 'relative',
              width: '100%', maxWidth: isMobile ? 'none' : 720, maxHeight: isMobile ? 'none' : '90vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              borderRadius: isMobile ? 0 : 26,
              flex: isMobile ? 1 : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '14px 14px 0', background: '#0B1023' }}>
                <button onClick={() => setOpenLiveSessionId(null)} aria-label="Close" style={{
                  width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 14px 24px' : '10px 20px 24px', background: '#0B1023' }}>
                <LiveSessionPanel
                  sessions={[pastSession]}
                  childList={children}
                  attendance={attendance}
                  primary={primary}
                  secondary={secondary}
                  orgId={org?.id}
                  org={org}
                  authUserId={session?.user?.id}
                  reflections={reflections}
                  onOpenRegister={openRegisterForSession}
                  onNavigate={go}
                  getLiveSessionStats={getLiveSessionStats}
                />
              </div>
              <ModalEdgeFade />
            </div>
          </div>,
          document.body
        )
      })()}

      {showReflectionsModal && createPortal(
        <div onClick={() => setShowReflectionsModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>⭐</span>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--text, #111)' }}>Outstanding reflections</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{completedWithoutReflection.length} session{completedWithoutReflection.length > 1 ? 's' : ''} to write up</div>
                </div>
              </div>
              <button onClick={() => setShowReflectionsModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9CA3AF', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 14, flex: 1 }}>
              {completedWithoutReflection.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  All caught up — no reflections outstanding.
                </div>
              ) : (
                completedWithoutReflection.map(s => (
                  <button key={s.id} onClick={() => { setShowReflectionsModal(false); go('planner', { reflectSessionId: s.id }) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: '1px solid #F1F5F9', background: '#FFFBEB', borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #FBBF24, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, color: '#fff' }}>📝</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text, #111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title || 'Untitled session'}</div>
                      <div style={{ fontSize: 11.5, color: '#92400E', marginTop: 1 }}>{formatDate(s.session_date)}{s.start_time ? ` · ${s.start_time}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309', flexShrink: 0 }}>Write →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {closingSession && (
        <EndSessionConfirmModal
          sess={closingSession}
          attendance={attendance}
          primary={primary}
          secondary={secondary}
          onClose={() => setClosingSession(null)}
          onConfirm={() => handleCloseSessionFromCard(closingSession)}
        />
      )}


      {liveRegisterSessionId && sessions.find(s => s.id === liveRegisterSessionId) && (
        <LiveRegister
          session={sessions.find(s => s.id === liveRegisterSessionId)}
          org={org}
          authUserId={session?.user?.id}
          userRole={userProfile?.role}
          onNavigate={onNavigate}
          onClose={() => setLiveRegisterSessionId(null)}
        />
      )}
      </div>
    </div>
  );
}
function Panel({ title, right, children }) {
  return (
    <div style={styles.panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ ...styles.panelTitle, margin: 0 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function GlanceStat({ icon, iconImg, iconBg, value, valueColour, label, sub, onClick }) {
  const c = valueColour || '#64748B'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default',
      width: '100%', minWidth: 0, textAlign: 'left', boxSizing: 'border-box',
      background: `${c}0F`, border: `1px solid ${c}28`, borderRadius: 14, padding: '11px 12px',
    }}>
      {iconImg ? (
        <span style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box' }}>
          <img src={iconImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </span>
      ) : (
        <span style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${c}, ${c}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: `0 4px 10px -3px ${c}70, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}>{icon}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: c, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #111)', marginTop: 1 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>{sub}</div>
      </div>
    </button>
  );
}

function GlanceCard({ icon, iconImg, tone, title, subtitle, fraction, fractionLabel, onClick, compact }) {
  const tones = {
    green: { bg: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', border: '#BBF7D0', iconBg: '#16A34A', pillBg: 'rgba(22,163,74,0.12)', pillColour: '#16A34A', arrowBg: '#16A34A' },
    blue:  { bg: 'linear-gradient(135deg, #EFF6FF, #F5F8FF)', border: '#BFDBFE', iconBg: '#2563EB', pillBg: 'rgba(37,99,235,0.12)', pillColour: '#2563EB', arrowBg: '#2563EB' },
    amber: { bg: 'linear-gradient(135deg, #FFFBEB, #FEF9F0)', border: '#FDE68A', iconBg: '#D97706', pillBg: 'rgba(217,119,6,0.12)', pillColour: '#D97706', arrowBg: '#D97706' },
  }[tone] || { bg: '#F8FAFC', border: '#E5E7EB', iconBg: '#64748B', pillBg: 'rgba(100,116,139,0.12)', pillColour: '#64748B', arrowBg: '#64748B' };

  return (
    <button onClick={onClick} style={{ position: 'relative', flex: compact ? '1 1 auto' : '1 1 220px', width: compact ? '100%' : undefined, minWidth: compact ? 0 : 200, textAlign: 'left', background: tones.bg, border: `1.5px solid ${tones.border}`, borderRadius: compact ? 14 : 18, padding: compact ? 12 : 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: compact ? 10 : 14, overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: compact ? 6 : 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 900, color: 'var(--text, #111)', lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: compact ? 10.5 : 12, color: '#6B7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'nowrap' : 'normal' }}>{subtitle}</div>
        </div>
        {iconImg && (
          <img src={iconImg} alt="" style={{ width: compact ? 36 : 60, height: compact ? 36 : 60, borderRadius: compact ? 10 : 16, objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: compact ? 6 : 8 }}>
        <div style={{ background: tones.pillBg, borderRadius: compact ? 8 : 10, padding: compact ? '6px 9px' : '8px 12px', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: compact ? 13 : 16, fontWeight: 900, color: tones.pillColour, lineHeight: 1.1 }}>{fraction}</div>
          <div style={{ fontSize: compact ? 9.5 : 10.5, color: tones.pillColour, opacity: 0.85, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fractionLabel}</div>
        </div>
        <span style={{ width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: '50%', background: '#fff', color: tones.arrowBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 12 : 15, fontWeight: 900, flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.1)' }}>→</span>
      </div>
    </button>
  );
}

function HeaderQuickAction({ icon, label, onClick, primary, filled, gradientTo }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      padding: '9px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      ...(filled
        ? { border: 'none', background: `linear-gradient(135deg, ${primary}, ${gradientTo || primary + 'CC'})`, color: '#fff', boxShadow: `0 4px 14px -6px ${primary}70` }
        : { border: `1.5px solid ${primary}25`, background: '#fff', color: 'var(--text, #111)' })
    }}>
      <span>{icon}</span>{label}
    </button>
  );
}

function StatCard({ icon, title, text, button, badge, onClick, colour, gradient, compact }) {
  return (
    <button onClick={onClick} style={{
      background: gradient || `linear-gradient(135deg, ${colour}, ${colour}CC)`,
      borderRadius: 16, padding: compact ? '14px 14px' : '16px 18px', color: '#fff', position: 'relative', overflow: 'hidden',
      minHeight: 128, height: '100%', boxShadow: `0 10px 28px -10px ${colour}80`, textAlign: 'left', cursor: 'pointer',
      border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      width: '100%', minWidth: 0, boxSizing: 'border-box',
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
        button ? (
          <div style={{ position: 'relative', marginTop: 10, display: 'inline-block', background: '#fff', borderRadius: 9, padding: '7px 14px', fontSize: 11.5, fontWeight: 800, color: colour, alignSelf: 'flex-start' }}>
            {button}
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: 10, display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 800, color: '#fff', alignSelf: 'flex-start' }}>
            {badge}
          </div>
        )
      )}
    </button>
  );
}

function AttentionRow({ icon, label, value, tone, onClick }) {
  const tones = {
    amber: { bg: '#FFFBEB', border: '#FDE68A', iconBg: 'linear-gradient(135deg, #FBBF24, #D97706)', glow: 'rgba(217,119,6,0.28)' },
    blue:  { bg: '#F8FAFC', border: '#E2E8F0', iconBg: 'linear-gradient(135deg, #60A5FA, #2563EB)', glow: 'rgba(37,99,235,0.18)' },
    green: { bg: '#F0FDF4', border: '#BBF7D0', iconBg: 'linear-gradient(135deg, #4ADE80, #16A34A)', glow: 'rgba(22,163,74,0.18)' },
  }[tone] || { bg: '#F8FAFC', border: '#E2E8F0', iconBg: 'linear-gradient(135deg, #94A3B8, #64748B)', glow: 'rgba(100,116,139,0.18)' };

  const urgent = tone === 'amber';

  return (
    <button onClick={onClick} style={{
      position: 'relative', overflow: 'hidden', width: '100%', display: 'flex', alignItems: 'center', gap: 13,
      background: tones.bg, border: `1px solid ${tones.border}`, borderRadius: 16,
      padding: '12px 14px 12px 16px', marginBottom: 9, textAlign: 'left', cursor: 'pointer',
      boxShadow: urgent ? `0 6px 16px -8px ${tones.glow}` : `0 3px 10px -6px ${tones.glow}`,
    }}>
      {urgent && (
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'linear-gradient(180deg, #FBBF24, #D97706)' }} />
      )}
      <span style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: tones.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
        boxShadow: `0 4px 12px -4px ${tones.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text, #111)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
      {urgent && (
        <span style={{ fontSize: 9, fontWeight: 900, color: '#B45309', background: 'rgba(217,119,6,0.14)', borderRadius: 99, padding: '4px 8px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>Action</span>
      )}
      <span style={{ fontSize: 15, color: '#9CA3AF', flexShrink: 0 }}>→</span>
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



import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useRealtimeTable } from "../../lib/useRealtimeTable";
import { useOrgSettings } from "../../hooks/useOrgSettings";
import CauseForConcernForm from "../safeguarding/CauseForConcernForm";
import LiveRegister from "../registers/LiveRegister";

// Shown wherever the org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

const ANNOUNCEMENT_EMOJIS = ['📣', '🎉', '⭐', '🔥', '💡', '📌', '🚨', '🙌', '❤️', '🏆']
const RA_RATING_COLORS = {
  low: { bg: 'rgba(34,197,94,0.18)', color: '#86EFAC' },
  medium: { bg: 'rgba(245,158,11,0.18)', color: '#FDE047' },
  high: { bg: 'rgba(239,68,68,0.18)', color: '#FCA5A5' },
  critical: { bg: 'rgba(124,58,237,0.2)', color: '#C4B5FD' },
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

  const hasNotStarted = React.useMemo(() => {
    if (!activeSession?.session_date || !activeSession?.start_time) return false
    const startDateTime = new Date(`${activeSession.session_date}T${activeSession.start_time}`)
    return startDateTime > nowTick
  }, [activeSession, nowTick])

  const activeReflection = (reflections || []).find(r => r.session_id === activeSession?.id) || null
  const hasReflection = !!activeReflection

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

        <div style={{ textAlign: 'center', marginBottom: 14, padding: isMobile ? '0' : '0 130px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
            {isSessionEnded ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(148,163,184,0.16)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#CBD5E1', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#94A3B8', borderRadius: '50%' }}></span>
                SESSION ENDED
              </span>
            ) : hasNotStarted ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#FBBF24', letterSpacing: 0.8 }}>
                <span style={{ width: 5, height: 5, background: '#FBBF24', borderRadius: '50%' }}></span>
                NOT STARTED
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

        <button onClick={() => setRegExpanded(x => !x)}
          style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
          <span>📋 Register</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{regExpanded ? '▲ Hide' : '▼ Open'}</span>
        </button>

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
                    {att?.status === 'signed_in' ? (
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
        <HubClosureFlow grouped={regGrouped} onClose={() => setShowClosure(false)} onMarkAllAbsent={handleMarkAllRemainingAbsent} onCloseRegister={handleCloseRegister} primary={primary} secondary={secondary} />
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

function HubClosureFlow({ grouped, onClose, onMarkAllAbsent, onCloseRegister, primary, secondary }) {
  const stillSignedIn = grouped.signed_in.length
  const unaccounted = grouped.expected.length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 22, width: 420, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Close Register</div>

        {stillSignedIn > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>
            ⚠ {stillSignedIn} young people are still marked on site. Sign them out before closing, or confirm this is expected.
          </div>
        )}
        {unaccounted > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#FCD34D' }}>
            {unaccounted} young people have no attendance status.
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
          <button onClick={onCloseRegister} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close and Lock Register</button>
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
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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
    ] = await Promise.all([
      supabase.from("sessions").select("*").eq("org_id", orgId).order("session_date", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("attendance").select("*").eq("org_id", orgId),
      supabase.from("cause_for_concern").select("*").eq("org_id", orgId).eq("status", "open"),
      supabase.from("children").select("*").eq("org_id", orgId).eq("active", true).order("first_name", { ascending: true }),
      supabase.from("session_reflections").select("*").eq("org_id", orgId),
      supabase.from("volunteers").select("id").eq("org_id", orgId),
      supabase.from("resource_checkouts").select("id").eq("org_id", orgId).in("status", ["checked_out", "overdue"]),
    ]);
    setSessions(sessionData || []);
    setAttendance(attendanceData || []);
    setConcerns(concernData || []);
    setChildren(childData || []);
    setReflections(reflectionData || []);
    setVolunteersCount(volunteerData?.length || 0);
    setCheckedOutCount(checkoutData?.length || 0);
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
  const completedWithoutReflection = useMemo(() => {
    const now = new Date();
    return sessions.filter(s => {
      const end = new Date(`${s.session_date}T${s.end_time || "23:59"}`);
      return end < now && !reflections.some(r => r.session_id === s.id);
    }).slice(0, 3);
  }, [sessions, reflections]);

  const todaySessionIds = useMemo(() => new Set(todaySessions.map(s => s.id)), [todaySessions]);
  const todayAttendance = useMemo(() => attendance.filter(a => todaySessionIds.has(a.session_id)), [attendance, todaySessionIds]);
  const signedIn = todayAttendance.filter(a => a.status === "signed_in").length;
  const medicalAlerts = children.filter(c => c.allergies || c.medical_notes || c.has_medication || c.has_asthma || c.has_epipen || c.has_diabetes).length;
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

  const [liveRegisterSessionId, setLiveRegisterSessionId] = useState(null)
  const openRegisterForSession = (sessionId) => {
    setLiveRegisterSessionId(sessionId)
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
        {!isMobile ? (
          <div style={{ padding: '14px 0 12px' }}>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
              <HeaderQuickAction icon="＋" label="Session" onClick={() => go('planner', { autoOpenWizard: true })} primary={primary} filled />
              {hasModule('registers') && <HeaderQuickAction icon="📋" label="Register" onClick={() => go('registers')} primary={primary} />}
              <HeaderQuickAction icon="💬" label="Messages" onClick={() => go('messaging')} primary={primary} />
              {hasModule('volunteers') && <HeaderQuickAction icon="👥" label="Volunteers" onClick={() => go('volunteers')} primary={primary} />}
            </div>
          </div>
        )}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* ── LIVE SESSION HERO ── */}
      <div style={{ padding: `${pad}px ${pad}px 0` }}>
      {liveHeroSession ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : todaySessions.length === 1 ? '1fr' : todaySessions.length === 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: '0 0 8px' }}>
          {todaySessions.slice(0, 20).map(s => (
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

      {isMobile && (
        <div style={{ padding: `0 ${pad}px` }}>
          <div className="ls-glass-stat-row">
            <HeaderMiniStat icon="📅" value={strictlyTodaySessions.length} label="Sessions" onClick={() => go('planner')} primary={primary} tint="teal" />
            <HeaderMiniStat icon="👥" value={children.length} label="Expected" onClick={() => go('registers')} primary={primary} tint="violet" />
            <HeaderMiniStat icon="🙋" value={volunteersCount} label="Volunteers" onClick={() => go('volunteers')} primary={primary} tint="amber" />
            <HeaderMiniStat icon="🛡️" value={concerns.length} label="Alerts" tone={concerns.length > 0 ? 'warn' : 'ok'} onClick={() => go('safeguarding')} primary={primary} tint="green" />
          </div>
        </div>
      )}

      <section style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 18, padding: pad }}>
        <div style={{ minWidth: 0, boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* TODAY AT A GLANCE */}
          <Panel title="📍 Right now">
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

              <StatCard icon="🗓️" title={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today` : "No sessions today"} text={todaySessions.length > 0 ? (todayHasLiveSession ? "In progress" : "Ready for delivery") : "Plan something amazing"} button={todayHasLiveSession ? "Open Register" : "Open Planner"} onClick={() => go(todayHasLiveSession ? "registers" : "planner")} colour={todayHasLiveSession ? '#DC2626' : primary} />
              <StatCard icon="⚽" title={nextSession ? nextSession.title : "Next Session"} text={nextSession ? `${formatDate(nextSession.session_date)} · ${nextSession.start_time || "No time"}` : "Nothing booked yet"} badge={nextSession ? (nextSessionStatus === 'live' ? 'Live now' : nextSessionStatus === 'ended' ? 'Ended' : 'Upcoming') : "Plan now"} onClick={() => go(nextSessionStatus === 'live' ? "registers" : "planner")} colour={nextSessionStatus === 'live' ? '#DC2626' : "#7C3AED"} />
            </div>
          </Panel>

          {/* TODAY AT A GLANCE — summary panel */}
          <Panel title="🧭 Today at a glance" right={
            <button onClick={() => go('reports')} style={{ background: `${primary}14`, color: primary, border: 'none', borderRadius: 99, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>View summary →</button>
          }>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid #F1F5F9' }}>
              <GlanceStat icon="👥" iconBg="#DCFCE7" value={children.length} valueColour="#16A34A" label="Young people" sub="Expected" onClick={() => go('registers')} />
              <GlanceStat icon="↪" iconBg="#DBEAFE" value={signedIn} valueColour="#2563EB" label="Signed in" sub="So far" onClick={() => go('registers')} />
              <GlanceStat icon="🕐" iconBg="#FEF3C7" value={strictlyTodaySessions.length} valueColour="#D97706" label="Sessions" sub="Today" onClick={() => go('planner')} />
              <GlanceStat icon="❤️" iconBg="#EDE9FE" value={volunteersCount} valueColour="#7C3AED" label="Volunteers" sub="Involved" onClick={() => go('volunteers')} />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              {hasModule('registers') ? (
                <GlanceCard icon="📋" tone="green" title="Registers" subtitle="Take today's register"
                  fraction={`${sessionsEndedToday} / ${strictlyTodaySessions.length}`} fractionLabel="Sessions completed"
                  onClick={() => go('registers')} />
              ) : (
                <GlanceCard icon="👥" tone="green" title="Young People" subtitle="View your roster"
                  fraction={children.length} fractionLabel="On roll"
                  onClick={() => go('planner')} />
              )}
              {hasModule('safeguarding') ? (
                <GlanceCard icon="🛡️" tone={concerns.length > 0 ? "amber" : "blue"} title="Safeguarding" subtitle={concerns.length > 0 ? "Needs attention" : "All clear"}
                  fraction={concerns.length} fractionLabel={concerns.length > 0 ? `Open concern${concerns.length > 1 ? 's' : ''}` : "No open concerns"}
                  onClick={() => go('safeguarding')} />
              ) : (
                <GlanceCard icon="🚀" tone="blue" title="Grow your workspace" subtitle="Unlock more modules"
                  fraction="→" fractionLabel="Explore plans"
                  onClick={() => go('settings')} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
              <QuickLinkTile icon="💬" label="Messages" onClick={() => go('messaging')} />
              <QuickLinkTile icon="📅" label="Calendar" onClick={() => go('calendar')} />
              {hasModule('volunteers') && <QuickLinkTile icon="❤️" label="Volunteers" onClick={() => go('volunteers')} />}
              {hasModule('reports') && <QuickLinkTile icon="📄" label="Reports" onClick={() => go('reports')} />}
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
          {(hasModule('registers') || hasModule('safeguarding') || hasModule('volunteers') || hasModule('mentoring') || hasModule('reports') || (hasModule('resource_booking') && checkedOutCount > 0)) && (
            <Panel title="🔔 Attention Centre">
              {hasModule('registers') && <AttentionRow icon="📋" label="Registers" value={signedIn > 0 ? `${signedIn} signed in today` : "No activity yet"} tone={signedIn > 0 ? "green" : "blue"} onClick={() => go("registers")} />}
              {hasModule('safeguarding') && <AttentionRow icon="🛡️" label="Safeguarding" value={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? "s" : ""}` : "No open concerns"} tone={concerns.length > 0 ? "amber" : "green"} onClick={() => go("safeguarding")} />}
              {hasModule('volunteers') && <AttentionRow icon="❤️" label="Volunteers" value="Review session cover" tone="blue" onClick={() => go("volunteers")} />}
              {hasModule('mentoring') && <AttentionRow icon="🤝" label="Mentoring" value="View active matches" tone="blue" onClick={() => go("mentoring")} />}
              {hasModule('reports') && <AttentionRow icon="📊" label="Reports" value="View impact data" tone="blue" onClick={() => go("reports")} />}
              {hasModule('resource_booking') && checkedOutCount > 0 && <AttentionRow icon="↗" label="Resources" value={`${checkedOutCount} item${checkedOutCount > 1 ? "s" : ""} checked out`} tone="amber" onClick={() => go("resource_booking")} />}
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

      {liveRegisterSessionId && sessions.find(s => s.id === liveRegisterSessionId) && (
        <LiveRegister
          session={sessions.find(s => s.id === liveRegisterSessionId)}
          org={org}
          authUserId={session?.user?.id}
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

function GlanceStat({ icon, iconBg, value, valueColour, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 0, flex: '1 1 130px', minWidth: 120, textAlign: 'left' }}>
      <span style={{ width: 34, height: 34, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: valueColour, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #111)', marginTop: 1 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>{sub}</div>
      </div>
    </button>
  );
}

function GlanceCard({ icon, tone, title, subtitle, fraction, fractionLabel, onClick }) {
  const tones = {
    green: { bg: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', border: '#BBF7D0', iconBg: '#16A34A', pillBg: 'rgba(22,163,74,0.12)', pillColour: '#16A34A', arrowBg: '#16A34A' },
    blue:  { bg: 'linear-gradient(135deg, #EFF6FF, #F5F8FF)', border: '#BFDBFE', iconBg: '#2563EB', pillBg: 'rgba(37,99,235,0.12)', pillColour: '#2563EB', arrowBg: '#2563EB' },
    amber: { bg: 'linear-gradient(135deg, #FFFBEB, #FEF9F0)', border: '#FDE68A', iconBg: '#D97706', pillBg: 'rgba(217,119,6,0.12)', pillColour: '#D97706', arrowBg: '#D97706' },
  }[tone] || { bg: '#F8FAFC', border: '#E5E7EB', iconBg: '#64748B', pillBg: 'rgba(100,116,139,0.12)', pillColour: '#64748B', arrowBg: '#64748B' };

  return (
    <button onClick={onClick} style={{ flex: '1 1 220px', minWidth: 200, textAlign: 'left', background: tones.bg, border: `1.5px solid ${tones.border}`, borderRadius: 18, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: tones.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text, #111)' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ background: tones.pillBg, borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: tones.pillColour, lineHeight: 1.1 }}>{fraction}</div>
          <div style={{ fontSize: 10.5, color: tones.pillColour, opacity: 0.85, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fractionLabel}</div>
        </div>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', color: tones.arrowBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.1)' }}>→</span>
      </div>
    </button>
  );
}

function QuickLinkTile({ icon, label, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1.5px solid #F1F5F9', borderRadius: 14, padding: '12px 8px', cursor: 'pointer' }}>
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 6, right: 10, background: '#EF4444', color: '#fff', fontSize: 9.5, fontWeight: 900, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge}</span>
      )}
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #111)' }}>{label}</span>
    </button>
  );
}

const MINI_STAT_TINTS = {
  teal:   { glow: 'rgba(27,154,170,0.45)',  icon: '#1B9AAA' },
  violet: { glow: 'rgba(124,58,237,0.45)',  icon: '#7C3AED' },
  amber:  { glow: 'rgba(217,119,6,0.4)',    icon: '#D97706' },
  green:  { glow: 'rgba(22,163,74,0.4)',    icon: '#16A34A' },
}
function HeaderMiniStat({ icon, value, label, tone, onClick, primary, tint }) {
  const color = tone === 'warn' ? '#D97706' : tone === 'ok' ? '#16A34A' : primary
  const t = MINI_STAT_TINTS[tint] || { glow: `${primary}40`, icon: color }
  return (
    <button onClick={onClick} className="ls-glass-stat" style={{ '--glass-glow': t.glow }}>
      <span className="ls-glass-stat-icon" style={{ color: t.icon }}>{icon}</span>
      <span className="ls-glass-stat-value" style={{ color: tone ? color : 'var(--text, #111)' }}>{value}</span>
      <span className="ls-glass-stat-label">{label}</span>
    </button>
  );
}

function HeaderQuickAction({ icon, label, onClick, primary, filled }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      padding: '9px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      ...(filled
        ? { border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', boxShadow: `0 4px 14px -6px ${primary}70` }
        : { border: `1.5px solid ${primary}25`, background: '#fff', color: 'var(--text, #111)' })
    }}>
      <span>{icon}</span>{label}
    </button>
  );
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


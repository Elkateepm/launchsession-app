import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useIsMobile } from '../../hooks/useIsMobile'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'

function fmtTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }) }
function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// Lightweight, read-only view of a closed session's register — just who was on it
// and when they arrived/left. Deliberately excludes the live register's edit controls,
// staff panel, and notes, since the session is already over. Used from both the Hub
// (Recent Registers) and the Registers tab (Past Registers).
export default function HistoricalAttendanceModal({ session, attendance, allChildren, primary, secondary, onClose }) {
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const s = session

  const sessAttendance = (attendance || []).filter(a => a.session_id === s.id)
  const childById = useMemo(() => {
    const m = {}
    ;(allChildren || []).forEach(c => { m[c.id] = c })
    return m
  }, [allChildren])

  const rows = sessAttendance
    .map(a => ({ att: a, child: childById[a.child_id] }))
    .filter(r => r.child)
    .filter(r => !search.trim() || `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => `${a.child.first_name}`.localeCompare(b.child.first_name))

  const initials = (c) => `${(c.first_name || '?')[0] || ''}${(c.last_name || '')[0] || ''}`.toUpperCase()
  const avatarColours = ['#7C3AED', '#0EA5E9', '#F59E0B', '#EC4899', '#10B981', '#F97316']
  const avatarColour = (id) => avatarColours[Math.abs([...String(id)].reduce((h, ch) => h + ch.charCodeAt(0), 0)) % avatarColours.length]

  const statusChip = (status) => ({
    signed_in: { label: 'Still in', color: '#4ADE80', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.32)' },
    signed_out: { label: 'Signed out', color: '#C4B5FD', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.32)' },
    absent: { label: 'Absent', color: '#FCA5A5', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.32)' },
    expected: { label: 'No show', color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)' },
  }[status] || { label: status || '—', color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)' })

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: isMobile ? '#0B1023' : 'rgba(8,11,23,0.72)',
        alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? 0 : 24, boxSizing: 'border-box',
      }}
      onClick={isMobile ? undefined : (e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={isMobile ? { y: 24, opacity: 0 } : { scale: 0.97, opacity: 0 }}
        animate={isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 480, maxHeight: isMobile ? 'none' : '88vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: isMobile ? 0 : 26, flex: isMobile ? 1 : undefined,
          background: `linear-gradient(160deg, var(--org-a20) 0%, ${(secondary || primary)}22 40%, transparent 100%), linear-gradient(160deg, #0B1023 0%, #131B33 55%, #0F1729 100%)`,
          boxShadow: isMobile ? 'none' : '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: isMobile ? '18px 18px 16px' : '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: isMobile ? 14 : 18, right: isMobile ? 14 : 18, zIndex: 2,
            width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 16, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="✕" /></button>

          <div style={{ paddingRight: 42 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(148,163,184,0.16)', border: '1px solid rgba(148,163,184,0.32)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#CBD5E1', letterSpacing: 0.8, marginBottom: 9 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#94A3B8' }} />ENDED · REGISTER
            </div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 900, color: '#fff', letterSpacing: -0.4 }}>{s.title}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 7 }}>
              {(s.session_date || s.start_time) && (
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  📅 {fmtDate(s.session_date)}{s.start_time ? ` · ${s.start_time}${s.end_time ? ` – ${s.end_time}` : ''}` : ''}
                </span>
              )}
              {s.location && (
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  📍 {s.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search + list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 18px 20px' : '18px 24px 22px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Attendees · {rows.length}
            </div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search young people..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12.5, marginBottom: 12, outline: 'none' }} />

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 10px', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>
              {sessAttendance.length === 0 ? 'No attendance was recorded on this session.' : 'Nobody matches your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map(r => {
                const chip = statusChip(r.att.status)
                let timeLine = null
                if (r.att.status === 'signed_out' && r.att.signed_in_at) {
                  timeLine = `In ${fmtTime(r.att.signed_in_at)} → Out ${fmtTime(r.att.signed_out_at)}`
                } else if (r.att.status === 'signed_in' && r.att.signed_in_at) {
                  timeLine = `In ${fmtTime(r.att.signed_in_at)}`
                } else if (r.att.status === 'absent') {
                  timeLine = r.att.absence_reason || 'Marked absent'
                } else {
                  timeLine = 'Never signed in'
                }
                return (
                  <div key={r.att.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 13, padding: '9px 12px' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 11, flexShrink: 0, overflow: 'hidden',
                      background: r.child.photo_url ? 'transparent' : `linear-gradient(135deg, ${avatarColour(r.child.id)}, ${avatarColour(r.child.id)}CC)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: '#fff',
                    }}>
                      {r.child.photo_url ? <SignedImg bucket="gallery" src={r.child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(r.child)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.child.first_name} {r.child.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginTop: 1 }}>{timeLine}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: chip.color, background: chip.bg, border: `1px solid ${chip.border}`, borderRadius: 99, padding: '3px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>{chip.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

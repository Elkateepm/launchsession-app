import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls } from 'framer-motion'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import PageHeader from '../shared/PageHeader'
import { Avatar, inputStyle, btnGhost, btnPrimary } from '../volunteers/vh_shared'
import Icon from '../../lib/icons'
import {
  TIERS, flagsFor, hasMedicalNeed, tierOf, isReviewDue, compareForTriage, REVIEW_INTERVAL_DAYS,
} from './medicalShared'
import MedicalPrintSheet from './MedicalPrintSheet'

// ─── MEDICAL ALERTS ──────────────────────────────────────────
// This page used to open on a sign-off queue: every flagged child, alphabetical,
// filtered by whether a 180-day review had lapsed. That is a real job, but it is
// the quiet one. The loud one -- the one the page is named for -- is somebody
// needing to know right now whether the child in front of them carries an
// EpiPen, and an alphabetical list filtered by paperwork status answers that
// badly.
//
// So it opens on today: who is on a register today and what staff need to know
// about them, most urgent first, with the actual text on the card rather than
// behind a tap. Sign-off keeps its own tab and its own history.

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())

export default function MedicalAlerts({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const primary = org?.primary_color || '#1B9AAA'
  const authUserId = session?.user?.id
  const orgId = org?.id

  const [children, setChildren] = useState([])
  const [reviews, setReviews] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [todaySessions, setTodaySessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('today')
  const [selectedChild, setSelectedChild] = useState(null)
  const [signOffChild, setSignOffChild] = useState(null)
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const today = todayISO()
    const [{ data: kids }, { data: revs }, { data: sess }] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', orgId).eq('active', true).order('first_name'),
      supabase.from('medical_alert_reviews').select('*').eq('org_id', orgId).order('reviewed_at', { ascending: false }),
      supabase.from('sessions').select('id, title, start_time, end_time')
        .eq('org_id', orgId).eq('session_date', today).is('cancelled_at', null),
    ])
    setChildren(kids || [])
    setReviews(revs || [])
    setTodaySessions(sess || [])

    const ids = (sess || []).map(s => s.id)
    if (ids.length) {
      const { data: att } = await supabase.from('attendance')
        .select('child_id, status, session_id').in('session_id', ids)
      setTodayAttendance(att || [])
    } else {
      setTodayAttendance([])
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const latestReviewByChild = useMemo(() => {
    const map = {}
    // Already ordered reviewed_at desc, so the first hit per child is the latest.
    reviews.forEach(r => { if (!map[r.child_id]) map[r.child_id] = r })
    return map
  }, [reviews])

  // Who is on a register today, and whether they have actually arrived. An
  // absence still counts as being on the register: the information matters up
  // until somebody confirms they are not coming.
  const todayStatusByChild = useMemo(() => {
    const map = {}
    todayAttendance.forEach(a => {
      const rank = { signed_in: 3, signed_out: 2, expected: 1, absent: 0 }
      if (!map[a.child_id] || (rank[a.status] ?? 0) > (rank[map[a.child_id]] ?? 0)) map[a.child_id] = a.status
    })
    return map
  }, [todayAttendance])

  const rows = useMemo(() => children
    .filter(hasMedicalNeed)
    .map(child => {
      const review = latestReviewByChild[child.id] || null
      return {
        child,
        flags: flagsFor(child),
        tier: tierOf(child),
        review,
        needsReview: isReviewDue(review),
        todayStatus: todayStatusByChild[child.id] || null,
      }
    }), [children, latestReviewByChild, todayStatusByChild])

  const onToday = rows.filter(r => r.todayStatus && r.todayStatus !== 'absent')
  const needsReviewRows = rows.filter(r => r.needsReview)
  const immediate = rows.filter(r => r.tier === 1)

  const TABS = [
    { key: 'today', label: 'Today', count: onToday.length },
    // Only offered once there is something in it. A permanent "Immediate
    // response 0" tab is a worry with nothing behind it.
    ...(immediate.length ? [{ key: 'immediate', label: 'Immediate response', count: immediate.length, tone: '#B91C1C' }] : []),
    { key: 'all', label: `All ${terms.people}`, count: rows.length },
    { key: 'review', label: 'Needs review', count: needsReviewRows.length },
  ]

  const base = tab === 'today' ? onToday
    : tab === 'immediate' ? immediate
      : tab === 'review' ? needsReviewRows
        : rows
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? base.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q))
      : base
    return [...filtered].sort(compareForTriage)
  }, [base, search])

  const handleSignOff = async (child, notes) => {
    let reviewerName = 'Team member'
    if (authUserId) {
      const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', authUserId).maybeSingle()
      if (profile?.full_name) reviewerName = profile.full_name
    }
    await supabase.from('medical_alert_reviews').insert({
      org_id: orgId,
      child_id: child.id,
      reviewed_by: authUserId || null,
      reviewed_by_name: reviewerName,
      reviewed_at: new Date().toISOString(),
      notes: notes?.trim() || null,
    })
    setSignOffChild(null)
    setSelectedChild(null)
    load()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>
      <PageHeader
        icon="💊"
        iconImg="/icons/medical-icon.png"
        title="Medical Alerts"
        subtitle={`What staff need to know about the ${terms.people} in their care`}
        primary={primary}
        actions={[
          { label: 'Print list', icon: '🖨', variant: 'ghost', onClick: () => setPrinting(true) },
          { label: 'Back', icon: '←', variant: 'ghost', onClick: () => onNavigate && onNavigate('registers') },
        ]}
        // All three count the same population -- everyone with something
        // recorded. Mixing a today figure in with two org-wide ones read as
        // "4 of today's 8 need an immediate response", which was not what it
        // said. Today's number is on the Today tab, where its scope is obvious.
        stats={[
          { label: `${terms.People} with a medical need`, value: rows.length, icon: '💊',
            onClick: () => setTab('all'), active: tab === 'all' },
          { label: 'Immediate response', value: immediate.length, icon: '🚨',
            color: immediate.length ? '#B91C1C' : undefined,
            onClick: immediate.length ? () => setTab('immediate') : undefined,
            active: tab === 'immediate' },
          { label: 'Needs review', value: needsReviewRows.length, icon: '⏳',
            color: needsReviewRows.length ? '#D97706' : undefined,
            onClick: needsReviewRows.length ? () => setTab('review') : undefined,
            active: tab === 'review' },
        ]}
      />

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', borderRadius: 99, minHeight: 40, fontFamily: 'inherit',
            border: `1.5px solid ${tab === t.key ? (t.tone || primary) : t.tone ? `${t.tone}55` : '#E5E7EB'}`,
            background: tab === t.key
              ? (t.tone || `linear-gradient(135deg, ${primary}, var(--org-a85))`)
              : '#fff',
            color: tab === t.key ? '#fff' : (t.tone || '#6B7280'),
            fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label} {t.count}</button>
        ))}
        <div style={{ flex: '1 1 160px', minWidth: 160, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF' }}><Icon name="🔍" /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
      </div>

      {tab === 'today' && !loading && onToday.some(r => r.tier === 1) && (
        <button onClick={() => setTab('immediate')} style={{
          display: 'block', width: 'calc(100% - 32px)', textAlign: 'left', fontFamily: 'inherit',
          margin: '12px 16px 0', padding: '10px 14px', borderRadius: 10, minHeight: 44,
          background: '#FEE2E2', border: '1.5px solid #FECACA', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 800, color: '#991B1B',
        }}>
          {onToday.filter(r => r.tier === 1).length} of the {onToday.length} on today’s register
          {onToday.filter(r => r.tier === 1).length === 1 ? ' needs' : ' need'} an immediate response plan
          <span style={{ opacity: 0.75 }}> — see everyone who does</span>
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>Loading…</div>
        ) : list.length === 0 ? (
          <EmptyState tab={tab} rows={rows} todaySessions={todaySessions} terms={terms} onSeeAll={() => setTab('all')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(row => (
              <AlertCard
                key={row.child.id} row={row} primary={primary} showToday={tab !== 'today'}
                onOpen={() => setSelectedChild(row)}
                onSignOff={() => setSignOffChild(row.child)}
              />
            ))}
          </div>
        )}
      </div>

      {signOffChild && createPortal(
        <SignOffModal child={signOffChild} onClose={() => setSignOffChild(null)} onConfirm={(notes) => handleSignOff(signOffChild, notes)} />,
        document.body
      )}

      {selectedChild && createPortal(
        <MedicalDetailDrawer
          row={selectedChild}
          reviews={reviews.filter(r => r.child_id === selectedChild.child.id)}
          primary={primary}
          isMobile={isMobile}
          onClose={() => setSelectedChild(null)}
          onSignOff={() => setSignOffChild(selectedChild.child)}
        />,
        document.body
      )}

      {printing && createPortal(
        <MedicalPrintSheet
          org={org} rows={list} scopeLabel={TABS.find(t => t.key === tab)?.label || ''}
          todaySessions={todaySessions} onClose={() => setPrinting(false)}
        />,
        document.body
      )}
    </div>
  )
}

function EmptyState({ tab, rows, todaySessions, terms, onSeeAll }) {
  const nothingAtAll = rows.length === 0
  return (
    <div style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 10, color: '#CBD5E1' }}>
        <Icon name={nothingAtAll ? '💊' : '✅'} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#374151', marginBottom: 5 }}>
        {nothingAtAll
          ? 'Nothing recorded yet'
          : tab === 'today'
            ? (todaySessions.length === 0
              ? 'No sessions today'
              : `Nobody with a medical need is on today's register`)
            : tab === 'immediate'
              ? 'Nobody needs an immediate response plan'
              : tab === 'review'
                ? 'Everything is signed off and in date'
                : 'No matches'}
      </div>
      <div style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 420, margin: '0 auto', lineHeight: 1.55 }}>
        {nothingAtAll
          ? `Allergies, medication and medical notes recorded on a ${terms.person}'s record appear here.`
          : tab === 'today'
            ? `${rows.length} ${rows.length === 1 ? terms.person : terms.people} on the register ${rows.length === 1 ? 'has' : 'have'} something recorded.`
            : ''}
      </div>
      {tab === 'today' && rows.length > 0 && (
        <button onClick={onSeeAll} style={{
          marginTop: 14, minHeight: 40, padding: '0 18px', borderRadius: 10, cursor: 'pointer',
          border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
        }}>See everyone</button>
      )}
    </div>
  )
}

// A card that can be read at arm's length: the tier stripe, the name, and the
// actual text of what matters -- not a chip that means "tap to find out".
function AlertCard({ row, primary, showToday, onOpen, onSignOff }) {
  const { child, flags, tier, review, needsReview, todayStatus } = row
  const t = TIERS[tier] || TIERS[3]
  const named = flags.filter(f => f.detail)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 15px 13px 12px',
        background: '#fff', borderRadius: 16, cursor: 'pointer',
        border: '1px solid #E9EDF2', borderLeft: `4px solid ${t.colour}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
      <Avatar name={`${child.first_name} ${child.last_name}`} photoUrl={child.photo_url} color={primary} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
            {child.first_name} {child.last_name}
          </span>
          {showToday && todayStatus && todayStatus !== 'absent' && (
            <span style={{ fontSize: 10, fontWeight: 800, color: '#166534', background: '#DCFCE7', borderRadius: 99, padding: '2px 8px' }}>
              {todayStatus === 'signed_in' ? 'Here now' : 'On today’s register'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
          {flags.map((f, i) => {
            const ft = TIERS[f.tier]
            return (
              <span key={i} style={{ fontSize: 10.5, fontWeight: 800, color: ft.colour, background: ft.bg, borderRadius: 6, padding: '2px 7px' }}>
                {f.label}
              </span>
            )
          })}
        </div>

        {/* The point of the page. An "Allergy" chip tells nobody what to avoid. */}
        {named.length > 0 && (
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {named.slice(0, 2).map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.45 }}>
                <span style={{ fontWeight: 800, color: TIERS[f.tier].colour }}>{f.label}:</span>{' '}
                {f.detail.length > 140 ? `${f.detail.slice(0, 140)}…` : f.detail}
              </div>
            ))}
            {named.length > 2 && (
              <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>+{named.length - 2} more — tap to read</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: needsReview ? '#B45309' : '#16A34A', fontWeight: 700, marginTop: 6 }}>
          {review
            ? `${needsReview ? 'Review due — l' : 'L'}ast checked ${format(new Date(review.reviewed_at), 'd MMM yyyy')} by ${review.reviewed_by_name || 'a team member'}`
            : 'Never checked'}
        </div>
      </div>

      <button onClick={e => { e.stopPropagation(); onSignOff() }}
        style={{ ...btnPrimary(needsReview ? '#D97706' : '#94A3B8'), flexShrink: 0, fontSize: 12, whiteSpace: 'nowrap', minHeight: 40 }}>
        {needsReview ? 'Sign off' : 'Re-confirm'}
      </button>
    </motion.div>
  )
}

function SignOffModal({ child, onClose, onConfirm }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    setSaving(true)
    await onConfirm(notes)
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 22, boxShadow: '0 32px 80px rgba(0,0,0,0.35)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 4 }}>Sign off medical info</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
          {child.first_name} {child.last_name} — confirms you have read and understood their current medical information.
          It will come round again in {REVIEW_INTERVAL_DAYS} days.
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…"
          style={{ ...inputStyle, minHeight: 80, marginBottom: 16, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary(saving ? '#9CA3AF' : '#16A34A'), flex: 1 }}>
            {saving ? 'Saving…' : 'Confirm sign off'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MedicalDetailDrawer({ row, reviews, primary, isMobile, onClose, onSignOff }) {
  const { child, flags } = row
  const dragControls = useDragControls()
  const name = `${child.first_name} ${child.last_name}`
  const sortedReviews = [...reviews].sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10600, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose() }}
        style={{ background: '#fff', borderRadius: isMobile ? '24px 24px 0 0' : 24, width: '100%', maxWidth: isMobile ? '100%' : 440, maxHeight: isMobile ? '90vh' : '88vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', boxSizing: 'border-box' }}
      >
        {isMobile && (
          <div onPointerDown={e => dragControls.start(e)} style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, cursor: 'grab', touchAction: 'none' }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.12)' }} />
          </div>
        )}

        <div style={{ padding: '8px 20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#111' }}>{name}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{child.group_name || 'Ungrouped'}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>
              <Icon name="✕" />
            </button>
          </div>

          {/* Emergency contact first. Everything below it is what you say to
              them; this is who you call. */}
          {(child.emergency_contact_name || child.emergency_contact_phone) && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Emergency contact</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{child.emergency_contact_name || 'Not named'}</div>
              {child.emergency_contact_phone && (
                <a href={`tel:${child.emergency_contact_phone}`} onClick={e => e.stopPropagation()}
                  style={{ fontSize: 14, fontWeight: 800, color: '#B91C1C', textDecoration: 'none' }}>
                  {child.emergency_contact_phone}
                </a>
              )}
            </div>
          )}

          {flags.map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: TIERS[f.tier].colour, background: TIERS[f.tier].bg, borderRadius: 6, padding: '2px 7px' }}>{f.label}</span>
                {f.tier === 1 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C' }}>{TIERS[1].label}</span>}
              </div>
              <div style={{ fontSize: 13, color: f.detail ? '#374151' : '#9CA3AF', lineHeight: 1.5 }}>
                {f.detail || 'No further detail recorded.'}
              </div>
            </div>
          ))}

          {(child.parent_name || child.parent_phone) && (
            <div style={{ marginBottom: 14, fontSize: 12.5, color: '#64748B' }}>
              <span style={{ fontWeight: 800 }}>Parent or carer:</span> {child.parent_name || '—'}
              {child.parent_phone ? ` · ${child.parent_phone}` : ''}
            </div>
          )}

          <button onClick={onSignOff} style={{ ...btnPrimary(primary), width: '100%', marginTop: 6, marginBottom: 20, minHeight: 46 }}>
            Sign off / re-confirm
          </button>

          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Sign-off history</div>
          {sortedReviews.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>No sign-offs recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedReviews.map(r => (
                <div key={r.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: '#111' }}>{r.reviewed_by_name || 'Team member'}</div>
                  <div style={{ color: '#6B7280' }}>{format(new Date(r.reviewed_at), 'd MMM yyyy, HH:mm')}</div>
                  {r.notes && <div style={{ color: '#374151', marginTop: 4 }}>{r.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

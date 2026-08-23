import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls } from 'framer-motion'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import PageHeader from '../shared/PageHeader'
import { Avatar, inputStyle, btnGhost, btnPrimary } from '../volunteers/vh_shared'
import Icon from '../../lib/icons'

const REVIEW_INTERVAL_DAYS = 180 // re-confirm medical info roughly every 6 months

function medicalChips(child) {
  const chips = []
  if (child.allergies) chips.push({ label: 'Allergy', color: '#B45309', bg: '#FEF3C7' })
  if (child.has_asthma) chips.push({ label: 'Asthma', color: '#B91C1C', bg: '#FEE2E2' })
  if (child.has_diabetes) chips.push({ label: 'Diabetes', color: '#B91C1C', bg: '#FEE2E2' })
  if (child.takes_medication || child.has_medication) chips.push({ label: 'Medication', color: '#6D28D9', bg: '#EDE9FE' })
  if (child.has_epipen) chips.push({ label: 'EpiPen', color: '#B91C1C', bg: '#FEE2E2' })
  if (child.has_behaviour_plan) chips.push({ label: 'Behaviour plan', color: '#0369A1', bg: '#E0F2FE' })
  if (child.medical_notes && chips.length === 0) chips.push({ label: 'Medical note', color: '#334155', bg: '#F1F5F9' })
  return chips
}

function hasAnyMedicalFlag(child) {
  return !!(child.allergies || child.medical_notes || child.has_medication || child.has_asthma || child.has_epipen || child.has_diabetes || child.has_behaviour_plan)
}

export default function MedicalAlerts({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#1B9AAA'
  const authUserId = session?.user?.id
  const orgId = org?.id

  const [children, setChildren] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('needs_review')
  const [selectedChild, setSelectedChild] = useState(null)
  const [signOffChild, setSignOffChild] = useState(null)

  const load = useCallback(async () => {
    if (!orgId) return
    const [{ data: kids }, { data: revs }] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', orgId).eq('active', true).order('first_name'),
      supabase.from('medical_alert_reviews').select('*').eq('org_id', orgId).order('reviewed_at', { ascending: false }),
    ])
    setChildren(kids || [])
    setReviews(revs || [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const latestReviewByChild = useMemo(() => {
    const map = {}
    // reviews already ordered reviewed_at desc, so first hit per child is the latest
    reviews.forEach(r => { if (!map[r.child_id]) map[r.child_id] = r })
    return map
  }, [reviews])

  const flaggedChildren = useMemo(() => children.filter(hasAnyMedicalFlag), [children])

  const isStale = useCallback((review) => {
    if (!review) return true
    const cutoff = Date.now() - REVIEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000
    return new Date(review.reviewed_at).getTime() < cutoff
  }, [])

  const rows = useMemo(() => flaggedChildren.map(child => {
    const review = latestReviewByChild[child.id] || null
    return { child, chips: medicalChips(child), review, needsReview: isStale(review) }
  }), [flaggedChildren, latestReviewByChild, isStale])

  const needsReviewCount = rows.filter(r => r.needsReview).length
  const reviewedCount = rows.length - needsReviewCount

  const searched = (list) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q))
  }

  const tabbed = tab === 'needs_review' ? rows.filter(r => r.needsReview) : tab === 'reviewed' ? rows.filter(r => !r.needsReview) : rows
  const list = searched(tabbed).sort((a, b) => `${a.child.first_name}`.localeCompare(b.child.first_name))

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
        subtitle="Review and sign off medical information for young people in your care"
        primary={primary}
        actions={[
          { label: 'Back', icon: '←', variant: 'ghost', onClick: () => onNavigate && onNavigate('registers') },
        ]}
        stats={[
          { label: 'Flagged', value: rows.length, icon: '💊' },
          { label: 'Needs review', value: needsReviewCount, icon: '⏳', color: '#D97706' },
          { label: 'Reviewed', value: reviewedCount, icon: '✅', color: '#16A34A' },
        ]}
      />

      {/* TABS + SEARCH */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { key: 'needs_review', label: 'Needs Review', count: needsReviewCount },
          { key: 'reviewed', label: 'Reviewed', count: reviewedCount },
          { key: 'all', label: 'All', count: rows.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${tab === t.key ? primary : '#E5E7EB'}`,
            background: tab === t.key ? `linear-gradient(135deg, ${primary}, ${primary}CC)` : '#fff',
            color: tab === t.key ? '#fff' : '#6B7280',
            fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {t.label} {t.count}
          </button>
        ))}
        <div style={{ flex: '1 1 160px', minWidth: 160, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF' }}><Icon name="🔍" /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>Loading...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{tab === 'needs_review' ? '✅' : '💊'}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#374151', marginBottom: 4 }}>
              {tab === 'needs_review' ? 'Nothing needs review right now' : rows.length === 0 ? 'No medical alerts on record' : 'No matches'}
            </div>
            {tab === 'needs_review' && rows.length > 0 && (
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Everything's signed off and within the review window.</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(({ child, chips, review, needsReview }) => (
              <motion.div key={child.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                onClick={() => setSelectedChild({ child, chips, review })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff',
                  border: `1.5px solid ${needsReview ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 16, cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                <Avatar name={`${child.first_name} ${child.last_name}`} photoUrl={child.photo_url} color={primary} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.first_name} {child.last_name}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                    {chips.map((c, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 800, color: c.color, background: c.bg, borderRadius: 6, padding: '1px 6px' }}>{c.label}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: needsReview ? '#B45309' : '#16A34A', fontWeight: 700, marginTop: 5 }}>
                    {review
                      ? `${needsReview ? 'Review due — l' : 'L'}ast reviewed ${format(new Date(review.reviewed_at), 'd MMM yyyy')} by ${review.reviewed_by_name || 'a team member'}`
                      : 'Never reviewed'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); setSignOffChild(child) }}
                  style={{ ...btnPrimary(needsReview ? '#D97706' : '#94A3B8'), flexShrink: 0, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {needsReview ? 'Sign Off' : 'Re-confirm'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SIGN OFF MODAL */}
      {signOffChild && createPortal(
        <SignOffModal child={signOffChild} onClose={() => setSignOffChild(null)} onConfirm={(notes) => handleSignOff(signOffChild, notes)} />,
        document.body
      )}

      {/* CHILD MEDICAL DETAIL DRAWER */}
      {selectedChild && createPortal(
        <MedicalDetailDrawer
          child={selectedChild.child}
          chips={selectedChild.chips}
          reviews={reviews.filter(r => r.child_id === selectedChild.child.id)}
          primary={primary}
          isMobile={isMobile}
          onClose={() => setSelectedChild(null)}
          onSignOff={() => setSignOffChild(selectedChild.child)}
        />,
        document.body
      )}
    </div>
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
          {child.first_name} {child.last_name} — confirms you've read and understood their current medical information.
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)..."
          style={{ ...inputStyle, minHeight: 80, marginBottom: 16, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary(saving ? '#9CA3AF' : '#16A34A'), flex: 1 }}>
            {saving ? 'Saving...' : '✓ Confirm Sign Off'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MedicalDetailDrawer({ child, chips, reviews, primary, isMobile, onClose, onSignOff }) {
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
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 800, color: c.color, background: c.bg, borderRadius: 99, padding: '3px 10px' }}>{c.label}</span>
            ))}
          </div>

          {child.allergies && <DetailBlock label="Allergies" value={child.allergies} />}
          {child.medical_notes && <DetailBlock label="Medical Notes" value={child.medical_notes} />}
          {child.medication_details && <DetailBlock label="Medication Details" value={child.medication_details} />}
          {child.behaviour_plan_notes && <DetailBlock label="Behaviour Plan" value={child.behaviour_plan_notes} />}
          {(child.emergency_contact_name || child.emergency_contact_phone) && (
            <DetailBlock label="Emergency Contact" value={`${child.emergency_contact_name || ''}${child.emergency_contact_phone ? ' · ' + child.emergency_contact_phone : ''}`} />
          )}

          <button onClick={onSignOff} style={{ ...btnPrimary(primary), width: '100%', marginTop: 6, marginBottom: 20 }}>
            ✓ Sign Off / Re-confirm
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

function DetailBlock({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

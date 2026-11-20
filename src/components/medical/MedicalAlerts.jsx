import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'
import SessionSheet, { flowButton, flowInput } from '../sessions/SessionSheet'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import { flagsFor, hasMedicalNeed, tierOf, isReviewDue, compareForTriage, REVIEW_INTERVAL_DAYS } from './medicalShared'
import MedicalPrintSheet from './MedicalPrintSheet'

// ─── MEDICAL ALERTS ──────────────────────────────────────────
// Two very different moments use this page: a loud one, where somebody needs
// to know right now whether the child in front of them carries an EpiPen and
// who to ring, and a quiet one, working through sign-offs. So it opens on
// today's register, grouped by how fast a response would need to be, with the
// actual text and the emergency contact's number on each card. Sign-off has
// its own view and stays out of the way everywhere else.

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())

// Tier colours as fixed pairs, light chip on any surface, so the text keeps
// its contrast in both themes (the old tokens fell to ~3.9:1 on the tint).
const TIER_STYLE = {
  1: { key: 'immediate', heading: 'var(--danger-text)', title: 'Immediate response', blurb: 'Rescue medication or an emergency plan. Know where it is and what to do.', fg: '#B91C1C', bg: '#FEE2E2', ring: '#EF4444', icon: '🚨' },
  2: { key: 'ongoing', heading: 'var(--warn-text)', title: 'Ongoing needs', blurb: 'Allergies and medication to keep in mind through the session.', fg: '#92400E', bg: '#FEF3C7', ring: '#F59E0B', icon: '💊' },
  3: { key: 'context', heading: 'var(--text)', title: 'Worth knowing', blurb: 'Plans and notes that help the day go well.', fg: '#334155', bg: '#E2E8F0', ring: '#94A3B8', icon: '📝' },
}
const FLAG_ICON = {
  EpiPen: '💉', 'Severe allergy': '🚨', Allergy: '⚠️', Diabetes: '🩺', Asthma: '🩺',
  Medication: '💊', 'Behaviour plan': '❤️', 'Medical condition': '⚡', 'Medical note': '📝',
}
// The condition filter merges labels that mean the same thing to a leader.
const CONDITION_OF = { 'Severe allergy': 'Allergies', Allergy: 'Allergies', 'Medical condition': 'Seizures and conditions', 'Medical note': 'Notes' }
const conditionOf = (label) => CONDITION_OF[label] || label

const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }

export default function MedicalAlerts({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const brand = orgBrand(org)
  const authUserId = session?.user?.id
  const orgId = org?.id

  const [children, setChildren] = useState([])
  const [reviews, setReviews] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [todaySessions, setTodaySessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('today') // today | all | review
  const [tierFilter, setTierFilter] = useState(null)
  const [condition, setCondition] = useState(null)
  const [selected, setSelected] = useState(null)
  const [signOffChild, setSignOffChild] = useState(null)
  const [printing, setPrinting] = useState(false)
  const [toast, setToast] = useState(null)

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
      const { data: att } = await supabase.from('attendance').select('child_id, status, session_id').in('session_id', ids)
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

  // Who is on a register today, and whether they have arrived. An absence
  // still counts as on the register until somebody confirms it.
  const todayStatusByChild = useMemo(() => {
    const rank = { signed_in: 3, signed_out: 2, expected: 1, absent: 0 }
    const map = {}
    todayAttendance.forEach(a => {
      if (!map[a.child_id] || (rank[a.status] ?? 0) > (rank[map[a.child_id]] ?? 0)) map[a.child_id] = a.status
    })
    return map
  }, [todayAttendance])

  const rows = useMemo(() => children.filter(hasMedicalNeed).map(child => {
    const review = latestReviewByChild[child.id] || null
    return { child, flags: flagsFor(child), tier: tierOf(child), review, needsReview: isReviewDue(review), todayStatus: todayStatusByChild[child.id] || null }
  }), [children, latestReviewByChild, todayStatusByChild])

  const onToday = rows.filter(r => r.todayStatus && r.todayStatus !== 'absent')
  const hereNow = onToday.filter(r => r.todayStatus === 'signed_in').length
  const needsReviewRows = rows.filter(r => r.needsReview)
  const base = view === 'today' ? onToday : view === 'review' ? needsReviewRows : rows

  const conditions = useMemo(() => {
    const counts = {}
    base.forEach(r => new Set(r.flags.map(f => conditionOf(f.label))).forEach(c => { counts[c] = (counts[c] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [base])

  const tierCounts = { 1: 0, 2: 0, 3: 0 }
  base.forEach(r => { tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1 })

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return base
      .filter(r => !q || `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q))
      .filter(r => !tierFilter || r.tier === tierFilter)
      .filter(r => !condition || r.flags.some(f => conditionOf(f.label) === condition))
      .sort(compareForTriage)
  }, [base, search, tierFilter, condition])

  const changeView = (v) => { setView(v); setTierFilter(null); setCondition(null) }

  const handleSignOff = async (child, notes) => {
    let reviewerName = 'Team member'
    if (authUserId) {
      const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', authUserId).maybeSingle()
      if (profile?.full_name) reviewerName = profile.full_name
    }
    await supabase.from('medical_alert_reviews').insert({
      org_id: orgId, child_id: child.id, reviewed_by: authUserId || null, reviewed_by_name: reviewerName,
      reviewed_at: new Date().toISOString(), notes: notes?.trim() || null,
    })
    setSignOffChild(null)
    setSelected(null)
    setToast(`Signed off: ${child.first_name} ${child.last_name}`)
    setTimeout(() => setToast(null), 3200)
    load()
  }

  const onHero = heroButtons(brand, { ...flowButton, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 })
  const inDate = rows.length - needsReviewRows.length

  return (
    <div style={{ background: `radial-gradient(ellipse at 0% 0%, ${withAlpha(brand.primary, '14')}, transparent 48%), var(--bg)`, minHeight: '100%', width: '100%' }}>
      <style>{'@keyframes mdRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes mdPing{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%,100%{box-shadow:0 0 0 7px rgba(34,197,94,0)}}@keyframes mdFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}.md-rise{animation:mdRise .45s cubic-bezier(.22,1,.36,1) both}.md-ping{animation:mdPing 1.8s ease-out infinite}.md-fill{transform-origin:left;animation:mdFill .9s cubic-bezier(.22,1,.36,1) .2s both}.md-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px -16px rgba(15,23,42,.35)!important}@media (prefers-reduced-motion: reduce){.md-rise,.md-ping,.md-fill{animation:none}.md-card:hover{transform:none}}'}</style>
      <div aria-hidden="true" style={{ height: 4, background: brand.stripe }} />
      <div style={{ padding: isMobile ? '20px 16px 32px' : 28, width: '100%', boxSizing: 'border-box' }}>
        <OrgPageHero org={org} mobile={isMobile} title="Medical alerts"
          subtitle={`What staff need to know about the ${terms.people} in their care, and who to call.`}
          label={todaySessions.length ? 'On site now' : 'Recorded'}
          detail={todaySessions.length ? `${hereNow} with a medical need` : `${rows.length} ${rows.length === 1 ? terms.person : terms.people}`}
          actions={<>
            <button type="button" onClick={() => setPrinting(true)} style={{ ...onHero.main, flex: isMobile ? 1 : undefined }}><Icon name="print" />Print list</button>
            <button type="button" onClick={() => changeView('review')} style={{ ...onHero.quiet, flex: isMobile ? 1 : undefined }}>Sign-offs{needsReviewRows.length ? ` (${needsReviewRows.length})` : ''}</button>
          </>}
          shortcuts={<>
            <button type="button" onClick={() => onNavigate?.('registers')} style={onHero.shortcut}><Icon name="registers" />Registers</button>
            <button type="button" onClick={() => onNavigate?.('children')} style={onHero.shortcut}><Icon name="children" />{terms.People}</button>
          </>} />

        {/* How you are looking, and what to narrow it to */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 12 : '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div role="group" aria-label="Who to show" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface2)', flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
              {/* Shorter on a phone, where three long labels ran off the card. */}
              {[['today', 'Today', onToday.length], ['all', isMobile ? 'Everyone' : `All ${terms.people}`, rows.length], ['review', isMobile ? 'Sign-offs' : 'Needs sign-off', needsReviewRows.length]].map(([key, label, count]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)}
                  style={{ flex: 1, minWidth: isMobile ? 0 : 'auto', minHeight: 44, padding: isMobile ? '0 6px' : '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                    background: view === key ? 'var(--surface)' : 'transparent', color: view === key ? 'var(--text)' : 'var(--text3)', boxShadow: view === key ? '0 1px 3px #0F172A1f' : 'none' }}>
                  {label} <span style={{ color: 'var(--text3)', fontWeight: 700 }}>{count}</span>
                </button>
              ))}
            </div>
            <label style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text3)' }}>
              <Icon name="search" />
              <input aria-label="Search by name" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name"
                style={{ flex: 1, minWidth: 0, height: 44, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit' }} />
            </label>
          </div>
          {conditions.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: isMobile ? 'auto' : undefined, flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 2 : 0 }}>
              <button type="button" aria-pressed={!condition} onClick={() => setCondition(null)} style={{ ...chip, ...(condition ? {} : { background: 'var(--text)', color: 'var(--surface)', borderColor: 'transparent' }) }}>Every condition</button>
              {conditions.map(([c, n]) => (
                <button key={c} type="button" aria-pressed={condition === c} onClick={() => setCondition(condition === c ? null : c)}
                  style={{ ...chip, ...(condition === c ? { background: 'var(--text)', color: 'var(--surface)', borderColor: 'transparent' } : {}) }}>
                  {c} <span style={{ opacity: .7 }}>{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The three levels, as counts that narrow the list */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : 'repeat(3, minmax(0, 260px))', gap: 10, marginBottom: 18 }}>
          {[1, 2, 3].map((t, i) => {
            const s = TIER_STYLE[t]
            const on = tierFilter === t
            return (
              <button key={t} type="button" aria-pressed={on} disabled={!tierCounts[t]} onClick={() => setTierFilter(on ? null : t)} className="md-rise"
                aria-label={`${s.title}: ${tierCounts[t] || 0}${tierCounts[t] ? '. Show only these' : ''}`}
                style={{ animationDelay: `${i * 60}ms`, textAlign: 'left', padding: isMobile ? '10px 10px' : '12px 14px', borderRadius: 16, cursor: tierCounts[t] ? 'pointer' : 'default', fontFamily: 'inherit',
                  border: `1.5px solid ${on ? s.ring : 'var(--border)'}`, background: on ? s.bg : 'var(--surface)', opacity: tierCounts[t] ? 1 : .6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: s.bg, color: s.fg, fontSize: 15, flexShrink: 0 }}><Icon name={s.icon} /></span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: on ? s.fg : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{tierCounts[t] || 0}</span>
                </span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 12, fontWeight: 800, color: on ? s.fg : 'var(--text2)', lineHeight: 1.25 }}>{s.title}</span>
              </button>
            )
          })}
        </div>

        {view === 'review' && rows.length > 0 && (
          <div className="md-rise" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
              <span>{inDate} of {rows.length} signed off and in date</span>
              <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Every {REVIEW_INTERVAL_DAYS / 30} months</span>
            </div>
            <div role="progressbar" aria-label="Medical records signed off" aria-valuenow={inDate} aria-valuemin={0} aria-valuemax={rows.length} style={{ height: 8, borderRadius: 99, background: 'var(--surface2)', marginTop: 10, overflow: 'hidden' }}>
              <div className="md-fill" style={{ width: `${rows.length ? (inDate / rows.length) * 100 : 0}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #22C55E, #0EA5E9)' }} />
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontWeight: 600 }}>Loading…</div>
        ) : list.length === 0 ? (
          <EmptyState view={view} rows={rows} filtered={!!(search || tierFilter || condition)} todaySessions={todaySessions} terms={terms} onSeeAll={() => changeView('all')} onClear={() => { setSearch(''); setTierFilter(null); setCondition(null) }} />
        ) : (
          [1, 2, 3].map(t => {
            const group = list.filter(r => r.tier === t)
            if (!group.length) return null
            const s = TIER_STYLE[t]
            return (
              <section key={t} aria-label={s.title} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  {/* Theme tokens here, not the chip colours: the page behind a
                      heading is dark in dark mode, the chips never are. */}
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: s.heading }}>{s.title} <span style={{ color: 'var(--text3)', fontWeight: 700 }}>{group.length}</span></h2>
                  <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{s.blurb}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
                  {group.map((row, i) => (
                    <AlertCard key={row.child.id} row={row} index={i} onOpen={() => setSelected(row)} onSignOff={() => setSignOffChild(row.child)} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>

      {selected && (
        <MedicalDetail row={selected} reviews={reviews.filter(r => r.child_id === selected.child.id)} onClose={() => setSelected(null)} onSignOff={() => setSignOffChild(selected.child)} />
      )}
      {signOffChild && (
        <SignOffSheet child={signOffChild} onClose={() => setSignOffChild(null)} onConfirm={(notes) => handleSignOff(signOffChild, notes)} />
      )}
      {printing && createPortal(
        <MedicalPrintSheet org={org} rows={list} scopeLabel={view === 'today' ? 'Today' : view === 'review' ? 'Needs sign-off' : `All ${terms.people}`} todaySessions={todaySessions} onClose={() => setPrinting(false)} />,
        document.body
      )}
      {toast && createPortal(
        <div role="status" className="md-rise" style={{ position: 'fixed', left: '50%', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', zIndex: 10800, background: '#0F172A', color: '#fff', padding: '12px 18px', borderRadius: 14, fontSize: 14, fontWeight: 750, boxShadow: '0 16px 40px -10px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4ADE80' }}><Icon name="check" /></span>{toast}
        </div>,
        document.body
      )}
    </div>
  )
}

function EmptyState({ view, rows, filtered, todaySessions, terms, onSeeAll, onClear }) {
  const nothingAtAll = rows.length === 0
  const title = nothingAtAll ? 'Nothing recorded yet'
    : filtered ? 'No matches'
      : view === 'today' ? (todaySessions.length === 0 ? 'No sessions today' : `Nobody with a medical need is on today's register`)
        : view === 'review' ? 'Everything is signed off and in date' : 'No matches'
  const text = nothingAtAll ? `Allergies, medication and medical notes on a ${terms.person}'s record appear here.`
    : filtered ? 'Try a different name or filter.'
      : view === 'today' ? `${rows.length} ${rows.length === 1 ? terms.person : terms.people} on the register ${rows.length === 1 ? 'has' : 'have'} something recorded.` : ''
  return (
    <div className="md-rise" style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 18 }}>
      <div style={{ fontSize: 34, marginBottom: 8, color: view === 'review' && !nothingAtAll ? 'var(--ok-text)' : 'var(--text3)' }}><Icon name={view === 'review' && !nothingAtAll ? '✅' : '💊'} /></div>
      <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--text)' }}>{title}</div>
      {text && <div style={{ fontSize: 13.5, color: 'var(--text3)', maxWidth: 420, margin: '6px auto 0', lineHeight: 1.55 }}>{text}</div>}
      {filtered && <button type="button" onClick={onClear} style={{ ...flowButton, marginTop: 14 }}>Clear filters</button>}
      {!filtered && view === 'today' && rows.length > 0 && <button type="button" onClick={onSeeAll} style={{ ...flowButton, marginTop: 14 }}>See everyone</button>}
    </div>
  )
}

// A card that reads at arm's length: who, how urgent, the actual text, and
// the number to call. Opening it shows everything else.
function AlertCard({ row, index, onOpen, onSignOff }) {
  const { child, flags, tier, review, needsReview, todayStatus } = row
  const s = TIER_STYLE[tier] || TIER_STYLE[3]
  const name = `${child.first_name} ${child.last_name}`
  const named = flags.filter(f => f.detail)
  const here = todayStatus === 'signed_in'
  return (
    <article aria-label={name} className="md-rise md-card" onClick={onOpen}
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms`, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--surface)', borderRadius: 18, cursor: 'pointer',
        border: '1px solid var(--border)', borderTop: `4px solid ${s.ring}`, boxShadow: '0 1px 2px rgba(15,23,42,.05)', transition: 'transform .18s ease, box-shadow .18s ease', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900, color: s.fg, background: s.bg, boxShadow: `0 0 0 2px ${s.ring}`, flexShrink: 0 }}>
          {(child.first_name || '?')[0]}{(child.last_name || '')[0] || ''}
          {here && <span className="md-ping" style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--surface)' }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button type="button" onClick={e => { e.stopPropagation(); onOpen() }} style={{ display: 'block', maxWidth: '100%', minHeight: 44, padding: '10px 0', margin: '-10px 0 -8px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 16, fontWeight: 850, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</button>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>
            {[child.group_name, todayStatus === 'signed_in' ? 'Here now' : todayStatus === 'expected' ? 'Expected today' : todayStatus === 'signed_out' ? 'Gone home' : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {flags.map((f, i) => {
          const fs = TIER_STYLE[f.tier]
          return <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: fs.fg, background: fs.bg, borderRadius: 8, padding: '3px 9px' }}><Icon name={FLAG_ICON[f.label] || '📝'} />{f.label}</span>
        })}
      </div>

      {named.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          {named.slice(0, 2).map((f, i) => (
            <div key={i} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 800 }}>{f.label}:</span> {f.detail.length > 150 ? `${f.detail.slice(0, 150)}…` : f.detail}
            </div>
          ))}
          {named.length > 2 && <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>+{named.length - 2} more inside</div>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-soft, var(--border))' }}>
        {child.emergency_contact_phone
          ? <a href={`tel:${child.emergency_contact_phone.replace(/\s+/g, '')}`} onClick={e => e.stopPropagation()}
              aria-label={`Call ${child.emergency_contact_name || 'emergency contact'} on ${child.emergency_contact_phone}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 14px', borderRadius: 12, background: '#B91C1C', color: '#fff', fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}>
              <Icon name="📞" />Call {(child.emergency_contact_name || 'contact').split(/[ (]/)[0]}
            </a>
          : <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>No emergency number on file</span>}
        <span style={{ flex: 1 }} />
        {needsReview
          ? <button type="button" onClick={e => { e.stopPropagation(); onSignOff() }} style={{ minHeight: 44, padding: '0 12px', borderRadius: 12, border: '1px solid #FCD34D', background: '#FFFBEB', color: '#92400E', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{review ? 'Sign-off due' : 'Sign off'}</button>
          : <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ok-text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" />Checked {format(new Date(review.reviewed_at), 'd MMM')}</span>}
      </div>
    </article>
  )
}

function SignOffSheet({ child, onClose, onConfirm }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = async () => { setSaving(true); await onConfirm(notes); setSaving(false) }
  return (
    <SessionSheet title="Sign off medical information" subtitle={`${child.first_name} ${child.last_name}`} onClose={onClose} busy={saving} width={460}
      footer={<div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose} style={{ ...flowButton, flex: 1 }}>Cancel</button>
        <button type="button" onClick={confirm} disabled={saving} style={{ ...flowButton, flex: 2, border: 'none', background: '#15803D', color: '#fff' }}>{saving ? 'Saving…' : 'Confirm sign-off'}</button>
      </div>}>
      <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}>
        This confirms you have read and understood their current medical information. It comes round again in {REVIEW_INTERVAL_DAYS} days.
      </p>
      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 5 }}>Notes (optional)</span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything that changed, or who you checked with" style={{ ...flowInput, minHeight: 90, resize: 'vertical' }} />
      </label>
    </SessionSheet>
  )
}

function MedicalDetail({ row, reviews, onClose, onSignOff }) {
  const { child, flags, needsReview, review } = row
  const name = `${child.first_name} ${child.last_name}`
  const history = [...reviews].sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))
  const call = (label, who, phone, strong) => phone && (
    <a href={`tel:${phone.replace(/\s+/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 14px', borderRadius: 14, textDecoration: 'none',
      background: strong ? '#FEE2E2' : 'var(--surface2)', border: `1px solid ${strong ? '#FCA5A5' : 'var(--border)'}` }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: strong ? '#B91C1C' : 'var(--org-solid, var(--org-primary))', color: '#fff', flexShrink: 0 }}><Icon name="📞" /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: strong ? '#B91C1C' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 850, color: strong ? '#111827' : 'var(--text)' }}>{who || 'Not named'} · {phone}</span>
      </span>
    </a>
  )
  return (
    <SessionSheet title={name} subtitle={[child.group_name, needsReview ? 'Sign-off due' : review ? `Checked ${format(new Date(review.reviewed_at), 'd MMM yyyy')}` : null].filter(Boolean).join(' · ')} onClose={onClose} width={520}
      footer={<div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose} style={{ ...flowButton, flex: 1 }}>Close</button>
        <button type="button" onClick={onSignOff} style={{ ...flowButton, flex: 2, border: 'none', background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)' }}>{needsReview ? 'Sign off' : 'Re-confirm'}</button>
      </div>}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
        {call('Emergency contact', child.emergency_contact_name, child.emergency_contact_phone, true)}
        {call('Parent or carer', child.parent_name, child.parent_phone, false)}
        {!child.emergency_contact_phone && !child.parent_phone && <div style={{ fontSize: 13, color: 'var(--text3)' }}>No phone numbers on file.</div>}
      </div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {flags.map((f, i) => {
          const s = TIER_STYLE[f.tier]
          return (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', borderLeft: `4px solid ${s.ring}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 850, color: s.fg, background: s.bg, borderRadius: 8, padding: '3px 9px' }}><Icon name={FLAG_ICON[f.label] || '📝'} />{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{s.title}</span>
              </div>
              <div style={{ fontSize: 14, color: f.detail ? 'var(--text)' : 'var(--text3)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{f.detail || 'No further detail recorded.'}</div>
            </div>
          )
        })}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 850, color: 'var(--text2)' }}>Sign-off history</h3>
      {history.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>Not signed off yet.</div>
        : <div style={{ display: 'grid', gap: 8 }}>
          {history.map(r => (
            <div key={r.id} style={{ background: 'var(--surface2)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>
              <div style={{ fontWeight: 800, color: 'var(--text)' }}>{r.reviewed_by_name || 'Team member'}</div>
              <div style={{ color: 'var(--text3)' }}>{format(new Date(r.reviewed_at), 'd MMM yyyy, HH:mm')}</div>
              {r.notes && <div style={{ color: 'var(--text2)', marginTop: 4 }}>{r.notes}</div>}
            </div>
          ))}
        </div>}
    </SessionSheet>
  )
}

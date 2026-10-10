import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { RatingBadge, daysUntil } from './ra_shared'
import { SAFETY, SAFETY_META, safetyStateOf, summariseSafety, buildAttentionItems, activeOnly } from './ra_safety'
import { RA_CARD, RA_BUTTON } from './RAWorkspaceHeader'
import Icon from '../../lib/icons'

const STATUS = {
  ...SAFETY_META,
  ready: { ...SAFETY_META.ready, label: 'Up to date', icon: 'check', detail: 'Review and approval checks' },
  review: { ...SAFETY_META.review, label: 'Needs review', icon: 'clock', detail: 'Due soon or awaiting checks' },
  action: { ...SAFETY_META.action, label: 'Action needed', icon: 'risk', detail: 'Overdue or expired' },
  draft: { ...SAFETY_META.draft, label: 'Drafts', icon: 'edit', detail: 'Continue work in progress' },
}
const dateLabel = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'No date set'
const reviewLabel = a => {
  const date = a.next_review_date || a.review_date
  const days = daysUntil(date)
  return days == null ? 'No review date' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Review ${dateLabel(date)}`
}
const fmtSessionWhen = s => {
  const days = daysUntil(s.session_date)
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : dateLabel(s.session_date)
  return s.start_time ? `${label} · ${s.start_time.slice(0, 5)}` : label
}

function StatusTag({ assessment, outstanding, unknown }) {
  const meta = unknown ? { label: 'Checks unavailable', bg: 'var(--surface2)', text: 'var(--text3)' } : STATUS[safetyStateOf(assessment, { outstandingByAssessment: outstanding })]
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, fontSize: 10.5, fontWeight: 750, background: meta.bg, color: meta.text, lineHeight: 1.5 }}><span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />{meta.label}</span>
}

function SafetyStrip({ counts, unknown, onFilter }) {
  const mobile = useIsMobile()
  return <section aria-label="Assessment status" style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 22 }}>
    {[SAFETY.ACTION, SAFETY.REVIEW, SAFETY.READY, SAFETY.DRAFT].map(key => {
      const meta = STATUS[key]
      return <button type="button" key={key} onClick={() => onFilter(key)} disabled={unknown} aria-label={`${meta.label}: ${unknown ? 'unavailable' : counts[key]}. View assessments`} style={{ ...RA_CARD, ...RA_BUTTON, display: 'block', padding: mobile ? 14 : 18, textAlign: 'left', minWidth: 0, cursor: unknown ? 'default' : 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}><span style={{ color: 'var(--text2)', fontSize: 12 }}>{meta.label}</span><span style={{ color: meta.text, display: 'flex' }}><Icon name={meta.icon} size={18} /></span></span>
        <span style={{ display: 'block', color: 'var(--text)', fontSize: 29, fontWeight: 850, lineHeight: 1 }}>{unknown ? '—' : counts[key]}</span>
        <span style={{ display: 'block', fontSize: 10.5, lineHeight: 1.5, color: 'var(--text3)', fontWeight: 500, marginTop: 8 }}>{unknown ? 'Waiting for checks' : meta.detail}</span>
      </button>
    })}
  </section>
}

function NeedsAttention({ items, canEdit, canApprove, unknown, checking, onOpen, onCreateForSession, onReuseForSession }) {
  const reduced = useReducedMotion()
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const filtered = items.filter(i => filter === 'all' || i.severity === filter)
  const shown = showAll ? filtered : filtered.slice(0, 5)
  const urgent = items.filter(i => i.severity === 'action').length
  return <section aria-label="Needs attention" style={{ ...RA_CARD, padding: 20, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><Icon name="risk" size={19} style={{ color: urgent ? 'var(--danger-text)' : 'var(--ra-ink)' }} /><h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>Needs attention</h2><span style={{ marginLeft: 'auto', padding: '4px 9px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: urgent ? 'var(--danger-bg)' : 'var(--ra-tint)', color: urgent ? 'var(--danger-text)' : 'var(--ra-ink)' }}>{checking ? '—' : `${items.length}${unknown ? '+' : ''}`}</span></div>
    <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text3)', margin: '0 0 15px' }}>{checking ? 'Checking reviews, controls and upcoming activities…' : unknown ? 'Known follow-ups. Some checks are unavailable.' : urgent ? `${urgent} ${urgent === 1 ? 'priority needs' : 'priorities need'} a closer look. Start here.` : 'Keep reviews, controls and approvals moving.'}</p>
    {items.length > 0 && <div aria-label="Filter follow-ups" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
      {[['all', 'All', items.length], ['action', 'Priority', urgent], ['review', 'Review', items.length - urgent]].map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setShowAll(false) }} style={{ ...RA_BUTTON, padding: '7px 10px', fontSize: 11, color: filter === key ? 'var(--ra-ink)' : 'var(--text3)', background: filter === key ? 'var(--ra-tint)' : 'var(--surface)', borderColor: filter === key ? 'var(--ra-border)' : 'var(--border)' }}>{label}<span style={{ opacity: .7 }}>{count}</span></button>)}
    </div>}
    <div style={{ display: 'grid', gap: 10 }}>
      {shown.map((item, index) => {
        const urgentItem = item.severity === 'action'
        const action = !canEdit ? 'View assessment' : !canApprove && item.cta === 'Review & Approve' ? 'Review assessment' : item.cta
        return <motion.article key={item.id} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .2, delay: reduced ? 0 : Math.min(index * .04, .2) }} style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${urgentItem ? 'var(--danger-text)' : 'var(--warn-border)'}`, borderRadius: 12, padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, background: urgentItem ? 'var(--danger-bg)' : 'var(--warn-bg)', color: urgentItem ? 'var(--danger-text)' : 'var(--warn-text)' }}><Icon name={urgentItem ? 'risk' : 'edit'} size={16} /></span>
            <div style={{ minWidth: 0, flex: 1 }}><h3 style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', margin: 0, overflowWrap: 'anywhere' }}>{item.title}</h3><p style={{ fontSize: 11.5, lineHeight: 1.6, color: urgentItem ? 'var(--danger-text)' : 'var(--text3)', margin: '4px 0 0' }}>{item.detail}</p></div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 9 }}>
            {!item.assessment && canEdit && <button type="button" onClick={() => onReuseForSession(item.session)} style={{ ...RA_BUTTON, fontSize: 11 }}>Use previous</button>}
            {(item.assessment || canEdit) && <button type="button" onClick={() => item.assessment ? onOpen(item.assessment) : onCreateForSession(item.session)} style={{ ...RA_BUTTON, fontSize: 11, background: 'var(--ra-tint)', borderColor: 'var(--ra-border)', color: 'var(--ra-ink)' }}>{action}<Icon name="→" size={13} /></button>}
            {!item.assessment && !canEdit && <span style={{ color: 'var(--text3)', fontSize: 11 }}>Ask your team to add an assessment.</span>}
          </div>
        </motion.article>
      })}
      {!shown.length && <div style={{ padding: '23px 12px', borderRadius: 12, background: 'var(--surface2)', textAlign: 'center' }}>
        <Icon name={unknown || checking ? 'clock' : 'check'} size={26} style={{ color: 'var(--ra-ink)', marginBottom: 10 }} />
        <h3 style={{ color: 'var(--text)', fontSize: 14, margin: '0 0 7px' }}>{checking ? 'Checking your workspace' : unknown ? 'Checks are incomplete' : items.length ? 'No follow-ups in this filter' : 'No immediate follow-ups found'}</h3>
        <p style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{unknown || checking ? 'Refresh the workspace to get a complete picture.' : items.length ? 'Choose All to see your other actions.' : 'Keep an eye on drafts and the activities coming up.'}</p>
      </div>}
    </div>
    {filtered.length > 5 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} style={{ ...RA_BUTTON, width: '100%', marginTop: 12 }}>{showAll ? 'Show fewer' : `Show all ${filtered.length} follow-ups`}<Icon name="chevron" size={14} /></button>}
  </section>
}

function UpcomingActivities({ sessions, coverage, outstanding, handledSessionIds, canEdit, coverageUnknown, checksUnknown, sessionsUnknown, truncated, onOpen, onCreate, onReuse }) {
  const terms = useTerms()
  const [showAll, setShowAll] = useState(false)
  const upcoming = sessions.filter(s => !handledSessionIds.has(s.id))
  const shown = showAll ? upcoming : upcoming.slice(0, 5)
  return <section aria-label="Upcoming activity checks" style={{ ...RA_CARD, padding: 20, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Icon name="calendar" size={19} style={{ color: 'var(--ra-ink)' }} /><h2 style={{ margin: 0, color: 'var(--text)', fontSize: 17 }}>Coming up next</h2></div>
    <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text3)', margin: '0 0 16px' }}>Get assessments in place before the day arrives.</p>
    <div style={{ display: 'grid', gap: 10 }}>
      {shown.map(s => {
        const cover = coverage[s.id]
        const required = s.risk_assessment_required !== false
        return <article key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ra-ink)', fontSize: 11, fontWeight: 800, marginBottom: 7 }}><Icon name="calendar" size={14} />{fmtSessionWhen(s)}</div>
          <h3 style={{ margin: '0 0 5px', fontSize: 13, lineHeight: 1.5, color: 'var(--text)', overflowWrap: 'anywhere' }}>{s.title || terms.Session}</h3>
          {s.location && <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 10 }}><Icon name="location" size={12} />{s.location}</div>}
          {coverageUnknown ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>Assessment links unavailable</span> : cover ? <StatusTag assessment={cover} outstanding={outstanding} unknown={checksUnknown} /> : <span style={{ display: 'inline-block', background: required ? 'var(--warn-bg)' : 'var(--surface2)', color: required ? 'var(--warn-text)' : 'var(--text3)', fontSize: 10.5, fontWeight: 750, padding: '5px 8px', borderRadius: 7 }}>{required ? 'Assessment to add' : 'Assessment not required'}</span>}
          {!coverageUnknown && <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
            {cover ? <button type="button" onClick={() => onOpen(cover)} style={{ ...RA_BUTTON, fontSize: 11, width: '100%' }}>View assessment<Icon name="→" size={13} /></button> : required && canEdit && <><button type="button" onClick={() => onCreate(s)} style={{ ...RA_BUTTON, fontSize: 11, flex: 1, background: 'var(--ra-tint)', borderColor: 'var(--ra-border)', color: 'var(--ra-ink)' }}><Icon name="add" size={13} />Create</button><button type="button" onClick={() => onReuse(s)} style={{ ...RA_BUTTON, fontSize: 11, flex: 1 }}>Use previous</button></>}
          </div>}
        </article>
      })}
      {!shown.length && <p style={{ margin: 0, padding: '20px 12px', background: 'var(--surface2)', borderRadius: 12, color: 'var(--text3)', fontSize: 12, lineHeight: 1.7 }}>{sessionsUnknown ? 'Upcoming activities are unavailable.' : handledSessionIds.size ? 'Your upcoming activities are included in Needs attention.' : `No upcoming ${terms.sessions} to check.`}</p>}
    </div>
    {upcoming.length > 5 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} style={{ ...RA_BUTTON, width: '100%', marginTop: 12 }}>{showAll ? 'Show fewer' : `Show all ${upcoming.length} activities`}</button>}
    {truncated && <p style={{ color: 'var(--text3)', fontSize: 11, lineHeight: 1.6, margin: '13px 0 0' }}>Showing checks for the next 40 scheduled activities.</p>}
  </section>
}

function RecentAssessments({ assessments, staff, outstanding, unknown, unavailable, search, onSearch, onOpen, onBrowse }) {
  const mobile = useIsMobile(1050)
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...assessments].filter(a => !q || [a.name, a.location, a.activity_type].some(v => v?.toLowerCase().includes(q))).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))
  }, [assessments, search])
  const staffById = Object.fromEntries(staff.map(s => [s.id, s]))
  return <section aria-label="Find an assessment" style={{ ...RA_CARD, padding: 20, marginTop: 22 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 15 }}><div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>Find an assessment</h2><p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text3)' }}>Your most recently updated work.</p></div><button type="button" onClick={onBrowse} style={RA_BUTTON}>View all assessments<Icon name="→" size={14} /></button></div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 46, border: '1px solid var(--border)', borderRadius: 11, padding: '0 12px', color: 'var(--text3)', marginBottom: 14 }}><Icon name="search" size={17} /><input aria-label="Search recent assessments" value={search} onChange={e => onSearch(e.target.value)} placeholder="Search name, activity or location…" style={{ width: '100%', minWidth: 0, minHeight: 44, border: 0, background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, outlineOffset: 2 }} />{search && <button type="button" aria-label="Clear search" onClick={() => onSearch('')} style={{ ...RA_BUTTON, border: 0, padding: 8 }}><Icon name="close" size={15} /></button>}</label>
    {!rows.length ? <p style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>{unavailable ? 'Your assessment list is unavailable. Refresh to try again.' : search ? 'No assessments match. Try another name or location.' : 'No assessments yet. Start with a template or create your first one.'}</p> : <div style={{ display: 'grid', gap: 8 }}>
      {rows.slice(0, 6).map(a => <button type="button" key={a.id} onClick={() => onOpen(a)} style={{ ...RA_BUTTON, display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr) auto' : 'minmax(0,2fr) minmax(115px,1fr) 80px 110px 18px', gap: 12, padding: '14px 13px', width: '100%', textAlign: 'left', borderRadius: 12 }}>
        <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, fontWeight: 800, overflowWrap: 'anywhere' }}>{a.name}</span><span style={{ display: 'block', fontSize: 11, lineHeight: 1.5, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{a.location || a.activity_type || 'Activity to confirm'}{staffById[a.owner_id || a.created_by] ? ` · ${staffById[a.owner_id || a.created_by].full_name}` : ''}</span>{mobile && <span style={{ display: 'block', marginTop: 8 }}><StatusTag assessment={a} outstanding={outstanding} unknown={unknown} /><span style={{ display: 'block', fontSize: 10.5, marginTop: 6, color: 'var(--text3)' }}>{reviewLabel(a)}</span></span>}</span>
        {!mobile && <span><StatusTag assessment={a} outstanding={outstanding} unknown={unknown} /></span>}
        <span>{a.risk_rating ? <RatingBadge rating={a.risk_rating} size="sm" /> : <span style={{ color: 'var(--text3)', fontSize: 11 }}>Unrated</span>}</span>
        {!mobile && <><span style={{ fontSize: 11, color: daysUntil(a.next_review_date || a.review_date) < 0 ? 'var(--danger-text)' : 'var(--text3)' }}>{reviewLabel(a)}</span><Icon name="→" size={14} style={{ color: 'var(--ra-ink)' }} /></>}
      </button>)}
    </div>}
    {rows.length > 6 && <button type="button" onClick={onBrowse} style={{ ...RA_BUTTON, width: '100%', marginTop: 12 }}>See all {rows.length} {search ? 'matches' : 'assessments'}</button>}
  </section>
}

export default function RAOverview({ assessments = [], sessionsTruncated = false, sessions = [], coverage = {}, outstandingByAssessment = {}, staff = [], unavailable = [], checking = false, canEdit = false, canApprove = false, search = '', onSearch, onSafetyFilter, onBrowse, onOpen, onCreateForSession, onReuseForSession }) {
  const compact = useIsMobile(1100)
  const live = useMemo(() => activeOnly(assessments), [assessments])
  const counts = useMemo(() => summariseSafety(live, { outstandingByAssessment }), [live, outstandingByAssessment])
  const coverageUnknown = checking || unavailable.includes('assessments') || unavailable.includes('assessment links')
  const checksUnknown = checking || unavailable.includes('assessments') || unavailable.includes('controls')
  const attention = useMemo(() => buildAttentionItems({ assessments: live, sessions: coverageUnknown ? [] : sessions, coverage, outstandingByAssessment }), [live, sessions, coverage, outstandingByAssessment, coverageUnknown])
  const handledSessionIds = new Set(attention.filter(i => i.session).map(i => i.session.id))
  return <div>
    <SafetyStrip counts={counts} unknown={checksUnknown} onFilter={onSafetyFilter} />
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      <NeedsAttention items={attention} checking={checking} unknown={unavailable.length > 0} canEdit={canEdit} canApprove={canApprove} onOpen={onOpen} onCreateForSession={onCreateForSession} onReuseForSession={onReuseForSession} />
      <UpcomingActivities sessions={sessions} coverage={coverage} outstanding={outstandingByAssessment} handledSessionIds={handledSessionIds} canEdit={canEdit} coverageUnknown={coverageUnknown} checksUnknown={checksUnknown} sessionsUnknown={checking || unavailable.includes('upcoming activities')} truncated={sessionsTruncated} onOpen={onOpen} onCreate={onCreateForSession} onReuse={onReuseForSession} />
    </div>
    <RecentAssessments assessments={live} staff={staff} outstanding={outstandingByAssessment} unknown={checksUnknown} unavailable={unavailable.includes('assessments')} search={search} onSearch={onSearch} onOpen={onOpen} onBrowse={onBrowse} />
  </div>
}

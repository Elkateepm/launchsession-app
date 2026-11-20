import React, { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'
import { riskStateLabel } from '../../lib/riskMatch'
import { RA_STATUSES, RA_STATUS_LABELS, ACTIVITY_TYPES, ACTIVITY_ICON, RatingBadge, RiskMatrix, RiskGauge, riskScore, riskRating, daysUntil } from './ra_shared'
import { SAFETY_META } from './ra_safety'
import { assessmentProgress, ApprovalPanel } from './RAProgress'
import { RA_CARD, RA_BUTTON } from './RAWorkspaceHeader'
import RAHazards from './RAHazards'
import RAEmergencyPlan from './RAEmergencyPlan'
import RAAttachments from './RAAttachments'
import RALinkedSessions from './RALinkedSessions'
import { DynamicUpdateList } from './RALiveSafety'

// One assessment, on its own page.
//
// This used to sit in the middle of three columns -- the library list on the
// left, "Quick Actions" on the right -- under five KPI tiles and four filter
// boxes, with eight tabs that wrapped onto two rows. The question someone
// opening an assessment has is "what is left to do on this?", so the page now
// leads with that: where it stands, the steps, and the one thing to do next.

const TABS = [
  ['overview', 'Overview'],
  ['hazards', 'Hazards'],
  ['emergency', 'Emergency'],
  ['sessions', 'Sessions'],
  ['attachments', 'Files'],
  ['activity', 'Activity'],
]
// Progress steps point at the tab that finishes them.
const STEP_TAB = { overview: 'overview', hazards: 'hazards', controls: 'hazards', emergency: 'emergency', attachments: 'attachments', approval: 'overview' }

const fieldLabel = { fontSize: 12, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 5 }
const fieldInput = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }
const dateText = (d) => d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(d).slice(0, 10)}T12:00:00Z`)) : '—'

export default function RAWorkspace({
  assessment: a, hazards, outstanding = 0, attachmentCount = 0, staff = [], venues = [], org, authSession,
  canEdit, isManager, tab, onTab, liveRefresh,
  onBack, onLocal, onSave, onMarkReviewed, onDuplicate, onToggleArchive, onDownload,
  onAddHazard, onHazardsChanged, onDynamic, onEmergency, onApprovalChanged, history,
}) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const steps = assessmentProgress({ assessment: a, hazards, outstandingControls: outstanding, attachmentCount })
  const required = steps.filter(s => !s.optional)
  const doneCount = required.filter(s => s.done).length
  const nextStep = required.find(s => !s.done)
  // Outstanding controls count: an approved assessment whose controls are not
  // in place yet is not "ready to run".
  const ctx = { outstandingByAssessment: { [a.id]: outstanding } }
  const { state, label: stateLabel } = riskStateLabel(a, ctx)
  const meta = SAFETY_META[state] || SAFETY_META.draft
  const reviewDays = daysUntil(a.next_review_date || a.review_date)
  const reviewDue = reviewDays != null && reviewDays <= 14
  const staffName = (id) => staff.find(s => s.id === id)?.full_name || '—'
  const venue = a.venue_id ? venues.find(v => v.id === a.venue_id) : null
  // Judged after controls: before them, nearly every trip hazard is "high".
  const highHazards = hazards.filter(h => ['high', 'critical'].includes(riskRating(riskScore(h.residual_likelihood || h.likelihood, h.residual_severity || h.severity)))).length

  // The single most useful next action, so nobody has to work out where to go.
  const next = nextStep
    ? { label: `Next: ${nextStep.key === 'controls' ? 'put the controls in place' : nextStep.key === 'approval' ? 'get it signed off' : `add the ${nextStep.label.toLowerCase()}`}`, hint: nextStep.hint, go: () => onTab(STEP_TAB[nextStep.key] || 'overview') }
    : reviewDue && canEdit
      ? { label: 'Mark as reviewed', hint: reviewDays < 0 ? `Review was due ${Math.abs(reviewDays)} day${Math.abs(reviewDays) === 1 ? '' : 's'} ago` : `Review due ${dateText(a.next_review_date || a.review_date)}`, go: onMarkReviewed }
      : { label: 'Open the emergency view', hint: 'What to do and who to call, for the day itself', go: onEmergency }

  const tabCount = { hazards: hazards.length || null }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {/* Back, and the occasional actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={onBack} style={{ ...RA_BUTTON, background: 'transparent' }}><Icon name="←" />All assessments</button>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button type="button" onClick={onDownload} style={RA_BUTTON}><Icon name="export" />{isMobile ? 'PDF' : 'Download PDF'}</button>
          {canEdit && <button type="button" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} style={{ ...RA_BUTTON, width: 44, padding: 0 }}>•••</button>}
          {menuOpen && <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div role="menu" style={{ position: 'absolute', right: 0, top: 50, zIndex: 41, width: 220, padding: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 30px #0F172A20' }}>
              {[
                ['Duplicate', onDuplicate],
                ['Mark as reviewed', onMarkReviewed],
                [a.archived ? 'Restore from archive' : 'Archive', onToggleArchive],
              ].map(([label, fn]) => (
                <button key={label} role="menuitem" type="button" onClick={() => { setMenuOpen(false); fn() }} style={{ ...RA_BUTTON, width: '100%', border: 'none', justifyContent: 'flex-start' }}>{label}</button>
              ))}
            </div>
          </>}
        </div>
      </div>

      {/* Where it stands, and the next thing to do */}
      <section aria-label="Assessment status" style={{ ...RA_CARD, padding: isMobile ? 16 : 22, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--org-a10)', color: 'var(--ra-ink)', display: 'grid', placeItems: 'center', fontSize: 24, flexShrink: 0 }}><Icon name={ACTIVITY_ICON[a.activity_type] || '🛡️'} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="ra-name" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Assessment name</label>
            <input id="ra-name" value={a.name || ''} readOnly={!canEdit}
              onChange={e => onLocal({ name: e.target.value })} onBlur={e => canEdit && onSave({ name: e.target.value }, 'edited', 'Renamed')}
              style={{ fontSize: isMobile ? 19 : 22, fontWeight: 850, letterSpacing: -0.3, color: 'var(--text)', border: 'none', outline: 'none', width: '100%', minHeight: 44, background: 'transparent', padding: 0, fontFamily: 'inherit' }} />
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, overflowWrap: 'anywhere' }}>{[a.activity_type, venue?.name || a.location].filter(Boolean).join(' · ') || 'Add the activity and location'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 800, background: meta.bg, color: meta.text }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot }} />{stateLabel}
              </span>
              {a.risk_rating && <RatingBadge rating={a.risk_rating} />}
              {(a.next_review_date || a.review_date) && <span style={{ fontSize: 12, fontWeight: 700, color: reviewDays != null && reviewDays < 0 ? 'var(--danger-text)' : 'var(--text3)', padding: '4px 2px' }}>Review {reviewDays != null && reviewDays < 0 ? 'overdue' : dateText(a.next_review_date || a.review_date)}</span>}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{doneCount === required.length ? 'Complete' : `${doneCount} of ${required.length} done`}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ticks itself off as you go</span>
          </div>
          <div role="progressbar" aria-label="Assessment completeness" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={required.length} style={{ height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${(doneCount / required.length) * 100}%`, height: '100%', borderRadius: 99, background: doneCount === required.length ? 'var(--ok-text)' : 'var(--org-solid, var(--org-primary))', transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 4 : 0 }}>
            {steps.map(s => (
              <button key={s.key} type="button" title={s.hint} onClick={() => onTab(STEP_TAB[s.key] || 'overview')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 750, whiteSpace: 'nowrap', flexShrink: 0,
                  background: s.done ? 'var(--ok-bg)' : s.optional ? 'var(--surface2)' : 'var(--warn-bg)', color: s.done ? 'var(--ok-text)' : s.optional ? 'var(--text2)' : 'var(--warn-text)' }}>
                <span aria-hidden="true">{s.done ? '✓' : s.optional ? '○' : '!'}</span>{s.label}{s.optional && !s.done ? ' (optional)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* The next action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16, padding: 12, borderRadius: 14, background: 'var(--org-a05)', border: '1px solid var(--org-a20)' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{next.label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{next.hint}</div>
          </div>
          <button type="button" onClick={next.go} style={{ ...RA_BUTTON, border: 'none', background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)', padding: '0 18px', flex: isMobile ? '1 1 100%' : undefined }}>
            {nextStep ? 'Go' : next.label}<Icon name="→" />
          </button>
        </div>
      </section>

      {/* Sections */}
      <div role="tablist" aria-label="Assessment sections" style={{ display: 'flex', gap: 4, padding: 4, marginBottom: 14, borderRadius: 14, background: 'var(--surface2)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => onTab(key)}
            style={{ flex: isMobile ? '0 0 auto' : 1, minHeight: 44, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              background: tab === key ? 'var(--surface)' : 'transparent', color: tab === key ? 'var(--text)' : 'var(--text3)', boxShadow: tab === key ? '0 1px 3px #0F172A1f' : 'none' }}>
            {label}{tabCount[key] ? <span style={{ marginLeft: 6, color: 'var(--text3)', fontWeight: 700 }}>{tabCount[key]}</span> : null}
          </button>
        ))}
      </div>

      <section style={{ ...RA_CARD, padding: isMobile ? 16 : 22 }}>
        {tab === 'overview' && <>
          <ApprovalPanel assessment={a} org={org} authSession={authSession} staff={staff} isManager={isManager} onChanged={onApprovalChanged} ctx={ctx} />
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="ra-summary" style={fieldLabel}>What the activity is</label>
            <textarea id="ra-summary" value={a.summary || ''} readOnly={!canEdit} placeholder="Where you are going, what young people will do, group sizes…"
              onChange={e => onLocal({ summary: e.target.value })} onBlur={e => canEdit && onSave({ summary: e.target.value })}
              style={{ ...fieldInput, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label htmlFor="ra-activity" style={fieldLabel}>Activity type</label>
              <select id="ra-activity" value={a.activity_type || ''} disabled={!canEdit} onChange={e => onSave({ activity_type: e.target.value || null })} style={fieldInput}>
                <option value="">Choose…</option>
                {ACTIVITY_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ra-location" style={fieldLabel}>Location</label>
              <input id="ra-location" value={a.location || ''} readOnly={!canEdit} onChange={e => onLocal({ location: e.target.value })} onBlur={e => canEdit && onSave({ location: e.target.value })} style={fieldInput} />
            </div>
            <div>
              <label htmlFor="ra-review" style={fieldLabel}>Review by</label>
              <input id="ra-review" type="date" value={a.next_review_date || ''} disabled={!canEdit} onChange={e => onSave({ next_review_date: e.target.value || null, review_date: e.target.value || null })} style={fieldInput} />
            </div>
            <div>
              <label htmlFor="ra-reviewer" style={fieldLabel}>Reviewer</label>
              <select id="ra-reviewer" value={a.assigned_reviewer_id || ''} disabled={!canEdit} onChange={e => onSave({ assigned_reviewer_id: e.target.value || null })} style={fieldInput}>
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            {canEdit && <div>
              <label htmlFor="ra-status" style={fieldLabel}>Status</label>
              <select id="ra-status" value={a.status || 'draft'} onChange={e => onSave({ status: e.target.value }, 'edited', `Status → ${RA_STATUS_LABELS[e.target.value]}`)} style={fieldInput}>
                {RA_STATUSES.map(s => <option key={s} value={s}>{RA_STATUS_LABELS[s]}</option>)}
              </select>
            </div>}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: 16, borderRadius: 14, background: 'var(--surface2)' }}>
            <div style={{ textAlign: 'center' }}>
              <RiskGauge score={a.risk_score || 0} />
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginTop: -6 }}>Score {a.risk_score || 0} / 25</div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 5 }}>Overall rating</div>
              {a.risk_rating ? <RatingBadge rating={a.risk_rating} /> : <span style={{ fontSize: 13, color: 'var(--text3)' }}>Add hazards to work it out</span>}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{hazards.length} hazard{hazards.length === 1 ? '' : 's'}{highHazards ? ` · ${highHazards} still high after controls` : hazards.length ? ' · none high after controls' : ''}</div>
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 14px', fontSize: 12.5 }}>
              <dt style={{ color: 'var(--text3)' }}>Written by</dt><dd style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{staffName(a.created_by)}</dd>
              <dt style={{ color: 'var(--text3)' }}>Last reviewed</dt><dd style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{dateText(a.last_reviewed_at)}</dd>
            </dl>
          </div>
        </>}

        {tab === 'hazards' && <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>Hazards and controls</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>What could go wrong, who it affects, and what you do about it.</p>
            </div>
            {canEdit && <button type="button" onClick={onAddHazard} style={{ ...RA_BUTTON, border: 'none', background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)' }}><Icon name="add" />Add a hazard</button>}
          </div>
          {hazards.length > 0 && <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ra-ink)', minHeight: 44, display: 'flex', alignItems: 'center' }}>Show the risk matrix</summary>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}><RiskMatrix hazards={hazards} /></div>
          </details>}
          <RAHazards assessment={a} org={org} session={authSession} venues={venues} onHazardsChanged={onHazardsChanged} />
        </>}

        {tab === 'emergency' && <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>Emergency plan</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>Shown on the session card and the register, one tap away on the day.</p>
            </div>
            <button type="button" onClick={onEmergency} style={RA_BUTTON}>Preview emergency view</button>
          </div>
          <RAEmergencyPlan assessment={a} org={org} venues={venues} />
        </>}

        {tab === 'sessions' && <RALinkedSessions assessment={a} org={org} session={authSession} />}
        {tab === 'attachments' && <RAAttachments assessment={a} org={org} session={authSession} />}

        {tab === 'activity' && <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>On the day</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>Record a change to the plan as it happens: weather, a closed route, a new risk.</p>
            </div>
            {canEdit && <button type="button" onClick={onDynamic} style={RA_BUTTON}><Icon name="add" />Record an update</button>}
          </div>
          <DynamicUpdateList assessment={a} org={org} staff={staff} refreshKey={liveRefresh} />
          <h2 style={{ margin: '22px 0 10px', fontSize: 15, color: 'var(--text)' }}>History</h2>
          {history}
        </>}
      </section>
    </div>
  )
}

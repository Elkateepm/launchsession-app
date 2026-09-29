import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ACTIVITY_ICON, RatingBadge, timeAgo, daysUntil } from './ra_shared'
import { SAFETY, SAFETY_META, safetyStateOf, summariseSafety, buildAttentionItems, activeOnly } from './ra_safety'
import Icon from '../../lib/icons'

// The operational overview. Ordered by urgency rather than by data model: what
// needs doing, what is coming up, then the library. A manager should be able to
// read the organisation's safety position without scrolling or clicking.

const CARD = {
  background: 'var(--surface)',
  border: '1px solid #ECE9F5',
  borderRadius: 16,
}

const fmtSessionWhen = s => {
  const days = daysUntil(s.session_date)
  const time = (s.start_time || '').slice(0, 5)
  const label =
    days === 0 ? 'Today' :
    days === 1 ? 'Tomorrow' :
    days !== null && days < 7
      ? new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'long' })
      : new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return time ? `${label} · ${time}` : label
}

function SafetyStrip({ counts, activeFilter, onFilter }) {
  const isMobile = useIsMobile()
  const order = [SAFETY.READY, SAFETY.REVIEW, SAFETY.ACTION, SAFETY.DRAFT]

  return (
    <div style={{ ...CARD, padding: isMobile ? 12 : 14, marginBottom: 14 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: 'var(--text3)',
        letterSpacing: 0.3, marginBottom: 10,
      }}>SAFETY OVERVIEW</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {order.map(key => {
          const meta = SAFETY_META[key]
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => onFilter(active ? null : key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'inherit', minWidth: 0,
                border: `1px solid ${active ? meta.dot : 'var(--border)'}`,
                background: active ? meta.bg : 'var(--surface)',
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: 9, background: meta.dot, flexShrink: 0,
              }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1.1 }}>
                  {counts[key]}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text3)', display: 'block', marginTop: 1 }}>
                  {meta.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NeedsAttention({ items, onOpen, onCreateForSession, onReuseForSession, primary, truncated }) {
  const isMobile = useIsMobile()
  const [showAll, setShowAll] = React.useState(false)
  const VISIBLE = 6
  const shown = showAll ? items : items.slice(0, VISIBLE)

  if (!items.length) {
    return (
      <div style={{ ...CARD, padding: '26px 20px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}><Icon name="✅" /></div>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
          Everything is ready
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text3)' }}>
          {truncated
            ? 'No outstanding actions across your next 40 scheduled activities.'
            : 'There are no outstanding risk assessment actions.'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...CARD, marginBottom: 14, overflow: 'hidden' }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid #ECE9F5',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>Needs attention</span>
        <span style={{
          padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
          background: 'var(--danger-bg)', color: 'var(--danger-text)',
        }}>{items.length}</span>
      </div>

      <div>
        {shown.map((item, i) => {
          const tone = item.severity === 'action'
            ? { dot: 'var(--danger-text)', bg: 'var(--danger-bg)' }
            : { dot: '#F79009', bg: 'var(--warn-bg)' }

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderBottom: i < shown.length - 1 ? '1px solid #F5F3FA' : 'none',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: 8, background: tone.dot, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{item.detail}</div>
              </div>
              <div style={{
                display: 'flex', gap: 8, flexShrink: 0,
                width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0,
              }}>
                {!item.assessment && item.session && onReuseForSession && (
                  <button
                    onClick={() => onReuseForSession(item.session)}
                    style={{
                      padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5,
                      fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      flex: isMobile ? 1 : 'none', whiteSpace: 'nowrap',
                    }}
                  >Reuse</button>
                )}
                <button
                  onClick={() => item.assessment ? onOpen(item.assessment) : onCreateForSession(item.session)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none',
                    background: primary, color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    flex: isMobile ? 1 : 'none',
                  }}
                >{item.cta}</button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {items.length > VISIBLE && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            display: 'block', width: '100%', padding: '11px 16px', border: 'none',
            borderTop: '1px solid #F5F3FA', background: 'var(--surface)',
            color: 'var(--text2)', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >{showAll ? 'Show less' : `Show ${items.length - VISIBLE} more`}</button>
      )}
    </div>
  )
}

function UpcomingActivities({ sessions, coverage, outstandingByAssessment = {}, handledSessionIds, onOpen, primary }) {
  const isMobile = useIsMobile()
  const upcoming = sessions
    .filter(s => !handledSessionIds.has(s.id))
    .slice(0, isMobile ? 4 : 6)

  if (!upcoming.length) return null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
        Also coming up
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
        gap: 10,
      }}>
        {upcoming.map(s => {
          const cover = coverage[s.id]
          const state = cover ? safetyStateOf(cover, { outstandingByAssessment }) : null
          const meta = state ? SAFETY_META[state] : { dot: 'var(--danger-text)', bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: 'No risk assessment' }

          return (
            <div key={s.id} style={{ ...CARD, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 15 }}>{ACTIVITY_ICON[s.session_type] || '📋'}</span>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: 'var(--text)', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title || 'Session'}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{fmtSessionWhen(s)}</div>
              {s.location && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}><Icon name="📍" /> {s.location}</div>
              )}

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 999, marginTop: 11,
                background: meta.bg, color: meta.text,
                fontSize: 12, fontWeight: 700,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, background: meta.dot }} />
                {cover ? meta.label : 'No risk assessment'}
              </div>

              {cover && (
                <button
                  onClick={() => onOpen(cover)}
                  style={{
                    display: 'block', width: '100%', marginTop: 11,
                    padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >View assessment</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentAssessments({ assessments, onOpen, staffById, outstandingByAssessment = {} }) {
  const isMobile = useIsMobile()
  const rows = assessments.slice(0, 8)

  if (!rows.length) return null

  return (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
        Recent assessments
      </div>

      {isMobile ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(a => {
            const state = safetyStateOf(a, { outstandingByAssessment })
            const meta = SAFETY_META[state]
            return (
              <button key={a.id} onClick={() => onOpen(a)} style={{
                ...CARD, padding: 13, textAlign: 'left', cursor: 'pointer',
                fontFamily: 'inherit', width: '100%',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 16 }}>{ACTIVITY_ICON[a.activity_type] || '📋'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {a.location || a.activity_type || '—'}
                    </div>
                  </div>
                  <span style={{
                    width: 8, height: 8, borderRadius: 8, background: meta.dot, flexShrink: 0,
                  }} />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Assessment', 'Activity', 'Risk', 'Status', 'Owner', 'Next review', 'Updated'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 700,
                    color: 'var(--text3)', letterSpacing: 0.3, borderBottom: '1px solid #ECE9F5',
                    whiteSpace: 'nowrap',
                  }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(a => {
                const state = safetyStateOf(a, { outstandingByAssessment })
                const meta = SAFETY_META[state]
                const review = a.next_review_date || a.review_date
                const days = daysUntil(review)
                return (
                  <tr
                    key={a.id}
                    onClick={() => onOpen(a)}
                    style={{ borderBottom: '1px solid #F5F3FA', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text)' }}>
                      <span style={{ marginRight: 7 }}>{ACTIVITY_ICON[a.activity_type] || '📋'}</span>
                      {a.name}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text3)' }}>
                      {a.location || a.activity_type || '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <RatingBadge rating={a.risk_rating || 'low'} size="sm" />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                        background: meta.bg, color: meta.text, whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: 6, background: meta.dot }} />
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {staffById[a.owner_id]?.full_name || staffById[a.created_by]?.full_name || '—'}
                    </td>
                    <td style={{
                      padding: '11px 14px', whiteSpace: 'nowrap',
                      color: days !== null && days < 0 ? 'var(--danger-text)' : 'var(--text3)',
                      fontWeight: days !== null && days < 0 ? 700 : 400,
                    }}>
                      {review
                        ? (days !== null && days < 0
                            ? `Overdue ${Math.abs(days)}d`
                            : new Date(review).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
                        : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {timeAgo(a.updated_at || a.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RAOverview({
  assessments = [],
  sessionsTruncated = false,
  sessions = [],
  coverage = {},
  outstandingByAssessment = {},
  staff = [],
  primary = '#7C5CFC',
  safetyFilter,
  onSafetyFilter,
  onOpen,
  onCreateForSession,
  onReuseForSession,
}) {
  // Archived work is history, not part of the live safety picture.
  const live = useMemo(() => activeOnly(assessments), [assessments])
  const counts = useMemo(
    () => summariseSafety(live, { outstandingByAssessment }),
    [live, outstandingByAssessment]
  )

  const attention = useMemo(
    () => buildAttentionItems({ assessments: live, sessions, coverage, outstandingByAssessment }),
    [live, sessions, coverage, outstandingByAssessment]
  )

  // Sessions the attention list already accounts for. Listing them again below
  // with the same button was the screen's main duplication.
  const handledSessionIds = useMemo(
    () => new Set(attention.filter(i => i.session).map(i => i.session.id)),
    [attention]
  )

  const staffById = useMemo(
    () => Object.fromEntries(staff.map(s => [s.id, s])),
    [staff]
  )

  const filtered = useMemo(() => {
    if (!safetyFilter) return live
    return live.filter(a => safetyStateOf(a, { outstandingByAssessment }) === safetyFilter)
  }, [live, safetyFilter, outstandingByAssessment])

  return (
    <div>
      <SafetyStrip counts={counts} activeFilter={safetyFilter} onFilter={onSafetyFilter} />

      <NeedsAttention
        items={attention}
        onOpen={onOpen}
        onCreateForSession={onCreateForSession}
        onReuseForSession={onReuseForSession}
        primary={primary}
        truncated={sessionsTruncated}
      />

      <UpcomingActivities
        sessions={sessions}
        coverage={coverage}
        outstandingByAssessment={outstandingByAssessment}
        handledSessionIds={handledSessionIds}
        onOpen={onOpen}
        primary={primary}
      />

      <RecentAssessments
        assessments={filtered}
        onOpen={onOpen}
        staffById={staffById}
        outstandingByAssessment={outstandingByAssessment}
      />
    </div>
  )
}

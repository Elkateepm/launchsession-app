import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { areaByKey } from './impact_shared'
import { MOVEMENT_THRESHOLD, STALE_DAYS } from './distanceTravelled'
import Icon from '../../lib/icons'

// Shared surface. One card treatment across the page rather than the four the
// previous version had.
export const card = {
  background: '#fff', border: '1px solid #EEF0F2', borderRadius: 20,
  padding: '20px 22px', boxSizing: 'border-box', minWidth: 0,
}

export const sectionTitle = { fontSize: 14, fontWeight: 900, color: '#0F172A' }
export const sectionHint = { fontSize: 12, color: '#94A3B8', marginTop: 2, lineHeight: 1.45 }

const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED = '#DC2626'
const GREY = '#CBD5E1'

export const directionColor = (d) => d === 'improved' ? GREEN : d === 'declined' ? RED : AMBER

/** "+2.1" / "-0.8" / "0.0" — a signed change always reads as a change. */
export const signed = (n, dp = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(dp)}`

// ---------------------------------------------------------------------------
// Headline — the one thing the page exists to say
// ---------------------------------------------------------------------------
export function Headline({ impact, terms, periodLabel, isMobile }) {
  const { improved, held, declined, measured, tracked, roster, avgDelta } = impact.totals
  const unmeasured = Math.max(0, tracked - measured)

  const segments = [
    { key: 'improved', n: improved, color: GREEN, label: 'improved' },
    { key: 'held', n: held, color: AMBER, label: 'held steady' },
    { key: 'declined', n: declined, color: RED, label: 'declined' },
    { key: 'unmeasured', n: unmeasured, color: GREY, label: 'one reading only' },
  ].filter(s => s.n > 0)
  const barTotal = segments.reduce((s, x) => s + x.n, 0)

  if (measured === 0) {
    return (
      <div style={{ ...card, padding: isMobile ? '22px 18px' : '26px 24px' }}>
        <div style={sectionTitle}>Nothing has been measured yet {periodLabel}</div>
        <div style={{ ...sectionHint, maxWidth: 560 }}>
          Distance travelled needs at least two readings for the same {terms.person} in
          the same area — a first score is a starting point, not a result.
          {tracked > 0 && ` ${tracked} ${tracked === 1 ? `${terms.person} has` : `${terms.people} have`} one reading so far.`}
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...card, padding: isMobile ? '22px 18px' : '26px 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: '#0F172A', letterSpacing: -0.6, lineHeight: 1.15 }}>
            {improved} of {measured}{' '}
            <span style={{ color: '#64748B', fontWeight: 800 }}>
              {measured === 1 ? terms.person : terms.people} improved
            </span>
          </div>
          <div style={{ ...sectionHint, marginTop: 6 }}>
            {periodLabel} · measured on {measured} of the {roster} {terms.people} on your register
            {unmeasured > 0 && `, with ${unmeasured} more holding a single reading`}
          </div>
        </div>
        {avgDelta !== null && (
          <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0 }}>
            <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, letterSpacing: -0.6, color: directionColor(avgDelta >= MOVEMENT_THRESHOLD ? 'improved' : avgDelta <= -MOVEMENT_THRESHOLD ? 'declined' : 'held') }}>
              {signed(avgDelta)}
            </div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>average change, out of 10</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', marginTop: 18, background: '#F1F5F9' }}>
        {segments.map(s => (
          <motion.div key={s.key} initial={{ width: 0 }} animate={{ width: `${(s.n / barTotal) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            title={`${s.n} ${s.label}`} style={{ background: s.color }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 18, marginTop: 12 }}>
        {segments.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', fontWeight: 700 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, flexShrink: 0 }} />
            {s.n} {s.label}
          </span>
        ))}
      </div>

      {/* Said plainly rather than buried in a tooltip: the threshold is a
          judgement call and the reader is entitled to know what it was. */}
      <div style={{ ...sectionHint, marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
        A move of less than {MOVEMENT_THRESHOLD} of a point counts as holding steady — on a
        subjective 1–10 rating taken by different staff on different days, anything
        smaller is noise rather than evidence.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AreaMovement — baseline to latest, per outcome area
// ---------------------------------------------------------------------------
// Replaces the radar wheel, the heatmap and the fourteen category cards, which
// were three drawings of one number: the mean score per area. A dumbbell shows
// the thing those could not -- where each area started and where it got to.
export function AreaMovement({ impact, isMobile, onSelectArea, activeArea }) {
  if (impact.areas.length === 0) return null

  return (
    <div style={card}>
      <div style={sectionTitle}>Where the movement is</div>
      <div style={sectionHint}>Each bar runs from the average starting score to where it stands now.</div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {impact.areas.map((a, i) => {
          const meta = areaByKey(a.area)
          const isActive = activeArea === a.area
          const dir = a.delta >= MOVEMENT_THRESHOLD ? 'improved' : a.delta <= -MOVEMENT_THRESHOLD ? 'declined' : 'held'
          const colour = directionColor(dir)
          const left = Math.min(a.baseline, a.latest) / 10 * 100
          const width = Math.abs(a.latest - a.baseline) / 10 * 100

          return (
            <motion.button
              key={a.area}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
              onClick={() => onSelectArea(isActive ? null : a.area)}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '132px 1fr 58px',
                alignItems: 'center', gap: isMobile ? 6 : 14,
                background: isActive ? 'var(--org-a05)' : 'transparent',
                border: 'none', borderRadius: 12, padding: isMobile ? '10px 8px' : '9px 8px',
                cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
                minHeight: 44,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, flexShrink: 0 }}>{a.people}</span>
              </span>

              <span style={{ position: 'relative', height: 22, display: 'block' }}>
                <span style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 2, background: '#F1F5F9', borderRadius: 99 }} />
                <motion.span
                  initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.6, delay: 0.1 }}
                  style={{ position: 'absolute', top: 9.5, left: `${left}%`, height: 3, background: colour, borderRadius: 99 }} />
                {/* Hollow = where they started, filled = where they are. */}
                <span style={{ position: 'absolute', top: 5, left: `calc(${a.baseline / 10 * 100}% - 6px)`, width: 12, height: 12, borderRadius: 99, background: '#fff', border: `2px solid ${GREY}`, boxSizing: 'border-box' }} />
                <span style={{ position: 'absolute', top: 5, left: `calc(${a.latest / 10 * 100}% - 6px)`, width: 12, height: 12, borderRadius: 99, background: colour, boxSizing: 'border-box' }} />
              </span>

              <span style={{ fontSize: 13, fontWeight: 900, color: colour, textAlign: isMobile ? 'left' : 'right' }}>
                {signed(a.delta)}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: '#fff', border: `2px solid ${GREY}`, boxSizing: 'border-box' }} /> started at
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: '#64748B' }} /> now
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GoalsPanel — the one outcome here that is not a subjective rating
// ---------------------------------------------------------------------------
// goals was already being fetched on every load and passed only into a text
// card. A completed goal is the most concrete thing this module can show, so it
// gets shown.
export function GoalsPanel({ goals, childName, periodLabel }) {
  const stats = [
    { label: 'completed', value: goals.completed, color: GREEN },
    { label: 'in progress', value: goals.active, color: '#64748B' },
    { label: 'past target date', value: goals.overdue, color: goals.overdue > 0 ? RED : '#64748B' },
  ]

  return (
    <div style={card}>
      <div style={sectionTitle}>Goals</div>
      <div style={sectionHint}>Agreed with a {childName}, and either met or not — no rating involved.</div>

      <div style={{ display: 'flex', gap: 22, marginTop: 16, flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {goals.recent.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.3, marginBottom: 8 }}>
            MET {periodLabel.toUpperCase()}
          </div>
          {goals.recent.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
              <span style={{ color: GREEN, flexShrink: 0, display: 'inline-flex' }}><Icon name="✓" /></span>
              <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
              {g.completed_at && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#CBD5E1', fontWeight: 700, flexShrink: 0 }}>
                  {format(new Date(g.completed_at), 'd MMM')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NeedsAttention — the actionable half
// ---------------------------------------------------------------------------
export function NeedsAttention({ impact, childName, nameFor, onOpenChild, terms }) {
  const declined = impact.people.filter(p => p.direction === 'declined')
  const quiet = impact.goneQuiet

  if (declined.length === 0 && quiet.length === 0) return null

  const Row = ({ id, primaryText, secondaryText, tone }) => (
    <button onClick={() => onOpenChild(id)} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 44,
      background: 'none', border: 'none', borderRadius: 10, padding: '8px 6px',
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: tone, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryText}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#94A3B8', fontWeight: 700, flexShrink: 0 }}>{secondaryText}</span>
    </button>
  )

  return (
    <div style={card}>
      <div style={sectionTitle}>Worth a look</div>
      <div style={sectionHint}>Scores that fell, and {terms.people} nobody has rated in a while.</div>

      {declined.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.3, marginBottom: 4 }}>SCORES FELL</div>
          {declined.slice(0, 6).map(p => (
            <Row key={p.childId} id={p.childId} tone={RED}
              primaryText={nameFor(p.childId)}
              secondaryText={`${signed(p.delta)} across ${p.areas} area${p.areas !== 1 ? 's' : ''}`} />
          ))}
        </div>
      )}

      {quiet.length > 0 && (
        <div style={{ marginTop: declined.length > 0 ? 14 : 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.3, marginBottom: 4 }}>
            NO READING IN {STALE_DAYS} DAYS
          </div>
          {quiet.slice(0, 6).map(q => (
            <Row key={q.childId} id={q.childId} tone={GREY}
              primaryText={nameFor(q.childId)}
              secondaryText={`last ${format(new Date(q.lastReadingAt), 'd MMM yyyy')}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GroupComparison — which programme actually moved people
// ---------------------------------------------------------------------------
// The old ProgrammePerformance had the right question and the wrong measure: it
// compared groups on the mean of all their readings, which mostly reflects who
// each group takes on rather than what it achieved. Comparing distance
// travelled answers the question that was being asked.
export function GroupComparison({ impact, children, isMobile }) {
  const rows = useMemo(() => {
    const groupOf = new Map(children.map(c => [c.id, (c.group_name || '').trim()]))
    const byGroup = new Map()
    for (const p of impact.people) {
      const g = groupOf.get(p.childId)
      if (!g) continue
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g).push(p)
    }
    return [...byGroup.entries()]
      .map(([name, list]) => ({
        name,
        people: list.length,
        delta: list.reduce((s, p) => s + p.delta, 0) / list.length,
        improved: list.filter(p => p.direction === 'improved').length,
      }))
      .sort((a, b) => b.delta - a.delta)
  }, [impact.people, children])

  // One group is not a comparison, and a group of one is not evidence.
  const usable = rows.filter(r => r.people >= 2)
  if (usable.length < 2) return null

  const max = Math.max(...usable.map(r => Math.abs(r.delta)), 1)

  return (
    <div style={card}>
      <div style={sectionTitle}>By group</div>
      <div style={sectionHint}>Average distance travelled, for groups with at least two measured.</div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {usable.map(r => {
          const dir = r.delta >= MOVEMENT_THRESHOLD ? 'improved' : r.delta <= -MOVEMENT_THRESHOLD ? 'declined' : 'held'
          const colour = directionColor(dir)
          return (
            <div key={r.name} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 1fr 52px', alignItems: 'center', gap: isMobile ? 4 : 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700 }}>{r.improved} of {r.people} improved</div>
              </div>
              <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.delta) / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', background: colour, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: colour, textAlign: isMobile ? 'left' : 'right' }}>{signed(r.delta)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PeopleList
// ---------------------------------------------------------------------------
export function PeopleList({ impact, children, terms, primary, onOpenChild, areaFilter, isMobile }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('movement')

  const byId = useMemo(() => new Map(impact.people.map(p => [p.childId, p])), [impact.people])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = children.map(c => ({ child: c, m: byId.get(c.id) || null }))
    if (q) list = list.filter(r => `${r.child.first_name} ${r.child.last_name}`.toLowerCase().includes(q))
    if (areaFilter) {
      list = list.filter(r => r.m && r.m.pairs.some(p => p.area === areaFilter))
    }
    const dir = (r) => r.m ? r.m.delta : null
    if (sort === 'movement') {
      list.sort((a, b) => (dir(b) ?? -Infinity) - (dir(a) ?? -Infinity))
    } else if (sort === 'concern') {
      list.sort((a, b) => (dir(a) ?? Infinity) - (dir(b) ?? Infinity))
    } else {
      list.sort((a, b) => `${a.child.first_name} ${a.child.last_name}`.localeCompare(`${b.child.first_name} ${b.child.last_name}`))
    }
    return list
  }, [children, byId, search, sort, areaFilter])

  const SORTS = [
    { key: 'movement', label: 'Most improved' },
    { key: 'concern', label: 'Needs attention' },
    { key: 'name', label: 'Name' },
  ]

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={sectionTitle}>Everyone</div>
          <div style={sectionHint}>{rows.length} {rows.length === 1 ? terms.person : terms.people}{areaFilter ? ` with a ${areaByKey(areaFilter).label.toLowerCase()} reading` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 3, background: '#F8FAFC', borderRadius: 10, padding: 3, flexWrap: 'wrap' }}>
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none', minHeight: 36,
              background: sort === s.key ? '#fff' : 'transparent',
              boxShadow: sort === s.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              color: sort === s.key ? primary : '#94A3B8',
              fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder={`Search ${terms.people}...`}
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: 14, minHeight: 44,
          padding: '11px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0',
          fontSize: 14, fontFamily: 'inherit', outline: 'none',
        }} />

      <div style={{ marginTop: 12 }}>
        {rows.length === 0 && (
          <div style={{ padding: '26px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>
            Nobody matches.
          </div>
        )}
        {rows.map(({ child, m }) => (
          <button key={child.id} onClick={() => onOpenChild(child.id)} style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr auto' : '1fr 128px 64px',
            alignItems: 'center', gap: 12, width: '100%', minHeight: 52,
            background: 'none', border: 'none', borderBottom: '1px solid #F5F7FA',
            padding: '10px 4px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10, background: 'var(--org-a10)', color: primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, flexShrink: 0,
              }}>{child.first_name?.[0]}{child.last_name?.[0]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {child.first_name} {child.last_name}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                  {m ? `${m.areas} area${m.areas !== 1 ? 's' : ''} measured` : 'not measured yet'}
                </span>
              </span>
            </span>

            {!isMobile && (
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
                {m ? <>{m.baseline.toFixed(1)} <Icon name="→" /> <span style={{ color: '#334155', fontWeight: 800 }}>{m.latest.toFixed(1)}</span></> : '—'}
              </span>
            )}

            <span style={{
              fontSize: 13, fontWeight: 900, textAlign: 'right',
              color: m ? directionColor(m.direction) : '#CBD5E1',
            }}>{m ? signed(m.delta) : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

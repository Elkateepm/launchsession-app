import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { areaByKey } from './impact_shared'
import { STALE_DAYS, FOLLOW_UP_DAYS } from './distanceTravelled'
import Icon from '../../lib/icons'

// The recording side of Impact & Outcomes. The figures -- how many improved,
// movement by area, group comparisons, funder reports -- live in Reports, which
// reads the same scores for any period. This page is where the scores come
// from: who needs a reading, who has never had one, and a quick way to record.

export const card = {
  background: 'var(--surface)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 20,
  padding: '18px 20px', boxSizing: 'border-box', minWidth: 0,
}
export const sectionTitle = { fontSize: 15, fontWeight: 900, color: 'var(--text)' }
export const sectionHint = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }

const TONES = {
  fell: { bg: 'var(--danger-bg)', text: 'var(--danger-text)' },
  follow_up: { bg: 'var(--warn-bg)', text: 'var(--warn-text)' },
  quiet: { bg: 'var(--surface2)', text: 'var(--text3)' },
  goal: { bg: 'var(--violet-bg, var(--surface2))', text: 'var(--violet-text, var(--text2))' },
  measured: { bg: 'var(--ok-bg)', text: 'var(--ok-text)' },
}

/** "+2.1" / "−0.8" / "0.0": a signed change always reads as a change. */
export const signed = (n, dp = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(dp)}`
const day = iso => format(new Date(iso), 'd MMM yyyy')
const areaList = areas => areas.map(a => areaByKey(a).label.toLowerCase()).join(', ')

function Pill({ tone, children }) {
  const t = TONES[tone] || TONES.quiet
  return <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: t.bg, color: t.text, whiteSpace: 'nowrap' }}>{children}</span>
}

function RecordButton({ onClick, primary, label = 'Record' }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 40, minWidth: 44, padding: '0 14px', borderRadius: 11, border: `1.5px solid ${primary}`,
      background: 'var(--surface)', color: 'var(--org-ink)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    }}>{label}</button>
  )
}

// One person on a list: the name opens their record, the button records for
// them straight away. Two buttons side by side, never one inside the other.
function PersonRow({ name, detail, tone, pill, onOpen, onRecord, primary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <button onClick={onOpen} style={{ flex: 1, minWidth: 0, minHeight: 48, display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, background: 'var(--org-a10)', color: 'var(--org-ink)' }}>
          {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>{detail}</span>
        </span>
      </button>
      {pill && <Pill tone={tone}>{pill}</Pill>}
      {onRecord && <RecordButton onClick={onRecord} primary={primary} />}
    </div>
  )
}

/**
 * What to record next. Each person appears once, under the most pressing
 * reason. Empty lists are left out, and a page with nothing due says so.
 */
export function ToDo({ work, nameFor, onOpenChild, onRecord, terms, primary, isMobile }) {
  const [open, setOpen] = useState({})
  const groups = [
    { key: 'fell', title: 'Scores fell', hint: 'Their latest reading is lower than where they started. Worth a conversation.',
      items: work.fell.map(f => ({ id: f.childId, detail: `${signed(f.delta)} across ${f.areas} area${f.areas === 1 ? '' : 's'}` })) },
    { key: 'follow_up', title: 'Due a follow-up reading', hint: `A starting score from ${FOLLOW_UP_DAYS / 7}+ weeks ago with nothing since. A second reading is what shows progress.`,
      items: work.followUp.map(f => ({ id: f.childId, detail: `${areaList(f.areas)} · since ${day(f.since)}` })) },
    { key: 'quiet', title: `No reading in ${STALE_DAYS} days`, hint: 'Their last score is too old to describe them now.',
      items: work.quiet.map(q => ({ id: q.childId, detail: `last reading ${day(q.lastReadingAt)}` })) },
    { key: 'goal', title: 'Goals past their target date', hint: 'Open the person to update progress or mark a goal met.',
      items: work.overdueGoals.map(g => ({ id: g.child_id, key: g.id, detail: `${g.title || 'Goal'} · due ${day(g.target_date)}`, goal: true })) },
  ].filter(g => g.items.length)

  if (!groups.length) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--ok-bg)', color: 'var(--ok-text)', fontSize: 18, flexShrink: 0 }}><Icon name="✓" /></span>
        <div>
          <div style={sectionTitle}>Nothing due</div>
          <div style={sectionHint}>No follow-ups waiting, no scores that fell and no overdue goals.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile || groups.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
      {groups.map(g => {
        const shown = open[g.key] ? g.items : g.items.slice(0, 4)
        return (
          <section key={g.key} style={card} aria-label={g.title}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>{g.title}</h3>
              <Pill tone={g.key}>{g.items.length}</Pill>
            </div>
            <div style={{ ...sectionHint, marginBottom: 6 }}>{g.hint}</div>
            {shown.map(item => (
              <PersonRow key={item.key || item.id} name={nameFor(item.id)} detail={item.detail} primary={primary}
                onOpen={() => onOpenChild(item.id, item.goal ? 'goals' : undefined)} onRecord={onRecord && !item.goal ? () => onRecord(item.id) : null} />
            ))}
            {g.items.length > 4 && (
              <button onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))} style={{ marginTop: 6, minHeight: 40, background: 'none', border: 'none', color: 'var(--org-ink)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '0 2px' }}>
                {open[g.key] ? 'Show fewer' : `Show all ${g.items.length}`}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}

/**
 * Where the figures went. One line of what the scores add up to, so the page
 * still answers "is it working?", and the way into the full report.
 */
export function ReportsLink({ totals, terms, onOpenReport, onOpenReports }) {
  const facts = [
    `${totals.measured} ${totals.measured === 1 ? terms.person : terms.people} measured twice or more`,
    totals.measured ? `${totals.improved} improved` : null,
    `${totals.activeGoals} goal${totals.activeGoals === 1 ? '' : 's'} in progress`,
  ].filter(Boolean)
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(120deg, var(--org-a10), var(--surface) 70%)' }}>
      <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'var(--surface)', color: 'var(--org-ink)', fontSize: 19, flexShrink: 0, border: '1px solid var(--border-soft, var(--border))' }}><Icon name="📊" /></span>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={sectionTitle}>The figures are in Reports</div>
        <div style={sectionHint}>{facts.join(' · ')}. Distance travelled, areas and groups for any period, ready to print or share.</div>
      </div>
      {onOpenReport && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onOpenReport} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--org-ink)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Open the impact report</button>
          <button onClick={onOpenReports} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Build a funder report</button>
        </div>
      )}
    </div>
  )
}

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'todo', label: 'To do' },
  { key: 'none', label: 'Not measured yet' },
  { key: 'measured', label: 'Measured' },
]
const TODO = ['fell', 'follow_up', 'quiet']

function describe(st) {
  if (!st || st.kind === 'none') return { detail: 'No readings yet', pill: null }
  const last = st.lastReadingAt ? `last reading ${day(st.lastReadingAt)}` : ''
  if (st.kind === 'fell') return { detail: last, pill: `${signed(st.person.delta)} fell`, tone: 'fell' }
  if (st.kind === 'follow_up') return { detail: last, pill: 'Follow-up due', tone: 'follow_up' }
  if (st.kind === 'quiet') return { detail: last, pill: 'Overdue', tone: 'quiet' }
  if (st.kind === 'baseline') return { detail: `Starting score recorded · ${last}`, pill: null }
  return { detail: last, pill: signed(st.person.delta), tone: st.person.direction === 'improved' ? 'measured' : 'quiet' }
}

/** Everyone on the roll, filtered to what you are about to record. */
export function PeopleToRecord({ children, work, terms, primary, onOpenChild, onRecord, isMobile }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const kinds = [...work.status.values()].map(s => s.kind)
    return {
      all: children.length,
      todo: kinds.filter(k => TODO.includes(k)).length,
      none: kinds.filter(k => k === 'none').length,
      measured: kinds.filter(k => k === 'measured' || k === 'baseline').length,
    }
  }, [children.length, work.status])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return children
      .filter(c => !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
      .filter(c => {
        const k = work.status.get(c.id)?.kind || 'none'
        return filter === 'all' || (filter === 'todo' ? TODO.includes(k) : filter === 'measured' ? (k === 'measured' || k === 'baseline') : k === filter)
      })
  }, [children, search, filter, work.status])

  return (
    <section style={card} aria-label={`All ${terms.people}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Everyone</h3>
          <div style={sectionHint}>Open someone to see their scores and goals, or record for them here.</div>
        </div>
      </div>
      <div role="group" aria-label="Show" style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(f => {
          const on = filter === f.key
          return (
            <button key={f.key} aria-pressed={on} onClick={() => setFilter(f.key)} style={{
              minHeight: 38, padding: '0 13px', borderRadius: 99, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800,
              border: `1.5px solid ${on ? 'var(--org-primary)' : 'var(--border)'}`, background: on ? 'var(--org-a10)' : 'var(--surface)', color: on ? 'var(--org-ink)' : 'var(--text2)',
            }}>{f.label} <span style={{ opacity: 0.7 }}>{counts[f.key]}</span></button>
          )
        })}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${terms.people}…`} aria-label={`Search ${terms.people}`}
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, minHeight: 44, padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
      <div style={{ marginTop: 6 }}>
        {rows.length === 0 && (
          <div style={{ padding: '26px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 600 }}>Nobody here.</div>
        )}
        {rows.map(c => {
          const d = describe(work.status.get(c.id))
          return (
            // A phone has no room for the pill beside the button, so it joins the detail line.
            <PersonRow key={c.id} name={`${c.first_name} ${c.last_name}`} primary={primary} tone={d.tone}
              detail={isMobile && onRecord && d.pill ? `${d.pill} · ${d.detail}` : d.detail} pill={isMobile && onRecord ? null : d.pill}
              onOpen={() => onOpenChild(c.id)} onRecord={onRecord ? () => onRecord(c.id) : null} />
          )
        })}
      </div>
    </section>
  )
}

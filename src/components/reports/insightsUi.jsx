import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../lib/icons'
import { PERIODS } from '../../lib/insights'
import { Sparkline } from './charts'

// Pieces shared by the Insights page and the report studio, so a filter or a
// stat tile looks and behaves the same in both.

export const card = (extra = {}) => ({
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)', boxSizing: 'border-box', minWidth: 0, ...extra,
})

export function SectionLabel({ children, right, id }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '26px 0 10px' }}>
      <h2 id={id} style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--text3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</h2>
      {right}
    </div>
  )
}

export const chipStyle = (on, isMobile) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  minHeight: isMobile ? 40 : 34, padding: isMobile ? '0 14px' : '0 13px', borderRadius: 99,
  border: on ? '1.5px solid var(--org-ink)' : '1px solid var(--border)',
  background: on ? 'var(--org-a10, var(--info-bg))' : 'var(--surface)',
  color: on ? 'var(--org-ink)' : 'var(--text2)', fontSize: 12.5, fontWeight: 750,
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
})

const dateInput = (isMobile) => ({
  minHeight: isMobile ? 42 : 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
})

/**
 * Period presets as a row of chips, with custom dates behind the last one.
 * Presets come first because nobody wants to fight a calendar for "last 90
 * days"; a row of chips scrolls sideways on a phone instead of wrapping into a
 * wall of buttons.
 */
export function PeriodPicker({ value, onChange, isMobile, problem, wrap = false }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Period" style={wrap
        ? { display: 'flex', gap: 6, flexWrap: 'wrap' }
        : { display: 'flex', gap: 6, overflowX: 'auto', margin: isMobile ? '0 -16px' : 0, padding: isMobile ? '0 16px 2px' : '0 0 2px', scrollbarWidth: 'none' }}>
        {PERIODS.map(p => {
          const on = value.key === p.key
          return (
            <button key={p.key} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, key: p.key })} style={chipStyle(on, isMobile)}>
              {on && <Icon name="check" size={14} strokeWidth={2.5} />}{p.label}
            </button>
          )
        })}
      </div>
      {value.key === 'custom' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
            From <input type="date" value={value.from || ''} onChange={e => onChange({ ...value, from: e.target.value })} style={dateInput(isMobile)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
            To <input type="date" value={value.to || ''} onChange={e => onChange({ ...value, to: e.target.value })} style={dateInput(isMobile)} />
          </label>
          {problem && <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger-text)' }}>{problem}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Choose several from a list: a bottom sheet on a phone, a dialog elsewhere.
 * Search appears once the list is long enough to need it.
 */
export function MultiSelectSheet({ title, hint, options, selected, onChange, onClose, isMobile, emptyText }) {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState(selected)
  const closeRef = useRef(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter(o => o.label.toLowerCase().includes(needle)) : options
  }, [q, options])
  const toggle = (v) => setDraft(d => (d.includes(v) ? d.filter(x => x !== v) : [...d, v]))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10600 }} />
      <div role="dialog" aria-modal="true" aria-label={title} style={{
        position: 'fixed', zIndex: 10601, background: 'var(--surface)', display: 'flex', flexDirection: 'column',
        ...(isMobile
          ? { left: 0, right: 0, bottom: 0, maxHeight: '82vh', borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }
          : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px, 92vw)', maxHeight: '76vh', borderRadius: 18 }),
        boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{title}</div>
            {hint && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
          </div>
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: 'var(--surface-hover)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}><Icon name="close" size={18} /></button>
        </div>
        {options.length > 8 && (
          <div style={{ padding: '0 18px 8px' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${title.toLowerCase()}`}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: '0 10px', flex: 1 }}>
          {shown.length === 0 && <div style={{ padding: '18px 8px', fontSize: 13, color: 'var(--text3)' }}>{options.length ? 'Nothing matches that search.' : emptyText}</div>}
          {shown.map(o => {
            const on = draft.includes(o.value)
            return (
              <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, padding: '4px 8px', borderRadius: 10, cursor: 'pointer', background: on ? 'var(--org-a05, var(--surface2))' : 'transparent' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(o.value)} style={{ width: 18, height: 18, accentColor: 'var(--org-ink)' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 650, color: 'var(--text)' }}>{o.label}</span>
                {o.hint && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{o.hint}</span>}
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" onClick={() => setDraft([])} disabled={!draft.length} style={{ ...btn('ghost', isMobile), opacity: draft.length ? 1 : 0.5 }}>Clear</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => { onChange(draft); onClose() }} style={btn('primary', isMobile)}>
            {draft.length ? `Show ${draft.length} selected` : 'Show everything'}
          </button>
        </div>
      </div>
    </>
  )
}

export function btn(kind, isMobile) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: isMobile ? 44 : 38, padding: '0 16px', borderRadius: 11, fontSize: 13, fontWeight: 800,
    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  // The solid pair, not ink-on-white: in dark mode --org-ink is lightened for
  // reading on dark surfaces, and white text on it would vanish.
  if (kind === 'primary') return { ...base, border: 'none', background: 'var(--org-solid, var(--org-ink))', color: 'var(--org-on-solid, #fff)' }
  if (kind === 'quiet') return { ...base, border: 'none', background: 'transparent', color: 'var(--org-ink)', padding: '0 8px' }
  return { ...base, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }
}

const TONE = {
  good: { fg: 'var(--ok-text)', bg: 'var(--ok-bg)' },
  bad: { fg: 'var(--danger-text)', bg: 'var(--danger-bg)' },
  neutral: { fg: 'var(--text2)', bg: 'var(--surface2)' },
}

/**
 * A change against the previous period. Direction is carried by the arrow and
 * the words as well as the colour, so it survives colour blindness and print.
 */
export function ChangeChip({ change, tone, previousDisplay }) {
  if (!change) return null
  const t = TONE[tone] || TONE.neutral
  const arrow = change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '■'
  return (
    <span title={previousDisplay ? `Previous period: ${previousDisplay}` : undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
      background: t.bg, color: t.fg, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true" style={{ fontSize: 8 }}>{arrow}</span>{change.text}
    </span>
  )
}

export function KpiTile({ tile, isMobile, comparisonLabel }) {
  return (
    <div style={card({ padding: isMobile ? '13px 13px 12px' : '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6, height: '100%' })} title={tile.hint}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', lineHeight: 1.3, minHeight: isMobile ? 31 : undefined }}>
        {tile.label}{tile.restricted && <span aria-label="Owners and admins only" title="Owners and admins only" style={{ marginLeft: 5, color: 'var(--text-faint)' }}><Icon name="lock" size={11} /></span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 850, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>{tile.display}</div>
        {!isMobile && tile.spark && <Sparkline values={tile.spark} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
        <ChangeChip change={tile.change} tone={tile.tone} previousDisplay={tile.previousDisplay} />
        {tile.previousDisplay != null && !isMobile && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>vs {tile.previousDisplay}{comparisonLabel ? ` ${comparisonLabel}` : ''}</span>
        )}
      </div>
    </div>
  )
}

const FACT_ICON = { good: '▲', bad: '▼', neutral: '•', info: 'i' }
const FACT_TONE = {
  good: { fg: 'var(--ok-text)', bg: 'var(--ok-bg)' },
  bad: { fg: 'var(--danger-text)', bg: 'var(--danger-bg)' },
  neutral: { fg: 'var(--org-ink)', bg: 'var(--org-a10, var(--info-bg))' },
  info: { fg: 'var(--warn-text)', bg: 'var(--warn-bg)' },
}

export function FactList({ facts, isMobile }) {
  if (!facts?.length) return null
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 8 : 10 }}>
      {facts.map(f => {
        const t = FACT_TONE[f.tone] || FACT_TONE.neutral
        return (
          <li key={f.key} style={card({ padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start' })}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: t.bg, color: t.fg, fontSize: f.tone === 'info' ? 12 : 10, fontWeight: 900, fontStyle: f.tone === 'info' ? 'italic' : 'normal' }}>{FACT_ICON[f.tone] || '•'}</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)', fontWeight: 550 }}>{f.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

import React, { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTerms } from '../../context/OrgContext'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { getAuthBranding } from '../auth/authBranding'
import { brandPalette } from '../../lib/brandColors'
import { londonDate } from '../../lib/sessionPhase'
import Icon from '../../lib/icons'
import ProjectAttentionArt from './ProjectAttentionArt'
import { attentionDestination } from './projectAttentionModel'

const GROUPS = [
  { key: 'safety', label: 'Safety', title: 'Link risk assessments', detail: 'Have an assessment in place before delivery.', icon: 'safeguarding' },
  { key: 'register', label: 'Registers', title: 'Finish your registers', detail: 'Review attendance and close completed days.', icon: 'registers' },
  { key: 'reflection', label: 'Reflections', title: 'Capture what you learned', detail: 'A few notes now will help with the next project.', icon: 'edit' },
]
const BUTTON = { minHeight: 44, fontFamily: 'inherit', cursor: 'pointer', outlineOffset: 3 }
const dateParts = iso => {
  if (!iso) return { day: '—', month: 'TBC', label: 'Date to confirm' }
  const d = new Date(`${iso}T12:00:00Z`)
  const options = { timeZone: 'Europe/London' }
  return { day: d.toLocaleDateString('en-GB', { ...options, day: 'numeric' }), month: d.toLocaleDateString('en-GB', { ...options, month: 'short' }), label: d.toLocaleDateString('en-GB', { ...options, weekday: 'short', day: 'numeric', month: 'short' }) }
}

export default function ProjectAttention({ org, projectId, projectName, items, unavailable = [], onNavigate, onRetry }) {
  const terms = useTerms()
  const dark = useIsDarkTheme()
  const reduced = useReducedMotion()
  const headingId = useId()
  const listId = useId()
  const brand = getAuthBranding(org)
  const palette = brandPalette(brand.primary, dark)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const groups = GROUPS.filter(g => items.some(i => i.kind === g.key))
  const activeFilter = groups.some(g => g.key === filter) ? filter : 'all'
  const filtered = items.filter(i => activeFilter === 'all' || i.kind === activeFilter)
  const visible = expanded ? filtered : filtered.slice(0, 5)
  const affectedDays = new Set(items.map(i => i.day.id)).size
  const today = londonDate()
  const clear = !items.length && !unavailable.length
  const summary = unavailable.length ? 'Some checks are unavailable' : clear ? 'A little breathing room.' : `${items.length} action${items.length === 1 ? '' : 's'} to move things forward.`

  return <section aria-labelledby={headingId} style={{ '--attention-ink': palette.ink, '--attention-tint': palette.tint, '--attention-soft': palette.soft, '--attention-border': palette.border, '--attention-secondary': brand.secondary, fontFamily: brand.font.body, background: 'var(--surface)', border: '1px solid var(--attention-border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 32px -24px var(--attention-ink)', marginBottom: 14 }}>
    <div style={{ position: 'relative', padding: '22px 20px 20px', background: 'linear-gradient(135deg, var(--attention-tint), var(--surface))', borderBottom: items.length || unavailable.length ? '1px solid var(--attention-border)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ flex: '1 1 0', minWidth: 0, position: 'relative', zIndex: 1 }}>
          <h2 id={headingId} style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--attention-ink)' }}>Needs attention</h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, color: 'var(--text)', marginBottom: 7 }}>
            <span style={{ fontFamily: brand.font.display, fontSize: 44, fontWeight: 850, lineHeight: 1, letterSpacing: -2 }}>{unavailable.length ? items.length ? `${items.length}+` : '—' : items.length}</span>
            <span style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.4 }}>{unavailable.length ? items.length ? 'known actions' : 'checks unavailable' : clear ? 'outstanding checks' : `across ${affectedDays} ${affectedDays === 1 ? 'day' : 'days'}`}</span>
          </div>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.6, fontWeight: 650 }}>{summary}</p>
        </div>
        <div style={{ width: 124, maxWidth: '38%', flexShrink: 0 }}><ProjectAttentionArt clear={clear} /></div>
      </div>
      {clear && <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--text3)' }}>No missing risk links, register follow-ups or reflections found.</p>}
    </div>

    {unavailable.length > 0 && <div role="alert" style={{ margin: '14px 16px 0', padding: 12, border: '1px solid var(--warn-border)', borderRadius: 12, background: 'var(--warn-bg)', color: 'var(--warn-text)', fontSize: 12, lineHeight: 1.6 }}>
      Couldn’t check {unavailable.join(', ')}. The list may be incomplete.
      <button type="button" onClick={onRetry} style={{ ...BUTTON, display: 'block', marginTop: 6, border: 0, borderRadius: 8, background: 'transparent', padding: '8px 0', fontWeight: 800, color: 'inherit' }}>Try again <Icon name="→" size={13} /></button>
    </div>}

    {items.length > 0 && <div style={{ padding: '0 16px 16px' }}>
      {groups.length > 1 && <div aria-label="Filter attention checks" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 14 }}>
        {[{ key: 'all', label: 'All' }, ...groups].map(g => <button key={g.key} type="button" aria-pressed={activeFilter === g.key} onClick={() => { setFilter(g.key); setExpanded(false) }} style={{ ...BUTTON, border: `1px solid ${activeFilter === g.key ? 'var(--attention-border)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 10px', fontSize: 11.5, fontWeight: 750, background: activeFilter === g.key ? 'var(--attention-tint)' : 'transparent', color: activeFilter === g.key ? 'var(--attention-ink)' : 'var(--text3)' }}>
          {g.label} <span style={{ opacity: .75, marginLeft: 3 }}>{g.key === 'all' ? items.length : items.filter(i => i.kind === g.key).length}</span>
        </button>)}
      </div>}
      <div id={listId}>
        {groups.map(group => {
          const rows = visible.filter(i => i.kind === group.key)
          if (!rows.length) return null
          return <div key={group.key} style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 5 }}>
              <span style={{ display: 'flex', color: 'var(--attention-ink)' }}><Icon name={group.icon} size={17} /></span>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 13, fontWeight: 800 }}>{group.title}</h3>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--attention-ink)' }}>{filtered.filter(i => i.kind === group.key).length}</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, lineHeight: 1.6, color: 'var(--text3)' }}>{group.detail}</p>
            <div style={{ display: 'grid', gap: 7 }}>
              {rows.map((item, index) => {
                const date = dateParts(item.day.session_date)
                const prefix = `${projectName} — `
                const title = item.day.title?.startsWith(prefix) ? item.day.title.slice(prefix.length) : item.day.title || terms.Session
                const urgent = item.kind === 'safety' && item.day.session_date <= today
                const detail = item.reason === 'risk' ? (urgent ? 'Assessment needed now' : 'Before delivery') : item.reason === 'unmarked' ? `${item.count} unmarked` : item.reason === 'close' ? 'Still open' : 'Reflection to add'
                const action = item.kind === 'safety' ? 'Review day' : item.kind === 'register' ? 'Open register' : 'Add reflection'
                return <motion.button key={item.id} type="button" aria-label={`${action}: ${item.day.title || terms.Session}, ${date.label}. ${detail}`} onClick={() => onNavigate?.(...attentionDestination(item, projectId))}
                  initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .22, delay: reduced ? 0 : Math.min(index * .045, .2) }}
                  whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: .99 }}
                  style={{ ...BUTTON, display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 10px', textAlign: 'left', border: `1px solid ${urgent ? 'var(--danger-border)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }}>
                  <span aria-hidden="true" style={{ width: 42, minHeight: 46, flexShrink: 0, borderRadius: 9, background: 'var(--attention-tint)', color: 'var(--attention-ink)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><span style={{ fontSize: 18, fontWeight: 850, lineHeight: 1.15 }}>{date.day}</span><span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>{date.month}</span></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: urgent ? 750 : 500, color: urgent ? 'var(--danger-text)' : 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>{detail}</span>
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 750, color: 'var(--attention-ink)', marginTop: 5 }}>{action}</span>
                  </span>
                  <Icon name="→" size={14} style={{ color: 'var(--attention-ink)', flexShrink: 0 }} />
                </motion.button>
              })}
            </div>
          </div>
        })}
      </div>
      {filtered.length > 5 && <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)} style={{ ...BUTTON, width: '100%', marginTop: 12, border: '1px solid var(--attention-border)', borderRadius: 10, background: 'var(--attention-tint)', color: 'var(--attention-ink)', fontSize: 12, fontWeight: 800 }}>{expanded ? 'Show fewer' : `Show all ${filtered.length} actions`}</button>}
    </div>}
  </section>
}

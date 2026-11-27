import React, { useEffect, useState } from 'react'
import { kindOf, nowInPlan, withTimes } from '../../../lib/sessionPlan'
import { toneOf } from './BlockFields'
import Icon from '../../../lib/icons'

// The plan on the day: what is on now, how long is left, what is next, and
// the whole running order underneath. Big enough to read from a phone in one
// hand. Used in the session builder ("Run it") and the volunteer portal.

const londonNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return { today: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

export default function RunningOrder({ session, blocks, names = {}, compact = false }) {
  const [clock, setClock] = useState(londonNow)
  useEffect(() => {
    const t = setInterval(() => setClock(londonNow()), 20000)
    return () => clearInterval(t)
  }, [])
  const timed = withTimes(blocks.map(b => ({ ...b, minutes: Number(b.minutes) || 0 })), session.start_time)
  const now = nowInPlan(timed, session, clock.today, clock.minutes)

  if (!timed.length) {
    return <div style={{ padding: 20, borderRadius: 16, border: '1px dashed var(--border)', color: 'var(--text3)', fontSize: 14, textAlign: 'center' }}>No running order yet.</div>
  }

  return (
    <div style={{ display: 'grid', gap: compact ? 10 : 14 }}>
      {now?.phase === 'during' && (
        <section aria-label="On now" style={{ borderRadius: 18, padding: compact ? 16 : 22, background: 'var(--org-solid)', color: 'var(--org-on-solid)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>On now · {now.current.start}–{now.current.end}</div>
          <div style={{ fontSize: compact ? 20 : 26, fontWeight: 900, marginTop: 4, lineHeight: 1.2 }}>{now.current.title || kindOf(now.current.kind).label}</div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: 'color-mix(in srgb, var(--org-on-solid) 22%, transparent)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(now.progress * 100)}%`, height: '100%', background: 'var(--org-on-solid)', borderRadius: 99 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8, fontSize: 13.5, fontWeight: 800, flexWrap: 'wrap' }}>
            <span>{now.left} min left</span>
            {now.next && <span>Next: {now.next.title || kindOf(now.next.kind).label} at {now.next.start}</span>}
          </div>
          {!compact && now.current.details && <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', opacity: 0.95 }}>{now.current.details}</p>}
        </section>
      )}
      {now?.phase === 'before' && (
        <div role="status" style={{ borderRadius: 14, padding: '12px 16px', background: 'var(--info-bg)', color: 'var(--info-text)', fontSize: 14, fontWeight: 800 }}>
          Starts in {now.startsIn >= 60 ? `${Math.floor(now.startsIn / 60)}h ${now.startsIn % 60}m` : `${now.startsIn} min`} with {now.next.title || kindOf(now.next.kind).label}
        </div>
      )}
      {now?.phase === 'after' && (
        <div role="status" style={{ borderRadius: 14, padding: '12px 16px', background: 'var(--ok-bg)', color: 'var(--ok-text)', fontSize: 14, fontWeight: 800 }}>That is the whole plan. Time to wrap up.</div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }} aria-label="Running order">
        {timed.map((b, i) => {
          const done = now?.phase === 'after' || (now?.phase === 'during' && i < now.index)
          const current = now?.phase === 'during' && i === now.index
          const tone = toneOf(b.kind)
          return (
            <li key={b.id} aria-current={current ? 'step' : undefined}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: compact ? '10px 12px' : '12px 14px', borderRadius: 14, border: `1.5px solid ${current ? 'var(--org-solid)' : 'var(--border)'}`, background: 'var(--surface)', opacity: done ? 0.55 : 1 }}>
              <span style={{ width: 52, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>{b.start || '—'}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)' }}>{b.minutes} min</span>
              </span>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: tone.bg, color: tone.ink, flexShrink: 0 }}><Icon name={kindOf(b.kind).icon} size={17} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>{b.title || kindOf(b.kind).label}</span>
                  {done && <Icon name="✓" size={14} style={{ color: 'var(--ok-text)' }} />}
                </span>
                {(b.lead_id || b.area || b.groups?.length > 0) && (
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                    {[b.lead_id && names[b.lead_id] && `Led by ${names[b.lead_id]}`, b.area, b.groups?.length ? b.groups.join(', ') : ''].filter(Boolean).join(' · ')}
                  </span>
                )}
                {!compact && b.details && <span style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{b.details}</span>}
                {b.safety && <span style={{ display: 'flex', gap: 5, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--warn-text)', marginTop: 4, fontWeight: 700 }}><Icon name="⚠️" size={13} /> {b.safety}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

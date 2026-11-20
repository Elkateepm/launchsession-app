import React, { useEffect, useState } from 'react'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'
import { KINDS, sessionTypeMeta, timeRange } from '../../lib/calendarItems'
import { londonNow } from '../../lib/sessionPhase'
import { orgBrand } from '../shared/OrgPageHero'
import { RiskRow, useSessionRisk } from '../riskassessments/SessionRiskRow'
import { useCountUp } from './HubHomeSections'
import { nextSession, countdownParts } from './homeWidgetData'

// Home's widgets: the week at a glance, the next session counting down, the
// birthdays coming up, what is worth planning for, and how many people came.
// Each one is a way into the page that deals with it. Colour comes from what
// a thing is (the calendar's kind colours, the organisation's own brand for
// the session card), and motion is the CSS in hubHomeKeyframes, all of which
// stops under prefers-reduced-motion.

const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T00:00:00Z`))
const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E6EAF4)', borderRadius: 20, padding: 18, minWidth: 0, boxShadow: '0 1px 2px rgba(20,26,46,.04), 0 8px 24px -14px rgba(20,26,46,.2)', position: 'relative', overflow: 'hidden' }
const heading = { margin: 0, fontSize: 16, fontWeight: 850, color: 'var(--text)', letterSpacing: -0.2, fontFamily: 'var(--font-display, inherit)' }
const linkBtn = { minHeight: 44, padding: '0 4px', border: 'none', background: 'none', color: 'var(--org-ink)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }

function WidgetBadge({ icon, from, to }) {
  return <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 17, color: '#fff', background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 6px 14px -6px ${withAlpha(to, '99')}`, flexShrink: 0 }}><Icon name={icon} /></span>
}

// ── This week ────────────────────────────────────────────────────────────────
export function WeekStrip({ days, terms, onPick, isMobile }) {
  const total = days.reduce((n, d) => n + d.count, 0)
  return (
    // Tighter on a phone so seven days still get 44px-wide tap targets.
    <section aria-label="This week" style={{ ...card, padding: isMobile ? 14 : card.padding }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <WidgetBadge icon="calendar" from="var(--org-primary, #1B9AAA)" to="#4F46E5" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={heading}>This week</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{total ? `${total} ${total === 1 ? terms.session : terms.sessions} · tap a day to open it` : `Nothing planned yet · tap a day to plan`}</div>
        </div>
      </div>
      <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: isMobile ? 2 : 10, margin: isMobile ? '0 -4px' : 0 }}>
        {days.map((d, i) => (
          <button key={d.iso} role="listitem" type="button" onClick={() => onPick(d.iso)}
            className={`ls-rise ls-day${d.isToday ? ' ls-today-pulse' : ''}`}
            aria-label={`${fmt(d.iso, { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.count ? `${d.count} ${d.count === 1 ? terms.session : terms.sessions}` : 'nothing planned'}${d.holiday ? `, ${d.holiday}` : ''}`}
            style={{
              animationDelay: `${120 + i * 50}ms`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: isMobile ? 74 : 92, padding: isMobile ? '8px 2px' : '12px 4px',
              borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0, position: 'relative',
              border: d.isToday ? 'none' : '1px solid var(--border)',
              background: d.isToday ? 'linear-gradient(160deg, var(--org-solid, var(--org-primary)), #4F46E5)' : d.isPast ? 'var(--surface2)' : d.count ? 'var(--org-a05)' : 'var(--surface)',
              color: d.isToday ? '#fff' : d.isPast ? 'var(--text3)' : 'var(--text)',
              transition: 'transform .18s ease, box-shadow .18s ease',
            }}>
            <span style={{ fontSize: 10.5, fontWeight: 850, letterSpacing: .6, textTransform: 'uppercase', opacity: d.isToday ? .9 : 1 }}>{isMobile ? d.dow[0] : d.dow}</span>
            <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{d.day}</span>
            <span aria-hidden="true" style={{ display: 'flex', gap: 3, height: 7, alignItems: 'center' }}>
              {d.kinds.slice(0, 3).map((k, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: d.isToday ? '#fff' : KINDS[k]?.color || 'var(--org-primary)' }} />)}
              {d.count > 3 && <span style={{ fontSize: 9.5, fontWeight: 900 }}>+</span>}
            </span>
            {d.holiday && <span aria-hidden="true" title={d.holiday} style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: d.isToday ? '#FDE68A' : '#F59E0B' }} />}
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Next up ──────────────────────────────────────────────────────────────────
function useLondonClock() {
  const [now, setNow] = useState(() => londonNow().slice(0, 16))
  useEffect(() => {
    const t = setInterval(() => setNow(londonNow().slice(0, 16)), 30000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function NextUpCard({ org, sessions, attendance, terms, after, canPlan, hasRegisters, onViewPlan, onOpenRegister, onPlan, onAttachRisk }) {
  const now = useLondonClock()
  const next = nextSession(sessions, now, { after })
  const brand = orgBrand(org)
  const [risk] = useSessionRisk(next?.session?.id, org?.id)
  const shell = { ...card, border: 'none', background: brand.hero, color: '#fff', padding: 20 }
  const rings = (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, right: -70, top: -110, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, '88')}` }} />
      <div style={{ position: 'absolute', width: 160, height: 160, right: 40, bottom: -120, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, '88')}` }} />
    </div>
  )
  if (!next) {
    return (
      <section aria-label="Next up" style={shell}>
        {rings}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="ls-float" aria-hidden="true" style={{ fontSize: 34, width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 16, background: 'rgba(255,255,255,0.12)' }}><Icon name="🚀" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Next up</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 3 }}>Nothing booked yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Plan the next {terms.session} and it counts down here.</div>
          </div>
        </div>
        {canPlan && <button type="button" onClick={() => onPlan()} style={{ position: 'relative', marginTop: 16, width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: '#fff', color: brand.ink, fontSize: 14, fontWeight: 850, cursor: 'pointer', fontFamily: 'inherit' }}>Plan a {terms.session} →</button>}
      </section>
    )
  }
  const s = next.session
  const meta = sessionTypeMeta(s.session_type)
  const booked = (attendance || []).filter(a => a.session_id === s.id).length
  const soon = next.minutes <= 60
  const parts = countdownParts(next.minutes)
  return (
    <section aria-label="Next up" style={shell}>
      {rings}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 850, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Next up</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.14)' }}><Icon name={meta.icon} />{meta.label}</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, marginTop: 8, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{s.title}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{fmt(s.session_date, { weekday: 'long', day: 'numeric', month: 'short' })}{s.start_time ? ` · ${timeRange(s.start_time, s.end_time)}` : ''}{s.location ? ` · ${s.location.split(',')[0]}` : ''}</div>

        <div aria-label={`Starts in ${parts.map(([n, u]) => `${n} ${u}`).join(' ')}`} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {parts.map(([n, unit]) => (
            <div key={unit} style={{ flex: '0 0 auto', minWidth: 76, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>
              <span key={n} className="ls-tick" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display, inherit)' }}>{n}</span>
              <div style={{ fontSize: 11, fontWeight: 750, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{unit}</div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{booked}</span>
            <span style={{ fontSize: 11, fontWeight: 750, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{terms.people} booked</span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <RiskRow assessment={risk} required={s.risk_assessment_required !== false} compact onOpen={() => onViewPlan(s)} onAttach={onAttachRisk ? () => onAttachRisk(s) : null} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => onViewPlan(s)} style={{ flex: 1, minHeight: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>View plan</button>
          {hasRegisters && soon && <button type="button" onClick={() => onOpenRegister(s)} style={{ flex: 1.4, minHeight: 46, borderRadius: 12, border: 'none', background: '#fff', color: brand.ink, fontSize: 14, fontWeight: 850, cursor: 'pointer', fontFamily: 'inherit' }}>Open register →</button>}
        </div>
      </div>
    </section>
  )
}

// ── Birthdays ────────────────────────────────────────────────────────────────
const AVATAR_HUES = ['#EC4899', '#F97316', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B']

export function BirthdaysCard({ items, terms, onOpen }) {
  if (!items.length) return null
  const shown = items.slice(0, 4)
  return (
    <section aria-label="Birthdays this week" style={card}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, background: 'linear-gradient(90deg, #EC4899, #F97316, #FACC15)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="ls-wiggle" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 19, background: 'linear-gradient(135deg, #FCE7F3, #FFEDD5)', flexShrink: 0 }}>🎂</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={heading}>Birthdays this week</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{items.length} coming up. A card or a cheer goes a long way.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {shown.map((b, i) => {
          const hue = AVATAR_HUES[i % AVATAR_HUES.length]
          const name = [b.person.first_name, b.person.last_name].filter(Boolean).join(' ')
          return (
            <div key={`${b.person.id || name}-${b.date}`} className="ls-rise" style={{ animationDelay: `${150 + i * 60}ms`, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 14, background: b.isToday ? 'linear-gradient(90deg, #FDF2F8, #FFF7ED)' : 'var(--surface2)' }}>
              <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 900, color: '#fff', background: hue, boxShadow: `0 0 0 3px ${withAlpha(hue, '33')}`, flexShrink: 0 }}>{(b.person.first_name || '?')[0]}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: b.isToday ? '#111827' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span style={{ display: 'block', fontSize: 12, color: b.isToday ? '#9D174D' : 'var(--text3)', fontWeight: b.isToday ? 800 : 500 }}>{b.isToday ? `Turns ${b.age} today 🎉` : `Turns ${b.age} on ${fmt(b.date, { weekday: 'long' })}`}</span>
              </span>
            </div>
          )
        })}
      </div>
      {(items.length > shown.length || onOpen) && <button type="button" onClick={onOpen} style={{ ...linkBtn, marginTop: 6 }}>{items.length > shown.length ? `See all ${items.length} →` : `${terms.People} →`}</button>}
    </section>
  )
}

// ── Worth planning for ───────────────────────────────────────────────────────
export function ComingUpCard({ data, terms, today, canPlan, onPlan }) {
  const { holiday, idea } = data
  if (!holiday && !idea) return null
  const rows = [
    holiday && {
      key: 'holiday', icon: '🏖️', from: '#F59E0B', to: '#F97316',
      title: holiday.now ? `${holiday.label} are on` : `${holiday.label} in ${holiday.inDays} day${holiday.inDays === 1 ? '' : 's'}`,
      detail: `${fmt(holiday.start, { day: 'numeric', month: 'short' })} – ${fmt(holiday.end, { day: 'numeric', month: 'short' })} (approx.)`,
      action: `Plan a holiday ${terms.session}`,
      date: holiday.now ? today : holiday.start,
    },
    idea && {
      key: 'idea', icon: '✨', from: '#8B5CF6', to: '#EC4899',
      title: idea.name,
      detail: idea.inDays === 0 ? 'Today' : `${fmt(idea.date, { weekday: 'long', day: 'numeric', month: 'short' })} · in ${idea.inDays} day${idea.inDays === 1 ? '' : 's'}`,
      action: 'Plan something for it',
      date: idea.date,
    },
  ].filter(Boolean)
  return (
    <section aria-label="Worth planning for" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <WidgetBadge icon="✨" from="#8B5CF6" to="#EC4899" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={heading}>Worth planning for</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>Holidays and days to build a {terms.session} around.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r, i) => (
          <div key={r.key} className="ls-rise" style={{ animationDelay: `${160 + i * 70}ms`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 16, background: `linear-gradient(120deg, ${withAlpha(r.from, '14')}, ${withAlpha(r.to, '0f')})`, border: `1px solid ${withAlpha(r.from, '33')}` }}>
            <WidgetBadge icon={r.icon} from={r.from} to={r.to} />
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 1 }}>{r.detail}</div>
            </div>
            {canPlan && <button type="button" onClick={() => onPlan(r.date)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{r.action} →</button>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Arrivals ─────────────────────────────────────────────────────────────────
export function ArrivalsCard({ weeks, terms, onOpen }) {
  const thisWeek = weeks[weeks.length - 1]?.count || 0
  const lastWeek = weeks[weeks.length - 2]?.count || 0
  const n = useCountUp(thisWeek, 900)
  const max = Math.max(1, ...weeks.map(w => w.count))
  if (!weeks.some(w => w.count)) return null
  const change = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null
  return (
    <section aria-label="Arrivals" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <WidgetBadge icon="children" from="#10B981" to="#0EA5E9" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={heading}>Arrivals</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{terms.People} signed in, week by week</div>
        </div>
        {onOpen && <button type="button" onClick={onOpen} style={linkBtn}>Reports →</button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display, inherit)' }}>{n}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>this week</div>
          {change != null && <div style={{ fontSize: 12, fontWeight: 850, marginTop: 4, color: change >= 0 ? 'var(--ok-text)' : 'var(--warn-text)' }}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}% on last week</div>}
        </div>
        <div aria-hidden="true" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6, height: 84 }}>
          {weeks.map((w, i) => (
            <div key={w.weekStart} title={`Week of ${fmt(w.weekStart, { day: 'numeric', month: 'short' })}: ${w.count}`} className="ls-bar"
              style={{ animationDelay: `${200 + i * 60}ms`, flex: 1, height: `${Math.max(6, (w.count / max) * 100)}%`, borderRadius: 8,
                background: i === weeks.length - 1 ? 'linear-gradient(180deg, #34D399, #0EA5E9)' : 'linear-gradient(180deg, var(--org-a35, #9FD8DF), var(--org-a20, #CDEDF1))' }} />
          ))}
        </div>
      </div>
    </section>
  )
}

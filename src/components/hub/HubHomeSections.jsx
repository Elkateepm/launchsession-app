import React from 'react'
import Icon from '../../lib/icons'

// ─────────────────────────────────────────────────────────────────────────────
// Home page building blocks.
//
// These replace the old "Right now" / "Overview" / "Needs attention" panels,
// which between them showed the same session three times and filled six tiles
// with "0" or "No activity yet". The organising idea here is that the home
// page should be a plan for the day, not an inventory of modules:
//   • DaySpine      — one live time ribbon that owns "today"
//   • ActionRow     — only genuine outstanding work, colour-coded by urgency
//   • GlanceStats   — real numbers with a trend, counted up on mount
//   • QuickJump     — the six things people actually start from Home
//   • WeatherStrip  — demoted to a delivery decision, not a hero tile
//
// Everything takes the org's `primary` so branding still flows through.
// ─────────────────────────────────────────────────────────────────────────────

export const hubHomeKeyframes = `
@keyframes lsWave{0%,60%,100%{transform:rotate(0)}70%{transform:rotate(16deg)}80%{transform:rotate(-8deg)}90%{transform:rotate(12deg)}}
@keyframes lsNowPing{0%,100%{box-shadow:0 0 0 0 rgba(255,176,32,.7)}70%{box-shadow:0 0 0 9px rgba(255,176,32,0)}}
@keyframes lsRise{to{opacity:1;transform:none}}
.ls-rise{opacity:0;transform:translateY(14px);animation:lsRise .55s cubic-bezier(.22,1,.36,1) forwards}
.ls-act:hover{transform:translateY(-2px);box-shadow:0 12px 28px -14px rgba(20,26,46,.4)}
.ls-act:hover .ls-act-go{transform:translateX(3px)}
.ls-q:hover{transform:translateY(-2px)}
.ls-q:hover .ls-q-ico{transform:scale(1.16) rotate(-6deg)}
.ls-stat:hover{transform:translateY(-2px)}
.ls-q:active,.ls-act:active,.ls-pill:active,.ls-row:active{transform:scale(.97)}
.ls-pill:hover{background:rgba(255,255,255,.2)!important}
.ls-row:hover{border-color:var(--org-a35,#CBD5E1)!important;transform:translateX(3px)}
.ls-row:hover .ls-row-go{opacity:1;transform:translateX(0)}
@keyframes lsPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
.ls-pop{animation:lsPop .5s cubic-bezier(.22,1,.36,1) .25s both}
@keyframes lsFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ls-fill{transform-origin:left center;animation:lsFill .9s cubic-bezier(.22,1,.36,1) .2s both}
.ls-act:focus-visible,.ls-q:focus-visible,.ls-stat:focus-visible,.ls-pill:focus-visible,.ls-row:focus-visible{outline:3px solid var(--org-primary,#1B9AAA)!important;outline-offset:3px}
@media (prefers-reduced-motion: reduce){
  .ls-rise{opacity:1;transform:none;animation:none}
  .ls-act:hover,.ls-q:hover,.ls-stat:hover,.ls-row:hover{transform:none}
  .ls-q:active,.ls-act:active,.ls-pill:active,.ls-row:active{transform:none}
  .ls-q:hover .ls-q-ico{transform:none}
  .ls-pop,.ls-fill{animation:none}
  [style*="lsWave"]{animation:none!important}
}
`

// Minutes since midnight, for positioning things on the spine.
const toMin = (t) => {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

const two = (n) => String(n).padStart(2, '0')

// ─── Day spine ───────────────────────────────────────────────────────────────
// A horizontal ribbon of the working day with each session drawn as a block and
// an amber "now" marker that moves in real time. Replaces the hero card, the
// "N sessions today" tile and the "Next session" tile, which were all pointing
// at the same thing.
export function DaySpine({ sessions, statsFor, primary, secondary, isMobile, onOpenSession, todayStr }) {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60

  // Window the spine to the day's actual activity rather than a fixed
  // 08:00–18:00, so an evening club or an all-day residential still reads
  // properly. Deliberately NOT stretched to include the current time: doing
  // that made the ribbon span 00:00–18:00 when someone opened the app just
  // after midnight, squashing a six-hour session into the right-hand third.
  // If now falls outside the window the marker simply isn't drawn.
  const { from, to } = React.useMemo(() => {
    const starts = sessions.map(s => toMin(s.start_time)).filter(v => v != null)
    const ends = sessions.map(s => toMin(s.end_time)).filter(v => v != null)
    if (starts.length === 0) return { from: 8 * 60, to: 18 * 60 }
    const lo = Math.floor((Math.min(...starts) - 60) / 60) * 60
    const hi = Math.ceil((Math.max(...(ends.length ? ends : starts.map(s => s + 90))) + 60) / 60) * 60
    return { from: Math.max(0, lo), to: Math.min(24 * 60, Math.max(hi, lo + 240)) }
  }, [sessions])

  const span = Math.max(60, to - from)
  const pct = (min) => Math.max(0, Math.min(100, ((min - from) / span) * 100))

  // Mobile-first tick density. On a 390px screen seven labels sit ~50px apart
  // and read as noise, so phones get a coarser step and the labels are pinned
  // to the same percentage as their gridline instead of being spread with
  // space-between (which drifted out of alignment as the window changed).
  const hourMarks = []
  const baseStep = span > 8 * 60 ? 120 : span > 4 * 60 ? 60 : 30
  const step = isMobile ? Math.max(baseStep, Math.ceil(span / 4 / 60) * 60) : baseStep
  for (let m = from; m <= to; m += step) hourMarks.push(m)

  // The next thing that hasn't finished yet — what the countdown counts to.
  const upNext = React.useMemo(() => {
    const withTimes = sessions
      .map(s => ({ s, start: toMin(s.start_time), end: toMin(s.end_time) }))
      .filter(x => x.start != null)
      .sort((a, b) => a.start - b.start)
    return withTimes.find(x => (x.end != null ? x.end : x.start) > nowMin) || null
  }, [sessions, nowMin])

  const isLive = upNext && upNext.start <= nowMin
  const secsTo = upNext ? Math.max(0, Math.round((upNext.start - nowMin) * 60)) : 0
  const cd = `${two(Math.floor(secsTo / 3600))}:${two(Math.floor((secsTo % 3600) / 60))}:${two(secsTo % 60)}`

  const heroStats = upNext ? statsFor(upNext.s) : null
  const totalExpected = heroStats ? heroStats.signedIn + heroStats.signedOut + heroStats.expected + heroStats.absent : 0
  const arrived = heroStats ? heroStats.signedIn + heroStats.signedOut : 0

  if (sessions.length === 0) return null

  return (
    <div className="ls-rise" style={{ marginTop: isMobile ? 16 : 22, position: 'relative', zIndex: 2 }}>
      <div style={{ position: 'relative', height: 13, fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 7 }}>
        {hourMarks.map((m, i) => (
          <span key={m} style={{
            position: 'absolute', left: `${pct(m)}%`, top: 0, whiteSpace: 'nowrap',
            transform: i === 0 ? 'none' : i === hourMarks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
          }}>{two(Math.floor(m / 60))}:{two(m % 60)}</span>
        ))}
      </div>

      <div style={{ height: isMobile ? 62 : 56, background: 'rgba(255,255,255,0.07)', borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
        {hourMarks.slice(1, -1).map(m => (
          <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.07)', left: `${pct(m)}%` }} />
        ))}

        {sessions.map((s, i) => {
          const start = toMin(s.start_time)
          const end = toMin(s.end_time)
          if (start == null) return null
          const left = pct(start)
          const right = 100 - pct(end != null ? end : start + 90)
          const st = statsFor(s)
          const done = st.signedIn + st.signedOut
          const tot = done + st.expected + st.absent
          const live = start <= nowMin && (end == null || end > nowMin)
          // A 40-minute block on a 12-hour phone-width ribbon is ~25px wide, so
          // its title rendered as "E..". Below the threshold the block carries
          // only its dot and the detail moves to the readable list underneath.
          const widthPct = 100 - Math.max(0, right) - left
          const compact = isMobile && widthPct < 34
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenSession && onOpenSession(s)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession && onOpenSession(s) } }}
              title={`${s.title} — ${(s.start_time || '').slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}`}
              style={{
                position: 'absolute', top: 7, bottom: 7, left: `${left}%`, right: `${Math.max(0, right)}%`,
                minWidth: compact ? 26 : isMobile ? 56 : 72, borderRadius: 11, cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'flex-start',
                gap: compact ? 0 : 9, padding: compact ? 0 : isMobile ? '0 9px' : '0 12px',
                // Glass rather than brand-coloured: the hero behind this is now
                // the org's own gradient, so a brand-coloured block would sink
                // into it. White translucent reads on any palette.
                background: live ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 8px 26px -12px rgba(0,0,0,0.45)',
                outline: 'none',
              }}
            >
              {tot > 0 && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((done / tot) * 100)}%`, background: 'rgba(255,255,255,0.22)', transition: 'width 500ms ease' }} />
              )}
              <span style={{ fontSize: 15, position: 'relative', flexShrink: 0 }}>{live ? '🔴' : '⚽'}</span>
              {!compact && (
              <div style={{ minWidth: 0, position: 'relative' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.start_time?.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}{s.location ? ` · ${s.location}` : ''}{tot > 0 ? ` · ${done}/${tot} in` : ''}
                </div>
              </div>
              )}
            </div>
          )
        })}

        {nowMin >= from && nowMin <= to && (
          <div style={{ position: 'absolute', top: -6, bottom: -6, width: 2, background: '#FFB020', left: `${pct(nowMin)}%`, borderRadius: 2, boxShadow: '0 0 12px #FFB020', zIndex: 5 }}>
            <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, borderRadius: '50%', background: '#FFB020', animation: 'lsNowPing 2s infinite' }} />
          </div>
        )}
      </div>

      {/* Phones read the day as a list, not a chart. The ribbon above stays as
          the at-a-glance shape of the day; this is where the detail actually
          lives, at full width with a 44px tap target per session. */}
      {isMobile && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {sessions.map(s => {
            const start = toMin(s.start_time)
            const end = toMin(s.end_time)
            const st = statsFor(s)
            const done = st.signedIn + st.signedOut
            const tot = done + st.expected + st.absent
            const live = start != null && start <= nowMin && (end == null || end > nowMin)
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenSession && onOpenSession(s)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession && onOpenSession(s) } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '8px 12px',
                  borderRadius: 12, background: live ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.16)', cursor: 'pointer', outline: 'none',
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{live ? '🔴' : '⚽'}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.start_time?.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}{s.location ? ` · ${s.location.split(',')[0]}` : ''}
                  </div>
                </div>
                {tot > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.8)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{done}/{tot}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, marginTop: 13, flexWrap: 'wrap' }}>
        {upNext && (
          isLive ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <b style={{ fontSize: 21, fontWeight: 900, color: '#4ADE80', fontFamily: 'var(--font-display, sans-serif)' }}>Live now</b>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{arrived} of {totalExpected} arrived</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <b style={{ fontSize: 21, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display, sans-serif)', fontVariantNumeric: 'tabular-nums' }}>{cd}</b>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>until doors open</span>
            </div>
          )
        )}
        {totalExpected > 0 && (
          <div style={{ display: 'flex', gap: 4, marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
            {Array.from({ length: Math.min(totalExpected, isMobile ? 10 : 14) }).map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < arrived ? '#12C48B' : 'rgba(255,255,255,0.16)', transition: 'background 300ms ease' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Action row ──────────────────────────────────────────────────────────────
// Only genuine outstanding work. Nothing here is a link to a module that has
// nothing to say — "Registers: no activity yet" was furniture, not an action.
const TONES = {
  amber: { line: '#FFB020', bg: '#FFF4DE' },
  punch: { line: '#FF5D73', bg: '#FFE9EC' },
  sky: { line: '#3AA0FF', bg: '#E4F1FF' },
}

export function ActionRow({ items, isMobile }) {
  if (!items || items.length === 0) return null
  return (
    <div className="ls-rise" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
      {items.map(item => {
        const tone = TONES[item.tone] || TONES.amber
        return (
          <div
            key={item.key}
            className="ls-act"
            role="button"
            tabIndex={0}
            onClick={item.onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick() } }}
            style={{
              // Same radius, border and shadow as every other panel in this
              // column. Urgency is carried by the icon tile, not by a coloured
              // bar down the edge -- three cards each with a different coloured
              // stripe read as decoration rather than as a priority order.
              background: 'var(--surface, #fff)', borderRadius: 18, padding: '13px 15px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              border: '1px solid var(--border, #E6EAF4)',
              transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
              boxShadow: '0 1px 2px rgba(20,26,46,.04), 0 8px 24px -12px rgba(20,26,46,.18)',
              minWidth: 0, outline: 'none',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0, background: tone.bg, color: tone.line }}><Icon name={item.icon} size={16} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #141A2E)', lineHeight: 1.35 }}>{item.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3, #5A6484)', marginTop: 2, lineHeight: 1.4 }}>{item.detail}</div>
            </div>
            <span className="ls-act-go" style={{ marginLeft: 'auto', fontSize: 15, color: '#98A1BC', transition: 'transform .18s ease', flexShrink: 0 }}><Icon name="→" /></span>
          </div>
        )
      })}
    </div>
  )
}

export function AllClear({ label }) {
  return (
    <div className="ls-rise" style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-border)', borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--ok-text)', lineHeight: 1.4 }}>
      <span className="ls-pop" style={{ display: 'inline-flex' }}><Icon name="✅" size={16} /></span>{label}
    </div>
  )
}

// ─── Animated stats ──────────────────────────────────────────────────────────
// A number that counts up reads as alive; the sparkline answers "is that good?",
// which a bare figure never does.
export function useCountUp(target, duration = 1000) {
  const [val, setVal] = React.useState(0)
  React.useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      setVal(target); return
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target); return
    }
    let raf, start
    const tick = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function Sparkline({ points, colour }) {
  if (!points || points.length < 2) return null
  const max = Math.max(...points, 1)
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${24 - (p / max) * 20}`).join(' L ')
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, width: '100%', opacity: 0.28 }}>
      <path d={`M ${d}`} fill="none" stroke={colour} strokeWidth="2.5" />
    </svg>
  )
}

export function GlanceStats({ stats, isMobile }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: 11 }}>
      {stats.map(({ key, ...stat }) => <GlanceStatTile key={key} {...stat} />)}
    </div>
  )
}

function GlanceStatTile({ value, suffix, label, bg, colour, trend, onClick }) {
  const n = useCountUp(value)
  return (
    <div
      className="ls-stat"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick() } }}
      style={{ borderRadius: 15, padding: '14px 15px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform .2s ease', background: bg, color: colour, minWidth: 0, outline: 'none' }}
    >
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display, sans-serif)', position: 'relative' }}>{n}{suffix || ''}</div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, opacity: 0.78, position: 'relative' }}>{label}</div>
      <Sparkline points={trend} colour={colour} />
    </div>
  )
}

// ─── Quick jump ──────────────────────────────────────────────────────────────
// Small square tiles, three across on a phone: the old two-across cards made
// eight shortcuts a full screen of scrolling. Each icon sits in a brand-tinted
// well so the grid reads as one set rather than eight unrelated glyphs.
export function QuickJump({ actions, isMobile, primary, wide = false }) {
  if (!actions || actions.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : wide ? 'repeat(auto-fill, minmax(112px,1fr))' : 'repeat(3, minmax(0,1fr))', gap: isMobile ? 8 : 10 }}>
      {actions.map((a, i) => (
        <button
          key={a.key}
          type="button"
          className="ls-q ls-rise"
          onClick={a.onClick}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--org-a35)'; e.currentTarget.style.background = 'var(--org-a05)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #E6EAF4)'; e.currentTarget.style.background = 'var(--surface, #fff)' }}
          style={{
            animationDelay: `${120 + i * 45}ms`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            minHeight: isMobile ? 92 : 98, padding: '12px 6px', border: '1px solid var(--border, #E6EAF4)', borderRadius: 16,
            textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--surface, #fff)', minWidth: 0,
            transition: 'transform .2s ease, border-color .2s ease, background .2s ease',
          }}
        >
          <span className="ls-q-ico" aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 19, background: a.tone === 'alert' ? 'var(--danger-bg, #FEE2E2)' : 'var(--org-a10)', color: a.tone === 'alert' ? 'var(--danger-text, #B91C1C)' : 'var(--org-ink)', transition: 'transform .2s ease' }}><Icon name={a.icon} /></span>
          <span style={{ fontSize: 12, fontWeight: 750, lineHeight: 1.25, color: 'var(--text, #141A2E)' }}>{a.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Hero stats ──────────────────────────────────────────────────────────────
// Today's numbers as frosted pills on the hero itself. They replace four large
// white tiles that sat inside the banner, took half a phone screen, and mostly
// said "0". Each one counts up and opens the page it summarises.
export function HeroStats({ items, isMobile }) {
  if (!items || items.length === 0 || items.every(i => !i.value)) return null
  return (
    <div role="list" aria-label="Today at a glance" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : `repeat(${items.length}, minmax(0, 210px))`, gap: 8 }}>
      {items.map((item, i) => <HeroStat key={item.key} item={item} delay={i * 70} />)}
    </div>
  )
}

function HeroStat({ item, delay }) {
  const n = useCountUp(item.value, 900)
  return (
    <button role="listitem" type="button" onClick={item.onClick} className="ls-pill ls-rise"
      aria-label={`${item.value} ${item.label}`}
      style={{
        animationDelay: `${delay + 150}ms`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '9px 12px',
        borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', color: '#fff',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0, transition: 'background .18s ease, transform .18s ease',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', fontSize: 15, flexShrink: 0 }}><Icon name={item.icon} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 20, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display, sans-serif)' }}>{n}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, marginTop: 3, color: 'rgba(255,255,255,0.86)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
      </span>
    </button>
  )
}

export function LearningBrief({ reflections, sessions, today, primary, terms, onOpen }) {
  const delivered = sessions.filter(s => !s.cancelled_at && s.session_date >= `${today.slice(0, 7)}-01` && s.session_date <= today && (s.closed_at || s.session_date < today))
  const ids = new Set(delivered.map(s => s.id))
  const reviews = reflections.filter(r => ids.has(r.session_id))
  const withEvidence = reviews.filter(r => r.evidence_notes?.trim()).length
  const withVoice = reviews.filter(r => r.participant_voice?.trim()).length
  const required = delivered.filter(s => s.reflection_required !== false)
  const reviewedIds = new Set(reviews.map(r => r.session_id))
  const complete = required.filter(s => reviewedIds.has(s.id)).length
  return <section aria-label="Learning this month" style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E6EAF4)', borderRadius: 18, padding: 20, minWidth: 0 }}>
    <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--org-ink)', fontWeight: 800 }}>Delivery to impact</div>
    <h2 style={{ margin: '8px 0', fontSize: 18, letterSpacing: -0.4, color: 'var(--text)' }}>What are we learning?</h2>
    <p style={{ margin: '0 0 16px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text3)' }}>This month’s reflections turn your {terms.sessions} into evidence for your next report.</p>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text2)' }}><span>Required reflections</span><strong>{complete} / {required.length}</strong></div>
    <div role="progressbar" aria-label="Required reflections completed" aria-valuenow={complete} aria-valuemin={0} aria-valuemax={required.length || 1} style={{ height: 6, borderRadius: 8, background: 'var(--border)', margin: '10px 0 16px', overflow: 'hidden' }}><div style={{ width: `${required.length ? complete / required.length * 100 : 0}%`, height: '100%', background: primary }} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[[withEvidence, 'With evidence'], [withVoice, 'Participant voice']].map(([value, label]) => <div key={label} style={{ background: 'var(--org-a05)', borderRadius: 10, padding: 12 }}><strong style={{ fontSize: 22, color: 'var(--org-ink)' }}>{value}</strong><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{label}</div></div>)}
    </div>
    <button onClick={onOpen} style={{ width: '100%', minHeight: 44, marginTop: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--org-ink)', fontWeight: 800, cursor: 'pointer' }}>Explore reports →</button>
  </section>
}

// ─── Weather strip ───────────────────────────────────────────────────────────
// Weather only matters as a delivery decision, so it gets a verdict attached
// and a strip rather than the large tile it used to occupy.
export function WeatherStrip({ weather, weatherError, icon, label, primary, onSetup }) {
  // Plain card, same as every other panel on the page. This used to be a blue
  // gradient tile, which read as a fourth brand colour on a page that already
  // has the org's primary and secondary.
  const shell = {
    display: 'flex', alignItems: 'center', gap: 13, padding: '13px 17px',
    background: 'var(--surface, #fff)', borderRadius: 18,
    border: '1px solid var(--border, #E6EAF4)', flexWrap: 'wrap',
    boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 4px 16px -12px rgba(15,23,42,0.18)',
  }
  // No town set (or the lookup failed). Staff and volunteers cannot do
  // anything about that, so they see nothing; an admin gets one quiet line
  // that goes straight to the setting, not a card announcing a failure.
  if (weatherError) {
    if (!onSetup) return null
    return (
      <button type="button" onClick={onSetup} className="ls-row" style={{ ...shell, width: '100%', boxSizing: 'border-box', minHeight: 52, fontSize: 12.5, color: 'var(--text2, #334155)', fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'transform .18s ease, border-color .18s ease' }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>⛅</span>
        <span style={{ flex: 1 }}>Add your town in Settings to see the weather for your sessions</span>
        <span className="ls-row-go" aria-hidden="true" style={{ color: 'var(--org-ink)', opacity: .6, transform: 'translateX(-3px)', transition: 'opacity .18s ease, transform .18s ease' }}><Icon name="→" /></span>
      </button>
    )
  }
  // Loading: no placeholder card that pops in and then turns into something else.
  if (!weather) return null

  const wet = weather.rainChance != null && weather.rainChance >= 50
  const windy = weather.wind >= 25
  const cold = weather.temp <= 6
  const verdict = wet ? 'Plan indoors' : windy ? 'Windy — secure kit' : cold ? 'Wrap up warm' : 'Good for outdoor'
  const caution = wet || cold || windy
  const tone = caution
    ? { bg: '#FFF4DE', fg: '#7A4D00', bd: '#F5DCB0' }
    : { bg: 'var(--org-a10)', fg: primary, bd: 'var(--org-a20)' }

  const days = weather.days || []

  return (
    <div style={{ ...shell, flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text, #0F172A)', lineHeight: 1, fontFamily: 'var(--font-display, sans-serif)' }}>{weather.temp}°</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3, #64748B)', fontWeight: 600, marginTop: 3 }}>
            {label} · {weather.city}{weather.high != null ? ` · ${weather.high}°/${weather.low}°` : ''}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, background: tone.bg, color: tone.fg, padding: '5px 11px', borderRadius: 99, fontWeight: 700, border: `1px solid ${tone.bd}`, whiteSpace: 'nowrap' }}>
          {verdict}
        </span>
      </div>

      {/* The week, for deciding whether Thursday's session can be outdoors --
          which is the question this card gets asked and could not answer.
          Rain chance is shown only where it is worth acting on: a row of "3%"
          across five days is noise that makes the one 70% harder to see. */}
      {days.length > 1 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          gap: 4, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border, #E6EAF4)',
        }}>
          {days.map((d, i) => (
            <div key={d.iso} title={`${d.description}${d.rain != null ? ` · ${d.rain}% chance of rain` : ''}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 2px', borderRadius: 10, minWidth: 0,
                background: i === 0 ? 'var(--org-a05)' : 'transparent',
              }}>
              <span style={{
                fontSize: 10.5, fontWeight: 800, color: i === 0 ? 'var(--text, #0F172A)' : 'var(--text3, #64748B)',
                textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{d.label}</span>
              <span style={{ fontSize: 17, lineHeight: 1.1 }} aria-hidden="true">{d.icon}</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text, #0F172A)', whiteSpace: 'nowrap' }}>
                {d.high != null ? `${d.high}°` : '—'}
                {d.low != null && <span style={{ color: 'var(--text3, #94A3B8)', fontWeight: 600 }}> {d.low}°</span>}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                color: d.rain != null && d.rain >= 50 ? 'var(--warn-text)' : 'transparent',
              }}>
                {d.rain != null && d.rain >= 50 ? `${d.rain}%` : '·'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

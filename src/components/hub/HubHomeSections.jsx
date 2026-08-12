import React from 'react'

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

const INK = '#141A2E'

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
@media (prefers-reduced-motion: reduce){
  .ls-rise{opacity:1;transform:none;animation:none}
  .ls-act:hover,.ls-q:hover,.ls-stat:hover{transform:none}
  .ls-q:hover .ls-q-ico{transform:none}
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

  // Window the spine to the day's actual activity rather than a fixed 08:00–18:00,
  // so an evening-only or all-day programme still fills the ribbon sensibly.
  const { from, to } = React.useMemo(() => {
    const starts = sessions.map(s => toMin(s.start_time)).filter(v => v != null)
    const ends = sessions.map(s => toMin(s.end_time)).filter(v => v != null)
    let lo = Math.min(8 * 60, ...(starts.length ? starts : [8 * 60]))
    let hi = Math.max(18 * 60, ...(ends.length ? ends : [18 * 60]))
    lo = Math.min(lo, nowMin)
    hi = Math.max(hi, nowMin)
    lo = Math.floor((lo - 30) / 60) * 60
    hi = Math.ceil((hi + 30) / 60) * 60
    return { from: Math.max(0, lo), to: Math.min(24 * 60, hi) }
  }, [sessions, nowMin])

  const span = Math.max(60, to - from)
  const pct = (min) => Math.max(0, Math.min(100, ((min - from) / span) * 100))

  const hourMarks = []
  const step = span > 10 * 60 ? 180 : 120
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 7 }}>
        {hourMarks.map(m => <span key={m}>{two(Math.floor(m / 60))}:{two(m % 60)}</span>)}
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
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenSession && onOpenSession(s)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession && onOpenSession(s) } }}
              title={`${s.title} — ${s.start_time || ''}${s.end_time ? `–${s.end_time}` : ''}`}
              style={{
                position: 'absolute', top: 7, bottom: 7, left: `${left}%`, right: `${Math.max(0, right)}%`,
                minWidth: 72, borderRadius: 11, cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px',
                background: `linear-gradient(100deg, ${primary}, ${secondary || primary})`,
                boxShadow: `0 8px 26px -10px ${primary}`,
                outline: 'none',
              }}
            >
              {tot > 0 && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((done / tot) * 100)}%`, background: 'rgba(255,255,255,0.18)', transition: 'width 500ms ease' }} />
              )}
              <span style={{ fontSize: 15, position: 'relative', flexShrink: 0 }}>{live ? '🔴' : '⚽'}</span>
              <div style={{ minWidth: 0, position: 'relative' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.start_time?.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}{s.location ? ` · ${s.location}` : ''}{tot > 0 ? ` · ${done}/${tot} in` : ''}
                </div>
              </div>
            </div>
          )
        })}

        {nowMin >= from && nowMin <= to && (
          <div style={{ position: 'absolute', top: -6, bottom: -6, width: 2, background: '#FFB020', left: `${pct(nowMin)}%`, borderRadius: 2, boxShadow: '0 0 12px #FFB020', zIndex: 5 }}>
            <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, borderRadius: '50%', background: '#FFB020', animation: 'lsNowPing 2s infinite' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 13, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {Array.from({ length: Math.min(totalExpected, 14) }).map((_, i) => (
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
    <div className="ls-rise" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
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
              background: 'var(--surface, #fff)', borderRadius: 18, padding: '15px 17px',
              display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer',
              border: '1px solid var(--border, #E6EAF4)', borderLeft: `4px solid ${tone.line}`,
              transition: 'transform .18s ease, box-shadow .18s ease',
              boxShadow: '0 1px 2px rgba(20,26,46,.04), 0 8px 24px -12px rgba(20,26,46,.18)',
              minWidth: 0, outline: 'none',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 17, flexShrink: 0, background: tone.bg }}>{item.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text, #141A2E)' }}>{item.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3, #5A6484)', marginTop: 2 }}>{item.detail}</div>
            </div>
            <span className="ls-act-go" style={{ marginLeft: 'auto', fontSize: 15, color: '#98A1BC', transition: 'transform .18s ease', flexShrink: 0 }}>→</span>
          </div>
        )
      })}
    </div>
  )
}

export function AllClear({ label }) {
  return (
    <div className="ls-rise" style={{ background: '#DFF8EF', border: '1px solid #B8EBD8', borderRadius: 18, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 11, fontSize: 13, fontWeight: 700, color: '#06614A' }}>
      <span style={{ fontSize: 17 }}>🎉</span>{label}
    </div>
  )
}

// ─── Animated stats ──────────────────────────────────────────────────────────
// A number that counts up reads as alive; the sparkline answers "is that good?",
// which a bare figure never does.
function useCountUp(target, duration = 1000) {
  const [val, setVal] = React.useState(0)
  React.useEffect(() => {
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
      {stats.map(s => <GlanceStatTile key={s.key} {...s} />)}
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
export function QuickJump({ actions, isMobile, primary }) {
  if (!actions || actions.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
      {actions.map(a => (
        <div
          key={a.key}
          className="ls-q"
          role="button"
          tabIndex={0}
          onClick={a.onClick}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.onClick() } }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.background = `${primary}0F` }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #E6EAF4)'; e.currentTarget.style.background = 'var(--surface, #fff)' }}
          style={{ border: '1px solid var(--border, #E6EAF4)', borderRadius: 14, padding: '15px 11px', textAlign: 'center', cursor: 'pointer', transition: 'transform .2s ease, border-color .2s ease, background .2s ease', background: 'var(--surface, #fff)', minWidth: 0, outline: 'none' }}
        >
          <span className="ls-q-ico" style={{ fontSize: 21, display: 'block', marginBottom: 7, transition: 'transform .2s ease' }}>{a.icon}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #141A2E)' }}>{a.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Weather strip ───────────────────────────────────────────────────────────
// Weather only matters as a delivery decision, so it gets a verdict attached
// and a strip rather than the large tile it used to occupy.
export function WeatherStrip({ weather, weatherError, icon, label }) {
  if (weatherError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', background: 'var(--surface2, #F8FAFC)', borderRadius: 18, border: '1px solid var(--border, #E6EAF4)', fontSize: 12, color: 'var(--text3, #5A6484)', fontWeight: 600 }}>
        <span style={{ fontSize: 19 }}>🌡️</span> Weather unavailable — add a city in Settings
      </div>
    )
  }
  if (!weather) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', background: 'var(--surface2, #F8FAFC)', borderRadius: 18, border: '1px solid var(--border, #E6EAF4)', fontSize: 12, color: 'var(--text3, #5A6484)', fontWeight: 600 }}>
        Loading weather…
      </div>
    )
  }

  const wet = weather.rainChance != null && weather.rainChance >= 50
  const windy = weather.wind >= 25
  const cold = weather.temp <= 6
  const verdict = wet ? 'Plan indoors' : windy ? 'Windy — secure kit' : cold ? 'Wrap up warm' : 'Good for outdoor'
  const verdictTone = wet || cold ? { bg: '#FFF4DE', fg: '#7A4D00', bd: '#F5DCB0' } : { bg: '#fff', fg: '#0B4A85', bd: '#D3E7FA' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 17px', background: 'linear-gradient(100deg, #E4F1FF, #F2F8FF)', borderRadius: 18, border: '1px solid #D3E7FA', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#0B4A85', lineHeight: 1, fontFamily: 'var(--font-display, sans-serif)' }}>{weather.temp}°</div>
        <div style={{ fontSize: 11.5, color: '#2E6A9E', fontWeight: 600, marginTop: 3 }}>
          {label} · {weather.city}{weather.high != null ? ` · ${weather.high}°/${weather.low}°` : ''}
        </div>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, background: verdictTone.bg, color: verdictTone.fg, padding: '5px 11px', borderRadius: 99, fontWeight: 700, border: `1px solid ${verdictTone.bd}`, whiteSpace: 'nowrap' }}>
        {verdict}
      </span>
    </div>
  )
}

export { INK }

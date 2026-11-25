import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Small, dependency-free charts for Reports & Insights and the report studio.
//
// Built by hand rather than pulled from a chart library: four chart shapes are
// all this needs, and a library would add more to the bundle than the whole
// reports section. Every chart draws one series in one colour -- the
// organisation's brand ink in the app, the same ink on paper -- with thin
// marks, hairline gridlines and a table view, so no value is reachable only
// by hovering.
//
// Colours arrive through a palette object because the same chart renders in
// two places: the app, where CSS variables follow the theme, and the printed
// document, which is always black on white.

export const APP_PALETTE = {
  mark: 'var(--org-ink, #1B6F7A)',
  grid: 'var(--border-soft, #EEF0F2)',
  axis: 'var(--border, #D7DBE0)',
  text: 'var(--text, #111827)',
  muted: 'var(--text3, #5D6472)',
  surface: 'var(--surface, #FFFFFF)',
  track: 'var(--surface2, #F3F4F6)',
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** The rendered width of a box, kept current as it resizes. */
export function useMeasuredWidth(fallback = 560) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setWidth(Math.round(w)) }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** A clean axis maximum: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(v) {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * p
}

/**
 * The same for whole-number counts, where a half-way gridline must also be a
 * whole number: "0, 1, 2" concerns, never "0, 0.5, 1" rounded to "0, 1, 1".
 */
export function niceMaxInt(v) {
  if (!(v > 0)) return 2
  if (v <= 2) return 2
  if (v <= 4) return 4
  if (v <= 6) return 6
  if (v <= 10) return 10
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

const PAD = { top: 18, right: 14, bottom: 26, left: 38 }

// Which x labels fit: every step-th one, and the last if it is not crowding
// the one before it.
function tickLabels(n, width) {
  const room = Math.max(1, Math.floor((width - PAD.left - PAD.right) / 58))
  const step = Math.max(1, Math.ceil(n / room))
  const lastRegular = Math.floor((n - 1) / step) * step
  return (i) => i % step === 0 || (i === n - 1 && n - 1 - lastRegular >= Math.ceil(step * 0.75))
}

function Tooltip({ x, width, title, value, palette }) {
  const left = Math.min(Math.max(x - 70, 0), Math.max(0, width - 140))
  return (
    <div role="presentation" style={{
      position: 'absolute', top: 0, left, width: 140, pointerEvents: 'none', zIndex: 2,
      background: palette.surface, border: `1px solid ${palette.axis}`, borderRadius: 10,
      boxShadow: '0 8px 22px rgba(15,23,42,0.14)', padding: '7px 10px',
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: palette.text, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: palette.muted, marginTop: 2, lineHeight: 1.3 }}>{title}</div>
    </div>
  )
}

function Frame({ chartRef, height, children, label, onKey, onLeave, focusable }) {
  return (
    <div
      ref={chartRef}
      role="img"
      aria-label={label}
      tabIndex={focusable ? 0 : undefined}
      onKeyDown={onKey}
      onBlur={onLeave}
      style={{ position: 'relative', width: '100%', height, outline: 'none', touchAction: 'pan-y' }}
    >
      {children}
    </div>
  )
}

function describe(points, format, title) {
  const vals = points.filter(p => p.value != null)
  if (!vals.length) return `${title}: no data in this period.`
  const first = vals[0]
  const last = vals[vals.length - 1]
  const max = vals.reduce((m, p) => (p.value > m.value ? p : m), vals[0])
  return `${title}. ${format(first.value)} in ${first.longLabel || first.label}, ${format(last.value)} in ${last.longLabel || last.label}. Highest ${format(max.value)} in ${max.longLabel || max.label}.`
}

function useCrosshair(n) {
  const [active, setActive] = useState(null)
  const onKey = (e) => {
    if (!n) return
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(a => (a == null ? 0 : Math.min(n - 1, a + 1))) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(a => (a == null ? n - 1 : Math.max(0, a - 1))) }
    if (e.key === 'Escape') setActive(null)
  }
  return [active, setActive, onKey]
}

/**
 * A line over time with a 10% wash beneath it.
 *
 * Gaps stay gaps: a week with no marked register has no attendance rate, and
 * joining across it would draw a rate nobody measured.
 */
export function LineChart({ points, format = String, height = 200, palette = APP_PALETTE, maxValue, title = 'Chart', interactive = true }) {
  const [ref, width] = useMeasuredWidth()
  const [active, setActive, onKey] = useCrosshair(points.length)
  const plotW = Math.max(40, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const dataMax = Math.max(0, ...points.map(p => p.value ?? 0))
  const yMax = maxValue ?? niceMax(dataMax)
  const x = (i) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v) => PAD.top + plotH - (Math.min(v, yMax) / yMax) * plotH
  const segments = []
  let seg = []
  points.forEach((p, i) => {
    if (p.value == null) { if (seg.length) segments.push(seg); seg = [] } else seg.push(i)
  })
  if (seg.length) segments.push(seg)
  let lastIdx = -1
  points.forEach((p, i) => { if (p.value != null) lastIdx = i })
  const showTick = tickLabels(points.length, width)
  const pick = (clientX) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || !points.length) return
    const rel = clientX - box.left - PAD.left
    const i = points.length <= 1 ? 0 : Math.round((rel / plotW) * (points.length - 1))
    setActive(Math.max(0, Math.min(points.length - 1, i)))
  }
  const a = active != null ? points[active] : null
  return (
    <Frame chartRef={ref} height={height} label={describe(points, format, title)} onKey={onKey} onLeave={() => setActive(null)} focusable={interactive}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true"
        onPointerMove={interactive ? (e) => pick(e.clientX) : undefined}
        onPointerDown={interactive ? (e) => pick(e.clientX) : undefined}
        onPointerLeave={interactive ? () => setActive(null) : undefined}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(yMax * f)} y2={y(yMax * f)} style={{ stroke: f === 0 ? palette.axis : palette.grid, strokeWidth: 1 }} />
            <text x={PAD.left - 7} y={y(yMax * f) + 4} textAnchor="end" style={{ fontSize: 10.5, fill: palette.muted, fontVariantNumeric: 'tabular-nums' }}>{format(yMax * f)}</text>
          </g>
        ))}
        {segments.map((s, k) => {
          const line = s.map((i, j) => `${j ? 'L' : 'M'}${x(i)},${y(points[i].value)}`).join(' ')
          const area = s.length > 1 ? `${line} L${x(s[s.length - 1])},${y(0)} L${x(s[0])},${y(0)} Z` : null
          return (
            <g key={k}>
              {area && <path d={area} style={{ fill: palette.mark, fillOpacity: 0.1, stroke: 'none' }} />}
              {s.length > 1
                ? <path d={line} style={{ fill: 'none', stroke: palette.mark, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
                : <circle cx={x(s[0])} cy={y(points[s[0]].value)} r={3} style={{ fill: palette.mark }} />}
            </g>
          )
        })}
        {lastIdx >= 0 && (
          <g>
            <circle cx={x(lastIdx)} cy={y(points[lastIdx].value)} r={4.5} style={{ fill: palette.mark, stroke: palette.surface, strokeWidth: 2 }} />
            <text x={Math.min(x(lastIdx), PAD.left + plotW)} y={y(points[lastIdx].value) - 10} textAnchor={x(lastIdx) > PAD.left + plotW - 30 ? 'end' : 'middle'}
              style={{ fontSize: 11.5, fontWeight: 800, fill: palette.text }}>{format(points[lastIdx].value)}</text>
          </g>
        )}
        {points.map((p, i) => showTick(i) && (
          <text key={i} x={x(i)} y={height - 7} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}
            style={{ fontSize: 10.5, fill: palette.muted }}>{p.label}</text>
        ))}
        {a && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} style={{ stroke: palette.axis, strokeWidth: 1 }} />
            {a.value != null && <circle cx={x(active)} cy={y(a.value)} r={4.5} style={{ fill: palette.mark, stroke: palette.surface, strokeWidth: 2 }} />}
          </g>
        )}
      </svg>
      {a && <Tooltip x={x(active)} width={width} title={a.longLabel || a.label} value={a.value == null ? 'No data' : format(a.value)} palette={palette} />}
    </Frame>
  )
}

/** Columns over time: one per week or month, rounded only at the data end. */
export function ColumnChart({ points, format = String, height = 200, palette = APP_PALETTE, title = 'Chart', interactive = true, integer = false }) {
  const [ref, width] = useMeasuredWidth()
  const [active, setActive, onKey] = useCrosshair(points.length)
  const plotW = Math.max(40, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const dataMax = Math.max(0, ...points.map(p => p.value ?? 0))
  const yMax = integer ? niceMaxInt(dataMax) : niceMax(dataMax)
  const band = plotW / Math.max(1, points.length)
  const barW = Math.max(3, Math.min(24, band - 2, band * 0.62))
  const cx = (i) => PAD.left + band * i + band / 2
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH
  const showTick = tickLabels(points.length, width)
  let maxIdx = -1
  points.forEach((p, i) => { if ((p.value ?? 0) > 0 && (maxIdx < 0 || p.value > points[maxIdx].value)) maxIdx = i })
  const lastIdx = points.length - 1
  const labelled = new Set([maxIdx, (points[lastIdx]?.value ?? 0) > 0 ? lastIdx : -1])
  const a = active != null ? points[active] : null
  const bar = (i, v) => {
    const h = Math.max(0, (v / yMax) * plotH)
    if (h <= 0) return null
    const r = Math.min(4, h, barW / 2)
    const x0 = cx(i) - barW / 2
    const x1 = cx(i) + barW / 2
    const yb = PAD.top + plotH
    const yt = yb - h
    return `M${x0},${yb} L${x0},${yt + r} Q${x0},${yt} ${x0 + r},${yt} L${x1 - r},${yt} Q${x1},${yt} ${x1},${yt + r} L${x1},${yb} Z`
  }
  return (
    <Frame chartRef={ref} height={height} label={describe(points, format, title)} onKey={onKey} onLeave={() => setActive(null)} focusable={interactive}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true"
        onPointerLeave={interactive ? () => setActive(null) : undefined}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(yMax * f)} y2={y(yMax * f)} style={{ stroke: f === 0 ? palette.axis : palette.grid, strokeWidth: 1 }} />
            <text x={PAD.left - 7} y={y(yMax * f) + 4} textAnchor="end" style={{ fontSize: 10.5, fill: palette.muted, fontVariantNumeric: 'tabular-nums' }}>{format(yMax * f)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const d = p.value > 0 ? bar(i, p.value) : null
          return (
            <g key={i}>
              {d && <path d={d} style={{ fill: palette.mark, opacity: active == null || active === i ? 1 : 0.55, transition: 'opacity 120ms' }} />}
              {d && labelled.has(i) && active == null && (
                <text x={cx(i)} y={y(p.value) - 6} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: palette.text }}>{format(p.value)}</text>
              )}
              {interactive && (
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} style={{ fill: 'transparent', cursor: 'default' }}
                  onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
              )}
            </g>
          )
        })}
        {points.map((p, i) => showTick(i) && (
          <text key={`t${i}`} x={cx(i)} y={height - 7} textAnchor="middle" style={{ fontSize: 10.5, fill: palette.muted }}>{p.label}</text>
        ))}
      </svg>
      {a && <Tooltip x={cx(active)} width={width} title={a.longLabel || a.label} value={format(a.value ?? 0)} palette={palette} />}
    </Frame>
  )
}

/**
 * Horizontal bars for a breakdown.
 *
 * `total` is the whole the shares are taken of, passed in rather than summed
 * from the rows, because the rows are often the top ten of something longer.
 */
export function BarList({ rows, format = String, total, palette = APP_PALETTE, showShare = true, max = 8 }) {
  const list = (rows || []).filter(r => r && r.value > 0).slice(0, max)
  if (!list.length) return null
  const top = Math.max(...list.map(r => r.value))
  const whole = total || list.reduce((t, r) => t + r.value, 0)
  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map(r => {
        const share = whole > 0 ? Math.round((r.value / whole) * 100) : null
        return (
          <div role="listitem" key={r.label} title={`${r.label}: ${format(r.value)}${share != null && showShare ? ` (${share}%)` : ''}`}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: palette.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 800, color: palette.text, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {format(r.value)}{showShare && share != null && <span style={{ fontWeight: 600, color: palette.muted }}> · {share}%</span>}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: palette.track, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, height: '100%', borderRadius: '0 4px 4px 0', background: palette.mark }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A twelve-or-so point trend inside a stat tile: quiet line, accented end. */
export function Sparkline({ values, width = 88, height = 26, color = 'var(--org-ink, #1B6F7A)', muted = 'var(--text-faint, #9CA3AF)' }) {
  const pts = (values || []).map((v, i) => ({ v, i })).filter(p => p.v != null)
  if (pts.length < 2) return null
  const max = Math.max(...pts.map(p => p.v))
  const min = Math.min(0, ...pts.map(p => p.v))
  const n = values.length - 1
  const x = (i) => 2 + (i / n) * (width - 4)
  const y = (v) => height - 3 - ((v - min) / Math.max(1e-9, max - min)) * (height - 6)
  const d = pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} style={{ fill: 'none', stroke: muted, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} style={{ fill: color }} />
    </svg>
  )
}

/** The table behind a chart: what a screen reader, a printer or a sceptic reads. */
export function DataTable({ columns, rows, palette = APP_PALETTE, compact = false }) {
  if (!rows?.length) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 11.5 : 12.5 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} scope="col" style={{
                textAlign: i === 0 ? 'left' : 'right', padding: '0 0 6px', whiteSpace: 'nowrap', fontSize: 10.5,
                fontWeight: 800, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${palette.axis}`,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {columns.map((c, i) => (
                <td key={c.key} style={{
                  padding: compact ? '5px 0' : '7px 0', borderBottom: `1px solid ${palette.grid}`, textAlign: i === 0 ? 'left' : 'right',
                  color: i === 0 ? palette.text : palette.muted, fontWeight: i === 0 ? 650 : 500, whiteSpace: i === 0 ? 'normal' : 'nowrap',
                  fontVariantNumeric: i === 0 ? undefined : 'tabular-nums', paddingLeft: i === 0 ? 0 : 10,
                }}>{c.format ? c.format(r[c.key]) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

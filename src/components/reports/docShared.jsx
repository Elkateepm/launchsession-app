import React from 'react'

// The shared look of every report document.
//
// A report is not a dashboard. It is printed, attached to an email, and read by
// somebody with no access to this app -- a trustee, a funder, a local authority
// commissioner -- so it is black on white, prose and tables, and every figure
// carries the words that say what it counts.
//
// One set of primitives rather than one per report, because nine documents that
// each invent their own heading weight is how a report pack stops looking like
// it came from one organisation.

export const INK = '#111827'
export const MUTED = '#6B7280'
export const RULE = '#E5E7EB'

export const PRINT_CSS = `
@media print {
  /* Everything except the document. The old Print button printed the
     dashboard, the nav and the modal chrome along with the report. */
  body > * { display: none !important; }
  body > #ls-doc-print-root { display: block !important; }
  #ls-doc-print-root { position: static !important; inset: auto !important;
    background: #fff !important; overflow: visible !important; }
  #ls-doc-toolbar { display: none !important; }
  #ls-doc-paper { box-shadow: none !important; border: none !important;
    margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .ls-doc-section { break-inside: avoid; page-break-inside: avoid; }
  a[href]:after { content: "" !important; }
}
@page { margin: 18mm 16mm; }
`

/** One signed-number format for every document, with a typographic minus. */
export const signedTenth = (n) => {
  const v = Number(n)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
}

export const formatPeriod = (from, to) => {
  const o = { day: 'numeric', month: 'long', year: 'numeric' }
  return `${new Date(`${from}T12:00:00`).toLocaleDateString('en-GB', o)} to ${new Date(`${to}T12:00:00`).toLocaleDateString('en-GB', o)}`
}

export function Section({ title, hint, children }) {
  return (
    <section className="ls-doc-section" style={{ marginTop: 30 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: INK, letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</h2>
      {hint && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      <div style={{ height: 1, background: RULE, margin: '10px 0 14px' }} />
      {children}
    </section>
  )
}

export function Figures({ items, isMobile }) {
  // Tolerates a missing list, not only an empty one: a section that declares no
  // figures at all passes undefined, and every other primitive here already
  // survives that.
  const shown = (items || []).filter(Boolean)
  if (!shown.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : `repeat(${Math.min(shown.length, 4)},1fr)`, gap: 16 }}>
      {shown.map(f => (
        <div key={f.label}>
          <div style={{ fontSize: 26, fontWeight: 900, color: INK, letterSpacing: -0.6, lineHeight: 1.1 }}>{f.value}</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>{f.label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * A labelled distribution.
 *
 * `total` is passed rather than summed from the rows, because these lists are
 * often the top ten of something longer and a percentage of the visible rows
 * would quietly overstate every one of them.
 */
export function Distribution({ rows, total, suffix = '' }) {
  const list = (rows || []).filter(r => r && r.n > 0)
  if (!list.length) return null
  const denom = total || list.reduce((s, r) => s + r.n, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {list.map(r => {
        const pct = denom > 0 ? Math.round((r.n / denom) * 100) : 0
        return (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '132px 1fr 82px', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ height: 9, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', display: 'block' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: INK, borderRadius: 2 }} />
            </span>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, textAlign: 'right' }}>{r.n}{suffix} · {pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

/** Plain ranked list, for things where a bar would imply a proportion. */
export function RankedList({ rows, unit = '' }) {
  const list = (rows || []).filter(Boolean)
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: i === list.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 12.5, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: MUTED, fontWeight: 800, flexShrink: 0 }}>{r.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

export function Table({ columns, rows }) {
  if (!rows || !rows.length) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} style={{
                textAlign: i === 0 ? 'left' : 'right', padding: '0 0 7px', whiteSpace: 'nowrap',
                fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase',
                letterSpacing: 0.4, borderBottom: `1px solid ${RULE}`,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {columns.map((c, i) => (
                <td key={c.key} style={{
                  padding: '8px 0', borderBottom: '1px solid #F3F4F6',
                  textAlign: i === 0 ? 'left' : 'right',
                  fontWeight: i === 0 ? 700 : c.strong ? 900 : 400,
                  color: i === 0 || c.strong ? INK : MUTED,
                  whiteSpace: 'nowrap',
                }}>{r[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Prose({ lines }) {
  const list = (lines || []).filter(Boolean)
  if (!list.length) return null
  return list.map((p, i) => (
    <p key={i} style={{ margin: i ? '9px 0 0' : 0, fontSize: 13.5, lineHeight: 1.65, color: '#1F2937' }}>{p}</p>
  ))
}

export function Caveats({ items }) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return null
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {list.map((c, i) => (
        <li key={i} style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginBottom: 6 }}>{c}</li>
      ))}
    </ul>
  )
}

/**
 * The page a document sits on: sticky toolbar, date pickers, print, and the
 * sheet itself. Shared so a report cannot end up with its own idea of what a
 * printed page looks like.
 */
export function DocShell({
  title, org, docTitle, from, to, onFrom, onTo, onClose, onPrint,
  loading, error, generatedAt, children, isMobile, footerNote,
}) {
  const ctl = {
    padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0',
    fontSize: 13, fontFamily: 'inherit', minHeight: 40, background: '#fff', color: INK,
  }
  return (
    <div id="ls-doc-print-root" style={{ position: 'fixed', inset: 0, zIndex: 10500, background: '#F1F5F9', overflowY: 'auto' }}>
      <style>{PRINT_CSS}</style>

      <div id="ls-doc-toolbar" style={{
        position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: isMobile ? '10px 14px' : '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={{ ...ctl, cursor: 'pointer', fontWeight: 800, border: 'none', background: '#F1F5F9' }}>← Back</button>
        <div style={{ fontSize: 13.5, fontWeight: 900, color: INK, marginRight: 'auto' }}>{title}</div>
        <input type="date" value={from} onChange={e => onFrom(e.target.value)} style={ctl} aria-label="Period start" />
        <input type="date" value={to} onChange={e => onTo(e.target.value)} style={ctl} aria-label="Period end" />
        <button onClick={onPrint} disabled={loading || !!error} style={{
          ...ctl, cursor: loading || error ? 'default' : 'pointer', fontWeight: 800, border: 'none',
          background: loading || error ? '#CBD5E1' : INK, color: '#fff',
        }}>Print or save as PDF</button>
      </div>

      <div id="ls-doc-paper" style={{
        maxWidth: 820, margin: isMobile ? '14px 10px' : '22px auto', background: '#fff',
        padding: isMobile ? '26px 20px' : '46px 52px', borderRadius: isMobile ? 12 : 4,
        boxShadow: '0 10px 40px rgba(15,23,42,0.10)', color: INK, boxSizing: 'border-box',
      }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Building the report…</div>
        ) : error ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Could not build the report</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>{error}</div>
          </div>
        ) : (
          <>
            <header>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: MUTED, textTransform: 'uppercase' }}>{org?.name}</div>
              <h1 style={{ margin: '8px 0 0', fontSize: isMobile ? 24 : 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.15 }}>{docTitle}</h1>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>{formatPeriod(from, to)}</div>
            </header>
            {children}
            <footer style={{ marginTop: 34, paddingTop: 14, borderTop: `1px solid ${RULE}`, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
              Produced by {org?.name} on {new Date(generatedAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              {' '}{footerNote || 'Figures are drawn directly from records kept at the point of delivery.'}
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

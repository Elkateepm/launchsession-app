import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { areaByKey } from '../impact/impact_shared'
import {
  getFunderMetrics, buildNarrative, buildCaveats, formatPeriod, AGE_BANDS, DOSE_BANDS,
} from '../../lib/funderReport'
import Icon from '../../lib/icons'

// A funder report is a document, not a dashboard. It is printed, attached to an
// email, and read by somebody with no access to this app and no interest in
// clicking anything -- so it is laid out as pages of prose and tables, in black
// on white, and every figure carries the words that say what it counts.
//
// The old builder previewed the same fourteen overview numbers for all nine
// report types and offered window.print(), which printed the app around it.

const INK = '#111827'
const MUTED = '#6B7280'
const RULE = '#E5E7EB'

// One signed number format for the whole document. A typographic minus, not a
// hyphen: the table and the headline figure sat on the same page using
// different characters for the same idea.
const signedTenth = (n) => {
  const v = Number(n)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
}

const PRINT_CSS = `
@media print {
  /* Everything except the document itself. The old Print button printed the
     dashboard, the nav and the modal chrome along with the report. */
  body > * { display: none !important; }
  body > #ls-funder-print-root { display: block !important; }
  #ls-funder-print-root { position: static !important; inset: auto !important;
    background: #fff !important; overflow: visible !important; }
  #ls-funder-toolbar { display: none !important; }
  #ls-funder-doc { box-shadow: none !important; border: none !important;
    margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .ls-fr-section { break-inside: avoid; page-break-inside: avoid; }
  .ls-fr-page-break { break-before: page; page-break-before: always; }
  a[href]:after { content: "" !important; }
}
@page { margin: 18mm 16mm; }
`

function Section({ title, children, hint }) {
  return (
    <section className="ls-fr-section" style={{ marginTop: 30 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: INK, letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</h2>
      {hint && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{hint}</div>}
      <div style={{ height: 1, background: RULE, margin: '10px 0 14px' }} />
      {children}
    </section>
  )
}

function Figures({ items, isMobile }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : `repeat(${Math.min(items.length, 4)},1fr)`, gap: 16 }}>
      {items.map(f => (
        <div key={f.label}>
          <div style={{ fontSize: 26, fontWeight: 900, color: INK, letterSpacing: -0.6, lineHeight: 1.1 }}>{f.value}</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>{f.label}</div>
        </div>
      ))}
    </div>
  )
}

/** A labelled distribution. Bars are printed as outlines so they survive mono. */
function Distribution({ rows, total }) {
  if (!total) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(r => {
        const pct = total > 0 ? Math.round((r.n / total) * 100) : 0
        return (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '108px 1fr 76px', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>{r.label}</span>
            <span style={{ height: 9, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', display: 'block' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: INK, borderRadius: 2 }} />
            </span>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, textAlign: 'right' }}>{r.n} · {pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

export default function FunderReport({ org, range, onClose }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const [m, setM] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(range?.from || '')
  const [to, setTo] = useState(range?.to || '')

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true); setError('')
    try {
      setM(await getFunderMetrics({ from, to }))
    } catch (e) {
      setError(e.message || 'Could not build the report.')
      setM(null)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const narrative = useMemo(() => buildNarrative(m, terms, org?.name || 'The organisation'), [m, terms, org])
  const caveats = useMemo(() => buildCaveats(m, terms), [m, terms])

  const reach = m?.reach || {}
  const eng = m?.engagement || {}
  const del = m?.delivery || {}
  const att = m?.attendance || {}
  const out = m?.outcomes || {}

  const ageRows = AGE_BANDS
    .map(b => ({ label: b.label, n: reach.age_bands?.[b.key] || 0 }))
    .filter(r => r.n > 0)
  const doseRows = DOSE_BANDS.map(b => ({ label: b.label, n: eng[b.key] || 0 })).filter(r => r.n > 0)

  const ctl = {
    padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0',
    fontSize: 13, fontFamily: 'inherit', minHeight: 40, background: '#fff', color: INK,
  }

  return (
    <div id="ls-funder-print-root" style={{
      position: 'fixed', inset: 0, zIndex: 10500, background: '#F1F5F9', overflowY: 'auto',
    }}>
      <style>{PRINT_CSS}</style>

      <div id="ls-funder-toolbar" style={{
        position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: isMobile ? '10px 14px' : '12px 20px',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={{ ...ctl, cursor: 'pointer', fontWeight: 800, border: 'none', background: '#F1F5F9' }}>
          <Icon name="←" /> Back
        </button>
        <div style={{ fontSize: 13.5, fontWeight: 900, color: INK, marginRight: 'auto' }}>Funder report</div>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={ctl} aria-label="Period start" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={ctl} aria-label="Period end" />
        <button onClick={() => window.print()} disabled={!m} style={{
          ...ctl, cursor: m ? 'pointer' : 'default', fontWeight: 800, border: 'none',
          background: m ? INK : '#CBD5E1', color: '#fff',
        }}>Print or save as PDF</button>
      </div>

      <div id="ls-funder-doc" style={{
        maxWidth: 820, margin: isMobile ? '14px 10px' : '22px auto', background: '#fff',
        padding: isMobile ? '26px 20px' : '46px 52px',
        borderRadius: isMobile ? 12 : 4, boxShadow: '0 10px 40px rgba(15,23,42,0.10)',
        color: INK, boxSizing: 'border-box',
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
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: MUTED, textTransform: 'uppercase' }}>
                {org?.name}
              </div>
              <h1 style={{ margin: '8px 0 0', fontSize: isMobile ? 24 : 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.15 }}>
                Impact and delivery report
              </h1>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>{formatPeriod(from, to)}</div>
            </header>

            <Section title="Summary">
              {narrative.map((p, i) => (
                <p key={i} style={{ margin: i ? '9px 0 0' : 0, fontSize: 13.5, lineHeight: 1.65, color: '#1F2937' }}>{p}</p>
              ))}
            </Section>

            <Section title={`Who we reached`} hint={`Counted as ${terms.people} who attended at least once in the period, not places offered.`}>
              <Figures isMobile={isMobile} items={[
                { value: reach.people ?? 0, label: `${terms.people} reached` },
                { value: reach.new_to_us ?? 0, label: 'new to us this period' },
                { value: reach.returning ?? 0, label: 'had attended before' },
                { value: reach.with_sen ?? 0, label: 'with recorded additional needs' },
              ]} />
              {ageRows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, marginBottom: 9 }}>BY AGE</div>
                  <Distribution rows={ageRows} total={reach.people || 0} />
                </div>
              )}
              {reach.schools > 0 && (
                <p style={{ fontSize: 12.5, color: MUTED, marginTop: 16, marginBottom: 0 }}>
                  Drawn from {reach.schools} {reach.schools === 1 ? 'school' : 'different schools'}.
                </p>
              )}
            </Section>

            <Section title="How much they got"
              hint="How often each person actually came. Reaching many people once and working closely with a few are different programmes, and a headcount alone cannot tell them apart.">
              <Figures isMobile={isMobile} items={[
                { value: eng.median_sessions != null ? Math.round(eng.median_sessions) : '—', label: `sessions attended by the median ${terms.person}` },
                { value: eng.total_attendances ?? 0, label: 'attendances in total' },
                { value: del.participant_hours ? `${del.participant_hours}h` : '—', label: `hours of provision received across all ${terms.people}` },
                ...(eng.retained != null && eng.retention_base > 0 ? [{
                  value: `${Math.round((eng.retained / eng.retention_base) * 100)}%`,
                  label: 'still attending in the second half of the period',
                }] : []),
              ]} />
              {doseRows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, marginBottom: 9 }}>SESSIONS ATTENDED PER {terms.Person.toUpperCase()}</div>
                  <Distribution rows={doseRows} total={reach.people || 0} />
                </div>
              )}
            </Section>

            <Section title="What we delivered">
              <Figures isMobile={isMobile} items={[
                { value: del.sessions_delivered ?? 0, label: 'sessions delivered' },
                { value: del.contact_hours ? `${del.contact_hours}h` : '—', label: 'hours of provision run' },
                { value: del.locations ?? 0, label: 'locations used' },
                { value: att.rate != null ? `${att.rate}%` : '—', label: 'attendance rate' },
              ]} />
              {att.rate != null && att.prev_rate != null && (
                <p style={{ fontSize: 12.5, color: MUTED, marginTop: 16, marginBottom: 0 }}>
                  Attendance was {att.prev_rate}% in the preceding period of the same length,
                  {att.rate === att.prev_rate ? ' unchanged.' : ` a change of ${att.rate > att.prev_rate ? '+' : '−'}${Math.abs(att.rate - att.prev_rate)} points.`}
                </p>
              )}
            </Section>

            <Section title="What changed"
              hint={`Distance travelled: the difference between each ${terms.person}'s first and most recent score in the period. Only those scored at least twice can be included.`}>
              {out.measured > 0 ? (
                <>
                  <Figures isMobile={isMobile} items={[
                    { value: out.improved ?? 0, label: 'improved' },
                    { value: out.held ?? 0, label: 'held steady' },
                    { value: out.declined ?? 0, label: 'declined' },
                    { value: out.avg_delta != null ? signedTenth(out.avg_delta) : '—', label: 'average change, out of 10' },
                  ]} />
                  {out.by_area?.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 22, fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          {['Outcome area', terms.People, 'Start', 'Latest', 'Change'].map((h, i) => (
                            <th key={h} style={{
                              textAlign: i === 0 ? 'left' : 'right', padding: '0 0 7px',
                              fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase',
                              letterSpacing: 0.4, borderBottom: `1px solid ${RULE}`,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {out.by_area.map(a => (
                          <tr key={a.area}>
                            <td style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontWeight: 700 }}>{areaByKey(a.area).label}</td>
                            <td style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', textAlign: 'right', color: MUTED }}>{a.people}</td>
                            <td style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', textAlign: 'right', color: MUTED }}>{Number(a.baseline).toFixed(1)}</td>
                            <td style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>{Number(a.latest).toFixed(1)}</td>
                            <td style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontWeight: 900 }}>
                              {signedTenth(a.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
                  No {terms.person} has both a starting and a later score inside this period, so no
                  change can be evidenced. A first score records a starting point; a second one
                  taken later is what turns it into a result.
                </p>
              )}
              {m?.goals?.completed > 0 && (
                <p style={{ fontSize: 12.5, color: MUTED, marginTop: 18, marginBottom: 0 }}>
                  {m.goals.completed} individual {m.goals.completed === 1 ? 'goal was' : 'goals were'} agreed and met during the period.
                </p>
              )}
            </Section>

            <Section title="Safeguarding">
              <p style={{ fontSize: 13, lineHeight: 1.65, color: '#1F2937', margin: 0 }}>
                Safeguarding concerns are recorded and tracked to resolution in this system.
                {' '}{m?.safeguarding?.open_concerns === 0
                  ? 'No concerns were open at the time this report was produced.'
                  : `${m?.safeguarding?.open_concerns} ${m?.safeguarding?.open_concerns === 1 ? 'concern was' : 'concerns were'} open at the time this report was produced.`}
                {' '}No identifying detail is included in a report of this kind.
              </p>
            </Section>

            <Section title="What this report does not cover"
              hint="Stated so the figures above can be read for exactly what they are.">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {caveats.map((c, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginBottom: 6 }}>{c}</li>
                ))}
              </ul>
            </Section>

            <footer style={{ marginTop: 34, paddingTop: 14, borderTop: `1px solid ${RULE}`, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
              Produced by {org?.name} on {new Date(m?.generated_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              {' '}Figures are drawn directly from attendance registers and outcome records kept at the point of delivery.
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

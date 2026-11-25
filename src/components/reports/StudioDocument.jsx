import React from 'react'
import { buildSpec } from '../../lib/reportDocs'
import {
  buildFacts, buildKpis, fmtCount, fmtHours, fmtRate, formatRange, previousPeriod, redactForViewer,
} from '../../lib/insights'
import { breakdownRows, includesSafeguarding, sectionByKey, sectionLabel, withoutNamedSections } from '../../lib/reportStudio'
import { BarList, ColumnChart, DataTable, LineChart } from './charts'
import {
  DocFooter, DocMasthead, INK, MUTED, RULE, RULE_SOFT, Section, SpecSections, docBrand, formatPeriod,
} from './docShared'

// A studio report as a document: the live preview while it is being built,
// and exactly what prints. Black on white with the organisation's brand ink,
// prose and tables, every figure carrying the words that say what it counts.

const FORMAT = { rate: fmtRate, hours: fmtHours, count: fmtCount }

export function docPalette(org) {
  const b = docBrand(org)
  return { mark: b.ink, grid: RULE_SOFT, axis: RULE, text: INK, muted: MUTED, surface: '#FFFFFF', track: '#F1F2F4' }
}

function Placeholder({ children }) {
  // Visible while building, gone from the printed page.
  return (
    <div className="ls-studio-placeholder" style={{ border: `1.5px dashed ${RULE}`, borderRadius: 10, padding: '14px 16px', fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function Paragraphs({ text }) {
  const parts = String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return parts.map((p, i) => (
    <p key={i} style={{ margin: i ? '10px 0 0' : 0, fontSize: 14, lineHeight: 1.7, color: '#1F2937', whiteSpace: 'pre-line' }}>{p}</p>
  ))
}

function Headline({ tiles, isMobile, comparison }) {
  if (!tiles.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : `repeat(${Math.min(tiles.length, 3)},minmax(0,1fr))`, gap: isMobile ? 14 : 18 }}>
      {tiles.map(t => (
        <div key={t.key} style={{ borderTop: `2px solid ${RULE}`, paddingTop: 10 }}>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: INK, letterSpacing: -0.6, lineHeight: 1.05 }}>{t.display}</div>
          <div style={{ fontSize: 12, color: INK, fontWeight: 700, marginTop: 4, lineHeight: 1.35 }}>{t.label}</div>
          {t.change && (
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>
              {t.change.direction === 'up' ? '▲ ' : t.change.direction === 'down' ? '▼ ' : ''}{t.change.text}{t.previousDisplay != null ? ` (was ${t.previousDisplay})` : ''}
            </div>
          )}
        </div>
      ))}
      {comparison && <div style={{ gridColumn: '1 / -1', fontSize: 11, color: MUTED }}>Changes compare with {comparison}.</div>}
    </div>
  )
}

export default function StudioDocument({ def, model: rawModel, docs = {}, org, terms, range, isAdmin, isMobile, filterLabels = [], loadingDocs = [], interactive = true }) {
  const model = redactForViewer(rawModel, isAdmin)
  const palette = docPalette(org)
  const prev = range?.valid ? previousPeriod(range) : null
  const filtered = filterLabels.length > 0
  const tableFor = (points, format, label) => (
    <div style={{ marginTop: 14 }}>
      <DataTable palette={palette} compact columns={[{ key: 'longLabel', label: 'Period' }, { key: 'value', label, format }]} rows={points} />
    </div>
  )

  const render = (key) => {
    const s = sectionByKey(key)
    if (!s || (s.restricted && !isAdmin)) return null
    const title = sectionLabel(key, terms)

    if (s.kind === 'narrative') {
      const text = def.text?.[s.field]
      if (!text?.trim()) return <section key={key} style={{ marginTop: 26 }}><Placeholder>{s.field === 'closing' ? 'Your closing words will appear here. Write them in the panel, or remove this section.' : 'Your introduction will appear here. Write it in the panel, or remove this section.'}</Placeholder></section>
      return (
        <section key={key} className="ls-doc-section" style={{ marginTop: 26 }}>
          {s.field === 'closing' && <h2 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 900, color: INK, letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</h2>}
          <Paragraphs text={text} />
        </section>
      )
    }

    if (!model) return <Section key={key} title={title}><Placeholder>Loading figures…</Placeholder></Section>

    if (s.kind === 'kpis') {
      const tiles = buildKpis(model, def.kpis, terms)
      return (
        <Section key={key} title={title}>
          {tiles.length ? <Headline tiles={tiles} isMobile={isMobile} comparison={prev ? formatRange(prev.from, prev.to) : null} /> : <Placeholder>None of the chosen figures has data for this period.</Placeholder>}
        </Section>
      )
    }

    if (s.kind === 'facts') {
      const facts = buildFacts(model, terms, { max: 8, skip: includesSafeguarding(def) ? [] : ['concerns'] })
      if (!facts.length) return null
      return (
        <Section key={key} title={title}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {facts.map(f => <li key={f.key} style={{ fontSize: 13.5, lineHeight: 1.6, color: '#1F2937', marginBottom: 6 }}>{f.text}</li>)}
          </ul>
        </Section>
      )
    }

    if (s.kind === 'chart') {
      const format = FORMAT[s.format] || fmtCount
      const points = model.series.map(p => ({ label: p.label, longLabel: p.longLabel, value: p[s.metric] }))
      const has = points.some(p => p.value != null && p.value !== 0) || (s.metric === 'rate' && points.some(p => p.value != null))
      const unit = model.bucket === 'week' ? 'Weekly' : 'Monthly'
      return (
        <Section key={key} title={title} hint={`${unit}. ${key === 'trend_safeguarding' ? 'Counts only, across the whole organisation.' : s.desc}`}>
          {!has ? (
            <div style={{ fontSize: 13, color: MUTED }}>Nothing recorded in this period.</div>
          ) : (
            <>
              {s.chart === 'line'
                ? <LineChart points={points} format={format} maxValue={s.metric === 'rate' ? 100 : undefined} height={190} palette={palette} title={title} interactive={interactive} />
                : <ColumnChart integer={s.format === 'count'} points={points} format={format} height={190} palette={palette} title={title} interactive={interactive} />}
              {def.showTables && tableFor(points, format, title)}
            </>
          )}
        </Section>
      )
    }

    if (s.kind === 'breakdown') {
      const b = breakdownRows(key, model, terms)
      if (!b.rows.length) return null
      const whole = b.value === 'reached' ? model.current.reached : model.current.sessions_delivered
      return (
        <Section key={key} title={title} hint={b.value === 'reached' ? `${terms.People} reached.` : `${terms.Sessions} delivered.`}>
          <BarList rows={b.rows.map(r => ({ label: r.label, value: r[b.value] }))} format={fmtCount} palette={palette}
            total={whole} showShare={key !== 'by_group'} max={12} />
          {def.showTables && <div style={{ marginTop: 14 }}><DataTable palette={palette} compact columns={b.columns} rows={b.rows} /></div>}
        </Section>
      )
    }

    if (s.kind === 'doc') {
      if (loadingDocs.includes(s.doc)) return <Section key={key} title={title}><Placeholder>Loading…</Placeholder></Section>
      const m = docs[s.doc]
      if (!m) return null
      const spec = withoutNamedSections(buildSpec(s.doc, m, terms), def.includeNames)
      if (!spec?.sections?.length) return null
      return (
        <div key={key} style={{ marginTop: 38 }}>
          <h2 className="ls-doc-section" style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 900, color: INK, letterSpacing: -0.4, paddingBottom: 8, borderBottom: `3px solid ${palette.mark}` }}>{title}</h2>
          {filtered && (
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              This part covers all of the organisation’s work in the period; the project and {terms.group} choices above do not narrow it.
            </div>
          )}
          <SpecSections sections={spec.sections} isMobile={isMobile} />
        </div>
      )
    }
    return null
  }

  return (
    <>
      <DocMasthead org={org} docTitle={def.title} subtitle={range?.valid ? formatPeriod(range.from, range.to) : 'Choose a period'} isMobile={isMobile} />
      {filtered && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
          <strong style={{ color: INK }}>Covers:</strong> {filterLabels.join(' · ')}
        </div>
      )}
      {def.sections.map(render)}
      <DocFooter org={org} generatedAt={model?.generatedAt}
        note={`Figures are drawn directly from records kept at the point of delivery. Counts and aggregates only${def.includeNames ? ', except where a section lists people by name' : '; no individual is named'}.`} />
    </>
  )
}

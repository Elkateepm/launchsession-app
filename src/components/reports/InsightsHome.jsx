import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../lib/icons'
import {
  HOME_KPIS, buildFacts, buildKpis, comparisonPhrase, fmtCount, fmtHours, fmtRate, formatRange,
  isEmptyPeriod, previousPeriod, redactForViewer, resolvePeriod,
} from '../../lib/insights'
import { breakdownRows, csvFilename, reportCsvBlocks, toCsv } from '../../lib/reportStudio'
import { downloadCsv, loadInsights } from '../../lib/insightsService'
import { BarList, ColumnChart, DataTable, LineChart, useMeasuredWidth } from './charts'
import {
  FactList, KpiTile, MultiSelectSheet, PeriodPicker, SectionLabel, btn, card, chipStyle,
} from './insightsUi'

// The Reports & Insights home: how the work is going, against what, and where.
//
// One period and one set of filters govern everything on the page, so every
// tile, chart and finding describes the same slice of the work and the
// numbers always agree with each other.

// As many tiles to a row as fit, but never one left alone on the last row:
// seven tiles go four and three rather than six and one.
export function balancedColumns(n, maxCols) {
  const max = Math.max(1, Math.min(n, maxCols))
  // Two columns and an odd count always leave one over, so below three there
  // is nothing to balance.
  for (let c = max; c > 2; c--) {
    const rem = n % c
    if (rem === 0 || rem >= Math.ceil(c / 2)) return c
  }
  return max
}

const HOME_SECTIONS = ['headline', 'facts', 'trend_attendance', 'trend_sessions', 'trend_reach', 'trend_volunteers', 'trend_safeguarding', 'by_project', 'by_group', 'by_location', 'by_age']

function ChartCard({ title, subtitle, summary, children, table, isMobile, empty }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section style={card({ padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 12 })} aria-label={title}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 850, color: 'var(--text)', letterSpacing: -0.1 }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {summary && <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 850, color: 'var(--text)', lineHeight: 1.1 }}>{summary.value}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700 }}>{summary.label}</div>
        </div>}
      </header>
      {empty ? (
        <div style={{ padding: '22px 6px', textAlign: 'center', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, background: 'var(--surface2)', borderRadius: 12 }}>{empty}</div>
      ) : showTable ? table : children}
      {!empty && table && (
        <button type="button" onClick={() => setShowTable(v => !v)} aria-pressed={showTable}
          style={{ ...btn('quiet', isMobile), alignSelf: 'flex-start', minHeight: isMobile ? 40 : 30, padding: 0, fontSize: 12 }}>
          <Icon name={showTable ? 'insights' : 'fields'} size={14} />{showTable ? 'Show chart' : 'Show as table'}
        </button>
      )}
    </section>
  )
}

const seriesTable = (points, format, label) => (
  <DataTable
    columns={[{ key: 'longLabel', label: 'Period' }, { key: 'value', label, format }]}
    rows={points}
  />
)

export default function InsightsHome({ org, role, terms, isMobile, attention, onAttention, onBuildReport, onRangeChange }) {
  const isAdmin = ['owner', 'admin'].includes(role)
  const [period, setPeriod] = useState({ key: '90d', from: '', to: '' })
  const [projects, setProjects] = useState([])
  const [groups, setGroups] = useState([])
  const [sheet, setSheet] = useState(null)
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef(0)
  const [gridRef, gridWidth] = useMeasuredWidth(1000)

  const range = useMemo(() => resolvePeriod(period.key, { from: period.from, to: period.to }), [period])

  useEffect(() => { if (range.valid) onRangeChange?.({ from: range.from, to: range.to }) }, [range, onRangeChange])

  const load = useCallback(async () => {
    if (!range.valid || !org?.id) return
    const id = ++request.current
    setLoading(true); setError('')
    try {
      const m = await loadInsights({ from: range.from, to: range.to, projects, groups })
      if (id === request.current) setModel(redactForViewer(m, isAdmin))
    } catch (e) {
      if (id === request.current) setError(e.message || 'Could not load your figures.')
    }
    if (id === request.current) setLoading(false)
  }, [range, projects, groups, org?.id, isAdmin])

  useEffect(() => { load() }, [load])

  const prev = range.valid ? previousPeriod(range) : null
  const tiles = useMemo(() => buildKpis(model, HOME_KPIS, terms), [model, terms])
  const facts = useMemo(() => buildFacts(model, terms, { max: isMobile ? 4 : 6 }), [model, terms, isMobile])
  const caps = model?.capabilities || {}
  const options = model?.options || { projects: [], groups: [] }
  const projectName = (id) => options.projects.find(p => p.id === id)?.name || 'Project'
  const filterLabels = [
    ...projects.map(id => `Project: ${projectName(id)}`),
    ...groups.map(g => `${terms.Group}: ${g}`),
  ]
  const hasFilters = projects.length > 0 || groups.length > 0
  const firstLoad = loading && !model
  const empty = model && isEmptyPeriod(model)
  const bucketWord = model?.bucket === 'week' ? 'Weekly' : 'Monthly'
  const series = model?.series || []
  const pts = (field) => series.map(p => ({ label: p.label, longLabel: p.longLabel, value: p[field] }))
  const total = (field) => series.reduce((t, p) => t + (p[field] || 0), 0)
  const h = isMobile ? 180 : 210

  const exportCsv = () => {
    const def = { title: 'Reports and insights', sections: HOME_SECTIONS, kpis: HOME_KPIS, includeNames: false }
    downloadCsv(csvFilename(`${org?.name || 'insights'} insights`, range), toCsv(reportCsvBlocks(def, { model, terms, org, range, isAdmin, filterLabels })))
  }

  const buildFromHere = () => onBuildReport?.({
    template: 'blank',
    title: `${org?.name ? `${org.name}: ` : ''}${range.label}`,
    period: { key: period.key, from: period.from, to: period.to },
    projects, groups,
    sections: ['headline', 'facts', 'trend_attendance', 'trend_sessions', ...(caps.reachSeries ? ['trend_reach'] : []), 'by_project', 'by_group', 'by_age'],
    kpis: HOME_KPIS.filter(k => k !== 'concerns' || isAdmin),
  })

  const breakdown = (key, title, value, format) => {
    const b = breakdownRows(key, model, terms)
    const rows = b.rows.map(r => ({ label: r.label, value: r[value] }))
    const whole = value === 'reached' ? model.current.reached : model.current.sessions_delivered
    return (
      <ChartCard key={key} title={title} isMobile={isMobile}
        subtitle={value === 'reached' ? `${terms.People} reached` : `${terms.Sessions} delivered`}
        empty={rows.length ? null : 'Nothing recorded for this breakdown in the period.'}
        table={<DataTable columns={b.columns} rows={b.rows} />}>
        {/* Shares of the whole period, not of the rows shown: these lists are
            a top ten, and a share of what is visible would overstate each row.
            A person sits in one group, but groups are not shown as shares
            because "No group" would read as a category of its own. */}
        <BarList rows={rows} format={format} total={whole} showShare={key !== 'by_group'} />
      </ChartCard>
    )
  }

  return (
    <div>
      {/* Filters: one row, above everything they scope. */}
      <div style={card({ padding: isMobile ? '12px 16px 14px' : '14px 16px', marginBottom: 6, overflow: 'hidden' })}>
        <PeriodPicker value={period} onChange={setPeriod} isMobile={isMobile} problem={range.valid ? null : range.problem} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {caps.filters && (
            <>
              <button type="button" onClick={() => setSheet('projects')} style={chipStyle(projects.length > 0, isMobile)} aria-haspopup="dialog">
                <Icon name="projects" size={14} />{projects.length ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : 'All projects'}
              </button>
              <button type="button" onClick={() => setSheet('groups')} style={chipStyle(groups.length > 0, isMobile)} aria-haspopup="dialog">
                <Icon name="groups" size={14} />{groups.length ? `${groups.length} ${groups.length === 1 ? terms.group : `${terms.group}s`}` : `All ${terms.group}s`}
              </button>
              {hasFilters && <button type="button" onClick={() => { setProjects([]); setGroups([]) }} style={{ ...btn('quiet', isMobile), fontSize: 12.5 }}>Clear filters</button>}
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginLeft: isMobile ? 0 : 'auto', lineHeight: 1.45 }}>
            {range.valid ? <>
              <strong style={{ color: 'var(--text2)' }}>{formatRange(range.from, range.to)}</strong>
              {prev && <span> · compared with {formatRange(prev.from, prev.to)}</span>}
            </> : null}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={card({ padding: 16, marginTop: 14, borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' })}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--danger-text)' }}>Couldn’t load your figures</div>
          <div style={{ fontSize: 12.5, color: 'var(--danger-text)', marginTop: 3 }}>{error}</div>
          <button type="button" onClick={load} style={{ ...btn('ghost', isMobile), marginTop: 10 }}>Try again</button>
        </div>
      )}

      {firstLoad && (
        <div aria-busy="true" aria-label="Loading figures" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fill,minmax(190px,1fr))', gap: 10, marginTop: 20 }}>
          {Array.from({ length: isMobile ? 4 : 7 }).map((_, i) => <div key={i} style={card({ height: isMobile ? 104 : 118, background: 'var(--surface2)' })} />)}
        </div>
      )}

      {model && (
        // Refetching keeps the frame: the old figures dim rather than vanish,
        // so changing the period never makes the page jump.
        <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 160ms', pointerEvents: loading ? 'none' : 'auto' }}>
          {empty ? (
            <div style={card({ padding: isMobile ? 24 : 36, marginTop: 18, textAlign: 'center' })}>
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--org-a10, var(--surface2))', color: 'var(--org-ink)' }}><Icon name="insights" size={24} /></div>
              <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--text)' }}>Nothing to show for {range.label.toLowerCase()}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, lineHeight: 1.55, maxWidth: 440, marginInline: 'auto' }}>
                {facts[0]?.text || `No ${terms.sessions} were delivered${hasFilters ? ' for the projects and groups chosen' : ''} in this period.`}
                {' '}Figures appear here as registers are marked.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                {period.key !== '12m' && <button type="button" onClick={() => setPeriod({ key: '12m', from: '', to: '' })} style={btn('primary', isMobile)}>Look at the last 12 months</button>}
                {hasFilters && <button type="button" onClick={() => { setProjects([]); setGroups([]) }} style={btn('ghost', isMobile)}>Clear filters</button>}
              </div>
            </div>
          ) : (
            <>
              <SectionLabel id="ins-headline">At a glance</SectionLabel>
              <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : balancedColumns(tiles.length, Math.floor((gridWidth + 10) / 200))},minmax(0,1fr))`, gap: 10 }}>
                {tiles.map((t, i) => (
                  <div key={t.key} style={{ display: 'grid', gridColumn: isMobile && tiles.length % 2 === 1 && i === tiles.length - 1 ? '1 / -1' : undefined }}>
                    <KpiTile tile={t} isMobile={isMobile} />
                  </div>
                ))}
              </div>

              {facts.length > 0 && <>
                <SectionLabel>What stands out</SectionLabel>
                <FactList facts={facts} isMobile={isMobile} />
              </>}

              {attention?.length > 0 && <>
                <SectionLabel>Needs your attention</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
                  {attention.map(i => {
                    const tone = i.tone === 'urgent' ? { bd: 'var(--danger-border)', bg: 'var(--danger-bg)', fg: 'var(--danger-text)' }
                      : i.tone === 'warn' ? { bd: 'var(--warn-border)', bg: 'var(--warn-bg)', fg: 'var(--warn-text)' }
                        : { bd: 'var(--ok-border)', bg: 'var(--ok-bg)', fg: 'var(--ok-text)' }
                    return (
                      <div key={i.key} style={card({ padding: 14, borderColor: tone.bd, background: tone.bg })}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: tone.fg }}>{i.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{i.body}</div>
                        <button type="button" onClick={() => onAttention?.(i.target)} style={{ ...btn('quiet', isMobile), padding: 0, marginTop: 6, color: tone.fg, minHeight: 32 }}>{i.action} <Icon name="chevron" size={14} /></button>
                      </div>
                    )
                  })}
                </div>
              </>}

              <SectionLabel>Trends</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 12 }}>
                <ChartCard title="Attendance rate" subtitle={`${bucketWord} · present out of places marked`} isMobile={isMobile}
                  summary={{ value: fmtRate(model.current.attendance_rate), label: 'for the period' }}
                  empty={series.some(p => p.rate != null) ? null : 'No registers were marked in this period.'}
                  table={seriesTable(pts('rate'), fmtRate, 'Attendance')}>
                  <LineChart points={pts('rate')} format={fmtRate} maxValue={100} height={h} title="Attendance rate over time" />
                </ChartCard>
                <ChartCard title={`${terms.Sessions} delivered`} subtitle={`${bucketWord} · cancelled ones not counted`} isMobile={isMobile}
                  summary={{ value: fmtCount(model.current.sessions_delivered), label: 'in total' }}
                  empty={total('sessions') > 0 ? null : `No ${terms.sessions} were delivered in this period.`}
                  table={seriesTable(pts('sessions'), fmtCount, terms.Sessions)}>
                  <ColumnChart integer points={pts('sessions')} format={fmtCount} height={h} title={`${terms.Sessions} delivered over time`} />
                </ChartCard>
                {caps.reachSeries && (
                  <ChartCard title={`${terms.People} reached`} subtitle={`${bucketWord} · different people marked present`} isMobile={isMobile}
                    summary={{ value: fmtCount(model.current.reached), label: 'different people' }}
                    empty={total('reached') > 0 ? null : `No ${terms.people} were marked present in this period.`}
                    table={seriesTable(pts('reached'), fmtCount, terms.People)}>
                    <ColumnChart integer points={pts('reached')} format={fmtCount} height={h} title={`${terms.People} reached over time`} />
                  </ChartCard>
                )}
                {caps.volunteerHours && (
                  <ChartCard title="Volunteer hours" subtitle={`${bucketWord} · signed in and out on the register`} isMobile={isMobile}
                    summary={{ value: fmtHours(model.current.volunteer_hours), label: `${fmtCount(model.current.volunteers || 0)} volunteer${model.current.volunteers === 1 ? '' : 's'}` }}
                    empty={total('volunteer_hours') > 0 ? null : 'No volunteer time was recorded on registers in this period. Volunteers count once they are signed in on a register’s Team tab.'}
                    table={seriesTable(pts('volunteer_hours'), fmtHours, 'Hours')}>
                    <ColumnChart points={pts('volunteer_hours')} format={fmtHours} height={h} title="Volunteer hours over time" />
                  </ChartCard>
                )}
                {model.canSeeSafeguarding && model.current.concerns_raised != null && (
                  <ChartCard title="Safeguarding concerns raised" isMobile={isMobile}
                    subtitle={`${bucketWord} · counts only, whole organisation`}
                    summary={{ value: fmtCount(model.safeguarding?.openNow ?? 0), label: 'open now' }}
                    empty={total('concerns') > 0 ? null : 'No concerns were raised in this period.'}
                    table={seriesTable(pts('concerns'), fmtCount, 'Concerns')}>
                    <ColumnChart integer points={pts('concerns')} format={fmtCount} height={h} title="Safeguarding concerns raised over time" />
                  </ChartCard>
                )}
              </div>

              <SectionLabel>Breakdowns</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 12 }}>
                {breakdown('by_project', 'By project', 'sessions', fmtCount)}
                {breakdown('by_group', `By ${terms.group}`, 'reached', fmtCount)}
                {breakdown('by_location', 'By location', 'sessions', fmtCount)}
                {breakdown('by_age', 'By age band', 'reached', fmtCount)}
              </div>
            </>
          )}

          <div style={card({ marginTop: 22, padding: isMobile ? 16 : 18, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: 12, flexDirection: isMobile ? 'column' : 'row', background: 'linear-gradient(120deg, var(--org-a05, var(--surface2)), var(--surface))' })}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 850, color: 'var(--text)' }}>Need this for a funder or your board?</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>Turn this view into a report you can add your own words to, print as a PDF and run again whenever you need it.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={exportCsv} disabled={!model || empty} style={{ ...btn('ghost', isMobile), flex: isMobile ? 1 : undefined }}><Icon name="export" size={15} />Download CSV</button>
              <button type="button" onClick={buildFromHere} style={{ ...btn('primary', isMobile), flex: isMobile ? 1 : undefined }}><Icon name="reports" size={15} />Make a report</button>
            </div>
          </div>
          {model.source === 'legacy' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
              Figures by month. Weekly trends, {terms.people} reached over time, volunteer hours and project and {terms.group} filters appear once your reporting update is switched on.
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
            Changes compare with {prev ? comparisonPhrase(range) : 'the previous period'}{hasFilters ? `, for the same ${projects.length ? 'projects' : ''}${projects.length && groups.length ? ' and ' : ''}${groups.length ? `${terms.group}s` : ''}` : ''}. Counts only: no name appears on this page.
          </div>
        </div>
      )}

      {sheet === 'projects' && (
        <MultiSelectSheet title="Projects" isMobile={isMobile}
          hint={`Only ${terms.sessions} that belong to the projects you pick.`}
          options={options.projects.map(p => ({ value: p.id, label: p.name, hint: p.archived ? 'Archived' : null }))}
          selected={projects} onChange={setProjects} onClose={() => setSheet(null)}
          emptyText="You have no projects yet." />
      )}
      {sheet === 'groups' && (
        <MultiSelectSheet title={terms.Groups || 'Groups'} isMobile={isMobile}
          hint={`Only ${terms.people} in the ${terms.group}s you pick, and the ${terms.sessions} planned for them.`}
          options={options.groups.map(g => ({ value: g, label: g }))}
          selected={groups} onChange={setGroups} onClose={() => setSheet(null)}
          emptyText={`No ${terms.group}s are set on your ${terms.people} yet.`} />
      )}
    </div>
  )
}

import { buildSpec } from './reportDocs'
import {
  HOME_KPIS, KPI_DEFS, buildFacts, buildKpis, fmtCount, fmtHours, fmtRate, formatRange,
  previousPeriod, redactForViewer, resolvePeriod, PERIODS,
} from './insights'

// The report studio's rules: what a report can contain, the templates it
// starts from, how a report is saved so it can be run again, and how its
// tables become a CSV.
//
// A saved report is a *definition* -- which sections, which period, which
// projects and groups -- never a copy of the figures. Running it again reads
// the records as they are now, so "Board summary" can be reused every quarter
// and is never a stale snapshot of last quarter's numbers.

export const DEFINITION_VERSION = 2

const label = (l, terms) => (typeof l === 'function' ? l(terms) : l)

// ─────────────────────────────────────────────────────────── sections

export const SECTION_GROUPS = ['Summary', 'Trends', 'Breakdowns', 'In depth']

export const SECTIONS = [
  { key: 'narrative', group: 'Summary', kind: 'narrative', field: 'narrative', label: 'Introduction',
    desc: 'A few words of your own to open the report.' },
  { key: 'headline', group: 'Summary', kind: 'kpis', label: 'Headline figures',
    desc: 'The key numbers, each against the period before.' },
  { key: 'facts', group: 'Summary', kind: 'facts', label: 'Key findings',
    desc: 'What stands out, in plain words.' },

  { key: 'trend_attendance', group: 'Trends', kind: 'chart', chart: 'line', metric: 'rate', format: 'rate',
    label: 'Attendance over time', desc: 'Present out of places marked.' },
  { key: 'trend_sessions', group: 'Trends', kind: 'chart', chart: 'column', metric: 'sessions', format: 'count',
    label: t => `${t.Sessions} delivered over time`, desc: 'Cancelled ones not counted.' },
  { key: 'trend_reach', group: 'Trends', kind: 'chart', chart: 'column', metric: 'reached', format: 'count', needs: 'reachSeries',
    label: t => `${t.People} reached over time`, desc: 'Different people marked present.' },
  { key: 'trend_volunteers', group: 'Trends', kind: 'chart', chart: 'column', metric: 'volunteer_hours', format: 'hours', needs: 'volunteerHours',
    label: 'Volunteer hours over time', desc: 'Signed in and out on the register.' },
  { key: 'trend_safeguarding', group: 'Trends', kind: 'chart', chart: 'column', metric: 'concerns', format: 'count', restricted: true,
    label: 'Safeguarding concerns raised', desc: 'Counts only. Owners and admins.' },

  { key: 'by_project', group: 'Breakdowns', kind: 'breakdown', dim: 'byProject', value: 'sessions',
    label: 'By project', desc: 'Sessions, reach and attendance per project.' },
  { key: 'by_group', group: 'Breakdowns', kind: 'breakdown', dim: 'byGroup', value: 'reached',
    label: t => `By ${t.group}`, desc: 'Who came, by the group they belong to.' },
  { key: 'by_location', group: 'Breakdowns', kind: 'breakdown', dim: 'byLocation', value: 'sessions',
    label: 'By location', desc: 'Where the work happened.' },
  { key: 'by_age', group: 'Breakdowns', kind: 'breakdown', dim: 'byAge', value: 'reached',
    label: 'By age band', desc: 'Ages of the people reached.' },

  { key: 'doc_delivery', group: 'In depth', kind: 'doc', doc: 'delivery',
    label: 'Delivery in depth', desc: 'Types, months, locations and reflections.' },
  { key: 'doc_attendance', group: 'In depth', kind: 'doc', doc: 'attendance',
    label: 'Attendance in depth', desc: 'Month by month, absence reasons, repeat absence.' },
  { key: 'doc_young_people', group: 'In depth', kind: 'doc', doc: 'young_people',
    label: t => `${t.People} and engagement`, desc: 'How often they came, who they were.' },
  { key: 'doc_impact', group: 'In depth', kind: 'doc', doc: 'impact',
    label: 'Outcomes and goals', desc: 'Distance travelled and goals met.' },
  { key: 'doc_learning', group: 'In depth', kind: 'doc', doc: 'learning',
    label: 'Session learning', desc: 'Reflections, observed outcomes, actions.' },
  { key: 'doc_team', group: 'In depth', kind: 'doc', doc: 'team',
    label: 'Staff and volunteers', desc: 'Who delivered, rota coverage, DBS counts.' },
  { key: 'doc_project', group: 'In depth', kind: 'doc', doc: 'project',
    label: 'Projects in depth', desc: 'Every project that ran in the period.' },
  { key: 'doc_safeguarding', group: 'In depth', kind: 'doc', doc: 'safeguarding', restricted: true,
    label: 'Safeguarding in depth', desc: 'Volumes, notification, response times. Counts only.' },

  { key: 'closing', group: 'Summary', kind: 'narrative', field: 'closing', label: 'Closing words',
    desc: 'Thanks, next steps or a contact, to finish.' },
]

export const sectionByKey = (key) => SECTIONS.find(s => s.key === key) || null

/**
 * Whether a report deliberately covers safeguarding. Only then does the
 * concerns finding appear among its key findings: a funder report written by
 * an admin should not mention concern numbers just because its author could
 * see them.
 */
export const includesSafeguarding = (def) =>
  def.sections.some(k => sectionByKey(k)?.restricted) || def.kpis.some(k => KPI_DEFS.find(x => x.key === k)?.restricted)
export const sectionLabel = (key, terms) => label(sectionByKey(key)?.label, terms) || key

// ─────────────────────────────────────────────────────────── templates

// report_type has a CHECK constraint in the database; each template saves
// under one of its values. The real template key travels in configuration.
export const REPORT_TYPES = ['delivery', 'attendance', 'young_people', 'impact', 'team', 'safeguarding', 'funding', 'project']

export const TEMPLATES = [
  {
    key: 'funder', name: 'Funder report', icon: 'fundraising', reportType: 'funding', period: '12m',
    blurb: 'What the grant paid for: who you reached, how often they came and what changed for them.',
    kpis: ['reached', 'new_people', 'sessions', 'hours', 'attendance', 'volunteer_hours'],
    sections: ['narrative', 'headline', 'facts', 'trend_reach', 'trend_attendance', 'by_age', 'by_group', 'by_project', 'doc_young_people', 'doc_impact', 'closing'],
  },
  {
    key: 'termly', name: 'Termly impact report', icon: 'impact', reportType: 'impact', period: 'last_term',
    blurb: 'A term at a glance for your team and partners: delivery, attendance, learning and outcomes.',
    kpis: ['reached', 'sessions', 'attendance', 'new_people', 'hours'],
    sections: ['headline', 'facts', 'narrative', 'trend_attendance', 'trend_sessions', 'trend_reach', 'by_project', 'by_group', 'doc_impact', 'doc_learning'],
  },
  {
    key: 'board', name: 'Board summary', icon: 'team', reportType: 'delivery', period: '90d',
    blurb: 'A short, trustee-ready summary: the headline numbers, the trends and how the team is doing.',
    kpis: ['reached', 'sessions', 'attendance', 'volunteer_hours', 'concerns'],
    sections: ['headline', 'facts', 'trend_sessions', 'trend_attendance', 'trend_volunteers', 'trend_safeguarding', 'by_project', 'doc_team'],
  },
  {
    key: 'safeguarding', name: 'Safeguarding summary', icon: 'safeguarding', reportType: 'safeguarding', period: 'term', restricted: true,
    blurb: 'Aggregate concern volumes and response times for your DSL and trustees. No names, ever.',
    kpis: ['concerns', 'open_concerns', 'follow_up_overdue'],
    sections: ['headline', 'trend_safeguarding', 'doc_safeguarding', 'narrative'],
  },
  {
    key: 'blank', name: 'Start from blank', icon: 'add', reportType: 'delivery', period: '90d',
    blurb: 'Pick your own period, projects and sections, and build it up as you go.',
    kpis: ['reached', 'sessions', 'attendance', 'hours'],
    sections: ['headline'],
  },
]

export const templateByKey = (key) => TEMPLATES.find(t => t.key === key) || TEMPLATES[TEMPLATES.length - 1]

export const isAdminRole = (role) => ['owner', 'admin'].includes(role)
// Matches the "org staff can manage reports" policy on public.reports.
export const canSaveReports = (role) => ['owner', 'admin', 'staff'].includes(role)

export function templatesFor(role) {
  return TEMPLATES.filter(t => !t.restricted || isAdminRole(role))
}

// ─────────────────────────────────────────────────────────── definitions

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uniq = (list) => Array.from(new Set(list))
const clip = (v, n) => String(v ?? '').slice(0, n)

export function definitionFromTemplate(key) {
  const t = templateByKey(key)
  return sanitizeDefinition({
    version: DEFINITION_VERSION,
    template: t.key,
    title: t.name,
    period: { key: t.period },
    projects: [],
    groups: [],
    sections: t.sections,
    kpis: t.kpis,
    text: { narrative: '', closing: '' },
    includeNames: false,
    showTables: false,
  }, { isAdmin: true })
}

/**
 * A definition made safe to use, whatever it came from.
 *
 * Saved definitions are JSON anybody in the organisation with edit rights can
 * write, so every field is checked: unknown sections dropped, restricted ones
 * dropped for anyone who is not an owner or admin (the database refuses their
 * data anyway, but the report should not offer an empty section), ids that are
 * not ids discarded, and text capped.
 */
export function sanitizeDefinition(raw, { isAdmin = false } = {}) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const tmpl = templateByKey(d.template)
  const allowed = (key) => {
    const s = sectionByKey(key)
    return !!s && (!s.restricted || isAdmin)
  }
  const kpiAllowed = (key) => {
    const k = KPI_DEFS.find(x => x.key === key)
    return !!k && (!k.restricted || isAdmin)
  }
  const sections = uniq((Array.isArray(d.sections) ? d.sections : tmpl.sections).filter(k => typeof k === 'string' && allowed(k)))
  const kpis = uniq((Array.isArray(d.kpis) ? d.kpis : tmpl.kpis).filter(k => typeof k === 'string' && kpiAllowed(k))).slice(0, 8)
  const periodKey = PERIODS.some(p => p.key === d.period?.key) ? d.period.key : tmpl.period
  return {
    version: DEFINITION_VERSION,
    template: tmpl.key,
    title: clip(d.title, 120).trim() || tmpl.name,
    period: periodKey === 'custom'
      ? { key: 'custom', from: clip(d.period?.from, 10), to: clip(d.period?.to, 10) }
      : { key: periodKey },
    projects: uniq((Array.isArray(d.projects) ? d.projects : []).filter(v => typeof v === 'string' && UUID.test(v))).slice(0, 50),
    groups: uniq((Array.isArray(d.groups) ? d.groups : []).filter(v => typeof v === 'string' && v.trim()).map(v => clip(v, 80))).slice(0, 50),
    sections: sections.length ? sections : ['headline'],
    kpis: kpis.length ? kpis : HOME_KPIS.filter(kpiAllowed).slice(0, 4),
    text: { narrative: clip(d.text?.narrative, 4000), closing: clip(d.text?.closing, 4000) },
    includeNames: d.includeNames === true,
    showTables: d.showTables === true,
  }
}

export const definitionRange = (def, today) => resolvePeriod(def.period.key, { today, from: def.period.from, to: def.period.to })

/**
 * Saved under the safeguarding type whenever it carries a safeguarding
 * section, so the existing policy hides the definition itself from anyone who
 * could not run that part of it.
 */
export function reportTypeFor(def) {
  if (def.sections.some(k => sectionByKey(k)?.restricted)) return 'safeguarding'
  const t = templateByKey(def.template).reportType
  return REPORT_TYPES.includes(t) ? t : 'delivery'
}

export function definitionToRow(def, range) {
  return {
    name: def.title,
    report_type: reportTypeFor(def),
    date_from: range?.valid ? range.from : null,
    date_to: range?.valid ? range.to : null,
    filters: { projects: def.projects, groups: def.groups },
    configuration: def,
  }
}

// What the single-document reports were called before the studio. Rows saved
// by the old builder carry only a type and a date range.
const LEGACY = {
  funding: { template: 'funder' },
  impact: { template: 'termly' },
  safeguarding: { template: 'safeguarding' },
  delivery: { template: 'blank', sections: ['headline', 'doc_delivery'] },
  attendance: { template: 'blank', sections: ['headline', 'doc_attendance'] },
  young_people: { template: 'blank', sections: ['headline', 'doc_young_people'] },
  team: { template: 'blank', sections: ['headline', 'doc_team'] },
  project: { template: 'blank', sections: ['headline', 'doc_project'] },
}

export function definitionFromRow(row, { isAdmin = false } = {}) {
  if (!row) return null
  const cfg = row.configuration
  if (cfg && cfg.version === DEFINITION_VERSION) {
    return { ...sanitizeDefinition({ ...cfg, title: row.name || cfg.title }, { isAdmin }), savedId: row.id }
  }
  const legacy = LEGACY[row.report_type] || { template: 'blank' }
  const base = definitionFromTemplate(legacy.template)
  const hasDates = row.date_from && row.date_to
  return {
    ...sanitizeDefinition({
      ...base,
      title: row.name || base.title,
      sections: legacy.sections || base.sections,
      period: hasDates ? { key: 'custom', from: row.date_from, to: row.date_to } : base.period,
    }, { isAdmin }),
    savedId: row.id,
  }
}

/** The per-report aggregates a definition needs fetched, besides insights. */
export function docsNeeded(def) {
  return uniq(def.sections.map(k => sectionByKey(k)).filter(s => s?.kind === 'doc').map(s => s.doc))
}

export const usesInsights = (def) => def.sections.some(k => ['kpis', 'facts', 'chart', 'breakdown'].includes(sectionByKey(k)?.kind))

/** Sections the data can fill, with the reason when one cannot be offered. */
export function sectionAvailability(key, { isAdmin, capabilities }) {
  const s = sectionByKey(key)
  if (!s) return { ok: false, reason: 'Unknown section' }
  if (s.restricted && !isAdmin) return { ok: false, reason: 'Owners and admins only' }
  if (s.needs && capabilities && capabilities[s.needs] === false) return { ok: false, reason: 'Available once the reporting update is switched on' }
  return { ok: true, reason: null }
}

// ─────────────────────────────────────────────────────────── named content

/**
 * A copy of a document spec without the sections that list people by name.
 *
 * The in-depth sections come from the single-document reports, some of which
 * name the young people who were most often absent or improved the most --
 * right for the staff who act on them, wrong for a funder. The studio leaves
 * them out unless the person building the report asks for them.
 */
export function withoutNamedSections(spec, includeNames) {
  if (!spec || includeNames) return spec
  return { ...spec, sections: spec.sections.filter(s => !s.named) }
}

// ─────────────────────────────────────────────────────────── breakdown rows

export function breakdownRows(key, model, terms) {
  if (!model) return { columns: [], rows: [], value: null }
  switch (key) {
    case 'by_project':
      return {
        value: 'sessions', valueLabel: terms.Sessions,
        columns: [
          { key: 'label', label: 'Project' },
          { key: 'sessions', label: terms.Sessions, format: fmtCount },
          { key: 'reached', label: terms.People, format: fmtCount },
          { key: 'rate', label: 'Attendance', format: fmtRate },
        ],
        rows: model.byProject.filter(r => r.sessions > 0),
      }
    case 'by_group':
      return {
        value: 'reached', valueLabel: terms.People,
        columns: [
          { key: 'label', label: terms.Group },
          { key: 'reached', label: terms.People, format: fmtCount },
          ...(model.capabilities.previousAttendances ? [{ key: 'attendances', label: 'Attendances', format: fmtCount }] : []),
        ],
        rows: model.byGroup.filter(r => r.reached > 0),
      }
    case 'by_location':
      return {
        value: 'sessions', valueLabel: terms.Sessions,
        columns: [
          { key: 'label', label: 'Location' },
          { key: 'sessions', label: terms.Sessions, format: fmtCount },
          ...(model.capabilities.filters ? [{ key: 'hours', label: 'Hours', format: fmtHours }] : []),
        ],
        rows: model.byLocation.filter(r => r.sessions > 0),
      }
    case 'by_age':
      return {
        value: 'reached', valueLabel: terms.People,
        columns: [
          { key: 'label', label: 'Age band' },
          { key: 'reached', label: terms.People, format: fmtCount },
        ],
        rows: model.byAge.filter(r => r.reached > 0),
      }
    default:
      return { columns: [], rows: [], value: null }
  }
}

// ─────────────────────────────────────────────────────────── CSV

/**
 * One CSV cell.
 *
 * Text that a spreadsheet would read as a formula (=, +, -, @ and friends) is
 * prefixed with an apostrophe: project and group names are typed by users, and
 * a CSV opened in Excel must not run one of them. Numbers, including negative
 * ones, are left as numbers.
 */
export function csvCell(value) {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?%?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(blocks) {
  const lines = []
  blocks.forEach((b, i) => {
    if (i > 0) lines.push('')
    if (b.title) lines.push(csvCell(b.title))
    if (b.columns) lines.push(b.columns.map(c => csvCell(c.label)).join(','))
    ;(b.rows || []).forEach(r => {
      lines.push(Array.isArray(r) ? r.map(csvCell).join(',') : b.columns.map(c => csvCell(r[c.key])).join(','))
    })
  })
  // The byte-order mark makes Excel read £, – and accented names as UTF-8.
  return `﻿${lines.join('\r\n')}\r\n`
}

export function csvFilename(title, range) {
  const slug = String(title || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report'
  return range?.valid ? `${slug}-${range.from}-to-${range.to}.csv` : `${slug}.csv`
}

const SERIES_COLUMNS = {
  trend_sessions: { key: 'sessions', label: 'Sessions delivered' },
  trend_attendance: { key: 'rate', label: 'Attendance rate (%)' },
  trend_reach: { key: 'reached', label: 'People reached' },
  trend_volunteers: { key: 'volunteer_hours', label: 'Volunteer hours' },
  trend_safeguarding: { key: 'concerns', label: 'Concerns raised' },
}

/**
 * Every table in a report, ready for toCsv().
 *
 * The CSV carries what the document shows and nothing more: the same named
 * sections are left out, and safeguarding appears only when the reader could
 * already see it.
 */
export function reportCsvBlocks(def, { model: rawModel, docs = {}, terms, org, range, isAdmin = false, filterLabels = [] }) {
  const model = redactForViewer(rawModel, isAdmin)
  const blocks = [{
    title: def.title,
    rows: [
      ['Organisation', org?.name || ''],
      ['Period', range?.valid ? formatRange(range.from, range.to) : ''],
      ...(range?.valid ? [['Compared with', formatRange(previousPeriod(range).from, previousPeriod(range).to)]] : []),
      ...(filterLabels.length ? [['Covers', filterLabels.join('; ')]] : []),
    ],
  }]
  const trendCols = []
  def.sections.forEach(key => {
    const s = sectionByKey(key)
    if (!s || (s.restricted && !isAdmin)) return
    if (s.kind === 'kpis' && model) {
      const tiles = buildKpis(model, def.kpis, terms)
      if (tiles.length) {
        blocks.push({
          title: 'Headline figures',
          columns: [{ key: 'label', label: 'Measure' }, { key: 'display', label: 'This period' }, { key: 'prev', label: 'Previous period' }, { key: 'change', label: 'Change' }],
          rows: tiles.map(t => ({ label: t.label, display: t.display, prev: t.previousDisplay || '', change: t.change?.text || '' })),
        })
      }
    } else if (s.kind === 'facts' && model) {
      const facts = buildFacts(model, terms, { max: 8, skip: includesSafeguarding(def) ? [] : ['concerns'] })
      if (facts.length) blocks.push({ title: 'Key findings', rows: facts.map(f => [f.text]) })
    } else if (s.kind === 'chart' && model && SERIES_COLUMNS[key]) {
      const col = SERIES_COLUMNS[key]
      if (model.series.some(p => p[col.key] != null)) trendCols.push(col)
    } else if (s.kind === 'breakdown' && model) {
      const b = breakdownRows(key, model, terms)
      if (b.rows.length) {
        blocks.push({
          title: label(s.label, terms),
          columns: b.columns,
          rows: b.rows.map(r => Object.fromEntries(b.columns.map(c => [c.key, c.key === 'label' ? r.label : r[c.key]]))),
        })
      }
    } else if (s.kind === 'doc' && docs[s.doc]) {
      const spec = withoutNamedSections(buildSpec(s.doc, docs[s.doc], terms), def.includeNames)
      ;(spec?.sections || []).forEach(sec => {
        const title = `${label(s.label, terms)}: ${sec.title}`
        const figures = (sec.figures || []).filter(Boolean)
        if (figures.length) blocks.push({ title, columns: [{ key: 'label', label: 'Measure' }, { key: 'value', label: 'Value' }], rows: figures.map(f => ({ label: f.label, value: f.value })) })
        const dist = (sec.distribution?.rows || []).filter(r => r && r.n > 0)
        if (dist.length) {
          const total = sec.distribution.total || dist.reduce((t, r) => t + r.n, 0)
          blocks.push({ title, columns: [{ key: 'label', label: 'Category' }, { key: 'n', label: 'Count' }, { key: 'pct', label: 'Share (%)' }], rows: dist.map(r => ({ label: r.label, n: r.n, pct: total > 0 ? Math.round((r.n / total) * 100) : '' })) })
        }
        if (sec.table?.rows?.length) blocks.push({ title, columns: sec.table.columns, rows: sec.table.rows })
        if (sec.ranked?.rows?.length) blocks.push({ title, columns: [{ key: 'label', label: 'Name' }, { key: 'value', label: 'Value' }], rows: sec.ranked.rows })
      })
    }
  })
  if (trendCols.length && model) {
    // Straight after the headline figures, where the trends sit in the document.
    const at = blocks.findIndex(b => b.title === 'Headline figures')
    blocks.splice(at >= 0 ? at + 1 : 1, 0, {
      title: `Over time (by ${model.bucket})`,
      columns: [{ key: 'start', label: 'From' }, { key: 'finish', label: 'To' }, ...trendCols],
      rows: model.series.map(p => Object.fromEntries([['start', p.start], ['finish', p.finish], ...trendCols.map(c => [c.key, p[c.key]])])),
    })
  }
  return blocks
}

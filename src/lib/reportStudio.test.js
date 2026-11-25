import {
  TEMPLATES, REPORT_TYPES, SECTIONS, templatesFor, canSaveReports, definitionFromTemplate, sanitizeDefinition,
  reportTypeFor, definitionToRow, definitionFromRow, docsNeeded, usesInsights, sectionAvailability,
  withoutNamedSections, breakdownRows, csvCell, toCsv, csvFilename, reportCsvBlocks, definitionRange, includesSafeguarding,
} from './reportStudio'
import { normalizeInsights, resolvePeriod } from './insights'
import { buildSpec } from './reportDocs'

const terms = {
  person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People',
  session: 'session', sessions: 'sessions', Session: 'Session', Sessions: 'Sessions', group: 'group', Group: 'Group',
}

const model = normalizeInsights({
  from: '2026-09-01', to: '2026-11-24', bucket: 'week',
  current: { sessions_delivered: 22, hours: 95, attendance_rate: 52, marked: 62, reached: 17, new_people: 4, concerns_raised: 2 },
  previous: { sessions_delivered: 51, hours: 195, attendance_rate: 86, reached: 46, new_people: 46, concerns_raised: 6 },
  series: [
    { start: '2026-09-01', finish: '2026-09-06', sessions: 2, rate: 67, reached: 4, volunteer_hours: 0, concerns: 1 },
    { start: '2026-09-07', finish: '2026-09-13', sessions: 9, rate: 47, reached: 9, volunteer_hours: 3, concerns: 1 },
  ],
  by_project: [{ id: 'p1', label: '=HYPERLINK("x")', sessions: 12, reached: 10, rate: 60 }],
  by_group: [{ label: 'Juniors', reached: 9, attendances: 20 }, { label: 'Empty', reached: 0 }],
  by_age: { age_8_11: 9 },
  can_see_safeguarding: true,
  safeguarding: { open_now: 6, resolved_in_period: 0, follow_up_overdue: 1 },
})

describe('templates', () => {
  test('every template saves under a report_type the database accepts', () => {
    TEMPLATES.forEach(t => expect(REPORT_TYPES).toContain(t.reportType))
  })

  test('every template section and KPI exists', () => {
    TEMPLATES.forEach(t => {
      const def = definitionFromTemplate(t.key)
      expect(def.sections).toEqual(t.sections)
      expect(def.kpis).toEqual(t.kpis)
    })
  })

  test('the safeguarding summary is offered to owners and admins only', () => {
    expect(templatesFor('staff').map(t => t.key)).not.toContain('safeguarding')
    expect(templatesFor('admin').map(t => t.key)).toContain('safeguarding')
    expect(templatesFor('owner').map(t => t.key)).toContain('safeguarding')
  })

  test('saving follows the reports table policy', () => {
    expect(['owner', 'admin', 'staff'].every(canSaveReports)).toBe(true)
    expect(canSaveReports('volunteer')).toBe(false)
  })
})

describe('sanitizeDefinition', () => {
  test('drops unknown sections, duplicates and restricted ones for non-admins', () => {
    const def = sanitizeDefinition({
      template: 'board', sections: ['headline', 'headline', 'nope', 'trend_safeguarding', 'doc_safeguarding', 'by_group'],
      kpis: ['reached', 'concerns', 'open_concerns', 'bogus'],
    }, { isAdmin: false })
    expect(def.sections).toEqual(['headline', 'by_group'])
    expect(def.kpis).toEqual(['reached'])
  })

  test('keeps restricted sections for admins', () => {
    const def = sanitizeDefinition({ template: 'safeguarding', sections: ['trend_safeguarding', 'doc_safeguarding'] }, { isAdmin: true })
    expect(def.sections).toEqual(['trend_safeguarding', 'doc_safeguarding'])
  })

  test('discards ids that are not ids and caps free text', () => {
    const def = sanitizeDefinition({
      projects: ['not-a-uuid', 'a0000000-0000-0000-0000-0000000000a1', 42],
      groups: ['Juniors', '', '  ', 'x'.repeat(200)],
      title: '  ',
      text: { narrative: 'y'.repeat(5000) },
      period: { key: 'forever' },
    })
    expect(def.projects).toEqual(['a0000000-0000-0000-0000-0000000000a1'])
    expect(def.groups).toEqual(['Juniors', 'x'.repeat(80)])
    expect(def.title).toBe('Start from blank')
    expect(def.text.narrative).toHaveLength(4000)
    expect(def.period).toEqual({ key: '90d' })
  })

  test('never leaves a report with nothing in it', () => {
    const def = sanitizeDefinition({ sections: ['doc_safeguarding'], kpis: ['concerns'] }, { isAdmin: false })
    expect(def.sections).toEqual(['headline'])
    expect(def.kpis.length).toBeGreaterThan(0)
    expect(def.kpis).not.toContain('concerns')
  })

  test('keeps custom dates only for a custom period', () => {
    expect(sanitizeDefinition({ period: { key: 'custom', from: '2026-09-01', to: '2026-12-31' } }).period)
      .toEqual({ key: 'custom', from: '2026-09-01', to: '2026-12-31' })
    expect(sanitizeDefinition({ period: { key: '30d', from: '2026-09-01' } }).period).toEqual({ key: '30d' })
  })
})

describe('saving and reopening', () => {
  test('a definition with safeguarding in it is saved as a safeguarding report', () => {
    expect(reportTypeFor(definitionFromTemplate('board'))).toBe('safeguarding')
    expect(reportTypeFor({ ...definitionFromTemplate('board'), sections: ['headline'] })).toBe('delivery')
    expect(reportTypeFor(definitionFromTemplate('funder'))).toBe('funding')
  })

  test('the row carries the definition, not the figures', () => {
    const def = { ...definitionFromTemplate('funder'), projects: ['a0000000-0000-0000-0000-0000000000a1'] }
    const range = resolvePeriod('12m', { today: '2026-11-25' })
    const row = definitionToRow(def, range)
    expect(row).toMatchObject({ name: 'Funder report', report_type: 'funding', date_from: '2025-11-26', date_to: '2026-11-25' })
    expect(row.filters).toEqual({ projects: def.projects, groups: [] })
    expect(row.configuration).toBe(def)
    expect(JSON.stringify(row)).not.toMatch(/reached":\s*\d/)
  })

  test('reopens a saved definition under its saved name', () => {
    const def = definitionFromTemplate('termly')
    const back = definitionFromRow({ id: 'r1', name: 'Autumn for trustees', report_type: 'impact', configuration: def }, { isAdmin: false })
    expect(back).toMatchObject({ savedId: 'r1', title: 'Autumn for trustees', template: 'termly' })
  })

  test('opens a report saved by the old builder', () => {
    const back = definitionFromRow({ id: 'r2', name: 'Old attendance', report_type: 'attendance', date_from: '2026-01-01', date_to: '2026-03-31', configuration: { sections: ['summary'] } })
    expect(back.sections).toEqual(['headline', 'doc_attendance'])
    expect(back.period).toEqual({ key: 'custom', from: '2026-01-01', to: '2026-03-31' })
    expect(definitionRange(back)).toMatchObject({ valid: true, from: '2026-01-01', to: '2026-03-31' })
  })

  test('works out which aggregates to fetch', () => {
    const def = definitionFromTemplate('funder')
    expect(docsNeeded(def)).toEqual(['young_people', 'impact'])
    expect(usesInsights(def)).toBe(true)
    expect(usesInsights({ ...def, sections: ['narrative', 'doc_impact'] })).toBe(false)
  })

  test('explains why a section cannot be offered', () => {
    expect(sectionAvailability('trend_safeguarding', { isAdmin: false }).reason).toBe('Owners and admins only')
    expect(sectionAvailability('trend_reach', { isAdmin: true, capabilities: { reachSeries: false } }).ok).toBe(false)
    expect(sectionAvailability('trend_reach', { isAdmin: true, capabilities: { reachSeries: true } }).ok).toBe(true)
    SECTIONS.forEach(s => expect(sectionAvailability(s.key, { isAdmin: true, capabilities: {} }).ok).toBe(true))
  })
})

describe('named content', () => {
  const attendance = { rate: 80, prev_rate: 70, attended: 40, absent: 10, marked: 50, unmarked: 0, by_month: [],
    absence_reasons: [{ label: 'Ill', n: 4 }], repeat_absentees: [{ label: 'Ann Example', n: 3 }], lowest_sessions: [] }

  test('in-depth sections that list people by name are left out unless asked for', () => {
    const spec = buildSpec('attendance', attendance, terms)
    expect(spec.sections.some(s => s.title === 'Repeat absence')).toBe(true)
    expect(withoutNamedSections(spec, false).sections.some(s => s.title === 'Repeat absence')).toBe(false)
    expect(withoutNamedSections(spec, true)).toBe(spec)
  })

  test('the CSV leaves names out the same way', () => {
    const def = { ...definitionFromTemplate('blank'), sections: ['doc_attendance'] }
    const csv = toCsv(reportCsvBlocks(def, { docs: { attendance }, terms, range: resolvePeriod('90d', { today: '2026-11-25' }) }))
    expect(csv).not.toMatch(/Ann Example/)
    const named = toCsv(reportCsvBlocks({ ...def, includeNames: true }, { docs: { attendance }, terms }))
    expect(named).toMatch(/Ann Example/)
  })
})

describe('breakdownRows', () => {
  test('leaves out empty rows and labels columns in the org’s own words', () => {
    const b = breakdownRows('by_group', model, { ...terms, Group: 'Squad', People: 'Players' })
    expect(b.rows.map(r => r.label)).toEqual(['Juniors'])
    expect(b.columns.map(c => c.label)).toEqual(['Squad', 'Players', 'Attendances'])
  })
})

describe('CSV', () => {
  test('quotes what needs quoting and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('-3')).toBe('-3')
    expect(csvCell('−34 pts')).toBe('−34 pts')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(null)).toBe('')
    expect(csvCell(NaN)).toBe('')
  })

  test('builds a whole report with a header, headline, trends and breakdowns', () => {
    const def = { ...definitionFromTemplate('board') }
    const range = resolvePeriod('custom', { from: '2026-09-01', to: '2026-11-24' })
    const blocks = reportCsvBlocks(def, { model, terms, org: { name: 'Solidarity Sports' }, range, isAdmin: true, filterLabels: ['Project: Camp'] })
    const csv = toCsv(blocks)
    expect(csv.startsWith('﻿Board summary\r\nOrganisation,Solidarity Sports\r\nPeriod,1 Sep – 24 Nov 2026')).toBe(true)
    expect(csv).toMatch(/Covers,Project: Camp/)
    expect(blocks.map(b => b.title)).toEqual(['Board summary', 'Headline figures', 'Over time (by week)', 'Key findings', 'By project'])
    expect(csv).toMatch(/From,To,Sessions delivered,Attendance rate \(%\),Volunteer hours,Concerns raised/)
    expect(csv).toMatch(/"'=HYPERLINK\(""x""\)",12,10,60/)
    expect(csv).toMatch(/Attendance rate,52%,86%,−34 pts/)
  })

  test('leaves safeguarding out of a CSV for someone who cannot see it', () => {
    const def = { ...definitionFromTemplate('board') }
    const csv = toCsv(reportCsvBlocks(def, { model, terms, isAdmin: false }))
    expect(csv).not.toMatch(/Concerns raised/)
  })

  test('names the file after the report and its dates', () => {
    expect(csvFilename('Board summary: Q3!', { valid: true, from: '2026-09-01', to: '2026-11-24' })).toBe('board-summary-q3-2026-09-01-to-2026-11-24.csv')
    expect(csvFilename('', null)).toBe('report.csv')
  })
})

describe('includesSafeguarding', () => {
  test('only a report that chose safeguarding mentions concern numbers in its findings', () => {
    expect(includesSafeguarding(definitionFromTemplate('funder'))).toBe(false)
    expect(includesSafeguarding(definitionFromTemplate('board'))).toBe(true)
    expect(includesSafeguarding({ sections: ['headline'], kpis: ['concerns'] })).toBe(true)
    const csv = toCsv(reportCsvBlocks(definitionFromTemplate('funder'), { model, terms, isAdmin: true }))
    expect(csv).not.toMatch(/safeguarding concern/i)
  })
})

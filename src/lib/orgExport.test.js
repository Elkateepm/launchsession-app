import { orgFilename, csvPreamble } from './orgExport'

describe('orgFilename', () => {
  const org = { name: 'Solidarity Sports' }

  it('names the file after the organisation', () => {
    expect(orgFilename(org, 'volunteer-report')).toMatch(/^solidarity-sports-volunteer-report-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('survives punctuation and case in the org name', () => {
    expect(orgFilename({ name: "St. Mary's Youth & Community Trust" }, 'cases', 'csv', { date: false }))
      .toBe('st-mary-s-youth-community-trust-cases.csv')
  })

  it('falls back rather than producing a file called "-report.csv"', () => {
    expect(orgFilename(null, 'report', 'csv', { date: false })).toBe('launchsession-report.csv')
    expect(orgFilename({ name: '///' }, 'report', 'csv', { date: false })).toBe('launchsession-report.csv')
  })

  it('omits the date when asked, for names that already carry one', () => {
    expect(orgFilename(org, 'club-attendance-2026-09-28', 'csv', { date: false }))
      .toBe('solidarity-sports-club-attendance-2026-09-28.csv')
  })
})

describe('csvPreamble', () => {
  it('puts the organisation above the column headers, then a blank row', () => {
    const rows = csvPreamble({ name: 'Solidarity Sports' }, 'Volunteer programme report', '1 to 28 September')
    expect(rows[0]).toEqual(['Solidarity Sports'])
    expect(rows[1]).toEqual(['Volunteer programme report', '1 to 28 September'])
    expect(rows[2]).toEqual([])
  })

  it('still identifies the file when the org has no name', () => {
    expect(csvPreamble(null, 'Report')[0]).toEqual(['Organisation'])
  })
})

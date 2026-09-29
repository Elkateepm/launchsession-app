// Naming and heading exported files after the organisation.
//
// An export leaves the app and lands in somebody's downloads folder, an email
// attachment, or a funder's evidence pack. `volunteer-report.csv` and
// `resource-inventory.csv` say nothing about who produced them, and once two
// organisations' exports sit in the same folder they are indistinguishable.

const slug = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48)

/** `solidarity-sports-volunteer-report-2026-09-29.csv` */
export function orgFilename(org, base, ext = 'csv', { date = true } = {}) {
  const parts = [slug(org?.name) || 'launchsession', slug(base)].filter(Boolean)
  if (date) parts.push(new Date().toISOString().slice(0, 10))
  return `${parts.join('-')}.${ext}`
}

/**
 * Two identifying rows above a report's column headers, then a blank row.
 *
 * Kept off plain data exports on purpose: a preamble is a kindness to a person
 * opening the file and an obstacle to anything parsing it, so it belongs only
 * on the exports that are presented as reports.
 */
export function csvPreamble(org, title, period) {
  return [
    [org?.name || 'Organisation'],
    [title, period || `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`],
    [],
  ]
}

export default orgFilename

// Today, as the organisations using this actually reckon it.
//
// `new Date().toISOString().slice(0, 10)` is UTC. The organisations are in the
// UK, so between midnight and 1am British Summer Time — late March to late
// October — it returns YESTERDAY. A register opened at 00:30 in July filed
// against the previous day, and a safeguarding concern raised late at night
// carried the wrong date, which is exactly the discrepancy an inspection asks
// about.
//
// en-CA is the shortest way to a real YYYY-MM-DD out of Intl; the alternative
// is assembling the parts by hand.

const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today in London as YYYY-MM-DD. */
export function todayInLondon() {
  return ISO_DAY.format(new Date())
}

/**
 * The London calendar day a timestamp falls on, as YYYY-MM-DD.
 *
 * For stored values: a row written at 23:30 UTC in July happened on the next
 * day in London, and slicing its ISO string says otherwise.
 */
export function dayInLondon(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : ISO_DAY.format(d)
}

/** Today in London shifted by whole days — `-1` is yesterday. */
export function londonDayOffset(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return ISO_DAY.format(d)
}

export default todayInLondon

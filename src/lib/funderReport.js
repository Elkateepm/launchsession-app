import { supabase } from './supabase'

// The funder report's data layer.
//
// Kept apart from reportingService.js because it answers a different question.
// The overview metrics describe how delivery is going week to week; this
// describes what a grant bought, which is a report written once or twice a year
// and read by somebody deciding whether to fund you again.

export const AGE_BANDS = [
  { key: 'under_8', label: 'Under 8' },
  { key: 'age_8_11', label: '8–11' },
  { key: 'age_12_15', label: '12–15' },
  { key: 'age_16_18', label: '16–18' },
  { key: 'age_19_plus', label: '19+' },
  { key: 'unknown', label: 'Not recorded' },
]

export const DOSE_BANDS = [
  { key: 'attended_once', label: 'Once' },
  { key: 'attended_2_4', label: '2–4 times' },
  { key: 'attended_5_9', label: '5–9 times' },
  { key: 'attended_10_plus', label: '10+ times' },
]

export async function getFunderMetrics({ from, to }) {
  const { data, error } = await supabase.rpc('report_funder_metrics', { p_from: from, p_to: to })
  if (error) throw error
  return data
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export function formatPeriod(from, to) {
  const opts = { day: 'numeric', month: 'long', year: 'numeric' }
  const f = new Date(`${from}T12:00:00`).toLocaleDateString('en-GB', opts)
  const t = new Date(`${to}T12:00:00`).toLocaleDateString('en-GB', opts)
  return `${f} to ${t}`
}

/**
 * The summary paragraph.
 *
 * Deterministic, and every clause is a number that appears elsewhere in the
 * report -- a funder who checks the prose against the tables should find they
 * agree. Sentences are dropped rather than padded when the data cannot support
 * them: "0 young people improved" is a worse sentence than no sentence, and an
 * organisation that has not recorded outcomes is better served by being told so
 * than by a claim it cannot evidence.
 */
export function buildNarrative(m, terms, orgName) {
  if (!m) return []
  const out = []
  const people = m.reach?.people || 0

  if (people === 0) {
    return [`No attendance was recorded for ${orgName} in this period, so this report has no delivery to describe.`]
  }

  const d = m.delivery || {}
  out.push(
    `${orgName} worked with ${plural(people, terms.person, terms.people)} across ` +
    `${plural(d.sessions_delivered || 0, 'session', 'sessions')}` +
    (d.contact_hours ? `, delivering ${plural(d.contact_hours, 'hour', 'hours')} of provision` : '') +
    (d.locations > 1 ? ` at ${plural(d.locations, 'location', 'locations')}` : '') + '.'
  )

  if (m.reach?.new_to_us > 0) {
    out.push(
      `${m.reach.new_to_us} of them were new to us this period` +
      (m.reach.returning > 0 ? `, and ${m.reach.returning} had attended before` : '') + '.'
    )
  }

  const e = m.engagement || {}
  if (e.median_sessions != null) {
    const deep = (e.attended_5_9 || 0) + (e.attended_10_plus || 0)
    out.push(
      `The median ${terms.person} attended ${plural(Math.round(e.median_sessions), 'session', 'sessions')}` +
      (deep > 0 ? `, and ${deep} of the ${people} attended five times or more` : '') + '.'
    )
  }

  if (e.retained != null && e.retention_base > 0) {
    const pct = Math.round((e.retained / e.retention_base) * 100)
    out.push(`Of the ${e.retention_base} who came in the first half of the period, ${e.retained} (${pct}%) were still attending in the second half.`)
  }

  const o = m.outcomes || {}
  if (o.measured > 0) {
    const d = Number(o.avg_delta)
    out.push(
      `${o.improved} of the ${o.measured} ${o.measured === 1 ? terms.person : terms.people} with both a starting and a later score improved` +
      (o.declined > 0 ? `, and ${o.declined} declined` : '') + '.'
    )
    out.push(
      d > 0 ? `Scores rose by an average of ${d.toFixed(1)} points on a ten-point scale.`
        : d < 0 ? `Scores fell by an average of ${Math.abs(d).toFixed(1)} points on a ten-point scale.`
          : 'On average scores were unchanged.'
    )
  } else if (o.tracked > 0) {
    out.push(`${plural(o.tracked, `${terms.person} has`, `${terms.people} have`)} an outcome score recorded, but none yet has both a starting and a later score, so no change can be evidenced for this period.`)
  }

  if (m.goals?.completed > 0) {
    out.push(`${plural(m.goals.completed, 'goal was', 'goals were')} agreed and met during the period.`)
  }

  return out
}

/**
 * What this report cannot say.
 *
 * Printed on the report itself. A funder who spots an unstated gap distrusts
 * the whole document; one who is told about it up front usually does not mind,
 * and it is the difference between a report that reads as honest and one that
 * reads as marketing.
 */
export function buildCaveats(m, terms) {
  const out = []
  if (!m) return out

  const unknownAge = m.reach?.age_bands?.unknown || 0
  if (unknownAge > 0) {
    out.push(`${plural(unknownAge, `${terms.person} has`, `${terms.people} have`)} no date of birth recorded, so they sit outside the age breakdown.`)
  }

  const o = m.outcomes || {}
  const unmeasured = (o.tracked || 0) - (o.measured || 0)
  if (unmeasured > 0) {
    out.push(`${plural(unmeasured, `${terms.person} has`, `${terms.people} have`)} only one outcome score, which shows a starting point but no change, so they are excluded from the outcome figures.`)
  }
  if ((m.reach?.people || 0) > 0 && (o.measured || 0) === 0) {
    out.push(`Outcome figures cover only ${terms.people} scored at least twice; none met that bar this period.`)
  }

  if (m.engagement?.retained == null) {
    out.push('The period is too short to report retention across it meaningfully, so that figure is omitted.')
  } else if (!m.engagement?.retention_base) {
    out.push(`Nobody attended during the first half of the period, so there is no group to measure retention against and that figure is omitted.`)
  }

  // Named plainly rather than left for the funder to notice. These are the
  // fields grant reports most often ask for and the app does not hold them.
  out.push('Ethnicity, gender, postcode and free school meal eligibility are not recorded in this system, so no breakdown of those is included.')

  out.push('Outcome scores are staff judgements on a ten-point scale, not validated instruments. A change of less than half a point is treated as no change.')

  return out
}

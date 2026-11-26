import { supabase } from './supabase'
import { areaByKey } from '../components/impact/impact_shared'
import {
  AGE_BANDS, buildFacts, compare, comparisonPhrase, fmtCount, fmtHours, fmtRate, fmtValue, formatDay, formatRange, previousPeriod,
} from './insights'

// What each report says, declared rather than drawn.
//
// Every entry names its own aggregate and describes its own sections; one
// renderer turns any of them into a document. The alternative -- a component
// per report -- is how the nine reports drifted into being the same fourteen
// numbers under different titles in the first place.
//
// A section is dropped when its data is empty rather than printed as a row of
// zeroes, so a young organisation gets a short honest report instead of a long
// hollow one.
//
// `named: true` marks a section that lists individual people. The documents
// here are read by the staff who act on those lists and show them; the report
// studio, whose reports go to funders and boards, leaves them out unless asked.

const RPC = {
  delivery: 'report_delivery_metrics',
  attendance: 'report_attendance_metrics',
  young_people: 'report_young_people_metrics',
  impact: 'report_impact_metrics',
  learning: 'report_session_learning_metrics',
  team: 'report_workforce_metrics',
  project: 'report_project_metrics',
  programme: 'report_young_people_metrics',
  safeguarding: 'report_safeguarding_metrics',
}

export const hasDocument = (key) => Boolean(RPC[key])

export async function getReportMetrics(key, { from, to }) {
  const fn = RPC[key]
  if (!fn) throw new Error('That report has no data source yet.')
  const { data, error } = await supabase.rpc(fn, { p_from: from, p_to: to })
  if (error) throw error
  return data
}

const n = (v) => (v == null ? 0 : Number(v))
const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null)
// A negative total can only come from the old arithmetic for sessions that
// run past midnight; printing "-14h" helps nobody, so it reads as unknown.
const hrs = (v) => (v == null || n(v) < 0 ? '—' : `${n(v)}h`)
const labelled = (rows) => (rows || []).map(r => ({ label: r.label, n: n(r.n) }))

// ─────────────────────────────────────────────────────────── delivery

// The session delivery report is the snapshot of a period: what ran, when and
// where, who came and how often, how it compared with the period before, and
// what the records leave out. Its figures come from report_delivery_metrics;
// when the Insights aggregate is passed in as `m.snapshot` (the normalised
// model from lib/insights.js) it adds the comparison, the week-by-week shape,
// reach and the breakdowns by project, group and age. Without it the report
// is still whole, only shorter.
function deliverySpec(m, terms) {
  const r = m.reflections || {}
  const snap = m.snapshot || null
  const delivered = n(m.delivered)
  const reflectionPct = pct(n(r.completed), delivered)
  const reg = m.registers || null
  const regPct = reg ? pct(n(reg.completed), delivered) : null
  const prev = snap ? previousPeriod({ from: snap.from, to: snap.to }) : null
  const before = snap ? comparisonPhrase({ from: snap.from, to: snap.to }) : null
  const c = snap?.current || {}
  const p = snap?.previous || {}
  const change = (cur, was, kind) => {
    const ch = compare(cur, was, kind)
    if (!ch || was == null) return null
    const arrow = ch.direction === 'up' ? '▲ ' : ch.direction === 'down' ? '▼ ' : ''
    return `${arrow}${ch.text} (was ${fmtValue(was, kind)})`
  }
  const series = snap?.series || []
  const unit = snap?.bucket === 'week' ? 'week' : 'month'
  const bestRows = m.best_attended || []
  const projectRows = (snap?.byProject || []).filter(x => x.sessions > 0)
  const AGES = AGE_BANDS.map(b => ({ label: b.label, n: n(snap?.byAge?.find(x => x.key === b.key)?.reached) }))
  const tod = labelled(m.by_time_of_day)
  const multiDay = n(m.multi_day)
  const team = m.team || {}

  return {
    docTitle: 'Session delivery report',
    sections: [
      {
        title: 'The period at a glance',
        prose: [
          `${plural(delivered, 'session was', 'sessions were')} delivered in this period` +
          (n(m.hours) ? `, totalling ${plural(n(m.hours), 'hour', 'hours')} of provision` : '') +
          (n(m.locations) ? ` across ${plural(n(m.locations), 'location', 'locations')}` : '') + '.',
          snap && c.reached > 0
            ? `${fmtCount(c.reached)} ${c.reached === 1 ? terms.person : terms.people} came at least once, ${fmtCount(c.attendances || 0)} ${c.attendances === 1 ? 'attendance' : 'attendances'} in all` +
              (c.new_people > 0 ? `, and ${c.new_people} of them had never come before` : '') + '.'
            : null,
          snap && prev ? `Changes are measured against ${before}, ${formatRange(prev.from, prev.to)}.` : null,
          n(m.cancelled) > 0
            ? `${plural(n(m.cancelled), 'session was', 'sessions were')} cancelled and ${n(m.cancelled) === 1 ? 'is' : 'are'} excluded from every figure below.`
            : null,
        ],
        figures: snap ? [
          { value: fmtCount(delivered), label: 'sessions delivered', note: change(delivered, p.sessions_delivered, 'count') },
          { value: hrs(m.hours), label: 'hours of provision', note: n(m.hours) >= 0 ? change(n(m.hours), p.hours, 'hours') : null },
          { value: fmtCount(c.reached), label: `${terms.people} reached`, note: change(c.reached, p.reached, 'count') },
          { value: fmtRate(c.attendance_rate), label: 'attendance rate', note: change(c.attendance_rate, p.attendance_rate, 'rate') },
          { value: fmtCount(c.attendances), label: 'attendances', note: change(c.attendances, p.attendances, 'count') },
          { value: fmtCount(c.new_people), label: `new ${terms.people}`, note: change(c.new_people, p.new_people, 'count') },
          c.volunteer_hours > 0 || p.volunteer_hours > 0
            ? { value: fmtHours(c.volunteer_hours), label: 'volunteer hours', note: change(c.volunteer_hours, p.volunteer_hours, 'hours') } : null,
          { value: m.avg_duration != null ? `${Number(m.avg_duration).toFixed(1)}h` : '—', label: 'average session length' },
        ] : [
          { value: delivered, label: 'sessions delivered' },
          { value: hrs(m.hours), label: 'hours of provision' },
          { value: m.avg_duration != null ? `${Number(m.avg_duration).toFixed(1)}h` : '—', label: 'average session length' },
          { value: n(m.locations), label: 'locations used' },
        ],
      },
      {
        title: 'What stands out',
        bullets: snap ? buildFacts(snap, terms, { max: 6, skip: ['concerns', 'sessions'] }).map(f => f.text) : [],
      },
      {
        title: unit === 'week' ? 'Week by week' : 'Month by month',
        hint: `${terms.Sessions} delivered each ${unit}; cancelled ones are not counted.`,
        chart: series.length > 1 ? {
          type: 'column', integer: true, format: fmtCount, title: `${terms.Sessions} delivered each ${unit}`,
          points: series.map(x => ({ label: x.label, longLabel: x.longLabel, value: x.sessions })),
        } : null,
        table: series.length > 1 ? {
          columns: [
            { key: 'label', label: unit === 'week' ? 'Week of' : 'Month' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'hours', label: 'Hours' },
            { key: 'reached', label: terms.People },
            { key: 'rate', label: 'Attendance', strong: true },
          ],
          rows: series.map(x => ({
            label: unit === 'week' ? formatDay(x.start) : x.longLabel.replace(' (part month)', ''),
            sessions: n(x.sessions), hours: hrs(x.hours), reached: x.reached == null ? '—' : n(x.reached),
            rate: x.rate != null ? `${x.rate}%` : '—',
          })),
        } : null,
      },
      {
        title: 'Month by month',
        table: unit === 'week' && (m.by_month || []).length ? {
          columns: [
            { key: 'label', label: 'Month' },
            { key: 'n', label: 'Sessions' },
            { key: 'hours', label: 'Hours', strong: true },
          ],
          rows: (m.by_month || []).map(x => ({ label: x.label, n: n(x.n), hours: hrs(x.hours) })),
        } : (!snap && (m.by_month || []).length ? {
          columns: [
            { key: 'label', label: 'Month' },
            { key: 'n', label: 'Sessions' },
            { key: 'hours', label: 'Hours', strong: true },
          ],
          rows: (m.by_month || []).map(x => ({ label: x.label, n: n(x.n), hours: hrs(x.hours) })),
        } : null),
      },
      {
        title: 'Attendance through the period',
        hint: 'Present out of places marked on the register.',
        chart: series.filter(x => x.rate != null).length > 1 ? {
          type: 'line', format: fmtRate, maxValue: 100, title: 'Attendance rate',
          points: series.map(x => ({ label: x.label, longLabel: x.longLabel, value: x.rate })),
        } : null,
      },
      {
        title: 'By session type',
        distribution: { rows: labelled(m.by_type), total: delivered },
        table: (m.by_type || []).length ? {
          columns: [
            { key: 'label', label: 'Type' },
            { key: 'n', label: 'Sessions' },
            { key: 'hours', label: 'Hours', strong: true },
          ],
          rows: (m.by_type || []).map(t => ({ label: t.label, n: n(t.n), hours: hrs(t.hours) })),
        } : null,
      },
      {
        title: 'When sessions ran',
        hint: 'By the day and the time each one started.',
        distribution: { rows: labelled(m.by_weekday), total: delivered },
        figures: tod.length ? tod.map(t => ({ value: t.n, label: t.label.toLowerCase() })) : null,
      },
      {
        title: 'Best attended sessions',
        hint: 'By the number marked present.',
        table: bestRows.length ? {
          columns: [
            { key: 'label', label: 'Session' },
            { key: 'date', label: 'Date' },
            { key: 'present', label: 'Present' },
            { key: 'rate', label: 'Attendance', strong: true },
          ],
          rows: bestRows.map(x => ({
            label: x.label || 'Untitled session', date: formatDay(x.date, { year: true }), present: n(x.present),
            rate: x.rate != null ? `${x.rate}%` : '—',
          })),
        } : null,
      },
      {
        title: 'Registers',
        hint: 'Every figure about who came rests on these.',
        prose: [
          reg && regPct != null && regPct < 80
            ? `Registers were marked for ${n(reg.completed)} of the ${plural(delivered, 'delivered session', 'delivered sessions')} (${regPct}%). Attendance figures describe those ${n(reg.completed)} only, and marking the rest would make them more complete.`
            : null,
        ],
        figures: reg ? [
          { value: `${n(reg.completed)} of ${delivered}`, label: 'registers marked' },
          { value: fmtCount(n(reg.present)), label: 'attendances recorded' },
          { value: fmtCount(n(reg.marked)), label: 'places marked' },
        ] : null,
      },
      {
        title: 'Where it happened',
        hint: 'The ten most used locations.',
        distribution: { rows: labelled(m.by_location), total: delivered },
      },
      {
        title: 'By project',
        hint: n(m.in_projects) ? `${plural(n(m.in_projects), 'delivered session', 'delivered sessions')} belonged to a project.` : null,
        table: projectRows.length > 1 || (projectRows.length === 1 && projectRows[0].id) ? {
          columns: [
            { key: 'label', label: 'Project' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'reached', label: terms.People },
            { key: 'rate', label: 'Attendance', strong: true },
          ],
          rows: projectRows.map(x => ({ label: x.label, sessions: n(x.sessions), reached: x.reached == null ? '—' : n(x.reached), rate: x.rate != null ? `${x.rate}%` : '—' })),
        } : null,
      },
      {
        title: 'Who came',
        hint: `${terms.People} reached, by age at the end of the period.`,
        distribution: { rows: AGES, total: AGES.reduce((t, x) => t + x.n, 0) },
      },
      {
        title: `By ${terms.group || 'group'}`,
        hint: `${terms.People} reached, by the ${terms.group || 'group'} they belong to.`,
        distribution: { rows: (snap?.byGroup || []).map(x => ({ label: x.label, n: n(x.reached) })) },
      },
      {
        title: 'The team',
        figures: (team.avg_size != null || n(m.unstaffed) > 0 || c.volunteers > 0) ? [
          { value: team.avg_size != null ? Number(team.avg_size).toFixed(1) : '—', label: 'people on an average rota' },
          { value: n(team.with_volunteers), label: 'sessions with a volunteer' },
          c.volunteers > 0 ? { value: n(c.volunteers), label: 'volunteers signed in' } : null,
          { value: n(m.unstaffed), label: 'sessions with nobody on the rota' },
        ] : null,
        prose: [
          n(m.unstaffed) > 0
            ? `${plural(n(m.unstaffed), 'delivered session has', 'delivered sessions have')} nobody recorded on the staff rota. That may be a gap in the record rather than in the staffing, but it is the only signal this system holds.`
            : null,
        ],
      },
      {
        title: 'Cancelled',
        prose: [n(m.cancelled) > 0 ? `${plural(n(m.cancelled), 'session was', 'sessions were')} cancelled in this period.` : null],
        distribution: n(m.cancelled) > 0 ? { rows: labelled(m.cancellation_reasons), total: n(m.cancelled) } : null,
      },
      {
        title: 'Session reflections',
        hint: 'Written up by the staff who ran the session.',
        figures: [
          { value: n(r.completed), label: 'sessions reflected on' },
          { value: reflectionPct != null ? `${reflectionPct}%` : '—', label: 'of delivered sessions' },
          { value: r.avg_rating != null ? `${Number(r.avg_rating).toFixed(1)}/5` : '—', label: 'average rating given' },
          { value: n(r.would_repeat), label: 'staff would run again' },
        ],
      },
      {
        title: 'What this report does not cover',
        caveats: [
          `Hours are calculated from each session's scheduled start and end time. A session that ends after midnight counts the hours to its end; sessions with no time recorded contribute none.`,
          multiDay > 0
            ? `${plural(multiDay, 'session ran', 'sessions ran')} over more than one day. Their hours count the scheduled times of a single day, so residentials and trips are undercounted.`
            : null,
          reflectionPct != null && reflectionPct < 60
            ? `Reflections were completed for ${reflectionPct}% of delivered sessions, so the ratings describe that subset rather than the whole programme.`
            : null,
          snap ? `"New" means marked present for the first time anywhere in the organisation; attendance counts marked places only, so an unmarked place is neither present nor absent.` : null,
          `A session counts as delivered once it has been closed or its date has passed.`,
        ],
      },
    ],
  }
}

function learningSpec(m) {
  const required = n(m.reflection_required)
  const completed = n(m.reflections_completed)
  const completion = pct(completed, required)
  return {
    docTitle: 'Session learning report',
    sections: [
      {
        title: 'Evidence loop',
        prose: [`${plural(completed, 'session reflection was', 'session reflections were')} completed from ${plural(n(m.delivered), 'delivered session', 'delivered sessions')}.`],
        figures: [
          { value: completion != null ? `${completion}%` : '—', label: 'reflection completion' },
          { value: m.avg_overall != null ? `${m.avg_overall}/5` : '—', label: 'overall quality' },
          { value: m.avg_engagement != null ? `${m.avg_engagement}/5` : '—', label: 'engagement' },
          { value: m.avg_inclusion != null ? `${m.avg_inclusion}/5` : '—', label: 'inclusion' },
        ],
      },
      {
        title: 'Quality of evidence',
        figures: [
          { value: n(m.evidence_count), label: 'reflections with evidence' },
          { value: n(m.participant_voice_count), label: 'with participant voice' },
          { value: n(m.would_repeat), label: 'ready to repeat' },
          { value: n(m.needs_changes), label: 'need changes' },
        ],
      },
      {
        title: 'Outcomes staff observed',
        hint: 'Selected from the outcomes planned before each session.',
        distribution: { rows: labelled(m.observed_outcomes), total: (m.observed_outcomes || []).reduce((sum, x) => sum + n(x.n), 0) },
      },
      {
        title: 'Learning themes',
        distribution: { rows: labelled(m.learning_tags), total: (m.learning_tags || []).reduce((sum, x) => sum + n(x.n), 0) },
      },
      {
        title: 'Follow-up actions',
        figures: [
          { value: n(m.actions_open), label: 'open' },
          { value: n(m.actions_overdue), label: 'overdue' },
          { value: n(m.actions_completed), label: 'completed' },
          { value: n(m.safeguarding_flags), label: 'safeguarding flags' },
        ],
      },
      {
        title: 'Reading this report',
        caveats: [
          completion != null && completion < 60 ? `Only ${completion}% of required reflections were complete, so the findings describe a partial evidence base.` : null,
          'Observed outcomes are practitioner judgements, not independently verified measures.',
          'Participant voice is counted when recorded; identifying details are intentionally excluded from this aggregate report.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────── attendance

function attendanceSpec(m, terms) {
  const unmarkedShare = pct(n(m.unmarked), n(m.unmarked) + n(m.marked))
  const delta = m.rate != null && m.prev_rate != null ? n(m.rate) - n(m.prev_rate) : null
  return {
    docTitle: 'Attendance report',
    sections: [
      {
        title: 'Summary',
        prose: [
          m.rate != null
            ? `Attendance ran at ${m.rate}% across ${plural(n(m.marked), 'marked place', 'marked places')}.`
            : 'No register was marked in this period, so no attendance rate can be calculated.',
          delta != null
            ? `That compares with ${m.prev_rate}% over the preceding period of the same length, a change of ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)} points.`
            : 'There is no comparable preceding period to measure against.',
          unmarkedShare != null && unmarkedShare >= 20
            ? `${plural(n(m.unmarked), 'place was', 'places were')} never marked either way — ${unmarkedShare}% of all places on a register. Those are excluded from the rate entirely: an unmarked place is not an absence, and counting it as one would understate attendance.`
            : null,
        ],
        figures: [
          { value: m.rate != null ? `${m.rate}%` : '—', label: 'attendance rate' },
          { value: n(m.attended), label: 'attendances' },
          { value: n(m.absent), label: 'recorded absences' },
          { value: n(m.unmarked), label: 'places never marked' },
        ],
      },
      {
        title: 'Month by month',
        table: (m.by_month || []).length ? {
          columns: [
            { key: 'label', label: 'Month' },
            { key: 'n', label: 'Places marked' },
            { key: 'rate', label: 'Rate', strong: true },
          ],
          rows: (m.by_month || []).map(x => ({ label: x.label, n: n(x.n), rate: x.rate != null ? `${x.rate}%` : '—' })),
        } : null,
      },
      {
        title: 'Why people were absent',
        hint: 'As recorded on the register at the time.',
        distribution: { rows: labelled(m.absence_reasons), total: n(m.absent) },
      },
      {
        title: 'Repeat absence',
        named: true,
        hint: `${terms.People} absent twice or more in the period. Named because this is the list a report like this exists to prompt action on.`,
        ranked: { rows: (m.repeat_absentees || []).map(x => ({ label: x.label, value: n(x.n) })), unit: ' absences' },
      },
      {
        title: 'Least well attended sessions',
        hint: 'Sessions with at least three marked places.',
        table: (m.lowest_sessions || []).length ? {
          columns: [
            { key: 'label', label: 'Session' },
            { key: 'n', label: 'Places' },
            { key: 'rate', label: 'Attended', strong: true },
          ],
          rows: (m.lowest_sessions || []).map(x => ({ label: x.label, n: n(x.n), rate: x.rate != null ? `${x.rate}%` : '—' })),
        } : null,
      },
      {
        title: 'What this report does not cover',
        caveats: [
          'The rate counts marked places only: present against present plus absent. Places left unmarked are excluded rather than assumed either way.',
          unmarkedShare != null && unmarkedShare >= 20
            ? `With ${unmarkedShare}% of places unmarked, the rate describes the registers that were completed rather than everyone who was expected.`
            : null,
          'Absence reasons are free text typed at the register, so similar reasons may appear under different wording.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────── young people / programme

function youngPeopleSpec(m, terms, { programme = false } = {}) {
  const reached = n(m.reached)
  const deep = n(m.attended_5_9) + n(m.attended_10_plus)
  const retentionPct = m.retained != null && n(m.retention_base) > 0
    ? Math.round((n(m.retained) / n(m.retention_base)) * 100) : null
  const AGES = [
    ['under_8', 'Under 8'], ['age_8_11', '8–11'], ['age_12_15', '12–15'],
    ['age_16_18', '16–18'], ['age_19_plus', '19+'], ['unknown', 'Not recorded'],
  ]
  return {
    docTitle: programme ? 'Programme report' : `${terms.People} engagement report`,
    sections: [
      {
        title: 'Summary',
        prose: [
          reached === 0
            ? `No ${terms.person} attended anything in this period.`
            : `${plural(reached, terms.person, terms.people)} attended at least once, out of ${n(m.on_roll)} on the register.`,
          reached > 0 && n(m.new_to_us) > 0
            ? `${n(m.new_to_us)} had never attended before and ${n(m.returning)} had.`
            : null,
          reached > 0 && m.median_sessions != null
            ? `The median ${terms.person} came ${plural(Math.round(n(m.median_sessions)), 'time', 'times')}, and ${deep} of the ${reached} came five times or more.`
            : null,
          n(m.lapsed) > 0
            ? `${plural(n(m.lapsed), `${terms.person} who has`, `${terms.people} who have`)} attended before did not attend at all this period.`
            : null,
          retentionPct != null
            ? `Of the ${n(m.retention_base)} who came in the first half, ${n(m.retained)} (${retentionPct}%) were still coming in the second.`
            : null,
        ],
        figures: [
          { value: reached, label: `${terms.people} reached` },
          { value: n(m.new_to_us), label: 'new to us' },
          { value: n(m.total_attendances), label: 'attendances' },
          { value: n(m.lapsed), label: 'known but did not attend' },
        ],
      },
      {
        title: 'How often they came',
        hint: 'Reaching many people once and working closely with a few are different programmes, and a headcount alone cannot tell them apart.',
        distribution: {
          rows: [
            { label: 'Once', n: n(m.attended_once) },
            { label: '2–4 times', n: n(m.attended_2_4) },
            { label: '5–9 times', n: n(m.attended_5_9) },
            { label: '10+ times', n: n(m.attended_10_plus) },
          ],
          total: reached,
        },
      },
      {
        title: 'Who they were',
        distribution: {
          rows: AGES.map(([k, label]) => ({ label, n: n(m.age_bands?.[k]) })),
          total: reached,
        },
        figures: [
          { value: n(m.with_sen), label: 'with recorded additional needs' },
          { value: n(m.schools), label: 'schools represented' },
          { value: n(m.walk_ins), label: 'joined as walk-ins' },
        ],
      },
      {
        title: programme ? 'By programme' : 'By group',
        distribution: { rows: labelled(m.by_group), total: reached },
      },
      {
        title: 'Most engaged',
        named: true,
        hint: `${terms.People} who attended most often in the period.`,
        ranked: { rows: (m.most_engaged || []).map(x => ({ label: x.label, value: n(x.n) })), unit: ' sessions' },
      },
      {
        title: 'What this report does not cover',
        caveats: [
          `Reached counts ${terms.people} marked present at least once, not places offered or people invited.`,
          n(m.age_bands?.unknown) > 0
            ? `${plural(n(m.age_bands.unknown), `${terms.person} has`, `${terms.people} have`)} no date of birth recorded and sit outside the age breakdown.`
            : null,
          m.retained == null
            ? 'The period is too short to measure retention across it meaningfully.'
            : (n(m.retention_base) === 0 ? 'Nobody attended in the first half of the period, so there is no group to measure retention against.' : null),
          'Ethnicity, gender, postcode and free school meal eligibility are not recorded in this system.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────── impact

function impactSpec(m, terms) {
  const g = m.goals || {}
  const measured = n(m.measured)
  const unmeasured = n(m.tracked) - measured
  const d = m.avg_delta != null ? Number(m.avg_delta) : null
  return {
    docTitle: 'Impact report',
    sections: [
      {
        title: 'Summary',
        prose: [
          measured === 0
            ? `No ${terms.person} has both a starting and a later score inside this period, so no change can be evidenced. A first score records a starting point; a second one taken later is what turns it into a result.`
            : `${n(m.improved)} of the ${measured} ${measured === 1 ? terms.person : terms.people} with both a starting and a later score improved` +
              (n(m.declined) > 0 ? `, and ${n(m.declined)} declined` : '') + '.',
          measured > 0 && d != null
            ? (d > 0 ? `Scores rose by an average of ${d.toFixed(1)} points on a ten-point scale.`
              : d < 0 ? `Scores fell by an average of ${Math.abs(d).toFixed(1)} points on a ten-point scale.`
                : 'On average scores were unchanged.')
            : null,
          n(g.completed) > 0 ? `${plural(n(g.completed), 'goal was', 'goals were')} agreed and met during the period.` : null,
        ],
        figures: measured > 0 ? [
          { value: n(m.improved), label: 'improved' },
          { value: n(m.held), label: 'held steady' },
          { value: n(m.declined), label: 'declined' },
          { value: d != null ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)}` : '—', label: 'average change, out of 10' },
        ] : [
          { value: n(m.readings), label: 'scores recorded' },
          { value: n(m.tracked), label: `${terms.people} with a score` },
          { value: 0, label: 'with a start and an end' },
        ],
      },
      {
        title: 'By outcome area',
        hint: 'From the average starting score to where it stands now.',
        table: (m.by_area || []).length ? {
          columns: [
            { key: 'label', label: 'Outcome area' },
            { key: 'people', label: terms.People },
            { key: 'baseline', label: 'Start' },
            { key: 'latest', label: 'Latest' },
            { key: 'delta', label: 'Change', strong: true },
          ],
          rows: (m.by_area || []).map(a => ({
            label: areaByKey(a.area).label,
            people: n(a.people),
            baseline: Number(a.baseline).toFixed(1),
            latest: Number(a.latest).toFixed(1),
            delta: `${Number(a.delta) > 0 ? '+' : Number(a.delta) < 0 ? '−' : ''}${Math.abs(Number(a.delta)).toFixed(1)}`,
          })),
        } : null,
      },
      {
        title: 'Biggest gains',
        named: true,
        hint: 'The individual journeys behind the averages, and where a case study would start.',
        ranked: {
          rows: (m.most_improved || []).map(x => ({
            label: x.label,
            value: `${Number(x.delta) > 0 ? '+' : ''}${Number(x.delta).toFixed(1)} over ${x.areas} area${n(x.areas) !== 1 ? 's' : ''}`,
          })),
        },
      },
      {
        title: 'Where scores fell',
        named: true,
        ranked: {
          rows: (m.needs_attention || []).map(x => ({
            label: x.label,
            value: `${Number(x.delta).toFixed(1)} over ${x.areas} area${n(x.areas) !== 1 ? 's' : ''}`,
          })),
        },
      },
      {
        title: 'Goals',
        hint: `Agreed with a ${terms.person}, and either met or not — no rating involved.`,
        figures: [
          { value: n(g.completed), label: 'met in this period' },
          { value: n(g.created), label: 'set in this period' },
          { value: n(g.active), label: 'still open' },
          { value: n(g.overdue), label: 'past their target date' },
        ],
        distribution: { rows: labelled(g.by_area) },
      },
      {
        title: 'What this report does not cover',
        caveats: [
          `Change is measured per ${terms.person} per outcome area, from their first score in the period to their most recent. A single score gives a starting point but no change.`,
          unmeasured > 0
            ? `${plural(unmeasured, `${terms.person} has`, `${terms.people} have`)} only one score in this period and are excluded from every change figure.`
            : null,
          'Scores are staff judgements on a ten-point scale, not validated instruments. A change of less than half a point is treated as no change.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────── workforce

function workforceSpec(m, terms) {
  const coverage = pct(n(m.sessions_covered), n(m.sessions_total))
  const slots = m.volunteer_slots || {}
  const dbs = m.dbs || {}
  const uncovered = n(m.sessions_total) - n(m.sessions_covered)
  return {
    docTitle: 'Workforce delivery report',
    sections: [
      {
        title: 'Summary',
        prose: [
          `${plural(n(m.people), 'person', 'people')} delivered sessions in this period — ${n(m.staff)} staff and ${n(m.volunteers)} ${n(m.volunteers) === 1 ? 'volunteer' : 'volunteers'} — contributing ${plural(n(m.hours), 'hour', 'hours')} between them.`,
          coverage != null
            ? `${n(m.sessions_covered)} of ${n(m.sessions_total)} sessions had somebody on the rota (${coverage}%)` +
              (uncovered > 0 ? `, leaving ${plural(uncovered, 'session', 'sessions')} with no one recorded.` : '.')
            : null,
          n(slots.required) > 0 && n(slots.filled) < n(slots.required)
            ? `${n(slots.filled)} of ${n(slots.required)} advertised volunteer places were filled.`
            : null,
        ],
        figures: [
          { value: n(m.people), label: 'people delivering' },
          { value: hrs(m.hours), label: 'hours contributed' },
          { value: n(m.assignments), label: 'session assignments' },
          { value: m.avg_per_session != null ? Number(m.avg_per_session).toFixed(1) : '—', label: 'average per session' },
        ],
      },
      {
        title: 'Who delivered',
        named: true,
        hint: 'By number of sessions worked in the period.',
        table: (m.by_person || []).length ? {
          columns: [
            { key: 'label', label: 'Name' },
            { key: 'kind', label: 'Role' },
            { key: 'n', label: 'Sessions' },
            { key: 'hours', label: 'Hours', strong: true },
          ],
          rows: (m.by_person || []).map(p => ({ label: p.label, kind: p.kind, n: n(p.n), hours: hrs(p.hours) })),
        } : null,
      },
      {
        title: 'Rota roles',
        distribution: { rows: labelled(m.by_role), total: n(m.assignments) },
      },
      {
        title: 'Safer recruitment',
        hint: 'Counts only. A report is not the place to list who is out of date.',
        figures: [
          { value: n(dbs.volunteers_expired), label: 'active volunteers with an expired DBS' },
          { value: n(dbs.volunteers_expiring_90d), label: 'expiring within 90 days' },
          { value: n(dbs.volunteers_missing), label: 'with no DBS number recorded' },
        ],
      },
      {
        title: 'What this report does not cover',
        caveats: [
          'Hours are the scheduled length of each session a person was rostered to, not hours they recorded themselves.',
          uncovered > 0
            ? `${plural(uncovered, 'session has', 'sessions have')} nobody on the rota. That is likely a gap in the record rather than a session run unstaffed, but this system cannot tell the difference.`
            : null,
          'Volunteers managed outside this system do not appear.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────── projects

function projectSpec(m, terms) {
  return {
    docTitle: 'Project report',
    sections: [
      {
        title: 'Summary',
        prose: [
          n(m.projects) === 0
            ? 'No project overlapped this period.'
            : `${plural(n(m.projects), 'project', 'projects')} ran in this period, delivering ${plural(n(m.sessions), 'session', 'sessions')} and ${plural(n(m.hours), 'hour', 'hours')} of provision to ${plural(n(m.participants), terms.person, terms.people)}.`,
        ],
        figures: n(m.projects) > 0 ? [
          { value: n(m.projects), label: 'projects' },
          { value: n(m.sessions), label: 'sessions delivered' },
          { value: hrs(m.hours), label: 'hours of provision' },
          { value: n(m.participants), label: `${terms.people} taking part` },
        ] : [],
      },
      {
        title: 'Project by project',
        table: (m.rows || []).length ? {
          columns: [
            { key: 'name', label: 'Project' },
            { key: 'dates', label: 'Dates' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'participants', label: terms.People },
            { key: 'rate', label: 'Attendance', strong: true },
          ],
          rows: (m.rows || []).map(p => ({
            name: p.name,
            dates: [p.start, p.end].filter(Boolean)
              .map(d => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
              .join(' – ') || '—',
            sessions: n(p.sessions),
            participants: `${n(p.participants)}${n(p.enrolled) ? ` of ${n(p.enrolled)}` : ''}`,
            rate: p.rate != null ? `${p.rate}%` : '—',
          })),
        } : null,
      },
      {
        title: 'What this report does not cover',
        caveats: [
          `${terms.People} are counted as taking part when they were marked present at a project session, which is why that figure can differ from the number enrolled.`,
          'Only sessions linked to a project are counted here. Regular delivery appears in the session delivery report instead.',
          'A project with no register marked shows no attendance rate rather than a rate of zero.',
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────── safeguarding

function safeguardingSpec(m, terms) {
  const resolvedPct = pct(n(m.resolved), n(m.raised))
  const closedByStatus = (m.by_status || []).find(s => /clos|resolv/i.test(s.label))
  // The two fields genuinely disagree in live data, and a reader comparing them
  // deserves to be told why rather than left to wonder which is wrong.
  const statusMismatch = closedByStatus && n(closedByStatus.n) !== n(m.resolved)
  return {
    docTitle: 'Safeguarding report',
    sections: [
      {
        title: 'Summary',
        prose: [
          `${plural(n(m.raised), 'concern was', 'concerns were')} raised in this period` +
          (resolvedPct != null && n(m.raised) > 0 ? `, of which ${n(m.resolved)} have been resolved (${resolvedPct}%).` : '.'),
          n(m.open_all_time) > 0
            ? `${plural(n(m.open_all_time), 'concern is', 'concerns are')} open across all time, including any raised before this period.`
            : 'No concern is currently open.',
          m.median_hours_to_dsl != null
            ? `The median time from a concern being raised to the designated safeguarding lead being notified was ${Number(m.median_hours_to_dsl).toFixed(1)} hours.`
            : null,
          n(m.follow_up_overdue) > 0
            ? `${plural(n(m.follow_up_overdue), 'open concern is', 'open concerns are')} past the follow-up date set for them.`
            : null,
        ],
        figures: [
          { value: n(m.raised), label: 'concerns raised' },
          { value: n(m.resolved), label: 'resolved' },
          { value: n(m.open_all_time), label: 'open now, all time' },
          { value: m.median_days_to_resolve != null ? `${Number(m.median_days_to_resolve).toFixed(1)}d` : '—', label: 'median days to resolve' },
        ],
      },
      {
        title: 'Notification',
        hint: 'Whether the right people were told, and how quickly.',
        figures: [
          { value: n(m.dsl_notified), label: 'safeguarding lead notified' },
          { value: n(m.parents_notified), label: 'parents or carers notified' },
          { value: n(m.police_notified), label: 'police notified' },
          { value: m.median_hours_to_dsl != null ? `${Number(m.median_hours_to_dsl).toFixed(1)}h` : '—', label: 'median time to the lead' },
        ],
      },
      { title: 'By type', distribution: { rows: labelled(m.by_type), total: n(m.raised) } },
      { title: 'By priority', distribution: { rows: labelled(m.by_priority), total: n(m.raised) } },
      { title: 'By current status', distribution: { rows: labelled(m.by_status), total: n(m.raised) } },
      {
        title: 'Month by month',
        table: (m.by_month || []).length ? {
          columns: [{ key: 'label', label: 'Month' }, { key: 'n', label: 'Concerns raised', strong: true }],
          rows: (m.by_month || []).map(x => ({ label: x.label, n: n(x.n) })),
        } : null,
      },
      {
        title: 'What this report does not cover',
        caveats: [
          'Aggregate figures only. No name, description or identifying detail of any concern appears in this report, and it should still be handled as a restricted document.',
          statusMismatch
            ? `${n(closedByStatus.n)} ${n(closedByStatus.n) === 1 ? 'concern is' : 'concerns are'} marked "${closedByStatus.label}" by status, but ${n(m.resolved)} ${n(m.resolved) === 1 ? 'has' : 'have'} a resolution date recorded. The counts above use the resolution date. The difference is worth correcting in the records themselves.`
            : null,
          'Response times can only be measured where the notification time was recorded at the time.',
          'Concerns escalated into a formal case are counted here as raised, and their later handling is not tracked in this report.',
        ],
      },
    ],
  }
}

const BUILDERS = {
  delivery: deliverySpec,
  attendance: attendanceSpec,
  young_people: (m, t) => youngPeopleSpec(m, t),
  programme: (m, t) => youngPeopleSpec(m, t, { programme: true }),
  impact: impactSpec,
  learning: learningSpec,
  team: workforceSpec,
  project: projectSpec,
  safeguarding: safeguardingSpec,
}

export function buildSpec(key, m, terms) {
  const fn = BUILDERS[key]
  if (!fn || !m) return null
  const spec = fn(m, terms)
  // Drop sections with nothing in them, so a young organisation gets a short
  // honest report rather than a long one full of zeroes.
  spec.sections = spec.sections.filter(s => {
    if (!s) return false
    const hasProse = (s.prose || []).filter(Boolean).length > 0
    const hasFigures = (s.figures || []).filter(Boolean).length > 0
    const hasDist = ((s.distribution?.rows) || []).filter(r => r && r.n > 0).length > 0
    const hasRanked = ((s.ranked?.rows) || []).length > 0
    const hasTable = ((s.table?.rows) || []).length > 0
    const hasCaveats = (s.caveats || []).filter(Boolean).length > 0
    const hasBullets = (s.bullets || []).filter(Boolean).length > 0
    const hasChart = (s.chart?.points || []).some(p => p.value != null)
    return hasProse || hasFigures || hasDist || hasRanked || hasTable || hasCaveats || hasBullets || hasChart
  })
  return spec
}

import { addDays, format, parseISO } from 'date-fns'
import { buildAttentionItems, buildCoverage, safetyStateOf, SAFETY } from './ra_safety'
import { daysUntil } from './ra_shared'
import { todayInLondon } from '../../lib/today'

// Calendar days from today in London. toISOString() gave the UTC date, which is
// a day behind between midnight and 1am BST, so "today" read as yesterday and
// the session two days out fell off the list. Stepping by calendar day rather
// than by 24 hours also keeps it right across the clock change.
const day = n => format(addDays(parseISO(todayInLondon()), n), 'yyyy-MM-dd')
const approved = { manager_approved_at: '2026-01-01T00:00:00Z', status: 'active' }

describe('buildAttentionItems', () => {
  it('agrees with itself about one hazard', () => {
    const [item] = buildAttentionItems({
      assessments: [{ id: 'a1', name: 'Afterschool club', next_review_date: day(90), ...approved }],
      outstandingByAssessment: { a1: 1 },
    })
    expect(item.detail).toBe('1 control still to complete')
  })

  it('and about several', () => {
    const [item] = buildAttentionItems({
      assessments: [{ id: 'a1', name: 'Afterschool club', next_review_date: day(90), ...approved }],
      outstandingByAssessment: { a1: 3 },
    })
    expect(item.detail).toBe('3 controls still to complete')
  })

  it('raises a session with no assessment, and names the day', () => {
    const items = buildAttentionItems({
      sessions: [
        { id: 's1', title: 'October — Day 2', session_date: day(0) },
        { id: 's2', title: 'October — Day 3', session_date: day(1) },
        { id: 's3', title: 'October — Day 4', session_date: day(2) },
      ],
      coverage: {},
    })
    expect(items.map(i => i.detail)).toEqual([
      'Starts today with no risk assessment',
      'Starts tomorrow with no risk assessment',
      'Starts in 2 days with no risk assessment',
    ])
    expect(items.every(i => i.cta === 'Create Assessment')).toBe(true)
  })

  // Every item carrying a session is excluded from the "Also coming up" strip,
  // so a session cannot be listed twice on one screen with the same button.
  it('carries the session on every session-derived item, so the overview can de-duplicate', () => {
    const sessions = [{ id: 's1', title: 'Day 2', session_date: day(1) }]
    const uncovered = buildAttentionItems({ sessions, coverage: {} })
    expect(uncovered[0].session.id).toBe('s1')

    const draft = { id: 'a1', name: 'Day 2', status: 'draft', next_review_date: day(90) }
    const covered = buildAttentionItems({ sessions, coverage: { s1: draft }, assessments: [draft] })
    expect(covered.filter(i => i.session).map(i => i.session.id)).toContain('s1')
  })

  it('leaves a covered, ready session out of the list entirely', () => {
    const ready = { id: 'a1', name: 'Saturday Football', next_review_date: day(120), ...approved }
    const items = buildAttentionItems({
      assessments: [ready],
      sessions: [{ id: 's1', title: 'Saturday Football', session_date: day(3) }],
      coverage: { s1: ready },
    })
    expect(items).toEqual([])
  })
})

test('expired and review-due records remain actionable without a review date', () => {
  const items = buildAttentionItems({ assessments: [
    { id: 'expired', name: 'Old assessment', status: 'expired', approval_required: false },
    { id: 'review', name: 'Check again', status: 'review_due', approval_required: false },
  ] })
  expect(items.map(i => i.detail)).toEqual(['Assessment has expired', 'Assessment is marked for review'])
})

test('cancelled, closed, draft and explicitly exempt activities do not raise missing-assessment warnings', () => {
  const sessions = [
    { id: 'cancelled', status: 'cancelled' }, { id: 'cancelled-at', cancelled_at: new Date().toISOString() },
    { id: 'closed', closed_at: new Date().toISOString() }, { id: 'draft', status: 'draft' },
    { id: 'completed', status: 'completed' }, { id: 'optional', risk_assessment_required: false },
  ].map(s => ({ ...s, session_date: day(1) }))
  expect(buildAttentionItems({ sessions })).toEqual([])
})

test('project coverage still applies and incomplete controls never qualify as ready', () => {
  const assessment = { id: 'a', project_id: 'p', is_project_level: true, next_review_date: day(90), ...approved }
  const outstandingByAssessment = { a: 2 }
  const coverage = buildCoverage({ assessments: [assessment], sessions: [{ id: 's', project_id: 'p' }], outstandingByAssessment })
  expect(coverage.s.id).toBe('a')
  expect(safetyStateOf(coverage.s, { outstandingByAssessment })).toBe(SAFETY.REVIEW)
})

test('review dates follow the London day across BST midnight and clock changes', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-01T23:30:00Z'))
  expect(daysUntil('2026-07-02')).toBe(0)
  expect(daysUntil('2026-07-01')).toBe(-1)
  jest.setSystemTime(new Date('2026-10-24T23:30:00Z'))
  expect(daysUntil('2026-10-26')).toBe(1)
  expect(daysUntil('bad date')).toBeNull()
  jest.useRealTimers()
})

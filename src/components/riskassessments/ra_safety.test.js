import { buildAttentionItems } from './ra_safety'

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const approved = { manager_approved_at: '2026-01-01T00:00:00Z', status: 'active' }

describe('buildAttentionItems', () => {
  it('agrees with itself about one hazard', () => {
    const [item] = buildAttentionItems({
      assessments: [{ id: 'a1', name: 'Afterschool club', next_review_date: day(90), ...approved }],
      outstandingByAssessment: { a1: 1 },
    })
    expect(item.detail).toBe('1 hazard still requires controls')
  })

  it('and about several', () => {
    const [item] = buildAttentionItems({
      assessments: [{ id: 'a1', name: 'Afterschool club', next_review_date: day(90), ...approved }],
      outstandingByAssessment: { a1: 3 },
    })
    expect(item.detail).toBe('3 hazards still require controls')
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

import { buildSpec, hasDocument } from './reportDocs'
import { deriveInsights } from './reportingService'

const learning = {
  delivered: 10,
  reflection_required: 8,
  reflections_completed: 6,
  avg_overall: 4.2,
  avg_engagement: 4.4,
  avg_inclusion: 4.1,
  evidence_count: 5,
  participant_voice_count: 3,
  would_repeat: 4,
  needs_changes: 2,
  actions_open: 2,
  actions_overdue: 1,
  actions_completed: 3,
  safeguarding_flags: 0,
  observed_outcomes: [{ label: 'Confidence', n: 4 }],
  learning_tags: [{ label: 'Strong engagement', n: 3 }],
}

test('session learning is a first-class report document', () => {
  expect(hasDocument('learning')).toBe(true)
  const spec = buildSpec('learning', learning, {})
  expect(spec.docTitle).toBe('Session learning report')
  expect(spec.sections.map(section => section.title)).toEqual(expect.arrayContaining([
    'Evidence loop', 'Outcomes staff observed', 'Follow-up actions',
  ]))
})

test('missing reflections and overdue actions become operational insights', () => {
  const insights = deriveInsights({ attendance_rate: null, prev_attendance_rate: null, open_concerns: 0, outcomes: 0 }, { learning })
  expect(insights.map(insight => insight.key)).toEqual(expect.arrayContaining(['reflections_due', 'actions_overdue']))
  expect(insights.find(insight => insight.key === 'reflections_due').target).toBe('sessions')
})


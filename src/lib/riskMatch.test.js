import { rankAssessments, templateForSession, riskStateLabel, matchScore } from './riskMatch'

const inDays = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d)
}
const ready = { status: 'active', manager_approved_at: '2026-10-01T10:00:00Z', next_review_date: inDays(90) }

const library = [
  { id: 'cook', name: 'Cooking club', activity_type: 'Cooking', location: 'Kitchen', ...ready },
  { id: 'coast', name: 'Day trip to the coast', activity_type: 'Day Trip', location: 'Brighton beach', ...ready },
  { id: 'lake', name: 'Lake District residential', activity_type: 'Residential', location: 'Keswick', status: 'draft' },
  { id: 'old', name: 'Brighton 2024', activity_type: 'Day Trip', location: 'Brighton', archived: true },
]

test('a trip to Brighton finds the coast assessment first, and never an archived one', () => {
  const { list, best } = rankAssessments(library, { session_type: 'trip', title: 'Coast trip', location: 'Brighton' })
  expect(best.id).toBe('coast')
  expect(list[0].id).toBe('coast')
  expect(list.map(a => a.id)).not.toContain('old')
})

test('a residential matches on type even when it is still a draft', () => {
  const { best } = rankAssessments(library, { session_type: 'residential', title: 'Summer camp', location: 'Cumbria' })
  expect(best.id).toBe('lake')
})

test('nothing is called a best match when nothing actually fits', () => {
  const { best, list } = rankAssessments(library, { session_type: 'mentoring', title: 'Drop-in', location: 'Library' })
  expect(best).toBeNull()
  // Ready ones still come before drafts.
  expect(list[list.length - 1].id).toBe('lake')
})

test('a ready assessment outranks a draft of the same fit', () => {
  const a = { name: 'Football', activity_type: 'Sports', location: 'Park', ...ready }
  const b = { name: 'Football', activity_type: 'Sports', location: 'Park', status: 'draft' }
  const s = { session_type: 'sports', title: 'Football', location: 'Park' }
  expect(matchScore(a, s)).toBeGreaterThan(matchScore(b, s))
})

test('each kind of session starts from a template with real hazards', () => {
  expect(templateForSession('trip').key).toBe('trips')
  expect(templateForSession('residential').key).toBe('residential')
  expect(templateForSession('competition').key).toBe('sports')
  expect(templateForSession('something-new').key).toBe('general')
  expect(templateForSession('trip').hazards.length).toBeGreaterThan(2)
})

test('states read plainly', () => {
  expect(riskStateLabel(null).label).toBe('No risk assessment')
  expect(riskStateLabel({ status: 'draft' }).short).toBe('Draft')
  expect(riskStateLabel(ready).label).toBe('Ready to run')
  expect(riskStateLabel({ ...ready, next_review_date: inDays(-3) }).label).toBe('Review overdue')
})

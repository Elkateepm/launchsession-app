import { daysUntil } from './ra_shared'

// Triage rules for the redesigned overview.
//
// The module's job is to answer "is this activity safe to run?", so an
// assessment's operational state is not the same as its stored `status`. A
// record can say 'active' while its review lapsed a month ago, and a draft
// attached to a session starting tomorrow matters far more than a draft
// attached to nothing. These helpers make that judgement in one place so the
// status strip, the attention list and the activity cards cannot disagree.

export const SAFETY = {
  READY: 'ready',
  REVIEW: 'review',
  ACTION: 'action',
  DRAFT: 'draft',
}

export const SAFETY_META = {
  [SAFETY.READY]:  { label: 'Ready to run', dot: '#12B76A', bg: '#E7F8ED', text: '#04713C' },
  [SAFETY.REVIEW]: { label: 'Need review', dot: '#F79009', bg: '#FEF6E7', text: '#93500A' },
  [SAFETY.ACTION]: { label: 'Requires action', dot: '#E5484D', bg: '#FEF2F2', text: '#B42318' },
  [SAFETY.DRAFT]:  { label: 'Drafts',      dot: '#98A2B3', bg: '#F3F2F7', text: '#5A5772' },
}

// Review is treated as lapsed a week before the date, not on it: an assessment
// that expires the morning of a trip is not something anyone wants to discover
// on the coach.
const REVIEW_WARNING_DAYS = 7

export function isArchived(assessment) {
  return !!assessment?.archived || assessment?.status === 'archived'
}

export function safetyStateOf(assessment, ctx = {}) {
  if (!assessment) return SAFETY.ACTION
  if (isArchived(assessment)) return SAFETY.DRAFT

  // A control that is not yet in place is mitigation that does not exist.
  // Callers without the counts pass nothing and get the old behaviour, so no
  // screen silently claims certainty it doesn't have.
  const outstanding = ctx.outstandingByAssessment?.[assessment.id] || 0

  const reviewDate = assessment.next_review_date || assessment.review_date
  const days = daysUntil(reviewDate)

  // Overdue review outranks everything else. An approved assessment whose
  // review lapsed is not evidence the activity is still safe.
  if (days !== null && days < 0) return SAFETY.ACTION
  if (assessment.status === 'expired') return SAFETY.ACTION

  if (assessment.status === 'draft') return SAFETY.DRAFT

  if (outstanding > 0) return SAFETY.REVIEW

  if (assessment.status === 'review_due') return SAFETY.REVIEW
  if (days !== null && days <= REVIEW_WARNING_DAYS) return SAFETY.REVIEW

  // Approval outstanding while the org requires it.
  if (assessment.approval_required !== false && !assessment.manager_approved_at) return SAFETY.REVIEW

  return SAFETY.READY
}

// Finding 8: archived records inflated the Drafts figure and reappeared under
// Recent assessments even though the library filters them out. The overview is
// a picture of live safety, so archived work is excluded here in one place
// rather than at each call site.
export function activeOnly(assessments = []) {
  return assessments.filter(a => !isArchived(a))
}

export function summariseSafety(assessments = [], ctx = {}) {
  const counts = { [SAFETY.READY]: 0, [SAFETY.REVIEW]: 0, [SAFETY.ACTION]: 0, [SAFETY.DRAFT]: 0 }
  activeOnly(assessments).forEach(a => { counts[safetyStateOf(a, ctx)] += 1 })
  return counts
}

/**
 * The Needs Attention list. Ordered by how soon someone has to do something
 * about it, not by how the record was last edited.
 *
 * `outstandingByAssessment` maps assessment id -> count of controls not yet
 * completed, so an assessment can be flagged as incomplete without every caller
 * re-querying controls.
 */
export function buildAttentionItems({ assessments = [], sessions = [], coverage = {}, outstandingByAssessment = {} }) {
  const items = []

  assessments.forEach(a => {
    if (isArchived(a)) return
    const reviewDate = a.next_review_date || a.review_date
    const days = daysUntil(reviewDate)

    if (days !== null && days < 0) {
      items.push({
        id: `review-${a.id}`,
        assessment: a,
        severity: 'action',
        title: a.name,
        detail: `Review overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`,
        cta: 'Review Assessment',
        // Longer overdue sorts first.
        weight: -1000 + days,
      })
      return
    }

    const outstanding = outstandingByAssessment[a.id] || 0
    if (outstanding > 0) {
      items.push({
        id: `controls-${a.id}`,
        assessment: a,
        severity: 'review',
        title: a.name,
        detail: `${outstanding} hazard${outstanding === 1 ? '' : 's'} still require controls`,
        cta: 'Continue Assessment',
        weight: -500,
      })
      return
    }

    if (a.approval_required !== false && !a.manager_approved_at && a.status !== 'draft') {
      items.push({
        id: `approve-${a.id}`,
        assessment: a,
        severity: 'review',
        title: a.name,
        detail: 'Awaiting approval',
        cta: 'Review & Approve',
        weight: -400,
      })
      return
    }

    if (days !== null && days <= REVIEW_WARNING_DAYS) {
      items.push({
        id: `soon-${a.id}`,
        assessment: a,
        severity: 'review',
        title: a.name,
        detail: days === 0 ? 'Review due today' : `Review due in ${days} day${days === 1 ? '' : 's'}`,
        cta: 'Review Assessment',
        weight: days,
      })
    }
  })

  // A session with no assessment at all is the most urgent thing this module
  // can surface, and it isn't visible from the assessment list -- only by
  // looking at what's actually scheduled.
  sessions.forEach(s => {
    const cover = coverage[s.id]
    const days = daysUntil(s.session_date)
    if (days === null || days < 0 || days > 14) return

    if (!cover) {
      items.push({
        id: `uncovered-${s.id}`,
        session: s,
        severity: 'action',
        title: s.title || 'Session',
        detail: days === 0 ? 'Starts today with no risk assessment'
          : days === 1 ? 'Starts tomorrow with no risk assessment'
          : `Starts in ${days} days with no risk assessment`,
        cta: 'Create Assessment',
        weight: -2000 + days,
      })
      return
    }

    const state = safetyStateOf(cover, { outstandingByAssessment })
    if (state !== SAFETY.READY && days <= 7) {
      items.push({
        id: `cover-${s.id}`,
        session: s,
        assessment: cover,
        severity: state === SAFETY.ACTION ? 'action' : 'review',
        title: s.title || 'Session',
        detail: days <= 1
          ? `Starts ${days === 0 ? 'today' : 'tomorrow'} — assessment ${SAFETY_META[state].label.toLowerCase()}`
          : `Starts in ${days} days — assessment ${SAFETY_META[state].label.toLowerCase()}`,
        cta: state === SAFETY.DRAFT ? 'Continue Assessment' : 'Review Assessment',
        weight: -1500 + days,
      })
    }
  })

  return items.sort((a, b) => a.weight - b.weight)
}

/**
 * Map session id -> the assessment covering it, given the join rows. A
 * project-level assessment covers every session in that project, so a session
 * with no direct link can still be covered.
 */
// When more than one assessment could cover an activity, prefer the one that
// best evidences the activity is safe: ready over needing review, and among
// equals the one reviewed most recently. Without this the winner was whichever
// row the database happened to return last.
const COVERAGE_RANK = { [SAFETY.READY]: 0, [SAFETY.REVIEW]: 1, [SAFETY.ACTION]: 2, [SAFETY.DRAFT]: 3 }

function preferredCover(a, b, ctx) {
  if (!a) return b
  if (!b) return a
  const ra = COVERAGE_RANK[safetyStateOf(a, ctx)]
  const rb = COVERAGE_RANK[safetyStateOf(b, ctx)]
  if (ra !== rb) return ra < rb ? a : b

  const da = a.next_review_date || a.review_date || ''
  const db = b.next_review_date || b.review_date || ''
  if (da !== db) return da > db ? a : b

  return (a.updated_at || a.created_at || '') >= (b.updated_at || b.created_at || '') ? a : b
}

export function buildCoverage({ links = [], assessments = [], sessions = [], outstandingByAssessment = {} }) {
  const ctx = { outstandingByAssessment }
  const byId = new Map(assessments.map(a => [a.id, a]))
  const coverage = {}

  links.forEach(l => {
    const a = byId.get(l.assessment_id)
    if (!a || isArchived(a)) return
    // A direct link always wins over project-level cover, but between two
    // direct links the better assessment wins rather than the later row.
    coverage[l.session_id] = preferredCover(coverage[l.session_id], a, ctx)
  })

  const projectLevel = assessments.filter(a => a.is_project_level && a.project_id && !isArchived(a))
  if (projectLevel.length) {
    const byProject = new Map()
    projectLevel.forEach(a => {
      byProject.set(a.project_id, preferredCover(byProject.get(a.project_id), a, ctx))
    })
    sessions.forEach(s => {
      if (coverage[s.id] || !s.project_id) return
      const a = byProject.get(s.project_id)
      if (a) coverage[s.id] = a
    })
  }

  return coverage
}

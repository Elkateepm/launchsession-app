import { supabase } from './supabase'

// Carrying a risk assessment across when an activity is copied.
//
// A session's link to its assessment lives in `risk_assessment_sessions`, not
// on the session row, so every path that copies a session by spreading its
// columns copies the `risk_assessment_required` flag and leaves the assessment
// behind. The copy then announces that it needs an assessment and has none --
// which is how a week of activities ends up on the Risk Assessments overview
// demanding work that was already done for the activity they were copied from.
//
// Duplicating an activity is the one case where reusing the assessment is
// unambiguously right: it is the same activity, the same place, the same
// hazards, on a different date.

/** The id of the assessment linked to a session, or null. */
export async function assessmentIdForSession(sessionId, orgId) {
  if (!sessionId || !orgId) return null
  const { data } = await supabase
    .from('risk_assessment_sessions')
    .select('assessment_id')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle()
  return data?.assessment_id || null
}

/**
 * Link the copy to whatever assessment covered the original.
 *
 * Returns the assessment id it carried across, or null if there was nothing to
 * carry. Failure is deliberately not thrown: the session has already been
 * created by the time this runs, and losing the copy because the link failed
 * would be worse than the missing link, which the overview will flag anyway.
 */
export async function carryAssessmentToSession(fromSessionId, toSessionId, orgId) {
  const assessmentId = await assessmentIdForSession(fromSessionId, orgId)
  if (!assessmentId || !toSessionId) return null
  const { error } = await supabase
    .from('risk_assessment_sessions')
    .insert({ assessment_id: assessmentId, session_id: toSessionId, org_id: orgId })
  return error ? null : assessmentId
}

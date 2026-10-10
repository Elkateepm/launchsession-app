import { supabase } from '../../lib/supabase'
import { todayInLondon } from '../../lib/today'

export const SESSION_WINDOW = 40
export const readRiskQuery = query => Promise.resolve(query).catch(() => ({ data: null, error: true }))

export async function loadRiskOperational(orgId) {
  const [plans, links, controls] = await Promise.all([
    readRiskQuery(supabase.from('sessions')
      .select('id, title, session_date, start_time, location, session_type, project_id, risk_assessment_required, status, cancelled_at, closed_at')
      .eq('org_id', orgId).gte('session_date', todayInLondon())
      .is('cancelled_at', null).is('closed_at', null).or('status.is.null,status.not.in.(cancelled,draft,completed)')
      .order('session_date').order('start_time').limit(SESSION_WINDOW + 1)),
    readRiskQuery(supabase.from('risk_assessment_sessions').select('assessment_id, session_id').eq('org_id', orgId)),
    readRiskQuery(supabase.from('risk_controls').select('hazard_id, completed, risk_assessment_hazards!inner(assessment_id)')
      .eq('org_id', orgId).eq('completed', false)),
  ])
  const outstanding = {}
  ;(controls.error ? [] : controls.data || []).forEach(c => {
    const id = c.risk_assessment_hazards?.assessment_id
    if (id) outstanding[id] = (outstanding[id] || 0) + 1
  })
  return {
    sessions: plans.error ? [] : (plans.data || []).slice(0, SESSION_WINDOW),
    truncated: !plans.error && (plans.data || []).length > SESSION_WINDOW,
    links: links.error ? [] : links.data || [], outstanding,
    errors: [plans.error && 'upcoming activities', links.error && 'assessment links', controls.error && 'controls'].filter(Boolean),
  }
}

import { londonDate, sessionPhase } from '../../lib/sessionPhase'

export function buildProjectAttention(days, attendance, reflections, riskLinks, now = new Date()) {
  const today = londonDate(now)
  const items = []
  for (const day of days) {
    if (day.status === 'cancelled' || day.cancelled_at) continue
    const add = (kind, reason, count) => items.push({ id: `${day.id}-${reason}`, kind, reason, count, day })
    if (!day.closed_at && day.risk_assessment_required && riskLinks && !riskLinks[day.id]) add('safety', 'risk')
    if (day.closed_at) {
      if (reflections && !reflections[day.id]) add('reflection', 'reflection')
      const unmarked = attendance?.filter(a => a.session_id === day.id && (!a.status || a.status === 'expected')).length
      if (unmarked > 0) add('register', 'unmarked', unmarked)
    } else if (day.session_date < today && day.status !== 'draft' && sessionPhase(day, now) === 'completed') {
      add('register', 'close')
    }
  }
  const rank = { safety: 0, register: 1, reflection: 2 }
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.day.session_date || '').localeCompare(b.day.session_date || ''))
}

export function attentionDestination(item, projectId) {
  if (item.kind === 'register') return ['registers', { sessionId: item.day.id, returnTo: 'projects', projectId }]
  return ['planner', item.kind === 'reflection' ? { reflectSessionId: item.day.id } : { editSessionId: item.day.id }]
}

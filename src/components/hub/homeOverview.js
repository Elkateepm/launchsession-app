export function todayOverview(sessions, attendance, staff, today) {
  const ids = new Set(sessions.filter(s => s.session_date === today && !s.cancelled_at).map(s => s.id))
  const rows = attendance.filter(a => ids.has(a.session_id))
  const unique = values => new Set(values.filter(Boolean)).size
  return {
    sessions: ids.size,
    people: unique(rows.map(a => a.child_id)),
    arrived: unique(rows.filter(a => ['signed_in', 'signed_out'].includes(a.status)).map(a => a.child_id)),
    staff: unique([...ids].flatMap(id => (staff[id] || []).map(p => p.id))),
  }
}

export function monthReflectionCount(sessions, reflections, today) {
  const ids = new Set(sessions.filter(s => !s.cancelled_at && s.session_date >= `${today.slice(0, 7)}-01` && s.session_date <= today && (s.closed_at || s.session_date < today)).map(s => s.id))
  return new Set(reflections.filter(r => ids.has(r.session_id)).map(r => r.session_id)).size
}

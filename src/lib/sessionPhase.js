const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
export function londonNow(now = new Date()) {
  const p = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}
export function londonDate(now = new Date()) { return londonNow(now).slice(0, 10) }
export function sessionPhase(s, now = new Date()) {
  if (s.status === 'cancelled' || s.cancelled_at) return 'cancelled'
  if (s.status === 'draft') return 'draft'
  if (s.closed_at || s.status === 'completed') return 'completed'
  if (!s.session_date) return 'upcoming'
  // Old same-day rows sometimes contain a stray end_date.
  const overnight = s.end_time && s.start_time && s.end_time < s.start_time
  const multiDay = ['trip', 'residential', 'holiday'].includes(s.session_type)
  const endDate = (overnight || multiDay) && s.end_date > s.session_date ? s.end_date : s.session_date
  const clock = londonNow(now)
  if (clock > `${endDate}T${(s.end_time || '23:59:59').padEnd(8, ':00')}`) return 'completed'
  return clock >= `${s.session_date}T${(s.start_time || '00:00:00').padEnd(8, ':00')}` ? 'live' : 'upcoming'
}

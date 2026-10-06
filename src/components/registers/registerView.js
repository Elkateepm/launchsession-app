import { londonDate } from '../../lib/sessionPhase'

export const UNGROUPED = '__ungrouped__'
const normalise = value => String(value || '').trim().toLowerCase()

export function groupFor(person, groups) {
  return groups.find(group => normalise(group.label) === normalise(person.group_name)) || null
}

export function ageOnDate(dob, today = londonDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dob || '').slice(0, 10))) return null
  const [year, month, day] = dob.slice(0, 10).split('-').map(Number)
  const [nowYear, nowMonth, nowDay] = today.split('-').map(Number)
  const age = nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0)
  return age >= 0 && age < 120 ? age : null
}

// Attendance from a previous selection can still be in the hook while a new
// request resolves. Only rows belonging to the selected session can count.
export function registerView({ people, attendance, sessionId, directory, groups, search = '', group = 'all', filter = 'all' }) {
  const records = new Map(attendance.filter(row => sessionId && row.session_id === sessionId).map(row => [row.child_id, row]))
  const roster = people.filter(person => records.has(person.id))
  const source = directory || !sessionId ? people : roster
  const statusOf = id => records.get(id)?.status || 'unmarked'
  const alerts = person => !!(person.allergies || person.medical_notes || person.has_epipen)
  const counts = {
    total: roster.length,
    signed_in: roster.filter(person => statusOf(person.id) === 'signed_in').length,
    expected: roster.filter(person => ['expected', 'unmarked'].includes(statusOf(person.id))).length,
    signed_out: roster.filter(person => statusOf(person.id) === 'signed_out').length,
    absent: roster.filter(person => statusOf(person.id) === 'absent').length,
  }
  const query = normalise(search)
  const visible = source.filter(person => {
    const personGroup = groupFor(person, groups)
    const matchesGroup = group === 'all' || (group === UNGROUPED ? !personGroup : normalise(personGroup?.label) === normalise(group))
    const matchesFilter = filter === 'all' || (filter === 'alerts' ? alerts(person) : filter === 'expected' ? ['expected', 'unmarked'].includes(statusOf(person.id)) : statusOf(person.id) === filter)
    return matchesGroup && matchesFilter && normalise(`${person.first_name || ''} ${person.last_name || ''}`).includes(query)
  }).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'en-GB'))
  return { records, roster, source, visible, counts, statusOf, alertCount: source.filter(alerts).length }
}

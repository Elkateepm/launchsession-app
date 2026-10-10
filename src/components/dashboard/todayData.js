import { supabase } from '../../lib/supabase'
import { londonDayOffset, todayInLondon } from '../../lib/today'
import { isCancelled, isOnDay } from './todayModel'

const SESSION_COLUMNS = 'id,title,session_date,end_date,start_time,end_time,location,session_type,status,cancelled_at,opened_at,closed_at'
const safely = query => Promise.resolve(query).catch(() => ({ error: true }))

export async function loadTodayData(orgId, access) {
  const day = todayInLondon()
  const [plans, hr, urgent] = await Promise.all([
    access.schedule ? safely(supabase.from('sessions').select(SESSION_COLUMNS)
      .eq('org_id', orgId).lte('session_date', londonDayOffset(7))
      .or(`session_date.gte.${day},end_date.gte.${day}`)
      .order('session_date').order('start_time')) : null,
    access.hr ? safely(supabase.from('hr_needs_attention').select('org_id', { count: 'exact', head: true }).eq('org_id', orgId)) : null,
    access.hr ? safely(supabase.from('hr_needs_attention').select('org_id', { count: 'exact', head: true }).eq('org_id', orgId).eq('severity', 1)) : null,
  ])
  const sessions = plans && !plans.error ? plans.data || [] : null
  const ids = (sessions || []).filter(s => !isCancelled(s) && s.status !== 'draft' && isOnDay(s, day)).map(s => s.id)
  const empty = { data: [] }
  const [attendance, staff] = await Promise.all([
    access.registers && sessions ? ids.length ? safely(supabase.from('attendance')
      .select('id,session_id,child_id,status,signed_in_at,signed_out_at').eq('org_id', orgId).in('session_id', ids)) : empty : null,
    access.planner && sessions ? ids.length ? safely(supabase.from('session_staff')
      .select('id,session_id,user_id,volunteer_id,signed_in_at,signed_out_at').eq('org_id', orgId).in('session_id', ids)) : empty : null,
  ])
  return {
    day, sessions,
    attendance: attendance && !attendance.error ? attendance.data || [] : null,
    staff: staff && !staff.error ? staff.data || [] : null,
    hr: hr && !hr.error && typeof hr.count === 'number' ? { count: hr.count, urgent: urgent && !urgent.error && typeof urgent.count === 'number' ? urgent.count : null } : null,
    errors: [plans?.error && 'schedule', attendance?.error && 'attendance', staff?.error && 'staffing', (hr?.error || urgent?.error) && 'HR'].filter(Boolean),
  }
}

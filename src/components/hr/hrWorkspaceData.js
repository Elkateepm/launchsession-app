import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayLondon } from '../../lib/hrAccess'

export const PERSON_FIELDS = 'id, org_id, user_id, full_name, email, job_title, role, department, employment_type, employment_status, is_active, start_date, probation_status, probation_end, line_manager_id'

export const personLink = p => ({ id: p.user_id || null, hr_staff_id: p.id, full_name: p.full_name })
export const currentPerson = p => p.is_active !== false && p.employment_status !== 'left'
export const needsOnboarding = (p, progress) => currentPerson(p) && (!progress || progress.total === 0 || progress.required_outstanding > 0)
export const checkCount = s => s ? Number(s.overdue || 0) + Number(s.missing || 0) + Number(s.due_soon || 0) : null
export const absenceOnDate = (r, date) => r.status !== 'cancelled' && r.start_date <= date && (
  (r.end_date || r.start_date) >= date || (r.status === 'ongoing' && !r.end_date)
)

export function filterPeople(people, filter, query, summaries = {}) {
  const term = query.trim().toLowerCase()
  return people.filter(p => {
    if (filter === 'former' ? p.employment_status !== 'left' : p.employment_status === 'left') return false
    if (filter === 'active' && !currentPerson(p)) return false
    if (['employee', 'volunteer', 'sessional', 'contractor', 'trustee'].includes(filter) && p.employment_type !== filter) return false
    if (filter === 'checks' && !(checkCount(summaries[p.id]) > 0)) return false
    return !term || [p.full_name, p.email, p.job_title, p.role, p.department].filter(Boolean).join(' ').toLowerCase().includes(term)
  })
}

// Supabase caps a response. Paging prevents a large organisation's totals
// and directory from silently stopping at the first 1,000 people.
export async function readAll(makeQuery) {
  const rows = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await makeQuery().range(start, start + 499)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}

const empty = () => ({ people: null, checks: null, onboarding: null, attention: null, leave: null, pending: null, errors: {} })

export function useHRWorkspace(orgId, enabled, viewerKey) {
  const [state, setState] = useState(empty)
  const generation = useRef(0)
  const load = useCallback(async () => {
    if (!enabled || !orgId) return
    const request = ++generation.current
    const today = todayLondon()
    const jobs = {
      people: () => readAll(() => supabase.from('hr_staff').select(PERSON_FIELDS).eq('org_id', orgId).order('full_name').order('id')),
      checks: () => readAll(() => supabase.from('hr_staff_compliance_summary').select('*').eq('org_id', orgId).order('staff_id')),
      onboarding: () => readAll(() => supabase.from('hr_onboarding_progress').select('*').eq('org_id', orgId).order('staff_id')),
      attention: () => readAll(() => supabase.from('hr_needs_attention').select('*').eq('org_id', orgId).order('severity').order('due_date', { nullsFirst: false }).order('entity_id')),
      leave: () => readAll(() => supabase.from('staff_leave').select('id, staff_id, org_id, category, start_date, end_date, status, rtw_required, rtw_completed').eq('org_id', orgId).neq('status', 'cancelled').or(`end_date.gte.${today},start_date.gte.${today},status.eq.ongoing`).order('start_date').order('id')),
      pending: async () => {
        const { count, error } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('approval_status', 'pending')
        if (error) throw error
        return count
      },
    }
    const keys = Object.keys(jobs)
    const results = await Promise.allSettled(keys.map(k => jobs[k]()))
    if (request !== generation.current) return
    const next = empty()
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[keys[i]] = r.value
      else next.errors[keys[i]] = r.reason?.message || 'Could not load records.'
    })
    setState(next)
  }, [orgId, enabled])

  useEffect(() => {
    setState(empty())
    load()
    const refresh = () => { if (!document.hidden) load() }
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      generation.current += 1
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load, viewerKey])

  return { ...state, reload: load }
}

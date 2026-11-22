import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { londonToday } from './sgModel'

// Everything the Safeguarding Hub reads, loaded once for the whole hub.
//
// Every table here was already read by one tab or another (concerns by the
// dashboard, cases by Case Management, injuries by the accident book); loading
// them together is what lets one screen say what is open across all of them.
// Row-level security still decides what comes back: a table someone cannot
// read simply comes back empty, and the hub shows less.
//
// Polled, not subscribed: Realtime crashes iOS WebKit in this app. The poll
// pauses while the app is in the background and catches up on return.

const POLL_MS = 60000
const EMPTY = { concerns: [], cases: [], tasks: [], injuries: [], checks: [], children: [], todaySessions: [] }

export default function useSafeguardingData(org) {
  const orgId = org?.id
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState(londonToday)
  const live = useRef(true)

  const load = useCallback(async () => {
    if (!orgId) return
    const day = londonToday()
    const [con, cs, tasks, inj, chk, kids, sess] = await Promise.all([
      supabase.from('cause_for_concern').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('cases').select('id, child_id, child_name, category, case_type, summary, status, risk_level, priority, assigned_to, assigned_to_user_id, next_review_date, requires_dsl, immediate_danger, risk_ack_at, archived, resolved_at, created_at, updated_at, source_concern_id').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('case_tasks').select('id, case_id, title, due_date, completed').eq('org_id', orgId).eq('completed', false),
      supabase.from('child_injuries').select('id, child_id, child_name, session_id, occurred_at, injury_type, body_part, what_happened, parent_notified, follow_up_needed, sent_to_hospital, created_at').eq('org_id', orgId).order('occurred_at', { ascending: false }).limit(300),
      supabase.from('wellbeing_checks').select('id, child_id, mood, note, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(300),
      supabase.from('children').select('*').eq('org_id', orgId).eq('active', true).order('first_name'),
      supabase.from('sessions').select('id, title, session_date, start_time, end_time, location, status').eq('org_id', orgId).eq('session_date', day).order('start_time'),
    ])
    if (!live.current) return
    setData({
      concerns: con.data || [], cases: cs.data || [], tasks: tasks.data || [], injuries: inj.data || [],
      checks: chk.data || [], children: kids.data || [],
      todaySessions: (sess.data || []).filter(s => s.status !== 'cancelled'),
    })
    setToday(day)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    live.current = true
    load()
    return () => { live.current = false }
  }, [load])

  useEffect(() => {
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
    const timer = setInterval(() => { if (visible()) load() }, POLL_MS)
    const onVisible = () => { if (visible()) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  return { ...data, today, loading, reload: load }
}
